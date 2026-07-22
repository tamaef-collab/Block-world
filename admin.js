const adminConfig = window.BLOCKWORLD_SUPABASE || {};
const client = adminConfig.url && adminConfig.anonKey && window.supabase
  ? window.supabase.createClient(adminConfig.url, adminConfig.anonKey)
  : null;

const els = Object.fromEntries([
  "connectionStatus","playerCount","coinTotal","worldCount","playerSearch","playerList","pageMessage",
  "logoutButton","editDialog","editForm","editUserId","editDisplayName","editRole","editHealth","healthOutput",
  "editEnergy","energyOutput","editLevel","editExperience","editCoins","editPeru","dialogPlayerName","dialogMessage"
].map(id => [id, document.getElementById(id)]));
const template = document.getElementById("playerTemplate");
let players = [];
const localPreview = (["localhost", "127.0.0.1"].includes(location.hostname) || location.protocol === "file:") && new URLSearchParams(location.search).has("preview");

function setConnection(text, error=false){els.connectionStatus.lastChild.textContent=` ${text}`;els.connectionStatus.classList.toggle("error",error)}
function formatNumber(value){return new Intl.NumberFormat("de-DE").format(Number(value)||0)}
function hearts(value){return Array.from({length:5},(_,i)=>`<span class="heart ${i < value/20 ? "" : "empty"}">❤</span>`).join("")}
function energySegments(value){return Array.from({length:5},(_,i)=>`<i class="${i < value/20 ? "on" : ""}"></i>`).join("")}

async function guardAdmin(){
  if(!client) throw new Error("Supabase ist nicht konfiguriert.");
  const {data:{session}}=await client.auth.getSession();
  if(!session){location.replace("index.html");return false}
  const {data,error}=await client.from("profiles").select("role").eq("id",session.user.id).single();
  if(error||data?.role!=="admin"){await client.auth.signOut();location.replace("index.html");return false}
  return true;
}

async function loadPlayers(){
  els.pageMessage.textContent="";
  const {data:profiles,error:pError}=await client.from("profiles").select("id,username,display_name,role,created_at").order("created_at");
  if(pError) throw pError;
  const ids=profiles.map(p=>p.id);
  const [{data:stats,error:sError},{data:worlds,error:wError}]=await Promise.all([
    client.from("player_stats").select("user_id,health,energy,level,experience,coins").in("user_id",ids),
    client.from("world_access").select("user_id,world_slug").in("user_id",ids)
  ]);
  if(sError) throw sError;if(wError) throw wError;
  const statMap=new Map(stats.map(s=>[s.user_id,s]));
  players=profiles.map((p,index)=>({...p,number:String(index+1).padStart(3,"0"),stats:statMap.get(p.id)||{health:100,energy:100,level:1,experience:0,coins:0},worlds:worlds.filter(w=>w.user_id===p.id).map(w=>w.world_slug)}));
  els.playerCount.textContent=players.length;
  els.coinTotal.textContent=formatNumber(players.reduce((sum,p)=>sum+p.stats.coins,0));
  els.worldCount.textContent=new Set(worlds.map(w=>w.world_slug)).size;
  renderPlayers();
}

function renderPlayers(){
  const q=els.playerSearch.value.trim().toLowerCase();
  const visible=players.filter(p=>!q||p.number.includes(q)||p.username.toLowerCase().includes(q)||(p.display_name||"").toLowerCase().includes(q));
  els.playerList.replaceChildren();
  if(!visible.length){els.playerList.innerHTML='<div class="loading-card">KEINE SPIELER GEFUNDEN</div>';return}
  visible.forEach(player=>{
    const node=template.content.firstElementChild.cloneNode(true);const s=player.stats;const need=s.level*100;
    node.querySelector(".player-number").textContent=player.number;
    node.querySelector(".player-name").textContent=player.display_name||player.username;
    const role=node.querySelector(".role-chip");role.textContent=player.role.toUpperCase();role.classList.toggle("admin",player.role==="admin");
    node.querySelector(".hearts").innerHTML=hearts(s.health);
    node.querySelector(".energy-meter").innerHTML=energySegments(s.energy);
    node.querySelector(".energy-value").textContent=`${s.energy}%`;
    node.querySelector(".level-label").textContent=`LV ${s.level}`;
    node.querySelector(".xp-track i").style.width=`${Math.min(100,(s.experience/need)*100)}%`;
    node.querySelector(".xp-value").textContent=`${s.experience}/${need}`;
    node.querySelector(".coins strong").textContent=formatNumber(s.coins);
    node.querySelector(".edit-button").addEventListener("click",()=>openEditor(player));
    els.playerList.append(node);
  });
}

function updateRangeOutputs(){els.healthOutput.innerHTML=hearts(Number(els.editHealth.value));els.energyOutput.textContent=`${els.editEnergy.value}%`}
function openEditor(player){
  const s=player.stats;els.editUserId.value=player.id;els.dialogPlayerName.textContent=`${player.number} · ${player.username}`;
  els.editDisplayName.value=player.display_name||"";els.editRole.value=player.role;els.editHealth.value=s.health;els.editEnergy.value=s.energy;
  els.editLevel.value=s.level;els.editExperience.value=s.experience;els.editExperience.max=s.level*100-1;els.editCoins.value=s.coins;
  els.editPeru.checked=player.worlds.includes("peru");els.dialogMessage.textContent="";updateRangeOutputs();els.editDialog.showModal();
}

async function savePlayer(event){
  event.preventDefault();const id=els.editUserId.value;els.dialogMessage.className="dialog-message";els.dialogMessage.textContent="WIRD GESPEICHERT …";
  const level=Math.max(1,Number(els.editLevel.value)||1);const experience=Math.max(0,Number(els.editExperience.value)||0);
  const {error:pError}=await client.from("profiles").update({display_name:els.editDisplayName.value.trim()||null,role:els.editRole.value}).eq("id",id);
  if(pError)return showDialogError(pError.message);
  const previous=players.find(p=>p.id===id)?.stats.coins||0;const coins=Math.min(999999,Math.max(0,Number(els.editCoins.value)||0));
  const {error:sError}=await client.from("player_stats").update({health:Number(els.editHealth.value),energy:Number(els.editEnergy.value),level,experience,coins}).eq("user_id",id);
  if(sError)return showDialogError(sError.message);
  const worldQuery=els.editPeru.checked
    ? client.from("world_access").upsert({user_id:id,world_slug:"peru"},{onConflict:"user_id,world_slug"})
    : client.from("world_access").delete().eq("user_id",id).eq("world_slug","peru");
  const {error:wError}=await worldQuery;if(wError)return showDialogError(wError.message);
  if(coins!==previous)await client.from("coin_transactions").insert({user_id:id,amount:coins-previous,balance_after:coins,reason:"Änderung im Admin-Bereich",source_type:"admin"});
  els.dialogMessage.textContent="GESPEICHERT";await loadPlayers();setTimeout(()=>els.editDialog.close(),350);
}
function showDialogError(message){els.dialogMessage.className="dialog-message error";els.dialogMessage.textContent=`FEHLER: ${message}`}

els.playerSearch.addEventListener("input",renderPlayers);els.editHealth.addEventListener("input",updateRangeOutputs);els.editEnergy.addEventListener("input",updateRangeOutputs);
els.editLevel.addEventListener("input",()=>{els.editExperience.max=Math.max(0,Number(els.editLevel.value)*100-1)});
document.getElementById("closeDialog").addEventListener("click",()=>els.editDialog.close());document.getElementById("cancelEdit").addEventListener("click",()=>els.editDialog.close());
els.editForm.addEventListener("submit",savePlayer);els.logoutButton.addEventListener("click",async()=>{await client?.auth.signOut();location.replace("index.html")});

(async()=>{try{
  if(localPreview){
    players=[
      {id:"demo-1",number:"001",username:"roger",display_name:"Roger",role:"user",stats:{health:100,energy:80,level:2,experience:60,coins:120},worlds:["peru"]},
      {id:"demo-2",number:"002",username:"luna",display_name:"Luna",role:"user",stats:{health:80,energy:60,level:1,experience:30,coins:85},worlds:["peru"]},
      {id:"demo-3",number:"003",username:"admin",display_name:"Administrator",role:"admin",stats:{health:100,energy:100,level:4,experience:180,coins:640},worlds:["peru"]}
    ];
    setConnection("VORSCHAU · SUPABASE-DATEN WERDEN SPÄTER GELADEN");
    els.playerCount.textContent=players.length;els.coinTotal.textContent=formatNumber(players.reduce((sum,p)=>sum+p.stats.coins,0));els.worldCount.textContent="1";renderPlayers();
  }else if(await guardAdmin()){setConnection("MIT SUPABASE VERBUNDEN");await loadPlayers()}
}catch(error){setConnection("VERBINDUNG FEHLGESCHLAGEN",true);els.playerList.innerHTML='<div class="loading-card">DATEN KONNTEN NICHT GELADEN WERDEN</div>';els.pageMessage.textContent=error.message}})();
