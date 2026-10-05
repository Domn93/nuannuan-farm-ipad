// 宠物疾病跨地图保留；兽医开药后，完成多日疗程才恢复。
const petHealth = {
  dog: { sick: false, severe: false, illnessStartedAt: null, exposure: 0, protectedUntil: 0 },
  cat: { sick: false, severe: false, illnessStartedAt: null, exposure: 0, protectedUntil: 0 }
};
let petVetVisit = null;
let nextRoutinePetIllnessAt = 420 + Math.random() * 240;
buildingArt.petHospital = new Image();
buildingArt.petHospital.src = 'assets/pet-hospital.png';
buildingDoors.city.petHospitalDoor = {
  x: 415, y: 395, label: '进入宠物医院', icon: '🐾', destination: 'petHospital',
  panel: { x: 392, y: 339, width: 46, height: 110, native: true }
};
buildingPlaces.petHospital = {
  buildingExit: { x: 768, y: 845, label: '打开宠物医院门出去', icon: '↩' },
  vetDog: { x: 855, y: 570, label: '请兽医给萨摩耶看病', icon: '🐕' },
  vetCat: { x: 835, y: 620, label: '请兽医给布偶猫看病', icon: '🐈' },
  vetGuestCat: { x: 750, y: 610, label: '请兽医给寄养橘猫看病', icon: '🐈' },
  dog: { x: -10000, y: -10000, label: '牵萨摩耶散步', icon: '🐕' },
  cat: { x: -10000, y: -10000, label: '摸摸布偶猫', icon: '♡' }
};
registerBuildingDoors();

function startPetVetVisit(kind) {
  if (scene !== 'petHospital' || petVetVisit) return;
  if (boardingGuestVisit) {
    toast('旅行猫包里还有寄养橘猫，先让兽医给它看完病吧。', 6);
    return;
  }
  const pet = kind === 'dog' ? dog : cat;
  if (!petIsHere(pet)) {
    toast(pet.boarded
      ? `先去寄养所接回${pet.name}${pet === cat ? '，记得从家里带上旅行猫包' : ''}，再来宠物医院检查。`
      : `先把${pet.name}带来：狗可以牵来，猫需要旅行猫包，再请兽医检查。`, 7);
    return;
  }
  // 放下怀里的病人，再走到兽医面前，不能把远处宠物瞬移到诊室。
  clearPetCare(pet);
  cancelPetPlay();
  if (walkingDog) stopDogWalk(null);
  cancelAnimalBathroom();
  pet.sleeping = false;
  pet.route = [];
  const target = { x: 825, y: 535 };
  petVetVisit = { pet, target, phase: 'approach', started: clock, nextPlan: 0 };
  route = [];
  pendingPlace = null;
  player.walking = false;
  busyUntil = Infinity;
  toast(`让${pet.name}走到兽医面前，再到宠物病床上检查。`, 6);
}

function startBoardingGuestVetVisit() {
  if (scene !== 'petHospital' || petVetVisit) return;
  if (!boardingGuestVisit) {
    toast('先去寄养所用旅行猫包接一只橘猫过来。', 6);
    return;
  }
  if (boardingGuestVisit.phase !== 'carried') return;
  boardingGuestVisit.phase = 'to-bed';
  boardingGuestVisit.started = clock;
  boardingGuestVisit.from = { x: player.x + 35, y: player.y - 20 };
  route = [];
  pendingPlace = null;
  player.walking = false;
  busyUntil = Infinity;
  toast('兽医从旅行猫包接过橘猫，轻轻放上宠物病床。', 6);
}

function updateBoardingGuestVetVisit() {
  const visit = boardingGuestVisit;
  if (!visit || visit.phase === 'carried') return;
  if (scene !== 'petHospital') {
    visit.phase = 'carried';
    busyUntil = 0;
    return;
  }
  if (visit.phase === 'to-bed' && clock - visit.started >= 1.5) {
    visit.phase = 'checking';
    visit.started = clock;
    toast(visit.guest.sick
      ? '寄养橘猫病了，兽医正在病床上给它检查、照料。'
      : '寄养橘猫正在病床上做身体检查。', 6);
  }
  if (visit.phase !== 'checking' || clock - visit.started < (visit.guest.sick ? 8 : 4)) return;
  visit.guest.sick = false;
  visit.guest.protectedUntil = clock + 900;
  visit.guest.nextSickAt = clock + 900;
  visit.phase = 'carried';
  busyUntil = 0;
  toast('兽医照料好橘猫啦。把它装回旅行猫包，送回寄养所的小伙伴身边吧。', 8);
}

function cancelPetVetVisit() {
  if (!petVetVisit) return;
  const pet = petVetVisit.pet;
  if (['to-bed', 'checking'].includes(petVetVisit.phase)) {
    pet.x = 455;
    pet.y = 555;
    pet.sleeping = false;
  }
  pet.route = [];
  pet.walking = false;
  pet.nextPlan = clock + 3;
  petVetVisit = null;
  busyUntil = 0;
}

function updatePetHealth(dt) {
  updateBoardingGuestVetVisit();
  if (clock >= nextRoutinePetIllnessAt) {
    nextRoutinePetIllnessAt = clock + 420 + Math.random() * 240;
    const healthy = pets.filter((pet) => petVetVisit?.pet !== pet && !pet.care && !pet.sleeping &&
      !pet.boarded &&
      !petHealth[pet.kind].sick &&
      !petHealth[pet.kind].course && clock >= petHealth[pet.kind].protectedUntil);
    if (healthy.length && Math.random() < 0.16) {
      const pet = healthy[Math.floor(Math.random() * healthy.length)];
      petHealth[pet.kind].sick = true;
      petHealth[pet.kind].illnessStartedAt = clock;
      if (pet.playing) cancelPetPlay();
      toast(`${pet.name}今天有点没精神，像是生病了。带它去宠物医院找兽医看看吧。`, 8);
    }
  }
  for (const pet of pets) {
    const health = petHealth[pet.kind];
    const indoors = ['house', 'barn'].includes(pet.scene) || Object.hasOwn(buildingPlaces, pet.scene);
    const restingUnderCover = pet.sleeping && distance(pet, pet.home) < 45;
    const harshWeather = ['rain', 'snow', 'hail'].includes(farmClimate.weather);
    if (indoors || restingUnderCover || !harshWeather || clock < health.protectedUntil)
      health.exposure = Math.max(0, health.exposure - dt * 2);
    else if (!health.sick) {
      health.exposure += dt;
      if (health.exposure >= (pet === cat ? 180 : 240)) {
        health.sick = true;
        health.illnessStartedAt = clock;
        toast(`${pet.name}淋得太久，有点生病了。带它去城市的宠物医院看看吧。`, 8);
        if (pet.playing) cancelPetPlay();
      }
    }
    if (health.sick) {
      health.illnessStartedAt ??= clock;
      if (!health.severe && clock - health.illnessStartedAt >= 240) {
        health.severe = true;
        toast(`${pet.name}病得比较重，带它去宠物医院病床上检查、休息吧。`, 8);
      }
    } else {
      health.severe = false;
      health.illnessStartedAt = null;
    }
    canvas.dataset[pet.kind + 'Health'] = health.severe ? 'severe' : health.sick ? 'sick' : 'well';
  }
  const status = document.querySelector('#pet-health-status');
  const sick = pets.filter((pet) => petHealth[pet.kind].sick);
  status.hidden = !sick.length;
  const statusText = sick.length ? `🐾 ${sick.map((pet) => `${pet.name}${petHealth[pet.kind].severe
    ? '（病重，去宠物医院）' : petHealth[pet.kind].course ? '（用药调养中）' : '（请去宠物医院）'}`).join('、')}` : '';
  if (status.textContent !== statusText) status.textContent = statusText;

  const visit = petVetVisit;
  if (!visit) return;
  if (scene !== 'petHospital' || !petIsHere(visit.pet)) {
    cancelPetVetVisit();
    return;
  }
  if (visit.phase === 'approach') {
    if (clock - visit.started > 30) {
      cancelPetVetVisit();
      toast('小伙伴还没走到医生面前，抱近一些再试试吧。');
      return;
    }
    if (distance(visit.pet, visit.target) < 12) {
      visit.pet.route = [];
      visit.pet.walking = false;
      visit.phase = 'to-bed';
      visit.started = clock;
      visit.from = { x: visit.pet.x, y: visit.pet.y };
      toast(`兽医轻轻把${visit.pet.name}抱到宠物病床上。`, 5);
    } else {
      if (clock >= visit.nextPlan) {
        visit.pet.route = findPetPath(visit.target, visit.pet).slice(1);
        visit.nextPlan = clock + 1;
      }
      movePet(visit.pet, dt, 65);
    }
  } else if (visit.phase === 'to-bed') {
    const progress = Math.min(1, (clock - visit.started) / 1.6);
    visit.pet.x = visit.from.x + (270 - visit.from.x) * progress;
    visit.pet.y = visit.from.y + (445 - visit.from.y) * progress - Math.sin(progress * Math.PI) * 42;
    if (progress >= 1) {
      visit.phase = 'checking';
      visit.started = clock;
      visit.wasSevere = petHealth[visit.pet.kind].severe;
      visit.pet.sleeping = true;
      visit.pet.view = 0;
      toast(visit.wasSevere
        ? `${visit.pet.name}病得比较重，正在宠物病床上检查、休息。`
        : `${visit.pet.name}躺在宠物病床上，兽医正在检查、照料。`, 7);
    }
  } else if (visit.phase === 'checking') {
    visit.wasSevere ||= petHealth[visit.pet.kind].severe;
    if (clock - visit.started < (visit.wasSevere ? 8 : 4)) return;
    const health = petHealth[visit.pet.kind];
    const wasSick = health.sick;
    health.exposure = 0;
    if (visit.wasSevere) {
      health.severe = false;
      health.illnessStartedAt = clock;
    }
    if (wasSick) prescribeMedicine(health);
    const name = visit.pet.name;
    cancelPetVetVisit();
    toast(wasSick ? `兽医把${name}专用的三天份动物药交给暖暖啦。回家可存入冰箱，每天按时喂药。` : `${name}很健康，检查结束啦！`, 7);
  }
}

function drawPetHospitalDetails() {
  if (scene !== 'petHospital') return;
  const guestVisit = boardingGuestVisit;
  if (guestVisit && ['to-bed', 'checking'].includes(guestVisit.phase)) {
    const region = boardingCatRegions[0][1];
    const progress = guestVisit.phase === 'checking'
      ? 1 : Math.min(1, (clock - guestVisit.started) / 1.5);
    const x = guestVisit.from.x + (270 - guestVisit.from.x) * progress;
    const y = guestVisit.from.y + (445 - guestVisit.from.y) * progress -
      Math.sin(progress * Math.PI) * 35;
    const width = 112;
    const height = region[3] * width / region[2];
    ctx.drawImage(boardingCatAtlas, ...region, x - width / 2, y - height, width, height);
    if (guestVisit.phase === 'checking') {
      ctx.font = '22px sans-serif';
      ctx.fillText('🌡', x + 44, y - 45);
    }
  }
  if (petVetVisit?.phase !== 'checking') return;
  // 猫狗由正常宠物绘制负责，诊疗只增加小体温计，不能再画一份病人。
  ctx.save();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌡', petVetVisit.pet.x + 45, petVetVisit.pet.y - 35);
  ctx.restore();
}
