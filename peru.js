
(() => {
  const $ = q => document.querySelector(q);
  const $$ = q => [...document.querySelectorAll(q)];

  const portraits = [
    "01-white-shirt-man.png","02-blue-cap-man.png","03-yellow-shirt-man.png",
    "04-green-shirt-woman.png","05-red-cap-woman.png","06-zombie.png","07-skeleton.png"
  ];
  const walkers = ["walker.png","02-walker.png","03-walker.png","04-walker.png","05-walker.png","06-walker.png","07-walker.png"];
  const targets = {
    lima:{label:"LIMA",x:19.0,y:45.5,path:[[27.1,56.4],[25.4,53.2],[22.8,51.0],[20.8,49.0]]},
    nazca:{label:"NAZCA-LINIEN",x:30.5,y:70.5,path:[[29.4,60.2],[31.4,63.7],[34.7,66.8],[38.1,69.2]]},
    andes:{label:"ANDEN",x:39.5,y:18.7,path:[[28.2,53.6],[29.4,48.1],[30.5,42.6],[31.8,36.8],[34.3,30.8]]},
    machu:{label:"MACHU PICCHU",x:57.5,y:39.5,path:[[32.6,58.8],[37.6,62.2],[43.4,64.0],[48.3,60.2],[52.0,55.3],[54.1,49.2]]},
    amazon:{label:"AMAZONAS",x:77.3,y:21.0,path:[[32.6,58.8],[37.6,62.2],[43.4,64.0],[48.3,60.2],[52.0,55.3],[56.0,50.8],[60.5,48.1],[64.6,43.3],[68.3,38.0],[71.6,31.7]]},
    lake:{label:"TITICACASEE",x:67.8,y:77.0,path:[[32.6,58.8],[37.6,62.2],[43.4,64.0],[49.0,66.2],[54.3,68.5],[59.4,71.1],[63.4,73.4]]}
  };

  let selected = +(localStorage.getItem("peru-character") || 0);
  let playerName = localStorage.getItem("peru-name") || "Mein Name";

  // V3.9 gameplay save: reset old demo/test progress exactly once.
  // The chosen character and player name are kept.
  const GAME_SAVE_VERSION = "4.0";
  if(localStorage.getItem("bw-game-save-version") !== GAME_SAVE_VERSION){
    [
      "bw-player-state","bw-inventory","bw-adopted-animal","bw-current-plant",
      "bw-plant-stage","bw-plant-care","bw-animal-care"
    ].forEach(key=>localStorage.removeItem(key));
    localStorage.setItem("bw-game-save-version",GAME_SAVE_VERSION);
  }

  let adoptedAnimal = JSON.parse(localStorage.getItem("bw-adopted-animal") || "null");
  let currentPlant = localStorage.getItem("bw-current-plant") || null;
  let plantStage = +(localStorage.getItem("bw-plant-stage") || 0);

  const todayKey=()=>new Date().toISOString().slice(0,10);
  const dayNumber=value=>Math.floor(new Date(value+"T00:00:00").getTime()/86400000);
  const playerState=JSON.parse(localStorage.getItem("bw-player-state") || '{"level":1,"hp":100,"energy":100,"xp":0,"coins":0}');
  playerState.level=Math.max(1,Math.floor(Number(playerState.level ?? 1)));
  playerState.hp=Math.max(0,Math.min(100,Number(playerState.hp ?? 100)));
  playerState.energy=Math.max(0,Math.min(100,Number(playerState.energy ?? 100)));
  playerState.xp=Math.max(0,Number(playerState.xp ?? 0));
  playerState.coins=Math.max(0,Number(playerState.coins ?? 0));

  let inventory=JSON.parse(localStorage.getItem("bw-inventory") || '{"items":[]}');
  inventory.items=Array.isArray(inventory.items)?inventory.items:[];
  // Convert older fruit/gem test saves into the new collection format.
  if(Array.isArray(inventory.fruits)) inventory.fruits.forEach(f=>inventory.items.push({id:f.id||`old-${Date.now()}-${Math.random()}`,key:f.type==="cacao"?"cacao-pod":f.type==="orchid"?"orchid-seed":"waterlily-seed",earnedOn:f.earnedOn||todayKey()}));
  if(Array.isArray(inventory.gems)) inventory.gems.forEach(g=>inventory.items.push({id:g.id||`old-${Date.now()}-${Math.random()}`,key:(g.kind||"").includes("RUBIN")?"ruby":"emerald",earnedOn:g.earnedOn||todayKey()}));
  delete inventory.fruits; delete inventory.gems;

  let plantCare=JSON.parse(localStorage.getItem("bw-plant-care") || '{"completedDays":[],"actions":{}}');
  plantCare.completedDays=Array.isArray(plantCare.completedDays)?plantCare.completedDays:[];
  plantCare.actions=plantCare.actions || {};

  let animalCare=JSON.parse(localStorage.getItem("bw-animal-care") || '{"actions":{},"lastChestCycle":0}');
  animalCare.actions=animalCare.actions || {};
  animalCare.lastChestCycle=Number(animalCare.lastChestCycle || 0);

  function savePlayerState(){ localStorage.setItem("bw-player-state",JSON.stringify(playerState)); updateHud(); }
  function saveInventory(){ localStorage.setItem("bw-inventory",JSON.stringify(inventory)); renderInventory(); }
  function savePlantCare(){ localStorage.setItem("bw-plant-care",JSON.stringify(plantCare)); }
  function saveAnimalCare(){ localStorage.setItem("bw-animal-care",JSON.stringify(animalCare)); }
  const xpNeededForLevel=level=>Math.max(100,Math.floor(level)*100);
  function normalizeLevelProgress(){
    let needed=xpNeededForLevel(playerState.level);
    while(playerState.xp>=needed){
      playerState.xp-=needed;
      playerState.level+=1;
      needed=xpNeededForLevel(playerState.level);
    }
  }
  function addXp(amount=20){
    playerState.xp+=Math.max(0,Number(amount)||0);
    normalizeLevelProgress();
    savePlayerState();
  }
  function addCoins(amount){ playerState.coins+=amount; savePlayerState(); }
  function loseHp(amount=10){
    playerState.hp=Math.max(0,playerState.hp-amount);
    savePlayerState();
    $("#gameMessage").textContent=`NICHT GESCHAFFT · ${amount}% HP VERLOREN.`;
  }
  window.blockWorldRecordFailure=()=>loseHp(10);
  window.blockWorldRecordSuccess=()=>addXp(20);

  let position = {x:28.7,y:57};
  let walking = false;
  let activeMode = null;
  let activeItem = null;
  let animationId = 0;
  let actionState = "idle";
  let actionUntil = 0;
  let randomAnimalState = "stare";
  let nextRandomStateAt = 0;
  let particles = [];

  const canvas = $("#gameCanvas");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const imageNames = [
    "dolphin-stare.png","dolphin-sleep.png","dolphin-play.png",
    "capybara-stare.png","capybara-sleep.png","capybara-play.png",
    "sloth-stare.png","sloth-sleep.png","sloth-play.png",
    "cacao-stages-rebuilt.png","orchid-stages-rebuilt.png","waterlily-stages-rebuilt.png",
    "cacao-preview.png","orchid-preview.png","waterlily-preview.png"
  ];
  const images = {};
  imageNames.forEach(name => {
    const img = new Image();
    img.src = `assets/${name}`;
    images[name] = img;
  });

  const animalData = {
    dolphin:{title:"ROSA FLUSSDELFIN", short:"DELFIN", scene:"FLUSS", food:"FISCH"},
    capybara:{title:"CAPYBARA", short:"CAPYBARA", scene:"WASSERUFER", food:"GRAS"},
    sloth:{title:"FAULTIER", short:"FAULTIER", scene:"BAUMKRONE", food:"BLÄTTER"}
  };
  const plantData = {
    cacao:{title:"KAKAO", sheet:"cacao-stages-rebuilt.png", preview:"cacao-preview.png"},
    orchid:{title:"ORCHIDEE", sheet:"orchid-stages-rebuilt.png", preview:"orchid-preview.png"},
    waterlily:{title:"AMAZONAS-SEEROSE", sheet:"waterlily-stages-rebuilt.png", preview:"waterlily-preview.png"}
  };

  function open(id){ $("#"+id).classList.remove("hidden"); }
  function close(id){
    $("#"+id).classList.add("hidden");
    if(id==="gameOverlay"){
      cancelAnimationFrame(animationId);
      activeMode=null; activeItem=null;
    }
  }
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>close(b.dataset.close)));
  $$(".overlay").forEach(o=>o.addEventListener("mousedown",e=>{if(e.target===o) close(o.id)}));


  const COLLECTION_CATALOG=[
    {key:"gold-mask",label:"GOLDMASKE",group:"SCHÄTZE",path:"treasure/gold-mask.png"},
    {key:"tumi-knife",label:"TUMI-MESSER",group:"SCHÄTZE",path:"treasure/tumi-knife.png"},
    {key:"sun-disc",label:"SONNENSCHEIBE",group:"SCHÄTZE",path:"treasure/sun-disc.png"},
    {key:"inca-coin",label:"INKA-MÜNZE",group:"SCHÄTZE",path:"treasure/inca-coin.png"},
    {key:"pottery",label:"KERAMIKGEFÄSS",group:"SCHÄTZE",path:"treasure/pottery.png"},
    {key:"wood-idol",label:"HOLZIDOLE",group:"SCHÄTZE",path:"treasure/wood-idol.png"},
    {key:"mystic-key",label:"GEHEIMER SCHLÜSSEL",group:"SCHÄTZE",path:"treasure/mystic-key.png"},
    {key:"royal-feather",label:"KÖNIGSFEDER",group:"SCHÄTZE",path:"treasure/royal-feather.png"},
    {key:"ancient-shell",label:"ALTE MUSCHEL",group:"SCHÄTZE",path:"treasure/ancient-shell.png"},
    {key:"emerald",label:"SMARAGD",group:"EDELSTEINE",path:"treasure/emerald.png"},
    {key:"ruby",label:"RUBIN",group:"EDELSTEINE",path:"treasure/ruby.png"},
    {key:"llama-toy",label:"LAMA-SPIELZEUG",group:"SPIELZEUG",path:"toys/llama-toy.png"},
    {key:"teddy-bear",label:"TEDDYBÄR",group:"SPIELZEUG",path:"toys/teddy-bear.png"},
    {key:"wooden-sword",label:"HOLZSCHWERT",group:"SPIELZEUG",path:"toys/wooden-sword.png"},
    {key:"cacao-pod",label:"KAKAOFRUCHT",group:"ERNTE",path:"fruits/cacao-pod.png"},
    {key:"banana",label:"BANANE",group:"ERNTE",path:"fruits/banana.png"},
    {key:"avocado",label:"AVOCADO",group:"ERNTE",path:"fruits/avocado.png"},
    {key:"mango",label:"MANGO",group:"ERNTE",path:"fruits/mango.png"},
    {key:"coffee-cherries",label:"KAFFEEKIRSCHEN",group:"ERNTE",path:"fruits/coffee-cherries.png"},
    {key:"corn",label:"MAIS",group:"ERNTE",path:"fruits/corn.png"},
    {key:"passion-fruit",label:"MARACUJA",group:"ERNTE",path:"fruits/passion-fruit.png"},
    {key:"acai-berry",label:"AÇAÍ-BEEREN",group:"ERNTE",path:"fruits/acai-berry.png"},
    {key:"orchid-seed",label:"ORCHIDEENSAMEN",group:"ERNTE",path:"fruits/orchid-seed.png"},
    {key:"waterlily-seed",label:"SEEROSENSAMEN",group:"ERNTE",path:"fruits/waterlily-seed.png"}
  ];
  const CHEST_KEYS=COLLECTION_CATALOG.filter(x=>x.group!=="ERNTE").map(x=>x.key);
  const PLANT_REWARDS={cacao:["cacao-pod","banana","avocado","mango","coffee-cherries","corn","passion-fruit","acai-berry"],orchid:["orchid-seed"],waterlily:["waterlily-seed"]};
  let pendingChestReward=null;
  const catalogItem=key=>COLLECTION_CATALOG.find(x=>x.key===key);
  function addCollectionItem(key){
    const item=catalogItem(key); if(!item) return null;
    inventory.items.push({id:`item-${Date.now()}-${Math.random().toString(16).slice(2)}`,key,earnedOn:todayKey()});
    saveInventory(); return item;
  }
  function renderInventory(){
    const grid=$("#collectionGrid"); if(!grid) return;
    const counts={}; inventory.items.forEach(i=>counts[i.key]=(counts[i.key]||0)+1);
    grid.innerHTML="";
    COLLECTION_CATALOG.forEach(item=>{
      const unlocked=(counts[item.key]||0)>0;
      const article=document.createElement("article");
      article.className=`inventory-slot ${unlocked?"unlocked":"locked"}`;
      article.title=unlocked?`${item.label} × ${counts[item.key]}`:"NOCH NICHT ENTDECKT";
      article.innerHTML=`<div class="slot-art"><img src="assets/items/${item.path}" alt="${unlocked?item.label:""}"></div><span>${unlocked?item.label:"???"}</span>${unlocked&&counts[item.key]>1?`<i>×${counts[item.key]}</i>`:""}`;
      grid.appendChild(article);
    });
    const discovered=COLLECTION_CATALOG.filter(i=>counts[i.key]).length;
    $("#collectionProgress").textContent=`${discovered} / ${COLLECTION_CATALOG.length} ENTDECKT`;
    $("#bagCount").textContent=String(discovered);
    $("#bagCount").classList.toggle("hidden",discovered===0);
  }

  function syncCharacter(){
    const src=`assets/${portraits[selected]}`;
    $("#profilePortrait").src=src; $("#hudPortrait").src=src;
    $("#playerName").textContent=playerName;
    $("#hudName").textContent=playerName.toUpperCase();
    $("#nameInput").value=playerName==="Mein Name"?"":playerName;
    $("#walkerSprite").style.backgroundImage=`url("assets/${walkers[selected]}")`;
    $("#walkerSprite").style.backgroundSize="400% 400%";
    $("#walkerSprite").style.backgroundPosition="0 0";
    $$(".character-card").forEach((c,i)=>c.classList.toggle("selected",i===selected));
  }

  portraits.forEach((f,i)=>{
    const b=document.createElement("button");
    b.type="button"; b.className="character-card";
    b.innerHTML=`<img src="assets/${f}" alt="Figur ${i+1}">`;
    b.addEventListener("click",()=>{
      selected=i; localStorage.setItem("peru-character",String(i)); syncCharacter();
    });
    $("#characterGrid").appendChild(b);
  });

  Object.entries(targets).forEach(([key,t])=>{
    const b=document.createElement("button");
    b.type="button"; b.className="landmark";
    b.style.left=t.x+"%"; b.style.top=t.y+"%";
    b.innerHTML=`<span>${t.label}</span>`;
    b.setAttribute("aria-label",t.label);
    b.addEventListener("click",()=>travel(key,t));
    $("#landmarks").appendChild(b);
  });

  $("#profileButton").addEventListener("click",()=>open("characterOverlay"));
  $("#nameButton").addEventListener("click",()=>open("characterOverlay"));
  $("#bagButton").addEventListener("click",()=>{renderInventory();open("bagOverlay");});
  $("#saveName").addEventListener("click",()=>{
    const v=$("#nameInput").value.trim();
    if(!v) return;
    playerName=v; localStorage.setItem("peru-name",v); syncCharacter(); close("characterOverlay");
  });


  const walker=$("#walker");
  const walkerSprite=$("#walkerSprite");
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  function segment(a,b){
    return new Promise(resolve=>{
      const dx=b[0]-a.x;
      const dy=b[1]-a.y;
      const distance=Math.hypot(dx,dy);
      const duration=Math.max(1050,distance*285);
      const start=performance.now();
      const row=Math.abs(dx)>Math.abs(dy) ? (dx<0?1:3) : (dy<0?2:0);
      walker.classList.add("walking");

      function tick(now){
        const p=Math.min(1,(now-start)/duration);
        const eased=p<.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
        position={x:a.x+dx*eased,y:a.y+dy*eased};
        walker.style.left=position.x+"%";
        walker.style.top=position.y+"%";

        const frame=Math.floor((now-start)/310)%4;
        walkerSprite.style.backgroundPosition=`${frame*100/3}% ${row*100/3}%`;

        if(p<1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  async function travel(key,t){
    if(walking) return;
    if(playerState.energy<10){
      $("#routeMessage").textContent="ZU WENIG ENERGIE FÜR DIESE REISE.";
      return;
    }
    playerState.energy=Math.max(0,playerState.energy-10);
    savePlayerState();
    walking=true;
    $("#routeMessage").textContent=`${playerName} läuft nach ${t.label} …`;
    let from={...position};

    for(const point of t.path){
      await segment(from,point);
      from={x:point[0],y:point[1]};
    }

    walker.classList.remove("walking");
    walking=false;
    $("#routeMessage").textContent=`${t.label} erreicht!`;
    await pause(350);
    location.href=key+".html";
  }

  function updateHud(){
    const fullHearts=Math.floor(playerState.hp/20);
    const halfHeart=playerState.hp%20>=10;
    $("#hudHearts").innerHTML=Array.from({length:5},(_,i)=>{
      const cls=i<fullHearts?"heart full":(i===fullHearts && halfHeart?"heart half":"heart empty");
      return `<i class="${cls}"></i>`;
    }).join("");

    const energy=$("#energyBar"), xp=$("#xpBar");
    energy.innerHTML=""; xp.innerHTML="";
    const energySegments=Math.round(playerState.energy/12.5);
    const xpNeeded=xpNeededForLevel(playerState.level);
    const xpSegments=Math.round((playerState.xp/xpNeeded)*8);
    for(let i=0;i<8;i++){
      energy.insertAdjacentHTML("beforeend",`<i class="${i<energySegments?"on":""}"></i>`);
      xp.insertAdjacentHTML("beforeend",`<i class="${i<xpSegments?"on":""}"></i>`);
    }
    $("#energyText").textContent=`${playerState.energy}%`;
    $("#levelText").textContent=`LV ${playerState.level}`;
    $("#xpText").textContent=`${playerState.xp} / ${xpNeeded}`;
    $("#coinText").textContent=String(playerState.coins);
  }

  function buildHud(){ updateHud(); }

  function selectionCard(key,data,type){
    let preview;
    if(type==="animal"){
      preview=`<img src="assets/${key}-stare.png" alt="${data.title}">`;
      const adopted = adoptedAnimal?.type===key;
      const locked = adoptedAnimal && !adopted;
      return `<button class="select-card ${adopted?"adopted":""} ${locked?"locked":""}" type="button" data-select="${key}" ${locked?"disabled":""}>
        <div class="preview animal-preview">${preview}</div>
        ${adopted?`<span class="status-tag">${adoptedAnimal.name}</span>`:""}
        <h2>${data.title}</h2>
        <p>${adopted?"DEIN TIER · KLICKEN ZUM BESUCH":locked?"ERST AKTUELLES TIER FREILASSEN":"ADOPTIEREN UND NAMEN GEBEN"}</p>
      </button>`;
    }
    preview=`<img src="assets/${data.preview}" alt="${data.title}" class="plant-preview-image">`;
    const active = currentPlant===key;
    const locked = currentPlant && !active;
    return `<button class="select-card ${active?"adopted":""} ${locked?"locked":""}" type="button" data-select="${key}" ${locked?"disabled":""}>
      <div class="preview">${preview}</div>
      ${active?`<span class="status-tag">STUFE ${plantStage+1}/8</span>`:""}
      <h2>${data.title}</h2>
      <p>${active?"WEITER PFLEGEN":locked?"ERST AKTUELLE PFLANZE ERNTEN":"NEU PFLANZEN"}</p>
    </button>`;
  }

  function showSelection(mode){
    activeMode=mode; activeItem=null; cancelAnimationFrame(animationId);
    $("#selectionView").classList.remove("hidden");
    $("#playView").classList.add("hidden");
    $("#gameHeading").textContent=mode==="animal"?"TIERFREUNDE":"PFLANZENGARTEN";
    $("#gameSubtitle").textContent=mode==="animal"?"WÄHLE EIN TIER":"WÄHLE EINE PFLANZE";
    $("#gameMessage").textContent="";
    const data=mode==="animal"?animalData:plantData;
    $("#selectionView").innerHTML=Object.entries(data).map(([k,v])=>selectionCard(k,v,mode)).join("");
    $$("#selectionView [data-select]").forEach(b=>b.addEventListener("click",()=>handleSelect(b.dataset.select)));
  }

  function openGame(mode){ open("gameOverlay"); showSelection(mode); }
  $("#animalHotspot").addEventListener("click",()=>openGame("animal"));
  $("#plantHotspot").addEventListener("click",()=>openGame("plant"));

  function handleSelect(item){
    if(activeMode==="animal"){
      if(adoptedAnimal){
        if(adoptedAnimal.type!==item) return;
        startPlay(item);
      } else {
        showAdoptionForm(item);
      }
    } else {
      if(currentPlant && currentPlant!==item) return;
      if(!currentPlant){
        currentPlant=item; plantStage=0;
        plantCare={completedDays:[],actions:{}};
        savePlantCare();
        localStorage.setItem("bw-current-plant",item);
        localStorage.setItem("bw-plant-stage","0");
      }
      startPlay(item);
    }
  }

  function showAdoptionForm(item){
    $("#gameSubtitle").textContent="GIB DEINEM NEUEN TIER EINEN NAMEN";
    $("#selectionView").innerHTML=`
      <div class="adoption-box">
        <img class="adoption-animal" src="assets/${item}-stare.png" alt="${animalData[item].title}">
        <h2>${animalData[item].title}</h2>
        <p>DU KANNST ERST EIN ANDERES TIER ADOPTIEREN, WENN DU DIESES FREILÄSST.</p>
        <input id="petNameInput" maxlength="16" autocomplete="off" placeholder="NAME DES TIERES">
        <div class="adoption-actions">
          <button class="action-button" id="confirmAdoption" type="button">ADOPTIEREN</button>
          <button class="action-button secondary" id="cancelAdoption" type="button">ABBRECHEN</button>
        </div>
      </div>`;
    $("#petNameInput").focus();
    $("#confirmAdoption").addEventListener("click",()=>{
      const name=$("#petNameInput").value.trim();
      if(!name){
        $("#gameMessage").textContent="BITTE GIB DEINEM TIER EINEN NAMEN.";
        return;
      }
      adoptedAnimal={type:item,name,adoptedOn:todayKey()};
      animalCare={actions:{},lastChestCycle:0};
      saveAnimalCare();
      localStorage.setItem("bw-adopted-animal",JSON.stringify(adoptedAnimal));
      startPlay(item);
    });
    $("#cancelAdoption").addEventListener("click",()=>showSelection("animal"));
  }

  function startPlay(item){
    activeItem=item; actionState="idle"; particles=[];
    randomAnimalState="stare"; nextRandomStateAt=performance.now()+3500+Math.random()*3500;
    $("#selectionView").classList.add("hidden");
    $("#playView").classList.remove("hidden");
    const data=activeMode==="animal"?animalData[item]:plantData[item];
    $("#gameHeading").textContent=activeMode==="animal"?`${adoptedAnimal.name.toUpperCase()} · ${data.title}`:data.title;
    $("#gameSubtitle").textContent=activeMode==="animal"?"AMAZONAS-FREUND":`WACHSTUM ${plantStage+1} / 8`;
    $("#gameMessage").textContent="";
    if(activeMode==="animal"){
      $("#actionBar").innerHTML=`
        <button class="action-button" data-action="feed">FÜTTERN</button>
        <button class="action-button" data-action="play">SPIELEN</button>
        <button class="action-button" data-action="pet">STREICHELN</button>
        <button class="action-button danger" data-action="release">FREILASSEN</button>`;
    }else{
      $("#actionBar").innerHTML=`
        <button class="action-button" data-action="water">GIESSEN</button>
        <button class="action-button" data-action="fertilize">DÜNGEN</button>
        <button class="action-button" data-action="harvest">ERNTEN</button>`;
    }
    $$("#actionBar [data-action]").forEach(b=>b.addEventListener("click",()=>runAction(b.dataset.action)));
    cancelAnimationFrame(animationId);
    animationId=requestAnimationFrame(loop);
    if(activeMode==="animal") setTimeout(checkAnimalChest,500);
  }

  function dailyActionAllowed(store,kind){
    const today=todayKey();
    store.actions[today]=store.actions[today] || {};
    if(store.actions[today][kind]) return false;
    store.actions[today][kind]=true;
    return true;
  }

  function plantCareProgress(){
    const today=todayKey();
    const done=plantCare.actions[today] || {};
    if(done.water && done.fertilize && !plantCare.completedDays.includes(today)){
      plantCare.completedDays.push(today);
      const completed=plantCare.completedDays.length;
      const calculatedStage=Math.min(7,Math.floor(completed/3));
      if(calculatedStage>plantStage){
        plantStage=calculatedStage;
        localStorage.setItem("bw-plant-stage",String(plantStage));
        $("#gameSubtitle").textContent=`WACHSTUM ${plantStage+1} / 8`;
        $("#gameMessage").textContent=`PFLEGETAG ${completed}: DIE PFLANZE HAT STUFE ${plantStage+1} ERREICHT.`;
      }else{
        const remaining=3-(completed%3 || 3);
        $("#gameMessage").textContent=`PFLEGETAG ${completed} GESCHAFFT · NOCH ${remaining} TAG(E) BIS ZUR NÄCHSTEN STUFE.`;
      }
    }
    savePlantCare();
  }

  function checkAnimalChest(){
    if(!adoptedAnimal) return;
    const adoptedOn=adoptedAnimal.adoptedOn || todayKey();
    if(!adoptedAnimal.adoptedOn){
      adoptedAnimal.adoptedOn=adoptedOn;
      localStorage.setItem("bw-adopted-animal",JSON.stringify(adoptedAnimal));
    }
    const keptDays=Math.max(0,dayNumber(todayKey())-dayNumber(adoptedOn)+1);
    const cycle=Math.floor(keptDays/30);
    if(cycle>animalCare.lastChestCycle){
      $("#chestAnimalText").textContent=`${adoptedAnimal.name.toUpperCase()} HAT DIR NACH ${cycle*30} TAGEN EINE SCHATZTRUHE GEBRACHT.`;
      pendingChestReward=CHEST_KEYS[Math.floor(Math.random()*CHEST_KEYS.length)];
      const reward=catalogItem(pendingChestReward);
      $("#chestRewardImage").src=`assets/items/${reward.path}`;
      $("#chestRewardPop").src=`assets/items/${reward.path}`;
      $("#chestRewardName").textContent=reward.label;
      $("#chestOverlay").classList.remove("hidden");
      $("#claimChest").dataset.cycle=String(cycle);
    }
  }

  $("#claimChest").addEventListener("click",()=>{
    const cycle=Number($("#claimChest").dataset.cycle || 0);
    if(!cycle || cycle<=animalCare.lastChestCycle) return;
    animalCare.lastChestCycle=cycle;
    saveAnimalCare();
    addCoins(100);
    const reward=addCollectionItem(pendingChestReward || CHEST_KEYS[Math.floor(Math.random()*CHEST_KEYS.length)]);
    pendingChestReward=null;
    $("#chestOverlay").classList.add("hidden");
    $("#gameMessage").textContent=`SCHATZ GEÖFFNET: +100 MÜNZEN UND ${reward.label}!`;
  });

  function runAction(kind){
    if(activeMode==="animal" && kind==="release"){
      const oldName=adoptedAnimal.name;
      if(confirm(`${oldName} wirklich freilassen?`)){
        adoptedAnimal=null;
        localStorage.removeItem("bw-adopted-animal");
        localStorage.removeItem("bw-animal-care");
        animalCare={actions:{},lastChestCycle:0};
        $("#gameMessage").textContent=`${oldName.toUpperCase()} IST ZURÜCK IN DER NATUR.`;
        setTimeout(()=>showSelection("animal"),650);
      }
      return;
    }

    if(activeMode==="plant" && kind==="harvest"){
      if(plantStage<7){
        $("#gameMessage").textContent="DIE PFLANZE IST NOCH NICHT REIF.";
        return;
      }
      addCoins(100);
      const choices=PLANT_REWARDS[activeItem] || ["cacao-pod"];
      const reward=addCollectionItem(choices[Math.floor(Math.random()*choices.length)]);
      $("#gameMessage").textContent=`ERNTE GESCHAFFT: +100 MÜNZEN UND ${reward.label} FÜR DEN RUCKSACK!`;
      currentPlant=null; plantStage=0;
      plantCare={completedDays:[],actions:{}};
      savePlantCare();
      localStorage.removeItem("bw-current-plant");
      localStorage.removeItem("bw-plant-stage");
      setTimeout(()=>showSelection("plant"),1100);
      return;
    }

    if(activeMode==="animal" && ["feed","play","pet"].includes(kind)){
      if(!dailyActionAllowed(animalCare,kind)){
        $("#gameMessage").textContent="DIESE AKTION HAST DU HEUTE SCHON GEMACHT. MORGEN GEHT ES WEITER.";
        return;
      }
      saveAnimalCare();
      addXp(20);
    }

    if(activeMode==="plant" && ["water","fertilize"].includes(kind)){
      if(!dailyActionAllowed(plantCare,kind)){
        $("#gameMessage").textContent="DIESE PFLEGE HAST DU HEUTE SCHON GEMACHT. SIE ZÄHLT NUR EINMAL PRO TAG.";
        return;
      }
      savePlantCare();
      addXp(20);
    }

    actionState=kind;
    actionUntil=performance.now()+(kind==="play"?3600:1600);

    if(activeMode==="animal"){
      randomAnimalState=kind==="play"?"play":"stare";
      $("#gameMessage").textContent={
        feed:`${adoptedAnimal.name.toUpperCase()} BEKOMMT ${animalData[activeItem].food}.`,
        play:`${adoptedAnimal.name.toUpperCase()} SPIELT!`,
        pet:`${adoptedAnimal.name.toUpperCase()} FÜHLT SICH WOHL.`
      }[kind];
      if(kind==="feed") spawnFood();
      if(kind==="pet") spawnHearts();
    } else {
      if(kind==="water" || kind==="fertilize"){
        $("#gameMessage").textContent=kind==="water"
          ?"GEGOSSEN: +20 XP. DIESE PFLEGE ZÄHLT HEUTE EINMAL."
          :"GEDÜNGT: +20 XP. DIESE PFLEGE ZÄHLT HEUTE EINMAL.";
        kind==="water" ? spawnWater() : spawnFertilizer();
        plantCareProgress();
      }
    }
  }

  function spawnFood(){
    particles=[];
    const foodType = activeItem==="dolphin" ? "fish" : activeItem==="capybara" ? "grass" : "leaf";
    for(let i=0;i<10;i++){
      particles.push({
        type:"food", foodType,
        x:270+i*20, y:-25-i*8,
        vx:(Math.random()-.5)*.65,
        vy:1.0+Math.random()*.75,
        life:190
      });
    }
  }
  function spawnHearts(){
    particles=[];
    for(let i=0;i<10;i++) particles.push({type:"heart",x:320+Math.random()*140,y:270+Math.random()*40,vx:(Math.random()-.5)*.6,vy:-.8-Math.random(),life:120,color:"#ff5f93"});
  }
  function spawnWater(){
    particles=[];
    for(let i=0;i<42;i++) particles.push({type:"drop",x:250+Math.random()*270,y:20+Math.random()*40,vx:(Math.random()-.5)*.4,vy:1.8+Math.random()*1.8,life:130,color:"#78d8ff"});
  }
  function spawnFertilizer(){
    particles=[];
    for(let i=0;i<32;i++) particles.push({type:"spark",x:260+Math.random()*250,y:300+Math.random()*40,vx:(Math.random()-.5)*1.3,vy:-1-Math.random()*1.8,life:120,color:i%2?"#ffd454":"#8ee35e"});
  }

  function px(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}

  function drawSkyAndJungle(){
    ctx.fillStyle="#5fb5d1"; ctx.fillRect(0,0,768,432);
    px(0,0,768,72,"#79cce4");
    for(let x=0;x<768;x+=48){ px(x,80+(x%96),60,110,x%96?"#1f6d3a":"#2c8744"); }
    px(0,328,768,104,"#285424");
    for(let x=0;x<768;x+=32) px(x,330+(x%64?10:0),28,12,"#4a7e32");
  }


  function drawUnderwaterScene(t){
    ctx.fillStyle="#176b8c";
    ctx.fillRect(0,0,768,432);
    px(0,0,768,72,"#3c9fba");
    px(0,72,768,140,"#217f9f");
    px(0,212,768,220,"#155b7d");

    // Moving shafts of light.
    for(let i=0;i<6;i++){
      const x=(i*145+(t/45)%145)-80;
      ctx.fillStyle="rgba(154,232,244,.08)";
      ctx.beginPath();
      ctx.moveTo(x,0);
      ctx.lineTo(x+55,0);
      ctx.lineTo(x+145,310);
      ctx.lineTo(x+90,310);
      ctx.fill();
    }

    // Sandy river bottom and stones.
    px(0,360,768,72,"#806d43");
    px(0,376,768,56,"#685839");
    for(let i=0;i<25;i++){
      const x=(i*71)%768;
      const y=368+(i*19)%46;
      px(x,y,18+(i%3)*6,8+(i%2)*5,i%2?"#89794e":"#4f5844");
    }

    // Swaying underwater plants.
    for(let i=0;i<13;i++){
      const baseX=25+i*61;
      const height=35+(i%4)*14;
      const sway=Math.sin(t/650+i*.8)*8;
      px(baseX,360-height,6,height,"#1f713f");
      px(baseX+sway,360-height+8,17,6,"#3d9a52");
      px(baseX-sway*.6,360-height+20,15,6,"#2f8747");
      if(i%3===0) px(baseX+4+sway*.3,360-height-8,8,10,"#55b967");
    }

    // Bubbles continuously rising.
    for(let i=0;i<20;i++){
      const bx=(i*83+Math.sin(i)*37)%768;
      const travel=(t/7+i*41)%430;
      const by=425-travel;
      const size=4+(i%4)*2;
      ctx.strokeStyle=i%2?"#b7eff6":"#75cede";
      ctx.lineWidth=2;
      ctx.strokeRect(Math.round(bx+Math.sin(t/420+i)*7),Math.round(by),size,size);
      if(size>6) px(bx+2,by+1,2,2,"#d9fbff");
    }
  }

  function drawRiverScene(t){
    drawSkyAndJungle();
    px(0,250,768,182,"#1d7899");
    for(let i=0;i<18;i++){
      const x=(i*73+t/8)%820-30, y=280+(i*31)%125;
      px(x,y,18,5,i%2?"#83d6e9":"#3ea0be");
    }
    px(600,226,168,44,"#6e4c25"); px(610,215,158,22,"#4c7b2e");
  }


  function drawCapybaraShoreScene(t, showGrassPile=false){
    drawSkyAndJungle();

    // River sits behind the bank, not over the capybara.
    px(500,250,268,182,"#1b7893");
    for(let i=0;i<12;i++){
      const x=510+((i*47+t/11)%270);
      const y=280+(i%5)*28;
      px(x,y,22,5,i%2?"#73ccdc":"#3598b0");
    }

    // Broad, clearly visible dry bank.
    px(0,244,535,188,"#816139");
    px(0,244,535,23,"#5b8739");
    px(0,267,535,165,"#6d4e2d");
    px(0,382,535,50,"#4c6b30");

    for(let i=0;i<18;i++){
      const x=(i*37)%510;
      const y=285+(i*29)%105;
      px(x,y,12,5,i%2?"#8c7047":"#5c7c37");
    }

    // Grass pile placed on the bank during feeding.
    if(showGrassPile){
      for(let i=0;i<28;i++){
        const gx=395+(i%7)*10+(i%2)*3;
        const gy=318-Math.floor(i/7)*8;
        px(gx,gy,4,22,"#3f8b31");
        px(gx+4,gy+4,4,18,"#69b13e");
      }
      px(385,337,92,12,"#315f28");
      px(398,330,66,9,"#83bd49");
    }
  }

  function drawBankScene(t){
    drawSkyAndJungle();
    px(0,246,768,186,"#19778f");
    for(let i=0;i<24;i++){
      const x=(i*61+t/11)%810-20;
      const y=278+(i*27)%130;
      px(x,y,22,5,i%2?"#79d0df":"#3599b1");
    }
    px(0,224,180,42,"#6e4d27");
    px(0,214,190,18,"#4d7b31");
    px(612,220,156,46,"#684724");
    px(602,210,166,18,"#4b7830");
  }

  function drawCanopyScene(){
    ctx.fillStyle="#79bed0"; ctx.fillRect(0,0,768,432);
    px(0,0,768,70,"#1e582f");
    for(let x=0;x<768;x+=40) px(x,40+(x%80),56,95,x%80?"#246b38":"#318447");
    px(100,0,60,432,"#5d351b"); px(610,0,70,432,"#4a2a16");
    px(0,345,768,87,"#153d25");
    px(80,130,610,28,"#5a351b"); px(95,130,585,10,"#8a5b31");
  }

  function drawAnimalImage(name,x,y,w,h,rotation=0,flip=false){
    const img=images[name];
    if(!img || !img.complete) return;
    ctx.save(); ctx.translate(x,y); ctx.rotate(rotation);
    ctx.scale(flip?-1:1,1);
    ctx.drawImage(img,-w/2,-h/2,w,h);
    ctx.restore();
  }

  function animalStateImage(){
    let state=randomAnimalState;
    if(actionState==="play" && performance.now()<actionUntil) state="play";
    if(actionState==="feed" || actionState==="pet") state="stare";
    return `${activeItem}-${state}.png`;
  }

  function drawDolphin(t){
    drawUnderwaterScene(t);
    let x=360,y=235,rot=0,flip=false;
    if(actionState==="play" && t<actionUntil){
      const p=Math.max(0,Math.min(1,1-(actionUntil-t)/3600));
      const arc=Math.sin(p*Math.PI);
      x=260+p*270;
      y=268-arc*145;
      rot=p*Math.PI*2;
      flip=false;
    } else if(randomAnimalState==="sleep"){
      x=350; y=296; rot=.02;
    } else if(randomAnimalState==="play"){
      x=365+Math.sin(t/1000)*55;
      y=245-Math.abs(Math.sin(t/900))*32;
      rot=Math.sin(t/1100)*.12;
    } else {
      x=350+Math.sin(t/850)*25;
      y=258+Math.sin(t/650)*6;
      rot=Math.sin(t/1000)*.04;
    }
    drawAnimalImage(animalStateImage(),x,y,245,205,rot,flip);
  }

  function drawCapybara(t){
    const explicitPlay=actionState==="play" && t<actionUntil;
    const explicitFeed=actionState==="feed" && t<actionUntil;
    const explicitPet=actionState==="pet" && t<actionUntil;
    const idleStare=actionState==="idle" && randomAnimalState==="stare";
    const idleSleep=actionState==="idle" && randomAnimalState==="sleep";

    // Only playing and idle daydreaming happen in the water.
    if(explicitPlay || idleStare){
      drawRiverScene(t);

      let x=385;
      if(explicitPlay){
        const p=Math.max(0,Math.min(1,1-(actionUntil-t)/3600));
        x=170+p*430+Math.sin(p*Math.PI*6)*10;
      }else{
        x=385+Math.sin(t/1300)*12;
      }

      drawAnimalImage(
        explicitPlay ? "capybara-play.png" : "capybara-stare.png",
        x,330,235,197,0,false
      );

      px(0,318,768,114,"#176f88");
      for(let i=0;i<18;i++){
        const waveX=(i*49+t/9)%790-20;
        const waveY=324+(i%4)*22;
        px(waveX,waveY,28,5,i%2?"#75ccdc":"#3093aa");
      }

      const ripple=Math.floor((t/160)%22);
      px(x-62-ripple/2,318+ripple/6,40+ripple,4,"#9be1e9");
      px(x-45-ripple/3,329+ripple/8,30+ripple/1.5,4,"#53b4c6");
      return;
    }

    // Sleeping, feeding, petting and normal shore idle are clearly on land.
    drawCapybaraShoreScene(t, explicitFeed);

    let x=315;
    let y=297;
    let rot=0;
    let image="capybara-stare.png";

    if(idleSleep){
      x=275; y=310; rot=.035; image="capybara-sleep.png";
    }else if(explicitFeed){
      x=325; y=295;
      // Gentle eating motion toward the pile of grass.
      rot=Math.sin(t/180)*.035;
    }else if(explicitPet){
      x=315; y=292;
    }else{
      x=305+Math.sin(t/1000)*5;
    }

    drawAnimalImage(image,x,y,245,205,rot,false);
  }

  function drawSloth(t){
    drawCanopyScene();
    let angle=Math.sin(t/750)*.08;
    if(actionState==="play" && t<actionUntil) angle=Math.sin(t/240)*.34;
    ctx.save();
    ctx.translate(390,140);
    ctx.rotate(angle);
    drawAnimalImage(animalStateImage(),0,105,240,200,0,false);
    ctx.restore();
  }

  function drawPlant(){
    drawSkyAndJungle();
    px(0,285,768,147,"#57381d");
    px(0,330,768,102,"#3d662b");
    const data=plantData[activeItem], img=images[data.sheet];
    if(img && img.complete){
      const frameW=384, frameH=682;
      const sx=plantStage*frameW;
      const dh=310;
      const dw=frameW/frameH*dh;
      ctx.drawImage(img,sx,0,frameW,frameH,384-dw/2,90,dw,dh);
    }
  }

  function updateRandomState(t){
    if(activeMode!=="animal") return;
    if(actionState!=="idle" && t<actionUntil) return;
    if(t>=actionUntil) actionState="idle";
    if(t>nextRandomStateAt){
      const states=["sleep","stare","play"];
      randomAnimalState=states[Math.floor(Math.random()*states.length)];
      nextRandomStateAt=t+4500+Math.random()*4500;
    }
  }

  function updateParticles(){
    for(const p of particles){
      p.x+=p.vx; p.y+=p.vy;
      if(p.type==="food") p.vy+=.035;
      if(p.type==="heart") p.vy-=.004;
      if(p.type==="drop") p.vy+=.01;
      if(p.type==="spark") p.vy+=.02;
      p.life--;
      if(p.type==="heart"){
        ctx.fillStyle=p.color;
        ctx.fillText("♥",p.x,p.y);
      }else if(p.type==="drop"){
        px(p.x,p.y,5,10,p.color);
        px(p.x+1,p.y-3,3,4,"#d7f6ff");
      }else if(p.type==="spark"){
        px(p.x,p.y,7,7,p.color);
        px(p.x+2,p.y-3,3,13,p.color);
      }else{
        if(p.foodType==="fish"){
          px(p.x,p.y,13,7,"#65c7dc");
          px(p.x-5,p.y+1,6,5,"#338aa1");
          px(p.x+9,p.y+2,3,3,"#eefcff");
        }else if(p.foodType==="grass"){
          px(p.x,p.y,3,13,"#4c9b35");
          px(p.x+4,p.y+2,3,11,"#76bd42");
          px(p.x+8,p.y-1,3,14,"#3d842e");
        }else{
          px(p.x,p.y,11,8,"#4f9b3a");
          px(p.x+3,p.y-3,8,7,"#75bd4b");
          px(p.x+5,p.y+2,2,7,"#2e6e2a");
        }
      }
    }
    particles=particles.filter(p=>p.life>0 && p.y<450);
  }

  function loop(t){
    ctx.clearRect(0,0,768,432);
    ctx.font="30px monospace";
    updateRandomState(t);
    if(activeMode==="animal"){
      if(activeItem==="dolphin") drawDolphin(t);
      if(activeItem==="capybara") drawCapybara(t);
      if(activeItem==="sloth") drawSloth(t);
    }else{
      drawPlant();
    }
    updateParticles();
    animationId=requestAnimationFrame(loop);
  }

  buildHud();
  syncCharacter();
})();


  function ensureEntryRings(){
    const animalHotspot=document.querySelector(".animal-hotspot");
    const plantHotspot=document.querySelector(".plant-hotspot");

    if(animalHotspot && !animalHotspot.querySelector(".animal-entry-ring")){
      const ring=document.createElement("span");
      ring.className="entry-ring animal-entry-ring";
      ring.setAttribute("aria-hidden","true");
      animalHotspot.appendChild(ring);
    }

    if(plantHotspot && !plantHotspot.querySelector(".plant-entry-ring")){
      const ring=document.createElement("span");
      ring.className="entry-ring plant-entry-ring";
      ring.setAttribute("aria-hidden","true");
      plantHotspot.appendChild(ring);
    }
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",ensureEntryRings);
  }else{
    ensureEntryRings();
  }
