// 虚构的游戏疗程：每天两种药，完成三个不同日期的用药后才恢复。
const gameMedicines = [
  { name: '星星恢复药水', icon: '✨' },
  { name: '云朵调养药水', icon: '☁' }
];

function medicinePatients() {
  return [
    { id: 'nuannuan', name: '暖暖', health: nuannuanHealth, pet: null },
    ...pets.map((pet) => ({ id: pet.kind, name: pet.name, health: petHealth[pet.kind], pet }))
  ];
}

function prescribeMedicine(health) {
  // 复诊不重置已经完成的疗程；诊断当时的疾病才属于这一张处方。
  if (!health.course) health.course = {
    completedDays: 0, doseDay: farmTime.day, taken: [],
    cold: !!health.cold, injured: !!health.injured, sick: !!health.sick
  };
}

function currentMedicineDay(course) {
  if (course.doseDay !== farmTime.day) {
    course.doseDay = farmTime.day;
    course.taken = [];
  }
}

function refreshMedicineBox() {
  document.querySelector('#medicine-list').innerHTML = medicinePatients()
    .filter((patient) => patient.health.course)
    .map((patient) => {
      const course = patient.health.course;
      currentMedicineDay(course);
      return `<li><strong>${patient.name} · 已完成 ${course.completedDays}/3 天</strong>
        <p>今天已用 ${course.taken.length}/2 种 · 每种每天一次</p>
        ${gameMedicines.map((medicine, index) => `<button data-patient="${patient.id}" data-medicine="${index}"
          ${course.taken.includes(index) ? 'disabled' : ''}>${medicine.icon} ${patient.pet ? '喂' : '喝'}${medicine.name}${course.taken.includes(index) ? '（今天已用）' : ''}</button>`).join('')}
      </li>`;
    }).join('') || '<li>疗程已经完成，药盒收好啦。</li>';
}

function takeGameMedicine(patientId, index) {
  const patient = medicinePatients().find((entry) => entry.id === patientId);
  const course = patient?.health.course;
  if (!course || !Number.isInteger(index) || !gameMedicines[index]) return;
  if (sleepSession || lateSleepSession || clock < busyUntil) {
    toast('先醒来、完成手头的动作，再用药吧。');
    return;
  }
  if (patient.pet && (!petIsHere(patient.pet) || distance(player, patient.pet) > 110 || patient.pet.sleeping)) {
    toast(`先走近醒着的${patient.name}，再喂药吧。`);
    return;
  }
  currentMedicineDay(course);
  if (course.taken.includes(index)) return;
  course.taken.push(index);
  busyUntil = clock + 1.5;
  burst('🥤', patient.pet?.x ?? player.x, (patient.pet?.y ?? player.y) - 85, 1);
  if (course.taken.length === gameMedicines.length) course.completedDays++;
  if (course.completedDays >= 3) {
    const health = patient.health;
    if (course.cold) health.cold = false;
    if (course.injured) health.injured = false;
    if (course.sick) health.sick = false;
    health.exposure = 0;
    if (patient.pet) health.protectedUntil = clock + 600;
    health.course = null;
    toast(`${patient.name}完成了三天疗程！${health.cold || health.injured || health.sick ? '还有新的不舒服，要再找医生看看。' : '身体恢复啦，记得好好休息。'}`, 7);
  } else toast(`${patient.name}用过${gameMedicines[index].name}啦。${course.taken.length === 2 ? '今天的药用完了，明天继续休息和治疗。' : '稍等一下，再用今天的另一种药。'}`, 6);
  refreshMedicineBox();
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
    toast('先完成或取消手头的动作，再打开药盒吧。');
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
  if (button) takeGameMedicine(button.dataset.patient, Number(button.dataset.medicine));
});
