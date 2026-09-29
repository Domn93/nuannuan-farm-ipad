// 四季按游戏日历循环；睡过一夜与自然经过午夜都推进一天，午觉不会换季。
const farmSeasons = [
  { name: '春天', color: '#efb8d5', weather: ['sunny', 'cloudy', 'rain'] },
  { name: '夏天', color: '#f7d268', weather: ['sunny', 'rain', 'cloudy'] },
  { name: '秋天', color: '#bc6d29', weather: ['wind', 'cloudy', 'rain'] },
  { name: '冬天', color: '#c7dbea', weather: ['snow', 'cloudy', 'sunny'] }
];
const weatherNames = {
  sunny: '☀ 晴天',
  cloudy: '☁ 多云',
  rain: '☂ 下雨',
  wind: '〰 微风',
  snow: '❄ 下雪',
  hail: '◈ 冰雹'
};
const farmClimate = {
  season: 0, seasonStartedDay: 0, seasonDays: 4,
  elapsed: 0, weatherElapsed: 0, weatherIndex: 0, weather: 'sunny',
  weatherStartedDay: 0, weatherHoldDays: 0, hotPeriod: false
};
const weatherInterval = 3 * 60;
// 每次抽取仍可保持原天气，给散步和互动留出一段安稳的时间。
const seasonalWeatherWeights = [
  [['sunny', 55], ['cloudy', 29], ['wind', 8], ['rain', 8]],
  [['sunny', 60], ['cloudy', 24], ['wind', 8], ['rain', 8]],
  [['wind', 40], ['sunny', 32], ['cloudy', 20], ['rain', 8]],
  [['sunny', 50], ['cloudy', 27], ['snow', 20], ['rain', 3]]
];
const animalNames = ['小猪', '绵羊', '小羊', '小马', '奶牛', '公鸡', '母鸡', '小鸡'];
let animalPetting = null;
const hailHazard = { exposed: 0, nextHit: 7, hitStarted: null };

function isFarmWinter() {
  return farmClimate.season === 3;
}

function setFarmSeason(index) {
  farmClimate.season = index;
  farmClimate.seasonStartedDay = farmTime.day;
  farmClimate.seasonDays = (index === 3 ? 4 : 3) + Math.floor(Math.random() * (index === 3 ? 3 : 4));
  farmClimate.elapsed = 0;
  farmClimate.weatherIndex = 0;
  const holdDays = index === 1 || index === 3
    ? 3 + Math.floor(Math.random() * (farmClimate.seasonDays - 2)) : 0;
  setFarmWeather(farmSeasons[index].weather[0], holdDays);
  toast(
    `${farmSeasons[index].name}来了，会持续${farmClimate.seasonDays}天。${isFarmWinter()
      ? `这场雪会下${holdDays}天，衣柜里准备好了羽绒服。`
      : index === 1 ? `接下来${holdDays}天会很热，回家可以开空调。` : '一起出去逛逛吧。'}`
  );
}

function setFarmWeather(weather, holdDays = 0) {
  if (!(weather in weatherNames)) return;
  farmClimate.weather = weather;
  farmClimate.weatherStartedDay = farmTime.day;
  farmClimate.weatherHoldDays = holdDays;
  farmClimate.hotPeriod = farmClimate.season === 1 && weather === 'sunny';
  farmClimate.weatherElapsed = 0;
  document.querySelector('#farm-weather').value = weather;
  if (weather === 'rain') toast('下雨啦，猫狗会帮忙把放牧的小动物带回棚里。', 6);
  if (weather === 'hail') toast('下冰雹啦！快回家躲一躲，冰粒会把暖暖弹起来。', 8);
  if (weather !== 'hail') clearHailHazard();
}

function randomFarmWeather() {
  // 冰雹只在夜间罕见出现；雪只属于冬天，不因入夜就让春夏也下雪。
  if (isFarmNight() && Math.random() < 0.01) return 'hail';
  let roll = Math.random() * 100;
  const weights = seasonalWeatherWeights[farmClimate.season];
  for (const [weather, weight] of weights) {
    roll -= weight;
    if (roll < 0) return weather;
  }
  return weights[weights.length - 1][0];
}

function clearHailHazard() {
  if (hailHazard.hitStarted !== null && busyUntil === hailHazard.hitStarted + 0.7) busyUntil = 0;
  hailHazard.exposed = 0;
  hailHazard.nextHit = 6 + Math.random() * 4;
  hailHazard.hitStarted = null;
}

function hailPlayerLift() {
  if (hailHazard.hitStarted === null) return 0;
  const progress = Math.min(1, Math.max(0, (clock - hailHazard.hitStarted) / 0.7));
  // 只移动绘制位置，脚下的寻路坐标不变，落地不会掉进水里或穿过家具。
  return 4 * 105 * progress * (1 - progress);
}

function updateHailHazard(dt) {
  if (
    ['house', 'barn'].includes(scene) ||
    (typeof isBuildingInterior === 'function' && isBuildingInterior()) ||
    farmClimate.weather !== 'hail'
  ) {
    if (hailHazard.exposed || hailHazard.hitStarted !== null) clearHailHazard();
    return;
  }
  if (hailHazard.hitStarted !== null) {
    if (clock - hailHazard.hitStarted >= 0.7) hailHazard.hitStarted = null;
    return;
  }
  // 抱着伙伴、骑马和搬运动物时不拆开附属姿态；门正在打开时也留出返家通道。
  if (riding || carriedPet || animalTravel || doorTransition || petCareRequest) return;
  if (clock < busyUntil && !fishingSession && !swingSession && !animalPetting) return;
  hailHazard.exposed += dt;
  if (hailHazard.exposed < hailHazard.nextHit) return;
  if (fishingSession) cancelFishing('冰雹来了，先收竿回家吧！');
  if (swingSession) leaveSwing();
  clearAnimalPetting();
  route = [];
  pendingPlace = null;
  player.walking = false;
  busyUntil = clock + 0.7;
  hailHazard.hitStarted = clock;
  hailHazard.exposed = 0;
  hailHazard.nextHit = 7 + Math.random() * 5;
  injureFromHail();
}

function updateFarmClimate(dt) {
  farmClimate.elapsed += dt;
  farmClimate.weatherElapsed += dt;
  if (farmTime.day - farmClimate.seasonStartedDay >= farmClimate.seasonDays)
    setFarmSeason((farmClimate.season + 1) % 4);
  const holdingWeather = farmTime.day - farmClimate.weatherStartedDay < farmClimate.weatherHoldDays;
  if (!holdingWeather && farmClimate.weatherElapsed >= weatherInterval) {
    const nextWeather = randomFarmWeather();
    farmClimate.weatherElapsed = 0;
    // 连续晴天不重复提示；同样的雨也不重复启动动物返棚。
    if (nextWeather !== farmClimate.weather) setFarmWeather(nextWeather);
  }
  const seasonSelect = document.querySelector('#farm-season');
  if (seasonSelect.value !== String(farmClimate.season)) seasonSelect.value = String(farmClimate.season);
  const progress = document.querySelector('#season-progress');
  const progressText = `${farmSeasons[farmClimate.season].name} · 第${farmTime.day - farmClimate.seasonStartedDay + 1}天，共${farmClimate.seasonDays}天`;
  if (progress.textContent !== progressText) progress.textContent = progressText;
  const weatherElement = document.querySelector('.weather');
  const weatherText = `${farmSeasons[farmClimate.season].name} · ${farmClimate.hotPeriod
      ? '☀ 炎热' : farmClimate.season === 2 && farmClimate.weather === 'wind'
        ? '〰 冷风' : weatherNames[farmClimate.weather]}`;
  if (weatherElement.textContent !== weatherText) weatherElement.textContent = weatherText;
  for (const animal of animals) {
    if (animal.affinity === undefined) {
      animal.affinity = 60;
      animal.lastPat = clock;
      animal.patUntil = 0;
    }
    const position = farmAnimalPosition(animal);
    const exposed = farmClimate.weather === 'rain' && !animal.visitScene && position.y > 485;
    const neglect = clock - animal.lastPat > 120 ? dt / 180 : 0;
    animal.affinity = Math.max(0, animal.affinity - neglect - (exposed ? dt / 30 : 0));
  }
  updateAnimalPetting();
  if (document.querySelector('#farm-care-dialog').open) renderFarmCare();
}

function openFarmCare() {
  renderFarmCare();
  document.querySelector('#farm-care-dialog').showModal();
}

function renderFarmCare() {
  const content = animals
    .map(
      (animal, index) =>
        `<li>${animalNames[index]} · 感情度 ${Math.round(animal.affinity ?? 60)}/100 <button data-pat-animal="${index}">摸摸它</button></li>`
    )
    .join('');
  const list = document.querySelector('#farm-care-list');
  if (list.innerHTML !== content) list.innerHTML = content;
}

function petFarmAnimal(index) {
  if (scene !== 'farm' || clock < busyUntil || riding) {
    toast('先回农场，下马后再摸摸小动物吧。');
    return;
  }
  const animal = animals[index];
  if (!animal || animal.visitScene || animal.sleeping || herdSession) {
    toast('等它醒来或放牧结束，再轻轻摸摸它。');
    return;
  }
  if (clock < animal.patUntil) {
    toast('刚刚摸过啦，陪它待一会儿吧。');
    return;
  }
  animal.wanderTarget = null;
  const position = farmAnimalPosition(animal);
  const candidates = [
    { x: position.x, y: position.y + 45 },
    ...[-1, 1].map((side) => ({
      x: position.x + side * ((animal.width * animal.growth) / 2 + 28),
      y: position.y + 30
    }))
  ];
  const target = candidates.find(
    (point) =>
      canWalk(point.x, point.y) &&
      ((!penGate.open && insidePen(point) !== insidePen(player)) || findPath(point).length)
  );
  if (!target) {
    toast('这里有点挤，等它走到空一点的地方再摸。');
    return;
  }
  document.querySelector('#farm-care-dialog').close();
  outdoorPlaces.animalPet = { ...target, label: `摸摸${animalNames[index]}`, icon: '♡' };
  walkTo(outdoorPlaces.animalPet, 'animalPet');
  animalPetting = { animal, stage: 'walking', started: clock };
}

function startAnimalPetting() {
  if (!animalPetting) return;
  animalPetting.stage = 'stroking';
  animalPetting.started = clock;
  busyUntil = clock + 2.4;
  player.view = 1;
  player.facing = farmAnimalPosition(animalPetting.animal).x < player.x ? -1 : 1;
}

function clearAnimalPetting() {
  // 临时地点和动作同寿命；留下旧地点会出现按 E 却没有会话的空提示。
  if (animalPetting?.stage === 'stroking' && busyUntil === animalPetting.started + 2.4)
    busyUntil = 0;
  animalPetting = null;
  delete outdoorPlaces.animalPet;
  if (pendingPlace === 'animalPet') {
    route = [];
    pendingPlace = null;
  }
  if (penGate.destination?.place === 'animalPet') penGate.destination = null;
  if (nearPlace === 'animalPet') nearPlace = null;
}

function updateAnimalPetting() {
  if (!animalPetting) return;
  if (
    scene !== 'farm' ||
    isFarmNight() ||
    movementKeys.some((key) => keys.has(key)) ||
    (animalPetting.stage === 'walking' &&
      pendingPlace !== 'animalPet' &&
      pendingPlace !== 'penGate' &&
      penGate.destination?.place !== 'animalPet')
  ) {
    clearAnimalPetting();
    return;
  }
  if (animalPetting.stage === 'stroking' && clock - animalPetting.started >= 2.4) {
    const animal = animalPetting.animal;
    animal.affinity = Math.min(100, animal.affinity + 8);
    animal.lastPat = clock;
    animal.patUntil = clock + 25;
    animal.nextWander = clock + 3;
    clearAnimalPetting();
    toast('它蹭了蹭暖暖，感情度增加啦 ♡');
  }
}

function drawSeasonGround() {
  if (
    ['house', 'barn'].includes(scene) ||
    (typeof isBuildingInterior === 'function' && isBuildingInterior())
  ) return;
  ctx.save();
  ctx.globalAlpha = isFarmWinter() ? 0.18 : farmClimate.season === 2 ? 0.13 : 0.04;
  ctx.fillStyle = farmSeasons[farmClimate.season].color;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawFarmWeather() {
  canvas.dataset.season = String(farmClimate.season);
  canvas.dataset.weather = farmClimate.weather;
  canvas.dataset.herding = herdSession
    ? `${herdSession.returning ? 'return' : herdSession.pet.kind}:${herdSession.index}`
    : 'idle';
  canvas.dataset.grazing = animals
    .filter((animal) => animal.grazing)
    .map((animal) => animal.cell)
    .join(',');
  canvas.dataset.animalAffinity = animals
    .map((animal) => Math.round(animal.affinity ?? 60))
    .join(',');
  canvas.dataset.animalPetting = animalPetting?.stage || 'idle';
  canvas.dataset.hailHit = hailHazard.hitStarted === null ? 'idle' : 'bouncing';
  if (
    !['house', 'barn'].includes(scene) &&
    !(typeof isBuildingInterior === 'function' && isBuildingInterior())
  ) {
    ctx.save();
    if (['rain', 'cloudy', 'snow', 'hail'].includes(farmClimate.weather)) {
      ctx.fillStyle = ['rain', 'hail'].includes(farmClimate.weather) ? '#344e7030' : '#71829416';
      ctx.fillRect(0, 0, W, H);
    }
    if (
      farmClimate.weather === 'rain' ||
      farmClimate.weather === 'snow' ||
      farmClimate.season === 2
    ) {
      const rain = farmClimate.weather === 'rain',
        snow = farmClimate.weather === 'snow';
      ctx.strokeStyle = '#d5e8f2a0';
      ctx.fillStyle = snow ? '#fffffff0' : '#c48737b0';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < (rain ? 100 : 35); i++) {
        const x = (i * 173 + clock * (rain ? -65 : 20) + W * 20) % W;
        const y = (i * 97 + clock * (rain ? 490 : 36)) % H;
        ctx.beginPath();
        if (rain) {
          ctx.moveTo(x, y);
          ctx.lineTo(x - 5, y + 17);
          ctx.stroke();
        } else {
          ctx.ellipse(x, y, snow ? 3 : 5, snow ? 3 : 2, Math.sin(clock + i), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (farmClimate.weather === 'hail') {
      ctx.fillStyle = '#e5f5ffff';
      ctx.strokeStyle = '#acc5d4';
      ctx.lineWidth = 1;
      for (let i = 0; i < 65; i++) {
        const landingY = 570 + ((i * 71) % 400);
        const phase = (clock * 0.95 + i * 0.173) % 1;
        const landed = phase > 0.8;
        const bounce = (phase - 0.8) / 0.2;
        const x = (i * 179 - phase * 48 + W) % W;
        const y = landed
          ? landingY - Math.sin(bounce * Math.PI) * 17 * (1 - bounce)
          : (phase / 0.8) * (landingY + 30) - 30;
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + (i % 2), 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  if (hailHazard.hitStarted !== null && scene !== 'house') {
    ctx.save();
    ctx.fillStyle = '#ffe58c';
    ctx.font = '21px sans-serif';
    for (let i = 0; i < 3; i++) {
      const angle = clock * 5 + (i * Math.PI * 2) / 3;
      ctx.fillText('✦', player.x + Math.cos(angle) * 27, player.y - 145 - hailPlayerLift() + Math.sin(angle) * 8);
    }
    ctx.restore();
  }
  if (animalPetting?.stage === 'stroking') {
    const animal = animalPetting.animal,
      p = farmAnimalPosition(animal);
    const side = p.x < player.x ? -1 : 1;
    const x = player.x + side * 40,
      y = player.y - 65 + Math.sin(clock * 6) * 5;
    ctx.save();
    ctx.strokeStyle = '#f3c4a0';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(player.x + side * 15, player.y - 78);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#ed8b9b';
    ctx.font = '24px sans-serif';
    ctx.fillText('♡', p.x, p.y - animal.height - 12);
    ctx.restore();
  }
}

document
  .querySelector('#farm-season')
  .addEventListener('change', (event) => setFarmSeason(Number(event.target.value)));
document
  .querySelector('#farm-weather')
  .addEventListener('change', (event) => setFarmWeather(event.target.value));
document.querySelector('#open-farm-care').addEventListener('click', openFarmCare);
document
  .querySelector('#close-farm-care')
  .addEventListener('click', () => document.querySelector('#farm-care-dialog').close());
document.querySelector('#farm-care-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-pat-animal]');
  if (button) petFarmAnimal(Number(button.dataset.patAnimal));
});
