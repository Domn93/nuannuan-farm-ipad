// 独立 App 的生活存档：只提交完整动作后的状态，不保存预扣食材或半途动画。
const ipadAnimalFields = ['x', 'y', 'growth', 'targetGrowth', 'lastFedDay', 'feedDays',
  'growthCreditedDay', 'sheltering', 'visitScene', 'visitPosition', 'restPosition',
  'affinity', 'lastPat'];
const ipadPetFields = ['kind', 'x', 'y', 'scene', 'home', 'boarded', 'facing',
  'heading', 'view', 'indoorRestAllowed'];
const ipadScenes = ['farm', 'house', 'barn', 'junction', 'forest', 'city', 'friends',
  'hospital', 'petHospital', 'bakery', 'villageHouse', 'boardingHouse'];

function ipadPick(value, fields) {
  return Object.fromEntries(fields.filter((field) => value[field] !== undefined)
    .map((field) => [field, value[field]]));
}

function canSaveIPadLife() {
  return ready && clock >= busyUntil && !livingSession && !fishingSession && !swingSession &&
    !sleepSession && !sleepPreparation && !lateSleepSession && !bathSession && !toiletSession &&
    !quiltChange && !shoeAction && !petFeedingAction && !petVetVisit && !petMedicineRequest &&
    !forestAdventureSession && !marketVisit && !mountSession && !doorTransition &&
    !penGate.started && !balconyDoor.started && !boardingGuestVisit && !nuannuanHealth.treatment &&
    !heatRescue && !wardrobe.pendingOutfit && !plantCare &&
    pets.every((pet) => !pet.care || ['hold', 'back'].includes(pet.care.mode) && pet.care.phase === 'carried');
}

function captureIPadLife() {
  if (!canSaveIPadLife()) return null;
  const snapshot = {
    version: 1, savedAt: new Date().toISOString(), clock, scene,
    player: ipadPick(player, ['x', 'y', 'facing', 'view']),
    pocket, farmTime, farmClimate, outfit, quilt, footwear, hygiene,
    hunger: { satiety: ipadHunger.satiety },
    homeAlarm, petFood, fridgeStock: fridge.stock, bagFoodBatches,
    diningMeal, catCarrierPacked, walkingDog, riding, buildingReturn,
    carried: carriedPet ? { kind: carriedPet.kind, mode: carriedPet.care.mode } : null,
    penOpen: penGate.open, balconyOpen: balconyDoor.open,
    curtains: homeCurtains.progress, airConditioner: homeAirConditioner.on,
    health: ipadPick(nuannuanHealth, [...Object.keys(nuannuanHealth).filter((key) => key !== 'treatment'), 'course']),
    petHealth, nextRoutineColdAt, nextRoutinePetIllnessAt, toiletNeed,
    animals: animals.map((animal) => ipadPick(animal, ipadAnimalFields)),
    pets: pets.map((pet) => ipadPick(pet, ipadPetFields)),
    plants: housePlants.map((plant) => ({ water: plant.water, dead: plant.dead })),
    friends: friendGroup.map((friend) => friend.friend),
    cityFriends: cityFriends.map((friend) => friend.friend),
    television: { on: tvOn, program: tvProgram, started: tvProgramStarted },
    cooldowns: {
      stalls: Object.fromEntries(Object.entries(marketStalls).map(([key, stall]) => [key, stall.readyAt])),
      leaves: Object.fromEntries(Object.entries(leafSpots).map(([key, spot]) => [key, spot.readyAt])),
      butterfly: forestButterfly.readyAt, timber: forestTimber.readyAt
    },
    mushrooms: forestMushrooms,
    guests: boardingGuests.map((guest) => ipadPick(guest, ['sick', 'nextSickAt', 'protectedUntil'])),
    discoveries: { seen: [...discoveryBook.seen], counts: discoveryBook.counts },
    selectedTrack, musicWanted
  };
  // 和运行中的对象断开引用；采集后下一帧的变化不能修改正在写入的存档。
  return JSON.parse(JSON.stringify(snapshot));
}

function validIPadLife(snapshot) {
  return snapshot?.version === 1 && ipadScenes.includes(snapshot.scene) &&
    Number.isFinite(snapshot.clock) && snapshot.clock >= 0 &&
    Number.isSafeInteger(snapshot.farmTime?.day) && snapshot.farmTime.day >= 0 &&
    Number.isFinite(snapshot.farmTime.hour) && snapshot.farmTime.hour >= 0 && snapshot.farmTime.hour < 24 &&
    Number.isInteger(snapshot.farmClimate?.season) && snapshot.farmClimate.season >= 0 && snapshot.farmClimate.season <= 3 &&
    Number.isFinite(snapshot.player?.x) && Number.isFinite(snapshot.player?.y) &&
    snapshot.player.x >= 0 && snapshot.player.x <= W && snapshot.player.y >= 0 && snapshot.player.y <= H &&
    snapshot.pocket && Object.keys(pocket).every((key) =>
      Number.isSafeInteger(snapshot.pocket[key]) && snapshot.pocket[key] >= 0) &&
    Array.isArray(snapshot.animals) && snapshot.animals.length === animals.length &&
    Array.isArray(snapshot.pets) && snapshot.pets.length === pets.length;
}

function ipadRestoreFields(target, saved, fields = Object.keys(target)) {
  if (!saved || typeof saved !== 'object') return;
  for (const key of fields) {
    const value = saved[key];
    if (value === undefined || typeof value === 'number' && !Number.isFinite(value)) continue;
    // JSON 的 null 可能来自 Infinity；保留默认计时器，不能把它变成即时触发。
    if (value === null && typeof target[key] === 'number') continue;
    if (target[key] !== undefined && target[key] !== null && value !== null &&
        typeof value !== typeof target[key]) continue;
    target[key] = value;
  }
}

function restoreIPadLife(snapshot) {
  if (!validIPadLife(snapshot)) return false;
  clock = snapshot.clock;
  ipadRestoreFields(pocket, snapshot.pocket);
  ipadRestoreFields(farmTime, snapshot.farmTime);
  ipadRestoreFields(farmClimate, snapshot.farmClimate);
  if (['pink', 'blue', 'pajamas', 'robe', 'down'].includes(snapshot.outfit)) outfit = snapshot.outfit;
  if (['pink', 'blue', 'sage', 'sunny'].includes(snapshot.quilt)) quilt = snapshot.quilt;
  ipadRestoreFields(footwear, snapshot.footwear);
  ipadRestoreFields(hygiene, snapshot.hygiene);
  restoreIPadHunger(snapshot.hunger);
  ipadRestoreFields(homeAlarm, snapshot.homeAlarm);
  ipadRestoreFields(petFood, snapshot.petFood);
  ipadRestoreFields(fridge.stock, snapshot.fridgeStock);
  ipadRestoreFields(bagFoodBatches, snapshot.bagFoodBatches);
  ipadRestoreFields(diningMeal, snapshot.diningMeal);
  ipadRestoreFields(nuannuanHealth, snapshot.health, [...Object.keys(nuannuanHealth), 'course']);
  for (const kind of ['dog', 'cat'])
    ipadRestoreFields(petHealth[kind], snapshot.petHealth?.[kind], [...Object.keys(petHealth[kind]), 'course']);
  ipadRestoreFields(toiletNeed, snapshot.toiletNeed);
  if (Number.isFinite(snapshot.nextRoutineColdAt)) nextRoutineColdAt = snapshot.nextRoutineColdAt;
  if (Number.isFinite(snapshot.nextRoutinePetIllnessAt)) nextRoutinePetIllnessAt = snapshot.nextRoutinePetIllnessAt;
  penGate.open = snapshot.penOpen === true;
  penGate.progress = Number(penGate.open);
  balconyDoor.open = snapshot.balconyOpen === true;
  homeAirConditioner.on = snapshot.airConditioner === true;
  homeCurtains.progress = Math.max(0, Math.min(1, snapshot.curtains || 0));
  animals.forEach((animal, index) => ipadRestoreFields(animal, snapshot.animals[index], ipadAnimalFields));
  // 先建立正确地图、网格及菜单，再恢复宠物，避免切图清理覆盖存档。
  changeScene(snapshot.scene);
  buildingReturn = snapshot.buildingReturn || null;
  riding = snapshot.riding === true && !['house', 'barn'].includes(scene) && !isBuildingInterior();
  if (canWalk(snapshot.player.x, snapshot.player.y)) ipadRestoreFields(player, snapshot.player);
  player.walking = false;
  pets.forEach((pet, index) => {
    ipadRestoreFields(pet, snapshot.pets[index], ipadPetFields);
    pet.route = [];
    pet.nextPlan = pet.boarded ? Infinity : clock + 2;
    pet.care = null;
  });
  catCarrierPacked = snapshot.catCarrierPacked === true;
  walkingDog = snapshot.walkingDog === true && !dog.boarded && dog.scene === scene;
  const carried = pets.find((pet) => pet.kind === snapshot.carried?.kind);
  if (carried && !carried.boarded && carried.scene === scene &&
      ['hold', 'back'].includes(snapshot.carried.mode) && (carried !== cat || catCarrierPacked)) {
    carriedPet = carried;
    carried.care = { mode: snapshot.carried.mode, phase: 'carried', started: clock - 1,
      from: { x: carried.x, y: carried.y }, floor: { x: player.x, y: player.y }, nextPlan: 0 };
  }
  housePlants.forEach((plant, index) => ipadRestoreFields(plant, snapshot.plants?.[index], ['water', 'dead']));
  friendGroup.forEach((friend, index) => { friend.friend = snapshot.friends?.[index] === true; });
  cityFriends.forEach((friend, index) => { friend.friend = snapshot.cityFriends?.[index] === true; });
  if (Number.isInteger(snapshot.television?.program) && tvPrograms[snapshot.television.program]) {
    tvProgram = snapshot.television.program;
    tvOn = snapshot.television.on === true;
    if (Number.isFinite(snapshot.television.started)) tvProgramStarted = snapshot.television.started;
    refreshTvGuide();
  }
  for (const [key, stall] of Object.entries(marketStalls))
    if (Number.isFinite(snapshot.cooldowns?.stalls?.[key])) stall.readyAt = snapshot.cooldowns.stalls[key];
  for (const [key, spot] of Object.entries(leafSpots))
    if (Number.isFinite(snapshot.cooldowns?.leaves?.[key])) spot.readyAt = snapshot.cooldowns.leaves[key];
  if (Number.isFinite(snapshot.cooldowns?.butterfly)) forestButterfly.readyAt = snapshot.cooldowns.butterfly;
  if (Number.isFinite(snapshot.cooldowns?.timber)) forestTimber.readyAt = snapshot.cooldowns.timber;
  forestMushrooms.forEach((mushroom, index) => {
    ipadRestoreFields(mushroom, snapshot.mushrooms?.[index]);
    Object.assign(explorePlaces.forest[`mushroom${index}`], { x: mushroom.x, y: mushroom.y });
  });
  boardingGuests.forEach((guest, index) =>
    ipadRestoreFields(guest, snapshot.guests?.[index], ['sick', 'nextSickAt', 'protectedUntil']));
  if (Array.isArray(snapshot.discoveries?.seen)) {
    discoveryBook.seen = new Set(snapshot.discoveries.seen.filter((value) => typeof value === 'string'));
    discoveryBook.counts = Object.fromEntries(Object.entries(snapshot.discoveries.counts || {})
      .filter(([, count]) => Number.isSafeInteger(count) && count >= 0));
  }
  if (['meadow', 'breeze', 'moon'].includes(snapshot.selectedTrack)) selectedTrack = snapshot.selectedTrack;
  musicWanted = snapshot.musicWanted !== false;
  document.querySelector('#music-track').value = selectedTrack;
  document.querySelector('#farm-season').value = String(farmClimate.season);
  indoorPlaces.catCarrier.label = catCarrierPacked ? '把猫旅行包放回家' : '拿起猫旅行包';
  document.querySelector('[data-room="catCarrier"]').textContent = `🐾 ${indoorPlaces.catCarrier.label}`;
  document.querySelectorAll('[data-outfit]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.outfit === outfit)));
  document.querySelectorAll('[data-quilt]').forEach((button) =>
    button.setAttribute('aria-pressed', String(button.dataset.quilt === quilt)));
  rebuildGrid();
  updatePetPlaceMarkers();
  refreshBackpack();
  refreshShoeChoices();
  discoverMapLife();
  refreshIPadNeeds();
  return true;
}
