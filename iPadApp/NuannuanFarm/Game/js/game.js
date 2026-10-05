// 游戏入口：共享状态、寻路、互动派发、更新、绘制和输入绑定。

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const W = 1536,
  H = 1024,
  CELL = 24;
function sceneScale(y) {
  return ['house', 'barn'].includes(scene) || isBuildingInterior() ? 0.82 : Math.max(0.76, Math.min(1.25, 0.82 + ((y - 441) / 539) * 0.42));
}
const keys = new Set();
// 冰箱和小药袋需要继续推进动画、保鲜和日期；其余模态菜单暂停世界。
// 两类菜单都阻止游戏快捷键和自动寻路，避免选择过程中把人物带走。
const pausedGameDialogs = [
  '#help-dialog', '#backpack-dialog', '#guide-dialog', '#shoes-dialog',
  '#fish-dialog', '#pet-care-dialog', '#alarm-dialog', '#farm-care-dialog'
].map((id) => document.querySelector(id));
const gameDialogs = [...pausedGameDialogs,
  document.querySelector('#fridge-dialog'), document.querySelector('#medicine-dialog'),
  document.querySelector('#tv-dialog')];
const gameChoicePanels = ['#kitchen-panel', '#clothes-panel', '#activity-drawer']
  .map((id) => document.querySelector(id));

function gameDialogOpen() {
  return gameDialogs.some((dialog) => dialog.open);
}

function gameChoicePanelOpen() {
  return gameChoicePanels.some((panel) => panel.hidden === false);
}

const player = { x: 650, y: 775, facing: 1, view: 0, walking: false, step: 0 };
const pocket = { flowers: 0, fish: 0, food: 0, bread: 0, fruit: 0, vegetables: 0,
  mushrooms: 0, hearts: 0, insects: 0, wood: 0, coins: 20, leaves: 0,
  meat: 0, icecream: 0, slush: 0, spoiledFood: 0 };
let places = outdoorPlaces,
  scene = 'farm',
  riding = false,
  tvOn = false;
let doorTransition = null,
  mountStarted = -Infinity,
  mountSession = null,
  catchUntil = -Infinity;
const foregroundFence = [
  [0, 782],
  [210, 853],
  [460, 965],
  [555, 1024],
  [0, 1024]
];
// pendingPlace 记录到达后要执行的互动；手动移动会取消自动路线。
// busyUntil 使用游戏时钟，Infinity 表示持续动作，须由对应结束函数释放。
let route = [],
  pendingPlace = null,
  nearPlace = null,
  busyUntil = 0;
let catExitArmed = false;

function carriedCatExitPlace() {
  if (carriedPet !== cat) return null;
  if (scene === 'boardingHouse') return null;
  if (scene === 'house') return 'exit';
  if (scene === 'farm') return 'travel';
  if (scene === 'barn') return 'barnExit';
  if (isBuildingInterior()) return 'buildingExit';
  return scene === 'junction' ? 'returnFarm' : isExploring() ? 'junction' : null;
}
let lastTime = 0,
  toastUntil = 7,
  clock = 0,
  audio = null,
  soundOn = false;
let effects = [],
  targetMarker = null,
  ready = false;
let feedingStarted = -Infinity,
  music = null,
  musicWanted = true,
  musicStarting = false;
let selectedTrack = 'meadow';
// Bounds of each transparent sprite in the generated atlas, measured once.
const animalRegions = [
  { x: 38, y: 200, width: 347, height: 294 },
  { x: 396, y: 107, width: 371, height: 392 },
  { x: 783, y: 205, width: 320, height: 297 },
  { x: 1108, y: 66, width: 405, height: 442 },
  { x: 28, y: 564, width: 401, height: 381 },
  { x: 454, y: 567, width: 342, height: 389 },
  { x: 822, y: 589, width: 307, height: 372 },
  { x: 1190, y: 609, width: 302, height: 341 }
];
// Crop each fishing pose to its visible body, keeping the feet anchored when poses change.
const fishingRegions = [
  { x: 266, y: 17, width: 346, height: 495 },
  { x: 931, y: 21, width: 324, height: 491 },
  { x: 305, y: 527, width: 300, height: 476 },
  { x: 927, y: 534, width: 330, height: 467 }
];
const fishingOutfitRegions = {
  blue: [
    { x: 266, y: 17, width: 349, height: 495 },
    { x: 930, y: 19, width: 326, height: 493 },
    { x: 304, y: 526, width: 303, height: 479 },
    { x: 925, y: 532, width: 338, height: 471 }
  ],
  down: [
    { x: 266, y: 17, width: 352, height: 479 },
    { x: 930, y: 20, width: 340, height: 477 },
    { x: 305, y: 526, width: 316, height: 471 },
    { x: 911, y: 528, width: 363, height: 473 }
  ]
};
// 待机图是四蹄着地的整套骑乘姿势；三格衣服与行走图使用同一人物。
const idleRidingRegions = {
  pink: { x: 133, y: 18, width: 509, height: 493 },
  blue: { x: 882, y: 19, width: 513, height: 493 },
  down: { x: 131, y: 527, width: 512, height: 493 }
};
const background = new Image(),
  girl = new Image(),
  animalAtlas = new Image();
const interior = new Image(),
  rider = new Image(),
  blueRider = new Image(),
  downRider = new Image(),
  idleRider = new Image();
background.src = 'assets/farm-background-wide-gate.png';
girl.src = 'assets/walk.png';
animalAtlas.src = 'assets/animals-clean.png';
interior.src = 'assets/interior-clear.png';
rider.src = 'assets/riding.png';
blueRider.src = 'assets/riding-blue.png';
downRider.src = 'assets/riding-down.png';
idleRider.src = 'assets/riding-idle-plaid.png';
const animals = [
  { cell: 0, x: 685, y: 645, width: 112, height: 81, seed: 0, grazing: true },
  { cell: 1, x: 224, y: 485, width: 106, height: 93, seed: 1 },
  { cell: 2, x: 300, y: 483, width: 67, height: 58, seed: 2 },
  { cell: 3, x: 365, y: 451, width: 117, height: 111, seed: 3 },
  { cell: 4, x: 493, y: 492, width: 133, height: 103, seed: 4 },
  { cell: 5, x: 367, y: 515, width: 52, height: 60, seed: 5 },
  { cell: 6, x: 830, y: 655, width: 55, height: 58, seed: 6, grazing: true },
  { cell: 7, x: 419, y: 478, width: 46, height: 47, seed: 7 }
];
animals.forEach((animal) => {
  animal.growth = 1;
  animal.targetGrowth = 1;
});

function updateSoundButton() {
  const button = document.querySelector('#sound');
  button.classList.toggle('active', soundOn);
  button.setAttribute('aria-pressed', String(soundOn));
  button.setAttribute('aria-label', soundOn ? '关闭背景音乐' : '开启背景音乐');
  button.title = soundOn ? '关闭背景音乐' : '开启背景音乐';
  button.textContent = soundOn ? '♫' : '♪';
}

async function startMusic() {
  if (!musicWanted || document.hidden || window.ipadAppPaused) return;
  // iPad 系统选择器可能让旧音频上下文一直处于 interrupted；下一次触摸重新建立它。
  if (audio?.state === 'interrupted' || audio?.state === 'closed') {
    music?.stop();
    audio.close().catch(() => {});
    audio = null;
    music = null;
    musicStarting = false;
  }
  if (musicStarting) {
    // 选曲可能先触发被浏览器挂起的 resume；下一次真实点击必须能够解除挂起。
    if (audio?.state === 'suspended') audio.resume().catch(() => {});
    return;
  }
  musicStarting = true;
  let startingContext = null;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    startingContext = audio;
    music ??= new FarmMusic(audio);
    music.setTrack(selectedTrack);
    music.setOutside(!['house', 'barn'].includes(scene) && !isBuildingInterior());
    await startingContext.resume();
    if (audio !== startingContext) return;
    if (musicWanted && !document.hidden && !window.ipadAppPaused) {
      music.start();
      soundOn = true;
      updateSoundButton();
      requestLullabySleep();
    }
  } catch {
    toast('音乐暂时没能播放，可以再点一下右上角音符。');
  } finally {
    if (audio === startingContext) musicStarting = false;
  }
}

window.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('#sound') && !soundOn) startMusic();
});

function insidePolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i],
      [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Collision is tested at the character's feet, in the background's coordinates.
function canWalk(x, y) {
  const terrain =
    scene === 'farm' ? onFarmGround : scene === 'house' ? onHouseFloor : scene === 'barn' ? onBarnFloor : isBuildingInterior() ? onBuildingFloor : onExploreGround;
  // 马的四蹄占地比人物宽；窄楼梯和门前通道要下马后才能走。
  const halfWidth = riding ? 60 * sceneScale(y) : 8,
    halfDepth = riding ? 22 * sceneScale(y) : 8;
  if (scene === 'farm' && riding && !horseClearOfWater(x, y)) return false;
  if (!canPushAnimalAt(x, y)) return false;
  return [
    [0, 0],
    [halfWidth, 0],
    [-halfWidth, 0],
    [0, halfDepth],
    [0, -halfDepth]
  ].every(([dx, dy]) => terrain(x + dx, y + dy));
}

function horseClearOfWater(x, y) {
  const scale = 0.82 + ((y - 441) / 539) * 0.42;
  const halfWidth = 193 * scale * 0.77,
    halfDepth = 35 * scale;
  // Use the whole horse's width, in either facing direction. The narrow dock
  // is for walking on foot; it cannot contain this footprint safely.
  for (const polygon of [shoreline, dock]) {
    if (insidePolygon(x, y, polygon)) return false;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const ax = (a[0] - x) / halfWidth,
        ay = (a[1] - y) / halfDepth;
      const dx = (b[0] - a[0]) / halfWidth,
        dy = (b[1] - a[1]) / halfDepth;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      if ((ax + t * dx) ** 2 + (ay + t * dy) ** 2 <= 1) return false;
    }
  }
  return true;
}

const grid = [];
const gridMap = new Map();
function rebuildGrid() {
  // 家具和马蹄通过门洞时余量较小，24 像素网格会漏掉可走的中心线。
  const cell =
    scene === 'house' || isBuildingInterior() || (scene === 'farm' && (riding || animalTravel || animalTravelRequest)) ? 12 : CELL;
  grid.length = 0;
  gridMap.clear();
  for (let y = cell / 2; y < H; y += cell)
    for (let x = cell / 2; x < W; x += cell) {
      if (canWalk(x, y)) {
        const node = { x, y, id: `${Math.floor(x / cell)},${Math.floor(y / cell)}` };
        grid.push(node);
        gridMap.set(node.id, node);
      }
    }
}
rebuildGrid();
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function nearestNode(point, nodes = grid) {
  // 只比较距离时不用开方；宠物追随和室内寻路会反复扫描同一批网格。
  const squaredDistance = (node) => (node.x - point.x) ** 2 + (node.y - point.y) ** 2;
  return nodes.reduce(
    (best, node) => (squaredDistance(node) < squaredDistance(best) ? node : best),
    nodes[0]
  );
}

function findPath(destination, origin = player, walkable = null) {
  // 宠物可以回到自己的窝；人物绕开宠物窝，仍使用同一张基础通行网格。
  if (scene === 'house' && origin === player) {
    const suppliedWalkable = walkable;
    walkable = (node) => playerClearOfPetBeds(node.x, node.y) &&
      (!suppliedWalkable || suppliedWalkable(node));
  }
  const cell =
    scene === 'house' || isBuildingInterior() || (scene === 'farm' && (riding || animalTravel || animalTravelRequest)) ? 12 : CELL;
  const nodes = walkable ? grid.filter(walkable) : grid;
  if (!nodes.length) return [];
  const start = nearestNode(origin, nodes),
    end = nearestNode(destination, nodes);
  const canVisit = (node) => Boolean(node && (!walkable || walkable(node)));
  const open = new Set([start.id]),
    previous = new Map(),
    cost = new Map([[start.id, 0]]),
    // 一个节点的终点距离不变，只在发现更短路线时更新总评分。
    score = new Map([[start.id, distance(start, end)]]);
  while (open.size) {
    let current;
    for (const id of open) {
      const node = gridMap.get(id);
      if (
        !current ||
        score.get(id) < score.get(current.id)
      )
        current = node;
    }
    if (current.id === end.id) {
      const path = [end];
      while (previous.has(path[0].id)) path.unshift(gridMap.get(previous.get(path[0].id)));
      return path;
    }
    open.delete(current.id);
    const col = Math.floor(current.x / cell),
      row = Math.floor(current.y / cell);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1]
    ]) {
      const next = gridMap.get(`${col + dx},${row + dy}`);
      if (!canVisit(next)) continue;
      // Do not cut diagonally through the corner of a pond, rock, or fence.
      if (dx && dy && (!canVisit(gridMap.get(`${col + dx},${row}`)) ||
          !canVisit(gridMap.get(`${col},${row + dy}`))))
        continue;
      const nextCost = cost.get(current.id) + distance(current, next);
      if (nextCost < (cost.get(next.id) ?? Infinity)) {
        previous.set(next.id, current.id);
        cost.set(next.id, nextCost);
        score.set(next.id, nextCost + distance(next, end));
        open.add(next.id);
      }
    }
  }
  return [];
}

function toast(message, duration = 4) {
  document.querySelector('#toast').textContent = message;
  toastUntil = clock + duration;
}

// 同一区域有多个互动点时，最近的仍是 E，其余依距离排列给 R/T/Y。
function nearbyPlaceActions(point, radius) {
  const nearby = [];
  for (const [name, place] of Object.entries(places)) {
    if (place.x < 0 || (name === 'horse' && !animalIsHere(animals[3]))) continue;
    if (name === 'dog' && (!petIsHere(dog) || walkingDog || dog.boarded) ||
        name === 'cat' && (!petIsHere(cat) || cat.boarded || carriedPet === cat)) continue;
    const gap = (point.x - place.x) ** 2 + (point.y - place.y) ** 2;
    if (gap < radius * radius) nearby.push({ name, place, gap });
  }
  nearby.sort((a, b) => a.gap - b.gap);
  const anchor = nearby[0]?.place;
  return anchor ? nearby.filter(({ place }) => distance(place, anchor) < 95)
    .slice(0, 4).map(({ name }) => name) : [];
}

function nearestPlaceAt(point, radius) {
  return nearbyPlaceActions(point, radius)[0] ?? null;
}

function walkTo(point, place = null) {
  if (lateSleepSession) return;
  if (place === 'toilet' && toiletNeed.started !== null && distance(player, places.toilet) > 90) {
    toast('这次要你自己控制暖暖走到马桶旁，再按 E 使用。', 6);
    return;
  }
  if (petFeedingAction || shoeAction) {
    petFeedingAction = null;
    shoeAction = null;
    busyUntil = 0;
  }
  if (livingSession) stopLivingAction();
  if (bathSession) {
    finishBath();
    return;
  }
  if (sleepSession) {
    wakeUp();
    return;
  }
  if (swingSession) {
    stopSwing();
    return;
  }
  if (fishingSession) cancelFishing();
  cancelSleepPreparation();
  if (!ready || clock < busyUntil) return;
  document.querySelector('#kitchen-panel').hidden = true;
  if (scene === 'farm') {
    penGate.destination = null;
    if (!penGate.open && insidePen(player) !== insidePen(point) && place !== 'penGate') {
      if (riding) {
        animatePenGate(true, { point: { ...point }, place });
        return;
      }
      penGate.destination = { point: { ...point }, place };
      point = insidePen(player) ? { x: 535, y: 510 } : { x: 535, y: 615 };
      place = 'penGate';
    }
  }
  if (scene === 'house' && wardrobe.open) closeClothesPanel();
  if (scene === 'house') balconyDoor.destination = null;
  if (
    scene === 'house' &&
    !balconyDoor.open &&
    place !== 'balconyDoor' &&
    ((player.x < 901 && point.x > 901) || (player.x > 972 && point.x < 901))
  ) {
    balconyDoor.destination = { point: { ...point }, place };
    point = { x: player.x > 972 ? 1020 : 850, y: 520 };
    place = 'balconyDoor';
  }
  // 动物会改变可走区域；起步前更新网格，避免旧站位直接判定无路可走。
  rebuildGrid();
  route = findPath(point);
  pendingPlace = place;
  if (!route.length) {
    pendingPlace = null;
    toast('那里暂时走不到，换一片草地试试吧。');
    return;
  }
  targetMarker = { ...route[route.length - 1], until: clock + 3 };
}

function playNote(frequency, delay = 0, duration = 0.2) {
  if (!soundOn || !audio) return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, audio.currentTime + delay);
  gain.gain.linearRampToValueAtTime(0.035, audio.currentTime + delay + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + delay + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(audio.currentTime + delay);
  oscillator.stop(audio.currentTime + delay + duration);
}

function burst(icon, x, y, count = 8) {
  for (let i = 0; i < count; i++)
    effects.push({
      icon,
      x,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: -45 - Math.random() * 65,
      life: 1.8
    });
}

function interact(place = nearPlace) {
  if (lateSleepSession) {
    sleepUntilLateMorning();
    return;
  }
  if (forestAdventureSession) {
    clearForestAdventure();
    return;
  }
  if (interactBarn(place)) return;
  if (place === 'wish' && meteorWishAvailable()) {
    wishOnMeteor();
    return;
  }
  if (livingSession) {
    stopLivingAction();
    return;
  }
  if (bathSession) {
    finishBath();
    return;
  }
  if (sleepSession) {
    wakeUp();
    return;
  }
  if (swingSession) {
    stopSwing();
    return;
  }
  if (fishingSession) {
    fishingInput();
    return;
  }
  if (!place || !places[place] || clock < busyUntil || distance(player, places[place]) > 100)
    return;
  if (place === 'petMedicine') {
    updatePetMedicineRequest();
    return;
  }
  if (interactBuilding(place)) return;
  if (place === 'catCarrier' && interactCatCarrier()) return;
  if (interactHousePlants(place)) return;
  if (interactAirConditioner(place)) return;
  if (collectLeaf(place)) return;
  if (interactExploration(place)) return;
  if (place === 'animalPet') {
    startAnimalPetting();
    return;
  }
  if (riding && place === 'pond') {
    toast('先下马，再坐在小桥上钓鱼吧。');
    return;
  }
  route = [];
  pendingPlace = null;
  if (place === 'house' || place === 'exit') {
    if (animalTravel && scene === 'farm') {
      toast('农场小动物在室外散步，先把它放下来再进屋吧。');
      return;
    }
    if (riding) {
      toast('先下马，再开门进屋吧。');
      return;
    }
    doorTransition = { started: clock, destination: scene === 'farm' ? 'house' : 'farm' };
    busyUntil = clock + 1.3;
    toast('门慢慢打开了…');
    playNote(180, 0, 0.4);
    return;
  }
  if (isFarmNight() && (place === 'horse' || place === 'animals')) {
    toast('小动物正在休息，明早再骑马和喂食吧。');
    return;
  }
  if (place === 'horse') {
    mountHorse();
    return;
  }
  if (place === 'swing') {
    sitOnSwing();
    return;
  }
  if (place === 'toilet') {
    useToilet();
    return;
  }
  if (place === 'bath') {
    startBath();
    return;
  }
  if (place === 'bed') {
    startSleep();
    return;
  }
  if (place === 'nap') {
    startSleep('nap');
    return;
  }
  if (place === 'alarm') {
    openHomeAlarm();
    return;
  }
  if (place === 'curtains') {
    startCurtainPull();
    return;
  }
  if (place === 'wardrobe') {
    toggleWardrobe();
    return;
  }
  if (place === 'petCare') {
    beginPetCare();
    return;
  }
  if (place === 'animalTravel') {
    beginAnimalTravel();
    return;
  }
  if (place === 'shoeRack') {
    openShoeRack();
    return;
  }
  if (place === 'petFood') {
    feedHousePets();
    return;
  }
  if (place === 'bathroom') {
    beginLivingAction('wash');
    return;
  }
  if (place === 'litter') {
    beginLivingAction('litter');
    return;
  }
  if (place === 'sofa') {
    beginLivingAction('sofa');
    return;
  }
  if (place === 'dining') {
    beginLivingAction('eat');
    return;
  }
  if (place === 'kitchen') {
    closeClothesPanel();
    document.querySelector('#kitchen-panel').hidden = false;
    return;
  }
  if (place === 'fridge') {
    closeClothesPanel();
    document.querySelector('#kitchen-panel').hidden = true;
    openFridge();
    return;
  }
  if (place === 'penGate') {
    usePenGate(penGate.destination);
    return;
  }
  if (place === 'pen') {
    if (riding || animalTravel) {
      toast('先下马或把带着的农场动物放下，再进棚里吧。');
      return;
    }
    changeScene('barn');
    toast('走进养殖场啦，干草床和食槽都在这里。');
    return;
  }
  if (place === 'balconyDoor') {
    openBalconyDoor(balconyDoor.destination);
    return;
  }
  if (place === 'dog' || place === 'cat') {
    interactPet(place);
    return;
  }
  if (scene === 'house') {
    if (place === 'tv') {
      openTv();
    } else
      toast(
        {
          bedroom: '卧室真安静，在这里休息一会儿 ☾',
          bathroom: '洗洗手，清清爽爽 🫧',
          balcony: '阳台上有轻轻的风，还能看见农场 ☀'
        }[place]
      );
    busyUntil = clock + 0.6;
    return;
  }
  if (place === 'pond') {
    startFishing();
  } else {
    busyUntil = clock + 0.8;
    finishInteraction(place);
  }
}

function finishInteraction(place, caughtFish) {
  if (place === 'animals') {
    const feeding = feedFarmAnimals();
    if (!feeding.available) {
      toast('小动物现在不在围栏里，等它们回来再喂吧。');
      return;
    }
    if (!feeding.fed) {
      toast('今天已经喂过了，等明天再添饲料吧。');
      return;
    }
    feedingStarted = clock;
    pocket.hearts++;
    toast('添好今天一顿饲料啦，小动物慢慢吃饱，幼崽会一天天长大！收获一颗爱心 ♡', 6);
    burst('♡', 415, 530);
  } else if (place === 'flowers') {
    pocket.flowers++;
    toast('采到一朵小雏菊，把春天装进口袋 🌼');
    burst('🌼', player.x, player.y - 95, 5);
  } else {
    pocket.fish++;
    lastCaughtFish = caughtFish || chooseCatch();
    const isNewSpecies = !caughtSpecies.has(lastCaughtFish.species.name) &&
      !hasDiscovery(`fish-${lastCaughtFish.species.name}`);
    // 只有成功上岸才计入见过的鱼，逃脱不影响首次发现台词。
    caughtSpecies.add(lastCaughtFish.species.name);
    recordDiscovery(`fish-${lastCaughtFish.species.name}`);
    catchUntil = clock + 4.5;
    const fishDialog = document.querySelector('#fish-dialog');
    const fishPicture = document.querySelector('#caught-fish-picture');
    const preview = fishPicture.getContext('2d'),
      width = 360 * lastCaughtFish.scale,
      height = width * 2 / 3;
    preview.clearRect(0, 0, fishPicture.width, fishPicture.height);
    drawCaughtFish(preview, lastCaughtFish, (360 - width) / 2, (240 - height) / 2, width, height);
    fishPicture.setAttribute('aria-label', `${lastCaughtFish.species.name}，${lastCaughtFish.label}`);
    document.querySelector('#caught-fish-name').textContent = lastCaughtFish.species.name;
    document.querySelector('#caught-fish-description').textContent =
      `${isNewSpecies ? '第一次钓到这种鱼！' : '又见到它啦！'}这条是${lastCaughtFish.label}，已经放进背包。`;
    fishDialog.showModal();
    toast(lastCaughtFish.message, 5);
    sayFishCatch(isNewSpecies, lastCaughtFish.label);
    burst('✨', player.x, player.y - 95, 8);
  }
  document.querySelector('#inventory').textContent =
    `🌼 ${pocket.flowers}　🐟 ${pocket.fish}　♡ ${pocket.hearts}`;
  playNote(523);
  playNote(659, 0.12);
  playNote(784, 0.24);
}

function update(dt) {
  // 先推进动作和门的状态，再处理移动，最后更新动物、宠物和界面。
  // 这个顺序让本帧结束的动作及时释放 busyUntil，也让开门后重建的路径生效。
  clock += dt;
  if (
    fishingSession &&
    ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'w', 'a', 's', 'd'].some((key) =>
      keys.has(key)
    )
  )
    cancelFishing();
  updateFishing(dt);
  updateSwing(dt);
  updateBalconyDoor();
  updateToilet(dt);
  updateBath();
  updateHygiene(dt);
  updateIPadNeeds(dt);
  updateHome();
  updateHousePlants(dt);
  updateAirConditioner(dt);
  updateLullabySleep();
  updateLiving();
  updateMealTime();
  updateShoeAction();
  updateFarmTime(dt);
  updateFridge(dt);
  updateLateSleep();
  updateFarmClimate(dt);
  updateBuildingHealth(dt);
  updatePetHealth(dt);
  updateMedicineBox();
  updateTv();
  updateMeteor(dt);
  updateFireflies(dt);
  updateForestAdventure(dt);
  updateMarket(dt);
  updateHailHazard(dt);
  updateHomeCurtains();
  updateFarm(dt);
  updateHerding(dt);
  if (sleepSession && movementKeys.some((key) => keys.has(key))) wakeUp();
  if (doorTransition && clock - doorTransition.started >= 1.25) {
    const transition = doorTransition;
    changeScene(transition.destination, transition.arrival);
  }
  const isBusy = clock < busyUntil;
  if (!isBusy && busyUntil > 0) {
    busyUntil = 0;
  }
  let dx =
    Number(keys.has('ArrowRight') || keys.has('d')) -
    Number(keys.has('ArrowLeft') || keys.has('a'));
  let dy =
    Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
  const keyboardMoving = dx || dy;
  if (
    scene === 'house' &&
    keyboardMoving &&
    !balconyDoor.open &&
    balconyDoor.started === null &&
    player.y > 498 &&
    player.y < 545 &&
    ((dx > 0 && player.x > 850 && player.x < 901) || (dx < 0 && player.x > 972 && player.x < 1030))
  ) {
    openBalconyDoor();
  }
  if (keyboardMoving && swingSession) stopSwing();
  if (keyboardMoving) {
    route = [];
    pendingPlace = null;
    if (balconyDoor.started === null) balconyDoor.destination = null;
  }
  if (keyboardMoving && penGate.started === null) penGate.destination = null;
  if (!keyboardMoving && route.length) {
    const next = route[0];
    // 走到网格中心再转弯；提前跳过节点会切进家具的碰撞边缘并卡住。
    if (distance(player, next) < 0.1) route.shift();
    if (route.length) {
      dx = route[0].x - player.x;
      dy = route[0].y - player.y;
    }
  }
  player.walking = !isBusy && clock >= busyUntil && !!(dx || dy);
  if (player.walking) {
    const oldX = player.x,
      oldY = player.y;
    const length = Math.hypot(dx, dy),
      speed = riding ? (keys.has('Shift') ? 290 : 210) : keys.has('Shift') ? 235 : 145;
    const step = Math.min(speed * dt, keyboardMoving ? Infinity : length);
    const nextX = player.x + (dx / length) * step,
      nextY = player.y + (dy / length) * step;
    if (canWalk(nextX, player.y) && (scene !== 'house' || playerClearOfPetBeds(nextX, player.y))) player.x = nextX;
    if (canWalk(player.x, nextY) && (scene !== 'house' || playerClearOfPetBeds(player.x, nextY))) player.y = nextY;
    player.walking = Math.hypot(player.x - oldX, player.y - oldY) > 0.01;
    if (!player.walking && !keyboardMoving && route.length && clock >= (player.nextRepath || 0)) {
      // 动物会走进原来的路线：重新绕开它，不能一直朝同一个被挡住的点走。
      const destination = route[route.length - 1];
      rebuildGrid();
      const detour = findPath(destination).slice(1);
      if (detour.length) route = detour;
      player.nextRepath = clock + 0.8;
    }
    player.view = Math.abs(dy) > Math.abs(dx) ? (dy < 0 ? 2 : 0) : 1;
    if (player.view === 1 && dx !== 0) player.facing = dx < 0 ? -1 : 1;
    if (player.walking) player.step += dt * (keys.has('Shift') ? 12 : 8);
  }
  updateBoardingEdge();
  if (!route.length && pendingPlace) {
    const place = pendingPlace;
    pendingPlace = null;
    interact(place);
  }
  updatePets(dt);
  updatePetCare(dt);
  updatePetMedicineRequest();
  updateCatSleepPose(dt);
  updateAnimalTravel(dt);
  updateAnimalCare(dt);
  updateFarmVoices();
  if (pendingPlace === 'dog' || pendingPlace === 'cat') {
    const pet = pendingPlace === 'dog' ? dog : cat;
    if (distance(player, pet) < 85) {
      route = [];
      const kind = pendingPlace;
      pendingPlace = null;
      interact(kind);
    } else if (!route.length || distance(route[route.length - 1], pet) > 60) route = findPath(pet);
  }
  const catExit = carriedCatExitPlace();
  if (catExit && places[catExit]) {
    const gap = distance(player, places[catExit]);
    if (gap > 125) catExitArmed = true;
    if (catExitArmed && gap < 45 && clock >= busyUntil && !doorTransition) {
      catExitArmed = false;
      interact(catExit);
    }
  }
  const nearbyActions = nearbyPlaceActions(player, scene === 'farm' || scene === 'barn' ? 100 : 85);
  nearPlace = nearbyActions[0] ?? null;
  if (catExit && places[catExit] && distance(player, places[catExit]) < 110)
    nearPlace = catExit;
  if (riding) {
    const exit = scene === 'farm' ? 'travel' : scene === 'junction' ? 'returnFarm' : 'junction';
    nearPlace = places[exit] && distance(player, places[exit]) < 100 ? exit : 'dismount';
  }
  if (meteorWishAvailable()) nearPlace = 'wish';
  const regularInteraction = !lateSleepSession && !livingSession && !forestAdventureSession &&
    !bathSession && !sleepSession && !swingSession && !fishingSession && !riding &&
    !gameChoicePanelOpen() &&
    nearPlace === nearbyActions[0];
  const shortcutPlaces = regularInteraction && !isBusy ? nearbyActions : [];
  const interaction = document.querySelector('#interact');
  interaction.hidden =
    lateSleepSession || fishingSession || swingSession || sleepSession || bathSession || livingSession || forestAdventureSession
      ? false
      : !nearPlace || isBusy;
  let interactionLabel = '';
  if (lateSleepSession)
    interactionLabel = lateSleepSession.waking !== null ? '正在慢慢醒来…' : '睡到第二天中午';
  else if (livingSession)
    interactionLabel = livingSession.kind === 'sofa' ? '站起来' : '结束动作';
  else if (forestAdventureSession)
    interactionLabel = '结束森林互动';
  else if (bathSession) interactionLabel = '结束洗澡';
  else if (sleepSession)
    interactionLabel = sleepSession.waking !== null ? '正在起床…' : '起床';
  else if (swingSession)
    interactionLabel = swingSession.stopping ? '正在慢慢停稳…' : '停稳后下秋千';
  else if (fishingSession) interactionLabel = fishingLabel();
  else if (nearPlace)
    interactionLabel = nearPlace === 'dismount' ? '下马' : places[nearPlace].label;
  const interactionContent = `${interactionLabel} <kbd>E</kbd>`;
  // 保留已有按钮子节点，避免每帧重建 DOM，也避免按下/抬起之间替换点击目标。
  if (interaction.innerHTML !== interactionContent) interaction.innerHTML = interactionContent;
  document.querySelectorAll('[data-interaction-slot]').forEach((button) => {
    const slot = Number(button.dataset.interactionSlot);
    const place = shortcutPlaces[slot];
    button.hidden = !place;
    if (!place) return;
    button.dataset.place = place;
    const content = `${places[place].label} <kbd>${['E', 'R', 'T', 'Y'][slot]}</kbd>`;
    if (button.innerHTML !== content) button.innerHTML = content;
  });
  let roomHint =
    scene === 'farm'
      ? swingSession
        ? '按住「用力」荡起来 · 松开自然减速 · 停稳后下秋千'
        : riding
          ? '你正在骑马 · 点「下马」落地'
          : walkingDog
            ? '萨摩耶正跟着暖暖散步'
            : '沿着小路去探索吧'
      : scene === 'barn'
        ? '🌾 养殖场里面'
      : isBuildingInterior()
        ? { hospital: '✚ 村庄医院', petHospital: '🐾 宠物医院', bakery: '🥐 面包店', villageHouse: '⌂ 村舍', boardingHouse: '🐾 小动物寄养所' }[scene] + (nuannuanHealth.cold ? ' · 暖暖感冒了' : '')
      : player.y < 400
        ? player.x < 850
          ? '☾ 卧室'
          : '🫧 卫生间'
        : player.x > 940
          ? '☀ 阳台'
          : '📺 客厅';
  if (scene === 'house' && farmClimate.hotPeriod && homeAirTemperature() !== 'outside')
    roomHint += homeAirConditioner.on
      ? ' · 空调24°，凉快' : ' · 有点热，可以开空调';
  if (isExploring()) roomHint = explorationRoomHint();
  if (!isExploring() && (carriedPet || walkingDog))
    roomHint += ' · 点「放下 / 松绳」和伙伴歇歇脚';
  const roomHintElement = document.querySelector('#room-hint');
  if (roomHintElement.textContent !== roomHint) roomHintElement.textContent = roomHint;
  document.querySelector('#toast').classList.toggle('quiet', clock > toastUntil);
  updateExploration(dt);
  const inventory = document.querySelector('#inventory');
  const inventoryText = `🌼 ${pocket.flowers}　🐟 ${pocket.fish}　♡ ${pocket.hearts}`;
  if (inventory.textContent !== inventoryText) inventory.textContent = inventoryText;
  effects.forEach((effect) => {
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    effect.life -= dt;
  });
  effects = effects.filter((effect) => effect.life > 0);
}

function draw() {
  // 静态场景 → 身后角色及围栏 → 暖暖 → 身前角色及围栏 → 动作、夜色和提示。
  // 前后两遍绘制依脚下的 y 坐标分组，避免角色重复出现或互相错误遮挡。
  ctx.clearRect(0, 0, W, H);
  if (isBuildingInterior()) ctx.drawImage(buildingArt[scene] ?? interior, 0, 0, W, H);
  else if (scene === 'barn') ctx.drawImage(barnArt, 0, 0, W, H);
  else if (isExploring()) drawExploreBackground();
  else ctx.drawImage(scene === 'farm' ? background : interior, 0, 0, W, H);
  drawBoardingEntrance();
  drawBuildingDoorAnimation(false);
  drawSeasonGround();
  drawDogBed();
  drawAnimalBathroomPlaces();
  if (scene === 'house') drawHouseDetails();
  drawTvPreview();
  drawHousePlantLeaves();
  drawAirConditioner();
  drawFridge(false);
  drawSkyBirds();
  // Small ambient particles and rings make the meadow and pond feel alive.
  for (let i = 0; scene === 'farm' && i < 13; i++) {
    const x = 175 + i * 94 + Math.sin(clock * 0.6 + i * 2) * 27;
    const y = 550 + ((i * 137) % 330) + Math.sin(clock + i) * 10;
    ctx.globalAlpha = 0.35 + Math.sin(clock * 2 + i) * 0.2;
    ctx.fillStyle = i % 2 ? '#fff5be' : '#fffdfa';
    ctx.beginPath();
    ctx.ellipse(x, y, 3, 2, Math.sin(clock * 3), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; scene === 'farm' && i < 3; i++) {
    const phase = (clock * 0.35 + i / 3) % 1;
    ctx.strokeStyle = `rgba(224,250,255,${(1 - phase) * 0.5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(1350, 735, 12 + phase * 47, 3 + phase * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (targetMarker && targetMarker.until > clock) {
    ctx.strokeStyle = '#fffbe4bb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(targetMarker.x, targetMarker.y, 17 + Math.sin(clock * 5) * 3, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawToilet(false);
  drawAnimals(false);
  drawBarnAnimals(false);
  drawForestAdventure(false);
  drawMarket();
  drawCollectibleLeaves();
  drawBuildingPeople(false);
  drawPenFence(false);
  drawPenGate(false);
  drawDogLeash();
  drawPets(false);
  drawCarriedPet(true);
  if (scene === 'friends') drawFriends(false);
  drawSwing();
  const walkFrame = player.walking || nuannuanHealth.treatment?.phase === 'to-bed'
    ? Math.floor(player.step) % 4 : 1;
  if (
    !lateSleepSession &&
    !swingSession &&
    !sleepSession &&
    nuannuanHealth.treatment?.phase !== 'bed' &&
    !heatRescue &&
    (!bathSession || bathSession.state === 'opening') &&
    !['sofa', 'eat'].includes(livingSession?.kind)
  ) {
    const scale = sceneScale(player.y);
    const size = 193 * scale;
    const bounce = riding && player.walking
      ? Math.abs(Math.sin((player.step * Math.PI) / 2)) * 3
      : 0;
    const hailLift = hailPlayerLift();
    ctx.fillStyle = '#31441b35';
    ctx.beginPath();
    const pushed = animalTravel?.mode === 'push';
    ctx.ellipse(
      player.x - (pushed ? animalTravel.dx * 65 : 0),
      player.y - 2 - (pushed ? animalTravel.dy * 35 : 0),
      30 * scale * Math.max(0.55, 1 - hailLift / 180),
      9 * scale * Math.max(0.55, 1 - hailLift / 180),
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.save();
    ctx.translate(player.x, player.y - bounce - hailLift);
    if (animalTravel?.mode === 'push') ctx.translate(-animalTravel.dx * 65, -animalTravel.dy * 35);
    ctx.scale(riding || player.view === 1 ? player.facing : 1, 1);
    const walkAtlas = currentClothes();
    const cellW = walkAtlas.naturalWidth / 4,
      cellH = walkAtlas.naturalHeight / 3;
    const spriteWidth = (size * cellW) / cellH;
    if (fishingSession) {
      const pose = {
        casting: 0,
        waiting: 1,
        biting: 1,
        hooking: 2,
        reeling: 3,
        landing: 2,
        escaped: 1
      }[fishingSession.state];
      const region = (fishingOutfitRegions[outfit] ?? fishingRegions)[pose],
        poseWidth = (size * region.width) / region.height;
      ctx.rotate(fishingSession.state === 'reeling' ? Math.sin(clock * 6) * 0.018 : 0);
      ctx.drawImage(
        outfit === 'down' ? downFishingPose : outfit === 'blue' ? blueFishingPose : fishingPose,
        region.x,
        region.y,
        region.width,
        region.height,
        -poseWidth / 2,
        -size + 3,
        poseWidth,
        size
      );
    } else if (riding) {
      // 骑乘图包含完整人物与马，必须随裙子选图，不能固定绘制粉裙版本。
      const ridingAtlas = outfit === 'down' ? downRider : outfit === 'blue' ? blueRider : rider;
      const rw = ridingAtlas.naturalWidth / 2,
        rh = ridingAtlas.naturalHeight / 2;
      const mountProgress = Math.min(1, (clock - mountStarted) / 0.8);
      // 上马前后互斥绘制，不能把整套骑乘图和马/人物半透明叠在一起。
      if (mountProgress < 0.55) {
        const horse = animalRegions[3];
        const climb = mountProgress / 0.55;
        const easedClimb = climb * climb * (3 - 2 * climb);
        const idle = idleRidingRegions[outfit];
        const seatedWidth = size * 1.07 * idle.width / idle.height;
        const horseWidth = animals[3].width + (seatedWidth - animals[3].width) * easedClimb;
        const horseHeight = animals[3].height + (size * 0.78 - animals[3].height) * easedClimb;
        ctx.drawImage(
          animalAtlas,
          horse.x,
          horse.y,
          horse.width,
          horse.height,
          -horseWidth / 2,
          -horseHeight,
          horseWidth,
          horseHeight
        );
        const from = mountSession?.fromPlayer ?? player;
        const offsetX = (from.x - player.x) * player.facing * (1 - easedClimb);
        const offsetY = (from.y - player.y) * (1 - easedClimb);
        const hop = Math.sin(climb * Math.PI) * size * 0.15 + easedClimb * size * 0.38;
        const region = walkingFrameRegion(walkAtlas, 1, 1);
        const pixelScale = size / cellH;
        ctx.drawImage(
          walkAtlas,
          region.x,
          region.y,
          region.width,
          region.height,
          -spriteWidth / 2 + offsetX,
          -region.footBottom * pixelScale + offsetY - hop,
          spriteWidth,
          region.height * pixelScale
        );
      } else if (!player.walking) {
        const region = idleRidingRegions[outfit];
        const height = size * 1.07, width = height * region.width / region.height;
        ctx.drawImage(idleRider, region.x, region.y, region.width, region.height,
          -width / 2, -height + 3, width, height);
      } else
        ctx.drawImage(
          ridingAtlas,
          (walkFrame % 2) * rw,
          Math.floor(walkFrame / 2) * rh,
          rw,
          rh,
          -size * 0.77,
          -size * 1.07,
          size * 1.54,
          size * 1.07
        );
    } else {
      const region = walkingFrameRegion(walkAtlas, player.view, walkFrame);
      const pixelScale = size / cellH;
      ctx.drawImage(
        walkingAtlasWithFootwear(walkAtlas),
        region.x,
        region.y,
        region.width,
        region.height,
        -spriteWidth / 2,
        -region.footBottom * pixelScale,
        spriteWidth,
        region.height * pixelScale
      );
    }
    ctx.restore();
    drawPlayerDirt(size);
    const faceColor = clock < nuannuanHealth.vomitUntil ? '#8cc36b'
      : toiletNeed.started !== null ? '#e98785' : null;
    canvas.dataset.playerFace = faceColor === '#8cc36b' ? 'green'
      : faceColor ? 'red' : 'normal';
    if (faceColor && !riding && player.view !== 2) {
      ctx.save();
      ctx.fillStyle = faceColor;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.ellipse(player.x + (player.view === 1 ? player.facing * 5 : 0),
        player.y - size * 0.76, size * 0.16, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (clock < nuannuanHealth.vomitUntil) {
      ctx.save();
      ctx.font = `${Math.round(size * 0.24)}px sans-serif`;
      ctx.fillText('🤢', player.x + size * 0.27, player.y - size * 0.91);
      ctx.fillStyle = '#a5ba76';
      for (let i = 0; i < 5; i++) {
        const fall = (clock * 2.4 + i / 5) % 1;
        ctx.beginPath();
        ctx.ellipse(player.x + player.facing * (size * 0.12 + 18 * fall),
          player.y - size * 0.65 + size * 0.55 * fall,
          2 + fall * 2, 3 + fall * 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (clock < busyUntil && !fishingSession && !toiletSession && !forestAdventureSession && !nuannuanHealth.treatment && !petVetVisit && hailLift === 0) {
      ctx.font = '28px sans-serif';
      ctx.fillText(nearPlace === 'pond' ? '🎣' : '♡', player.x + 55, player.y - size / 2);
    }
  }
  drawFridge(true);
  drawAnimals(true);
  drawBarnAnimals(true);
  drawForestAdventure(true);
  drawMarket(true);
  drawBuildingPeople(true);
  drawPets(true);
  if (scene === 'friends') drawFriends(true);
  drawPenFence(true);
  drawPenGate(true);
  drawPetPlay();
  effects.forEach((effect) => {
    ctx.globalAlpha = Math.min(1, effect.life);
    ctx.font = '25px sans-serif';
    ctx.fillStyle = '#ed86a0';
    ctx.fillText(effect.icon, effect.x, effect.y);
  });
  ctx.globalAlpha = 1;
  canvas.dataset.position = `${Math.round(player.x)},${Math.round(player.y)}`;
  canvas.dataset.walking = String(player.walking);
  canvas.dataset.animation = `${player.view}:${walkFrame}`;
  canvas.dataset.feeding = String(clock - feedingStarted < 6);
  canvas.dataset.scene = scene;
  canvas.dataset.shoes = currentShoes().kind;
  canvas.dataset.socks = footwear.socks;
  canvas.dataset.riding = String(riding);
  canvas.dataset.tv = String(tvOn);
  canvas.dataset.balconyDoor =
    balconyDoor.started !== null ? 'moving' : balconyDoor.open ? 'open' : 'closed';
  canvas.dataset.fishing = fishingSession?.state ?? 'idle';
  canvas.dataset.dogWalking = String(walkingDog);
  drawFishingGear();
  drawBigFish();
  if (doorTransition?.building) drawBuildingDoorAnimation(true);
  else drawDoorAnimation();
  drawBuildingAction();
  drawPetHospitalDetails();
  drawToilet();
  drawBath();
  drawLivingAction();
  drawForestAction();
  drawBedAction();
  drawLateSleep();
  drawHomeAlarm();
  drawShoeAction();
  drawPetFeeding();
  drawPlantWatering();
  drawAirConditionerAir();
  drawCurtainAction();
  drawPetCare();
  drawCarriedPet(false);
  drawHeldFarmAnimal();
  drawFarmNight();
  drawFireflies();
  drawMeteor();
  drawFarmWeather();
  drawFarmVoiceBubble();
  recordAnimalCareState();
}

function animalPose(animal) {
  const resting = farmAnimalPosition(animal);
  const bathroom = animalBathroomPose(animal);
  if (bathroom)
    return {
      x: resting.x,
      y: resting.y,
      angle: Math.sin(clock * 2) * 0.015 * bathroom.crouch,
      squash: 1 - bathroom.crouch * 0.25
    };
  if (isFarmNight() || animal.restMoving)
    return {
      x: resting.x,
      y: resting.y - (animal.restMoving ? Math.abs(Math.sin(clock * 5 + animal.seed)) * 3 : 0),
      angle: 0,
      squash: animal.sleeping ? 1 + Math.sin(clock * 1.4 + animal.seed) * 0.008 : 1
    };
  const elapsed = clock - (animal.fedAt ?? -Infinity);
  const active = elapsed >= 0 && elapsed < 6;
  const response = active ? Math.sin((Math.PI * elapsed) / 6) : 0;
  const approach = response * (animal.cell < 5 ? 30 : 38);
  const direction = animal.x < 330 ? 1 : -1;
  const hop =
    active && elapsed < 2 ? Math.abs(Math.sin(elapsed * 7 + animal.seed)) * 17 * response : 0;
  const peck = active && elapsed > 1.4 ? Math.sin(elapsed * 9 + animal.seed) * 0.09 * response : 0;
  return {
    x: resting.x + direction * approach,
    y:
      resting.y -
      hop -
      (animal.walking ? Math.abs(Math.sin((animal.stride || 0) * Math.PI)) * 3.5 : 0),
    angle:
      peck +
      (animal.walking
        ? Math.sin((animal.stride || 0) * Math.PI) * 0.018
        : Math.sin(clock * 1.7 + animal.seed) * 0.02),
    squash:
      1 +
      Math.sin(clock * 1.8 + animal.seed) * 0.015 +
      (active ? Math.sin(elapsed * 8) * 0.025 * response : 0)
  };
}

function drawAnimals(front) {
  const poses = animals
    .map((animal) => {
      const groundY = farmAnimalPosition(animal).y;
      // 行走的上下起伏不改变前后关系；邻近脚位保留少量容差，防止遮挡反复交换。
      if (animal.drawDepth === undefined || Math.abs(groundY - animal.drawDepth) > 6)
        animal.drawDepth = groundY;
      return { animal, pose: keepFarmAnimalPoseInsidePen(animal, animalPose(animal)) };
    })
    .sort((a, b) => a.animal.drawDepth - b.animal.drawDepth || a.animal.cell - b.animal.cell);
  for (const { animal, pose } of poses) {
    if (!animalIsHere(animal) || (animalTravel?.animal === animal && animalTravel.mode === 'hold'))
      continue;
    if (typeof front === 'boolean' && farmAnimalPosition(animal).y > player.y !== front) continue;
    if (riding && animal.cell === 3) continue;
    const region = animalRegions[animal.cell];
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
    ctx.scale(1, pose.squash);
    const width = animal.width * animal.growth,
      height = animal.height * animal.growth;
    drawAnimalWalk(animal, region, width, height);
    ctx.restore();
    if (animal.sleeping) {
      const crop = sleepingAnimalRegions[animal.cell];
      drawSleepMark(pose.x, pose.y - (width * crop.height) / crop.width - 12);
    }
    drawAnimalBathroomDetails(animal, pose.x, pose.y);
  }
  const elapsed = clock - feedingStarted;
  if (scene === 'farm' && front !== true && elapsed >= 0 && elapsed < 6) {
    ctx.fillStyle = '#d7a148';
    for (let i = 0; i < 14; i++) {
      const x = 280 + ((i * 29) % 156),
        y = 489 + ((i * 17) % 24);
      ctx.beginPath();
      ctx.ellipse(x, y, 3, 1.5, i, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  canvas.dataset.animalPositions = animals
    .map((a) => {
      const p = farmAnimalPosition(a);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(';');
  canvas.dataset.animalWalking = animals.map((a) => String(a.walking || a.restMoving)).join(',');
}

// 验收时用 ?perf=1 开启真实浏览器采样；普通游玩不计时、不写性能属性。
// RAF 间隔包含浏览器绘制/调度，update/draw 是本页 JavaScript 执行耗时，不能互相冒充。
const performanceSample = /(?:^|[?&])perf=1(?:&|$)/.test(window.location?.search || '')
  ? { last: null, started: null, intervals: [], updates: [], draws: [] } : null;

function sampleFramePerformance(time, updateMs, drawMs) {
  const sample = performanceSample;
  if (sample.last !== null) sample.intervals.push(time - sample.last);
  sample.last = time;
  if (sample.started === null) sample.started = time;
  sample.updates.push(updateMs);
  sample.draws.push(drawMs);
  const elapsed = time - sample.started;
  if (elapsed < 1000 || !sample.intervals.length) return;
  const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const percentile95 = (values) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1];
  canvas.dataset.fps = (sample.intervals.length * 1000 / elapsed).toFixed(1);
  canvas.dataset.frameMs = average(sample.intervals).toFixed(2);
  canvas.dataset.frameP95Ms = percentile95(sample.intervals).toFixed(2);
  canvas.dataset.updateMs = average(sample.updates).toFixed(2);
  canvas.dataset.updateP95Ms = percentile95(sample.updates).toFixed(2);
  canvas.dataset.drawMs = average(sample.draws).toFixed(2);
  canvas.dataset.drawP95Ms = percentile95(sample.draws).toFixed(2);
  canvas.dataset.perfWindowMs = elapsed.toFixed(0);
  canvas.dataset.perfScene = scene;
  canvas.dataset.perfFrames = String(sample.updates.length);
  canvas.dataset.perfSampling = 'active';
  sample.started = time;
  sample.intervals = [];
  sample.updates = [];
  sample.draws = [];
}

function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.04);
  lastTime = time;
  if (
    ready &&
    !document.hidden &&
    !window.ipadAppPaused &&
    !pausedGameDialogs.some((dialog) => dialog.open)
  ) {
    if (performanceSample) {
      const started = performance.now();
      update(dt);
      const updated = performance.now();
      draw();
      sampleFramePerformance(time, updated - started, performance.now() - updated);
    } else {
      update(dt);
      draw();
    }
  } else if (performanceSample) {
    // 后台或暂停界面不产生游戏帧，下一次游玩重新开始采样，排除暂停时间。
    performanceSample.last = performanceSample.started = null;
    performanceSample.intervals = [];
    performanceSample.updates = [];
    performanceSample.draws = [];
    if (canvas.dataset.perfSampling !== 'paused') canvas.dataset.perfSampling = 'paused';
  }
  requestAnimationFrame(frame);
}

const movementKeys = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
  'Shift'
];
let petReleaseTimer = null;
let petReleaseHeld = false;

function releaseCarriedPetOrDog() {
  if (carriedPet) {
    requestPetCare('release', carriedPet.kind);
    return true;
  }
  if (walkingDog) {
    stopDogWalk();
    return true;
  }
  return false;
}

function cancelPetReleaseTimer() {
  if (petReleaseTimer !== null) clearTimeout(petReleaseTimer);
  petReleaseTimer = null;
}

window.addEventListener('keydown', (event) => {
  if (event.target?.closest?.('select, #activity-drawer, #toggle-activities')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (gameDialogOpen()) return;
  if (movementKeys.includes(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (movementKeys.includes(key) && !soundOn) startMusic();
  if (key === 'e') {
    keys.add('e');
    event.preventDefault();
    if (event.repeat) return;
    if ((carriedPet || walkingDog) && !fishingSession && !riding) {
      petReleaseHeld = false;
      cancelPetReleaseTimer();
      petReleaseTimer = setTimeout(() => {
        petReleaseTimer = null;
        petReleaseHeld = releaseCarriedPetOrDog();
      }, 650);
    } else if (riding && nearPlace === 'dismount') dismountHorse();
    else interact();
  }
  if (['r', 't', 'y'].includes(key) && !event.repeat &&
      !lateSleepSession && !livingSession && !forestAdventureSession && !bathSession &&
      !sleepSession && !swingSession && !fishingSession && !riding &&
      !gameChoicePanelOpen() && clock >= busyUntil) {
    const slot = { r: 1, t: 2, y: 3 }[key];
    const actions = nearbyPlaceActions(player, scene === 'farm' || scene === 'barn' ? 100 : 85);
    if (actions[slot]) {
      event.preventDefault();
      interact(actions[slot]);
    }
  }
  if (key === 'q' && !event.repeat) {
    event.preventDefault();
    cancelPetReleaseTimer();
    petReleaseHeld = releaseCarriedPetOrDog();
  }
  if (key === ' ' && swingSession) {
    event.preventDefault();
    if (!swingSession.stopping) keys.add(' ');
  }
  if (key === 'Escape' && swingSession) stopSwing();
  if (key === 'Escape' && sleepSession) wakeUp();
  if (key === 'Escape' && bathSession) finishBath();
  if (key === 'Escape' && livingSession) stopLivingAction();
  if (key === 'Escape' && plantCare) stopPlantCare();
  if (key === 'Escape' && wardrobe.open) toggleWardrobe();
  if (key === 'Escape' && fishingSession) cancelFishing();
});
window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  keys.delete(key);
  if (key === 'e' && petReleaseTimer !== null) {
    cancelPetReleaseTimer();
    if (!petReleaseHeld && !gameDialogOpen()) interact();
  }
  if (key === 'e') petReleaseHeld = false;
});
window.addEventListener('blur', () => {
  keys.clear();
  cancelPetReleaseTimer();
});
document.addEventListener('visibilitychange', () => {
  keys.clear();
  if (document.hidden) cancelPetReleaseTimer();
  if (document.hidden) {
    music?.stop();
    stopFlushSound();
    stopBathSound();
    stopFarmVoices();
    soundOn = false;
    updateSoundButton();
  } else if (musicWanted && audio) startMusic();
});
canvas.addEventListener('pointerdown', (event) => {
  if (gameDialogOpen()) return;
  canvas.focus();
  const rect = canvas.getBoundingClientRect();
  // CSS can letterbox the canvas, so map clicks through the displayed image rectangle.
  const scale = Math.min(rect.width / W, rect.height / H);
  const point = {
    x: (event.clientX - rect.left - (rect.width - W * scale) / 2) / scale,
    y: (event.clientY - rect.top - (rect.height - H * scale) / 2) / scale
  };
  if (point.x < 0 || point.x > W || point.y < 0 || point.y > H) return;
  if (scene === 'junction' &&
      ((point.x > 900 && point.x < 1080 && point.y > 85 && point.y < 210) ||
        (point.x > 870 && point.x < 1030 && point.y >= 210 && point.y < 390))) {
    walkTo(places.village, 'village');
    return;
  }
  // 门优先于跟随宠物的轮廓，带猫狗出门时点击门口仍能进屋。
  const clickedDoor = Object.entries(buildingDoors[scene] ?? {}).find(([, door]) => {
    const panel = door.hitArea ?? door.panel;
    return panel && point.x >= panel.x && point.x <= panel.x + panel.width &&
      point.y >= panel.y - panel.height && point.y <= panel.y;
  });
  if (clickedDoor) {
    walkTo(places[clickedDoor[0]], clickedDoor[0]);
    return;
  }
  {
    // 前景宠物优先；点击轮廓随行走、进食和趴睡贴图变化。
    const pet = [...pets].sort((a, b) => b.y - a.y).find((candidate) => {
      const bounds = petHitBounds(candidate);
      return bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y && point.y <= bounds.y + bounds.height;
    });
    if (pet) {
      if (pet === cat) requestPetCare('hold', 'cat');
      else walkTo(places[pet.kind], pet.kind);
      return;
    }
  }
  if (scene === 'forest') {
    const animal = forestWildlife.find((candidate) => {
      const pose = forestAnimalPose(candidate);
      return Math.abs(point.x - pose.x) < candidate.width * 0.55 &&
        point.y < pose.y && point.y > pose.y - candidate.height;
    });
    if (animal) {
      walkTo(places[animal.key], animal.key);
      return;
    }
  }
  const place = nearestPlaceAt(point, 65);
  if (scene === 'house') {
    const stove = kitchenLayout.hitArea;
    if (point.x >= stove.x && point.x <= stove.x + stove.width &&
        point.y >= stove.y && point.y <= stove.y + stove.height) {
      walkTo(places.kitchen, 'kitchen');
      return;
    }
    const fridgeRect = fridgeLayout;
    if (point.x >= fridgeRect.x && point.x <= fridgeRect.x + fridgeRect.width &&
        point.y >= fridgeRect.y && point.y <= fridgeRect.y + fridgeRect.height) {
      walkTo(places.fridge, 'fridge');
      return;
    }
    const { x, y, width, height } = airConditionerLayout;
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
      walkTo(places.airConditioner, 'airConditioner');
      return;
    }
    const plant = housePlants.find(({ leaves: [x, y, width, height] }) =>
      point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height + 30);
    if (plant) {
      walkTo(plant.stand, plant.key);
      return;
    }
  }
  if (scene === 'farm' && point.x > 930 && point.x < 1070 && point.y > 330 && point.y < 445) {
    walkTo(places.house, 'house');
    return;
  }
  const horseHere = animals[3], horseGround = farmAnimalPosition(horseHere);
  if (scene === 'farm' && !riding && animalIsHere(horseHere) &&
      Math.abs(point.x - horseGround.x) < horseHere.width * horseHere.growth / 2 &&
      point.y > horseGround.y - horseHere.height * horseHere.growth && point.y < horseGround.y + 8) {
    requestAnimalTravel('horse', 'ride');
    return;
  }
  if (scene === 'house' && point.x > 450 && point.x < 585 && point.y > 380 && point.y < 444) {
    walkTo(places.tv, 'tv');
    return;
  }
  if (scene === 'house' && point.x > 350 && point.x < 605 && point.y > 505 && point.y < 600) {
    walkTo(places.sofa, 'sofa');
    return;
  }
  if (scene === 'house' && point.x > 608 && point.x < 781 && point.y > 560 && point.y < 649) {
    walkTo(places.dining, 'dining');
    return;
  }
  if (scene === 'house') {
    const rack = shoeRackLayout.bounds;
    if (point.x >= rack.x && point.x <= rack.x + rack.width &&
        point.y >= rack.y && point.y <= rack.y + rack.height) {
      walkTo(places.shoeRack, 'shoeRack');
      return;
    }
  }
  if (scene === 'house' && point.x > 245 && point.x < 420 && point.y > 90 && point.y < 303) {
    walkTo(places.bed, 'bed');
    return;
  }
  if (scene === 'house' && point.x > 420 && point.x < 460 && point.y > 85 && point.y < 136) {
    walkTo(places.alarm, 'alarm');
    return;
  }
  if (scene === 'house' && point.x > wardrobeLayout.x &&
      point.x < wardrobeLayout.x + wardrobeLayout.width &&
      point.y > wardrobeLayout.y && point.y < wardrobeLayout.y + wardrobeLayout.height) {
    walkTo(places.wardrobe, 'wardrobe');
    return;
  }
  if (scene === 'house' && point.x > 1050 && point.x < 1295 && point.y > 452 && point.y < 507) {
    walkTo(places.petFood, 'petFood');
    return;
  }
  if (scene === 'house' && point.x > 916 && point.x < 990 && point.y > 90 && point.y < 202) {
    walkTo(places.toilet, 'toilet');
    return;
  }
  if (scene === 'house' && point.x > 1215 && point.x < 1340 && point.y > 140 && point.y < 340) {
    walkTo(places.bath, 'bath');
    return;
  }
  if (scene === 'house' && point.x > 902 && point.x < 972 && point.y > 498 && point.y < 625) {
    walkTo({ x: player.x > 972 ? 1020 : 850, y: 520 }, 'balconyDoor');
    return;
  }
  walkTo(place ? places[place] : point, place);
});
document.querySelectorAll('[data-place]').forEach((button) =>
  button.addEventListener('click', () => {
    const place = button.dataset.place;
    walkTo(places[place], place);
    toast(`出发，${places[place].label}！`);
  })
);
document.querySelectorAll('[data-key]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    keys.add(button.dataset.key);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    button.addEventListener(type, () => keys.delete(button.dataset.key));
});
document
  .querySelector('#interact')
  .addEventListener('click', () => (riding && nearPlace === 'dismount' ? dismountHorse() : interact()));
document.querySelector('#interaction-actions').addEventListener('click', (event) => {
  const button = event.target.closest('[data-interaction-slot]');
  if (!button || button.hidden || gameChoicePanelOpen() || clock < busyUntil) return;
  const actions = nearbyPlaceActions(player, scene === 'farm' || scene === 'barn' ? 100 : 85);
  if (actions[Number(button.dataset.interactionSlot)] === button.dataset.place) interact(button.dataset.place);
});
document.querySelector('#pump-swing').addEventListener('pointerdown', (event) => {
  if (!swingSession || swingSession.stopping) return;
  event.preventDefault();
  keys.add(' ');
  event.currentTarget.setPointerCapture(event.pointerId);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  document.querySelector('#pump-swing').addEventListener(type, () => keys.delete(' '));
document.querySelector('#interact').addEventListener('pointerdown', (event) => {
  if (fishingSession?.state === 'reeling') {
    keys.add('e');
    event.currentTarget.setPointerCapture(event.pointerId);
  }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  document.querySelector('#interact').addEventListener(type, () => keys.delete('e'));
document.querySelector('#help').addEventListener('click', () => {
  keys.clear();
  document.querySelector('#help-dialog').showModal();
});
for (const id of ['close-help', 'start-playing'])
  document
    .querySelector(`#${id}`)
    .addEventListener('click', () => document.querySelector('#help-dialog').close());
document.querySelector('#sound').addEventListener('click', async () => {
  musicWanted = !soundOn;
  if (musicWanted) {
    await startMusic();
    if (soundOn) toast('田园背景音乐已开启 ♪');
  } else {
    music?.stop();
    stopFlushSound();
    stopBathSound();
    stopFarmVoices();
    soundOn = false;
    updateSoundButton();
    toast('声音已关闭');
  }
});
document.querySelector('#music-track').addEventListener('change', (event) => {
  selectedTrack = event.target.value;
  music?.setTrack(selectedTrack);
  requestLullabySleep();
  if (musicWanted) startMusic();
  toast(`已选择「${farmTracks[selectedTrack].name}」${musicWanted ? ' ♪' : '，点音符开启播放'}`);
});

document.querySelector('#go-house').addEventListener('click', () => walkTo(places.house, 'house'));
document
  .querySelector('#go-farm')
  .addEventListener('click', () =>
    scene === 'barn' ? interactBarn('barnExit') : isBuildingInterior() ? walkTo(places.buildingExit, 'buildingExit')
      : isExploring() ? walkTo(scene === 'junction' ? places.returnFarm : places.junction,
        scene === 'junction' ? 'returnFarm' : 'junction') : walkTo(places.exit, 'exit')
  );
document
  .querySelector('#ride-horse')
  .addEventListener('click', () => (riding ? dismountHorse() : requestAnimalTravel('horse', 'ride')));
document
  .querySelector('#walk-dog')
  .addEventListener('click', () => {
    if (walkingDog) {
      stopDogWalk();
      return;
    }
    if (dog.boarded) {
      toast('萨摩耶正在寄养所，先去办理接回，再牵它散步吧。', 6);
      return;
    }
    if (!petIsHere(dog)) {
      toast('萨摩耶留在原来的地方，找到它再牵绳吧。');
      return;
    }
    if (herdSession?.pet === dog || herdSession?.otherPet === dog) stopHerding();
    walkTo(places.dog, 'dog');
  });
document
  .querySelectorAll('[data-play-pet]')
  .forEach((button) =>
    button.addEventListener('click', () => throwPetBall(button.dataset.playPet))
  );
document.querySelector('#close-clothes').addEventListener('click', () => toggleWardrobe());
document
  .querySelector('#close-alarm')
  .addEventListener('click', () => document.querySelector('#alarm-dialog').close());
document.querySelector('#save-alarm').addEventListener('click', () => {
  const napHours = Number(document.querySelector('#nap-duration').value);
  const morningHour = Number(document.querySelector('#morning-alarm').value);
  if (![0.5, 1, 1.5].includes(napHours) || ![7, 8, 9].includes(morningHour)) return;
  homeAlarm.napHours = napHours;
  homeAlarm.morningHour = morningHour;
  document.querySelector('#alarm-dialog').close();
  toast(`闹钟设好了：午觉 ${napHours * 60} 分钟，早上 ${morningHour} 点响。`);
});
document
  .querySelectorAll('[data-outfit]')
  .forEach((button) => button.addEventListener('click', () => changeOutfit(button.dataset.outfit)));
document
  .querySelectorAll('[data-quilt]')
  .forEach((button) => button.addEventListener('click', () => changeQuilt(button.dataset.quilt)));
document.querySelectorAll('[data-room]').forEach((button) =>
  button.addEventListener('click', () => {
    if (livingSession?.kind === 'sofa' && button.dataset.room === 'tv') {
      openTv();
      return;
    }
    if (scene === 'house') {
      walkTo(places[button.dataset.room], button.dataset.room);
      if (button.dataset.room === 'wardrobe') showWardrobeGuide();
    }
  })
);

function mountHorse() {
  if (swingSession) {
    stopSwing();
    return;
  }
  if (!animalIsHere(animals[3]) || riding) return;
  if (!requireOutdoorClothes()) return;
  const horse = animals[3];
  const position = farmAnimalPosition(horse);
  if (distance(player, position) > 90 ||
      (scene === 'farm' && insidePen(player) !== insidePen(position))) {
    toast('先走到小马旁边，再上马吧。');
    return;
  }
  if (animalTravel && !releaseTravelAnimal()) return;
  if (scene === 'farm' && insidePen(position) && !penGate.open) animatePenGate(true);
  riding = true;
  const candidates = [];
  const leavingPen = scene === 'farm' && penGate.open && insidePen(position);
  if (leavingPen) {
    rebuildGrid();
    candidates.push(...grid.filter((point) => distance(point, position) <= 60 && insidePen(point)));
  } else {
    for (let dy = -60; dy <= 60; dy += 4)
      for (let dx = -60; dx <= 60; dx += 4) {
        const point = { x: position.x + dx, y: position.y + dy };
        if (distance(point, position) <= 60 && canWalk(point.x, point.y) &&
            (scene !== 'farm' || insidePen(point) === insidePen(position))) candidates.push(point);
      }
  }
  candidates.sort((a, b) => distance(a, position) - distance(b, position));
  // 门开着也可能被其他动物挡住；落点必须能接到门外草地，不能只在原地站得下。
  const landing = leavingPen
    ? candidates.find((point) => findPath({ x: 690, y: 700 }, point).length)
    : candidates[0];
  if (!landing) {
    riding = false;
    rebuildGrid();
    toast(leavingPen ? '门口或马旁暂时被挡住了，等动物让开一点再上马吧。' : '到宽一点的草地再上马吧。');
    return;
  }
  if (carriedPet) clearPetCare(carriedPet);
  if (walkingDog) stopDogWalk(null);
  mountSession = {
    scene, fromHorse: { x: position.x, y: position.y }, toHorse: landing,
    fromPlayer: { x: player.x, y: player.y }
  };
  player.x = position.x;
  player.y = position.y;
  player.facing = horse.walkFacing || 1;
  player.walking = false;
  horse.wanderTarget = null;
  horse.visitTarget = null;
  route = [];
  pendingPlace = null;
  mountStarted = clock;
  busyUntil = clock + 0.8;
  rebuildGrid();
  document.querySelector('#ride-horse').textContent = '🐴 下马';
  toast('暖暖骑上小马啦！方向键移动，E 下马。');
}

function updateHorseMount() {
  if (!mountSession) return;
  if (!riding || mountSession.scene !== scene) {
    mountSession = null;
    return;
  }
  const progress = Math.min(1, (clock - mountStarted) / 0.8);
  const eased = progress * progress * (3 - 2 * progress);
  player.x = mountSession.fromHorse.x + (mountSession.toHorse.x - mountSession.fromHorse.x) * eased;
  player.y = mountSession.fromHorse.y + (mountSession.toHorse.y - mountSession.fromHorse.y) * eased;
  if (progress === 1) mountSession = null;
}

function dismountHorse() {
  if (!riding || clock < busyUntil) return;
  updateHorseMount();
  const horse = animals[3];
  const previousScene = horse.visitScene, previousPosition = horse.visitPosition;
  horse.visitScene = scene;
  horse.visitPosition = { x: player.x, y: player.y };
  riding = false;
  const standing = [[0, 34], [-60, 20], [60, 20], [0, 45], [-72, 0], [72, 0]]
    .map(([dx, dy]) => ({ x: player.x + dx, y: player.y + dy }))
    .find((point) => canWalk(point.x, point.y) &&
      (scene !== 'farm' || insidePen(point) === insidePen(horse.visitPosition)));
  if (!standing) {
    riding = true;
    horse.visitScene = previousScene;
    horse.visitPosition = previousPosition;
    toast('旁边没有安全的落脚处，到宽一点的草地再下马吧。');
    return;
  }
  player.x = standing.x;
  player.y = standing.y;
  horse.walking = false;
  horse.visitTarget = null;
  horse.nextVisitWander = scene === 'farm' ? Infinity : clock + 4;
  updateHorseMountingPlace();
  route = [];
  pendingPlace = null;
  rebuildGrid();
  document.querySelector('#ride-horse').textContent = '🐴 骑马';
  toast(
    isExploring() ? '下马啦，小马在这里等你，还可以骑回农场。' : '下马啦，小马在这里等你，稍后还可以继续骑。'
  );
}

function changeScene(destination, arrival = null) {
  clearPetMedicineRequest();
  if (lateSleepSession) return;
  if (animalTravel && animalTravel.animal.cell !== 3 && destination !== 'farm') {
    toast('先把小动物放回养殖场，再出门吧。只有小马可以骑出去。');
    return;
  }
  closeFridge();
  stopPlantCare();
  cancelPetVetVisit();
  marketVisit = null;
  nuannuanHealth.treatment = null;
  clearForestAdventure();
  const rainReturn = herdSession?.automatic ? herdSession : null;
  stopHerding();
  clearAnimalPetting();
  // 先清理旧场景的会话和声音，再切地图；背包、衣服和成长保留本次游戏的值。
  resetPetCareForScene();
  document.querySelector('#shoes-dialog').close();
  document.querySelector('#fish-dialog').close();
  shoeAction = null;
  if (livingSession) stopLivingAction();
  document.querySelector('#kitchen-panel').hidden = true;
  if (bathSession) finishBath();
  cancelAnimalBathroom();
  stopFarmVoices();
  penGate.started = null;
  penGate.destination = null;
  penGate.progress = Number(penGate.open);
  cancelPetPlay();
  resetHomeAction();
  toiletSession = null;
  stopFlushSound();
  balconyDoor.started = null;
  balconyDoor.destination = null;
  if (swingSession) leaveSwing();
  if (fishingSession) cancelFishing();
  planDogKennelReturn();
  scene = destination;
  catExitArmed = false;
  clearMeteor();
  clearHailHazard();
  places =
    scene === 'farm' ? outdoorPlaces : scene === 'house' ? indoorPlaces : scene === 'barn' ? barnPlaces : buildingPlaces[scene] ?? explorePlaces[scene];
  player.x = scene === 'farm' ? 1007 : scene === 'house' ? houseArrival.x : 650;
  player.y = scene === 'farm' ? 500 : scene === 'house' ? houseArrival.y : 670;
  if (scene === 'barn') {
    player.x = 768;
    player.y = 820;
  }
  player.walking = false;
  player.view = 0;
  keys.clear();
  route = [];
  pendingPlace = null;
  nearPlace = null;
  effects = [];
  doorTransition = null;
  busyUntil = 0;
  catchUntil = -Infinity;
  rebuildGrid();
  bringPetsToScene();
  document.querySelector('#scene-name').textContent = scene === 'farm' ? '🌿 农场' : scene === 'barn' ? '🌾 养殖场里面' : '⌂ 暖暖的家';
  document.querySelector('#go-house').hidden = scene !== 'farm';
  document.querySelector('#ride-horse').hidden = scene !== 'farm';
  document.querySelector('#walk-dog').hidden = false;
  document.querySelector('#go-swing').hidden = scene !== 'farm';
  document.querySelector('#go-farm').hidden = scene === 'farm';
  document.querySelector('#room-buttons').hidden = scene !== 'house';
  document.querySelector('#farm-buttons').hidden = scene !== 'farm';
  document
    .querySelectorAll('[data-place]')
    .forEach((button) => (button.disabled = scene === 'house'));
  music?.setOutside(!['house', 'barn'].includes(scene) && !isBuildingInterior());
  toast(
    scene === 'house'
      ? farmClimate.hotPeriod
        ? homeAirConditioner.on ? '到家啦，换上拖鞋，空调让屋里凉快多了。'
          : '到家啦，换上拖鞋。今天很热，可以打开客厅墙上的空调。'
        : '到家啦，换上拖鞋！客厅角落的鞋架可以挑鞋子和袜子。'
      : '换好外出鞋，继续散步吧。',
    6
  );
  setupExploration();
  setupBuildingInterior();
  if (!isBuildingInterior()) document.querySelector('#go-farm').textContent =
    isExploring() && scene !== 'junction' ? '↩ 返回岔路口' : '🌿 返回农场';
  if (arrival && canWalk(arrival.x, arrival.y)) {
    player.x = arrival.x;
    player.y = arrival.y;
    if (walkingDog && petIsHere(dog) && canWalk(arrival.x, arrival.y + 35)) {
      dog.x = arrival.x;
      dog.y = arrival.y + 35;
      dog.home = { x: dog.x, y: dog.y };
      updatePetPlaceMarkers();
    }
  }
  if (isBuildingInterior()) {
    document.querySelector('#room-hint').textContent = { hospital: '✚ 村庄医院', petHospital: '🐾 宠物医院', bakery: '🥐 面包店', villageHouse: '⌂ 村舍', boardingHouse: '🐾 小动物寄养所' }[scene];
  }
  updatePetPlaceMarkers();
  if (rainReturn) herdSession = rainReturn;
  discoverMapLife();
  if (walkingDog) dogTrail = [{ x: player.x, y: player.y }];
  moveTravelAnimalToScene();
  if (carriedPet?.care) {
    // 跨地图已完成抱起，不能继续从上一张地图的坐标插值。
    carriedPet.care.started = Math.min(carriedPet.care.started, clock - 0.7);
    updatePetCare(0);
  }
  document.querySelector('#ride-horse').hidden =
    scene === 'house' || isBuildingInterior() || (!riding && !animalIsHere(animals[3]));
}

Promise.all([
  background.decode(),
  girl.decode(),
  animalAtlas.decode(),
  livestockGaitArt.decode(),
  interior.decode(),
  barnArt.decode(),
  ...Object.values(buildingArt).map((image) => image.decode()),
  veterinarianArt.decode(),
  boardingEntranceArt.decode(),
  doctorArt.decode(),
  rider.decode(),
  blueRider.decode(),
  downRider.decode(),
  idleRider.decode(),
  fridgeArt.decode(),
  fishingPose.decode(),
  downFishingPose.decode(),
  blueFishingPose.decode(),
  trout.decode(),
  fishAtlas.decode(),
  friendsArt.decode(),
  seasonalFriendsReady,
  forestWildlifeArt.decode(),
  wildlifeGaitArt.decode(),
  dogAtlas.decode(),
  catAtlas.decode(),
  boardingCatAtlas.decode(),
  petEatingReady,
  swingRider.decode(),
  blueSwingRider.decode(),
  downSwingRider.decode(),
  blueClothes.decode(),
  pajamaClothes.decode(),
  downClothes.decode(),
  robeClothes.decode(),
  bedPoses.decode(),
  quiltArt.decode(),
  catCarrierArt.decode(),
  emptyCatCarrierArt.decode(),
  medicinePouchArt.decode(),
  awakeBedPoses.decode(),
  kennelArt.decode(),
  cookingPanArt.decode(),
  mealDishesArt.decode(),
  sleepingPetsArt.decode(),
  sleepingAnimalsArt.decode(),
  ...Object.values(petProps).map((image) => image.decode()),
  fenceTexture.decode(),
  originalInterior.decode(),
  balconyFloorArt.decode(),
  doorPanelsArt.decode(),
  homeFurnitureArt.decode(),
  diningPoseArt.decode(),
  ...Object.values(sceneryMaps).map((image) => image.decode())
])
  .then(() => {
    ready = true;
    discoverMapLife();
    document.querySelector('#loading').hidden = true;
    window.dispatchEvent(new Event('farm-ready'));
    requestAnimationFrame(frame);
  })
  .catch(() => {
    document.querySelector('#loading strong').textContent = '素材没有加载成功';
    document.querySelector('#loading p').textContent = '请确认 assets 文件夹完整，再刷新页面。';
    window.dispatchEvent(new Event('farm-load-error'));
  });
