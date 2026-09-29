// 抱、背、上床及宠物洗澡；照料中的宠物暂停自主行为。

let petCareRequest = null,
  carriedPet = null;

function clearPetCare(pet) {
  if (!pet.care) return;
  if (pet.care.mode === 'wash') {
    stopBathSound();
    busyUntil = 0;
  }
  const landing = ['hold', 'back'].includes(pet.care.mode) ? null : pet.care.floor;
  if (carriedPet === pet) carriedPet = null;
  pet.care = null;
  pet.sleeping = false;
  pet.route = [];
  pet.walking = false;
  pet.nextPlan = clock + 3;
  let point = landing && canWalk(landing.x, landing.y) ? landing : null;
  if (!point)
    for (let i = 0; i < 16; i++) {
      const candidate = {
        x: player.x + Math.cos((i * Math.PI) / 8) * 55,
        y: player.y + Math.sin((i * Math.PI) / 8) * 45
      };
      if (canWalk(candidate.x, candidate.y)) {
        point = candidate;
        break;
      }
    }
  point = point || player;
  pet.x = point.x;
  pet.y = point.y;
}

function requestPetCare(mode, kind) {
  if (kind in travelAnimalCells) {
    requestAnimalTravel(kind, mode);
    return;
  }
  const pet = pets.find((p) => p.kind === kind);
  if (!pet) return;
  if (!petIsHere(pet)) {
    toast(`${pet.name}留在原来的地方，先去找它吧。`);
    return;
  }
  if (petVetVisit?.pet === pet) {
    toast('兽医正在照料它，等检查结束再抱吧。');
    return;
  }
  if (mode === 'release') {
    if (petCareRequest?.pet === pet) {
      petCareRequest = null;
      route = [];
      pendingPlace = null;
    }
    clearPetCare(pet);
    toast(`${pet.name}回到地上啦。`);
    return;
  }
  if (!ready || clock < busyUntil || riding || swingSession) {
    toast('先结束现在的动作，再照料小伙伴吧。');
    return;
  }
  if ((mode === 'bed' || mode === 'wash') && scene !== 'house') {
    toast('先回家，再让小伙伴上床或洗澡吧。');
    return;
  }
  if (pet === dog && isFarmNight() && mode !== 'bed' && !petHealth.dog.sick) {
    toast('萨摩耶该休息啦，明早再抱抱或洗澡吧。');
    return;
  }
  if (pet === cat && isCatMorning() && !['bed', 'hold', 'back'].includes(mode)) {
    toast('布偶猫早上该休息啦，可以让它上床睡，晚上再抱抱或洗澡吧。');
    return;
  }
  if (carriedPet) clearPetCare(carriedPet);
  if (animalTravel && !releaseTravelAnimal()) return;
  clearPetCare(pet);
  // 主动抱起或照料可以叫醒短觉，主要作息已由上面的时间条件保护。
  if (clock < petNaps[pet.kind].until) {
    petNaps[pet.kind].until = 0;
    petNaps[pet.kind].nextAt = clock + 100;
  }
  if (animalCare.session?.actor === pet) cancelAnimalBathroom();
  if (pet === dog) {
    dogKennelReturn = null;
    dog.indoorRestAllowed = mode === 'bed';
  }
  cancelPetPlay();
  if (walkingDog) stopDogWalk(null);
  pet.sleeping = false;
  pet.route = [];
  pet.walking = false;
  petCareRequest = { pet, mode };
  places.petCare = {
    ...(mode === 'bed' ? places.bed : mode === 'wash' ? places.bath : pet),
    label: '照料小伙伴',
    icon: '♡'
  };
  walkTo(places.petCare, 'petCare');
  if (pendingPlace !== 'petCare') {
    petCareRequest = null;
    delete places.petCare;
  }
}

function beginPetCare() {
  const request = petCareRequest;
  if (!request) return;
  const { pet, mode } = request;
  petCareRequest = null;
  delete places.petCare;
  pet.care = {
    mode,
    phase: mode === 'hold' || mode === 'back' ? 'lifting' : 'approach',
    started: clock,
    from: { x: pet.x, y: pet.y },
    floor: { x: player.x, y: player.y },
    nextPlan: 0
  };
  if (mode === 'hold' || mode === 'back') {
    carriedPet = pet;
    toast(
      mode === 'hold'
        ? `轻轻抱起${pet.name}，一起散步吧。`
        : `背好${pet.name}，它会跟着暖暖一起走。`
    );
  } else
    toast(
      mode === 'bed'
        ? `${pet.name}走到床边，准备跳上软软的床。`
        : `带${pet.name}到浴缸边，准备温水和泡泡。`
    );
}

function inviteCatToBed() {
  // 只邀请已经在家、靠近床或由主人抱来的猫，不改变其他地图的宠物位置。
  if (scene !== 'house' || !petIsHere(cat) || (cat.care && cat.care.mode !== 'bed')) return;
  if (cat.care) {
    cat.care.sleepWithOwner = true;
    return;
  }
  cat.sleeping = false;
  cat.route = [];
  cat.care = {
    mode: 'bed', phase: 'approach', started: clock,
    from: { x: cat.x, y: cat.y }, floor: { ...places.bed },
    nextPlan: 0, sleepWithOwner: true, invited: true
  };
}

function updatePetCare(dt) {
  // 抱/背由暖暖的位置驱动；上床和洗澡先寻路靠近，再切到专用动作。
  // care 存在时 pets.js、night.js 和 animal-care.js 不再安排该宠物的自主行为。
  if (petCareRequest && pendingPlace !== 'petCare') {
    petCareRequest = null;
    delete places.petCare;
  }
  for (const pet of pets) {
    const care = pet.care;
    if (!care) continue;
    if (care.sleepWithOwner && (!sleepSession || sleepSession.waking !== null)) {
      care.sleepWithOwner = false;
      if (care.invited) {
        pet.sleeping = false;
        if (care.phase === 'approach') {
          // 主人先起床时，仍在走向床边的猫原地恢复活动，不瞬移到床旁。
          care.floor = { x: pet.x, y: pet.y };
          clearPetCare(pet);
          continue;
        }
        care.phase = 'leaving';
        care.started = clock;
        care.from = { x: pet.x, y: pet.y };
      }
    }
    if (pet === dog && isFarmNight() && !petHealth.dog.sick && ['hold', 'back'].includes(care.mode)) {
      clearPetCare(pet);
      toast('天黑啦，把萨摩耶放下，让它回窝休息。');
      continue;
    }
    pet.walking = false;
    if (care.mode === 'hold' || care.mode === 'back') {
      const lift = Math.min(1, (clock - care.started) / 0.7),
        bob = player.walking ? Math.sin(player.step * Math.PI) * 2 : Math.sin(clock * 2) * 0.8;
      const tx = player.x + (care.mode === 'back' ? -player.facing * 24 : player.facing * 8),
        ty = player.y - (care.mode === 'back' ? 80 : 48) + bob;
      pet.x = care.from.x + (tx - care.from.x) * lift;
      pet.y = care.from.y + (ty - care.from.y) * lift - Math.sin(lift * Math.PI) * 12;
      if (lift === 1) care.phase = 'carried';
    } else if (care.phase === 'approach') {
      const target = care.floor;
      if (clock - care.started > 45 || (care.mode === 'wash' && distance(player, target) > 160)) {
        clearPetCare(pet);
        toast('先让小伙伴休息，稍后再来照料它。');
        continue;
      }
      if (
        care.mode === 'wash' &&
        (clock < busyUntil || bathSession || livingSession || sleepSession)
      )
        continue;
      if (distance(pet, target) < 25) {
        pet.route = [];
        care.phase = care.mode === 'bed' ? 'jumping' : 'washing';
        care.started = clock;
        care.from = { x: pet.x, y: pet.y };
        if (care.mode === 'wash') busyUntil = clock + 7;
      } else if (clock >= care.nextPlan) {
        pet.route = findPetPath(target, pet).slice(1);
        care.nextPlan = clock + 1;
      }
      movePet(pet, dt, pet === dog ? 90 : 75);
    } else if (care.mode === 'bed') {
      const leaving = care.phase === 'leaving';
      const t = Math.min(1, (clock - care.started) / 0.9),
        target = leaving ? care.floor : pet === cat ? { x: 382, y: 272 } : { x: 300, y: 286 };
      pet.x = care.from.x + (target.x - care.from.x) * t;
      pet.y = care.from.y + (target.y - care.from.y) * t - Math.sin(t * Math.PI) * 60;
      if (t === 1) {
        if (leaving) {
          clearPetCare(pet);
          continue;
        }
        care.phase = 'resting';
        // 陪主人睡时猫也能闭眼，起床后恢复自己的昼夜作息。
        pet.sleeping =
          (pet === cat && care.sleepWithOwner && sleepSession &&
            sleepSession.waking === null && clock - sleepSession.started >= 3.6) ||
          (pet === dog ? isFarmNight() : isCatMorning()) || clock < petNaps[pet.kind].until;
      }
    } else {
      if (movementKeys.some((key) => keys.has(key))) {
        clearPetCare(pet);
        toast('先擦干，把小伙伴放到地上。');
        continue;
      }
      const t = clock - care.started;
      pet.x = 1275;
      pet.y = pet === dog ? 272 : 245;
      care.phase = t < 1 ? 'wetting' : t < 4.5 ? 'bubbles' : t < 6 ? 'rinsing' : 'drying';
      if (t < 6) playBathSound();
      else stopBathSound();
      if (t >= 7) {
        clearPetCare(pet);
        pet.affectionUntil = clock + 3;
        toast(`${pet.name}洗好擦干啦，香香软软的！`);
      }
    }
    places[pet.kind].x = pet.x;
    places[pet.kind].y = pet.y;
  }
}

function drawCarePet(pet, width) {
  const care = pet.care,
    atlas = pet === dog ? dogAtlas : catAtlas,
    cw = atlas.naturalWidth / 4;
  const [sy, sh] = petRows[pet.kind][0],
    height = (width * sh) / cw;
  ctx.save();
  ctx.translate(pet.x, pet.y);
  ctx.scale(['hold', 'back'].includes(care.mode) ? player.facing : 1, 1);
  ctx.rotate(care.mode === 'hold' ? 0.1 : care.mode === 'back' ? -0.12 : 0);
  let visibleHeight = height;
  if (pet.sleeping) {
    visibleHeight = drawPetSleepPose(pet, width);
  } else ctx.drawImage(atlas, cw, sy, cw, sh, -width / 2, -height, width, height);
  ctx.restore();
  if (pet.sleeping && (pet !== cat || cat.sleepPose >= 1))
    drawSleepMark(pet.x, pet.y - visibleHeight - 10);
}

function drawCarriedPet(back) {
  const pet = carriedPet;
  if (!pet || !pet.care || (pet.care.mode === 'back') !== back) return;
  drawCarePet(pet, pet === dog ? 96 : 76);
  ctx.save();
  ctx.strokeStyle = back ? '#c39b76' : '#f3c4a4';
  ctx.lineWidth = back ? 4 : 8;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(player.x + side * 22, player.y - 82);
    ctx.quadraticCurveTo(player.x + side * 32, player.y - 60, pet.x + side * 20, pet.y - 13);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPetCare() {
  canvas.dataset.petCare = pets
    .map((p) => `${p.kind}:${p.care ? `${p.care.mode}-${p.care.phase}` : 'free'}`)
    .join(',');
  for (const pet of pets) {
    const care = pet.care;
    if (!care || care.phase === 'approach' || care.mode === 'hold' || care.mode === 'back')
      continue;
    if (care.mode === 'bed') {
      // 分别占床脚左右两侧，不盖住主人的脸，也不把两只宠物画在一起。
      drawCarePet(pet, pet === dog ? 85 : 58);
      continue;
    }
    ctx.save();
    ctx.fillStyle = '#b1dfe5';
    ctx.beginPath();
    ctx.ellipse(1277, 262, 43, 53, 0, 0, Math.PI * 2);
    ctx.fill();
    drawCarePet(pet, pet === dog ? 92 : 73);
    if (care.phase === 'bubbles') {
      ctx.fillStyle = '#f6ffffdc';
      for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.arc(
          1244 + ((i * 17) % 67),
          220 + ((i * 23) % 52) + Math.sin(clock * 5 + i) * 2,
          4 + (i % 4),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.strokeStyle = '#f3c4a4';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(player.x + 20, player.y - 80);
      // 擦洗靠近主人的一侧毛发，不把整条手臂伸到浴缸和动物的中心。
      ctx.lineTo(1233 + Math.sin(clock * 7) * 3, 219);
      ctx.stroke();
    } else if (care.phase === 'wetting' || care.phase === 'rinsing') {
      ctx.strokeStyle = '#eefcff';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(1260 + i * 7, 165);
        ctx.lineTo(1255 + i * 8, 207 + Math.sin(clock * 8 + i) * 5);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#f6e5c4';
      ctx.beginPath();
      ctx.roundRect(1245, 230, 60, 27, 9);
      ctx.fill();
    }
    ctx.restore();
  }
}

function resetPetCareForScene() {
  petCareRequest = null;
  delete places.petCare;
  document.querySelector('#pet-care-dialog').close();
  for (const pet of pets) if (pet.care && pet !== carriedPet) clearPetCare(pet);
}

document.querySelector('#open-pet-care').addEventListener('click', () => {
  keys.clear();
  updateCareChoices();
  document.querySelector('#pet-care-dialog').showModal();
});
document
  .querySelector('#close-pet-care')
  .addEventListener('click', () => document.querySelector('#pet-care-dialog').close());
document.querySelectorAll('[data-pet-care]').forEach((button) =>
  button.addEventListener('click', () => {
    const kind = document.querySelector('#care-pet').value;
    document.querySelector('#pet-care-dialog').close();
    requestPetCare(button.dataset.petCare, kind);
  })
);

function updateCareChoices() {
  const kind = document.querySelector('#care-pet').value;
  const farmAnimal = kind in travelAnimalCells;
  document.querySelectorAll('[data-pet-care]').forEach((button) => {
    const mode = button.dataset.petCare;
    button.disabled = farmAnimal
      ? !(
          mode === 'release' ||
          (kind === 'horse' && mode === 'ride')
        )
      : mode === 'push' || mode === 'ride';
  });
}
document.querySelector('#care-pet').addEventListener('change', updateCareChoices);
