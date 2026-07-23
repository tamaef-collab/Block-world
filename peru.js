(() => {
  const $ = (q) => document.querySelector(q);
  const $$ = (q) => [...document.querySelectorAll(q)];
  const files = [
    "01-white-shirt-man.png","02-blue-cap-man.png","03-yellow-shirt-man.png",
    "04-green-shirt-woman.png","05-red-cap-woman.png","06-zombie.png","07-skeleton.png"
  ];
  const walkers = [
    "walker.png","02-walker.png","03-walker.png","04-walker.png",
    "05-walker.png","06-walker.png","07-walker.png"
  ];
  const targets = {
    lima:{label:"LIMA",x:19.0,y:45.5,node:"lima"},
    nazca:{label:"NAZCA-LINIEN",x:30.5,y:70.5,node:"nazca"},
    andes:{label:"ANDEN",x:39.5,y:18.7,node:"andes"},
    machu:{label:"MACHU PICCHU",x:57.5,y:39.5,node:"machu"},
    amazon:{label:"AMAZONAS",x:77.3,y:21.0,node:"amazon"},
    lake:{label:"TITICACASEE",x:67.8,y:77.0,node:"lake"}
  };
  // A road graph traced over the pale roads painted into the map. Landmarks are
  // click targets; their arrival nodes deliberately stop at the end of a road.
  const road = {
    hub:{p:[32.6,58.8],to:["coast","south","east1"]},
    coast:{p:[28.4,56.1],to:["hub","lima","north1"]},
    lima:{p:[22.1,50.2],to:["coast"]},
    north1:{p:[29.4,47.9],to:["coast","north2"]},
    north2:{p:[31.0,38.2],to:["north1","andes"]},
    andes:{p:[34.5,29.7],to:["north2"]},
    south:{p:[34.1,64.1],to:["hub","nazca","lake1"]},
    nazca:{p:[38.0,69.0],to:["south"]},
    east1:{p:[40.5,62.8],to:["hub","machu1","lake1"]},
    machu1:{p:[47.8,59.7],to:["east1","machu"]},
    machu:{p:[54.2,49.5],to:["machu1","amazon1"]},
    amazon1:{p:[59.1,47.0],to:["machu","amazon2"]},
    amazon2:{p:[65.0,42.6],to:["amazon1","amazon"]},
    amazon:{p:[71.5,32.4],to:["amazon2"]},
    lake1:{p:[49.3,66.1],to:["south","east1","lake2"]},
    lake2:{p:[56.8,69.8],to:["lake1","lake"]},
    lake:{p:[63.5,73.2],to:["lake2"]}
  };
  let selected = +(localStorage.getItem("peru-character") || 0);
  let playerName = localStorage.getItem("peru-name") || "Mein Name";
  let playerXP = +(localStorage.getItem("peru-xp") || 0);
  let playerCoins = +(localStorage.getItem("peru-coins") || 128);
  let currentNode = localStorage.getItem("peru-road-node") || "hub";
  if(!road[currentNode]) currentNode="hub";
  let position = {x:road[currentNode].p[0],y:road[currentNode].p[1]};
  let walking = false, activeGame = null, raf = 0;

  const portrait = $("#profilePortrait"), walkerSprite = $("#walkerSprite"), walker = $("#walker");
  const nameText = $("#playerName"), nameInput = $("#nameInput");
  function syncRewards(){
    $("#xpText").textContent=`${playerXP % 500} / 500`;
    $("#xpBar").style.width=`${Math.min(100,(playerXP%500)/5)}%`;
    $("#coinText").textContent=playerCoins;
  }
  function rewardXP(amount){
    playerXP+=amount;localStorage.setItem("peru-xp",String(playerXP));syncRewards();
    $("#routeMessage").textContent=`+${amount} XP`;
  }
  function rewardCoins(amount){
    playerCoins+=amount;localStorage.setItem("peru-coins",String(playerCoins));syncRewards();
  }
  function syncCharacter(){
    const src = `assets/${files[selected]}`;
    portrait.src = src; nameText.textContent = playerName; nameInput.value = playerName === "Mein Name" ? "" : playerName;
    walkerSprite.style.backgroundImage=`url("assets/${walkers[selected]}")`;
    walkerSprite.style.backgroundSize="400% 400%";
    walkerSprite.style.backgroundPosition="0 0";
    $$(".character-card").forEach((x,i)=>x.classList.toggle("selected",i===selected));
  }

  files.forEach((file,i)=>{
    const b=document.createElement("button"); b.className="character-card"; b.type="button";
    b.setAttribute("aria-label",`Figur ${i+1} wählen`); b.innerHTML=`<img src="assets/${file}" alt="Figur ${i+1}">`;
    b.onclick=()=>{selected=i;localStorage.setItem("peru-character",String(i));syncCharacter()};
    $("#characterGrid").appendChild(b);
  });
  Object.entries(targets).forEach(([key,t])=>{
    const b=document.createElement("button");b.className="landmark";b.style.left=t.x+"%";b.style.top=t.y+"%";
    b.innerHTML=`<span>${t.label}</span>`;b.setAttribute("aria-label",t.label);b.onclick=()=>travel(key,t);
    $("#landmarks").appendChild(b);
  });
  function open(id){$("#"+id).classList.remove("hidden")}
  function close(id){$("#"+id).classList.add("hidden");if(id==="gameOverlay"){activeGame=null;cancelAnimationFrame(raf)}}
  $("#profileButton").onclick=$("#nameButton").onclick=()=>open("characterOverlay");
  $("#saveName").onclick=()=>{
    const v=nameInput.value.trim(); if(!v){nameInput.focus();return}
    playerName=v;localStorage.setItem("peru-name",v);syncCharacter();close("characterOverlay");
  };
  nameInput.addEventListener("keydown",e=>{if(e.key==="Enter")$("#saveName").click()});
  $$("[data-close]").forEach(b=>b.onclick=()=>close(b.dataset.close));
  $$(".overlay").forEach(o=>o.addEventListener("mousedown",e=>{if(e.target===o)close(o.id)}));
  $("#bagButton").onclick=()=>open("bagOverlay");

  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  function segment(a,b){
    return new Promise(resolve=>{
      const dx=b[0]-a.x,dy=b[1]-a.y,d=Math.hypot(dx,dy),duration=Math.max(1050,d*285),start=performance.now();
      const row=Math.abs(dx)>Math.abs(dy)?(dx<0?1:3):(dy<0?2:0);walker.classList.add("walking");
      function tick(now){
        const p=Math.min(1,(now-start)/duration),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
        position={x:a.x+dx*e,y:a.y+dy*e};walker.style.left=position.x+"%";walker.style.top=position.y+"%";
        const frame=Math.floor((now-start)/310)%4;
        walkerSprite.style.backgroundPosition=`${frame*100/3}% ${row*100/3}%`;
        p<1?requestAnimationFrame(tick):resolve();
      } requestAnimationFrame(tick);
    });
  }
  function roadPath(from,to){
    const queue=[from],prev={[from]:null};
    while(queue.length){
      const n=queue.shift();if(n===to)break;
      road[n].to.forEach(next=>{if(!(next in prev)){prev[next]=n;queue.push(next)}});
    }
    const names=[];for(let n=to;n;n=prev[n])names.unshift(n);
    return names.slice(1).map(n=>road[n].p);
  }
  async function travel(key,t){
    if(walking)return;walking=true;$("#routeMessage").textContent=`${playerName} läuft nach ${t.label} …`;
    let from={...position};for(const point of roadPath(currentNode,t.node)){await segment(from,point);from={x:point[0],y:point[1]}}
    currentNode=t.node;localStorage.setItem("peru-road-node",currentNode);
    walker.classList.remove("walking");walking=false;$("#routeMessage").textContent=`${t.label} erreicht!`;await pause(350);
    location.href=key+".html";
  }

  const canvas=$("#gameCanvas"),ctx=canvas.getContext("2d");
  ctx.imageSmoothingEnabled=false;
  const plantArt={};
  [
    ["cacao","assets/cacao-stages-v2.png"],
    ["orchid","assets/orchid-stages-v2.png"],
    ["waterlily","assets/waterlily-stages-v2.png"]
  ].forEach(([key,src])=>{const img=new Image();img.src=src;plantArt[key]=img});
  let pet={
    type:localStorage.getItem("peru-pet")||null,x:54,y:74,vx:.075,tail:0,hunger:76,joy:82,action:"idle",until:0,actionStart:0,
    care:+(localStorage.getItem("peru-pet-care")||0),
    adultFeeds:+(localStorage.getItem("peru-pet-adult-feeds")||0),
    chestUntil:0,ambient:"stare",ambientStarted:0
  };
  let petPending=null;
  let petName=localStorage.getItem("peru-pet-name")||"";
  const savedPlant=localStorage.getItem("peru-plant");
  let plant={
    type:savedPlant||null,
    stage:savedPlant?+(localStorage.getItem("peru-plant-stage")||1):0,
    action:"idle",actionStart:0,until:0,t:0,water:[],harvestBurst:[]
  };
  function clearLCD(){
    ctx.fillStyle="#aec391";ctx.fillRect(0,0,240,152);ctx.fillStyle="#92aa7b";
    for(let x=4;x<240;x+=12)for(let y=6;y<152;y+=12)if((x+y)%24===0)ctx.fillRect(x,y,1,1);
    ctx.strokeStyle="#314635";ctx.lineWidth=2;ctx.strokeRect(1,1,238,150);
  }
  function px(x,y,w,h,c="#24352b"){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h)}
  const ambientStates={
    dolphin:["sleep","play","stare"],
    sloth:["sleep","eat","climb"],
    capybara:["stare","bath","sleep"]
  };
  function chooseAmbient(type){
    const list=ambientStates[type]||["stare"];
    pet.ambient=list[Math.floor(Math.random()*list.length)];
    pet.ambientStarted=performance.now();
  }
  function drawDolphin(x,y,flip,phase,pose="stare"){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip){ctx.scale(-1,1)}
    px(-28,-5,8,10,"#a94280");px(-22,-10,33,21,"#ef79b8");px(-17,-7,29,14,"#f7a7cf");
    px(8,-7,16,14,"#d85b9f");px(20,-4,11,8,"#f28fc3");px(-8,-17,10,9,"#cf4f95");
    px(-7,9,9,8,"#c7438b");px(-27,-10,8,6,"#ec83ba");
    px(-35,-15+(phase?3:0),9,6,"#bd3f84");px(-35,5-(phase?3:0),9,6,"#bd3f84");
    if(pose==="sleep"){px(13,-3,7,2,"#77265e");px(25,1,5,2,"#9c306f")}
    else{px(14,-5,3,3,"#172136");px(15,-6,1,1,"#fff");px(24,1,5,2,"#9c306f")}
    ctx.restore();
  }
  function drawCapybara(x,y,flip,phase,pose="stare"){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);
    px(-25,-13,39,24,"#8a5432");px(-20,-9,34,18,"#b97849");px(10,-20,20,21,"#a3663e");
    px(22,-25,8,8,"#6d3f28");px(16,-26,7,8,"#805034");px(13,-17,15,13,"#c48a59");
    px(-19,10,7,12,"#6b422a");px(4,10,7,12,"#6b422a");px(20,-14,3,3,"#1d1714");px(27,-8,4,3,"#3b2118");
    if(pose==="sleep"){px(18,-13,8,2,"#3f2519");px(27,-7,4,2,"#3b2118")}
    if(phase){px(-18,18,9,4,"#54321f");px(3,17,9,4,"#54321f")}else{px(-20,19,9,4,"#54321f");px(5,19,9,4,"#54321f")}ctx.restore();
  }
  function drawSloth(x,y,flip,phase,pose="climb"){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);
    px(-12,-19,24,34,"#695747");px(-8,-15,17,26,"#8a7661");px(-11,-24,24,19,"#9a856d");
    px(-7,-21,15,13,"#d0b99c");px(-5,-19,4,4,"#33291f");px(5,-19,4,4,"#33291f");
    if(pose==="sleep"){px(-6,-18,5,2,"#3b3027");px(4,-18,5,2,"#3b3027")}
    px(-18,-12,8,29,phase?"#5a493b":"#776452");px(11,-11,8,29,phase?"#776452":"#5a493b");
    px(-15,13,7,16,"#4b3d32");px(9,13,7,16,"#4b3d32");
    if(pose==="eat"){px(15,-18,12,8,"#61ad4b");px(20,-23,8,15,"#83c85b")}
    ctx.restore();
  }
  function drawPetSelection(){
    ctx.fillStyle="#fff1ae";ctx.font='bold 11px "Courier New"';ctx.textAlign="center";
    ctx.fillText("WÄHLE DEINEN AMAZONAS-FREUND",120,18);
    const cards=[["dolphin",44,"FLUSSDELFIN"],["capybara",120,"CAPYBARA"],["sloth",196,"FAULTIER"]];
    cards.forEach(([type,x,label])=>{
      ctx.fillStyle=type==="dolphin"?"#4aa6c7":type==="capybara"?"#89b95a":"#427b42";ctx.fillRect(x-34,29,68,94);
      ctx.strokeStyle="#ffe36a";ctx.lineWidth=2;ctx.strokeRect(x-34,29,68,94);
      if(type==="dolphin")drawDolphin(x,72,false,false);
      else if(type==="capybara")drawCapybara(x,77,false,false);
      else{branch(x-31,85,x+31,85,5,"#5e351a");drawSloth(x,70,false,false)}
      ctx.fillStyle="#18130e";ctx.fillRect(x-32,104,64,17);ctx.fillStyle="#fff0ac";ctx.font='bold 8px "Courier New"';ctx.fillText(label,x,115);
    });
  }
  function drawPetNaming(){
    if(petPending==="dolphin"){drawRiverScene(0);drawDolphin(120,74,false,false)}
    else if(petPending==="capybara"){drawCapyScene(0);drawCapybara(120,88,false,false)}
    else{drawSlothScene(0);drawSloth(120,72,false,false)}
    ctx.fillStyle="#17110cdd";ctx.fillRect(24,8,192,22);ctx.fillStyle="#fff1ae";ctx.font='bold 10px "Courier New"';ctx.textAlign="center";
    ctx.fillText("GIB DEINEM FREUND EINEN NAMEN",120,22);
    ctx.fillStyle="#17110cdd";ctx.fillRect(48,112,144,26);ctx.fillStyle="#fff0ae";ctx.font='bold 9px "Courier New"';
    ctx.fillText("NAME UNTEN EINGEBEN",120,128);
  }
  function drawRiverScene(now){
    ctx.fillStyle="#3c9fc5";ctx.fillRect(0,0,240,127);ctx.fillStyle="#77cee0";ctx.fillRect(0,0,240,18);
    for(let y=22;y<126;y+=18){ctx.fillStyle=y%36?"#2785b5":"#55b7d3";for(let x=(y%36?4:13);x<240;x+=31)ctx.fillRect(x,y,18,2)}
    ctx.fillStyle="#d8bd67";ctx.fillRect(0,124,240,28);for(let x=8;x<240;x+=22)px(x,125+(x%3),8,4,"#9a7841");
    for(let x=9;x<235;x+=37){branch(x,133,x+Math.sin(now/500+x)*4,107,3,"#237549");leaf(x+2,105,.55,"#55b963")}
    for(let i=0;i<7;i++){const bx=(i*41+Math.floor(now/38))%242,by=112-(i*19)%83;ctx.strokeStyle="#d8f7ff";ctx.strokeRect(bx,by,2+(i%2)*2,2+(i%2)*2)}
  }
  function drawCapyScene(now){
    ctx.fillStyle="#8ed4df";ctx.fillRect(0,76,240,76);ctx.fillStyle="#53aebd";for(let y=83;y<150;y+=13)for(let x=y%2?0:12;x<240;x+=32)px(x,y,18,2);
    ctx.fillStyle="#91b94e";ctx.fillRect(0,0,240,82);ctx.fillStyle="#5d8b37";ctx.fillRect(0,62,240,20);
    for(let x=3;x<240;x+=15){branch(x,75,x+(x%2?3:-3),52-(x%17),2,"#3c6d2f")}
    ctx.fillStyle="#c9a365";ctx.fillRect(0,76,70,9);ctx.fillRect(188,74,52,11);
  }
  function drawSlothScene(now){
    ctx.fillStyle="#64a96a";ctx.fillRect(0,0,240,152);ctx.fillStyle="#2d7545";
    for(let y=6;y<150;y+=24)for(let x=(y%48?8:24);x<240;x+=42){px(x,y,24,9,"#2f7e43");px(x+7,y-7,12,21,"#50a553")}
    px(22,0,28,152,"#6f4424");px(29,0,8,152,"#a36a35");branch(33,66,220,86,13,"#70411f");branch(35,108,180,117,10,"#5a351d");
    for(let x=65;x<225;x+=31)leaf(x,78+Math.sin(x)*4,.72,"#74c35d");
  }
  function petFrame(now){
    if(activeGame!=="pet")return;clearLCD();
    if(!pet.type){
      if(petPending)drawPetNaming();else drawPetSelection();
      $("#lcdStats").innerHTML=petPending?"<span>DEIN TIER IST GEWÄHLT</span><span>JETZT NAMEN GEBEN</span>":"<span>ERST FREUND WÄHLEN</span><span>3 LEBENSRÄUME</span>";
      raf=requestAnimationFrame(petFrame);return
    }
    if(pet.type==="dolphin")drawRiverScene(now);else if(pet.type==="capybara")drawCapyScene(now);else drawSlothScene(now);
    if(now>pet.until)pet.action="idle";
    const natural=pet.action==="idle";
    const activePose=natural?pet.ambient:pet.action;
    const shouldMove=
      (pet.type==="dolphin"&&activePose==="play")||
      (pet.type==="sloth"&&activePose==="climb")||
      (pet.type==="capybara"&&activePose==="bath");
    if(shouldMove){
      const speed=pet.type==="sloth"?.018:pet.type==="capybara"?.032:.055;
      pet.x+=Math.sign(pet.vx||1)*speed;
      if(pet.x>190||pet.x<54)pet.vx*=-1;
    }
    pet.tail=(pet.tail+.055)%24;
    let yy=76+Math.sin(now/1100)*1.6;
    if(pet.type==="dolphin"&&activePose==="play")yy-=Math.abs(Math.sin(now/420))*7;
    const petStage=pet.care<6?1:pet.care<16?2:3;
    const scale=[0,.7,.86,1][petStage];
    ctx.save();ctx.translate(pet.x,0);ctx.scale(scale,scale);ctx.translate(-pet.x,(1-scale)*30);
    if(pet.type==="dolphin"){
      const sy=activePose==="sleep"?107:yy;
      drawDolphin(pet.x,sy,pet.vx<0,pet.tail>12,activePose);
      if(activePose==="sleep"){ctx.fillStyle="#e8f8ff";ctx.font='bold 9px "Courier New"';ctx.fillText("z z z",pet.x+22,sy-19)}
    }else if(pet.type==="capybara"){
      const cy=activePose==="bath"?111:activePose==="sleep"?102:93;
      drawCapybara(pet.x,cy,pet.vx<0,pet.tail>12,activePose);
      if(activePose==="bath"){px(pet.x-29,111,61,4,"#8edce5");px(pet.x-23,116,52,2,"#d5f5ed")}
      if(activePose==="sleep"){ctx.fillStyle="#fff0be";ctx.font='bold 9px "Courier New"';ctx.fillText("z z z",pet.x+23,cy-27)}
    }else{
      const climbY=activePose==="climb"?68+Math.sin((now-pet.ambientStarted)/1800)*13:74;
      drawSloth(pet.x,climbY,pet.vx<0,pet.tail>12,activePose);
      if(activePose==="sleep"){ctx.fillStyle="#fff0be";ctx.font='bold 9px "Courier New"';ctx.fillText("z z z",pet.x+22,climbY-27)}
    }
    ctx.restore();
    if(pet.action==="feed"){const foodX=120+(pet.x-120)*.55;for(let i=0;i<4;i++)px(foodX+i*5,33+i*12,pet.type==="dolphin"?5:7,pet.type==="dolphin"?3:5,pet.type==="dolphin"?"#f1d57d":pet.type==="capybara"?"#83c74c":"#6cbd57")}
    if(pet.action==="pet")for(let i=0;i<6;i++){const a=i*1.05+now/180;px(pet.x+Math.cos(a)*32,55+Math.sin(a)*18,4,4,"#ffe36c")}
    if(now<pet.chestUntil){px(101,63,38,29,"#7b3e18");px(105,67,30,21,"#d49428");px(101,58,38,10,"#f0bb3e");px(117,61,7,22,"#fff0a0");ctx.fillStyle="#fff3a4";ctx.font='bold 12px "Courier New"';ctx.textAlign="center";ctx.fillText("+100",120,52)}
    $("#lcdStats").innerHTML=`<span>${["","KLEIN","JUNG","ERWACHSEN"][petStage]} · HUNGER <i class="lcd-meter"><i style="width:${pet.hunger}%"></i></i></span><span>FREUDE <i class="lcd-meter"><i style="width:${pet.joy}%"></i></i></span>`;
    raf=requestAnimationFrame(petFrame);
  }
  function branch(x1,y1,x2,y2,w=3,c="#5d3a20"){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
  function leaf(x,y,s=1,c="#3f963e"){px(x-7*s,y-3*s,14*s,7*s,c);px(x-4*s,y-6*s,8*s,13*s,c);px(x-8*s,y,16*s,3*s,"#72be4d")}
  function cacaoPod(x,y,flip=false){px(x,y,6,13,"#8f3d29");px(x+(flip?0:1),y-2,4,17,"#e47f2e");px(x+2,y+2,1,9,"#ffd060")}
  function drawCacao(stage){
    const h=[5,13,24,38,53,66,72,76][stage-1], base=122, top=base-h;
    branch(120,base,120,top,stage<3?3:6);
    if(stage>=2) leaf(120,top,stage<4?.65:1);
    if(stage>=3){branch(120,103,102,92,3);branch(120,100,140,89,3);leaf(100,90,.72);leaf(142,87,.72)}
    if(stage>=4){
      branch(120,83,91,67,4);branch(120,78,151,62,4);branch(120,68,101,48,3);branch(120,65,141,45,3);
      [[85,69],[92,60],[99,51],[108,44],[119,40],[130,43],[141,48],[151,58],[158,69],[145,73],[132,66],[118,59],[105,67],[96,76],[118,77],[139,79]].forEach(p=>leaf(p[0],p[1],1));
    }
    if(stage>=5){[[113,78],[125,91],[107,96]].forEach(p=>{px(p[0],p[1],3,3);px(p[0]+3,p[1]-2,2,2)})}
    if(stage>=6){cacaoPod(108,80);cacaoPod(125,88,true)}
    if(stage>=7){cacaoPod(102,70);cacaoPod(132,66);cacaoPod(116,96,true)}
    if(stage>=8){cacaoPod(96,65);cacaoPod(109,77);cacaoPod(125,90,true);cacaoPod(138,68);cacaoPod(116,56,true)}
  }
  function orchidFlower(x,y,s=1){
    px(x-7*s,y-3*s,6*s,7*s,"#d779cc");px(x+2*s,y-3*s,6*s,7*s,"#ef9fe0");px(x-3*s,y-8*s,7*s,7*s,"#f5b9e7");
    px(x-3*s,y+2*s,7*s,6*s,"#c45ab8");px(x-1*s,y-1*s,3*s,3*s,"#ffe06c");
  }
  function drawOrchid(stage){
    const base=123;
    if(stage===1){px(117,116,6,7);leaf(120,116,.45);return}
    const leaves=Math.min(5,stage);for(let i=0;i<leaves;i++){const side=i%2?-1:1;ctx.save();ctx.translate(120,base-i*2);ctx.rotate(side*(.35+i*.08));leaf(side*9,-8,.55+i*.05);ctx.restore()}
    if(stage>=3)branch(120,112,120,82-(stage-3)*7,2);
    if(stage>=4)branch(120,95,105,79,2);
    if(stage>=5)branch(120,86,138,69,2);
    if(stage===5){px(102,75,5,7);px(136,65,5,7)}
    if(stage>=6){orchidFlower(103,75,.65);orchidFlower(137,64,.65)}
    if(stage>=7){orchidFlower(119,58,.8);orchidFlower(98,88,.7)}
    if(stage>=8){orchidFlower(142,80,.8);orchidFlower(110,47,.85)}
  }
  function drawWaterlily(stage){
    const y=112;
    for(let i=0;i<Math.min(stage+1,7);i++){const x=85+i*12;px(x,y+(i%2)*3,17,4,"#257b46");px(x+4,y-3+(i%2)*3,9,9,"#49a857")}
    if(stage>=3)branch(120,112,120,82,2);
    if(stage>=4){for(let i=0;i<Math.min(stage-3,5);i++){const a=i*Math.PI*2/5;px(117+Math.cos(a)*10,77+Math.sin(a)*7,7,7)}}
    if(stage>=6)orchidFlower(120,77,stage===8?1.25:.9);
    if(stage>=8){orchidFlower(94,94,.65);orchidFlower(147,95,.65)}
  }
  function drawPlantArtwork(type,stage,cx=120,bottom=124,maxW=158,maxH=105){
    const img=plantArt[type];
    if(!img||!img.complete||!img.naturalWidth)return false;
    const sw=img.naturalWidth/8,sh=img.naturalHeight,sx=(Math.max(1,Math.min(8,stage))-1)*sw;
    const scale=Math.min(maxW/sw,maxH/sh),dw=sw*scale,dh=sh*scale;
    ctx.drawImage(img,sx,0,sw,sh,Math.round(cx-dw/2),Math.round(bottom-dh),Math.round(dw),Math.round(dh));
    return true;
  }
  function drawWateringCan(now){
    const p=Math.min(1,(now-plant.actionStart)/1050);
    const x=182-p*48,y=31+Math.sin(p*Math.PI)*4;
    ctx.save();ctx.translate(x,y);ctx.rotate(-.34);
    px(-15,-8,25,19,"#405d54");px(-11,-5,17,13,"#6f8d78");
    px(9,-5,20,6,"#405d54");px(25,-3,7,4,"#6f8d78");
    ctx.strokeStyle="#405d54";ctx.lineWidth=4;ctx.beginPath();ctx.arc(-5,-8,11,Math.PI,0);ctx.stroke();
    ctx.restore();
    for(let i=0;i<7;i++){
      const dropP=(p*1.7-i*.11)%1;
      if(dropP>0)px(158+i*3,49+dropP*66,2,5,"#477a91");
    }
  }
  function drawFertilizer(now){
    const p=Math.min(1,(now-plant.actionStart)/1050);
    const x=70+p*34,y=82-Math.sin(p*Math.PI)*18;
    ctx.save();ctx.translate(x,y);ctx.rotate(.2);
    px(-11,-14,22,27,"#73502a");px(-8,-10,16,18,"#d5b34c");
    px(-5,-5,10,3,"#48612f");px(-2,-9,4,12,"#48612f");
    ctx.restore();
    for(let i=0;i<9;i++){
      const a=i*.72+now/125,r=23+(i%3)*8;
      const sx=120+Math.cos(a)*r,sy=79+Math.sin(a)*r*.72;
      px(sx,sy,3,3,i%2?"#fff1a0":"#f4cf4d");
      if(i%3===0){px(sx-2,sy+1,7,1,"#fff1a0");px(sx+1,sy-2,1,7,"#fff1a0")}
    }
  }
  function drawHarvest(now){
    const p=Math.min(1,(now-plant.actionStart)/900);
    for(let i=0;i<18;i++){
      const a=i*.78,r=p*(18+(i%5)*9);
      px(120+Math.cos(a)*r,79+Math.sin(a)*r*.75,3+(i%2),3+(i%2),i%3?"#ffd85c":"#fff4bd");
    }
  }
  function drawPlantSelection(){
    ctx.fillStyle="#fff1bd";ctx.font='bold 11px "Trebuchet MS"';ctx.textAlign="center";
    ctx.fillText("WÄHLE, WAS DU PFLANZEN MÖCHTEST",120,20);
    [[48,"KAKAO"],[120,"ORCHIDEE"],[192,"SEEROSE"]].forEach(([x,label],i)=>{
      ctx.fillStyle=i===0?"#284a2d":i===1?"#3f3150":"#174b61";ctx.fillRect(x-32,29,64,98);
      ctx.strokeStyle="#e5b94c";ctx.lineWidth=2;ctx.strokeRect(x-32,29,64,98);
      const type=["cacao","orchid","waterlily"][i];
      if(!drawPlantArtwork(type,8,x,108,57,72)){
        ctx.save();ctx.translate(x-120,-12);
        if(i===0)drawCacao(8);else if(i===1)drawOrchid(8);else drawWaterlily(8);
        ctx.restore();
      }
      ctx.fillStyle="#130c07";ctx.fillRect(x-30,108,60,17);ctx.fillStyle="#fff0b2";ctx.font='bold 8px "Trebuchet MS"';ctx.fillText(label,x,120);
    });
  }
  function gardenFrame(now){
    if(activeGame!=="garden")return;clearLCD();plant.t++;
    if(!plant.type){
      drawPlantSelection();
      $("#lcdStats").innerHTML="<span>NEUES BEET</span><span>ERST PFLANZE WÄHLEN</span>";
      raf=requestAnimationFrame(gardenFrame);return;
    }
    px(0,124,240,28,"#815331");for(let x=5;x<240;x+=15)px(x,129+(x%30),9,3,x%2?"#a87442":"#52351f");
    const sway=plant.action==="water"?Math.sin(now/75)*4:Math.sin(now/650)*1.3,base=122;
    ctx.save();ctx.translate(120,base);ctx.rotate(sway*Math.PI/180);ctx.translate(-120,-base);
    if(!drawPlantArtwork(plant.type,plant.stage,120,124,166,108)){
      if(plant.type==="cacao")drawCacao(plant.stage);
      else if(plant.type==="orchid")drawOrchid(plant.stage);
      else drawWaterlily(plant.stage);
    }
    ctx.restore();
    plant.water=plant.water.filter(d=>{d.y+=2;px(d.x,d.y,2,4);return d.y<124});
    if(plant.action==="water")drawWateringCan(now);
    if(plant.action==="fertilize")drawFertilizer(now);
    if(plant.action==="harvest")drawHarvest(now);
    $("#lcdStats").innerHTML=`<span>WACHSTUM <i class="lcd-meter"><i style="width:${plant.stage/8*100}%"></i></i></span><span>PFLEGE ${plant.action==="idle"?"OK":"♥"}</span>`;
    raf=requestAnimationFrame(gardenFrame);
  }
  function action(kind){
    const now=performance.now();
    if(activeGame==="pet"){
      if(!pet.type)return;
      pet.action=kind;pet.actionStart=now;pet.until=now+1100;
      if(kind==="feed")pet.hunger=Math.min(100,pet.hunger+12);else pet.joy=Math.min(100,pet.joy+10);
      if(kind==="feed"||kind==="play"){
        rewardXP(20);pet.care++;
        if(kind==="feed"&&pet.care>=16){
          pet.adultFeeds++;
          if(pet.adultFeeds%30===0){pet.chestUntil=now+2100;rewardCoins(100)}
        }
        localStorage.setItem("peru-pet-care",String(pet.care));
        localStorage.setItem("peru-pet-adult-feeds",String(pet.adultFeeds));
      }
    }
    else{
      if(!plant.type)return;
      plant.action=kind;plant.actionStart=now;plant.until=now+1100;
      if(kind==="water"){
        for(let i=0;i<18;i++)plant.water.push({x:148+Math.random()*28,y:45+Math.random()*18});
        if(plant.stage<8)plant.stage++;
        rewardXP(20);
      }
      if(kind==="fertilize"){plant.stage=Math.min(8,plant.stage+1);rewardXP(20)}
      if(kind==="harvest"&&plant.stage===8){
        setTimeout(()=>{
          localStorage.removeItem("peru-plant");localStorage.removeItem("peru-plant-stage");
          plant.type=null;plant.stage=0;plant.action="idle";renderGardenControls();
          $("#gameTitle").textContent="WÄHLE DEINE PFLANZE";
          $("#consoleHint").textContent="Nach der Ernte kannst du eine neue Pflanze setzen.";
        },850);
      }
      localStorage.setItem("peru-plant-stage",String(plant.stage));
      setTimeout(()=>{if(plant.action===kind)plant.action="idle"},1100);
      renderGardenControls();
    }
  }
  const plantNames={cacao:"MEIN KAKAOBÄUMCHEN",orchid:"MEINE ORCHIDEE",waterlily:"MEINE AMAZONAS-SEEROSE"};
  const petNames={dolphin:"ROSA FLUSSDELFIN",capybara:"CAPYBARA",sloth:"FAULTIER"};
  function choosePet(type){
    if(pet.type)return;
    petPending=type;$("#gameTitle").textContent=`${petNames[type]} · NAME`;
    renderPetControls();$("#consoleHint").textContent="Gib deinem neuen Freund einen eigenen Namen.";
  }
  function finishPetChoice(){
    const input=$("#petNameInput"),value=input&&input.value.trim();
    if(!value){if(input)input.focus();return}
    pet.type=petPending;petPending=null;petName=value;pet.x=pet.type==="sloth"?105:76;pet.vx=.075;pet.care=0;pet.adultFeeds=0;chooseAmbient(pet.type);
    localStorage.setItem("peru-pet",pet.type);localStorage.setItem("peru-pet-name",petName);
    localStorage.setItem("peru-pet-care","0");localStorage.setItem("peru-pet-adult-feeds","0");
    $("#gameTitle").textContent=`${petName} · ${petNames[pet.type]}`;renderPetControls();
    $("#consoleHint").textContent=`${petName} lebt jetzt in einem eigenen Amazonas-Lebensraum.`;
  }
  function renderPetControls(){
    if(!pet.type&&!petPending){
      $("#gameControls").innerHTML='<button class="pet-choice dolphin-choice" data-pet="dolphin"><i aria-hidden="true"></i><span>FLUSSDELFIN</span></button><button class="pet-choice capy-choice" data-pet="capybara"><i aria-hidden="true"></i><span>CAPYBARA</span></button><button class="pet-choice sloth-choice" data-pet="sloth"><i aria-hidden="true"></i><span>FAULTIER</span></button>';
    }else if(!pet.type&&petPending){
      $("#gameControls").innerHTML='<div class="pet-name-editor"><label for="petNameInput">Wie heißt dein Tier?</label><div><input id="petNameInput" maxlength="16" autocomplete="off" placeholder="Name eingeben"><button id="savePetName">ABENTEUER STARTEN</button></div></div>';
      $("#savePetName").onclick=finishPetChoice;$("#petNameInput").addEventListener("keydown",e=>{if(e.key==="Enter")finishPetChoice()});setTimeout(()=>$("#petNameInput").focus(),0);
    }else{
      const food=pet.type==="dolphin"?"FISCH":pet.type==="capybara"?"WASSERGRAS":"BLÄTTER";
      $("#gameControls").innerHTML=`<button class="pet-tool food-tool" data-action="feed"><i></i><span>${food} · +20 XP</span></button><button class="pet-tool play-tool" data-action="play"><i></i><span>SPIELEN · +20 XP</span></button><button class="pet-tool heart-tool" data-action="pet"><i></i><span>STREICHELN</span></button><button class="pet-tool release-tool" data-release="1"><i></i><span>FREILASSEN</span></button>`;
    }
    $$("#gameControls button[data-pet],#gameControls button[data-action],#gameControls button[data-release]").forEach(b=>b.onclick=()=>{
      if(b.dataset.pet)choosePet(b.dataset.pet);
      else if(b.dataset.release)releasePet();
      else action(b.dataset.action);
    });
  }
  function releasePet(){
    if(!pet.type||!confirm("Diesen Freund in seinen Lebensraum zurückbringen? Danach kannst du ein neues Tier wählen."))return;
    pet.type=null;pet.care=0;pet.adultFeeds=0;pet.action="idle";
    petName="";["peru-pet","peru-pet-name","peru-pet-care","peru-pet-adult-feeds"].forEach(k=>localStorage.removeItem(k));
    $("#gameTitle").textContent="WÄHLE DEINEN FREUND";renderPetControls();
    $("#consoleHint").textContent="Dein Freund ist frei. Jetzt kannst du ein neues Tier aufnehmen.";
  }
  function choosePlant(type){
    if(plant.type)return;
    plant.type=type;plant.stage=1;plant.action="idle";
    localStorage.setItem("peru-plant",type);localStorage.setItem("peru-plant-stage","1");
    $("#gameTitle").textContent=plantNames[type];renderGardenControls();
    $("#consoleHint").textContent="Diese Pflanze bleibt bis zur Ernte in deinem Beet.";
  }
  function renderGardenControls(){
    if(!plant.type){
      $("#gameControls").innerHTML='<button class="plant-choice cacao-choice" data-plant="cacao"><i aria-hidden="true"></i><span>KAKAO</span></button><button class="plant-choice orchid-choice" data-plant="orchid"><i aria-hidden="true"></i><span>ORCHIDEE</span></button><button class="plant-choice lily-choice" data-plant="waterlily"><i aria-hidden="true"></i><span>SEEROSE</span></button>';
    }else{
      $("#gameControls").innerHTML='<button class="tool-button water-tool" data-action="water" aria-label="Mit der Gießkanne gießen"><i></i><span>GIESSKANNE</span></button><button class="tool-button fertilizer-tool" data-action="fertilize" aria-label="Pflanze düngen"><i></i><span>DÜNGEN</span></button>'+(plant.stage===8?'<button class="tool-button harvest-tool" data-action="harvest" aria-label="Reife Pflanze ernten"><i></i><span>ERNTEN</span></button>':'');
    }
    $$("#gameControls button").forEach(b=>b.onclick=()=>b.dataset.plant?choosePlant(b.dataset.plant):action(b.dataset.action));
  }
  function startGame(type){
    cancelAnimationFrame(raf);activeGame=type;open("gameOverlay");$("#gameDay").textContent=type==="pet"?"FREUND 01":"TAG 09 / 30";
    if(type==="pet"){
      if(pet.type)chooseAmbient(pet.type);
      $("#gameTitle").textContent=pet.type?`${petName} · ${petNames[pet.type]}`:"WÄHLE DEINEN FREUND";
      renderPetControls();
      $("#consoleHint").textContent=pet.type?"Füttere, spiele und kümmere dich um deinen Freund.":"Wähle zuerst ein Tier – danach beginnt seine Pflege.";
      requestAnimationFrame(petFrame);
    }else{
      $("#gameTitle").textContent=plant.type?plantNames[plant.type]:"WÄHLE DEINE PFLANZE";
      renderGardenControls();
      $("#consoleHint").textContent=plant.type?"Pflege sie bis zur Reife – erst nach der Ernte kannst du neu wählen.":"Wähle zuerst eine Pflanze für dein Beet.";
      requestAnimationFrame(gardenFrame);
    }
    $$("#gameControls button").forEach(b=>b.onclick=()=>{
      if(b.dataset.pet)choosePet(b.dataset.pet);
      else if(b.dataset.plant)choosePlant(b.dataset.plant);
      else if(b.dataset.release)releasePet();
      else action(b.dataset.action);
    });
  }
  canvas.onclick=()=>{if(activeGame==="pet")action("pet")};
  $("#dolphinHotspot").onclick=()=>startGame("pet");$("#treeHotspot").onclick=()=>startGame("garden");
  syncCharacter();syncRewards();
  walker.style.left=position.x+"%";walker.style.top=position.y+"%";
})();
