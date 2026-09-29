// 熬到午夜还没睡着，会在当前地图困倒；和正常床上睡觉、闹钟分开处理。
let lateSleepSession = null;

function collapseAtMidnight() {
  const asleep = sleepSession && sleepSession.waking === null && clock - sleepSession.started >= 3.6;
  if (lateSleepSession || asleep) return;
  // 午夜优先结束其他动作，不保留门、诊疗或悬空的骑乘姿态。
  busyUntil = 0;
  if (fishingSession) cancelFishing();
  if (swingSession) leaveSwing();
  if (riding) dismountHorse();
  if (animalTravel && !releaseTravelAnimal()) {
    // 窄路的三个常规放下点可能都不可用，找最近的安全脚位，不能继续悬抱着睡。
    const animal = animalTravel.animal;
    const safe = grid.filter((point) => travelAnimalGround(animal, point.x, point.y))
      .sort((a, b) => distance(a, player) - distance(b, player))[0];
    animal.visitPosition = safe ? { x: safe.x, y: safe.y } : { ...animalTravel.from };
    animal.visitScene = scene;
    animal.nextVisitWander = clock + 4;
    animalTravel = null;
    rebuildGrid();
  }
  if (carriedPet) clearPetCare(carriedPet);
  if (walkingDog) stopDogWalk(null);
  cancelPetPlay();
  clearAnimalPetting();
  cancelAnimalBathroom();
  cancelPetVetVisit();
  nuannuanHealth.treatment = null;
  marketVisit = null;
  clearForestAdventure();
  if (livingSession) stopLivingAction();
  if (bathSession) finishBath();
  resetHomeAction();
  stopPlantCare();
  toiletSession = null;
  stopFlushSound();
  shoeAction = null;
  doorTransition = null;
  balconyDoor.destination = null;
  penGate.destination = null;
  route = [];
  pendingPlace = null;
  targetMarker = null;
  keys.clear();
  player.walking = false;
  player.view = 2;
  lateSleepSession = {
    started: clock, wakeAt: clock + 12 * 30, waking: null, day: homeAlarm.day
  };
  stopNuannuanSpeech();
  lullabySleepPending = false;
  busyUntil = Infinity;
  for (const id of ['#help-dialog', '#backpack-dialog', '#guide-dialog', '#shoes-dialog',
    '#fish-dialog', '#pet-care-dialog', '#alarm-dialog', '#farm-care-dialog', '#fridge-dialog', '#medicine-dialog'])
    document.querySelector(id).close();
  document.querySelector('#friend-panel').hidden = true;
  document.querySelector('#kitchen-panel').hidden = true;
  toast('已经午夜十二点啦……暖暖困倒在地上睡着了，明天要睡到中午。', 8);
}

function sleepUntilLateMorning() {
  if (!lateSleepSession || lateSleepSession.waking !== null || clock - lateSleepSession.started < 1.2) return;
  lateSleepSession.waking = clock;
  keys.clear();
  toast('一觉睡到第二天中午，暖暖慢慢醒过来了。', 4);
}

function updateLateSleep() {
  const session = lateSleepSession;
  if (!session) return;
  busyUntil = Infinity;
  player.walking = false;
  if (session.waking === null && clock >= session.wakeAt) sleepUntilLateMorning();
  if (session.waking !== null && clock - session.waking >= 2) {
    lateSleepSession = null;
    busyUntil = 0;
    keys.clear();
    // 快进与自然睡醒都只算一次新的一天，不受床头闹钟或时间下拉框影响。
    if (homeAlarm.day === session.day) homeAlarm.day++;
    homeAlarm.lastHour = 12;
    homeAlarm.napDay = homeAlarm.day;
    startFarmMorning(12);
    document.querySelector('#time-of-day').value = '13';
    if (selectedTrack === 'moon') {
      selectedTrack = 'meadow';
      music?.setTrack(selectedTrack);
      document.querySelector('#music-track').value = selectedTrack;
      lullabySleepPending = false;
    }
    toast('睡到中午才醒啦！下次记得在十二点前上床睡觉。', 7);
  }
}

function drawLateSleep() {
  const session = lateSleepSession;
  canvas.dataset.lateSleep = !session ? 'idle' : session.waking !== null ? 'waking'
    : clock - session.started < 1.2 ? 'falling' : 'asleep';
  if (!session) return;
  let progress = Math.min(1, (clock - session.started) / 1.2);
  if (session.waking !== null) progress = 1 - Math.min(1, (clock - session.waking) / 2);
  const ease = progress * progress * (3 - 2 * progress);
  const atlas = currentClothes();
  const region = walkingFrameRegion(atlas, 2, 1);
  const height = 193 * sceneScale(player.y);
  const scale = height / (atlas.naturalHeight / 3);
  const width = region.width * scale;
  ctx.save();
  ctx.fillStyle = '#31441b35';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y - 2, 25 + ease * height * 0.35, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(player.x, player.y - height / 2 * (1 - ease) - 12 * ease);
  ctx.rotate(ease * Math.PI / 2);
  // 整个人物仅绘制一次，背侧朝外的趴卧姿态不露睁开的眼睛，保留当前衣服鞋袜。
  ctx.drawImage(walkingAtlasWithFootwear(atlas), region.x, region.y, region.width, region.height,
    -width / 2, -region.footBottom * scale + height / 2, width, region.height * scale);
  ctx.restore();
  if (ease === 1 && session.waking === null) drawSleepMark(player.x, player.y - 40);
}
