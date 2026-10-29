/* ================= СТИКЕРЫ ФОНА ================= */
(function(){
 const S=["🧩","🧠","💡","🔢","🎯","⭐","🏆","🔐","🃏","🗼","⚡","💾","🎓","📐","🧮"];
 $("stickers").innerHTML=S.map((s,i)=>`<span style="left:${(i*6.7+3)%96}%;animation-duration:${26+(i*7)%22}s;animation-delay:-${(i*5)%30}s;font-size:${26+(i*9)%22}px">${s}</span>`).join("");
})();

/* ================= API + ЛОКАЛЬНЫЙ КЭШ ================= */
/* Accounts and progress are stored in MySQL through the Node.js API.
   localStorage is used only as a UI cache/session token, not as the source of truth. */
const API_BASE = (location.protocol === "http:" || location.protocol === "https:")
  ? `${location.origin}/api` : "http://localhost:3000/api";
let CACHE={};
let cloudOnline=false;
let user=null, difficulty="normal", category="classic";
let authToken=localStorage.getItem("logicgames_token")||"";
const DB={
  all(){
    try { CACHE=JSON.parse(localStorage.getItem("logicedu_v4_cache")||"{}"); } catch(e){CACHE={};}
    return CACHE;
  },
  save(all){
    CACHE=all;
    try { localStorage.setItem("logicedu_v4_cache",JSON.stringify(all)); } catch(e){}
  },
  current(){ try{return localStorage.getItem("logicedu_v4_cur")}catch(e){return null;} }
};
async function api(path, options={}) {
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  if(authToken) headers.Authorization=`Bearer ${authToken}`;
  const res=await fetch(`${API_BASE}${path}`,{...options,headers});
  const data=await res.json().catch(()=>({error:"Ответ сервера не удалось прочитать"}));
  if(!res.ok) throw new Error(data.error||"Ошибка сервера");
  return data;
}
const blank=(name,pass,email="")=>({name,email,pass,avatarEmoji:"🧠",avatarImage:"",xp:0,plays:0,wins:0,perfects:0,hardWins:0,dailyCount:0,lastDaily:null,dayStreak:0,lastPlay:null,g:{},f:{},badges:[],lv:{}});
const hash=s=>{let h=5381;for(const c of s)h=((h<<5)+h+c.charCodeAt(0))|0;return "h"+(h>>>0).toString(36)};
function persist(){
  if(!user)return;
  const all=DB.all();
  const accountKey=(user.email||user.name).trim().toLowerCase();
  all[accountKey]=user; DB.save(all);
  try { localStorage.setItem("logicedu_v4_cur",accountKey); } catch(e){}
  if(authToken){
    api("/me/progress",{method:"PUT",body:JSON.stringify({profile:user})})
      .then(()=>{cloudOnline=true;})
      .catch(err=>{cloudOnline=false;console.warn("Не удалось сохранить в MySQL API:",err.message);});
  }
}
async function cloudFetchAll(){
  try{
    const rows=await api("/leaderboard");
    const all={};
    rows.forEach(a=>{all[(a.email||a.name).trim().toLowerCase()]={...blank(a.name,"",a.email||""),...a};});
    DB.save(all);cloudOnline=true;return all;
  }catch(e){cloudOnline=false;return DB.all();}
}
const levelOf=xp=>Math.min(10,Math.floor(xp/LEVEL_STEP)+1);
const titleOf=xp=>TITLES[levelOf(xp)-1];
/* ================= АВТОРИЗАЦИЯ ================= */
let mode="reg";
$("tabReg").onclick=()=>setMode("reg");
$("tabLogin").onclick=()=>setMode("login");
function setMode(m){
 mode=m;
 $("tabReg").className="py-2.5 rounded-xl text-sm font-semibold transition "+(m==="reg"?"btn-primary":"text-slate-400");
 $("tabLogin").className="py-2.5 rounded-xl text-sm font-semibold transition "+(m==="login"?"btn-primary":"text-slate-400");
 $("regWrap").classList.toggle("hidden",m==="login");
 $("regWrapConfirm").classList.toggle("hidden",m==="login");
 $("authNameLabel").textContent=m==="reg"?"Имя пользователя":"Почта или имя пользователя";
 $("authName").placeholder=m==="reg"?"Например, Айдана":"name@example.com или Айдана";
 $("authPass").placeholder=m==="reg"?"Не менее 8 символов":"Введите пароль";
 $("authPass").autocomplete=m==="reg"?"new-password":"current-password";
 $("authSubmit").textContent=m==="reg"?"Создать аккаунт →":"Войти →";
 $("authError").classList.add("hidden");
}
$("authSubmit").onclick=async()=>{
 const btn=$("authSubmit"),label=btn.textContent;
 const name=$("authName").value.trim(),pass=$("authPass").value,err=$("authError");
 err.classList.add("hidden");
 const fail=(t,el)=>{err.textContent=t;err.classList.remove("hidden");const e=$(el||"authName");e.classList.add("shake");setTimeout(()=>e.classList.remove("shake"),400)};
 if(!name) return fail(mode==="reg"?"Введите имя пользователя.":"Введите почту или имя пользователя.");
 if(mode==="reg"){
  const email=$("authEmail").value.trim().toLowerCase();
  const confirm=$("authPassConfirm").value;
  if(!email) return fail("Введите электронную почту.","authEmail");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Введите корректный адрес электронной почты.","authEmail");
  if(pass.length<8) return fail("Пароль должен содержать не менее 8 символов.","authPass");
  if(pass.length>72) return fail("Пароль слишком длинный.","authPass");
  if(pass!==confirm) return fail("Пароли не совпадают.","authPassConfirm");
 }
 btn.disabled=true;btn.textContent=mode==="reg"?"Создаём аккаунт…":"Входим…";
 try{
  let result;
  if(mode==="reg"){
    result=await api("/auth/register",{method:"POST",body:JSON.stringify({name,email:$("authEmail").value.trim().toLowerCase(),password:pass})});
  }else{
    result=await api("/auth/login",{method:"POST",body:JSON.stringify({identifier:name,password:pass})});
  }
  authToken=result.token;localStorage.setItem("logicgames_token",authToken);
  user={...blank(result.user.name,"",result.user.email||""),...result.user};
  const all=DB.all();all[(user.email||user.name).trim().toLowerCase()]=user;DB.save(all);
  localStorage.setItem("logicedu_v4_cur",(user.email||user.name).trim().toLowerCase());
  cloudOnline=true;
  await cloudFetchAll();
  enterApp();
 }catch(e){fail(e.message||"Не удалось подключиться к серверу. Проверьте, что Node.js и MySQL запущены.");}
 finally{btn.disabled=false;btn.textContent=label;}
};
$("authPass").onkeydown=e=>{if(e.key==="Enter")$("authSubmit").click()};
$("authName").onkeydown=e=>{if(e.key==="Enter")$("authSubmit").click()};
$("authEmail").onkeydown=e=>{if(e.key==="Enter")$("authSubmit").click()};
$("authPassConfirm").onkeydown=e=>{if(e.key==="Enter")$("authSubmit").click()};
const doLogout=()=>{try{localStorage.removeItem("logicedu_v4_cur");localStorage.removeItem("logicgames_token")}catch{};authToken="";location.reload()};
$("logout").onclick=doLogout;$("logout2").onclick=doLogout;
$("resetProgress").onclick=()=>{
 if(!confirm("Сбросить весь прогресс этого аккаунта?"))return;
 const savedAvatar={avatarEmoji:user.avatarEmoji||"🧠",avatarImage:user.avatarImage||""};
 user={...blank(user.name,user.pass,user.email||""),...savedAvatar}; persist(); renderAll(); show("profile"); toast("♻️","Прогресс сброшен");
};
function enterApp(){$("authScreen").classList.add("hidden");$("app").classList.remove("hidden");renderAll();show("home")}

/* ================= НАВИГАЦИЯ ================= */
document.addEventListener("click",e=>{const b=e.target.closest("[data-nav]");if(b)show(b.dataset.nav)});
document.addEventListener("click",e=>{const b=e.target.closest("[data-play]");if(b)startGame(b.dataset.play,b.dataset.daily==="1")});
document.addEventListener("click",e=>{const b=e.target.closest("[data-lvplay]");if(b)startLevelGame(b.dataset.lvplay,b.dataset.lv)});
function show(p){
 if(p!=="play") quitRun();
 document.querySelectorAll(".page").forEach(s=>s.classList.remove("active"));
 $("page-"+p).classList.add("active");
 document.querySelectorAll("header .nav").forEach(n=>n.classList.toggle("on",n.dataset.nav===p));
 window.scrollTo({top:0,behavior:"smooth"});
 if(p==="rating")renderRating();
 if(p==="daily")renderDaily();
 if(p==="home")renderHome();
}
function toast(icon,title,sub){
 const d=document.createElement("div");
 d.className="glass rounded-2xl px-4 py-3 flex items-center gap-3 min-w-[240px]";
 d.innerHTML=`<span class="text-2xl">${icon}</span><div><div class="font-semibold text-sm">${esc(title)}</div>${sub?`<div class="text-xs text-slate-400">${esc(sub)}</div>`:""}</div>`;
 $("toast").appendChild(d);setTimeout(()=>d.remove(),4200);
}

/* ================= РЕНДЕР ================= */
function renderAll(){renderHeader();renderDiff();renderGames();renderAbout();renderAch();renderRating();renderProfile();renderHome();renderDaily()}
function renderHeader(){$("hLevel").textContent=levelOf(user.xp);$("hXp").textContent=user.xp;$("hStreak").textContent=user.dayStreak}
function renderHome(){
 const lvl=levelOf(user.xp);
 $("sWins").textContent=user.wins;$("sBadges").textContent=user.badges.length;
 const rows=Object.values(DB.all()).sort((a,b)=>b.xp-a.xp);$("sRank").textContent=rows.findIndex(u=>u.name===user.name)+1||1;
 $("emblemWall").innerHTML=GAMES.map(g=>`<button data-play="${g.id}" title="${esc(g.name)}" class="btn">${emblem(g,(user.g[g.id]||{}).w?"":"opacity-60")}</button>`).join("");
 $("homeRank").textContent=`Ур. ${lvl} — ${titleOf(user.xp)}`;
 $("homeNext").textContent=lvl<10?`${user.xp} / ${lvl*LEVEL_STEP} XP`:"Максимум";
 $("homeBar").style.width=(lvl<10?(user.xp%LEVEL_STEP)/LEVEL_STEP*100:100)+"%";
 const next=GAMES.filter(g=>!(user.g[g.id]||{}).w).slice(0,3);const list=next.length?next:GAMES.slice(0,3);
 $("continueRow").innerHTML=list.map(g=>`<button data-play="${g.id}" class="glass card rounded-2xl p-4 flex items-center gap-4 text-left">${emblem(g)}<div class="flex-1"><div class="font-bold">${g.name}</div><div class="text-xs text-slate-400">${(user.g[g.id]||{}).w?"повторить · рекорд "+user.g[g.id].best+" XP":"ещё не пройдена"}</div></div><span class="text-xl">▶</span></button>`).join("");
}
function renderDiff(){
 const cls=category==="classic";
 $("diffRow").innerHTML=Object.values(DIFF).map(d=>`<button onclick="setDiff('${d.k}')" class="btn px-4 py-2 rounded-xl text-sm font-semibold ${cls&&difficulty===d.k?"btn-primary":"btn-ghost"}">${d.icon} ${d.name} ×${d.mult}</button>`).join("")
  +`<span class="sep"></span><button onclick="setCategory('levels')" class="btn px-4 py-2 rounded-xl text-sm font-semibold ${cls?"btn-ghost":"btn-primary"}">🪜 Лестница мастерства · 10 уровней</button>`;
}
function setDiff(k){difficulty=k;category="classic";renderDiff();renderGames()}
function setCategory(c){category=c;renderDiff();renderGames()}
function renderLevelGames(){
 $("gamesGrid").innerHTML=LEVEL_GAMES.map(g=>{
  const done=lvDone(g.id),next=Math.min(done+1,MAX_LEVEL),st=user.g[g.id]||{p:0,w:0,best:0},all=done>=MAX_LEVEL;
  const lv=[...Array(MAX_LEVEL).keys()].map(i=>{const l=i+1,c=l<=done?"done":l===done+1?"next":"lock";
   return `<button class="lvb ${c}" ${c==="lock"?"disabled":`data-lvplay="${g.id}" data-lv="${l}"`} title="Уровень ${l} · до ${lvXp(g,l)} XP">${l<=done?"✓":l}</button>`}).join("");
  return `<div class="glass card rounded-2xl p-5 flex flex-col">
   <div class="flex items-start justify-between mb-3">${emblem(g)}<span class="text-xs px-2 py-1 rounded-full ${all?"bg-amber-500/20 text-amber-300":done?"bg-emerald-500/20 text-emerald-300":"bg-white/10 text-slate-300"}">${all?"🏆 пройдена":"ур. "+done+" / "+MAX_LEVEL}</span></div>
   <div class="font-bold text-lg">${g.name}</div>
   <div class="text-sm text-slate-400 mb-3 flex-1">${g.desc}</div>
   <div class="text-xs text-slate-500 mb-2">${g.skill} · сыграно ${st.p} · рекорд ${st.best||0} XP</div>
   <div class="grid grid-cols-10 gap-1 mb-3">${lv}</div>
   <div class="bar mb-3"><div style="width:${done/MAX_LEVEL*100}%"></div></div>
   <button data-lvplay="${g.id}" data-lv="${next}" class="btn btn-primary py-2.5 rounded-xl font-semibold text-sm">${all?"Повторить уровень 10":"Играть · уровень "+next} · до ${lvXp(g,next)} XP</button>
   <div class="text-xs text-slate-500 text-center mt-2">награда за уровень: ${g.min} XP (ур. 1) → ${g.max} XP (ур. 10)</div>
  </div>`;
 }).join("");
}
function renderGames(){
 if(category==="levels")return renderLevelGames();
 const d=DIFF[difficulty];
 $("gamesGrid").innerHTML=GAMES.map(g=>{
  const st=user.g[g.id]||{p:0,w:0,best:0};
  return `<div class="glass card rounded-2xl p-5 flex flex-col">
   <div class="flex items-start justify-between mb-3">${emblem(g)}<span class="text-xs px-2 py-1 rounded-full ${st.w?"bg-emerald-500/20 text-emerald-300":"bg-white/10 text-slate-300"}">${st.w?"✔ пройдена":"новая"}</span></div>
   <div class="font-bold text-lg">${g.name}</div>
   <div class="text-sm text-slate-400 mb-3 flex-1">${g.desc}</div>
   <div class="text-xs text-slate-500 mb-3">${g.skill} · сыграно ${st.p} · рекорд ${st.best||0} XP</div>
   <button data-play="${g.id}" class="btn btn-primary py-2.5 rounded-xl font-semibold text-sm">Играть · ${d.icon} до ${Math.round(g.reward*d.mult)} XP</button>
  </div>`;
 }).join("");
}
function renderAbout(){
 $("aboutGrid").innerHTML=GAMES.map(g=>`<div class="glass rounded-2xl p-5 flex gap-4">${emblem(g)}<div><div class="font-bold">${g.name} <span class="text-xs text-slate-500 font-normal">· ${g.skill}</span></div><p class="text-sm text-slate-400 mt-1">${g.how}</p><div class="text-xs text-slate-500 mt-2">до ${g.reward} XP на лёгком</div></div></div>`).join("");
}
function renderAch(){
 const lvl=levelOf(user.xp);
 $("achNow").textContent=`Ур. ${lvl} — ${titleOf(user.xp)}`;
 $("achNext").textContent=lvl<10?`${user.xp} / ${lvl*LEVEL_STEP} XP до ур. ${lvl+1}`:"Максимальный ранг!";
 $("achBar").style.width=(lvl<10?(user.xp%LEVEL_STEP)/LEVEL_STEP*100:100)+"%";
 $("achGrid").innerHTML=TITLES.map((t,i)=>{const need=i*LEVEL_STEP,open=user.xp>=need;
  return `<div class="glass rounded-2xl p-4 text-center ${open?"":"opacity-50"}"><div class="text-3xl mb-1">${open?"🏅":"🔒"}</div><div class="text-xs text-slate-400">Ур. ${i+1}</div><div class="font-bold text-sm">${t}</div><div class="text-xs text-slate-500">${need} XP</div></div>`}).join("");
 $("badgeCount").textContent=`${user.badges.length} / ${BADGES.length}`;
 $("badgeGrid").innerHTML=BADGES.map(b=>{const open=user.badges.includes(b.id);
  return `<div class="glass badge rounded-2xl p-4 flex gap-3 items-center ${open?"open":"lock"}"><div class="text-3xl">${open?b.icon:"🔒"}</div><div><div class="font-bold text-sm">${b.name}</div><div class="text-xs text-slate-400">${b.desc}</div></div></div>`}).join("");
}
function renderRating(){
 cloudFetchAll().then(()=>{if($("page-rating").classList.contains("active"))paintRating()});
 paintRating();
}
function paintRating(){
 const all=Object.values(DB.all()).sort((a,b)=>(b.xp||0)-(a.xp||0));
 $("ratingBody").innerHTML=all.map((u,i)=>`<tr class="border-t border-white/5 ${u.name===user.name?"bg-indigo-500/10":""}">
  <td class="p-3 font-bold">${["🥇","🥈","🥉"][i]||i+1}</td><td class="p-3"><div class="flex items-center gap-3 min-w-[150px]"><div class="emblem sm user-avatar leaderboard-avatar">${avatarContent(u)}</div><div class="font-semibold">${esc(u.name)}${u.name===user.name?' <span class="text-xs text-cyan-300">вы</span>':""}</div></div></td><td class="p-3">${titleOf(u.xp||0)}</td><td class="p-3">${u.wins||0}</td><td class="p-3">${(u.badges||[]).length}</td><td class="p-3 font-bold text-cyan-300">${u.xp||0}</td></tr>`).join("")||`<tr><td colspan="6" class="p-6 text-center text-slate-500">Пока нет игроков. Зарегистрируйтесь первым!</td></tr>`;
}
function renderProfile(){
 $("pAvatar").innerHTML=avatarContent(user);$("pName").textContent=user.name;
 renderAvatarOptions();
 $("pTitle").textContent=`Ур. ${levelOf(user.xp)} — ${titleOf(user.xp)} · ${user.xp} XP · серия дней ${user.dayStreak}`;
 $("pPlays").textContent=user.plays||0;$("pWins").textContent=user.wins||0;$("pPerf").textContent=user.perfects||0;
 $("pGames").innerHTML=GAMES.map(g=>{const st=user.g[g.id]||{p:0,w:0,best:0};const pct=st.p?Math.round(st.w/st.p*100):0;
  return `<div class="glass rounded-2xl p-4 flex items-center gap-3">${emblem(g,"sm")}<div class="flex-1"><div class="flex justify-between text-sm"><span class="font-semibold">${g.name}</span><span class="text-slate-400">сыграно ${st.p} · побед ${st.w} · рекорд ${st.best||0} XP</span></div><div class="bar mt-2"><div style="width:${pct}%"></div></div></div></div>`}).join("");
}
/* ================= АВАТАРЫ ПРОФИЛЯ ================= */
const FREE_AVATARS=["🧠","🦊","🐼","🐯","🐸","🐱","🐶","🐺","🦄","🐲","🤖","👾","👑","🦁","🐨","🐙","🦉","🐵","🐧","🐢","🦋","🐝","🌟","🚀"];
function avatarContent(account){
 const src=account&&typeof account.avatarImage==="string"&&/^data:image\/(png|jpeg|webp);base64,/i.test(account.avatarImage)?account.avatarImage:"";
 if(src)return `<img src="${src}" alt="Аватар ${esc(account.name||"игрока")}" class="avatar-photo">`;
 return esc((account&&account.avatarEmoji)||"🧠");
}
function renderAvatarOptions(){
 const wrap=$("avatarOptions");if(!wrap)return;
 wrap.innerHTML=FREE_AVATARS.map((emoji)=>`<button type="button" class="avatar-choice ${(!user.avatarImage&&(user.avatarEmoji||"🧠")===emoji)?"selected":""}" data-avatar="${emoji}" aria-label="Выбрать аватар ${emoji}" title="Выбрать ${emoji}"><span>${emoji}</span></button>`).join("");
}
$("openAvatarPicker").onclick=()=>$("avatarPicker").classList.toggle("hidden");
$("avatarOptions").addEventListener("click",e=>{
 const b=e.target.closest("[data-avatar]");if(!b)return;
 user.avatarEmoji=b.dataset.avatar;user.avatarImage="";persist();renderProfile();paintRating();
 toast("🖼️","Аватар изменён","Теперь он отображается в профиле и таблице лидеров.");
});
$("avatarUpload").addEventListener("change",e=>{
 const file=e.target.files&&e.target.files[0];if(!file)return;
 if(!file.type.startsWith("image/")){toast("⚠️","Выбери файл изображения");e.target.value="";return;}
 if(file.size>12*1024*1024){toast("⚠️","Файл слишком большой","Выбери изображение размером до 12 МБ.");e.target.value="";return;}
 const reader=new FileReader();
 reader.onerror=()=>toast("⚠️","Не удалось прочитать изображение");
 reader.onload=()=>{
  const img=new Image();
  img.onerror=()=>toast("⚠️","Не удалось открыть изображение");
  img.onload=()=>{
   const canvas=document.createElement("canvas"),max=320;
   const scale=Math.min(1,max/Math.max(img.width,img.height));
   canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));
   const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
   try{
    user.avatarImage=canvas.toDataURL("image/jpeg",0.82);user.avatarEmoji="";persist();renderProfile();paintRating();
    $("avatarPicker").classList.add("hidden");toast("🖼️","Фото установлено","Аватар сохранён в этом браузере.");
   }catch(err){toast("⚠️","Не удалось сохранить фото","Попробуй другое изображение меньшего размера.");}
   e.target.value="";
  };
  img.src=reader.result;
 };
 reader.readAsDataURL(file);
});

function dailyGame(){const n=Math.floor(Date.now()/864e5);return GAMES[n%GAMES.length]}
function renderDaily(){
 const g=dailyGame(),done=user.lastDaily===today();
 $("dailyEmblem").innerHTML=emblem(g,"lg mx-auto");$("dailyGame").textContent=`Сегодня: ${g.name} · ${g.skill}`;
 $("dailyState").textContent=done?"Сегодня задание уже выполнено. Возвращайтесь завтра!":"Задание доступно — награда ×2";
 $("dailyBtn").disabled=done;$("dailyBtn").textContent=done?"Выполнено ✓":"Пройти задание дня";
 $("dailyBtn").onclick=()=>startGame(g.id,true);
}

/* ================= ИГРОВОЙ ДВИЖОК ================= */
let run=null;
function quitRun(){if(!run)return;clearInterval(run.clock);(run.cleanups||[]).forEach(f=>{try{f()}catch{}});run=null}
$("quitGame").onclick=()=>{quitRun();show("games")};
function startGame(id,daily=false){
 const g=GAMES.find(x=>x.id===id);if(!g)return;
 if(daily&&user.lastDaily===today()){toast("🎯","Задание дня уже выполнено");return}
 quitRun();
 const d=DIFF[difficulty];
 run={g,d,daily,t0:Date.now(),done:false,cleanups:[]};
 show("play");
 $("playHead").innerHTML=`${emblem(g)}<div class="flex-1"><div class="font-bold text-lg">${g.name}${daily?' <span class="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">задание дня ×2</span>':""}</div><div class="text-xs text-slate-400">${d.icon} ${d.name} · ${g.how}</div></div>`;
 $("playStatus").textContent="";$("playClock").textContent="0:00";
 run.clock=setInterval(()=>{if(run)$("playClock").textContent=fmt(Date.now()-run.t0)},500);
 const area=$("playArea");area.innerHTML="";
 $("page-play").dataset.game=id; $("page-play").classList.add("game-theme"); area.dataset.game=id; $("playHead").dataset.game=id;
 const api={d,area,status:t=>$("playStatus").textContent=t,onQuit:f=>run.cleanups.push(f),finish:r=>finishGame(r)};
 ENGINES[id](area,api);
}
function startLevelGame(id,level){
 const g=LEVEL_GAMES.find(x=>x.id===id);if(!g)return;level=+level||1;
 if(level>MAX_LEVEL||level>lvDone(id)+1){toast("🔒","Уровень пока закрыт","Сначала пройдите предыдущий");return}
 quitRun();
 const rg={...g,reward:lvXp(g,level)},d={k:"level",name:"Уровень "+level,mult:1,icon:"🪜"};
 run={g:rg,d,daily:false,level,t0:Date.now(),done:false,cleanups:[]};
 show("play");
 $("playHead").innerHTML=`${emblem(rg)}<div class="flex-1"><div class="font-bold text-lg">${rg.name} <span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300">🪜 уровень ${level} / ${MAX_LEVEL} · до ${rg.reward} XP</span></div><div class="text-xs text-slate-400">${rg.how}</div></div>`;
 $("playStatus").textContent="";$("playClock").textContent="0:00";
 run.clock=setInterval(()=>{if(run)$("playClock").textContent=fmt(Date.now()-run.t0)},500);
 const area=$("playArea");area.innerHTML="";
 $("page-play").dataset.game=id; $("page-play").classList.add("game-theme"); area.dataset.game=id; $("playHead").dataset.game=id;
 const api={d,level,area,status:t=>$("playStatus").textContent=t,onQuit:f=>run.cleanups.push(f),finish:r=>finishGame(r)};
 LEVEL_ENGINES[id](area,api,level);
}
function finishGame({won,perf,summary,flags={},details=""}){
 if(!run||run.done)return;run.done=true;
 const r=run;clearInterval(r.clock);(r.cleanups||[]).forEach(f=>{try{f()}catch{}});
 const secs=(Date.now()-r.t0)/1000;perf=clamp(perf,0,1);
 let xp=r.g.reward*r.d.mult*perf*(r.daily?2:1);
 let speed=false;if(won&&secs<45){xp*=1.15;speed=true}
 xp=Math.round(xp);
 // обновление пользователя
 user.xp+=xp;user.plays++;if(won)user.wins++;
 if(won&&perf>=0.999)user.perfects++;
 if(won&&r.d.k==="hard")user.hardWins++;
 const st=user.g[r.g.id]||{p:0,w:0,best:0};st.p++;if(won)st.w++;st.best=Math.max(st.best||0,xp);user.g[r.g.id]=st;
 if(won){for(const k in flags){const v=flags[k];if(typeof v==="number")user.f[k]=Math.max(user.f[k]||0,v);else if(v)user.f[k]=true}}
 if(won&&secs<30)user.f.speedrun=true;
 if(r.level&&won){user.lv=user.lv||{};user.lv[r.g.id]=Math.max(user.lv[r.g.id]||0,r.level)}
 if(r.daily&&won){user.lastDaily=today();user.dailyCount++}
 const t=today();if(user.lastPlay!==t){const y=new Date(Date.now()-864e5).toISOString().slice(0,10);user.dayStreak=user.lastPlay===y?user.dayStreak+1:1;user.lastPlay=t}
 const before=levelOf(user.xp-xp),after=levelOf(user.xp);
 const newB=BADGES.filter(b=>!user.badges.includes(b.id)&&b.check(user));newB.forEach(b=>user.badges.push(b.id));
 persist();renderHeader();renderGames();renderAch();renderProfile();renderDaily();
 newB.forEach((b,i)=>setTimeout(()=>toast(b.icon,"Новое достижение: "+b.name,b.desc),400+i*600));
 if(after>before)setTimeout(()=>toast("⭐","Новый уровень "+after+"!",titleOf(user.xp)),200);
 $("playArea").innerHTML=`<div class="text-center pop">
  <div class="text-6xl mb-3">${won?(perf>=0.999?"🏆":"🎉"):"📘"}</div>
  <h3 class="text-2xl font-bold mb-1">${won?(r.daily?"Задание дня выполнено!":r.level?`Уровень ${r.level} пройден!`:"Победа!"):"Попробуйте ещё раз"}</h3>
  <p class="text-slate-400 mb-3">${esc(summary)} · качество ${Math.round(perf*100)}% · время ${fmt(secs*1000)}${speed?" · 🚀 бонус скорости":""}</p>
  <div class="text-4xl font-bold grad-text display mb-1">+${xp} XP</div>
  <p class="text-sm text-slate-400 mb-5">Ур. ${after} — ${titleOf(user.xp)} · всего ${user.xp} XP</p>
  ${details}
  ${newB.length?`<div class="glass rounded-2xl p-4 mb-5 text-left"><div class="font-semibold mb-2">🏅 Новые медали</div>${newB.map(b=>`<div class="text-sm">${b.icon} ${b.name} — <span class="text-slate-400">${b.desc}</span></div>`).join("")}</div>`:""}
  <div class="flex flex-wrap justify-center gap-3">
   ${r.level?(won&&r.level<MAX_LEVEL?`<button data-lvplay="${r.g.id}" data-lv="${r.level+1}" class="btn btn-primary px-5 py-2.5 rounded-xl font-semibold">Уровень ${r.level+1} → до ${lvXp(r.g,r.level+1)} XP</button>`:"")+`<button data-lvplay="${r.g.id}" data-lv="${r.level}" class="btn btn-ghost px-5 py-2.5 rounded-xl font-semibold">Повторить уровень ${r.level}</button>`:r.daily?"":`<button data-play="${r.g.id}" class="btn btn-primary px-5 py-2.5 rounded-xl font-semibold">Сыграть снова</button>`}
   <button data-nav="games" class="btn btn-ghost px-5 py-2.5 rounded-xl font-semibold">В каталог</button>
   <button data-nav="rating" class="btn btn-ghost px-5 py-2.5 rounded-xl font-semibold">Рейтинг</button>
  </div></div>`;
 run=null;
}

/* ================= ИГРЫ ================= */
const ENGINES={};

/* --- 1. Логический дозор (викторина) --- */
ENGINES.quiz=(area,api)=>{
 const time={easy:40,normal:25,hard:15}[api.d.k], qs=shuffle(QUIZ).slice(0,6);
 let i=0,score=0,correct=0,hint=false,left=0,tid=null,mistakes=[];
 api.onQuit(()=>clearInterval(tid));
 function step(){
  const q=qs[i];hint=false;left=time;
  api.status(`Вопрос ${i+1}/${qs.length}`);
  area.innerHTML=`<div class="flex justify-between text-xs text-slate-400 mb-2"><span>Вопрос ${i+1} из ${qs.length}</span><span id="qt">${time}с</span></div>
   <div class="bar mb-4"><div id="qb" style="width:100%"></div></div>
   <h3 class="text-xl font-bold mb-4">${esc(q.q)}</h3>
   <div id="answers" class="grid gap-2 mb-3"></div>
   <div id="hint" class="hidden text-sm text-amber-300 mb-3"></div>
   <div class="flex justify-between items-center"><button id="hintBtn" class="btn btn-ghost px-3 py-1.5 rounded-lg text-xs">💡 Подсказка (−50%)</button><span class="text-xs text-slate-500">верно: ${correct}</span></div>
   <div id="fb" class="mt-3"></div>`;
  $("hintBtn").onclick=()=>{hint=true;$("hint").textContent="💡 "+q.h;$("hint").classList.remove("hidden");$("hintBtn").disabled=true};
  const box=$("answers");
  if(q.t==="choice"){
   box.innerHTML=q.o.map((o,idx)=>`<button data-i="${idx}" class="ans ans-btn glass rounded-xl px-4 py-3 text-sm">${esc(o)}</button>`).join("");
   box.querySelectorAll(".ans").forEach(b=>b.onclick=()=>{const ok=+b.dataset.i===q.a;b.classList.add(ok?"bg-emerald-500/30":"bg-rose-500/30");if(!ok)box.querySelectorAll(".ans")[q.a].classList.add("bg-emerald-500/20");answer(ok)});
  }else{
   box.innerHTML=`<div class="flex gap-2"><input id="inp" class="inp" placeholder="Ваш ответ" autocomplete="off"><button id="send" class="btn btn-primary px-5 rounded-xl font-semibold">Ответить</button></div>`;
   const go=()=>{const v=$("inp").value.trim().toLowerCase();if(!v)return;answer(q.a.some(a=>a.toLowerCase()===v))};
   $("send").onclick=go;$("inp").onkeydown=e=>{if(e.key==="Enter")go()};$("inp").focus();
  }
  clearInterval(tid);tid=setInterval(()=>{left--;const b=$("qb"),t=$("qt");if(!b){clearInterval(tid);return}b.style.width=(left/time*100)+"%";t.textContent=left+"с";if(left<=0){clearInterval(tid);answer(false,true)}},1000);
 }
 function answer(ok,timeout){
  clearInterval(tid);const q=qs[i];
  if(ok){correct++;score+=hint?.5:1}else mistakes.push(q);
  area.querySelectorAll("#answers button,#answers input,#hintBtn").forEach(el=>el.disabled=true);
  $("fb").innerHTML=`<div class="glass rounded-xl p-3 text-sm ${ok?"border-emerald-500/50":"border-rose-500/50"}"><div class="font-semibold">${ok?"✅ Верно!":timeout?"⏱ Время вышло":"❌ Неверно"}</div>${!ok?`<div class="text-emerald-300 mt-2">Правильный ответ: ${esc(q.t==="choice"?q.o[q.a]:q.a[0])}</div>`:""}<div class="text-slate-300 mt-2">${esc(q.e)}</div>${!ok?'<button id="quizNext" class="btn btn-primary px-5 py-2 rounded-xl font-semibold mt-3">Далее →</button>':""}</div>`;
  const advance=()=>{i++;if(i<qs.length)step();else end()};
  if(!ok){$("quizNext").onclick=advance}else setTimeout(advance,900);
 }
 function end(){
  const details=mistakes.length?`<div class="glass rounded-2xl p-4 mb-5 text-left"><div class="font-semibold mb-2">📝 Разбор ошибок (${mistakes.length})</div>${mistakes.map(m=>`<div class="text-sm mb-2"><div class="font-medium">${esc(m.q)}</div><div class="text-emerald-300">Ответ: ${esc(m.t==="choice"?m.o[m.a]:m.a[0])}</div><div class="text-slate-400 text-xs">${esc(m.e)}</div></div>`).join("")}</div>`:"";
  api.finish({won:correct>=Math.ceil(qs.length/2),perf:score/qs.length,summary:`Верно ${correct} из ${qs.length}`,flags:{quizPerfect:correct===qs.length},details});
 }
 step();
};

/* --- 2. Мини-судоку 4×4 --- */
ENGINES.sudoku=(area,api)=>{
 const holes={easy:6,normal:8,hard:11}[api.d.k];
 let sol=[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]];
 const map=shuffle([1,2,3,4]);sol=sol.map(r=>r.map(v=>map[v-1]));
 if(Math.random()<.5)sol=[sol[1],sol[0],sol[2],sol[3]];if(Math.random()<.5)sol=[sol[0],sol[1],sol[3],sol[2]];
 if(Math.random()<.5)sol=[sol[2],sol[3],sol[0],sol[1]];
 if(Math.random()<.5)sol=sol.map(r=>[r[1],r[0],r[2],r[3]]);if(Math.random()<.5)sol=sol.map(r=>[r[0],r[1],r[3],r[2]]);
 if(Math.random()<.5)sol=sol[0].map((_,c)=>sol.map(r=>r[c]));
 const grid=sol.map(r=>[...r]);const idx=shuffle([...Array(16).keys()]).slice(0,holes);idx.forEach(k=>grid[Math.floor(k/4)][k%4]=0);
 const fixed=grid.map(r=>r.map(v=>v!==0));
 let sel=null,errors=0,filled=0;
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span>Заполните все клетки</span><span id="sErr">ошибок: 0</span></div>
  <div id="sg" class="grid grid-cols-4 gap-1.5 max-w-xs mx-auto mb-4"></div>
  <div class="flex justify-center gap-2">${[1,2,3,4].map(n=>`<button data-n="${n}" class="num btn btn-ghost w-12 h-12 rounded-xl text-lg font-bold">${n}</button>`).join("")}<button data-n="0" class="num btn btn-ghost w-12 h-12 rounded-xl">⌫</button></div>`;
 function draw(){
  $("sg").innerHTML=grid.map((r,i)=>r.map((v,j)=>`<div data-i="${i}" data-j="${j}" class="cell text-xl ${fixed[i][j]?"fixed":""} ${sel&&sel[0]===i&&sel[1]===j?"sel":""} ${v&&!fixed[i][j]&&v!==sol[i][j]?"bad":""}" style="${(j===1?'margin-right:6px;':'')+(i===1?'margin-bottom:6px;':'')}">${v||""}</div>`).join("")).join("");
  $("sg").querySelectorAll(".cell:not(.fixed)").forEach(c=>c.onclick=()=>{sel=[+c.dataset.i,+c.dataset.j];draw()});
 }
 area.querySelectorAll(".num").forEach(b=>b.onclick=()=>{
  if(!sel)return;const [i,j]=sel,n=+b.dataset.n;
  if(n&&n!==sol[i][j]){errors++;$("sErr").textContent="ошибок: "+errors}
  grid[i][j]=n;draw();
  if(grid.every((r,i)=>r.every((v,j)=>v===sol[i][j])))api.finish({won:true,perf:clamp(1-errors*.15,.3,1),summary:`Судоку решено, ошибок: ${errors}`,flags:{sudokuClean:errors===0}});
 });
 const key=e=>{if(/^[1-4]$/.test(e.key)){const b=area.querySelector(`.num[data-n="${e.key}"]`);b&&b.click()}if(e.key==="Backspace"){area.querySelector('.num[data-n="0"]').click()}};
 document.addEventListener("keydown",key);api.onQuit(()=>document.removeEventListener("keydown",key));
 draw();
};

/* --- 3. Мемори --- */
ENGINES.memory=(area,api)=>{
 const pairs={easy:6,normal:8,hard:10}[api.d.k],cols={easy:4,normal:4,hard:5}[api.d.k];
 const pool=shuffle(["🍎","🚀","🐙","🎲","🌵","🎸","🦊","⚽","🍩","🐳","🎈","🧊","🪐","🍕","🦋","🎯"]).slice(0,pairs);
 const cards=shuffle([...pool,...pool]);let open=[],lock=false,moves=0,matched=0;
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span>Найдите ${pairs} пар</span><span id="mMoves">попыток: 0</span></div><div id="mg" class="grid gap-2 max-w-md mx-auto" style="grid-template-columns:repeat(${cols},1fr)"></div>`;
 $("mg").innerHTML=cards.map((c,i)=>`<div class="mcard" data-i="${i}"><div class="in"><div class="f">❔</div><div class="b">${c}</div></div></div>`).join("");
 const els=[...$("mg").children];
 els.forEach(el=>el.onclick=()=>{
  if(lock||el.classList.contains("flip"))return;
  el.classList.add("flip");open.push(el);
  if(open.length===2){
   lock=true;moves++;$("mMoves").textContent="попыток: "+moves;
   const [a,b]=open;const same=cards[a.dataset.i]===cards[b.dataset.i];
   setTimeout(()=>{
    if(same){a.classList.add("done");b.classList.add("done");matched++;if(matched===pairs)api.finish({won:true,perf:clamp(pairs*1.5/moves,.35,1),summary:`Все пары найдены за ${moves} попыток`,flags:{memoryPro:moves<=pairs+3}})}
    else{a.classList.remove("flip");b.classList.remove("flip")}
    open=[];lock=false;
   },same?300:(api.d.k==="hard"?550:900));
  }
 });
};

/* --- 4. Пятнашки --- */
ENGINES.slide=(area,api)=>{
 const n={easy:3,normal:4,hard:4}[api.d.k],scr={easy:60,normal:200,hard:400}[api.d.k],par={easy:35,normal:110,hard:130}[api.d.k];
 let t=[...Array(n*n).keys()].map(i=>(i+1)%(n*n)),blank=n*n-1,moves=0;
 const nb=b=>{const r=Math.floor(b/n),c=b%n,a=[];if(r>0)a.push(b-n);if(r<n-1)a.push(b+n);if(c>0)a.push(b-1);if(c<n-1)a.push(b+1);return a};
 let last=-1;for(let k=0;k<scr;k++){const opts=nb(blank).filter(x=>x!==last);const m=opts[rnd(opts.length)];t[blank]=t[m];t[m]=0;last=blank;blank=m}
 if(t.every((v,i)=>v===(i+1)%(n*n))){const m=nb(blank)[0];t[blank]=t[m];t[m]=0;blank=m}
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span>Соберите числа по порядку</span><span id="pMoves">ходов: 0</span></div><div id="pg" class="grid gap-2 max-w-sm mx-auto" style="grid-template-columns:repeat(${n},1fr)"></div>`;
 function draw(){$("pg").innerHTML=t.map((v,i)=>`<div data-i="${i}" class="tile ${v?"":"blank"}">${v||""}</div>`).join("");
  $("pg").querySelectorAll(".tile:not(.blank)").forEach(el=>el.onclick=()=>move(+el.dataset.i))}
 function move(i){if(!nb(blank).includes(i))return;t[blank]=t[i];t[i]=0;blank=i;moves++;$("pMoves").textContent="ходов: "+moves;draw();
  if(t.every((v,i)=>v===(i+1)%(n*n)))api.finish({won:true,perf:clamp(par/moves,.3,1),summary:`Собрано за ${moves} ходов`})}
 const key=e=>{const r=Math.floor(blank/n),c=blank%n;const map={ArrowUp:r<n-1?blank+n:-1,ArrowDown:r>0?blank-n:-1,ArrowLeft:c<n-1?blank+1:-1,ArrowRight:c>0?blank-1:-1};if(e.key in map){e.preventDefault();if(map[e.key]>=0)move(map[e.key])}};
 document.addEventListener("keydown",key);api.onQuit(()=>document.removeEventListener("keydown",key));
 draw();
};

/* --- 5. Ханойская башня --- */
ENGINES.hanoi=(area,api)=>{
 const n={easy:3,normal:4,hard:5}[api.d.k],opt=2**n-1;
 const pegs=[[...Array(n).keys()].map(i=>n-i),[],[]];let sel=null,moves=0;
 const colors=["#6366f1","#22d3ee","#f472b6","#f59e0b","#10b981","#a855f7"];
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span>Перенесите все диски на правый стержень</span><span id="hMoves">ходов: 0 · оптимум ${opt}</span></div><div id="hp" class="flex gap-3"></div><p class="text-xs text-slate-500 mt-3 text-center">Нажмите на стержень, чтобы взять верхний диск, затем на другой — чтобы положить.</p>`;
 function draw(){$("hp").innerHTML=pegs.map((p,i)=>`<div data-p="${i}" class="peg ${sel===i?"sel":""}">${p.map(d=>`<div class="disk" style="width:${30+d*(60/n)}%;background:${colors[d-1]}"></div>`).join("")}</div>`).join("");
  $("hp").querySelectorAll(".peg").forEach(el=>el.onclick=()=>click(+el.dataset.p))}
 function click(i){
  if(sel===null){if(pegs[i].length){sel=i;draw()}return}
  if(sel===i){sel=null;draw();return}
  const d=pegs[sel][pegs[sel].length-1],top=pegs[i][pegs[i].length-1];
  if(top&&top<d){const el=$("hp").children[i];el.classList.add("shake");setTimeout(()=>el.classList.remove("shake"),400);return}
  pegs[i].push(pegs[sel].pop());sel=null;moves++;$("hMoves").textContent=`ходов: ${moves} · оптимум ${opt}`;draw();
  if(pegs[2].length===n)api.finish({won:true,perf:clamp(opt/moves,.3,1),summary:`Башня перенесена за ${moves} ходов (оптимум ${opt})`,flags:{hanoiOptimal:moves===opt}});
 }
 draw();
};

/* --- 6. Саймон --- */
ENGINES.simon=(area,api)=>{
 const target={easy:6,normal:8,hard:10}[api.d.k],speed={easy:650,normal:480,hard:340}[api.d.k];
 const cols=["#ef4444","#22c55e","#3b82f6","#eab308"];let seq=[],pos=0,busy=true,timers=[];
 api.onQuit(()=>timers.forEach(clearTimeout));
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span id="sInfo">Смотрите…</span><span id="sRound">раунд 1 / ${target}</span></div><div class="grid grid-cols-2 gap-3 max-w-xs mx-auto">${cols.map((c,i)=>`<div data-i="${i}" class="pad" style="background:${c};color:${c}"></div>`).join("")}</div>`;
 const pads=[...area.querySelectorAll(".pad")];
 const lit=(i,ms)=>{pads[i].classList.add("lit");timers.push(setTimeout(()=>pads[i].classList.remove("lit"),ms))};
 function play(){busy=true;pos=0;seq.push(rnd(4));$("sInfo").textContent="Смотрите…";$("sRound").textContent=`раунд ${seq.length} / ${target}`;
  seq.forEach((v,k)=>timers.push(setTimeout(()=>lit(v,speed*.6),600+k*speed)));
  timers.push(setTimeout(()=>{busy=false;$("sInfo").textContent="Ваш ход — повторите"},600+seq.length*speed))}
 pads.forEach(p=>p.onclick=()=>{
  if(busy)return;const i=+p.dataset.i;lit(i,220);
  if(i!==seq[pos]){busy=true;const got=seq.length-1;api.finish({won:got>=Math.ceil(target/2),perf:got/target,summary:`Повторено ${got} из ${target}`,flags:{simonMax:got}});return}
  pos++;if(pos===seq.length){busy=true;if(seq.length>=target){api.finish({won:true,perf:1,summary:`Вся последовательность из ${target} повторена!`,flags:{simonMax:target}});return}timers.push(setTimeout(play,700))}
 });
 timers.push(setTimeout(play,500));
};

/* --- 7. Матспринт --- */
ENGINES.math=(area,api)=>{
 const k=api.d.k,target={easy:10,normal:14,hard:18}[k];let left=60,correct=0,wrong=0,cur,tid;
 api.onQuit(()=>clearInterval(tid));
 function gen(){let a,b,op;
  if(k==="easy"){op=["+","-"][rnd(2)];a=rnd(30)+1;b=rnd(30)+1;if(op==="-"&&b>a)[a,b]=[b,a]}
  else if(k==="normal"){op=["+","-","×"][rnd(3)];if(op==="×"){a=rnd(11)+2;b=rnd(11)+2}else{a=rnd(80)+10;b=rnd(80)+10;if(op==="-"&&b>a)[a,b]=[b,a]}}
  else{op=["+","-","×","÷"][rnd(4)];if(op==="×"){a=rnd(18)+3;b=rnd(12)+3}else if(op==="÷"){b=rnd(11)+2;a=b*(rnd(12)+2)}else{a=rnd(400)+50;b=rnd(400)+50;if(op==="-"&&b>a)[a,b]=[b,a]}}
  const r={"+":a+b,"-":a-b,"×":a*b,"÷":a/b}[op];cur={txt:`${a} ${op} ${b}`,r};$("mq").textContent=cur.txt+" = ?";$("mi").value="";$("mi").focus()}
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-2"><span>Цель: ${target} верных</span><span id="mt">60с</span></div><div class="bar mb-6"><div id="mb" style="width:100%"></div></div>
  <div id="mq" class="text-4xl font-bold display text-center mb-5 code-font"></div>
  <div class="flex gap-2 max-w-sm mx-auto"><input id="mi" type="number" class="inp text-center text-xl" placeholder="ответ"><button id="mgo" class="btn btn-primary px-5 rounded-xl font-semibold">OK</button></div>
  <div class="flex justify-center gap-6 mt-4 text-sm"><span class="text-emerald-300">верно: <b id="mc">0</b></span><span class="text-rose-300">ошибок: <b id="mw">0</b></span></div>`;
 const go=()=>{const v=$("mi").value.trim();if(v==="")return;if(+v===cur.r){correct++;$("mc").textContent=correct}else{wrong++;$("mw").textContent=wrong;$("mi").classList.add("shake");setTimeout(()=>$("mi").classList.remove("shake"),400)}gen()};
 $("mgo").onclick=go;$("mi").onkeydown=e=>{if(e.key==="Enter")go()};
 tid=setInterval(()=>{left--;$("mt").textContent=left+"с";$("mb").style.width=(left/60*100)+"%";if(left<=0){clearInterval(tid);api.finish({won:correct>=target,perf:clamp((correct-wrong*.5)/target,0,1),summary:`Верно ${correct}, ошибок ${wrong}`,flags:{mathBest:correct}})}},1000);
 gen();
};

/* --- 8. Погаси свет --- */
ENGINES.lights=(area,api)=>{
 const n={easy:3,normal:4,hard:5}[api.d.k],scr={easy:4,normal:7,hard:11}[api.d.k];
 let b=Array(n*n).fill(false),moves=0;
 const tog=i=>{const r=Math.floor(i/n),c=i%n;[[r,c],[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([y,x])=>{if(y>=0&&y<n&&x>=0&&x<n)b[y*n+x]=!b[y*n+x]})};
 const picks=shuffle([...Array(n*n).keys()]).slice(0,scr);picks.forEach(tog);if(!b.some(Boolean))tog(0);
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span>Выключите все лампы</span><span id="lMoves">ходов: 0 · решается за ${scr}</span></div><div id="lg" class="grid gap-2 max-w-xs mx-auto" style="grid-template-columns:repeat(${n},1fr)"></div>`;
 function draw(){$("lg").innerHTML=b.map((v,i)=>`<div data-i="${i}" class="light ${v?"on":""}"></div>`).join("");$("lg").querySelectorAll(".light").forEach(el=>el.onclick=()=>{tog(+el.dataset.i);moves++;$("lMoves").textContent=`ходов: ${moves} · решается за ${scr}`;draw();if(!b.some(Boolean))api.finish({won:true,perf:clamp(scr/moves,.3,1),summary:`Поле погашено за ${moves} ходов`})})}
 draw();
};

/* --- 9. Двоичный код --- */
ENGINES.binary=(area,api)=>{
 const bits={easy:4,normal:6,hard:8}[api.d.k],time={easy:25,normal:20,hard:15}[api.d.k],rounds=5;
 let round=0,correct=0,state,target,left,tid;api.onQuit(()=>clearInterval(tid));
 function next(){
  if(round===rounds){api.finish({won:correct>=3,perf:correct/rounds,summary:`Верно ${correct} из ${rounds}`});return}
  state=Array(bits).fill(0);target=rnd(2**bits-1)+1;left=time;
  area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-2"><span>Раунд ${round+1} / ${rounds} · верно ${correct}</span><span id="bt">${time}с</span></div><div class="bar mb-6"><div id="bb" style="width:100%"></div></div>
   <div class="text-center mb-2 text-slate-400 text-sm">Соберите число</div><div class="text-5xl font-bold display text-center mb-5 grad-text">${target}</div>
   <div class="flex justify-center gap-2 flex-wrap mb-3">${state.map((_,i)=>`<button data-i="${i}" class="bit code-font">0</button>`).join("")}</div>
   <div class="flex justify-center gap-2 flex-wrap mb-4 text-xs text-slate-500 code-font">${state.map((_,i)=>`<span style="width:52px;text-align:center">${2**(bits-1-i)}</span>`).join("")}</div>
   <div class="text-center text-sm text-slate-400 mb-4">Сейчас: <b id="bv" class="text-white">0</b></div>
   <div class="text-center"><button id="bgo" class="btn btn-primary px-6 py-2.5 rounded-xl font-semibold">Проверить</button></div><div id="bfb" class="text-center mt-3 text-sm"></div>`;
  const val=()=>state.reduce((s,v,i)=>s+v*2**(bits-1-i),0);
  area.querySelectorAll(".bit").forEach(el=>el.onclick=()=>{const i=+el.dataset.i;state[i]^=1;el.textContent=state[i];el.classList.toggle("on",!!state[i]);$("bv").textContent=val()});
  const done=ok=>{clearInterval(tid);area.querySelectorAll("button").forEach(x=>x.disabled=true);if(ok)correct++;round++;$("bfb").innerHTML=ok?`<div class="text-emerald-300">✅ Верно!</div>`:`<div class="text-rose-300 font-semibold">❌ Правильный ответ: ${target} = ${target.toString(2).padStart(bits,"0")}</div><div class="text-slate-300 mt-2">В двоичном коде каждая позиция — степень двойки (${Array.from({length:bits},(_,i)=>2**(bits-1-i)).join(" + ")}). Сложите значения тех разрядов, где стоит 1, чтобы получить ${target}.</div><button id="binNext" class="btn btn-primary px-5 py-2 rounded-xl font-semibold mt-3">Далее →</button>`;if(ok)setTimeout(next,850);else $("binNext").onclick=next};
  $("bgo").onclick=()=>done(val()===target);
  tid=setInterval(()=>{left--;const b=$("bb");if(!b)return clearInterval(tid);b.style.width=(left/time*100)+"%";$("bt").textContent=left+"с";if(left<=0)done(false)},1000);
 }
 next();
};

/* --- 10. Кодовый замок (быки и коровы) --- */
ENGINES.bulls=(area,api)=>{
 const len={easy:3,normal:4,hard:4}[api.d.k],max={easy:12,normal:10,hard:7}[api.d.k];
 const code=shuffle([0,1,2,3,4,5,6,7,8,9]).slice(0,len).join("");let tries=0;
 area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-3"><span>Код из ${len} разных цифр</span><span id="cTry">попыток: 0 / ${max}</span></div>
  <div class="flex gap-2 max-w-sm mx-auto mb-4"><input id="ci" class="inp text-center text-xl code-font tracking-widest" maxlength="${len}" placeholder="${"?".repeat(len)}" inputmode="numeric" autocomplete="off"><button id="cgo" class="btn btn-primary px-5 rounded-xl font-semibold">Проверить</button></div>
  <p id="cErr" class="text-center text-xs text-rose-300 h-4 mb-2"></p>
  <div id="cLog" class="space-y-1.5 max-w-sm mx-auto"></div>`;
 const go=()=>{
  const v=$("ci").value.trim();$("cErr").textContent="";
  if(!/^\d+$/.test(v)||v.length!==len){$("cErr").textContent=`Введите ${len} цифр`;return}
  if(new Set(v).size!==len){$("cErr").textContent="Цифры не должны повторяться";return}
  tries++;$("cTry").textContent=`попыток: ${tries} / ${max}`;
  let bulls=0,cows=0;[...v].forEach((c,i)=>{if(code[i]===c)bulls++;else if(code.includes(c))cows++});
  $("cLog").insertAdjacentHTML("afterbegin",`<div class="glass rounded-xl px-4 py-2 flex justify-between text-sm pop"><span class="code-font tracking-widest font-bold">${v}</span><span>🐂 ${bulls} &nbsp; 🐄 ${cows}</span></div>`);
  $("ci").value="";$("ci").focus();
  if(bulls===len)api.finish({won:true,perf:clamp(1-(tries-1)*.08,.35,1),summary:`Код ${code} взломан за ${tries} попыток`,flags:{bullsFast:tries<=4}});
  else if(tries>=max)api.finish({won:false,perf:.15,summary:`Попытки закончились. Код был ${code}`});
 };
 $("cgo").onclick=go;$("ci").onkeydown=e=>{if(e.key==="Enter")go()};$("ci").focus();
};


/* --- 11. Код аналитика --- */
ENGINES.oddone=(area,api)=>{
 // Вопросы с корректными вариантами и ответами, выбранные в случайном порядке.
 const tasks=[
  {q:"Продолжите последовательность",seq:"2 · 5 · 10 · 17 · 26 · ?",a:["35","37","38","39"],correct:1,why:"Разницы: +3, +5, +7, +9, затем +11. Ответ — 37."},
  {q:"Найдите пропущенное число",seq:"3 · 6 · 12 · 24 · ?",a:["36","42","48","54"],correct:2,why:"Каждое число умножается на 2. Ответ — 48."},
  {q:"Какое число должно быть следующим?",seq:"1 · 4 · 9 · 16 · 25 · ?",a:["30","35","36","49"],correct:2,why:"Это квадраты натуральных чисел: 1², 2², 3²… следующий — 6² = 36."},
  {q:"Определите закономерность",seq:"2 · 6 · 12 · 20 · 30 · ?",a:["40","42","44","48"],correct:1,why:"Числа получаются умножением n×(n+1). Следующее: 6×7 = 42."},
  {q:"Что идёт дальше?",seq:"A · C · F · J · O · ?",a:["T","U","V","W"],correct:1,why:"Шаги по алфавиту: +2, +3, +4, +5, затем +6. Ответ — U."},
  {q:"Найдите следующий элемент",seq:"81 · 27 · 9 · 3 · ?",a:["0","1","2","-3"],correct:1,why:"Каждый раз делим на 3. Ответ — 1."},
  {q:"Продолжите ряд",seq:"5 · 10 · 8 · 16 · 14 · 28 · ?",a:["24","26","30","56"],correct:1,why:"Правило чередуется: ×2, −2, ×2, −2. После 28 вычитаем 2 — 26."},
  {q:"Какое число скрыто правилом?",seq:"1 · 1 · 2 · 3 · 5 · 8 · ?",a:["11","12","13","15"],correct:2,why:"Каждое число — сумма двух предыдущих. 5 + 8 = 13."}
 ];
 const chosen=shuffle(tasks).slice(0,6);let i=0,correct=0,locked=false;
 function step(){locked=false;if(i>=chosen.length){api.finish({won:correct>=4,perf:correct/chosen.length,summary:`Код аналитика: верно ${correct} из ${chosen.length} задач`});return}
  const r=chosen[i];api.status(`Аналитика ${i+1}/${chosen.length}`);
  area.innerHTML=`<div class="flex justify-between text-sm text-slate-400 mb-4"><span>Задача ${i+1} из ${chosen.length}</span><span>Решено: <b>${correct}</b></span></div><div class="rounded-2xl p-5 mb-5 text-center border border-violet-400/25 bg-violet-500/10"><div class="text-xs uppercase tracking-[.22em] text-violet-200 mb-3">АНАЛИТИЧЕСКИЙ МОДУЛЬ</div><div class="text-2xl sm:text-3xl font-bold tracking-wide code-font">${r.seq}</div></div><h3 class="text-lg font-bold text-center mb-4">${r.q}</h3><div class="grid grid-cols-2 gap-3 max-w-xl mx-auto">${r.a.map((a,j)=>`<button data-odd="${j}" class="glass rounded-2xl p-4 text-xl font-bold hover:scale-[1.02] transition">${a}</button>`).join("")}</div><p id="oddFb" class="text-center mt-4 text-sm min-h-8"></p>`;
  area.querySelectorAll('[data-odd]').forEach(b=>b.onclick=()=>{if(locked)return;locked=true;const ok=+b.dataset.odd===r.correct;if(ok)correct++;area.querySelectorAll('[data-odd]').forEach(x=>{x.disabled=true;if(+x.dataset.odd===r.correct)x.classList.add('border-emerald-400','bg-emerald-500/15')});$('oddFb').innerHTML=`<div class="${ok?'text-emerald-300':'text-rose-300'} font-semibold">${ok?'✓ Закономерность найдена.':'✕ Ответ неверный.'}</div>${!ok?`<div class="text-emerald-300 mt-2">Правильный ответ: ${r.a[r.correct]}</div>`:""}<div class="text-slate-300 mt-2">${r.why}</div>${!ok?'<button id="oddNext" class="btn btn-primary px-5 py-2 rounded-xl font-semibold mt-3">Далее →</button>':""}`;const advance=()=>{i++;step()};if(!ok)$("oddNext").onclick=advance;else setTimeout(advance,850)});
 }
 step();
};

/* --- 12. Минное поле --- */
ENGINES.mines=(area,api)=>{
 const n=5,minesCount={easy:4,normal:5,hard:7}[api.d.k];let board=[],opened=new Set(),marked=new Set(),over=false;
 function create(){board=Array(n*n).fill(0);let picks=shuffle([...Array(n*n).keys()]).slice(0,minesCount);picks.forEach(i=>board[i]=-1);for(let i=0;i<board.length;i++){if(board[i]===-1)continue;let r=Math.floor(i/n),c=i%n,count=0;for(let y=r-1;y<=r+1;y++)for(let x=c-1;x<=c+1;x++)if(y>=0&&y<n&&x>=0&&x<n&&board[y*n+x]===-1)count++;board[i]=count}}
 create();
 area.innerHTML=`<div class="flex flex-wrap justify-between gap-2 text-sm text-slate-400 mb-3"><span>💣 Мин: ${minesCount}</span><span id="mineInfo">Открыто: 0 / ${n*n-minesCount}</span></div><div class="text-xs text-slate-500 text-center mb-3">Левый клик — открыть · правый клик — поставить/снять флажок</div><div id="mineGrid" class="grid gap-1.5 max-w-sm mx-auto" style="grid-template-columns:repeat(${n},minmax(0,1fr))"></div><div id="mineMsg" class="text-center mt-3 text-sm text-slate-400">Откройте все безопасные клетки.</div>`;
 const grid=$('mineGrid');
 function reveal(i){if(over||opened.has(i)||marked.has(i))return;opened.add(i);if(board[i]===-1){over=true;draw(true);const blast=document.createElement('div');blast.className='mine-blast-overlay';blast.innerHTML='<div class="mine-blast-flash"></div><div class="mine-blast-core"><div class="mine-blast-ring"></div><div class="mine-blast-emoji">💥</div><div class="mine-blast-title">БА-БАХ!</div><div class="mine-blast-sub">Вы задели мину</div></div>';document.body.appendChild(blast);const msg=$('mineMsg');if(msg)msg.textContent='💥 Мина сработала! Поле раскрыто.';setTimeout(()=>{blast.classList.add('mine-blast-fade');setTimeout(()=>blast.remove(),450);api.finish({won:false,perf:0.1,summary:'Вы задели мину. Попробуйте ещё раз.'})},1450);return}if(board[i]===0){const r=Math.floor(i/n),c=i%n;for(let y=r-1;y<=r+1;y++)for(let x=c-1;x<=c+1;x++)if(y>=0&&y<n&&x>=0&&x<n&&!opened.has(y*n+x)&&board[y*n+x]!==-1)opened.add(y*n+x)}draw();if(opened.size===n*n-minesCount)api.finish({won:true,perf:clamp(1-marked.size*.04,.65,1),summary:`Поле очищено! Открыто ${opened.size} безопасных клеток`})}
 function draw(showMines=false){grid.innerHTML=board.map((v,i)=>{const o=opened.has(i),m=marked.has(i),mine=v===-1;let content=m?'🚩':o?(mine?'💣':v||'·'):(showMines&&mine?'💣':'?');return `<button data-mine="${i}" class="rounded-xl aspect-square font-bold text-lg transition ${o?(mine?'bg-rose-600/70':'bg-slate-700/80'):(m?'bg-amber-500/30 border border-amber-300/40':'bg-slate-800/90 border border-slate-600/60 hover:bg-sky-500/30')} ${o&&v>0?'text-sky-200':''}" ${o||over?'disabled':''}>${content}</button>`}).join('');$('mineInfo').textContent=`Открыто: ${opened.size} / ${n*n-minesCount}`;grid.querySelectorAll('[data-mine]').forEach(b=>{const i=+b.dataset.mine;b.onclick=()=>reveal(i);b.oncontextmenu=e=>{e.preventDefault();if(over||opened.has(i))return;if(marked.has(i))marked.delete(i);else if(marked.size<minesCount)marked.add(i);draw()}})}
 draw();
};

/* ================= ЛЕСТНИЦА МАСТЕРСТВА: ДВИЖКИ (уровни 1–10) ================= */
const LEVEL_ENGINES={};
const lerp=(a,b,l)=>a+(b-a)*(l-1)/(MAX_LEVEL-1);

/* --- L1. Цепочка вычислений --- */
LEVEL_ENGINES.lv_chain=(area,api,L)=>{
 const steps=Math.round(lerp(2,8,L)),gap=Math.round(lerp(1500,800,L)),rounds=3,maxN=Math.round(lerp(10,40,L));
 let round=0,correct=0,timers=[],cur;
 api.onQuit(()=>timers.forEach(clearTimeout));
 function build(){
  let v=rnd(maxN)+5;const ops=[];const start=v;
  for(let i=0;i<steps;i++){
   const kinds=L>=4?["+","-","×"]:["+","-"];if(L>=7)kinds.push("÷");
   let op=kinds[rnd(kinds.length)],n;
   if(op==="×"){n=rnd(L>=8?5:3)+2;v*=n}
   else if(op==="÷"){const ds=[2,3,4,5].filter(d=>v%d===0&&v/d>0);if(!ds.length){op="+";n=rnd(maxN)+1;v+=n}else{n=ds[rnd(ds.length)];v/=n}}
   else if(op==="-"){n=rnd(Math.min(maxN,Math.max(1,v-1)))+1;if(n>=v)n=Math.max(1,v-1);v-=n}
   else{n=rnd(maxN)+1;v+=n}
   ops.push(op+" "+n);
  }
  return {start,ops,ans:v};
 }
 function step(){
  cur=build();let i=-1;
  api.status(`Цепочка ${round+1}/${rounds}`);
  area.innerHTML=`<div class="flex justify-between text-xs text-slate-400 mb-3"><span>Цепочка ${round+1} из ${rounds} · ${steps} действий</span><span>верно: ${correct}</span></div>
   <div id="chBox" class="text-5xl font-bold display text-center code-font my-10 grad-text pop">${cur.start}</div>
   <div id="chIn" class="hidden max-w-sm mx-auto"><div class="text-center text-sm text-slate-400 mb-2">Введите результат</div><div class="flex gap-2"><input id="chi" type="number" class="inp text-center text-xl" placeholder="?"><button id="chgo" class="btn btn-primary px-5 rounded-xl font-semibold">OK</button></div></div>
   <div id="chFb" class="text-center mt-3 text-sm"></div>`;
  const tick=()=>{i++;const b=$("chBox");if(!b)return;
   if(i<cur.ops.length){b.textContent=cur.ops[i];b.classList.remove("pop");void b.offsetWidth;b.classList.add("pop");timers.push(setTimeout(tick,gap))}
   else{b.textContent="= ?";$("chIn").classList.remove("hidden");$("chi").focus();
    const go=()=>{const v=$("chi").value.trim();if(v==="")return;const ok=+v===cur.ans;if(ok)correct++;
     $("chgo").disabled=true;$("chi").disabled=true;
     $("chFb").innerHTML=ok?`<span class="text-emerald-300">✅ Верно!</span>`:`<div class="text-rose-300 font-semibold">❌ Правильный результат: ${cur.ans}</div><div class="text-slate-300 mt-2">${cur.start} ${cur.ops.join(" ")} = ${cur.ans}. Выполняйте действия по порядку, последовательно применяя каждое действие к текущему числу.</div><button id="chNext" class="btn btn-primary px-5 py-2 rounded-xl font-semibold mt-3">Далее →</button>`;
     round++;const advance=()=>round<rounds?step():api.finish({won:correct>=2,perf:correct/rounds,summary:`Верно ${correct} из ${rounds} цепочек`});if(!ok)$("chNext").onclick=advance;else timers.push(setTimeout(advance,850))};
    $("chgo").onclick=go;$("chi").onkeydown=e=>{if(e.key==="Enter")go()}}};
  timers.push(setTimeout(tick,gap));
 }
 step();
};

/* --- L2. Схема памяти --- */
LEVEL_ENGINES.lv_grid=(area,api,L)=>{
 const n=[3,3,3,4,4,4,5,5,5,6][L-1],cnt=L+2,showMs=Math.round(lerp(2600,1500,L)),rounds=3;
 let round=0,score=0,timers=[];
 api.onQuit(()=>timers.forEach(clearTimeout));
 function step(){
  const pat=new Set(shuffle([...Array(n*n).keys()]).slice(0,cnt));let picks=new Set(),open=false;
  api.status(`Узор ${round+1}/${rounds}`);
  area.innerHTML=`<div class="flex justify-between text-xs text-slate-400 mb-3"><span>Узор ${round+1} из ${rounds} · ${cnt} клеток</span><span id="gInfo">Запоминайте…</span></div>
   <div id="gg" class="grid gap-1.5 max-w-xs mx-auto mb-4" style="grid-template-columns:repeat(${n},1fr)">${[...Array(n*n).keys()].map(i=>`<div data-i="${i}" class="gcell ${pat.has(i)?"lit":""}"></div>`).join("")}</div>
   <div class="text-center"><button id="ggo" class="btn btn-primary px-6 py-2.5 rounded-xl font-semibold" disabled>Проверить (<span id="gc">0</span>/${cnt})</button></div>`;
  const cells=[...$("gg").children];
  timers.push(setTimeout(()=>{cells.forEach(c=>c.classList.remove("lit"));open=true;$("gInfo").textContent="Отметьте клетки";$("ggo").disabled=false},showMs));
  cells.forEach(c=>c.onclick=()=>{if(!open)return;const i=+c.dataset.i;if(picks.has(i)){picks.delete(i);c.classList.remove("pick")}else if(picks.size<cnt){picks.add(i);c.classList.add("pick")}$("gc").textContent=picks.size});
  $("ggo").onclick=()=>{if(!open)return;open=false;$("ggo").disabled=true;let hit=0;
   cells.forEach(c=>{const i=+c.dataset.i;c.classList.remove("pick");if(pat.has(i)&&picks.has(i)){hit++;c.classList.add("hit")}else if(pat.has(i))c.classList.add("lit");else if(picks.has(i))c.classList.add("miss")});
   score+=hit/cnt;$("gInfo").textContent=`совпало ${hit} из ${cnt}`;round++;
   timers.push(setTimeout(()=>round<rounds?step():api.finish({won:score/rounds>=.67,perf:score/rounds,summary:`Точность узоров ${Math.round(score/rounds*100)}%`}),1400))};
 }
 step();
};

/* --- L3. Числовые ряды --- */
LEVEL_ENGINES.lv_seq=(area,api,L)=>{
 const rounds=4,time=Math.round(lerp(45,20,L));
 const gens=[
  ()=>{const a=rnd(20)+1,d=rnd(9)+2;return {s:[0,1,2,3,4].map(i=>a+d*i),r:"арифметическая прогрессия, шаг +"+d}},
  ()=>{const a=rnd(60)+40,d=rnd(9)+3;return {s:[0,1,2,3,4].map(i=>a-d*i),r:"убывающая прогрессия, шаг −"+d}},
  ()=>{const a=rnd(4)+1,q=[2,3][rnd(2)];return {s:[0,1,2,3,4].map(i=>a*q**i),r:"геометрическая прогрессия, ×"+q}},
  ()=>{const k=rnd(4)+1;return {s:[0,1,2,3,4].map(i=>(i+k)**2),r:"квадраты чисел"}},
  ()=>{let a=rnd(4)+1,b=rnd(5)+2;const s=[a,b];for(let i=0;i<3;i++)s.push(s[i]+s[i+1]);return {s,r:"каждое число — сумма двух предыдущих"}},
  ()=>{const a=rnd(10)+1,p=rnd(5)+2,m=2;let v=a;const s=[v];for(let i=0;i<4;i++){v=i%2===0?v+p:v*m;s.push(v)}return {s,r:`чередуются +${p} и ×${m}`}},
  ()=>{const a=rnd(10)+1,d=rnd(3)+1;let v=a;const s=[v];for(let i=1;i<5;i++){v+=d*i;s.push(v)}return {s,r:"разности растут: +"+[1,2,3,4].map(i=>d*i).join(", +")}},
  ()=>{const k=rnd(3)+1;return {s:[0,1,2,3,4].map(i=>(i+k)**3),r:"кубы чисел"}},
  ()=>{const a=rnd(9)+2,d=rnd(4)+1;return {s:[0,1,2,3,4].map(i=>(a+d*i)*(a+d*i)-i),r:"квадрат прогрессии минус номер"}},
  ()=>{const p=[2,3,5,7,11,13,17,19,23,29,31];const k=rnd(4);return {s:p.slice(k,k+5),r:"простые числа"}}
 ];
 const pool=gens.slice(0,Math.min(gens.length,Math.max(2,L+1)));
 let i=0,correct=0,tid,left;api.onQuit(()=>clearInterval(tid));
 function step(){
  const g=pool[Math.min(pool.length-1,Math.max(0,pool.length-1-rnd(Math.min(pool.length,3))))]();const ans=g.s[4],shown=g.s.slice(0,4);left=time;
  api.status(`Ряд ${i+1}/${rounds}`);
  area.innerHTML=`<div class="flex justify-between text-xs text-slate-400 mb-2"><span>Ряд ${i+1} из ${rounds} · верно ${correct}</span><span id="qt">${time}с</span></div><div class="bar mb-6"><div id="qb" style="width:100%"></div></div>
   <div class="text-3xl md:text-4xl font-bold display text-center code-font mb-6 flex flex-wrap justify-center gap-3">${shown.map(v=>`<span class="glass rounded-xl px-4 py-2">${v}</span>`).join("")}<span class="glass rounded-xl px-4 py-2 text-cyan-300">?</span></div>
   <div class="flex gap-2 max-w-sm mx-auto"><input id="sqi" type="number" class="inp text-center text-xl" placeholder="следующее число"><button id="sqgo" class="btn btn-primary px-5 rounded-xl font-semibold">OK</button></div>
   <div id="sqfb" class="text-center mt-3 text-sm"></div>`;
  $("sqi").focus();
  const done=ok=>{clearInterval(tid);$("sqi").disabled=true;$("sqgo").disabled=true;if(ok)correct++;
   $("sqfb").innerHTML=ok?`<span class="text-emerald-300">✅ Верно!</span> <span class="text-slate-400">— ${g.r}</span>`:`<div class="text-rose-300 font-semibold">❌ Правильный ответ: ${ans}</div><div class="text-slate-300 mt-2">Правило: ${g.r}. Сравните разности или отношение соседних чисел, чтобы увидеть закономерность.</div><button id="sqNext" class="btn btn-primary px-5 py-2 rounded-xl font-semibold mt-3">Далее →</button>`;
   i++;const advance=()=>i<rounds?step():api.finish({won:correct>=Math.ceil(rounds/2),perf:correct/rounds,summary:`Продолжено ${correct} из ${rounds} рядов`});if(!ok)$("sqNext").onclick=advance;else setTimeout(advance,850)};
  const go=()=>{const v=$("sqi").value.trim();if(v==="")return;done(+v===ans)};
  $("sqgo").onclick=go;$("sqi").onkeydown=e=>{if(e.key==="Enter")go()};
  tid=setInterval(()=>{left--;const b=$("qb");if(!b)return clearInterval(tid);b.style.width=(left/time*100)+"%";$("qt").textContent=left+"с";if(left<=0)done(false)},1000);
 }
 step();
};

/* --- L4. Цвет против слова (Струп) --- */
LEVEL_ENGINES.lv_stroop=(area,api,L)=>{
 const COLORS=[["КРАСНЫЙ","#ef4444"],["ЗЕЛЁНЫЙ","#22c55e"],["СИНИЙ","#3b82f6"],["ЖЁЛТЫЙ","#eab308"],["РОЗОВЫЙ","#ec4899"],["ГОЛУБОЙ","#22d3ee"]];
 const k=L<=3?4:L<=7?5:6,pal=COLORS.slice(0,k),rounds=8+L,ms=Math.round(lerp(3000,1200,L));
 let i=0,correct=0,tid,t0;api.onQuit(()=>clearInterval(tid));
 area.innerHTML=`<div class="flex justify-between text-xs text-slate-400 mb-2"><span id="stInfo"></span><span>нажимайте ЦВЕТ букв</span></div><div class="bar mb-6"><div id="stb" style="width:100%"></div></div>
  <div id="stw" class="text-5xl md:text-6xl font-bold display text-center my-8"></div>
  <div id="stp" class="grid gap-2 max-w-md mx-auto" style="grid-template-columns:repeat(${k<=4?2:3},1fr)">${pal.map((c,idx)=>`<button data-i="${idx}" class="swatch">${c[0]}</button>`).join("")}</div>`;
 const btns=[...area.querySelectorAll(".swatch")];let cur;
 function step(){
  if(i>=rounds){clearInterval(tid);api.finish({won:correct/rounds>=.7,perf:correct/rounds,summary:`Верно ${correct} из ${rounds}`});return}
  const word=rnd(k);let ink=rnd(k);if(L>=2&&ink===word)ink=(ink+1+rnd(k-1))%k;cur=ink;
  $("stInfo").textContent=`раунд ${i+1} / ${rounds} · верно ${correct}`;
  const w=$("stw");w.textContent=pal[word][0];w.style.color=pal[ink][1];w.classList.remove("pop");void w.offsetWidth;w.classList.add("pop");
  if(L>=5)btns.forEach((b,idx)=>{b.style.color=pal[(idx+1)%k][1]});
  t0=Date.now();clearInterval(tid);tid=setInterval(()=>{const p=1-(Date.now()-t0)/ms;const b=$("stb");if(!b)return clearInterval(tid);b.style.width=Math.max(0,p*100)+"%";if(p<=0){i++;step()}},50);
 }
 btns.forEach(b=>b.onclick=()=>{if(+b.dataset.i===cur)correct++;i++;step()});
 step();
};

/* ================= ИНИЦИАЛИЗАЦИЯ ================= */
(async function init(){
 setMode("reg");
 const all=await cloudFetchAll();
 const key=DB.current();
 if(key&&all[key]){user={...blank(all[key].name,all[key].pass,all[key].email||""),...all[key]};enterApp()}
})();


/* --- Спокойная процедурная фоновая музыка LogicGames ---
   Запускается только после нажатия пользователя (ограничение браузера).
   Не требует аудиофайлов или интернета. */
(function setupAmbientMusic(){
 const button=document.getElementById('musicToggle');
 if(!button)return;
 let ctx=null, master=null, running=false, timer=null, noteIndex=0;
 const notes=[220.00,261.63,329.63,392.00,329.63,261.63,196.00,246.94,293.66,369.99,293.66,246.94];
 function playNote(){
   if(!running||!ctx||ctx.state!=='running')return;
   const now=ctx.currentTime, freq=notes[noteIndex%notes.length]; noteIndex++;
   const osc=ctx.createOscillator(), gain=ctx.createGain(), filter=ctx.createBiquadFilter();
   osc.type='sine'; osc.frequency.setValueAtTime(freq,now);
   filter.type='lowpass'; filter.frequency.setValueAtTime(900,now);
   gain.gain.setValueAtTime(0.0001,now); gain.gain.exponentialRampToValueAtTime(0.045,now+0.45); gain.gain.exponentialRampToValueAtTime(0.0001,now+2.7);
   osc.connect(filter); filter.connect(gain); gain.connect(master); osc.start(now); osc.stop(now+2.8);
   // Тихая гармония добавляет мягкий игровой фон, без резких ударов.
   if(noteIndex%3===0){const pad=ctx.createOscillator(), pg=ctx.createGain();pad.type='triangle';pad.frequency.setValueAtTime(freq/2,now);pg.gain.setValueAtTime(0.0001,now);pg.gain.exponentialRampToValueAtTime(0.012,now+0.8);pg.gain.exponentialRampToValueAtTime(0.0001,now+3.8);pad.connect(pg);pg.connect(master);pad.start(now);pad.stop(now+3.9)}
 }
 async function start(){
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC){button.textContent='♫ Музыка недоступна';return}
   if(!ctx){ctx=new AC();master=ctx.createGain();master.gain.value=0.8;master.connect(ctx.destination)}
   await ctx.resume();running=true;button.textContent='♫ Музыка: вкл.';button.setAttribute('aria-label','Выключить музыку');
   if(timer)clearInterval(timer);playNote();timer=setInterval(playNote,1250);
 }
 function stop(){running=false;if(timer){clearInterval(timer);timer=null}if(master&&ctx){master.gain.setTargetAtTime(0,ctx.currentTime,0.12)}button.textContent='♫ Музыка: выкл.';button.setAttribute('aria-label','Включить музыку');}
 button.addEventListener('click',async()=>{if(running){stop()}else{if(master&&ctx)master.gain.setTargetAtTime(0.8,ctx.currentTime,0.12);await start()}});
})();
