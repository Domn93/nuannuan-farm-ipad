// 衣柜、换衣、睡觉和宠物食盆；动作完成后才提交换衣结果。

const blueClothes = new Image(),
  pajamaClothes = new Image(),
  downClothes = new Image(),
  robeClothes = new Image(),
  bedPoses = new Image(),
  awakeBedPoses = new Image(),
  quiltArt = new Image();
blueClothes.src = 'assets/walk-blue.png';
pajamaClothes.src = 'assets/walk-pajamas.png';
downClothes.src = 'assets/walk-down.png';
robeClothes.src = 'assets/walk-robe.png';
bedPoses.src = 'assets/bed-poses.png';
awakeBedPoses.src = 'assets/bed-poses-awake.png';
quiltArt.src = 'assets/quilt-handmade-wide.png';
let outfit = 'pink',
  quilt = 'pink',
  quiltChange = null,
  sleepSession = null,
  sleepPreparation = null;

function currentClothes() {
  return outfitAtlas(outfit);
}

function outfitAtlas(color) {
  if (color === 'robe') return robeClothes;
  if (color === 'down') return downClothes;
  if (color === 'pajamas') return pajamaClothes;
  if (color === 'blue') return blueClothes;
  return girl;
}

function requireOutdoorClothes() {
  if (outfit !== 'pajamas' && outfit !== 'robe') return true;
  toast('先回家换上外出服，再来骑马、钓鱼或荡秋千吧。');
  return false;
}
let wardrobeGuideUntil = -Infinity;

function showWardrobeGuide() {
  wardrobeGuideUntil = clock + 16;
  toast('衣柜在卧室左侧、床旁边。暖暖走过去，打开柜门就能拿衣服啦。', 7);
}

function drawWardrobeGuide() {
  if (scene !== 'house' || clock >= wardrobeGuideUntil || wardrobe.open) return;
  ctx.save();
  ctx.strokeStyle = '#b58537';
  ctx.lineWidth = 3;
  ctx.setLineDash([7, 5]);
  ctx.strokeRect(wardrobeLayout.x - 4, wardrobeLayout.y - 4,
    wardrobeLayout.width + 8, wardrobeLayout.height + 8);
  ctx.setLineDash([]);
  ctx.fillStyle = '#5e6d48';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('衣柜 ↓', wardrobeLayout.x + wardrobeLayout.width / 2, wardrobeLayout.y - 11);
  ctx.restore();
}
const homeAlarm = {
  napHours: 0.5,
  morningHour: 9,
  ringingUntil: 0,
  nextBellAt: 0,
  day: 0,
  lastHour: 9,
  napDay: -1
};
indoorPlaces.nap = { ...indoorPlaces.bed, label: '睡个午觉', icon: '☀' };
indoorPlaces.alarm = { x: 490, y: 190, label: '设置床头闹钟', icon: '⏰' };

function openHomeAlarm() {
  document.querySelector('#nap-duration').value = String(homeAlarm.napHours);
  document.querySelector('#morning-alarm').value = String(homeAlarm.morningHour);
  document.querySelector('#alarm-dialog').showModal();
}

function playAlarmBell() {
  if (!soundOn || !audio || audio.state === 'suspended') return;
  // 三声短铃叠加泛音，音量逐渐衰减，保留小闹钟的金属铃声。
  for (const delay of [0, 0.18, 0.36]) {
    for (const [frequency, volume] of [
      [880, 0.035],
      [1760, 0.014],
      [2380, 0.008]
    ]) {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain();
      const start = audio.currentTime + delay;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.6);
    }
  }
}

function updateHomeAlarm() {
  if (homeAlarm.lastHour - farmTime.hour > 12) homeAlarm.day++;
  homeAlarm.lastHour = farmTime.hour;
  if (scene !== 'house') return;
  if (sleepSession && sleepSession.waking === null && clock >= sleepSession.alarmAt) {
    homeAlarm.ringingUntil = clock + 3;
    homeAlarm.nextBellAt = clock;
    sleepSession.alarmTriggered = true;
    const nap = sleepSession.mode === 'nap';
    wakeUp();
    toast(nap ? '叮铃铃！午觉时间到啦，掀开被子起床。' : '叮铃铃！起床时间到啦！', 5);
  }
  if (clock < homeAlarm.ringingUntil && clock >= homeAlarm.nextBellAt) {
    playAlarmBell();
    homeAlarm.nextBellAt = clock + 0.8;
  }
  const noon = farmTime.hour >= 12.5 && farmTime.hour < 15;
  if (
    !noon ||
    homeAlarm.napDay === homeAlarm.day ||
    toiletNeed.started !== null ||
    sleepSession ||
    livingSession ||
    bathSession ||
    doorTransition ||
    petFeedingAction ||
    shoeAction ||
    wardrobe.open ||
    gameChoicePanelOpen() ||
    clock < busyUntil ||
    route.length ||
    pendingPlace ||
    keys.size ||
    diningMeal.servings ||
    diningMeal.eatAt !== null ||
    gameDialogOpen()
  )
    return;
  homeAlarm.napDay = homeAlarm.day;
  toast('中午啦，回床上睡个午觉，床头闹钟会叫醒暖暖。');
  walkTo(places.nap, 'nap');
}

function drawHomeAlarm() {
  if (scene !== 'house') return;
  const ringing = clock < homeAlarm.ringingUntil;
  canvas.dataset.alarm = ringing ? 'ringing' : sleepSession ? 'armed' : 'idle';
  canvas.dataset.sleepMode = sleepSession?.mode || 'idle';
  ctx.save();
  // 将底图床头柜上的装饰钟升级成闹钟，只重绘表盘，不叠放第二个钟。
  ctx.translate(439 + (ringing ? Math.sin(clock * 38) * 1.5 : 0), 109);
  ctx.fillStyle = '#fff1cd';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#79603c';
  ctx.lineWidth = 1.4;
  const hour = sleepSession?.mode === 'nap' ? farmTime.hour : homeAlarm.morningHour;
  for (const [angle, length] of [
    [(hour / 12) * Math.PI * 2, 5],
    [(hour % 1) * Math.PI * 2, 8]
  ]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length);
    ctx.stroke();
  }
  if (ringing) {
    ctx.strokeStyle = '#e6bc56';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 12, -8, 7, side < 0 ? 2 : -1, side < 0 ? 4 : 1);
      ctx.stroke();
    }
  }
  ctx.restore();
}
const wardrobe = {
  open: false,
  progress: 0,
  started: null,
  from: 0,
  to: 0,
  changingUntil: 0,
  pendingOutfit: null,
  changeStarted: 0
};
const petFood = { dog: 0, cat: 0 };
let petFeedingAction = null;
const petFoodBin = { x: 1170, y: 534, stand: { x: 1170, y: 612 } };
const foodBowls = {
  dog: { x: 475, y: 607, color: '#8cafa3' },
  cat: { x: 625, y: 607, color: '#d69ea9' }
};
// 图片下半部是盆的外壁；粮食和倒粮落点都使用上半部的内口坐标。
function petBowlSurface(bowl, width = 80, top = -37) {
  const height = width / 1.5;
  return { x: bowl.x, y: bowl.y + top + height * 0.4, rx: width * 0.26, ry: height * 0.12 };
}

function drawBowlFood(surface, count) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(surface.x, surface.y, surface.rx, surface.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#95663f';
  for (let i = 0; i < count; i++) {
    const spread = Math.sqrt((i + 0.5) / count) * 0.82;
    ctx.beginPath();
    ctx.arc(
      surface.x + Math.cos(i * 2.4) * surface.rx * spread,
      surface.y + Math.sin(i * 2.4) * surface.ry * spread,
      1.7,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}
indoorPlaces.wardrobe.x = 285;
indoorPlaces.wardrobe.y = 330;

function feedHousePets() {
  if (scene !== 'house' || petFeedingAction || clock < busyUntil) return;
  for (const pet of pets) if (pet.care) clearPetCare(pet);
  cancelPetPlay();
  if (walkingDog) stopDogWalk(null);
  for (const pet of pets) {
    pet.eatingUntil = 0;
    pet.nextPlan = 0;
    pet.route = [];
  }
  petFeedingAction = { kind: 'dog', stage: 'to-bin', started: clock };
  route = findPath(petFoodBin.stand);
  pendingPlace = null;
  toast('先从储粮盆舀一满勺，再倒进猫狗的饭盆。', 6);
}

function updatePetFeeding() {
  const action = petFeedingAction;
  if (!action) return;
  if (scene !== 'house' || movementKeys.some((key) => keys.has(key))) {
    petFeedingAction = null;
    route = [];
    busyUntil = 0;
    return;
  }
  if ((action.stage === 'to-bin' || action.stage === 'to-bowl') && !route.length) {
    action.stage = action.stage === 'to-bin' ? 'scooping' : 'pouring';
    action.started = clock;
    player.view = 1;
    player.facing = -1;
    busyUntil = clock + 0.9;
  } else if (action.stage === 'scooping' && clock >= busyUntil) {
    const bowl = foodBowls[action.kind];
    action.stage = 'to-bowl';
    route = findPath({ x: bowl.x + 55, y: bowl.y + 78 });
    busyUntil = 0;
  } else if (action.stage === 'pouring' && clock >= busyUntil) {
    // 一满盆有三份，宠物每吃完一份才减量，不会刚添就完全消失。
    petFood[action.kind] = 3;
    if (action.kind === 'dog') {
      action.kind = 'cat';
      action.stage = 'to-bin';
      route = findPath(petFoodBin.stand);
      busyUntil = 0;
    } else {
      petFeedingAction = null;
      busyUntil = 0;
      toast('两盆都添满啦，小伙伴来吃饭吧！');
    }
  }
}

function drawPetFeeding() {
  canvas.dataset.petFeeding = petFeedingAction?.stage || 'idle';
  if (scene !== 'house' || !petFeedingAction) return;
  const action = petFeedingAction;
  if (action.stage === 'to-bin') return;
  const bowl = action.stage === 'scooping' ? petFoodBin : foodBowls[action.kind];
  const surface = petBowlSurface(bowl, action.stage === 'scooping' ? 90 : 80,
    action.stage === 'scooping' ? -34 : -37);
  const pouring = action.stage === 'pouring';
  const x = pouring ? surface.x + 16 : player.x - 20;
  const y = pouring ? surface.y - 22 : player.y - 74;
  ctx.save();
  ctx.strokeStyle = '#9b7550';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(player.x - 18, player.y - 68);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = '#c3d3cb';
  ctx.beginPath();
  ctx.ellipse(x, y, 12, 7, pouring ? -0.6 : 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#95663f';
  for (let i = 0; i < 12; i++) {
    const p = pouring ? ((clock - action.started) * 2 + i / 12) % 1 : 0;
    const sourceX = x - 7 + (i % 4) * 4;
    const sourceY = y - 2 + Math.floor(i / 4) * 3;
    const landingX = surface.x + Math.cos(i * 2.4) * surface.rx * 0.65;
    const landingY = surface.y + Math.sin(i * 2.4) * surface.ry * 0.65;
    ctx.beginPath();
    ctx.arc(
      sourceX + (landingX - sourceX) * p,
      sourceY + (landingY - sourceY) * p,
      1.7,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function toggleWardrobe() {
  if (scene !== 'house' || clock < wardrobe.changingUntil) return;
  document.querySelector('#kitchen-panel').hidden = true;
  wardrobe.open = !wardrobe.open;
  wardrobe.from = wardrobe.progress;
  wardrobe.to = Number(wardrobe.open);
  wardrobe.started = clock;
  busyUntil = clock + 0.65;
  indoorPlaces.wardrobe.label = wardrobe.open ? '关上衣柜' : '打开衣柜';
  document.querySelector('#clothes-panel').hidden = true;
  toast(wardrobe.open ? '衣柜门打开啦，挑一套喜欢的衣服。' : '衣柜门关好啦。');
}

function changeOutfit(color) {
  if (
    scene !== 'house' ||
    !wardrobe.open ||
    wardrobe.started !== null ||
    clock < busyUntil ||
    distance(player, places.wardrobe) > 130
  )
    return;
  if (!['pink', 'blue', 'pajamas', 'down', 'robe'].includes(color)) return;
  if (isFarmWinter() && !['down', 'pajamas', 'robe'].includes(color)) {
    toast('冬天冷，外出要穿羽绒服；睡前可以换睡衣。');
    return;
  }
  if (color === outfit) {
    toast('已经穿着这套衣服啦，可以挑另一套。');
    return;
  }
  wardrobe.pendingOutfit = color;
  wardrobe.changeStarted = clock;
  wardrobe.changingUntil = clock + 2.4;
  busyUntil = wardrobe.changingUntil;
  toast('从衣柜拿出衣服，再换上它…');
}

const quiltColors = {
  blue: { cloth: '#9dc5d7', trim: '#f6efdf', motif: '#eaf5f7' },
  sage: { cloth: '#a8bea0', trim: '#f1e9cc', motif: '#e4efcf' },
  sunny: { cloth: '#efcf89', trim: '#fff4d5', motif: '#fff8d9' }
};

function changeQuilt(nextQuilt) {
  if (scene !== 'house' || !wardrobe.open || wardrobe.started !== null ||
      clock < busyUntil || quiltChange || distance(player, places.wardrobe) > 130) return;
  if (nextQuilt !== 'pink' && !quiltColors[nextQuilt]) return;
  if (quilt === nextQuilt) {
    toast('床上已经铺着这床被子啦。');
    return;
  }
  const stand = { x: 455, y: 322 };
  const path = findPath(stand).slice(1);
  if (!path.length) {
    toast('先走到床边，再把被子铺上去吧。');
    return;
  }
  quiltChange = { kind: nextQuilt, stage: 'walking', stand };
  closeClothesPanel();
  route = path;
  pendingPlace = null;
  targetMarker = null;
  toast('暖暖抱着叠好的被子走到床边，准备亲手铺开。', 5);
}

function quiltFilter(kind) {
  return {
    pink: 'none', blue: 'hue-rotate(220deg) saturate(0.8)',
    sage: 'hue-rotate(110deg) saturate(0.7)',
    sunny: 'hue-rotate(55deg) saturate(0.9)'
  }[kind];
}

function drawQuiltCover(kind, x, top, width, bottom) {
  if (!quiltArt.naturalWidth || bottom <= top) return;
  const fullTop = 161;
  const visible = Math.min(1, (bottom - top) / (bottom - fullTop));
  const sourceY = quiltArt.naturalHeight * (1 - visible);
  ctx.save();
  ctx.filter = quiltFilter(kind);
  ctx.drawImage(quiltArt, 0, sourceY, quiltArt.naturalWidth,
    quiltArt.naturalHeight - sourceY, x, top, width, bottom - top);
  // The turned-over hem stays in the hands while the rest of the quilt unfolds.
  if (visible < 0.99) ctx.drawImage(quiltArt, 0, 0, quiltArt.naturalWidth,
    quiltArt.naturalHeight * 0.18, x, top - 1, width, Math.min(16, (bottom - top) * 0.27));
  ctx.restore();
}

function drawFoldedQuilt(kind, x, y) {
  const colors = quiltColors[kind];
  ctx.save();
  ctx.fillStyle = colors.cloth;
  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, 48, 12, 3);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = colors.motif;
  ctx.beginPath();
  ctx.moveTo(x + 9, y + 3);
  ctx.lineTo(x + 9, y + 10);
  ctx.moveTo(x + 20, y + 3);
  ctx.lineTo(x + 20, y + 10);
  ctx.stroke();
  ctx.restore();
}

let lullabySleepPending = false;
const homeCurtains = { progress: 0, target: null, action: null, nextAttempt: 0, sleepAfter: false };
indoorPlaces.curtains = { x: 560, y: 202, label: '拉上窗帘', icon: '☾' };

function startCurtainPull() {
  if (scene !== 'house' || homeCurtains.action) return;
  const target = homeCurtains.target ?? (homeCurtains.progress < 0.5 ? 1 : 0);
  homeCurtains.action = { started: clock, from: homeCurtains.progress, target };
  homeCurtains.target = null;
  route = [];
  pendingPlace = null;
  keys.clear();
  player.walking = false;
  player.x = 560 + 48 * homeCurtains.progress;
  player.y = 202;
  player.view = 2;
  if (carriedPet) clearPetCare(carriedPet);
  busyUntil = clock + 1.6;
  toast(target ? '天黑啦，暖暖把窗帘慢慢拉上。' : '拉开窗帘，看看窗外。');
}

function updateHomeCurtains() {
  if (scene !== 'house') {
    homeCurtains.action = null;
    homeCurtains.target = null;
    return;
  }
  if (!homeCurtains.action && homeCurtains.target !== null && pendingPlace !== 'curtains') {
    // 手动移动或选了别的活动就取消旧寻路，不能永久卡在“准备拉帘”。
    homeCurtains.target = null;
    homeCurtains.sleepAfter = false;
  }
  const action = homeCurtains.action;
  if (action) {
    const t = Math.min(1, (clock - action.started) / 1.6);
    homeCurtains.progress = action.from + (action.target - action.from) * t * t * (3 - 2 * t);
    // 人随左侧帘边移步，手始终在肩旁；不能站在原地用长手臂跨过整扇窗。
    player.x = 560 + 48 * homeCurtains.progress;
    player.y = 202;
    player.walking = t > 0 && t < 1;
    if (t === 1) {
      player.walking = false;
      homeCurtains.action = null;
      homeCurtains.nextAttempt = clock + 20;
      busyUntil = 0;
      indoorPlaces.curtains.label = homeCurtains.progress > 0.5 ? '拉开窗帘' : '拉上窗帘';
      if (homeCurtains.sleepAfter) {
        homeCurtains.sleepAfter = false;
        walkTo(places.bed, 'bed');
      }
    }
    return;
  }
  const target = Number(isFarmNight());
  if (
    Math.abs(target - homeCurtains.progress) < 0.01 ||
    clock < homeCurtains.nextAttempt ||
    homeCurtains.target !== null ||
    sleepSession ||
    sleepPreparation ||
    wardrobe.open ||
    gameChoicePanelOpen() ||
    livingSession ||
    bathSession ||
    doorTransition ||
    clock < busyUntil ||
    route.length ||
    pendingPlace ||
    keys.size ||
    gameDialogOpen()
  )
    return;
  homeCurtains.target = target;
  homeCurtains.nextAttempt = clock + 8;
  walkTo(places.curtains, 'curtains');
  if (pendingPlace !== 'curtains') homeCurtains.target = null;
}

function drawHomeCurtains() {
  if (scene !== 'house') return;
  const p = homeCurtains.progress;
  // 夜间玻璃不能继续显示白天的蓝天；布料只在真实窗洞内展开。
  if (isFarmNight()) {
    ctx.fillStyle = '#1b2846';
    ctx.fillRect(532, 78, 95, 46);
  }
  if (p > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(532, 78, 96, 52);
    ctx.clip();
    // 使用绑带上方的纯布料，覆盖窗玻璃，避免把墙面和窗台裁进展开的帘子。
    ctx.drawImage(originalInterior, 501, 80, 25, 27, 532, 78, 48 * p, 52);
    ctx.drawImage(originalInterior, 632, 80, 25, 27, 628 - 48 * p, 78, 48 * p, 52);
    ctx.restore();
  }
  canvas.dataset.curtains = homeCurtains.action ? 'moving' : p > 0.99 ? 'closed' : 'open';
}

function drawCurtainAction() {
  if (scene !== 'house' || !homeCurtains.action) return;
  const hand = { x: 532 + 48 * homeCurtains.progress, y: 124 };
  ctx.save();
  ctx.strokeStyle = '#f3c4a0';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(player.x - 16, player.y - 76);
  ctx.quadraticCurveTo(hand.x + 7, hand.y + 9, hand.x, hand.y);
  ctx.stroke();
  ctx.fillStyle = '#f3c4a0';
  ctx.beginPath();
  ctx.ellipse(hand.x, hand.y, 4, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function lullabyIsPlaying() {
  // 选中了曲目或 soundOn 尚未更新，都不能代替真正正在播放的音乐。
  return selectedTrack === 'moon' && soundOn && audio?.state === 'running' &&
    music?.track === 'moon' && music.timer !== null;
}

function requestLullabySleep() {
  if (lullabyIsPlaying() && sleepSession?.mode !== 'night')
    lullabySleepPending = true;
}

function updateLullabySleep() {
  if (lateSleepSession) return;
  if (!lullabySleepPending || !ready) return;
  lullabySleepPending = false;
  if (!lullabyIsPlaying() || sleepSession?.mode === 'night') return;
  // 播放摇篮曲就是开始夜间休息；白天播放也切到晚上，午睡则重新安排为晚觉。
  if (!isFarmNight()) farmTime.hour = 20;
  document.querySelector('#time-of-day').value = isFarmLateNight() ? '23' : '18';
  updateFarmTime(0);
  // 摇篮曲是一次入睡动作；先收好骑乘/携带状态，避免动物被带进卧室。
  busyUntil = 0;
  if (riding) dismountHorse();
  if (animalTravel) {
    changeScene('farm');
    releaseTravelAnimal();
  }
  changeScene('house');
  keys.clear();
  walkTo(places.bed, 'bed');
  toast('月光摇篮曲响起来啦，到了晚上睡觉的时间，暖暖回卧室关窗帘、盖被子。', 6);
}

function startSleep(mode = null) {
  if (lateSleepSession) return;
  if (scene !== 'house' || sleepSession) return;
  if (mode === 'nap' && isFarmNight()) {
    toast('现在是夜晚，午觉留到白天，晚上可以正常睡觉。');
    return;
  }
  const nap = mode === 'nap' ||
    (mode !== 'night' && selectedTrack !== 'moon' && farmTime.hour >= 12 && farmTime.hour < 16);
  if (!nap && !lullabyIsPlaying()) {
    cancelSleepPreparation();
    homeCurtains.sleepAfter = false;
    toast('暖暖还睡不着，先选择《月光摇篮曲》，再点音符播放，听着音乐慢慢入睡吧。', 7);
    return;
  }
  if (outfit !== 'pajamas') {
    if (sleepPreparation) return;
    sleepPreparation = { mode, stage: 'to-wardrobe' };
    stopNuannuanSpeech();
    closeClothesPanel();
    route = findPath(places.wardrobe);
    pendingPlace = null;
    targetMarker = null;
    busyUntil = 0;
    toast('先去衣柜拿睡衣，换好以后再上床。', 5);
    return;
  }
  if (isFarmNight() && homeCurtains.progress < 0.99) {
    homeCurtains.target = 1;
    homeCurtains.sleepAfter = true;
    walkTo(places.curtains, 'curtains');
    return;
  }
  const catCanJoin = petIsHere(cat) &&
    (carriedPet === cat || cat.care?.mode === 'bed' || distance(cat, places.bed) < 270);
  if (carriedPet) clearPetCare(carriedPet);
  if (walkingDog) stopDogWalk(null);
  closeClothesPanel();
  route = [];
  pendingPlace = null;
  targetMarker = null;
  player.walking = false;
  player.x = places.bed.x;
  player.y = places.bed.y;
  const hours = nap ? homeAlarm.napHours : (homeAlarm.morningHour - farmTime.hour + 24) % 24 || 24;
  sleepSession = {
    started: clock,
    calendarDay: farmTime.day,
    waking: null,
    mode: nap ? 'nap' : 'night',
    alarmAt: clock + hours * 30,
    alarmTriggered: false
  };
  stopNuannuanSpeech();
  if (catCanJoin) inviteCatToBed();
  if (nap) homeAlarm.napDay = homeAlarm.day;
  busyUntil = Infinity;
  toast(
    nap ? '脱好鞋、躺下盖被睡午觉，闹钟到点会叮铃铃叫醒你。' : '先脱下鞋子，再躺进软软的被窝…',
    5
  );
}

function wakeUp() {
  if (!sleepSession || sleepSession.waking !== null) return;
  if (selectedTrack === 'moon') {
    // 主动起床时切回晨间音乐，避免摇篮曲继续播放却又开始外出活动。
    selectedTrack = 'meadow';
    music?.setTrack(selectedTrack);
    document.querySelector('#music-track').value = selectedTrack;
  }
  sleepSession.waking = clock;
  keys.clear();
  toast('掀开被子，慢慢起床，再把鞋子穿好。', 4);
}

function closeClothesPanel() {
  document.querySelector('#clothes-panel').hidden = true;
  if (wardrobe.open) {
    wardrobe.open = false;
    wardrobe.from = wardrobe.progress;
    wardrobe.to = 0;
    wardrobe.started = clock;
    indoorPlaces.wardrobe.label = '打开衣柜';
  }
}

function resetHomeAction() {
  sleepPreparation = null;
  homeAlarm.ringingUntil = 0;
  document.querySelector('#alarm-dialog').close();
  petFeedingAction = null;
  homeCurtains.sleepAfter = false;
  homeCurtains.target = null;
  homeCurtains.action = null;
  sleepSession = null;
  quiltChange = null;
  wardrobe.open = false;
  wardrobe.progress = 0;
  wardrobe.started = null;
  wardrobe.changingUntil = 0;
  wardrobe.pendingOutfit = null;
  indoorPlaces.wardrobe.label = '打开衣柜';
  document.querySelector('#clothes-panel').hidden = true;
}

function updateHome() {
  updatePetFeeding();
  if (scene !== 'house') return;
  updateHomeAlarm();
  if (wardrobe.pendingOutfit && clock >= wardrobe.changingUntil) {
    outfit = wardrobe.pendingOutfit;
    wardrobe.pendingOutfit = null;
    const changedWetClothes = toiletNeed.wetClothes;
    if (changedWetClothes) {
      toiletNeed.wetClothes = false;
      toiletNeed.nextAt = clock + 360 + Math.random() * 180;
    }
    document
      .querySelectorAll('[data-outfit]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.outfit === outfit))
      );
    toast(changedWetClothes ? '换上干净衣服，暖暖舒服多啦。'
      : outfit === 'robe'
        ? '浴袍穿好啦，腰带也系好了。'
        : outfit === 'down'
          ? '羽绒服穿好啦，暖暖不怕冷了。'
          : outfit === 'pajamas'
            ? '睡衣穿好啦，可以去床上休息了。'
            : outfit === 'blue'
              ? '换上蓝色格纹裙啦！'
              : '换上粉色格纹裙啦！'
    );
  }
  if (wardrobe.started !== null) {
    const t = Math.min(1, (clock - wardrobe.started) / 0.65),
      ease = t * t * (3 - 2 * t);
    wardrobe.progress = wardrobe.from + (wardrobe.to - wardrobe.from) * ease;
    if (t === 1) {
      wardrobe.started = null;
      document.querySelector('#clothes-panel').hidden = !wardrobe.open;
      if (wardrobe.open && isFarmWinter() && !sleepPreparation && outfit !== 'down')
        changeOutfit('down');
    }
  }
  if (wardrobe.open && distance(player, places.wardrobe) > 130) closeClothesPanel();
  if (quiltChange) {
    const action = quiltChange;
    if (movementKeys.some((key) => keys.has(key))) {
      quiltChange = null;
      route = [];
      busyUntil = 0;
      toast('先把被子叠好收起来，想铺时再从衣柜拿。');
    } else if (action.stage === 'walking' && !route.length) {
      if (distance(player, action.stand) > 28) quiltChange = null;
      else {
        action.stage = 'spreading';
        action.started = clock;
        action.fromY = player.y;
        busyUntil = clock + 2.6;
        player.view = 1;
        player.facing = -1;
      }
    } else if (action.stage === 'spreading') {
      const progress = Math.min(1, (clock - action.started) / 2.6);
      player.y = action.fromY - 70 * progress;
      player.walking = false;
      if (progress === 1) {
        quilt = action.kind;
        quiltChange = null;
        busyUntil = 0;
        document.querySelectorAll('[data-quilt]').forEach((button) =>
          button.setAttribute('aria-pressed', String(button.dataset.quilt === quilt)));
        toast('被角一寸寸铺平啦，软软的被子盖好了。');
      }
    }
  }
  updateSleepPreparation();
  if (sleepSession && sleepSession.waking !== null && clock - sleepSession.waking >= 2.4) {
    const nap = sleepSession.mode === 'nap';
    const alarmTriggered = sleepSession.alarmTriggered;
    const calendarDay = sleepSession.calendarDay;
    sleepSession = null;
    busyUntil = 0;
    keys.clear();
    if (!nap) {
      // 自然经过午夜已经计过一天；提前起床跳到早晨时才补记新的一天。
      if (farmTime.day === calendarDay) farmTime.day++;
      if (homeAlarm.napDay === homeAlarm.day) homeAlarm.day++;
      startFarmMorning(alarmTriggered ? homeAlarm.morningHour : 9);
      scheduleMorningToiletNeed();
    }
    toast(nap ? '午觉睡好啦，还是下午，穿好拖鞋继续玩吧 ☀' : '睡醒啦，天亮了！穿好拖鞋继续玩吧 ☀');
  }
}

function cancelSleepPreparation() {
  if (!sleepPreparation) return;
  sleepPreparation = null;
  wardrobe.pendingOutfit = null;
  wardrobe.changingUntil = 0;
  busyUntil = 0;
  closeClothesPanel();
}

function updateSleepPreparation() {
  const preparation = sleepPreparation;
  if (!preparation) return;
  if (movementKeys.some((key) => keys.has(key))) {
    cancelSleepPreparation();
    route = [];
    return;
  }
  if (preparation.stage === 'to-wardrobe' && !route.length && clock >= busyUntil) {
    if (distance(player, places.wardrobe) > 100) {
      cancelSleepPreparation();
      toast('请走到衣柜旁，再准备睡觉。');
      return;
    }
    if (!wardrobe.open) toggleWardrobe();
    preparation.stage = 'opening';
  } else if (preparation.stage === 'opening' && wardrobe.started === null && clock >= busyUntil) {
    changeOutfit('pajamas');
    preparation.stage = 'dressing';
  } else if (preparation.stage === 'dressing' && !wardrobe.pendingOutfit) {
    // 换衣已经提交，才允许去床边；床上动作不再负责更换衣服。
    const mode = preparation.mode;
    sleepPreparation = null;
    walkTo(places.bed, mode === 'nap' ? 'nap' : 'bed');
  }
}

function drawHomeFurniture() {
  if (scene !== 'house') return;
  ctx.save();
  drawHomeCatCarrier();
  // 铺好的被子属于床面，先画在人物和宠物身后。
  drawQuiltCover(quilt, 255, 161, 152, 293);
  if (quiltChange?.stage === 'spreading') {
    const progress = Math.min(1, (clock - quiltChange.started) / 2.6);
    const smooth = progress * progress * (3 - 2 * progress);
    drawQuiltCover(quiltChange.kind, 255, 263 - 102 * smooth, 152, 293);
  }
  // 底图不含衣柜；柜体和门叶各画一次，避免原画关门与动态开门重叠。
  const cabinet = homeFurnitureRegions.wardrobe;
  const layout = wardrobeLayout;
  ctx.drawImage(
    homeFurnitureArt,
    cabinet.x,
    cabinet.y,
    cabinet.width,
    cabinet.height,
    layout.x,
    layout.y,
    layout.width,
    layout.height
  );
  if (wardrobe.progress > 0) {
    ctx.save();
    // 衣物只挂在柜内；最右侧厚外套不能穿过柜框，浮到床旁的地板上。
    ctx.beginPath();
    ctx.rect(172, 154, 69, 178);
    ctx.clip();
    for (const [color, x] of [
      ['pink', 185],
      ['blue', 205],
      ['pajamas', 225],
      ['down', 241]
    ]) {
      if (color === outfit || color === wardrobe.pendingOutfit) continue;
      const atlas = outfitAtlas(color);
      const cw = atlas.naturalWidth / 4,
        ch = atlas.naturalHeight / 3;
      ctx.drawImage(atlas, cw + cw * 0.2, ch * 0.4, cw * 0.6, ch * 0.43, x - 12, 158, 25, 82);
    }
    drawFoldedQuilt('blue', 181, 255);
    drawFoldedQuilt('sage', 181, 273);
    drawFoldedQuilt('sunny', 181, 300);
    ctx.restore();
  }
  const leaf = homeFurnitureRegions.wardrobeDoor;
  drawWoodDoor(
    homeFurnitureArt,
    [leaf.x, leaf.y, leaf.width, leaf.height],
    [layout.door.x, layout.door.y, layout.door.width, layout.door.height],
    wardrobe.progress
  );
  drawWardrobeGuide();

  ctx.textAlign = 'center';
  for (const x of [440, 462]) {
    ctx.fillStyle = '#f8e3c0';
    ctx.beginPath();
    ctx.ellipse(x, 306, 8, 15, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94b4a3';
    ctx.beginPath();
    ctx.ellipse(x, 301, 8, 9, 0.15, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  for (const [kind, bowl] of Object.entries(foodBowls)) {
    ctx.drawImage(petProps.bowl, bowl.x - 40, bowl.y - 37, 80, 80 / 1.5);
    drawBowlFood(petBowlSurface(bowl), 18 * petFood[kind]);
  }
  // 储粮盆与食盆分开，放在阳台靠边，方便看见舀粮的来源。
  ctx.drawImage(petProps.bowl, petFoodBin.x - 45, petFoodBin.y - 34, 90, 60);
  drawBowlFood(petBowlSurface(petFoodBin, 90, -34), 60);
  ctx.restore();
}

function drawBedAction() {
  canvas.dataset.sleepPreparation = sleepPreparation?.stage || 'idle';
  canvas.dataset.sleep = sleepSession
    ? sleepSession.waking !== null
      ? 'waking'
      : clock - sleepSession.started < 1.2
        ? 'shoes'
        : clock - sleepSession.started < 2.4
          ? 'lying'
          : clock - sleepSession.started < 3.6
            ? 'covering'
            : 'sleeping'
    : 'idle';
  canvas.dataset.outfit = outfit;
  canvas.dataset.quilt = quilt;
  canvas.dataset.wardrobe =
    wardrobe.started !== null ? 'moving' : wardrobe.open ? 'open' : 'closed';
  if (scene !== 'house') return;
  if (quiltChange) {
    if (quiltChange.stage === 'walking') {
      ctx.save();
      ctx.translate(player.x - 24, player.y - 92);
      ctx.rotate(-0.2);
      ctx.filter = quiltFilter(quiltChange.kind);
      ctx.drawImage(quiltArt, -21, -7, 42, 14);
      ctx.restore();
    } else {
      const progress = Math.min(1, (clock - quiltChange.started) / 2.6);
      const smooth = progress * progress * (3 - 2 * progress);
      const top = 263 - 102 * smooth;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = outfit === 'pajamas' ? '#e79aaa' : '#df9ea9';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(player.x - 17, player.y - 88);
      ctx.lineTo(411, top + 10);
      ctx.stroke();
      ctx.fillStyle = '#f3c4a0';
      ctx.beginPath();
      ctx.ellipse(410, top + 10, 7, 5, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (clock < wardrobe.changingUntil) {
    if (clock - wardrobe.changeStarted < 0.8) {
      const t = (clock - wardrobe.changeStarted) / 0.8,
        x = 211 + (player.x - 211) * t,
        y = 234 + (player.y - 95 - 234) * t;
      const atlas = outfitAtlas(wardrobe.pendingOutfit);
      const cw = atlas.naturalWidth / 4,
        ch = atlas.naturalHeight / 3;
      ctx.drawImage(atlas, cw + cw * 0.2, ch * 0.4, cw * 0.6, ch * 0.43, x - 25, y, 50, 60);
    } else {
      drawPrivacyCurtain(player.x - 65, player.y - 175, 130, 170);
      ctx.fillStyle = '#7c7565';
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('换衣服…', player.x, player.y - 85);
    }
  }
  canvas.dataset.clothesAction = wardrobe.pendingOutfit
    ? clock - wardrobe.changeStarted < 0.8
      ? 'taking'
      : 'dressing'
    : 'idle';
  if (!sleepSession) return;
  const elapsed = clock - sleepSession.started,
    wake = sleepSession.waking === null ? null : clock - sleepSession.waking;
  const climb = Math.max(0, Math.min(1, (elapsed - 1.2) / 1.2));
  const returnToFloor = wake === null ? 0 : Math.max(0, Math.min(1, (wake - 1) / 1.4));
  const inBed = climb * (1 - returnToFloor);
  const x = player.x + (335 - player.x) * inBed,
    y = player.y + (290 - player.y) * inBed;
  ctx.save();
  // Shoes remain beside the bed until the final part of waking up.
  if (elapsed > 0.5 && (wake === null || wake < 2))
    for (const offset of [-14, 14]) {
      const progress = Math.min(1, (elapsed - 0.5) / 0.6);
      ctx.fillStyle = currentShoes().color;
      ctx.beginPath();
      ctx.ellipse(440 + offset, 333 + progress * 10, 10, 17, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f9eee4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(435 + offset, 340);
      ctx.lineTo(446 + offset, 340);
      ctx.stroke();
    }
  // 起身/躺下姿态互斥，跨床位淡入淡出会同时出现两个暖暖。
  if (inBed < 0.6) {
    const atlas = currentClothes(),
      width = atlas.naturalWidth / 4,
      height = atlas.naturalHeight / 3;
    ctx.drawImage(atlas, width, 0, width, height, x - 65, y - 170, 130, 170);
  } else {
    // 躺下、拉被及起床时睁眼，只有盖好被子进入睡眠后才切换闭眼图。
    const pose = elapsed < 3.6 || wake !== null ? awakeBedPoses : bedPoses;
    ctx.drawImage(pose, pose.naturalWidth / 2, 0, pose.naturalWidth / 2, pose.naturalHeight, 270, 91, 137, 207);
  }
  let covered = Math.max(0, Math.min(1, (elapsed - 2.4) / 1.2));
  if (wake !== null) covered *= Math.max(0, 1 - wake);
  if (covered > 0) {
    // 只盖住腰以下，脸、睡衣和两只手始终留在被沿外。
    const smooth = covered * covered * (3 - 2 * covered);
    const top = 260 - 46 * smooth;
    drawQuiltCover(quilt, 264, top, 145, 293);
  }
  if (elapsed >= 3.6 && wake === null) {
    ctx.fillStyle = '#85829b';
    ctx.font = '23px sans-serif';
    ctx.fillText('z', 401, 119 + Math.sin(clock) * 4);
    ctx.font = '16px sans-serif';
    ctx.fillText('z', 420, 100 + Math.sin(clock + 1) * 4);
  }
  ctx.restore();
}
