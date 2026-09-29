// 宠物疾病跨地图保留；兽医开药后，完成多日疗程才恢复。
const petHealth = {
  dog: { sick: false, exposure: 0, protectedUntil: 0 },
  cat: { sick: false, exposure: 0, protectedUntil: 0 }
};
let petVetVisit = null;
buildingArt.petHospital = buildingArt.hospital;
buildingDoors.city.petHospitalDoor = {
  x: 415, y: 395, label: '进入宠物医院', icon: '🐾', destination: 'petHospital',
  panel: { x: 392, y: 339, width: 46, height: 110, native: true }
};
buildingPlaces.petHospital = {
  buildingExit: { x: 768, y: 845, label: '打开宠物医院门出去', icon: '↩' },
  vetDog: { x: 855, y: 570, label: '请兽医给萨摩耶看病', icon: '🐕' },
  vetCat: { x: 835, y: 620, label: '请兽医给布偶猫看病', icon: '🐈' },
  dog: { x: -10000, y: -10000, label: '牵萨摩耶散步', icon: '🐕' },
  cat: { x: -10000, y: -10000, label: '摸摸布偶猫', icon: '♡' }
};
registerBuildingDoors();

function startPetVetVisit(kind) {
  if (scene !== 'petHospital' || petVetVisit) return;
  const pet = kind === 'dog' ? dog : cat;
  if (!petIsHere(pet)) {
    toast(`先把${pet.name}带来：狗可以牵来，猫可以抱来，再请兽医检查。`, 7);
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
  toast(`让${pet.name}走到兽医面前，检查一下身体。`, 6);
}

function cancelPetVetVisit() {
  if (!petVetVisit) return;
  petVetVisit.pet.route = [];
  petVetVisit.pet.walking = false;
  petVetVisit.pet.nextPlan = clock + 3;
  petVetVisit = null;
  busyUntil = 0;
}

function updatePetHealth(dt) {
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
        toast(`${pet.name}淋得太久，有点生病了。带它去城市的宠物医院看看吧。`, 8);
        if (pet.playing) cancelPetPlay();
      }
    }
    canvas.dataset[pet.kind + 'Health'] = health.sick ? 'sick' : 'well';
  }
  const status = document.querySelector('#pet-health-status');
  const sick = pets.filter((pet) => petHealth[pet.kind].sick);
  status.hidden = !sick.length;
  const statusText = sick.length ? `🐾 ${sick.map((pet) => `${pet.name}${petHealth[pet.kind].course ? '（用药调养中）' : '（请去宠物医院）'}`).join('、')}` : '';
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
      visit.phase = 'checking';
      visit.started = clock;
      toast(`兽医正在给${visit.pet.name}检查、照料，稍等一会儿。`, 5);
    } else {
      if (clock >= visit.nextPlan) {
        visit.pet.route = findPetPath(visit.target, visit.pet).slice(1);
        visit.nextPlan = clock + 1;
      }
      movePet(visit.pet, dt, 65);
    }
  } else if (clock - visit.started >= 4) {
    const health = petHealth[visit.pet.kind];
    const wasSick = health.sick;
    health.exposure = 0;
    if (wasSick) prescribeMedicine(health);
    const name = visit.pet.name;
    cancelPetVetVisit();
    toast(wasSick ? `兽医给${name}开好三天的药啦，每天两种。走近它，在药盒里喂药，慢慢恢复。` : `${name}很健康，检查结束啦！`, 7);
  }
}

function drawPetHospitalDetails() {
  if (scene !== 'petHospital' || petVetVisit?.phase !== 'checking') return;
  // 猫狗由正常宠物绘制负责，诊疗只增加小体温计，不能再画一份病人。
  ctx.save();
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🌡', petVetVisit.pet.x + 45, petVetVisit.pet.y - 35);
  ctx.restore();
}
