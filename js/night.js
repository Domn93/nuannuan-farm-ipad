// 昼夜时钟、动物回窝和夜间灯光；猫与其他动物采用不同作息。

// One farm day takes twelve minutes. The selector moves the clock, then time keeps flowing.
const farmTime = { day: 0, hour: 9, darkness: 0, phase: 'day', nextGrid: 0 };
// 短觉使用游戏时钟，到时自动醒来；只在主要作息之外偶尔发生。
const petNaps = {
  dog: { eligible: false, nextAt: 0, until: 0 },
  cat: { eligible: false, nextAt: 0, until: 0 }
};
const barnBeds = [
  [120, 458],
  [210, 457],
  [280, 456],
  [365, 452],
  [490, 461],
  [320, 466],
  [425, 466],
  [545, 466]
];

function isFarmNight() {
  return farmTime.hour >= 18 || farmTime.hour < 6;
}
function isFarmLateNight() {
  return farmTime.hour >= 23 || farmTime.hour < 6;
}
function isCatMorning() {
  return farmTime.hour >= 6 && farmTime.hour < 12;
}
function farmAnimalPosition(animal) {
  if (animal.visitScene === scene && animal.visitPosition) return animal.visitPosition;
  return animal.restPosition || animal;
}

// 起床完成后迎来新的一天，立即清除夜色，并同步动物作息与时间选择器。
function startFarmMorning(hour = 9) {
  farmTime.hour = hour;
  farmTime.darkness = 0;
  document.querySelector('#time-of-day').value = '9';
  updateFarmTime(0);
}

function updateFarmTime(dt) {
  const previousHour = farmTime.hour;
  farmTime.day += Math.floor((previousHour + dt / 30) / 24);
  farmTime.hour = (farmTime.hour + dt / 30) % 24;
  if (previousHour + dt / 30 >= 24) collapseAtMidnight();
  const night = isFarmNight(),
    late = isFarmLateNight();
  const phase = late ? 'late' : night ? 'evening' : 'day';
  if (phase !== farmTime.phase) {
    farmTime.phase = phase;
    if (night) {
      if (walkingDog && !petHealth.dog.sick) stopDogWalk(null);
      if (ballGame?.pet === dog) {
        ballGame = null;
        dog.playing = false;
        dog.playHop = 0;
        dog.route = [];
      }
      dog.nextPlan = 0;
      toast(
        late
          ? '深夜啦，萨摩耶和农场动物都回窝睡觉，布偶猫还在活动。'
          : '天黑啦，小动物陆续休息，有几只先在院子里睡。'
      );
    } else {
      dog.sleeping = false;
      dog.route = [];
      dog.nextPlan = 0;
      toast('早上好！小动物睡醒啦，又可以喂食和遛狗了。');
    }
  }
  const target = night ? 0.58 : farmTime.hour >= 16 ? 0.24 : 0;
  farmTime.darkness += (target - farmTime.darkness) * Math.min(1, dt * 0.8);
  for (const animal of animals) {
    if (animal.visitScene) continue;
    if (animal.herdRoute) {
      animal.sleeping = false;
      animal.restMoving = false;
      continue;
    }
    if (!animal.restPosition) animal.restPosition = { x: animal.x, y: animal.y };
    const inBarn = animal.sheltering || (night && (late || animal.cell % 3 === 0));
    const bed = barnBeds[animal.cell];
    const targetPosition = inBarn ? { x: bed[0], y: bed[1] } : animal;
    const returning = inBarn || night || animal.sleeping || animal.restMoving;
    const gap = returning ? distance(animal.restPosition, targetPosition) : 0,
      step = Math.min(gap, dt * 28);
    animal.restMoving = gap > 1;
    if (gap > 0) {
      animal.restPosition.x += ((targetPosition.x - animal.restPosition.x) / gap) * step;
      animal.restPosition.y += ((targetPosition.y - animal.restPosition.y) / gap) * step;
      animal.stride = (animal.stride || 0) + step / 12;
      if (Math.abs(targetPosition.x - animal.restPosition.x) > 2)
        animal.walkFacing = targetPosition.x < animal.restPosition.x ? -1 : 1;
    }
    if (night) {
      animal.wanderTarget = null;
      animal.nextWander = clock + animal.seed * 0.4;
    }
    animal.sleeping = night && !animal.restMoving;
    animal.sleepAmount =
      (animal.sleepAmount || 0) +
      (Number(animal.sleeping) - (animal.sleepAmount || 0)) * Math.min(1, dt * 2);
  }
  if (scene === 'farm' && clock >= farmTime.nextGrid) {
    rebuildGrid();
    farmTime.nextGrid = clock + 1;
  }
  if (night && riding && clock >= busyUntil) dismountHorse();
  const clockElement = document.querySelector('#farm-clock');
  const clockText = `${night ? '☾' : '☀'} ${String(Math.floor(farmTime.hour)).padStart(2, '0')}:${String(Math.floor((farmTime.hour % 1) * 60)).padStart(2, '0')} · ${late ? '深夜' : night ? '夜晚' : '白天'}`;
  if (clockElement.textContent !== clockText) clockElement.textContent = clockText;
  document.querySelector('#ride-horse').disabled = night && !riding;
  document.querySelector('[data-place="animals"]').disabled = night;
  document.querySelector('[data-play-pet="dog"]').disabled = night;
  document.querySelector('[data-play-pet="cat"]').disabled = isCatMorning();
  for (const map of [outdoorPlaces, indoorPlaces])
    map.cat.label = isCatMorning() ? '布偶猫正在休息' : '摸摸布偶猫';
  document.querySelector('#walk-dog').disabled = night;
  if (night) {
    const dogButton = document.querySelector('#walk-dog');
    if (dogButton.textContent !== '☾ 萨摩耶休息中') dogButton.textContent = '☾ 萨摩耶休息中';
    outdoorPlaces.dog.label = '萨摩耶正在休息';
    indoorPlaces.dog.label = '萨摩耶正在休息';
  } else updateDogButton();
}

function updatePetNap(pet, eligible) {
  const nap = petNaps[pet.kind];
  if (!eligible) {
    nap.eligible = false;
    nap.until = 0;
    return false;
  }
  if (!nap.eligible) {
    nap.eligible = true;
    nap.nextAt = clock + 65 + Math.random() * 55;
  }
  if (clock < nap.until) return true;
  const occupied =
    pet.playing ||
    clock < pet.eatingUntil ||
    (pet === dog && walkingDog) ||
    (pet.care && pet.care.mode !== 'bed') ||
    petCareRequest?.pet === pet ||
    animalCare.session?.actor === pet ||
    pendingPlace === pet.kind;
  if (clock >= nap.nextAt && !occupied) {
    nap.until = clock + 9 + Math.random() * 6;
    nap.nextAt = nap.until + 100 + Math.random() * 80;
    pet.route = [];
    pet.walking = false;
    return true;
  }
  return false;
}

function updateNightDog(dt) {
  if (petVetVisit?.pet === dog || (petHealth.dog.sick && walkingDog)) {
    dog.sleeping = false;
    return false;
  }
  if (herdSession?.pet === dog || herdSession?.otherPet === dog) {
    dog.sleeping = false;
    return false;
  }
  const napping = updatePetNap(dog, isCatMorning());
  if (dog.care || petCareRequest?.pet === dog) return true;
  if (!isFarmNight()) {
    dog.indoorRestAllowed = false;
    dog.sleeping = napping;
    return napping;
  }
  dog.eatingUntil = 0;
  dog.playing = false;
  const bed = scene === 'farm' ? dogKennel : dog.home;
  if (scene === 'farm' && insidePen(dog) && !penGate.open && penGate.started === null) usePenGate();
  if (distance(dog, bed) > 16) {
    dog.sleeping = false;
    if (clock >= dog.nextPlan) {
      dog.route = findPetPath(bed, dog).slice(1);
      dog.nextPlan = clock + 1;
    }
    movePet(dog, dt, 65);
  } else {
    dog.route = [];
    dog.walking = false;
    dog.sleeping = true;
    dog.view = 0;
  }
  return true;
}

function updateMorningCat(dt) {
  if (petVetVisit?.pet === cat) {
    cat.sleeping = false;
    return false;
  }
  if (herdSession?.pet === cat || herdSession?.otherPet === cat) {
    cat.sleeping = false;
    return false;
  }
  const napping = updatePetNap(cat, isFarmNight());
  if (cat.care || petCareRequest?.pet === cat) return true;
  if (!isCatMorning()) {
    if (cat.sleeping && !napping) {
      cat.route = [];
      cat.nextPlan = 0;
    }
    cat.sleeping = napping;
    return napping;
  }
  // 早晨暂停猫的捕猎和接球；狗仍可以正常玩球、散步。
  if (ballGame?.pet === cat) ballGame = null;
  prey = null;
  cat.playing = false;
  cat.playHop = 0;
  cat.eatingUntil = 0;
  if (animalCare.session?.actor === cat) cancelAnimalBathroom();
  const bed = isBuildingInterior() ? cat.home : scene === 'house' ? { x: 625, y: 660 } : { x: 925, y: 565 };
  if (distance(cat, bed) > 16) {
    cat.sleeping = false;
    if (clock >= cat.nextPlan) {
      cat.route = findPetPath(bed, cat).slice(1);
      cat.nextPlan = clock + 1;
    }
    movePet(cat, dt, 65);
  } else {
    cat.route = [];
    cat.walking = false;
    cat.sleeping = true;
  }
  return true;
}

function drawSleepMark(x, y) {
  ctx.save();
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f9edc4';
  ctx.strokeStyle = '#59627c';
  ctx.lineWidth = 3;
  const text = 'z Z',
    float = Math.sin(clock * 1.5 + x) * 3;
  ctx.strokeText(text, x, y + float);
  ctx.fillText(text, x, y + float);
  ctx.restore();
}

function drawDogBed() {
  if (scene !== 'farm' && scene !== 'house') return;
  const x = scene === 'house' ? 475 : 700,
    y = scene === 'house' ? 660 : 606;
  ctx.save();
  if (scene === 'farm') {
    ctx.drawImage(kennelArt, x - 83, y - 154, 166, 166);
    ctx.restore();
    return;
  }

  for (const bed of housePetBeds)
    ctx.drawImage(petProps['pet-bed'], bed.x, bed.y, bed.width, bed.height);

  ctx.restore();
}

function drawFarmNight() {
  ctx.save();
  if (scene === 'house') {
    // 窗外/阳台与夜色一致；开帘时屋内也暗，关帘后由暖灯照亮室内。
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.rect(175, 75, 770, 640);
    ctx.rect(945, 75, 395, 360);
    ctx.clip('evenodd');
    ctx.fillStyle = `rgba(12,22,55,${farmTime.darkness})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    const darkness = farmTime.darkness * (0.85 - homeCurtains.progress * 0.62);
    ctx.fillStyle = `rgba(18,27,65,${darkness})`;
    ctx.fillRect(175, 75, 770, 640);
    ctx.fillRect(945, 75, 395, 360);
    if (homeCurtains.progress > 0) {
      ctx.fillStyle = `rgba(255,201,126,${farmTime.darkness * homeCurtains.progress * 0.12})`;
      ctx.fillRect(175, 75, 770, 640);
      ctx.fillRect(945, 75, 395, 360);
    }
  } else {
    ctx.fillStyle = `rgba(18,27,65,${farmTime.darkness})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (scene === 'farm' && farmTime.darkness > 0.05) {
    ctx.globalAlpha = Math.min(1, farmTime.darkness * 2);
    ctx.fillStyle = '#fff4cc';
    ctx.beginPath();
    ctx.arc(1140, 80, 30, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 25; i++) {
      const x = 560 + ((i * 137) % 860),
        y = 25 + ((i * 43) % 160);
      ctx.globalAlpha = farmTime.darkness * (0.7 + Math.sin(clock * 0.8 + i) * 0.25);
      ctx.beginPath();
      ctx.arc(x, y, 1.6 + (i % 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const glow = ctx.createRadialGradient(1010, 410, 5, 1010, 410, 115);
    glow.addColorStop(0, `rgba(255,209,120,${farmTime.darkness * 0.55})`);
    glow.addColorStop(1, 'rgba(255,209,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(880, 290, 260, 240);
  }
  ctx.restore();
  canvas.dataset.timeOfDay = farmTime.phase;
  canvas.dataset.farmHour = farmTime.hour.toFixed(2);
  canvas.dataset.dogSleep = dog.sleeping ? 'asleep' : isFarmNight() ? 'going-to-bed' : 'awake';
  canvas.dataset.catSleep = cat.sleeping ? 'asleep' : isCatMorning() ? 'going-to-bed' : 'awake';
  canvas.dataset.animalSleep = animals
    .map((a) => (a.sleeping ? 'asleep' : a.restMoving ? 'walking' : 'awake'))
    .join(',');
  canvas.dataset.animalsSheltered = String(
    animals.every(
      (a, i) => distance(farmAnimalPosition(a), { x: barnBeds[i][0], y: barnBeds[i][1] }) < 2
    )
  );
}

document.querySelector('#time-of-day').addEventListener('change', (event) => {
  if (lateSleepSession) {
    event.target.value = isFarmNight() ? '23' : '13';
    return;
  }
  farmTime.hour = Number(event.target.value);
  dog.nextPlan = 0;
});
