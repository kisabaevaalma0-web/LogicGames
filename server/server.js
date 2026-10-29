
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(express.json({ limit: "3mb" }));
app.use(express.static(path.join(__dirname, "..")));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "logicgames",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4"
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    "Укажите JWT_SECRET длиной не менее 32 символов в файле .env"
  );
  process.exit(1);
}

const publicUser = (row) => {
  const p = row.profile || {};

  return {
    id: row.id,
    name: row.username,
    email: row.email,
    avatarEmoji: p.avatarEmoji || "🧠",
    avatarImage: p.avatarImage || "",
    xp: Number(p.xp || 0),
    plays: Number(p.plays || 0),
    wins: Number(p.wins || 0),
    perfects: Number(p.perfects || 0),
    hardWins: Number(p.hardWins || 0),
    dailyCount: Number(p.dailyCount || 0),
    lastDaily: p.lastDaily || null,
    dayStreak: Number(p.dayStreak || 0),
    lastPlay: p.lastPlay || null,
    g: p.g || {},
    f: p.f || {},
    badges: p.badges || [],
    lv: p.lv || {}
  };
};

function tokenFor(row) {
  return jwt.sign(
    { sub: String(row.id) },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : "";

    const payload = jwt.verify(token, JWT_SECRET);

    const [rows] = await pool.execute(
      "SELECT id, username, email, profile_json FROM users WHERE id = ?",
      [payload.sub]
    );

    if (!rows.length) {
      return res.status(401).json({
        error: "Сессия завершена. Войдите снова."
      });
    }

    req.dbUser = rows[0];

    const profile = rows[0].profile_json;
    req.profile =
      typeof profile === "string"
        ? JSON.parse(profile)
        : profile || {};

    next();
  } catch (e) {
    return res.status(401).json({
      error: "Требуется войти в аккаунт."
    });
  }
}

// Проверка подключения к MySQL
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      database: "connected"
    });
  } catch (e) {
    console.error(e);

    res.status(503).json({
      ok: false,
      error: "Нет подключения к MySQL"
    });
  }
});

// Регистрация
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2 || name.length > 30) {
      return res.status(400).json({
        error: "Имя должно содержать от 2 до 30 символов."
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 190
    ) {
      return res.status(400).json({
        error: "Введите корректную электронную почту."
      });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        error: "Пароль должен содержать от 8 до 72 символов."
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const profile = {
      avatarEmoji: "🧠",
      avatarImage: "",
      xp: 0,
      plays: 0,
      wins: 0,
      perfects: 0,
      hardWins: 0,
      dailyCount: 0,
      lastDaily: null,
      dayStreak: 0,
      lastPlay: null,
      g: {},
      f: {},
      badges: [],
      lv: {}
    };

    const [result] = await pool.execute(
      `INSERT INTO users
       (username, email, password_hash, profile_json)
       VALUES (?, ?, ?, ?)`,
      [name, email, hash, JSON.stringify(profile)]
    );

    const user = publicUser({
      id: result.insertId,
      username: name,
      email,
      profile
    });

    res.status(201).json({
      token: tokenFor({ id: result.insertId }),
      user
    });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: "Это имя пользователя или почта уже заняты."
      });
    }

    console.error(e);

    res.status(500).json({
      error: "Не удалось создать аккаунт."
    });
  }
});

// Вход
app.post("/api/auth/login", async (req, res) => {
  try {
    const identifier = String(req.body.identifier || "").trim();
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        error: "Введите логин и пароль."
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, username, email, password_hash, profile_json
       FROM users
       WHERE LOWER(email) = LOWER(?)
          OR LOWER(username) = LOWER(?)
       LIMIT 1`,
      [identifier, identifier]
    );

    if (
      !rows.length ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        error: "Неверная почта/имя пользователя или пароль."
      });
    }

    const row = rows[0];

    let profile = row.profile_json || {};

    if (typeof profile === "string") {
      profile = JSON.parse(profile);
    }

    res.json({
      token: tokenFor(row),
      user: publicUser({
        id: row.id,
        username: row.username,
        email: row.email,
        profile
      })
    });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "Не удалось выполнить вход."
    });
  }
});

// Таблица лидеров
app.get("/api/leaderboard", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, email, profile_json
       FROM users
       ORDER BY CAST(
         COALESCE(
           JSON_UNQUOTE(JSON_EXTRACT(profile_json, '$.xp')),
           '0'
         ) AS UNSIGNED
       ) DESC, id ASC
       LIMIT 200`
    );

    res.json(
      rows.map((row) => {
        let profile = row.profile_json || {};

        if (typeof profile === "string") {
          profile = JSON.parse(profile);
        }

        return publicUser({
          id: row.id,
          username: row.username,
          email: row.email,
          profile
        });
      })
    );
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "Не удалось загрузить таблицу лидеров."
    });
  }
});

// Сохранение прогресса
app.put("/api/me/progress", auth, async (req, res) => {
  try {
    const profile = req.body.profile;

    if (!profile || typeof profile !== "object") {
      return res.status(400).json({
        error: "Нет данных профиля."
      });
    }

    const safe = {
      avatarEmoji: String(profile.avatarEmoji || "🧠").slice(0, 16),

      avatarImage:
        typeof profile.avatarImage === "string" &&
        profile.avatarImage.startsWith("data:image/")
          ? profile.avatarImage.slice(0, 2500000)
          : "",

      xp: Math.max(0, Number(profile.xp) || 0),
      plays: Math.max(0, Number(profile.plays) || 0),
      wins: Math.max(0, Number(profile.wins) || 0),
      perfects: Math.max(0, Number(profile.perfects) || 0),
      hardWins: Math.max(0, Number(profile.hardWins) || 0),
      dailyCount: Math.max(0, Number(profile.dailyCount) || 0),
      lastDaily: profile.lastDaily || null,
      dayStreak: Math.max(0, Number(profile.dayStreak) || 0),
      lastPlay: profile.lastPlay || null,
      g: profile.g || {},
      f: profile.f || {},
      badges: Array.isArray(profile.badges) ? profile.badges : [],
      lv: profile.lv || {}
    };

    const json = JSON.stringify(safe);

    if (json.length > 2700000) {
      return res.status(413).json({
        error: "Данные профиля слишком большие. Уменьшите размер аватара."
      });
    }

    await pool.execute(
      "UPDATE users SET profile_json = ? WHERE id = ?",
      [json, req.dbUser.id]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error(e);

    res.status(500).json({
      error: "Не удалось сохранить прогресс."
    });
  }
});

// Данные текущего пользователя
app.get("/api/me", auth, (req, res) => {
  res.json({
    user: publicUser({
      id: req.dbUser.id,
      username: req.dbUser.username,
      email: req.dbUser.email,
      profile: req.profile
    })
  });
});

const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`LogicGames открыт: http://localhost:${port}`);
});
