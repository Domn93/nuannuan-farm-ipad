// 可进入的公共建筑共用门和返回位置；室内家具、互动与行走范围仍按场景定义。
const buildingArt = { hospital: new Image(), bakery: new Image(), villageHouse: new Image(), boardingHouse: new Image() };
const doctorArt = new Image();
const veterinarianArt = new Image();
const boardingEntranceArt = new Image();
const boardingCatAtlas = new Image();
doctorArt.src = 'assets/doctor.png';
veterinarianArt.src = 'assets/veterinarian.png';
boardingEntranceArt.src = 'assets/boarding-entrance.png';
boardingCatAtlas.src = 'assets/boarding-orange-cats.png';
buildingArt.hospital.src = 'assets/hospital.png';
buildingArt.bakery.src = 'assets/bakery-interior.png';
buildingArt.villageHouse.src = 'assets/village-house.png';
buildingArt.boardingHouse.src = 'assets/pet-boarding-empty.png';
const buildingDoors = {
  city: {
    hospitalDoor: {
      x: 760, y: 430, label: '开门进入医院', icon: '✚', destination: 'hospital',
      panel: { x: 734, y: 378, width: 53, height: 111, native: true }
    },
    bakeryDoor: {
      x: 1247, y: 465, label: '开门进入面包店', icon: '🥐', destination: 'bakery',
      panel: { x: 1225, y: 412, width: 47, height: 116, native: true }
    },
    boardingDoor: {
      x: 938, y: 285, label: '走到楼梯尽头进入寄养所', icon: '🐾', destination: 'boardingHouse',
      hitArea: { x: 912, y: 272, width: 48, height: 85 }
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
    buildingExit: { x: 730, y: 720, label: '打开村舍门出去', icon: '↩' },
    villageChat: { x: 810, y: 620, label: '和主人聊聊天', icon: '♡' }
  },
  boardingHouse: {
    buildingExit: { x: 768, y: 850, label: '离开寄养所', icon: '↩' },
    boardDog: { x: 1005, y: 570, label: '让萨摩耶在这里寄养', icon: '🐕' },
    boardCat: { x: 500, y: 680, label: '蓝色软垫 · 寄养布偶猫', icon: '🐈' },
    boardingCats: { x: 520, y: 515, label: '看看寄养所的小猫', icon: '🐈' },
    guestCatClinic: { x: 590, y: 515, label: '带寄养橘猫去宠物医院', icon: '✚' }
  }
};
for (const room of Object.values(buildingPlaces)) {
  room.dog = { x: -10000, y: -10000, label: '牵萨摩耶散步', icon: '🐕' };
  room.cat = { x: -10000, y: -10000, label: '摸摸布偶猫', icon: '♡' };
}
let buildingReturn = null;
let boardingEntryArmed = true;
let medicineHandoff = null;
let boardingGuestVisit = null;
const boardingGuests = [
  { from: { x: 535, y: 610 }, to: { x: 665, y: 625 }, rest: 6, offset: 0,
    width: 72 },
  { from: { x: 865, y: 670 }, to: { x: 985, y: 605 }, rest: 7, offset: 8,
    width: 76 },
  { from: { x: 545, y: 440 }, to: { x: 635, y: 480 }, rest: 8, offset: 5,
    width: 66 },
  { from: { x: 915, y: 470 }, to: { x: 1020, y: 475 }, rest: 10, offset: 10,
    width: 70 }
];
// 橘猫图集逐帧测量的完整轮廓；裁掉留白，不借用布偶猫的行高或裁到邻帧。
const boardingCatRegions = [
  [[27,49,184,148],[242,48,191,148],[460,50,194,147],[678,48,192,148]],
  [[35,228,172,186],[260,229,167,185],[479,231,167,183],[693,231,165,184]],
  [[74,421,95,213],[295,419,94,215],[519,419,95,215],[735,419,93,215]],
  [[19,650,190,182],[241,652,191,180],[463,653,187,185],[685,652,186,182]],
  [[16,861,197,170],[237,863,199,168],[456,862,198,168],[674,862,196,174]],
  [[31,1078,178,191],[252,1077,183,192],[472,1077,174,193],[689,1077,174,193]],
  [[77,1292,93,207],[295,1293,97,207],[511,1294,102,206],[729,1293,92,207]],
  [[36,1523,177,200],[256,1523,172,197],[463,1527,184,195],[679,1524,178,196]]
];
for (const guest of boardingGuests) {
  guest.x = guest.from.x;
  guest.y = guest.from.y;
  guest.view = 0;
  guest.step = 0;
  guest.sick = false;
  guest.nextSickAt = 450 + Math.random() * 300;
  guest.protectedUntil = 0;
}
const nuannuanHealth = {
  cold: false, injured: false, severe: false, illnessStartedAt: null,
  exposure: 0, heatExposure: 0, heatstroke: false, heatProtectedUntil: 0,
  nextVomitAt: Infinity, vomitUntil: 0, treatment: null, protectedUntil: 0
};
let nextRoutineColdAt = 420 + Math.random() * 240;
let heatRescue = null;

function injureFromHail() {
  nuannuanHealth.injured = true;
  nuannuanHealth.illnessStartedAt ??= clock;
  toast('哎呀，被冰雹砸伤了！先回屋躲一躲，再去医院找医生治疗。', 8);
}

function isBuildingInterior() {
  return Object.hasOwn(buildingPlaces, scene);
}

function registerBuildingDoors() {
  for (const [map, doors] of Object.entries(buildingDoors)) Object.assign(explorePlaces[map], doors);
}

function onBuildingFloor(x, y) {
  if (scene === 'boardingHouse') {
    const mainFloor = x > 425 && x < 1090 && y > 355 && y < 830;
    const entry = x > 670 && x < 865 && y >= 830 && y < 945;
    return (mainFloor && !(x > 575 && x < 965 && y < 380)) || entry;
  }
  const person = ['hospital', 'petHospital'].includes(scene) ? { x: 920, y: 510 } : scene === 'bakery' ? { x: 850, y: 480 } : { x: 810, y: 535 };
  if (Math.hypot(x - person.x, y - person.y) < 20) return false;
  if (scene === 'villageHouse') {
    // 村舍是开放式客厅；避开厨房、火炉、桌椅和前墙，保留门口通道。
    const livingFloor = x > 180 && x < 1360 && y > 395 && y < 680 &&
      !(x > 1010 && x < 1360 && y < 445) && !(x < 320 && y > 590);
    const entrance = x > 645 && x < 835 && y >= 680 && y < 800;
    return livingFloor || entrance;
  }
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

function updateBoardingEdge() {
  if (clock < busyUntil || doorTransition || riding || animalTravel) return;
  if (scene === 'city') {
    // 出门落在楼梯上；走回广场后才能再次从楼梯尽头进入。
    if (player.y > 385 || player.x < 895 || player.x > 980) boardingEntryArmed = true;
    if (boardingEntryArmed && player.x > 919 && player.x < 957 &&
        player.y > 250 && player.y < 302 && startBuildingDoor('boardingHouse', null)) {
      buildingReturn = { scene: 'city', point: { x: 938, y: 347 } };
      boardingEntryArmed = false;
    }
  } else if (scene === 'boardingHouse' && player.x > 690 && player.x < 845 && player.y > 900) {
    interactBuilding('buildingExit');
  }
}

function interactBuilding(place) {
  const door = buildingDoors[scene]?.[place];
  if (door) {
    if (startBuildingDoor(door.destination, null, door.panel))
      buildingReturn = { scene, point: { x: door.x, y: door.y + 48 } };
    return true;
  }
  if (!isBuildingInterior()) return false;
  if (scene === 'boardingHouse' && place === 'boardDog') {
    if (dog.boarded) {
      dog.boarded = false;
      dog.sleeping = false;
      dog.x = 995;
      dog.y = 635;
      dog.home = { x: dog.x, y: dog.y };
      walkingDog = true;
      dogTrail = [{ x: player.x, y: player.y }];
      dog.nextPlan = 0;
      updateDogButton();
      toast(petHealth.dog.sick
        ? '接回萨摩耶啦，它不舒服，牵着它去城市的宠物医院看病吧。'
        : '接回萨摩耶啦，牵好绳一起回家吧。');
    } else if (!petIsHere(dog) || !walkingDog) {
      toast('先牵着萨摩耶来到寄养所，再办理寄养。', 6);
    } else {
      dog.boarded = true;
      dogKennelReturn = null;
      stopDogWalk(null);
      dog.x = 1185;
      dog.y = 595;
      dog.home = { x: dog.x, y: dog.y };
      dog.route = [];
      dog.sleeping = false;
      dog.nextPlan = Infinity;
      toast('萨摩耶在自己的软垫上安顿好啦；回来可以在这里接它。', 7);
    }
    updatePetPlaceMarkers();
    renderBuildingActions();
    return true;
  }
  if (scene === 'boardingHouse' && place === 'boardCat') {
    if (cat.boarded) {
      if (!catCarrierPacked) {
        toast('接布偶猫回家要带上旅行猫包，先回家拿好猫包再来接它吧。', 7);
        return true;
      }
      if (carriedPet || boardingGuestVisit || riding || animalTravel || clock < busyUntil) {
        toast('先放下怀里的小伙伴、结束当前动作，再用猫包接布偶猫吧。', 6);
        return true;
      }
      cat.boarded = false;
      cat.sleeping = false;
      cat.x = player.x;
      cat.y = player.y;
      cat.home = { x: cat.x, y: cat.y };
      cat.nextPlan = 0;
      requestPetCare('hold', 'cat');
      toast(petHealth.cat.sick
        ? '布偶猫已经安稳放进旅行猫包，带它去城市的宠物医院看病吧。'
        : '接回你的布偶猫啦，已经安稳放进旅行猫包，可以一起回家。', 7);
    } else if (!petIsHere(cat)) {
      toast('先用旅行猫包把你的布偶猫带到寄养所，再办理寄养。', 7);
    } else {
      clearPetCare(cat);
      cancelPetPlay();
      if (animalCare.session?.actor === cat) cancelAnimalBathroom();
      cat.boarded = true;
      cat.x = 320;
      cat.y = 695;
      cat.home = { x: cat.x, y: cat.y };
      cat.route = [];
      cat.walking = false;
      cat.sleeping = false;
      cat.eatingUntil = 0;
      cat.view = 0;
      cat.nextPlan = Infinity;
      toast('你的布偶猫在蓝色软垫旁安顿好啦。其他小猫都是橘猫，回来一眼就能认出它。', 8);
    }
    updatePetPlaceMarkers();
    renderBuildingActions();
    return true;
  }
  if (scene === 'boardingHouse' && place === 'boardingCats') {
    const ill = boardingGuests.filter((guest) => guest.sick).length;
    toast(ill ? `有 ${ill} 只寄养橘猫不舒服。带上家里的旅行猫包，就能接一只去宠物医院检查。`
      : '这里的四只常驻猫都是橘猫，也能用旅行猫包带一只去宠物医院体检。', 7);
    burst('♡', player.x, player.y - 95, 3);
    return true;
  }
  if (scene === 'boardingHouse' && place === 'guestCatClinic') {
    if (boardingGuestVisit) {
      if (boardingGuestVisit.phase !== 'carried') {
        toast('橘猫正在宠物医院检查，等兽医照料完再来接它。', 6);
        return true;
      }
      boardingGuestVisit.guest.inClinic = false;
      boardingGuestVisit.guest.nextMoveAt = clock + 5;
      boardingGuestVisit = null;
      toast('橘猫平安回到寄养所啦，已经回到小伙伴身边。', 6);
    } else if (!catCarrierPacked) {
      toast('先回家拿旅行猫包，才能安全带寄养橘猫去医院。', 6);
    } else if (carriedPet || riding || animalTravel) {
      toast('旅行猫包现在装着别的小伙伴，先安顿好它再接橘猫。', 6);
    } else {
      const guest = boardingGuests.find((candidate) => candidate.sick) ?? boardingGuests[0];
      guest.inClinic = true;
      guest.target = null;
      boardingGuestVisit = { guest, phase: 'carried' };
      toast(guest.sick
        ? '把不舒服的橘猫放进旅行猫包啦，带它去城市的宠物医院。'
        : '把橘猫放进旅行猫包啦，可以带它去宠物医院体检。', 7);
    }
    renderBuildingActions();
    return true;
  }
  if (scene === 'petHospital' && ['vetDog', 'vetCat'].includes(place)) {
    startPetVetVisit(place === 'vetDog' ? 'dog' : 'cat');
    return true;
  }
  if (scene === 'petHospital' && place === 'vetGuestCat') {
    startBoardingGuestVetVisit();
    return true;
  }
  if (place === 'buildingExit') {
    const returning = buildingReturn ?? { scene: 'city', point: { x: 620, y: 520 } };
    if (startBuildingDoor(returning.scene, returning.point) && scene === 'boardingHouse')
      boardingEntryArmed = false;
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
    nuannuanHealth.treatment = nuannuanHealth.heatstroke
      ? { started: clock, phase: 'bed', reason: 'heatstroke', duration: 30 }
      : { started: clock, phase: 'exam', needsBed: nuannuanHealth.severe };
    if (nuannuanHealth.heatstroke) {
      player.x = 260;
      player.y = 470;
    }
    busyUntil = Infinity;
    toast(nuannuanHealth.heatstroke
      ? '暖暖中暑了，医生让她在病床上休息久一点。'
      : nuannuanHealth.severe
      ? '医生先检查暖暖，病得比较重，还要在病床上休息一会儿。'
      : nuannuanHealth.injured
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

function renderBuildingActions() {
  if (scene === 'boardingHouse') {
    places.boardDog.label = dog.boarded
      ? petHealth.dog.sick ? '接萨摩耶去宠物医院' : '接回寄养的萨摩耶'
      : '让萨摩耶在这里寄养';
    places.boardCat.label = cat.boarded
      ? petHealth.cat.sick ? '蓝色软垫 · 接布偶猫去看病' : '蓝色软垫 · 接回我的布偶猫'
      : '蓝色软垫 · 寄养布偶猫';
    places.guestCatClinic.label = boardingGuestVisit
      ? '送橘猫回寄养所' : '带寄养橘猫去宠物医院';
  }
  document.querySelector('#explore-grid').innerHTML = Object.entries(places)
    .filter(([key]) => key !== 'dog' && key !== 'cat')
    .map(([key, p]) => `<button data-explore-place="${key}">${p.icon} ${p.label}</button>`).join('');
}

function setupBuildingInterior() {
  if (!isBuildingInterior()) return;
  player.x = scene === 'villageHouse' ? 760 : 768;
  player.y = scene === 'villageHouse' ? 645 : 810;
  document.querySelector('#scene-name').textContent = {
    hospital: '✚ 村庄医院', petHospital: '🐾 宠物医院', bakery: '🥐 面包店里面', villageHouse: '⌂ 村舍里面', boardingHouse: '🐾 小动物寄养所'
  }[scene];
  document.querySelector('#go-farm').textContent = '↩ 开门出去';
  document.querySelector('#explore-buttons').hidden = false;
  document.querySelector('#explore-title').textContent = '屋里可以做什么？';
  renderBuildingActions();
  rebuildGrid();
  toast({ hospital: '医院到了，医生会检查身体；病重或中暑时要在病床上休息。', petHospital: '宠物医院到了，把猫狗带到兽医面前，再去病床检查。', bakery: '新鲜面包出炉啦，去柜台挑一份吧。', villageHouse: '进村舍做客啦，沿着客厅的空地慢慢走。', boardingHouse: cat.boarded ? '你的布偶猫在左侧蓝色软垫等你。带着家里的旅行猫包，走近软垫就能接它回家。' : '四只橘猫在这里玩耍。布偶猫和萨摩耶也可以带来寄养。' }[scene]);
}

function updateBuildingHealth(dt) {
  updateBoardingGuests(dt);
  if (heatRescue && clock - heatRescue.started >= 2.5) {
    heatRescue = null;
    changeScene('hospital');
    buildingReturn = { scene: 'city', point: { x: 760, y: 485 } };
    player.x = 260;
    player.y = 470;
    nuannuanHealth.treatment = { started: clock, phase: 'bed', reason: 'heatstroke', duration: 30 };
    busyUntil = Infinity;
    toast('好心的路人把暖暖送进医院了。医生让她在病床上休息一会儿。', 9);
  }
  if (medicineHandoff && scene !== 'hospital') {
    if (medicineHandoff.leaving) toast('小药袋已经收进背包。回家可以把余下的药存入冰箱。', 7);
    medicineHandoff = null;
  }
  const treatment = nuannuanHealth.treatment;
  if (treatment?.phase === 'exam' && scene === 'hospital' && clock - treatment.started >= 4 &&
      (treatment.needsBed || (nuannuanHealth.illnessStartedAt !== null &&
        clock - nuannuanHealth.illnessStartedAt >= 240))) {
    treatment.phase = 'to-bed';
    treatment.started = clock;
    treatment.from = { x: player.x, y: player.y };
    toast('医生扶暖暖走向病床，先躺一会儿。', 6);
  }
  if (treatment?.phase === 'to-bed' && scene === 'hospital') {
    const progress = Math.min(1, (clock - treatment.started) / 2);
    player.x = treatment.from.x + (260 - treatment.from.x) * progress;
    player.y = treatment.from.y + (470 - treatment.from.y) * progress;
    player.walking = progress < 1;
    player.step += dt * 7;
    if (progress >= 1) {
      treatment.phase = 'bed';
      treatment.started = clock;
      player.walking = false;
      toast('暖暖在医院病床上休息，医生正在照看她。', 6);
    }
  }
  if (treatment && (scene !== 'hospital' ||
      ((treatment.phase === 'exam' || treatment.phase === 'bed') &&
        clock - treatment.started >= (treatment.duration ?? (treatment.phase === 'bed' ? 7 : 4))))) {
    nuannuanHealth.treatment = null;
    if (scene === 'hospital') {
      if (treatment.phase === 'bed') {
        player.x = 460;
        player.y = 545;
        nuannuanHealth.severe = false;
        nuannuanHealth.illnessStartedAt = clock;
      }
      if (treatment.reason === 'heatstroke') {
        nuannuanHealth.heatstroke = false;
        nuannuanHealth.heatExposure = 0;
        nuannuanHealth.heatProtectedUntil = clock + 180;
      }
      nuannuanHealth.exposure = 0;
      busyUntil = 0;
      if (nuannuanHealth.cold || nuannuanHealth.injured) {
        prescribeMedicine(nuannuanHealth);
        medicineHandoff = { started: clock, leaving: false };
        busyUntil = clock + 1.1;
        toast('医生交给暖暖三天份的专用药袋。今天可以用药，回家再把余下的药存入冰箱。', 6);
      } else toast(treatment.reason === 'heatstroke'
        ? '休息够了，暖暖舒服多了！出院后记得把羽绒服换成薄衣服。'
        : '检查结束，暖暖很健康！', 7);
    }
  }
  if (medicineHandoff && scene === 'hospital' && !medicineHandoff.leaving &&
      clock - medicineHandoff.started >= 1.1 && !doorTransition) {
    const returning = buildingReturn ?? { scene: 'city', point: { x: 760, y: 478 } };
    if (startBuildingDoor(returning.scene, returning.point)) {
      medicineHandoff.leaving = true;
      toast('药袋拿好啦，暖暖正在离开医院。', 5);
    }
  }
  if (clock >= nextRoutineColdAt) {
    nextRoutineColdAt = clock + 420 + Math.random() * 240;
    if (!sleepSession && !lateSleepSession && !nuannuanHealth.treatment &&
        !nuannuanHealth.cold && !nuannuanHealth.injured && !nuannuanHealth.heatstroke &&
        !nuannuanHealth.course &&
        clock >= nuannuanHealth.protectedUntil && Math.random() < 0.12) {
      nuannuanHealth.cold = true;
      nuannuanHealth.illnessStartedAt = clock;
      toast('暖暖有点不舒服，像是感冒了。去村庄医院找医生看看吧。', 8);
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
    // 长时间淋雨或受冻才会生病，短暂出门不会反复触发感冒。
    nuannuanHealth.exposure += dt * (autumnRain ? 1.5 : 1);
    if ((autumnColdWind || autumnRain) && previousExposure < 15 && nuannuanHealth.exposure >= 15)
      toast(autumnRain ? '秋雨把衣服淋湿了，快进屋避雨，别着凉啦。'
        : '秋风有点冷，穿暖和些，或者先进屋避避风吧。', 6);
    if (nuannuanHealth.exposure >= 150 && clock >= nuannuanHealth.protectedUntil) {
      nuannuanHealth.cold = true;
      nuannuanHealth.illnessStartedAt = clock;
      toast(autumnRain
        ? '淋了秋天的冷雨，暖暖感冒了，去集市的医院找医生看看吧。'
        : autumnColdWind
        ? '被秋天的冷风吹得感冒了，去集市的医院找医生看看吧。'
        : '暖暖有点感冒了。去集市的医院找医生看看吧，冬天出门要穿羽绒服。', 8);
    }
  }
  const overheated = farmClimate.season === 1 && outfit === 'down' &&
    !['house', 'barn'].includes(scene) && !isBuildingInterior() && !doorTransition;
  if (!overheated || nuannuanHealth.heatstroke || clock < nuannuanHealth.heatProtectedUntil)
    nuannuanHealth.heatExposure = Math.max(0, nuannuanHealth.heatExposure - dt * 2);
  else {
    nuannuanHealth.heatExposure += dt;
    if (nuannuanHealth.heatExposure >= 20 && nuannuanHealth.heatExposure - dt < 20)
      toast('夏天穿羽绒服太热了，暖暖脸色不太好，快回屋换薄衣服。', 7);
    if (nuannuanHealth.heatExposure >= 55) {
      nuannuanHealth.heatstroke = true;
      nuannuanHealth.nextVomitAt = clock + 8;
      if (scene !== 'city') toast('暖暖中暑了，快到城市医院找医生，在病床上休息。', 8);
    }
  }
  if (nuannuanHealth.heatstroke && scene === 'city' && !heatRescue &&
      !nuannuanHealth.treatment && !doorTransition) {
    if (riding) {
      const horse = animals[3];
      horse.visitScene = scene;
      horse.visitPosition = { x: player.x, y: player.y };
      horse.nextVisitWander = clock + 4;
      horse.walking = false;
      riding = false;
      mountSession = null;
      document.querySelector('#ride-horse').textContent = '🐴 骑马';
    }
    route = [];
    pendingPlace = null;
    player.walking = false;
    heatRescue = { started: clock };
    busyUntil = Infinity;
    toast('暖暖中暑晕倒了！街上的人正把她抬去医院。', 6);
  }
  if (nuannuanHealth.cold || nuannuanHealth.injured) {
    nuannuanHealth.illnessStartedAt ??= clock;
    if (!nuannuanHealth.severe && clock - nuannuanHealth.illnessStartedAt >= 240) {
      nuannuanHealth.severe = true;
      nuannuanHealth.nextVomitAt = clock + 18;
      toast('暖暖越来越难受了，去医院检查后需要在病床上休息。', 8);
    }
  } else {
    nuannuanHealth.severe = false;
    nuannuanHealth.illnessStartedAt = null;
  }
  if ((nuannuanHealth.severe || nuannuanHealth.heatstroke) &&
      !nuannuanHealth.treatment && !heatRescue && !sleepSession && !lateSleepSession &&
      !toiletSession && clock >= nuannuanHealth.nextVomitAt) {
    nuannuanHealth.vomitUntil = clock + 3;
    nuannuanHealth.nextVomitAt = clock + 100 + Math.random() * 50;
    toast('暖暖难受得吐了，脸色发绿，赶紧去医院休息吧。', 6);
  }
  canvas.dataset.health = nuannuanHealth.heatstroke ? 'heatstroke' : nuannuanHealth.injured
    ? nuannuanHealth.cold ? 'cold-and-injured' : 'injured'
    : nuannuanHealth.cold ? 'cold' : 'well';
  const status = document.querySelector('#health-status');
  status.hidden = !nuannuanHealth.injured && !nuannuanHealth.cold && !nuannuanHealth.heatstroke;
  const careHint = nuannuanHealth.course ? `用药调养中 ${nuannuanHealth.course.completedDays}/3 天 · 打开药袋` : '请去医院';
  const statusText = nuannuanHealth.heatstroke
    ? '☀ 中暑了 · 去医院病床休息'
    : nuannuanHealth.injured
    ? `🩹 ${nuannuanHealth.severe ? '伤势加重' : '冰雹砸伤'} · ${careHint}`
    : nuannuanHealth.cold ? `🌡 ${nuannuanHealth.severe ? '病得比较重' : '感冒了'} · ${careHint}` : '';
  const visibleStatus = clock < nuannuanHealth.vomitUntil ? `${statusText} · 🤢 呕吐` : statusText;
  if (status.textContent !== visibleStatus) status.textContent = visibleStatus;
}

function drawBuildingPeople(front) {
  if (!isBuildingInterior()) return;
  if (scene === 'boardingHouse') drawBoardingGuests(front);
  const pose = ['hospital', 'petHospital'].includes(scene) ? { x: 920, y: 510, row: 4 } : scene === 'bakery' ? { x: 850, y: 480, row: 3 } : { x: 810, y: 535, row: 4 };
  if ((pose.y > player.y) !== front) return;
  if (['hospital', 'petHospital'].includes(scene)) {
    const height = 200;
    const vet = scene === 'petHospital';
    const region = vet ? { x: 210, y: 15, width: 590, height: 1490 } :
      { x: 267, y: 21, width: 493, height: 1491 };
    const width = region.width * height / region.height;
    ctx.drawImage(vet ? veterinarianArt : doctorArt, region.x, region.y,
      region.width, region.height, pose.x - width / 2, pose.y - height, width, height);
    return;
  }
  const sprite = seasonalFriendSprite(pose.row, 0), region = sprite.region;
  const height = 185;
  ctx.drawImage(sprite.art, region.x, region.y, region.width, region.height,
    pose.x - (region.centerX - region.x) * height / region.height, pose.y - height,
    region.width * height / region.height, height);
}

function updateBoardingGuests(dt) {
  if (scene !== 'boardingHouse') return;
  for (const guest of boardingGuests) {
    guest.moving = false;
    if (guest.inClinic) continue;
    if (!guest.sick && clock >= guest.nextSickAt && clock >= guest.protectedUntil) {
      guest.nextSickAt = clock + 600 + Math.random() * 300;
      if (Math.random() < 0.3) {
        guest.sick = true;
        toast('一只寄养橘猫有点没精神，可以带它去宠物医院检查。', 7);
      }
    }
    if (guest.nextMoveAt === undefined) guest.nextMoveAt = clock + guest.offset;
    if (clock < guest.nextMoveAt) continue;
    if (!guest.target) guest.target = guest.atFarEnd ? guest.from : guest.to;
    const dx = guest.target.x - guest.x, dy = guest.target.y - guest.y;
    const gap = Math.hypot(dx, dy);
    if (gap < 1) {
      guest.target = null;
      guest.atFarEnd = !guest.atFarEnd;
      guest.nextMoveAt = clock + guest.rest;
      continue;
    }
    const step = Math.min(gap, dt * 32);
    const point = { x: guest.x + dx / gap * step, y: guest.y + dy / gap * step };
    const actors = [player, ...pets.filter(petIsHere),
      ...boardingGuests.filter((other) => other !== guest && !other.inClinic)];
    const blocked = actors.some((actor) => {
      const clearance = guest.width * 0.35 + (actor.width ? actor.width * 0.35 : 20);
      const currentGap = Math.hypot(guest.x - actor.x, guest.y - actor.y);
      const nextGap = Math.hypot(point.x - actor.x, point.y - actor.y);
      // 被玩家靠近后允许往外走，不能被困在重叠位置。
      return nextGap < clearance && nextGap < currentGap;
    });
    if (blocked || !onBuildingFloor(point.x, point.y)) continue;
    guest.x = point.x;
    guest.y = point.y;
    guest.moving = step > 0;
    guest.step += step / 9;
    guest.view = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  }
  canvas.dataset.boardingCats = String(boardingGuests.length);
  canvas.dataset.boardingCatsMoving = String(boardingGuests.filter((guest) => guest.moving).length);
  canvas.dataset.boardedCat = String(cat.boarded);
  canvas.dataset.boardedDog = String(dog.boarded);
}

function drawBoardingGuests(front) {
  if (!boardingCatAtlas.naturalWidth) return;
  for (const guest of boardingGuests) {
    if (guest.inClinic) continue;
    const pose = guest;
    if ((pose.y > player.y) !== front) continue;
    const frame = pose.moving ? Math.floor(guest.step) % 4 : 1;
    const [sourceX, sourceY, sourceWidth, sourceHeight] = boardingCatRegions[pose.view][frame];
    const scale = guest.width / (boardingCatAtlas.naturalWidth / 4);
    const width = sourceWidth * scale, height = sourceHeight * scale;
    const bounce = pose.moving ? Math.abs(Math.sin(guest.step * Math.PI / 2)) * 0.7 : 0;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.fillStyle = '#344d2425';
    ctx.beginPath();
    ctx.ellipse(0, 0, guest.width * 0.28, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, -bounce);
    if (!pose.moving) ctx.scale(1, 1 + Math.sin(clock * 1.6 + guest.offset) * 0.007);
    ctx.drawImage(boardingCatAtlas, sourceX, sourceY, sourceWidth, sourceHeight,
      -width / 2, -height, width, height);
    ctx.restore();
    if (guest.sick) {
      ctx.font = '21px sans-serif';
      ctx.fillText('🌡', guest.x + guest.width * 0.25, guest.y - height);
    }
  }
}

function drawBoardingEntrance() {
  if (scene !== 'city') return;
  // 台阶尽头只有这扇门可进；门脚贴在台阶上沿，不遮住下方通路。
  ctx.drawImage(boardingEntranceArt, 890, 133, 94, 140);
}

function drawBuildingAction() {
  if (heatRescue && scene === 'city') {
    ctx.save();
    for (const side of [-1, 1]) {
      const region = friendSpriteRegions[side < 0 ? 3 : 4][0];
      const height = 165;
      const width = region.width * height / region.height;
      ctx.drawImage(friendsArt, region.x, region.y, region.width, region.height,
        player.x + side * 95 - width / 2, player.y - height, width, height);
    }
    ctx.fillStyle = '#f2ece0';
    ctx.strokeStyle = '#9b744c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(player.x - 85, player.y - 98, 170, 45, 16);
    ctx.fill();
    ctx.stroke();
    const atlas = currentClothes();
    const region = walkingFrameRegion(atlas, 0, 1);
    const height = 115;
    const width = region.width * height / region.height;
    ctx.translate(player.x, player.y - 76);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(atlas, region.x, region.y, region.width, region.height,
      -width / 2, -height / 2, width, height);
    ctx.restore();
  }
  if (medicineHandoff && scene === 'hospital') {
    ctx.save();
    ctx.drawImage(medicinePouchArt, player.x + 18, player.y - 87, 56, 66);
    ctx.restore();
  }
  if (!nuannuanHealth.treatment || scene !== 'hospital') return;
  if (nuannuanHealth.treatment.phase === 'bed') {
    ctx.drawImage(awakeBedPoses, awakeBedPoses.naturalWidth / 2, 0,
      awakeBedPoses.naturalWidth / 2, awakeBedPoses.naturalHeight,
      180, 288, 150, 184);
    return;
  }
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
    ? { x: 640, y: 890, width: 58, height: 180, native: true }
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
    const panelArt = buildingArt[scene] ?? sceneryMaps[scene];
    if (panelArt?.naturalWidth) ctx.drawImage(panelArt, x, y - height, width, height, 0, 0, width, height);
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
