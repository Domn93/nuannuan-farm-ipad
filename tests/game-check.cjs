// 从项目根目录运行：node tests/game-check.cjs
// 这些检查模拟 DOM、Canvas 和资源加载，验证共享脚本的玩法与状态边界。
// 它们不能代替内置浏览器里的贴图、声音听感和真实帧率验收。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^?"]+)(?:\?[^\"]*)?"/g)]
  .map((match) => fs.readFileSync(path.join(root, match[1]), 'utf8'));
const source = scripts.join('\n');
new vm.Script(source); // 浏览器中的经典脚本共用作用域，不能产生重复声明。

function makeContext() {
  const elements = new Map();
  const events = [];
  const drawing = new Proxy({
    measureText: (text) => ({ width: text.length * 15 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} })
  }, {
    get(target, key) {
      return target[key] || ((...args) => {
        if (['drawImage', 'moveTo', 'lineTo', 'rect'].includes(key)) events.push([key, ...args]);
      });
    }
  });
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      dataset: {}, style: {}, hidden: true, open: false,
      classList: { toggle() {} },
      getContext: () => drawing,
      listeners: {},
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute() {}, focus() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1536, height: 1024 }),
      showModal() { this.open = true; },
      close() { this.open = false; }
    });
    return elements.get(selector);
  }
  const context = vm.createContext({
    console, assert, events,
    document: {
      hidden: false, querySelector: element, querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => ({ getContext: () => ({
        drawImage() {}, putImageData() {},
        getImageData(x, y, width, height) {
          return { data: new Uint8ClampedArray(width * height * 4) };
        }
      }) })
    },
    window: {
      listeners: {},
      addEventListener(type, callback) {
        const previous = this.listeners[type];
        this.listeners[type] = (event) => { previous?.(event); callback(event); };
      }
    },
    requestAnimationFrame() {},
    Image: class {
      set src(value) {
        this.url = value;
        const png = fs.readFileSync(path.join(root, value));
        this.naturalWidth = png.readUInt32BE(16);
        this.naturalHeight = png.readUInt32BE(20);
        this.complete = true;
      }
      // 不启动真实动画循环；每个场景由测试显式推进。
      decode() { return new Promise(() => {}); }
    }
  });
  vm.runInContext(source, context);
  vm.runInContext(`
    ready=true; clock=100; busyUntil=0; sounds=false; soundOn=false;
    farmTime.hour=10; farmTime.day=0;
    farmVoices.nextSpeech=Infinity; farmVoices.nextCall=Infinity;
  `, context);
  return context;
}

function check(name, body) {
  vm.runInContext(body, makeContext(), { filename: name });
  console.log('PASS ' + name);
}

check('11 张地图的入口、互动路径和逐帧运行', `
  for (const map of ['farm','house','junction','forest','city','friends','barn',
    'hospital','petHospital','bakery','villageHouse']) {
    changeScene(map);
    penGate.open=true; balconyDoor.open=true; rebuildGrid();
    assert.ok(canWalk(player.x,player.y), map+' 出生点');
    for (const [key,point] of Object.entries(places)) {
      // 动物站位随时移动；它们的接近/碰撞由专项测试覆盖。
      if (['dog','cat','horse'].includes(key) || point.x<0) continue;
      assert.ok(findPath(point).length, map+' 的 '+key+' 可达');
    }
    for (let frame=0;frame<120;frame++) {
      update(1/60); draw(); events.length=0;
    }
  }
`);

check('医生和兽医的三日疗程与守卫', `
  changeScene('hospital');
  nuannuanHealth.cold=true; nuannuanHealth.injured=true;
  interactBuilding('doctor'); clock+=4.1; updateBuildingHealth(0);
  assert.ok(nuannuanHealth.course);
  assert.equal(nuannuanHealth.cold,true);
  function dose(id,index) {
    busyUntil=0; takeGameMedicine(id,index); clock+=2;
  }
  dose('nuannuan',0); dose('nuannuan',0);
  assert.equal(nuannuanHealth.course.taken.length,1);
  dose('nuannuan',1);
  assert.equal(nuannuanHealth.course.completedDays,1);
  interactBuilding('doctor'); clock+=4.1; updateBuildingHealth(0);
  assert.equal(nuannuanHealth.course.completedDays,1,'复诊不重置');
  farmTime.day=4; dose('nuannuan',0); dose('nuannuan',1);
  assert.equal(nuannuanHealth.course.completedDays,2,'跳过日期不算用药');
  dose('nuannuan',1);
  assert.equal(nuannuanHealth.course.completedDays,2);
  farmTime.day=5; dose('nuannuan',0); dose('nuannuan',1);
  assert.equal(nuannuanHealth.cold,false);
  assert.equal(nuannuanHealth.injured,false);
  assert.equal(nuannuanHealth.course,null);

  changeScene('petHospital'); dog.scene='petHospital';
  dog.x=825; dog.y=535; dog.sleeping=false; petHealth.dog.sick=true;
  petVetVisit={pet:dog,target:{x:825,y:535},phase:'checking',started:clock-5};
  updatePetHealth(0);
  assert.equal(petHealth.dog.sick,true);
  player.x=1100; player.y=800; dose('dog',0);
  assert.equal(petHealth.dog.course.taken.length,0,'远处不能喂药');
  player.x=850; player.y=560; dog.sleeping=true; dose('dog',0);
  assert.equal(petHealth.dog.course.taken.length,0,'睡着不能喂药');
  dog.sleeping=false;
  for (let day=6;day<9;day++) {
    farmTime.day=day; dose('dog',0); dose('dog',1);
  }
  assert.equal(petHealth.dog.sick,false);
  assert.equal(petHealth.dog.course,null);
  nuannuanHealth.cold=true; prescribeMedicine(nuannuanHealth);
  sleepSession={}; dose('nuannuan',0); sleepSession=null;
  dose('nuannuan',9);
  assert.equal(nuannuanHealth.course.taken.length,0);
`);

check('冰箱数量守恒、独立批次保鲜和烹饪退款', `
  openFridge(); assert.equal(fridge.open,false);
  changeScene('house'); player.x=places.fridge.x; player.y=places.fridge.y;
  openFridge();
  const original=fridge.stock.fish;
  transferFridgeItem('fish','take');
  assert.equal(pocket.fish,1); assert.equal(fridge.stock.fish,original-1);
  transferFridgeItem('fish','store');
  assert.equal(pocket.fish,0); assert.equal(fridge.stock.fish,original);
  transferFridgeItem('food','take'); transferFridgeItem('bad','take');
  assert.equal(pocket.food,0,'空库存不产生食物');
  pocket.fish=2; synchronizeBagFood();
  farmTime.day=2; pocket.fish++; synchronizeBagFood();
  farmTime.day=3; synchronizeBagFood();
  assert.equal(pocket.fish,1,'新旧批次分别变质');
  assert.equal(pocket.spoiledFood,2);
  transferFridgeItem('fish','store'); farmTime.day=10; synchronizeBagFood();
  assert.equal(fridge.stock.fish,original+1,'冷冻库存不变质');
  transferFridgeItem('fish','take');
  assert.equal(bagFoodBatches.fish[0].day,10);
  discardSpoiledFood(); assert.equal(pocket.spoiledFood,0);
  player.x=800; player.y=650;
  const meat=fridge.stock.meat;
  transferFridgeItem('meat','take'); assert.equal(fridge.stock.meat,meat);
  updateFridge(.5); assert.equal(fridge.open,false);
  player.x=places.kitchen.x; player.y=places.kitchen.y;
  beginLivingAction('cook',recipes.meat);
  assert.equal(livingSession.ingredientSource,'fridge');
  assert.equal(fridge.stock.meat,meat-1);
  stopLivingAction(); assert.equal(fridge.stock.meat,meat);
  beginLivingAction('cook',recipes.meat);
  livingSession.cooked=true; stopLivingAction(true);
  assert.equal(fridge.stock.meat,meat-1);
  assert.equal(diningMeal.servings,1); assert.equal(pocket.food,1);
`);

check('围栏内成长与走动、骑马保持蓝衣服', `
  changeScene('farm'); penGate.open=true;
  for (const kind of ['lamb','pig','cow','chicken']) {
    requestAnimalTravel(kind,['pig','cow'].includes(kind)?'push':'hold');
    assert.equal(animalTravelRequest,null); assert.equal(animalTravel,null);
  }
  const original=animals.map(animal=>({...farmAnimalPosition(animal)}));
  const moved=new Set();
  for (let frame=0;frame<1200;frame++) {
    clock+=.1; updateFarm(.1);
    for (const animal of animals) {
      if (animal.cell===3) continue;
      const position=farmAnimalPosition(animal);
      assert.ok(animalFitsPen(animal,position));
      assert.ok(animalFitsPen(animal,keepFarmAnimalPoseInsidePen(animal,animalPose(animal))));
      if (distance(original[animal.cell],position)>10) moved.add(animal.cell);
    }
  }
  assert.ok(moved.size>=4,'留在围栏的动物仍然走动');
  for (const animal of animals) if (animal.cell!==3) animal.targetGrowth=1.25;
  for (let frame=0;frame<300;frame++) {
    clock+=.1; updateFarm(.1);
    for (const animal of animals) if (animal.cell!==3)
      assert.ok(animalFitsPen(animal,farmAnimalPosition(animal)));
  }
  outfit='blue'; busyUntil=0;
  player.x=places.horse.x; player.y=places.horse.y;
  mountHorse(); assert.equal(riding,true); clock=mountStarted+1;
  for (let frame=0;frame<4;frame++) {
    player.walking=true; player.step=frame; events.length=0; draw();
    assert.equal(events.filter(event=>event[1]===blueRider).length,1);
    assert.equal(events.filter(event=>event[1]===rider).length,0);
    assert.equal(outfit,'blue');
  }
  changeScene('junction'); events.length=0; draw();
  assert.equal(events.filter(event=>event[1]===blueRider).length,1);
  dismountHorse(); assert.equal(riding,false); assert.equal(outfit,'blue');
`);

check('钓鱼早拉、漏咬和成功收线的库存一致', `
  changeScene('farm');
  startFishing(); clock+=1.2; updateFishing(1.2);
  fishingInput(); assert.equal(fishingSession.state,'escaped');
  clock+=1.4; updateFishing(1.4);
  assert.equal(fishingSession,null); assert.equal(pocket.fish,0);
  startFishing(); clock=fishingSession.biteAt;
  updateFishing(0); updateFishing(0);
  clock+=4.3; updateFishing(4.3);
  assert.equal(fishingSession.state,'escaped');
  clock+=1.4; updateFishing(1.4); assert.equal(pocket.fish,0);
  startFishing(); const caught=fishingSession.fish;
  clock=fishingSession.biteAt; updateFishing(0); updateFishing(0);
  fishingInput(); clock+=.66; updateFishing(.66); keys.add('e');
  for (let frame=0;frame<480&&fishingSession;frame++) {
    clock+=1/60; updateFishing(1/60);
  }
  keys.clear(); assert.equal(fishingSession,null);
  assert.equal(pocket.fish,1); assert.equal(lastCaughtFish,caught);
  assert.equal(document.querySelector('#fish-dialog').open,true);
`);

check('三种菜单不抢占午睡、窗帘和吃饭，共九种场景', `
  changeScene('house'); balconyDoor.open=true; rebuildGrid();
  const panels=['#kitchen-panel','#clothes-panel','#activity-drawer'];
  function resetCase() {
    resetHomeAction(); stopLivingAction(); busyUntil=0;
    route=[]; pendingPlace=null; keys.clear(); targetMarker=null;
    for (const id of panels) document.querySelector(id).hidden=true;
    for (const id of ['#help-dialog','#backpack-dialog','#guide-dialog',
      '#shoes-dialog','#pet-care-dialog','#fridge-dialog','#medicine-dialog',
      '#alarm-dialog','#fish-dialog']) document.querySelector(id).close();
    homeCurtains.progress=0; homeCurtains.nextAttempt=Infinity;
    homeCurtains.target=null; homeCurtains.action=null; homeCurtains.sleepAfter=false;
    homeAlarm.napDay=-1; homeAlarm.ringingUntil=0;
    diningMeal.servings=0; diningMeal.eatAt=null; pocket.food=0;
    player.x=houseArrival.x; player.y=houseArrival.y; player.walking=false; outfit='pajamas';
    farmTime.hour=9; farmTime.phase='day'; clock+=100;
  }
  function runUntil(done) {
    for (let frame=0;frame<12000&&!done();frame++) update(1/60);
    assert.ok(done(),'关菜单后自动动作能够实际走完');
  }
  function holdMenu(id) {
    document.querySelector(id).hidden=false;
    for (let frame=0;frame<180;frame++) update(1/60);
    assert.equal(route.length,0); assert.equal(pendingPlace,null);
  }
  for (const id of panels) {
    resetCase(); farmTime.hour=13; const napDay=homeAlarm.napDay;
    holdMenu(id);
    assert.equal(homeAlarm.napDay,napDay);
    assert.equal(sleepSession,null); assert.equal(sleepPreparation,null);
    document.querySelector(id).hidden=true; updateHomeAlarm();
    assert.equal(pendingPlace,'nap');
    runUntil(()=>sleepSession!==null); assert.equal(sleepSession.mode,'nap');
    runUntil(()=>sleepSession===null);
    assert.equal(homeAlarm.napDay,homeAlarm.day);

    resetCase(); farmTime.hour=20; homeCurtains.nextAttempt=0;
    holdMenu(id);
    assert.equal(homeCurtains.progress,0);
    assert.equal(homeCurtains.target,null); assert.equal(homeCurtains.action,null);
    document.querySelector(id).hidden=true; updateHomeCurtains();
    assert.equal(pendingPlace,'curtains');
    runUntil(()=>homeCurtains.progress===1&&homeCurtains.action===null);

    resetCase(); diningMeal.servings=1; diningMeal.name='蘑菇汤';
    diningMeal.eatAt=clock-1; const dueAt=diningMeal.eatAt;
    holdMenu(id);
    assert.equal(diningMeal.eatAt,dueAt); assert.equal(diningMeal.servings,1);
    assert.equal(livingSession,null);
    document.querySelector(id).hidden=true; updateMealTime();
    assert.equal(pendingPlace,'dining');
    runUntil(()=>livingSession?.kind==='eat');
    assert.equal(player.view,2); assert.equal(player.y,650);
    assert.equal(diningMeal.servings,0);
    runUntil(()=>livingSession===null); assert.equal(diningMeal.eatAt,null);
  }
`);

check('药盒不打断六个烹饪阶段，取消原料保留鲜度和来源', `
  changeScene('house'); farmTime.hour=9; balconyDoor.open=true; rebuildGrid();
  homeCurtains.nextAttempt=Infinity; prescribeMedicine(nuannuanHealth);
  const openMedicine=document.querySelector('#open-medicine').listeners.click;
  const dialog=document.querySelector('#medicine-dialog');
  function runUntil(done) {
    for(let frame=0;frame<12000&&!done();frame++) update(1/60);
    assert.ok(done());
  }
  for(const stage of ['to-sink','washing','to-pot','cooking','carrying','placing']) {
    clock+=100; farmTime.hour=9; busyUntil=0;
    player.x=places.kitchen.x; player.y=places.kitchen.y; pocket.mushrooms=1;
    beginLivingAction('cook',recipes.mushroom); runUntil(()=>livingSession?.stage===stage);
    const session=livingSession, path=route, snapshot=JSON.stringify(route);
    const x=player.x,y=player.y;
    openMedicine(); assert.equal(dialog.open,false); assert.equal(livingSession,session);
    assert.equal(route,path); assert.equal(JSON.stringify(route),snapshot);
    assert.equal(player.x,x); assert.equal(player.y,y);
    if(stage==='carrying') {
      update(1/60); assert.ok(Math.hypot(player.x-x,player.y-y)<20);
      assert.equal(livingSession.stage,'carrying');
    }
    stopLivingAction();
  }
  busyUntil=0; player.x=650; player.y=670; feedHousePets();
  const path=route; openMedicine(); assert.equal(dialog.open,false);
  assert.ok(petFeedingAction); assert.equal(route,path);
  petFeedingAction=null; route=[]; openMedicine(); assert.equal(dialog.open,true); dialog.close();
  for(const key of Object.keys(bagFoodBatches)) {pocket[key]=0;bagFoodBatches[key].length=0;}
  pocket.spoiledFood=0; farmTime.day=0; pocket.fish=2; synchronizeBagFood();
  farmTime.day=2; pocket.fish++; synchronizeBagFood();
  for(let repeat=0;repeat<5;repeat++) {
    player.x=places.kitchen.x; player.y=places.kitchen.y; busyUntil=0;
    beginLivingAction('cook',recipes.fish); synchronizeBagFood(); stopLivingAction();
    assert.equal(pocket.fish,3); assert.equal(bagFoodBatches.fish.length,2);
    assert.equal(bagFoodBatches.fish[0].day,0); assert.equal(bagFoodBatches.fish[0].amount,2);
    assert.equal(bagFoodBatches.fish[1].day,2);
  }
  farmTime.day=3; synchronizeBagFood();
  assert.equal(pocket.fish,1); assert.equal(pocket.spoiledFood,2);
  farmTime.day=5; synchronizeBagFood();
  const frozen=fridge.stock.fish;
  beginLivingAction('cook',recipes.fish);
  assert.equal(livingSession.ingredientReservation.source,'fridge');
  stopLivingAction(); assert.equal(fridge.stock.fish,frozen); assert.equal(pocket.fish,0);
`);

check('抚摸结束和中断清掉自己的互动点，不释放其他动作', `
  penGate.open=true; penGate.progress=1; rebuildGrid();
  for(const animal of animals) {
    animal.sleeping=false; animal.restMoving=false; animal.restPosition=null; animal.patUntil=0;
  }
  petFarmAnimal(1); assert.ok(animalPetting);
  player.x=places.animalPet.x; player.y=places.animalPet.y; route=[]; pendingPlace=null;
  startAnimalPetting(); clock+=2.41; updateAnimalPetting();
  assert.equal(animalPetting,null); assert.equal(outdoorPlaces.animalPet,undefined);
  function setPetting() {
    animalPetting={animal:animals[1],stage:'stroking',started:clock};
    outdoorPlaces.animalPet={x:300,y:500,label:'摸摸绵羊'};
    nearPlace='animalPet'; busyUntil=clock+2.4;
  }
  setPetting(); keys.add('w'); updateAnimalPetting(); keys.clear();
  assert.equal(outdoorPlaces.animalPet,undefined); assert.equal(nearPlace,null);
  setPetting(); busyUntil=clock+8; pendingPlace='kitchen'; route=[{x:350,y:600}];
  clearAnimalPetting(); assert.equal(busyUntil,clock+8); assert.equal(route.length,1);
  setPetting(); changeScene('house'); assert.equal(outdoorPlaces.animalPet,undefined);
  changeScene('farm'); setPetting(); setFarmWeather('hail'); hailHazard.nextHit=0;
  updateHailHazard(0.1); assert.equal(outdoorPlaces.animalPet,undefined);
  assert.equal(busyUntil,clock+0.7);
  setPetting(); collapseAtMidnight(); assert.equal(outdoorPlaces.animalPet,undefined);
  assert.equal(busyUntil,Infinity);
`);

check('牵走正在吃饭的狗恢复步行，未吃完的粮不扣除', `
  farmTime.hour=15; changeScene('house'); balconyDoor.open=true; rebuildGrid();
  dog.scene='house'; cat.scene='farm'; dog.nextPlan=0; dog.sleeping=false; dog.care=null;
  const target=petEatingTarget(dog);
  dog.x=target.x; dog.y=target.y; petFood.dog=3;
  player.x=dog.x+30; player.y=dog.y;
  updatePets(0); assert.ok(clock<dog.eatingUntil);
  interactPet('dog'); assert.ok(walkingDog); assert.equal(dog.eatingUntil,0);
  assert.equal(petFood.dog,3);
  clock+=5; updatePets(0); assert.equal(petFood.dog,3);
  stopDogWalk(null); dog.x=target.x; dog.y=target.y; dog.nextPlan=0;
  updatePets(0); assert.ok(clock<dog.eatingUntil);
  clock+=4.1; updatePets(0); assert.equal(petFood.dog,2);
`);

check('喂食不移动异图宠物，马必须在本图才能骑乘', `
  changeScene('farm');
  cat.scene='house'; cat.x=350; cat.y=250; cat.route=[{x:360,y:250}];
  dog.scene='forest'; dog.x=390; dog.y=580; dog.route=[{x:400,y:600}];
  growFarmAnimals();
  assert.equal(cat.x,350); assert.equal(cat.y,250); assert.equal(cat.route.length,1);
  assert.equal(dog.x,390); assert.equal(dog.y,580); assert.equal(dog.route.length,1);
  dog.scene='farm'; dog.x=350; dog.y=250; growFarmAnimals();
  assert.ok(canWalk(dog.x,dog.y));
  animals[3].visitScene='forest'; animals[3].visitPosition={x:800,y:700};
  player.x=592; player.y=700; mountHorse(); assert.equal(riding,false);
  updateAnimalTravel(0); assert.equal(places.horse.x,-10000);
  update(0); assert.notEqual(nearPlace,'horse');
  requestAnimalTravel('horse','ride'); assert.equal(pendingPlace,null);
  changeScene('forest'); updateAnimalTravel(0); assert.equal(places.horse.x,800);
  player.x=800; player.y=720; busyUntil=0; mountHorse(); assert.equal(riding,true);
  clock+=1; changeScene('farm'); dismountHorse(); updateAnimalTravel(0);
  assert.ok(places.horse.x>0); assert.ok(animalIsHere(animals[3]));
`);

check('模态菜单阻止游戏输入，异图宠物不拦截地面点击', `
  for (const id of ['#fridge-dialog','#medicine-dialog','#farm-care-dialog']) {
    const dialog=document.querySelector(id);
    dialog.open=true; keys.clear();
    window.listeners.keydown({key:'w',preventDefault(){}});
    assert.equal(keys.size,0);
    dialog.open=false;
  }
  window.listeners.keydown({key:'w',preventDefault(){}});
  assert.ok(keys.has('w')); keys.clear();
  scene='city'; cat.scene=dog.scene='farm';
  cat.x=dog.x=700; cat.y=dog.y=700; cat.width=dog.width=100;
  cat.height=dog.height=100;
  updatePetPlaceMarkers();
  const destinations=[]; walkTo=(point,place)=>destinations.push({point,place});
  document.querySelector('#game').listeners.pointerdown({clientX:700,clientY:650});
  assert.equal(destinations.length,1);
  assert.equal(destinations[0].place,null);
  cat.scene='city'; destinations.length=0;
  document.querySelector('#game').listeners.pointerdown({clientX:700,clientY:650});
  assert.equal(destinations[0].place,'cat');
`);

check('宠物不在场时不闲聊邀请，睡着的猫不被说成散步', `
  const spoken=[];
  speakNuannuanLine=(text)=>spoken.push(text);
  for (const map of ['house','city']) {
    scene=map; cat.scene='farm'; dog.scene='farm';
    for (const night of [false,true]) {
      farmTime.hour=night?21:10; farmTime.phase=night?'night':'day';
      for (let attempt=0;attempt<100;attempt++) sayNuannuan(true);
    }
  }
  assert.ok(spoken.length>0);
  assert.ok(spoken.every(text=>!text.includes('小猫')));
  scene='farm'; cat.scene='farm'; dog.scene='city'; cat.sleeping=false;
  spoken.length=0; farmTime.hour=10; farmTime.phase='day';
  for (let attempt=0;attempt<100;attempt++) sayNuannuan(true);
  assert.ok(!spoken.includes('小猫小狗，要一起玩吗？'));
  dog.scene='farm'; dog.sleeping=false;
  cat.x=dog.x=player.x; cat.y=dog.y=player.y;
  assert.equal(petSpeechFitsScene('小猫小狗，要一起玩吗？'),true);
  assert.equal(petSpeechFitsScene('小猫还在散步呢。'),true);
  cat.x=player.x+241;
  assert.equal(petSpeechFitsScene('小猫还在散步呢。'),false);
  assert.equal(petSpeechFitsScene('小猫也来陪我啦。'),false);
  assert.equal(petSpeechFitsScene('小猫小狗，要一起玩吗？'),false);
  cat.x=player.x;
  cat.sleeping=true;
  assert.equal(petSpeechFitsScene('小猫还在散步呢。'),false);
`);

check('宠物点击尺寸与步行、进食、闭眼睡姿和跳跃脚位一致', `
  changeScene('house'); dog.scene=cat.scene='house'; player.y=1000;
  for (const pet of pets) {
    pet.x=1100; pet.y=550; pet.care=null;
    for (let view=0;view<8;view++) {
      pet.view=view; pet.walking=true; pet.sleeping=false; pet.eatingUntil=0;
      pet.playHop=10; pet.step=1;
      const bounds=petHitBounds(pet);
      events.length=0; drawPets(false); drawPets(true);
      const stamps=events.filter(e=>e[0]==='drawImage'&&e[1]===(pet===dog?dogAtlas:catAtlas));
      assert.equal(stamps.length,1);
      assert.equal(bounds.width,stamps[0][8]); assert.equal(bounds.height,stamps[0][9]);
      assert.equal(bounds.y+bounds.height,pet.y-0.7-10);
    }
    pet.walking=false; pet.sleeping=false; pet.eatingUntil=clock+4;
    let bounds=petHitBounds(pet);
    events.length=0; drawPets(false); drawPets(true);
    const meal=events.filter(e=>e[0]==='drawImage'&&e[1]===petEatingArt[pet.kind]);
    assert.equal(meal.length,1);
    assert.equal(bounds.width,meal[0][8]); assert.equal(bounds.height,meal[0][9]);
    pet.eatingUntil=0; pet.sleeping=true; pet.sleepPose=1;
    bounds=petHitBounds(pet);
    const region=sleepingPetRegions[pet.kind];
    assert.ok(Math.abs(bounds.height-bounds.width*region.height/region.width
      *(1+Math.sin(clock*1.8)*.018))<.001);
    pet.care={mode:'hold',phase:'carried'};
    assert.equal(petHitBounds(pet),null);
    pet.care=null; pet.scene='farm'; assert.equal(petHitBounds(pet),null);
    pet.scene='house';
  }
`);

check('宠物洗澡短手臂触到近侧毛发，只画一个宠物身体', `
  changeScene('house'); player.x=places.bath.x; player.y=places.bath.y;
  dog.scene='house'; cat.scene='farm';
  dog.care={mode:'wash',phase:'bubbles',started:clock-2,
    from:{x:dog.x,y:dog.y},floor:{x:player.x,y:player.y}};
  dog.x=1275; dog.y=272;
  for (let frame=0;frame<20;frame++) {
    clock+=.08; events.length=0; drawPetCare();
    const shoulder=events.find(e=>e[0]==='moveTo'&&e[1]===player.x+20&&e[2]===player.y-80);
    const hand=events.find(e=>e[0]==='lineTo');
    assert.ok(shoulder&&hand);
    assert.ok(Math.hypot(hand[1]-shoulder[1],hand[2]-shoulder[2])<42);
    assert.ok(hand[1]>=1275-92/2&&hand[1]<=1275+92/2);
    assert.equal(events.filter(e=>e[0]==='drawImage'&&e[1]===dogAtlas).length,1);
  }
`);

check('附近互动选最近点，跳过异图宠物和不在场的马', `
  changeScene('farm'); dog.scene=cat.scene='house';
  animals[3].visitScene='forest';
  places={far:{x:710,y:700},close:{x:702,y:700},
    dog:{x:700,y:700},cat:{x:700,y:700},horse:{x:700,y:700},
    hidden:{x:-1,y:700}};
  assert.equal(nearestPlaceAt({x:700,y:700},65),'close');
  assert.equal(nearestPlaceAt({x:800,y:800},65),null);
  dog.scene='farm'; assert.equal(nearestPlaceAt({x:700,y:700},65),'dog');
  dog.scene='house'; cat.scene='farm';
  assert.equal(nearestPlaceAt({x:700,y:700},65),'cat');
  cat.scene='house'; animals[3].visitScene=null;
  assert.equal(nearestPlaceAt({x:700,y:700},65),'horse');
`);

check('点击炉柜和锅柄准确到炉灶，旧水槽区域不触发做饭', `
  changeScene('house'); dog.scene=cat.scene='farm';
  const clicks=[]; walkTo=(point,place=null)=>clicks.push({point,place});
  const pointer=document.querySelector('#game').listeners.pointerdown;
  const area=kitchenLayout.hitArea;
  for (const point of [{x:area.x+area.width/2,y:area.y+area.height/2},
    {x:area.x+area.width-2,y:area.y+2}]) {
    clicks.length=0; pointer({clientX:point.x,clientY:point.y});
    assert.equal(clicks.length,1); assert.equal(clicks[0].place,'kitchen');
    assert.equal(clicks[0].point,places.kitchen);
  }
  clicks.length=0; pointer({clientX:240,clientY:600});
  assert.equal(clicks.length,1); assert.notEqual(clicks[0].place,'kitchen');
`);

check('鞋架下部仍可点击且不能穿行，旁边挑鞋站位可达', `
  changeScene('house'); balconyDoor.open=true; rebuildGrid();
  dog.scene=cat.scene='farm';
  const rack=shoeRackLayout.bounds;
  assert.ok(rack.height>=160);
  assert.equal(onHouseFloor(rack.x+rack.width-4,rack.y+rack.height-4),false);
  assert.ok(canWalk(shoeRackLayout.stand.x,shoeRackLayout.stand.y));
  assert.ok(findPath(shoeRackLayout.stand).length);
  const clicks=[]; walkTo=(point,place=null)=>clicks.push({point,place});
  document.querySelector('#game').listeners.pointerdown({
    clientX:rack.x+rack.width/2,clientY:rack.y+rack.height-4});
  assert.equal(clicks.length,1); assert.equal(clicks[0].place,'shoeRack');
`);

check('入屋站位和角色路线避开宠物床，猫狗仍能回窝', `
  changeScene('house'); balconyDoor.open=true; rebuildGrid();
  assert.equal(playerClearOfPetBeds(650,670),false);
  assert.ok(canWalk(player.x,player.y)&&playerClearOfPetBeds(player.x,player.y));
  assert.equal(places.exit.y,houseArrival.y);
  for (const name of ['bed','wardrobe','kitchen','fridge','bathroom','shoeRack','dining','sofa','exit','balconyDoor']) {
    const path=findPath(places[name]);
    assert.ok(path.length,name+' 从入口可达');
    assert.ok(path.every(node=>playerClearOfPetBeds(node.x,node.y)));
    assert.ok(distance(path.at(-1),places[name])<85);
  }
  cat.scene='house'; cat.x=710; cat.y=680; cat.care=null;
  assert.ok(findPetPath({x:625,y:660},cat).length);
  assert.ok(canWalk(625,660),'宠物仍可以走到床里');
  events.length=0; drawDogBed();
  const beds=events.filter(event=>event[0]==='drawImage'&&event[1]===petProps['pet-bed']);
  assert.equal(beds.length,2);
  for (let i=0;i<2;i++) assert.equal(JSON.stringify(beds[i].slice(2)),
    JSON.stringify(Object.values(housePetBeds[i])));
`);

check('公共入口门固定门槛，前后两层仅绘制一次门板与转场', `
  const destinations=[];
  const actualWalkTo=walkTo;
  const fillRects=[]; ctx.fillRect=(...args)=>fillRects.push(args);
  for (const [map,key] of [['junction','villageDoor'],['friends','villageDoor'],
    ['friends','villageDoorRight'],['city','hospitalDoor'],['city','petHospitalDoor'],['city','bakeryDoor']]) {
    changeScene(map); const panel=buildingDoors[map][key].panel;
    assert.ok(findPath(places[key]).length,map+' 门前可达');
    walkTo=(point,place)=>destinations.push({point,place});
    destinations.length=0;
    document.querySelector('#game').listeners.pointerdown({
      clientX:panel.x+panel.width/2,clientY:panel.y-panel.height*.8
    });
    assert.equal(destinations[0].place,key,'点击门上部仍进入对应房门');
    walkTo=actualWalkTo;
    for (const y of [panel.y-20,panel.y+20]) {
      player.y=y; doorTransition={started:clock-.95,destination:'hospital',building:true,panel};
      events.length=0; fillRects.length=0;
      drawBuildingDoorAnimation(false); drawBuildingDoorAnimation(true);
      const leaves=events.filter(e=>e[0]==='drawImage'&&e[1]===sceneryMaps[scene]);
      assert.equal(leaves.length,1);
      assert.equal(leaves[0][2],panel.x); assert.equal(leaves[0][3],panel.y-panel.height);
      assert.equal(fillRects.filter(r=>r[2]===W&&r[3]===H).length,1);
    }
  }
  for (const map of ['hospital','petHospital','bakery','villageHouse']) {
    changeScene(map); doorTransition={started:clock-.95,destination:'city',building:true};
    events.length=0; fillRects.length=0;
    drawBuildingDoorAnimation(false); drawBuildingDoorAnimation(true);
    assert.equal(events.filter(e=>e[0]==='drawImage'&&e[1]===doorPanelsArt).length,1);
    assert.equal(fillRects.length,1);
  }
`);

check('朋友分散漫步且聊天时停下，不在同一横带拥挤', `
  changeScene('friends');
  let seed=73;
  Math.random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
  const ranges=friendGroup.map(friend=>({min:friend.y,max:friend.y}));
  for (let frame=0;frame<7200;frame++) {
    clock+=1/60; updateFriendWandering(1/60);
    friendGroup.forEach((friend,index)=>{
      assert.ok(friendWanderGround(friend));
      ranges[index].min=Math.min(ranges[index].min,friend.y);
      ranges[index].max=Math.max(ranges[index].max,friend.y);
    });
    for (let a=0;a<friendGroup.length;a++) for (let b=a+1;b<friendGroup.length;b++)
      assert.ok(friendPersonalSpace(friendGroup[a],friendGroup[a],friendGroup[b])>=.98);
  }
  assert.ok(ranges.every(range=>range.max-range.min>90));
  const friend=friendGroup[0]; chattingFriend=friend;
  document.querySelector('#friend-panel').hidden=false;
  const before={x:friend.x,y:friend.y}; clock++; updateFriendWandering(1);
  assert.equal(friend.x,before.x); assert.equal(friend.y,before.y);
  assert.equal(places.friend0.x,friend.x); assert.equal(places.friend0.y,friend.y+55);
`);

console.log('全部核心集成检查通过；贴图、音频与真实 FPS 仍需内置浏览器试玩。');
