// 猫狗的自由活动、牵绳跟随和基础绘制；照料状态由 pet-care.js 接管。

const dogAtlas = new Image(),
  catAtlas = new Image();
dogAtlas.src = 'assets/dog-walk.png';
catAtlas.src = 'assets/cat-walk.png';
let walkingDog = false;
const pets = [
  {
    kind: 'dog',
    name: '萨摩耶',
    x: 710,
    y: 680,
    home: { x: 700, y: 606 },
    width: 122,
    height: 95,
    facing: 1,
    heading: 0,
    view: 0,
    step: 0,
    walking: false,
    boarded: false,
    route: [],
    nextPlan: 0,
    affectionUntil: 0
  },
  {
    kind: 'cat',
    name: '布偶猫',
    x: 320,
    y: 695,
    home: { x: 320, y: 695 },
    width: 90,
    height: 65,
    facing: -1,
    heading: Math.PI,
    view: 0,
    step: 0,
    walking: false,
    boarded: true,
    route: [],
    nextPlan: Infinity,
    affectionUntil: 0
  }
];
const dog = pets[0],
  cat = pets[1];
for (const pet of pets) pet.scene = pet === cat ? 'boardingHouse' : 'farm';
let catFollowUntil = 0,
  nextCatFollowAt = 80;
const dogKennel = { x: 700, y: 606 };
let dogKennelReturn = null;

function planDogKennelReturn() {
  if (dog.boarded || petMedicineActive(dog) || dogKennelReturn || dog.scene !== scene || scene === 'farm' || walkingDog ||
      carriedPet === dog || dog.care || dog.indoorRestAllowed || petCareRequest?.pet === dog ||
      petVetVisit?.pet === dog || dog.playing || animalCare.session?.actor === dog ||
      (scene === 'petHospital' && petHealth.dog.sick)) return;
  const exit = places.exit || places.barnExit || places.buildingExit ||
    places.returnFarm || places.junction;
  if (!exit) return;
  const path = findPetPath(exit, dog).slice(1);
  if (!path.length && distance(dog, exit) > 30) return;
  // 离图前保存旧地图已验证的路径。主人换图后不能再借用新地图的行走网格。
  dogKennelReturn = { scene, path, travellingUntil: null };
  dog.route = [];
  dog.eatingUntil = 0;
  dog.playing = false;
  dog.sleeping = false;
}

function updateDogKennelReturn(dt) {
  const returning = dogKennelReturn;
  if (!returning) return false;
  if (dog.boarded) {
    dogKennelReturn = null;
    return false;
  }
  if (walkingDog || carriedPet === dog || dog.care || petCareRequest?.pet === dog ||
      petVetVisit?.pet === dog || dog.playing || animalCare.session?.actor === dog) {
    dogKennelReturn = null;
    return false;
  }
  if (returning.travellingUntil !== null) {
    dog.walking = false;
    if (clock < returning.travellingUntil) return true;
    dog.scene = 'farm';
    dog.x = 1010;
    dog.y = 510;
    dog.home = { ...dogKennel };
    returning.scene = 'farm';
    returning.path = [{ x: 1010, y: 606 }, { ...dogKennel }];
    returning.travellingUntil = null;
  }
  while (returning.path.length && distance(dog, returning.path[0]) < 1)
    returning.path.shift();
  dog.walking = false;
  if (!returning.path.length) {
    if (returning.scene === 'farm') {
      dogKennelReturn = null;
      dog.sleeping = isFarmNight();
      dog.view = 0;
      dog.nextPlan = clock + 4;
    } else {
      dog.scene = 'returning-home';
      returning.travellingUntil = clock + 8;
    }
    return true;
  }
  const target = returning.path[0], gap = distance(dog, target);
  const step = Math.min(gap, dt * (petHealth.dog.sick ? 45 : 65));
  const dx = (target.x - dog.x) / gap * step,
    dy = (target.y - dog.y) / gap * step;
  if (returning.scene === 'house') {
    const samples = Math.max(1, Math.ceil(step / 6));
    for (let i = 1; i <= samples; i++) {
      const point = { x: dog.x + dx * i / samples, y: dog.y + dy * i / samples };
      if (!onHouseFloor(point.x, point.y) || !petClearOfBalconyDoor(dog, point)) return true;
    }
  }
  dog.x += dx;
  dog.y += dy;
  dog.walking = step > 0;
  dog.step += step / (dog.width * 0.18);
  dog.heading = Math.atan2(dy, dx);
  dog.view = (Math.round(dog.heading / (Math.PI / 4)) + 8) % 8;
  if (Math.abs(dx) > 0.01) dog.facing = dx < 0 ? -1 : 1;
  return true;
}

function petIsHere(pet) {
  return pet.scene === scene;
}

function updatePetPlaceMarkers() {
  for (const pet of pets) {
    // 不在这张地图的宠物不能留下可点击的幽灵互动点。
    places[pet.kind].x = petIsHere(pet) && !pet.boarded ? pet.x : -10000;
    places[pet.kind].y = petIsHere(pet) && !pet.boarded ? pet.y : -10000;
  }
}

function updateCatFollowing(dt) {
  if (clock >= catFollowUntil && clock >= nextCatFollowAt) {
    nextCatFollowAt = clock + 90 + Math.random() * 90;
    if (scene !== 'house' && distance(cat, player) < 240 && Math.random() < 0.25)
      catFollowUntil = clock + 10 + Math.random() * 8;
  }
  if (clock >= catFollowUntil || scene === 'house') return false;
  if (distance(cat, player) < 80) {
    cat.route = [];
    cat.walking = false;
  } else {
    if (clock >= cat.nextPlan) {
      cat.route = findPetPath(player, cat).slice(1);
      cat.nextPlan = clock + 0.8;
    }
    movePet(cat, dt, 75);
  }
  return true;
}
// Measured row extents exclude neighboring tails/paws in the generated sheets.
const petRows = {
  dog: [
    [0, 215],
    [220, 218],
    [439, 215],
    [658, 225],
    [888, 195],
    [1086, 222],
    [1310, 229],
    [1540, 225]
  ],
  cat: [
    [0, 191],
    [192, 221],
    [414, 233],
    [647, 207],
    [854, 186],
    [1040, 237],
    [1278, 232],
    [1510, 250]
  ]
};
let dogTrail = [];

function updateDogButton() {
  const button = document.querySelector('#walk-dog');
  const resting = isFarmNight() && !petHealth.dog.sick;
  const label = dog.boarded ? '🐕 萨摩耶寄养中' : walkingDog ? '🐕 松开萨摩耶牵绳'
    : resting ? '☾ 萨摩耶休息中' : '🐕 遛萨摩耶';
  if (button.textContent !== label) button.textContent = label;
  button.disabled = dog.boarded || (!walkingDog && resting);
  button.setAttribute('aria-pressed', String(walkingDog));
  outdoorPlaces.dog.label = walkingDog ? '松开牵绳' : resting ? '萨摩耶正在休息' : '牵萨摩耶散步';
  indoorPlaces.dog.label = outdoorPlaces.dog.label;
  if (petIsHere(dog)) places.dog.label = outdoorPlaces.dog.label;
}

function stopDogWalk(message = '松开牵绳啦，萨摩耶会在这里自己活动。') {
  walkingDog = false;
  dog.route = [];
  dog.walking = false;
  dogTrail = [];
  dog.home = dog.scene === 'farm' ? { ...dogKennel } : { x: dog.x, y: dog.y };
  dog.nextPlan = clock + 4;
  updateDogButton();
  if (message) toast(message);
}

function interactPet(kind) {
  const pet = pets.find((p) => p.kind === kind);
  if (kind === 'dog' && walkingDog) {
    stopDogWalk();
    return;
  }
  if (pet.boarded) {
    toast(`${pet.name}正在寄养所休息，先办理接回，再一起玩吧。`, 6);
    return;
  }
  if (!petIsHere(pet)) {
    toast(`${pet.name}留在原来的地方，去找它再一起玩吧。`);
    return;
  }
  if (herdSession?.pet === pet || herdSession?.otherPet === pet) stopHerding();
  if (pet.care) {
    clearPetCare(pet);
    toast(`把${pet.name}轻轻放到地上啦。`);
    return;
  }
  if (animalCare.session?.actor.kind === kind) cancelAnimalBathroom();
  if (petVetVisit?.pet === pet) return;
  if (kind === 'dog' && isFarmNight() && !petHealth.dog.sick) {
    toast('萨摩耶该睡觉啦，明早再一起玩吧。');
    return;
  }
  if (kind === 'cat' && isCatMorning() && !petHealth.cat.sick) {
    requestPetCare('hold', 'cat');
    return;
  }
  if (clock < petNaps[kind].until) {
    petNaps[kind].until = 0;
    petNaps[kind].nextAt = clock + 100;
    pet.sleeping = false;
  }
  animalCall(kind, kind === 'dog' ? dog : cat);
  if (pets.find((p) => p.kind === kind)?.playing) cancelPetPlay();
  if (kind === 'dog') {
    if (riding) {
      toast('先下马，再牵萨摩耶散步吧。');
      return;
    }
    walkingDog = true;
    // 牵走时结束进食姿势；没吃完的这一份留在盆里，回来后重新低头吃。
    dog.eatingUntil = 0;
    dogKennelReturn = null;
    dog.indoorRestAllowed = false;
    dogTrail = [{ x: player.x, y: player.y }];
    dog.nextPlan = 0;
    dog.affectionUntil = clock + 2;
    updateDogButton();
    toast('牵好绳啦！萨摩耶会跟着暖暖走，点“松开萨摩耶牵绳”可以松开。', 6);
  } else {
    cat.route = [];
    cat.walking = false;
    cat.affectionUntil = clock + 3;
    cat.nextPlan = clock + 4;
    burst('♡', cat.x, cat.y - cat.height, 5);
    toast('摸摸布偶猫，软软的长毛，舒服得眯起了眼睛 ♡');
    playNote(440, 0, 0.25);
    playNote(523, 0.15, 0.25);
  }
}

function movePet(pet, dt, speed) {
  while (pet.route.length && distance(pet, pet.route[0]) < 4) {
    const waypoint = pet.route[0];
    if (!petMovementClear(pet, waypoint)) break;
    // 到达拐点再转向；提前丢掉拐点会让身体斜切进家具，随后卡住。
    pet.x = waypoint.x;
    pet.y = waypoint.y;
    pet.route.shift();
  }
  pet.walking = false;
  if (!pet.route.length) return;
  const next = pet.route[0],
    dx = next.x - pet.x,
    dy = next.y - pet.y;
  const length = Math.hypot(dx, dy),
    step = Math.min(speed * (petHealth[pet.kind].sick ? 0.7 : 1) * dt, length);
  const oldX = pet.x,
    oldY = pet.y;
  const nextX = pet.x + (dx / length) * step,
    nextY = pet.y + (dy / length) * step;
  if (petMovementClear(pet, { x: nextX, y: pet.y })) pet.x = nextX;
  if (petMovementClear(pet, { x: pet.x, y: nextY })) pet.y = nextY;
  const movedX = pet.x - oldX,
    movedY = pet.y - oldY,
    travelled = Math.hypot(movedX, movedY);
  pet.walking = travelled > 0.01;
  if (pet.walking) {
    // Feet advance with distance, so slower walks do not look like running in place.
    pet.step += travelled / (pet.width * 0.18);
    pet.heading = Math.atan2(movedY, movedX);
    pet.view = (Math.round(pet.heading / (Math.PI / 4)) + 8) % 8;
    if (Math.abs(movedX) > 0.01) pet.facing = movedX < 0 ? -1 : 1;
  } else {
    pet.route = [];
    pet.nextPlan = clock + 0.3;
  }
}

function petClearOfBalconyDoor(pet, point) {
  // 门口用身体宽度检查，避免脚还在门外，头和躯干已经穿过门板。
  const halfWidth = (pet === dog ? 135 : 102) * sceneScale(point.y) / 2;
  const depth = 10;
  if (point.y + depth <= 432 || point.x + halfWidth <= 901 || point.x - halfWidth >= 972)
    return true;
  return balconyDoor.open && balconyDoor.started === null &&
    point.y - depth > 498 && point.y + depth < 625;
}

function petMovementClear(pet, point) {
  const steps = Math.max(1, Math.ceil(distance(pet, point) / 6));
  for (let i = 1; i <= steps; i++) {
    const sample = { x: pet.x + (point.x - pet.x) * i / steps,
      y: pet.y + (point.y - pet.y) * i / steps };
    if (!canWalk(sample.x, sample.y) ||
        (scene === 'house' && !petClearOfBalconyDoor(pet, sample))) return false;
  }
  return true;
}

function findPetPath(destination, pet) {
  return findPath(destination, pet, (point) =>
    scene !== 'house' || petClearOfBalconyDoor(pet, point));
}

function planPetWander(pet) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const point = {
      x: pet.home.x + (Math.random() - 0.5) * 180,
      y: pet.home.y + (Math.random() - 0.5) * 100
    };
    if (canWalk(point.x, point.y)) {
      pet.route = findPetPath(point, pet).slice(1);
      break;
    }
  }
  pet.nextPlan = clock + 5 + Math.random() * 6;
}

function updatePets(dt) {
  if (isFarmNight()) planDogKennelReturn();
  const dogReturning = updateDogKennelReturn(dt);
  const dogResting = dogReturning || (petIsHere(dog) && updateNightDog(dt));
  if (!petIsHere(dog) && dog.scene === 'farm' && !dogReturning)
    dog.sleeping = isFarmNight() && distance(dog, dogKennel) < 16;
  const catResting = petIsHere(cat) && !cat.boarded && updateMorningCat(dt);
  updatePetPlay(dt);
  if (scene === 'house') {
    for (const pet of pets) {
      if (!petIsHere(pet)) continue;
      if (petMedicineActive(pet)) continue;
      if (pet.care || petCareRequest?.pet === pet) continue;
      if (animalCare.session?.actor === pet) continue;
      if (pet === dog && dogResting) continue;
      if (pet === cat && catResting) continue;
      if (pet.playing) continue;
      if (pet === dog && walkingDog) continue;
      if (pet.eatingUntil && clock >= pet.eatingUntil) {
        pet.eatingUntil = 0;
        petFood[pet.kind] = Math.max(0, petFood[pet.kind] - 1);
        pet.nextPlan = clock + 3;
      }
      if (petFood[pet.kind] > 0 && !(clock < pet.eatingUntil)) {
        const target = petEatingTarget(pet);
        if (distance(pet, target) < 4 && petMovementClear(pet, target)) {
          pet.x = target.x;
          pet.y = target.y;
          pet.route = [];
          pet.walking = false;
          pet.view = 4;
          pet.heading = Math.PI;
          pet.eatingUntil = clock + 4;
        } else if (clock >= pet.nextPlan) {
          pet.route = findPetPath(target, pet).slice(1);
          // 网格止于格子中心，再走最后几像素，把鼻尖准确对到粮食上。
          if (pet.route.length || (distance(pet, target) < 18 && petMovementClear(pet, target)))
            pet.route.push(target);
          pet.nextPlan = clock + 0.7;
        }
      }
      if (clock < pet.eatingUntil) {
        pet.walking = false;
        continue;
      }
    }
  }
  if (walkingDog && petIsHere(dog)) {
    if (!dogTrail.length || distance(player, dogTrail[dogTrail.length - 1]) > 18)
      dogTrail.push({ x: player.x, y: player.y });
    if (dogTrail.length > 80) dogTrail.shift();
    const gap = distance(dog, player);
    if (gap < 55) {
      dog.route = [];
      dog.walking = false;
    } else if (clock >= dog.nextPlan) {
      const target = dogTrail[Math.max(0, dogTrail.length - 4)];
      // Do not walk backwards to the nearest grid center every time we replan.
      dog.route = findPetPath(target, dog).slice(1);
      dog.nextPlan = clock + 0.45;
    }
    movePet(dog, dt, gap > 140 ? 285 : 210);
  }
  for (const pet of pets) {
    if (!petIsHere(pet)) continue;
    if (pet.boarded) continue;
    if (petMedicineActive(pet)) continue;
    if (petVetVisit?.pet === pet) continue;
    if (pet.care || petCareRequest?.pet === pet) continue;
    if (pet.playing) continue;
    if (animalCare.session?.actor === pet) continue;
    if (pet === dog && dogResting) continue;
    if (pet === cat && catResting) continue;
    if (pet === dog && walkingDog) continue;
    if (clock < pet.eatingUntil) continue;
    if (pendingPlace === pet.kind) {
      pet.route = [];
      pet.walking = false;
      pet.nextPlan = clock + 2;
      continue;
    }
    if (pet === cat && updateCatFollowing(dt)) continue;
    if (
      clock >= pet.nextPlan &&
      clock >= pet.affectionUntil &&
      !(scene === 'house' && petFood[pet.kind] > 0)
    )
      planPetWander(pet);
    movePet(pet, dt, pet.kind === 'cat' ? 37 : 55);
  }
  updatePetPlaceMarkers();
}

function petSpriteSize(pet) {
  if (pet === dog && pet.sleeping && pet.scene === 'farm' && distance(pet, dogKennel) < 20)
    return 74 * sceneScale(pet.y);
  return (pet === dog ? 135 : 102) * sceneScale(pet.y);
}

function petHitBounds(pet) {
  if (!petIsHere(pet) || pet.boarded || (pet === dog && walkingDog) ||
      (pet.care && pet.care.phase !== 'approach')) return null;
  const width = petSpriteSize(pet);
  const eating = clock < pet.eatingUntil && !pet.sleeping;
  let height;
  if (pet.sleeping) {
    const progress = pet === cat ? (cat.sleepPose || 0) : 1;
    if (pet === cat && progress < 0.3) {
      height = width * petRows.cat[pet.view][1] / (catAtlas.naturalWidth / 4)
        * (1 - progress * 0.35);
    } else {
      const region = sleepingPetRegions[pet.kind];
      height = width * region.height / region.width
        * (1 + Math.sin(clock * 1.8) * 0.018 * progress);
    }
  } else if (eating) {
    const [, , sourceWidth, sourceHeight] = petEatingRegions[pet.kind].source;
    height = width * sourceHeight / sourceWidth;
  } else {
    const atlas = pet === dog ? dogAtlas : catAtlas;
    height = width * petRows[pet.kind][pet.view][1] / (atlas.naturalWidth / 4);
  }
  const bounce = eating ? 0 : pet.walking
    ? Math.abs(Math.sin((pet.step * Math.PI) / 2)) * 0.7
    : Math.sin(clock * 2 + (pet === dog ? 0 : 1)) * 0.5;
  // 点击范围跟随当前整只身体和脚位，不能继续用初始化时的固定宽高。
  return { x: pet.x - width / 2, y: pet.y - bounce - (pet.playHop || 0) - height,
    width, height };
}

function drawDogLeash() {
  if (!walkingDog || !petIsHere(dog)) return;
  ctx.save();
  ctx.strokeStyle = '#bd8b57';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const hand = { x: player.x + (player.facing < 0 ? -19 : 19), y: player.y - 85 };
  const dogHeight = (petSpriteSize(dog) * petRows.dog[dog.view][1]) / (dogAtlas.naturalWidth / 4);
  const collar = {
    x: dog.x + Math.cos(dog.heading) * dog.width * 0.23,
    y: dog.y - dogHeight * 0.52 + Math.sin(dog.heading) * dogHeight * 0.12
  };
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.quadraticCurveTo((hand.x + collar.x) / 2, (hand.y + collar.y) / 2 + 26, collar.x, collar.y);
  ctx.stroke();
  ctx.restore();
}

function drawPets(front) {
  for (const pet of [...pets].sort((a, b) => a.y - b.y)) {
    if (!petIsHere(pet)) continue;
    if (pet.care && pet.care.phase !== 'approach') continue;
    if (pet.y > player.y !== front) continue;
    const frame = pet.walking ? Math.floor(pet.step) % 4 : 1;
    const atlas = pet.kind === 'dog' ? dogAtlas : catAtlas;
    const cw = atlas.naturalWidth / 4;
    const [sourceY, sourceHeight] = petRows[pet.kind][pet.view];
    const row = pet.kind === 'dog' ? 0 : 1;
    const eating = clock < pet.eatingUntil && !pet.sleeping;
    const bounce = eating ? 0 : pet.walking
      ? Math.abs(Math.sin((pet.step * Math.PI) / 2)) * 0.7
      : Math.sin(clock * 2 + row) * 0.5;
    ctx.save();
    ctx.translate(pet.x, pet.y - bounce - (pet.playHop || 0));
    const size = petSpriteSize(pet);
    ctx.fillStyle = '#344d2425';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.29, 6 * sceneScale(pet.y), 0, 0, Math.PI * 2);
    ctx.fill();
    if (!eating && clock < pet.affectionUntil) ctx.rotate(Math.sin(clock * 7) * 0.045);
    const bathroom = animalBathroomPose(pet);
    if (bathroom) {
      ctx.scale(1, 1 - bathroom.crouch * 0.28);
      ctx.rotate((pet === cat ? -0.08 : 0.04) * bathroom.crouch);
    }
    const spriteSize = size;
    const spriteHeight = pet.sleeping
      ? drawPetSleepPose(pet, spriteSize)
      : eating ? drawPetEatingPose(pet, spriteSize)
      : (spriteSize * sourceHeight) / cw;
    if (!pet.sleeping && !eating)
      ctx.drawImage(
        atlas,
        frame * cw,
        sourceY,
        cw,
        sourceHeight,
        -spriteSize / 2,
        -spriteHeight,
        spriteSize,
        spriteHeight
      );
    ctx.restore();
    if (scene === 'boardingHouse' && pet.boarded) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = 'bold 17px sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff8e6';
      ctx.fillStyle = '#5b3927';
      ctx.strokeText(`我的${pet.name}`, pet.x, pet.y - spriteHeight - 10);
      ctx.fillText(`我的${pet.name}`, pet.x, pet.y - spriteHeight - 10);
      ctx.restore();
    }
    if (pet.sleeping && (pet !== cat || cat.sleepPose >= 1))
      drawSleepMark(pet.x, pet.y - spriteHeight * 0.5 - 15);
    drawAnimalBathroomDetails(pet, pet.x, pet.y);
  }
}

// 在日程和床上互动都决定完睡眠状态后推进，两个场景共用同一入睡动作。
function updateCatSleepPose(dt) {
  cat.sleepPose = cat.sleeping ? Math.min(1, (cat.sleepPose || 0) + dt / 1.2) : 0;
  canvas.dataset.catSleepPose = !cat.sleeping
    ? 'awake'
    : cat.sleepPose < 1 ? 'settling' : 'sleeping';
}

function drawPetSleepPose(pet, width) {
  ctx.save();
  const progress = pet === cat ? (cat.sleepPose || 0) : 1;
  let height;
  if (pet === cat && progress < 0.3) {
    // 先收腿伏低，再切换到独立闭眼图；一帧只画一只猫，避免交叠重影。
    const cw = catAtlas.naturalWidth / 4;
    const [sy, sh] = petRows.cat[cat.view];
    height = width * sh / cw;
    ctx.scale(1, 1 - progress * 0.35);
    ctx.drawImage(catAtlas, cw, sy, cw, sh, -width / 2, -height, width, height);
  } else {
    const settling = (1 - progress) / 0.7;
    if (pet === cat) ctx.rotate(-settling * 0.06);
    ctx.scale(1, 1 + Math.sin(clock * 1.8) * 0.018 * progress);
    height = drawSleepingPet(pet.kind, width);
  }
  ctx.restore();
  return height;
}

// 闭眼趴睡使用独立贴图，不能把睁眼走路图压扁来表示睡觉。
function drawSleepingPet(kind, width) {
  const region = sleepingPetRegions[kind];
  const height = (width * region.height) / region.width;
  ctx.drawImage(
    sleepingPetsArt,
    region.x,
    region.y,
    region.width,
    region.height,
    -width / 2,
    -height,
    width,
    height
  );
  return height;
}

function bringPetsToScene() {
  for (const pet of pets) {
    const accompanies = pet === carriedPet || (pet === dog && walkingDog);
    if (pet.scene === scene) continue;
    if (!accompanies) {
      pet.route = [];
      pet.walking = false;
      continue;
    }
    pet.scene = scene;
    if (pet === carriedPet) continue;
    const inside = ['house', 'barn'].includes(scene) || isBuildingInterior();
    const outsideMap = isExploring();
    pet.x = inside
      ? pet === dog ? 595 : 710
      : outsideMap
        ? pet === dog ? 680 : 850
        : pet === dog ? 950 : 1060;
    pet.y = inside ? 670 : outsideMap ? 840 : 520;
    // 公共建筑没有家里的宠物床，休息点沿用入口内的空地，不能落在村舍饭桌上。
    pet.home = isBuildingInterior()
      ? { x: pet.x, y: pet.y }
      : outsideMap
      ? { x: pet.x, y: pet.y }
      : inside
        ? { x: pet === dog ? 475 : 625, y: 620 }
        : { x: pet === dog ? dogKennel.x : 925, y: pet === dog ? dogKennel.y : 565 };
    pet.route = [];
    pet.walking = false;
    pet.eatingUntil = 0;
    pet.nextPlan = clock + 1;
    pet.sleeping = false;
    places[pet.kind].x = pet.x;
    places[pet.kind].y = pet.y;
  }
  dogTrail = [{ x: player.x, y: player.y }];
  updatePetPlaceMarkers();
  updateDogButton();
}
