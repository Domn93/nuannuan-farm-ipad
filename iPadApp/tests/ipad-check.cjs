// 从 iPadApp 运行：node tests/ipad-check.cjs
// 这些检查模拟 DOM、Canvas 和资源加载，验证共享脚本的玩法与状态边界。
// 它们不能代替内置浏览器里的贴图、声音听感和真实帧率验收。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../NuannuanFarm/Game');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^?"]+)(?:\?[^\"]*)?"/g)]
  .filter((match) => !match[1].endsWith('/ipad.js'))
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
        if (key === 'drawImage') assert.ok(args[0], 'Canvas 图片源必须存在');
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

check("存档保留物品、日期、食物鲜度、成长和药物疗程", `
  pocket.flowers=7; pocket.fish=2; pocket.coins=35;
  farmTime.day=4; farmTime.hour=13; farmClimate.season=2;
  bagFoodBatches.fish=[{amount:2,day:3}];
  animals[2].growth=1.1; animals[2].lastFedDay=4; animals[2].feedDays=2;
  petHealth.cat.sick=true;
  petHealth.cat.course={doseCounts:[1,1],remaining:[2,2],taken:[],collected:[]};
  friendGroup[0].friend=true; housePlants[0].water=0.4;
  const saved=captureIPadLife(); assert.ok(validIPadLife(saved));
  pocket.flowers=0; pocket.fish=0; pocket.coins=0; farmTime.day=0;
  animals[2].growth=1; petHealth.cat.sick=false; friendGroup[0].friend=false; housePlants[0].water=1;
  assert.equal(restoreIPadLife(saved),true);
  assert.equal(pocket.flowers,7); assert.equal(pocket.fish,2); assert.equal(pocket.coins,35);
  assert.equal(farmTime.day,4); assert.equal(farmTime.hour,13); assert.equal(farmClimate.season,2);
  assert.equal(bagFoodBatches.fish[0].day,3);
  assert.equal(animals[2].growth,1.1); assert.equal(animals[2].lastFedDay,4);
  assert.equal(petHealth.cat.sick,true); assert.equal(petHealth.cat.course.doseCounts[0],1);
  assert.equal(friendGroup[0].friend,true); assert.equal(housePlants[0].water,0.4);
`);

check("做饭、睡觉或诊疗时不提交半途存档", `
  assert.ok(captureIPadLife());
  livingSession={kind:'cook',ingredientReservation:{item:'fish',source:'bag',day:0}};
  assert.equal(captureIPadLife(),null); livingSession=null;
  sleepSession={started:clock}; assert.equal(captureIPadLife(),null); sleepSession=null;
  petVetVisit={pet:cat}; assert.equal(captureIPadLife(),null); petVetVisit=null;
  busyUntil=Infinity; assert.equal(captureIPadLife(),null);
`);

check("快照与运行对象分离", `
  pocket.flowers=4; const saved=captureIPadLife();
  pocket.flowers=5; animals[2].growth=1.2; fridge.stock.fish=0;
  assert.equal(saved.pocket.flowers,4); assert.equal(saved.animals[2].growth,1);
  assert.equal(saved.fridgeStock.fish,2);
`);

check("坏存档不会修改当前农场", `
  pocket.flowers=9; assert.equal(restoreIPadLife(null),false);
  const bad=captureIPadLife(); bad.version=2; bad.pocket.flowers=0;
  assert.equal(restoreIPadLife(bad),false); assert.equal(pocket.flowers,9);
  bad.version=1; bad.scene='unknown'; assert.equal(restoreIPadLife(bad),false);
  bad.scene='farm'; bad.pocket.fish=-1; assert.equal(restoreIPadLife(bad),false);
`);

check("室内场景、服装、宠物和围栏恢复", `
  changeScene('house'); outfit='blue'; quilt='sunny'; catCarrierPacked=true; penGate.open=true;
  cat.boarded=false; cat.scene='house'; cat.x=680; cat.y=680;
  const saved=captureIPadLife(); assert.ok(saved);
  changeScene('farm'); outfit='pink'; catCarrierPacked=false; cat.boarded=true;
  assert.equal(restoreIPadLife(saved),true);
  assert.equal(scene,'house'); assert.equal(outfit,'blue'); assert.equal(quilt,'sunny');
  assert.equal(catCarrierPacked,true); assert.equal(cat.boarded,false); assert.equal(cat.scene,'house');
  assert.equal(penGate.open,true); assert.equal(canWalk(player.x,player.y),true);
`);

check("Infinity 计时器不会在恢复后立即触发", `
  nuannuanHealth.nextVomitAt=Infinity; const saved=captureIPadLife();
  assert.equal(saved.health.nextVomitAt,null); assert.equal(restoreIPadLife(saved),true);
  assert.equal(nuannuanHealth.nextVomitAt,Infinity);
`);

check("首页暂停时游戏时钟保持不变", `
  window.ipadAppPaused=true; const before=clock; frame(5000); frame(6000); assert.equal(clock,before);
  window.ipadAppPaused=false; frame(6016); assert.ok(clock>before);
`);

check("抱猫和牵狗在恢复后保持关联", `
  cat.boarded=false; cat.scene='farm'; catCarrierPacked=true; carriedPet=cat;
  cat.care={mode:'hold',phase:'carried',started:clock-2,from:{x:cat.x,y:cat.y},floor:{x:player.x,y:player.y}};
  walkingDog=true; const saved=captureIPadLife(); assert.ok(saved);
  carriedPet=null; cat.care=null; walkingDog=false;
  assert.equal(restoreIPadLife(saved),true);
  assert.equal(carriedPet,cat); assert.equal(cat.care.mode,'hold'); assert.equal(walkingDog,true);
`);

check('小肚子随活动消耗，睡觉较慢，空肚子不会中断动作', `
  player.walking=false;updateIPadNeeds(10);assert.ok(Math.abs(ipadHunger.satiety-79.2)<.001);
  player.walking=true;updateIPadNeeds(10);assert.ok(Math.abs(ipadHunger.satiety-78)<.001);
  keys.add('Shift');updateIPadNeeds(10);assert.ok(Math.abs(ipadHunger.satiety-76.4)<.001);keys.clear();
  sleepSession={started:clock};updateIPadNeeds(10);assert.ok(Math.abs(ipadHunger.satiety-76.05)<.001);sleepSession=null;
  ipadHunger.satiety=1;route=[{x:800,y:750}];busyUntil=clock+4;
  updateIPadNeeds(100);assert.equal(ipadHunger.satiety,0);assert.equal(route.length,1);assert.equal(busyUntil,clock+4);
  assert.equal(document.querySelector('#ipad-belly-label').textContent,'该吃饭啦');
  window.ipadAppPaused=true;const before=ipadHunger.satiety;const dirt=hygiene.dirt;
  frame(1000);frame(2000);assert.equal(ipadHunger.satiety,before);assert.equal(hygiene.dirt,dirt);
`);

check('背包吃饭面包水果补饱腹，空背包和坏食物不能凭空补充', `
  const eat=document.querySelector('#eat-food').listeners.click;
  for(const [item,amount] of [['food',60],['bread',35],['fruit',20]]) {
    pocket.food=0;pocket.bread=0;pocket.fruit=0;ipadHunger.satiety=10;pocket[item]=1;
    refreshBackpack();
    eat();assert.equal(pocket[item],0);assert.equal(ipadHunger.satiety,10+amount);
    eat();assert.equal(ipadHunger.satiety,10+amount);
  }
  ipadHunger.satiety=97;pocket.food=1;refreshBackpack();eat();assert.equal(ipadHunger.satiety,100);
  ipadHunger.satiety=10;pocket.bread=1;bagFoodBatches.bread=[{amount:1,day:farmTime.day-3}];
  refreshBackpack();eat();assert.equal(pocket.bread,0);assert.equal(ipadHunger.satiety,10);
`);

check('饭桌吃完才补饱腹，取消不补，五类食物按份生效', `
  changeScene('house');
  for(const [item,amount] of Object.entries(ipadFoodSatiety)) {
    for(const key of Object.keys(ipadFoodSatiety)) pocket[key]=0;
    diningMeal.servings=0;diningMeal.dishes=[];livingSession=null;busyUntil=0;
    pocket[item]=1;ipadHunger.satiety=10;beginLivingAction('eat');assert.ok(livingSession);
    assert.equal(ipadHunger.satiety,10);stopLivingAction(false);assert.equal(ipadHunger.satiety,10);
    pocket[item]=1;beginLivingAction('eat');stopLivingAction(true);assert.equal(ipadHunger.satiety,10+amount);
    stopLivingAction(true);assert.equal(ipadHunger.satiety,10+amount);
  }
  ipadHunger.satiety=5;busyUntil=0;diningMeal.servings=1;diningMeal.dishes=['蔬菜饭'];
  beginLivingAction('eat');assert.equal(diningMeal.servings,0);stopLivingAction(true);assert.equal(ipadHunger.satiety,65);
`);

check('小肚子存档恢复，旧存档正常起步，坏数值不污染状态', `
  ipadHunger.satiety=12;hygiene.dirt=81;const saved=captureIPadLife();assert.ok(saved);
  ipadHunger.satiety=80;hygiene.dirt=0;assert.equal(restoreIPadLife(saved),true);
  assert.equal(ipadHunger.satiety,12);assert.equal(hygiene.dirt,81);assert.equal(ipadHunger.stage,2);
  ipadHunger.satiety=20;assert.equal(saved.hunger.satiety,12);
  delete saved.hunger;assert.equal(restoreIPadLife(saved),true);assert.equal(ipadHunger.satiety,80);
  for(const value of [-1,101,'20',null,NaN,Infinity]) {
    saved.hunger={satiety:value};restoreIPadLife(saved);assert.equal(ipadHunger.satiety,80);
  }
  saved.hunger={satiety:0};restoreIPadLife(saved);assert.equal(ipadHunger.satiety,0);
`);

check('干净条与脏污一致，没洗完不能变干净，洗完恢复满条', `
  for(const [dirt,clean,label] of [[0,100,'香香的'],[35,65,'沾点泥'],[75,25,'搓泡泡啦'],[100,0,'搓泡泡啦']]) {
    hygiene.dirt=dirt;refreshIPadNeeds();assert.equal(canvas.dataset.cleanliness,String(clean));
    assert.equal(document.querySelector('#ipad-clean-label').textContent,label);
    assert.equal(document.querySelector('#ipad-clean-fill').style.width,clean+'%');
  }
  changeScene('house');startBath();clock+=3;finishBath(false);refreshIPadNeeds();assert.equal(hygiene.dirt,100);
  busyUntil=0;startBath();clock+=7.1;finishBath(true);refreshIPadNeeds();
  assert.equal(hygiene.dirt,0);assert.equal(canvas.dataset.cleanliness,'100');
`);
const fullSource = [...html.matchAll(/<script src="([^?"]+)(?:\?[^"]*)?"/g)]
  .map((match) => fs.readFileSync(path.join(root, match[1]), 'utf8')).join('\n');
new vm.Script(fullSource);
for (const match of html.matchAll(/(?:src|href)="((?:js|css)\/[^?"]+)/g))
  assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
for (const file of fs.readdirSync(path.join(root, 'js'))) {
  const code = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  for (const match of code.matchAll(/['"](assets\/[a-zA-Z0-9_./-]+)['"]/g))
    assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
}
assert.ok(!fs.lstatSync(path.join(root, 'assets')).isSymbolicLink());
console.log('PASS 全部脚本可共同解析，本地资源完整且独立');
