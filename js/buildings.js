// 可进入的公共建筑共用门和返回位置；室内家具、互动与行走范围仍按场景定义。
const buildingArt = { hospital: new Image(), bakery: new Image() };
const doctorArt = new Image();
doctorArt.src = 'assets/doctor.png';
buildingArt.hospital.src = 'assets/hospital.png';
buildingArt.bakery.src = 'assets/bakery-interior.png';
const buildingDoors = {
  city: {
    hospitalDoor: {
      x: 760, y: 430, label: '开门进入医院', icon: '✚', destination: 'hospital',
      panel: { x: 734, y: 378, width: 53, height: 111, native: true }
    },
    bakeryDoor: {
      x: 1247, y: 465, label: '开门进入面包店', icon: '🥐', destination: 'bakery',
      panel: { x: 1225, y: 412, width: 47, height: 116, native: true }
    }
  },
  junction: {
    villageDoor: {
      x: 1220, y: 350, label: '拜访路边的村舍', icon: '⌂', destination: 'villageHouse',
      panel: { x: 1208, y: 297, width: 31, height: 65, native: true }
    }
  },
  friends: {
    villageDoor: {
      x: 115, y: 415, label: '拜访左边的村舍', icon: '⌂', destination: 'villageHouse',
      panel: { x: 12, y: 373, width: 39, height: 81, native: true }
    },
    villageDoorRight: {
      x: 1415, y: 295, label: '拜访右边的村舍', icon: '⌂', destination: 'villageHouse',
      panel: { x: 1460, y: 244, width: 34, height: 71, native: true }
    }
  }
};
const buildingPlaces = {
  hospital: {
    buildingExit: { x: 768, y: 845, label: '打开医院门出去', icon: '↩' },
    doctor: { x: 870, y: 560, label: '找医生看病', icon: '✚' }
  },
  bakery: {
    buildingExit: { x: 768, y: 850, label: '打开面包店门出去', icon: '↩' },
    breadCounter: { x: 1000, y: 520, label: '购买新鲜面包（2 金币）', icon: '🥐' }
  },
  villageHouse: {
    buildingExit: { x: 650, y: 690, label: '打开村舍门出去', icon: '↩' },
    villageChat: { x: 810, y: 620, label: '和主人聊聊天', icon: '♡' }
  }
};
for (const room of Object.values(buildingPlaces)) {
  room.dog = { x: -10000, y: -10000, label: '牵萨摩耶散步', icon: '🐕' };
  room.cat = { x: -10000, y: -10000, label: '摸摸布偶猫', icon: '♡' };
}
let buildingReturn = null;
const nuannuanHealth = { cold: false, injured: false, exposure: 0, treatment: null };

function injureFromHail() {
  nuannuanHealth.injured = true;
  toast('哎呀，被冰雹砸伤了！先回屋躲一躲，再去医院找医生治疗。', 8);
}

function isBuildingInterior() {
  return Object.hasOwn(buildingPlaces, scene);
}

function registerBuildingDoors() {
  for (const [map, doors] of Object.entries(buildingDoors)) Object.assign(explorePlaces[map], doors);
}

function onBuildingFloor(x, y) {
  const person = ['hospital', 'petHospital'].includes(scene) ? { x: 920, y: 510 } : scene === 'bakery' ? { x: 850, y: 480 } : { x: 810, y: 535 };
  if (Math.hypot(x - person.x, y - person.y) < 20) return false;
  if (scene === 'villageHouse') return onHouseFloor(x, y);
  // 病床、药柜、操作台均在空地之外，角色不能站到家具上。
  const room = x > 430 && x < 1190 && y > 475 && y < 825;
  const rearAisle = x > 440 && x < 985 && y > 365 && y <= 475;
  const entrance = x > 645 && x < 890 && y >= 825 && y < 940;
  return room || rearAisle || entrance;
}

function startBuildingDoor(destination, arrival, panel = null) {
  if (riding || animalTravel) {
    toast('先下马、安顿好农场动物，再开门进去吧。');
    return false;
  }
  route = [];
  pendingPlace = null;
  player.walking = false;
  doorTransition = { started: clock, destination, arrival, building: true, panel };
  busyUntil = clock + 1.3;
  toast('门慢慢打开了…');
  playNote(180, 0, 0.25);
  return true;
}

function interactBuilding(place) {
  const door = buildingDoors[scene]?.[place];
  if (door) {
    if (startBuildingDoor(door.destination, null, door.panel))
      buildingReturn = { scene, point: { x: door.x, y: door.y + 48 } };
    return true;
  }
  if (!isBuildingInterior()) return false;
  if (scene === 'petHospital' && ['vetDog', 'vetCat'].includes(place)) {
    startPetVetVisit(place === 'vetDog' ? 'dog' : 'cat');
    return true;
  }
  if (place === 'buildingExit') {
    const returning = buildingReturn ?? { scene: 'city', point: { x: 620, y: 520 } };
    startBuildingDoor(returning.scene, returning.point);
    return true;
  }
  if (place === 'doctor') {
    route = [];
    pendingPlace = null;
    player.x = places.doctor.x;
    player.y = places.doctor.y;
    player.facing = 1;
    player.view = 1;
    player.walking = false;
    nuannuanHealth.treatment = {
      started: clock, treatingCold: nuannuanHealth.cold, treatingInjury: nuannuanHealth.injured
    };
    busyUntil = clock + 4;
    toast(nuannuanHealth.injured
      ? '医生正在检查冰雹砸伤的地方，稍等一会儿吧。'
      : nuannuanHealth.cold ? '医生正在检查感冒，稍等一会儿吧。' : '医生给暖暖做个小检查。');
    return true;
  }
  if (place === 'breadCounter') {
    interactMarket('picnic');
    return true;
  }
  if (place === 'villageChat') {
    toast('欢迎来做客！这里的窗户正好能看见村庄的小路。');
    burst('♡', player.x, player.y - 110, 2);
    return true;
  }
  return false;
}

function setupBuildingInterior() {
  if (!isBuildingInterior()) return;
  player.x = scene === 'villageHouse' ? 650 : 768;
  player.y = scene === 'villageHouse' ? 670 : 810;
  document.querySelector('#scene-name').textContent = {
    hospital: '✚ 村庄医院', petHospital: '🐾 宠物医院', bakery: '🥐 面包店里面', villageHouse: '⌂ 村舍里面'
  }[scene];
  document.querySelector('#go-farm').textContent = '↩ 开门出去';
  document.querySelector('#explore-buttons').hidden = false;
  document.querySelector('#explore-title').textContent = '屋里可以做什么？';
  document.querySelector('#explore-grid').innerHTML = Object.entries(places)
    .filter(([key]) => key !== 'dog' && key !== 'cat')
    .map(([key, p]) => `<button data-explore-place="${key}">${p.icon} ${p.label}</button>`).join('');
  rebuildGrid();
  toast({ hospital: '医院到了，走近医生可以检查、治疗感冒和砸伤。', petHospital: '宠物医院到了，把猫狗带到兽医面前检查吧。', bakery: '新鲜面包出炉啦，去柜台挑一份吧。', villageHouse: '进村舍做客啦，沿着客厅的空地慢慢走。' }[scene]);
}

function updateBuildingHealth(dt) {
  const treatment = nuannuanHealth.treatment;
  if (treatment && (scene !== 'hospital' || clock - treatment.started >= 4)) {
    nuannuanHealth.treatment = null;
    if (scene === 'hospital') {
      nuannuanHealth.exposure = 0;
      busyUntil = 0;
      if (nuannuanHealth.cold || nuannuanHealth.injured) {
        prescribeMedicine(nuannuanHealth);
        toast('医生开好了三天的药，每天两种。打开活动里的药盒，回家慢慢调养，今天还不会立刻好。', 8);
      } else toast('检查结束，暖暖很健康！');
    }
  }
  // 羽绒服保暖但不能代替避雨；已经感冒仍需去医院，不靠换图自动消失。
  const autumnColdWind = farmClimate.season === 2 && farmClimate.weather === 'wind';
  const autumnRain = farmClimate.season === 2 && farmClimate.weather === 'rain';
  const exposed = (autumnRain || ((isFarmWinter() || autumnColdWind) && outfit !== 'down')) &&
    !['house', 'barn'].includes(scene) && !isBuildingInterior();
  if (!exposed) nuannuanHealth.exposure = Math.max(0, nuannuanHealth.exposure - dt * 2);
  else if (!nuannuanHealth.cold) {
    const previousExposure = nuannuanHealth.exposure;
    // 秋雨淋湿衣服，受凉比单纯吹风更快：约三十秒触发游戏中的感冒。
    nuannuanHealth.exposure += dt * (autumnRain ? 3 : 1);
    if ((autumnColdWind || autumnRain) && previousExposure < 15 && nuannuanHealth.exposure >= 15)
      toast(autumnRain ? '秋雨把衣服淋湿了，快进屋避雨，别着凉啦。'
        : '秋风有点冷，穿暖和些，或者先进屋避避风吧。', 6);
    if (nuannuanHealth.exposure >= 90) {
      nuannuanHealth.cold = true;
      toast(autumnRain
        ? '淋了秋天的冷雨，暖暖感冒了，去集市的医院找医生看看吧。'
        : autumnColdWind
        ? '被秋天的冷风吹得感冒了，去集市的医院找医生看看吧。'
        : '暖暖有点感冒了。去集市的医院找医生看看吧，冬天出门要穿羽绒服。', 8);
    }
  }
  canvas.dataset.health = nuannuanHealth.injured
    ? nuannuanHealth.cold ? 'cold-and-injured' : 'injured'
    : nuannuanHealth.cold ? 'cold' : 'well';
  const status = document.querySelector('#health-status');
  status.hidden = !nuannuanHealth.injured && !nuannuanHealth.cold;
  const careHint = nuannuanHealth.course ? `用药调养中 ${nuannuanHealth.course.completedDays}/3 天 · 打开药盒` : '请去医院';
  const statusText = nuannuanHealth.injured
    ? `🩹 冰雹砸伤 · ${careHint}` : nuannuanHealth.cold ? `🌡 感冒了 · ${careHint}` : '';
  if (status.textContent !== statusText) status.textContent = statusText;
}

function drawBuildingPeople(front) {
  if (!isBuildingInterior()) return;
  const pose = ['hospital', 'petHospital'].includes(scene) ? { x: 920, y: 510, row: 4 } : scene === 'bakery' ? { x: 850, y: 480, row: 3 } : { x: 810, y: 535, row: 4 };
  if ((pose.y > player.y) !== front) return;
  if (['hospital', 'petHospital'].includes(scene)) {
    const height = 200;
    const width = 493 * height / 1491;
    ctx.drawImage(doctorArt, 267, 21, 493, 1491, pose.x - width / 2, pose.y - height, width, height);
    return;
  }
  const sprite = seasonalFriendSprite(pose.row, 0), region = sprite.region;
  const height = 185;
  ctx.drawImage(sprite.art, region.x, region.y, region.width, region.height,
    pose.x - (region.centerX - region.x) * height / region.height, pose.y - height,
    region.width * height / region.height, height);
}

function drawBuildingAction() {
  if (!nuannuanHealth.treatment || scene !== 'hospital') return;
  ctx.save();
  ctx.font = '26px sans-serif';
  ctx.fillText('🌡', player.x + 38, player.y - 88 + Math.sin(clock * 3) * 2);
  ctx.restore();
}

function drawBuildingDoorAnimation(front = false) {
  const transition = doorTransition;
  if (!transition?.building) return;
  const t = Math.min(1, (clock - transition.started) / 1.25);
  // 房门沿原图门柱落地，保持竖门的比例；不能把横向围栏门拉成房门。
  const doorway = transition.panel ?? (scene === 'villageHouse'
    ? { x: 608, y: 830, width: 46, height: 96 }
    : ['hospital', 'petHospital'].includes(scene)
      ? { x: 658, y: 905, width: 95, height: 198 }
      : scene === 'bakery' ? { x: 625, y: 922, width: 95, height: 198 } : null);
  const opening = Math.sin(Math.min(1, t / 0.75) * Math.PI / 2);
  const drawPanel = doorway && (doorway.y > player.y) === front;
  if (drawPanel && doorway.native) {
    // 源图里的门先露出暗门洞，再只移动原来这一扇门，避免静态关门留在身后重影。
    const { x, y, width, height } = doorway;
    const radius = scene === 'city' ? width * 0.4 : 1;
    ctx.save();
    ctx.fillStyle = '#292119';
    ctx.beginPath();
    ctx.roundRect(x, y - height, width, height, [radius, radius, 0, 0]);
    ctx.fill();
    ctx.translate(x, y - height);
    ctx.transform(Math.max(0.04, 1 - opening * 0.96), opening * 10 / width, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, [radius, radius, 0, 0]);
    ctx.clip();
    ctx.drawImage(sceneryMaps[scene], x, y - height, width, height, 0, 0, width, height);
    ctx.restore();
  } else if (drawPanel) drawGroundedDoor(doorPanelRegions.balcony, { x: doorway.x, y: doorway.y },
    { x: doorway.width, y: 0 }, { x: doorway.width * 0.2, y: 12 }, doorway.height, opening);
  if (front && t > 0.7) {
    ctx.save();
    ctx.fillStyle = `rgba(249,246,234,${(t - 0.7) / 0.3})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

registerBuildingDoors();
