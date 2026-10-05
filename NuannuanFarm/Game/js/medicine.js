// 虚构的游戏疗程：每种药各在三个不同日期用一次，漏服只延后该种药的进度。
const gameMedicines = [
  { name: '星星恢复药水', icon: '✨' },
  { name: '云朵调养药水', icon: '☁' }
];
const medicinePouchArt = new Image();
medicinePouchArt.src = 'assets/medicine-pouch.png';
let petMedicineRequest = null;

function medicinePetNearby(pet) {
  return petIsHere(pet) && distance(player, pet) <= 85 &&
    (scene !== 'farm' || insidePen(player) === insidePen(pet)) &&
    (scene !== 'house' || balconyDoor.open || (player.x < 901) === (pet.x < 901));
}

function petMedicineActive(pet) {
  return !pet.boarded && (petMedicineRequest?.pet === pet ||
    (document.querySelector('#medicine-dialog').open && petHealth[pet.kind].course &&
      medicinePetNearby(pet)));
}

function clearPetMedicineRequest() {
  if (!petMedicineRequest) return;
  if (pendingPlace === 'petMedicine') {
    route = [];
    pendingPlace = null;
  }
  if (penGate.destination?.place === 'petMedicine') penGate.destination = null;
  if (balconyDoor.destination?.place === 'petMedicine') balconyDoor.destination = null;
  delete places.petMedicine;
  petMedicineRequest = null;
}

function requestGameMedicine(patientId, index) {
  const patient = medicinePatients().find((entry) => entry.id === patientId);
  const course = patient?.health.course;
  if (!course || !Number.isInteger(index) || !gameMedicines[index]) return;
  if (!patient.pet) {
    takeGameMedicine(patientId, index);
    return;
  }
  const pet = patient.pet;
  if (!petIsHere(pet) || pet.boarded) {
    toast(pet.boarded ? `先去寄养所接回${pet.name}，再给它喂药。`
      : `${pet.name}不在这里，先去它所在的地方再喂药吧。`, 6);
    document.querySelector('#medicine-dialog').close();
    return;
  }
  if (!ready || clock < busyUntil || sleepSession || lateSleepSession || livingSession ||
      bathSession || swingSession || fishingSession || riding || animalTravel ||
      petVetVisit?.pet === pet ||
      (pet.care && !['resting', 'carried'].includes(pet.care.phase))) {
    toast('先完成当前动作，再给小伙伴喂药吧。', 6);
    return;
  }
  currentMedicineDay(course);
  if (course.doseCounts[index] >= 3 || course.taken.includes(index) ||
      (course.location === 'pouch' ? course.remaining[index] < 1 : !course.collected.includes(index))) return;

  clearPetMedicineRequest();
  if (pet === dog) {
    dogKennelReturn = null;
    if (walkingDog) stopDogWalk(null);
  }
  if (pet.playing) cancelPetPlay();
  if (animalCare.session?.actor === pet) cancelAnimalBathroom();
  petMedicineRequest = { pet, patientId, index, scene, started: clock, phase: 'approach' };
  pet.route = [];
  pet.walking = false;
  document.querySelector('#medicine-dialog').close();
  if (!medicinePetNearby(pet)) {
    places.petMedicine = { x: pet.x, y: pet.y, label: `给${pet.name}喂药`, icon: '💊' };
    walkTo(places.petMedicine, 'petMedicine');
    if (pendingPlace !== 'petMedicine' && penGate.destination?.place !== 'petMedicine' &&
        balconyDoor.destination?.place !== 'petMedicine') {
      clearPetMedicineRequest();
      toast(`暂时走不到${pet.name}身边，先把通道让出来再喂药吧。`, 6);
      return;
    }
    toast(`暖暖正在走近${pet.name}，会轻声叫醒它，再喂这次的药。`, 6);
  }
  updatePetMedicineRequest();
}

function updatePetMedicineRequest() {
  const request = petMedicineRequest;
  canvas.dataset.petMedicine = request ? `${request.pet.kind}:${request.phase}` : 'idle';
  if (!request) return;
  const { pet } = request;
  const cancelled = request.scene !== scene || !petIsHere(pet) || pet.boarded ||
    (request.phase === 'approach' && movementKeys.some((key) => keys.has(key))) ||
    clock - request.started > 45;
  if (cancelled || (request.phase === 'approach' && !medicinePetNearby(pet) &&
      pendingPlace !== 'petMedicine' && penGate.destination?.place !== 'petMedicine' &&
      balconyDoor.destination?.place !== 'petMedicine')) {
    clearPetMedicineRequest();
    toast('这次喂药已取消，尚未喂下的药仍在原处。');
    return;
  }
  if (request.phase === 'feeding') {
    pet.sleeping = false;
    if (clock < request.finishedAt) return;
    clearPetMedicineRequest();
    refreshMedicineBox();
    document.querySelector('#medicine-dialog').showModal();
    return;
  }
  if (!medicinePetNearby(pet) || clock < busyUntil) return;
  pet.sleeping = false;
  if (pendingPlace === 'petMedicine') {
    pendingPlace = null;
    route = [];
  }
  const course = petHealth[pet.kind].course;
  const before = course?.doseCounts[request.index];
  takeGameMedicine(request.patientId, request.index);
  if (!course || course.doseCounts[request.index] === before) {
    clearPetMedicineRequest();
    return;
  }
  request.phase = 'feeding';
  request.finishedAt = clock + 1.5;
}

function medicinePatients() {
  return [
    { id: 'nuannuan', name: '暖暖', health: nuannuanHealth, pet: null },
    ...pets.map((pet) => ({ id: pet.kind, name: pet.name, health: petHealth[pet.kind], pet }))
  ];
}

function prescribeMedicine(health) {
  // 复诊不重置已经完成的疗程；诊断当时的疾病才属于这一张处方。
  if (!health.course) health.course = {
    completedDays: 0, doseCounts: gameMedicines.map(() => 0),
    doseDay: farmTime.day, taken: [], collected: [],
    remaining: gameMedicines.map(() => 3), location: 'pouch',
    cold: !!health.cold, injured: !!health.injured, sick: !!health.sick
  };
}

function currentMedicineDay(course) {
  if (course.doseDay !== farmTime.day) {
    course.doseDay = farmTime.day;
    course.taken = [];
  }
  course.collected ??= [];
}

function medicineOwnerLabel(patient) {
  return `${patient.pet ? '动物用' : '人用'} · ${patient.name}专用`;
}

function fridgeMedicineRows() {
  const patients = medicinePatients().filter((patient) => patient.health.course);
  if (!patients.length) return '';
  return '<li class="fridge-medicine-heading">💊 按病人分开的药</li>' + patients
    .flatMap((patient) => {
      const course = patient.health.course;
      currentMedicineDay(course);
      if (course.location === 'pouch') {
        const bottles = course.remaining.reduce((total, amount) => total + amount, 0);
        return `<li class="fridge-medicine-item"><span>💊 ${medicineOwnerLabel(patient)} · 三日疗程
          <small>还剩 ${bottles} 瓶在小药袋里，可存进冰箱保管</small></span>
          <button data-fridge-patient="${patient.id}" data-fridge-store-medicine>存入冰箱</button></li>`;
      }
      return gameMedicines.map((medicine, index) => {
        const taken = course.taken.includes(index);
        const collected = course.collected.includes(index);
        const finished = course.doseCounts[index] >= 3;
        let status = `冰箱里还剩 ${course.remaining[index]} 瓶`;
        if (finished) status = '该药已完成';
        else if (taken) status = '今天已用';
        else if (collected) status = '已取出，在小药袋里';
        return `<li class="fridge-medicine-item"><span>💊 ${medicineOwnerLabel(patient)} · ${medicine.name}
          <small>${status} · 不能给其他病人用</small></span>
          <button data-fridge-patient="${patient.id}" data-fridge-medicine="${index}" ${finished || taken || collected || !course.remaining[index] ? 'disabled' : ''}>取出 1 瓶</button></li>`;
      });
    }).join('');
}

function storeMedicineInFridge(patientId) {
  if (!fridge.open || scene !== 'house' || distance(player, places.fridge) > 85 ||
      clock < busyUntil || !document.querySelector('#fridge-dialog').open) return;
  const patient = medicinePatients().find((entry) => entry.id === patientId);
  const course = patient?.health.course;
  if (!course || course.location !== 'pouch') return;
  course.location = 'fridge';
  refreshFridge();
  refreshBackpack();
  toast(`${medicineOwnerLabel(patient)}的剩余药存进冰箱啦。需要用药时再取出当天的份量。`);
}

function collectMedicineFromFridge(patientId, index) {
  if (!fridge.open || scene !== 'house' || distance(player, places.fridge) > 85 ||
      clock < busyUntil || !document.querySelector('#fridge-dialog').open ||
      !Number.isInteger(index) || !gameMedicines[index]) return;
  const patient = medicinePatients().find((entry) => entry.id === patientId);
  const course = patient?.health.course;
  if (!course || course.location !== 'fridge') return;
  currentMedicineDay(course);
  if (course.doseCounts[index] >= 3 || course.taken.includes(index) ||
      course.collected.includes(index) || course.remaining[index] < 1) return;
  course.remaining[index]--;
  course.collected.push(index);
  refreshBackpack();
  closeFridge();
  refreshMedicineBox();
  document.querySelector('#medicine-dialog').showModal();
  document.querySelector(`#medicine-list [data-patient="${patientId}"][data-medicine="${index}"]`)?.focus();
  toast(`${medicineOwnerLabel(patient)}的${gameMedicines[index].name}已取出。现在可以在小药袋里${patient.pet ? '喂给它' : '喝下'}。`, 6);
}

function refreshMedicineBox() {
  document.querySelector('#medicine-list').innerHTML = medicinePatients()
    .filter((patient) => patient.health.course)
    .map((patient) => {
      const course = patient.health.course;
      currentMedicineDay(course);
      let petRoom = '';
      if (patient.pet?.scene === 'house') {
        if (patient.pet.y < 351) petRoom = '家里的卧室';
        else if (patient.pet.x > 972) petRoom = '家里的阳台';
        else petRoom = '家里的客厅';
      }
      return `<li><strong>${medicineOwnerLabel(patient)} · 已完成 ${course.completedDays}/3 天</strong>
        <p>每种药各用三个不同游戏日，每天一次 · ${course.location === 'pouch' ? '药在小药袋' : '剩余药在冰箱，取出的药在小药袋'}</p>
        ${patient.pet ? `<p>${petRoom ? `${patient.name}在${petRoom}。` : ''}选择药后会走近它，睡着时先轻声叫醒，喂完再休息。</p>` : ''}
        ${gameMedicines.map((medicine, index) => {
          const finished = course.doseCounts[index] >= 3;
          const taken = course.taken.includes(index);
          const unavailable = course.location === 'pouch'
            ? !course.remaining[index] : !course.collected.includes(index);
          let hint = '';
          if (finished) hint = '（该药已完成）';
          else if (taken) hint = '（今天已用）';
          else if (unavailable && course.location === 'fridge') hint = '（先从冰箱取出）';
          return `<button data-patient="${patient.id}" data-medicine="${index}" ${finished || taken || unavailable ? 'disabled' : ''}>${medicine.icon} ${patient.pet ? '喂' : '喝'}${medicine.name} · ${course.doseCounts[index]}/3 次${hint}</button>`;
        }).join('')}
      </li>`;
    }).join('') || '<li>疗程已经完成，小药袋收好啦。</li>';
}

function takeGameMedicine(patientId, index) {
  const patient = medicinePatients().find((entry) => entry.id === patientId);
  const course = patient?.health.course;
  if (!course || !Number.isInteger(index) || !gameMedicines[index]) return;
  if (sleepSession || lateSleepSession || clock < busyUntil) {
    toast('先醒来、完成手头的动作，再用药吧。');
    return;
  }
  if (patient.pet && (!petIsHere(patient.pet) || patient.pet.boarded ||
      distance(player, patient.pet) > 110 || patient.pet.sleeping)) {
    toast(`先走近醒着的${patient.name}，再喂药吧。`);
    return;
  }
  currentMedicineDay(course);
  if (course.doseCounts[index] >= 3 || course.taken.includes(index)) return;
  if (course.location === 'pouch') {
    if (course.remaining[index] < 1) return;
    course.remaining[index]--;
  } else {
    if (!course.collected.includes(index)) return;
    course.collected = course.collected.filter((medicine) => medicine !== index);
  }
  course.taken.push(index);
  course.doseCounts[index]++;
  course.completedDays = Math.min(...course.doseCounts);
  busyUntil = clock + 1.5;
  burst('🥤', patient.pet?.x ?? player.x, (patient.pet?.y ?? player.y) - 85, 1);
  if (course.completedDays >= 3) {
    const health = patient.health;
    if (course.cold) health.cold = false;
    if (course.injured) health.injured = false;
    if (course.sick) health.sick = false;
    if (!health.cold && !health.injured && !health.sick) {
      health.severe = false;
      health.illnessStartedAt = null;
    }
    health.exposure = 0;
    health.protectedUntil = clock + 900;
    health.course = null;
    toast(`${patient.name}完成了三天疗程！${health.cold || health.injured || health.sick ? '还有新的不舒服，要再找医生看看。' : '身体恢复啦，记得好好休息。'}`, 7);
  } else {
    const anotherDoseToday = course.doseCounts.some((count, medicine) =>
      count < 3 && !course.taken.includes(medicine));
    toast(`${patient.name}用过${gameMedicines[index].name}啦。${anotherDoseToday ? '稍等一下，再用今天尚未完成的另一种药。' : '今天需要的药用完了，明天继续休息和治疗。'}`, 6);
  }
  refreshMedicineBox();
  refreshBackpack();
}

function updateMedicineBox() {
  const active = medicinePatients().some((patient) => patient.health.course);
  document.querySelector('#open-medicine').hidden = !active;
  const dialog = document.querySelector('#medicine-dialog');
  if (dialog.open && (sleepSession || lateSleepSession)) dialog.close();
  // 不逐帧重建按钮，避免点击时节点被替换；跨天才刷新当天次数。
  if (dialog.open && medicinePatients().some((patient) => patient.health.course && patient.health.course.doseDay !== farmTime.day))
    refreshMedicineBox();
}

document.querySelector('#open-medicine').addEventListener('click', () => {
  // 端菜、洗蘑菇和喂食共用寻路；清空路线不能代替结束这些动作。
  if (clock < busyUntil || livingSession || petFeedingAction || sleepPreparation) {
    toast('先完成或取消手头的动作，再打开小药袋吧。');
    return;
  }
  route = [];
  pendingPlace = null;
  keys.clear();
  player.walking = false;
  refreshMedicineBox();
  document.querySelector('#medicine-dialog').showModal();
});
document.querySelector('#close-medicine').addEventListener('click', () => document.querySelector('#medicine-dialog').close());
document.querySelector('#medicine-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-medicine]');
  if (button) requestGameMedicine(button.dataset.patient, Number(button.dataset.medicine));
});
