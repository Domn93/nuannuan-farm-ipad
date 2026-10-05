// 猫带鸡、狗带大动物走过围栏门；分批通行，避免在窄门口挤成一团。
let herdSession = null;

function herdWeatherNeedsShelter() {
  return ['rain', 'snow', 'hail'].includes(farmClimate.weather);
}

function herdPetAvailable(pet) {
  return petIsHere(pet) && !pet.boarded && !petHealth[pet.kind].sick && petVetVisit?.pet !== pet &&
    !pet.care && petCareRequest?.pet !== pet && carriedPet !== pet && !petMedicineActive(pet);
}

function availableHerdPet(animal) {
  const pet = animal.cell >= 5 ? cat : dog;
  return herdPetAvailable(pet) ? pet : null;
}

function availableRainHerdPet(animal) {
  const pet = availableHerdPet(animal);
  // 自动避雨不能抢走玩家已经牵着、或正在走近准备牵走的狗。
  return pet === dog && (walkingDog || pendingPlace === 'dog') ? null : pet;
}

function openGateForHerd() {
  if (penGate.open) return;
  // 自动避雨只开动物通道，不打断暖暖手头的动作和行走目的地。
  penGate.open = true;
  penGate.from = penGate.progress;
  penGate.to = 1;
  penGate.started = clock;
  if (places.penGate) places.penGate.label = '关上养殖场的门';
}

function startRainHerding() {
  if (scene !== 'farm' || !herdWeatherNeedsShelter()) return;
  const exposed = animals.filter(
    (animal) => !animal.visitScene && !(riding && animal.cell === 3) &&
      !animal.sheltering && (animal.grazing || !insidePen(farmAnimalPosition(animal)))
  );
  if (!exposed.length) return;
  if (herdSession) stopHerding();
  const group = exposed.filter((animal) => availableRainHerdPet(animal));
  // 宠物留在另一张地图时不能瞬移：没有引导者的动物沿已有回窝逻辑避雨。
  for (const animal of exposed) {
    if (group.includes(animal)) continue;
    animal.grazing = false;
    animal.sheltering = true;
    animal.wanderTarget = null;
  }
  if (!group.length) return;
  // cancelPetPlay 内部会 stopHerding，必须在建立新 session 之前取消旧游戏。
  cancelPetPlay();
  cancelAnimalBathroom();
  openGateForHerd();
  const pet = availableRainHerdPet(group[0]);
  pet.playing = true;
  pet.sleeping = false;
  herdSession = {
    pet, otherPet: null, group, index: 0, automatic: true, nextPlan: 0
  };
  toast('天气变坏啦，猫带母鸡、狗带大动物回棚避雨。', 6);
}

function stopHerding() {
  if (!herdSession) return;
  const pet = herdSession.pet;
  pet.playing = false;
  pet.walking = false;
  pet.route = [];
  pet.nextPlan = clock + 3;
  if (herdSession.otherPet) {
    herdSession.otherPet.playing = false;
    herdSession.otherPet.route = [];
    herdSession.otherPet.nextPlan = clock + 3;
  }
  for (const animal of animals) {
    if (animal.herdRoute) animal.grazing = !insidePen(farmAnimalPosition(animal));
    animal.herdRoute = null;
  }
  herdSession = null;
}

function startHerding() {
  if (animalPetting) {
    toast('先摸完这只小动物，再带它们回棚吧。');
    return;
  }
  if (scene !== 'farm' || riding || clock < busyUntil) {
    toast('先回农场并下马，再带小动物回棚吧。');
    return;
  }
  const group = animals.filter((animal) => !animal.visitScene);
  if (!group.length) {
    toast('小动物们都不在农场，不用带它们回棚。');
    return;
  }
  const pet = group.map(availableHerdPet).find(Boolean);
  if (!pet) {
    toast('猫狗现在无法引导，等它们回到农场、结束照料并康复后再试吧。');
    return;
  }
  stopHerding();
  cancelPetPlay();
  cancelAnimalBathroom();
  if (walkingDog && petIsHere(dog)) stopDogWalk(null);
  if (!penGate.open) usePenGate();
  pet.playing = true;
  const partner = pet === dog ? cat : dog;
  const otherPet = herdPetAvailable(partner) ? partner : null;
  if (otherPet) {
    otherPet.playing = true;
    otherPet.route = findPath({ x: 925, y: 620 }, otherPet).slice(1);
  }
  herdSession = {
    pet, otherPet, group, index: 0, nextPlan: 0
  };
  toast(`${pet.name}来帮忙，把小动物一只只带回棚里。`, 6);
}

function herdPath(animal) {
  const p = farmAnimalPosition(animal);
  const gate = [
    { x: 535, y: 535 },
    { x: 535, y: 600 }
  ];
  const bed = barnBeds[animal.cell];
  return [
    ...(!insidePen(p) ? [{ x: 650, y: 620 }, ...[...gate].reverse()] : []),
    { x: bed[0], y: bed[1] }
  ];
}

function updateHerding(dt) {
  // 暖暖进屋或进棚后，已开始的避雨队伍继续沿原来的围栏门路线回棚。
  // 这里不使用当前地图的寻路网格，也不把猫狗搬到暖暖所在的地图。
  if (scene !== 'farm' && herdSession?.automatic) {
    const animal = herdSession.group[herdSession.index];
    if (!animal) {
      stopHerding();
      return;
    }
    if (!animal.herdRoute) animal.herdRoute = herdPath(animal);
    const position = farmAnimalPosition(animal);
    const target = animal.herdRoute[0];
    if (!target) {
      animal.grazing = false;
      animal.sheltering = true;
      animal.herdRoute = null;
      herdSession.index++;
      return;
    }
    const gap = distance(position, target);
    if (gap < 4) animal.herdRoute.shift();
    else {
      const step = Math.min(gap, dt * 55);
      animal.restPosition = {
        x: position.x + (target.x - position.x) / gap * step,
        y: position.y + (target.y - position.y) / gap * step
      };
    }
    return;
  }
  if (scene === 'farm' && herdWeatherNeedsShelter() && !herdSession?.returning)
    startRainHerding();
  const session = herdSession;
  if (!session) return;
  if (scene !== 'farm' || session.pet.care) {
    stopHerding();
    return;
  }
  const animal = session.group[session.index];
  if (!animal) {
    stopHerding();
    toast('动物们都回棚休息啦。');
    return;
  }
  if (!session.automatic && clock < busyUntil) return;
  if (session.automatic) {
    const guide = availableRainHerdPet(animal);
    if (!guide) {
      animal.grazing = false;
      animal.sheltering = true;
      animal.herdRoute = null;
      session.index++;
      return;
    }
    if (session.pet !== guide) {
      session.pet.playing = false;
      session.pet.walking = false;
      session.pet.route = [];
      session.pet = guide;
      session.nextPlan = 0;
    }
    guide.playing = true;
    guide.sleeping = false;
    if (!penGate.open) openGateForHerd();
  }
  if (session.otherPet && !session.otherPet.care) movePet(session.otherPet, dt, 70);
  if (!animal.herdRoute) {
    animal.herdRoute = herdPath(animal);
    animal.wanderTarget = null;
    animal.sheltering = false;
  }
  const p = farmAnimalPosition(animal),
    target = animal.herdRoute[0];
  if (!target) {
    animal.grazing = false;
    animal.sheltering = true;
    animal.herdRoute = null;
    animal.walking = false;
    animal.nextWander = clock + 2;
    session.index++;
    return;
  }
  const gap = distance(p, target);
  // 动物逐个走到各自床位，避免在门口争同一个落脚点。
  if (gap < 4) {
    animal.herdRoute.shift();
    animal.herdProgress = null;
    return;
  }
  if (!animal.herdProgress || gap < animal.herdProgress.gap - 2)
    animal.herdProgress = { gap, at: clock };
  if (clock - animal.herdProgress.at > 3) {
    const detour = findHerdDetour(animal, target);
    if (detour.length) animal.herdRoute.splice(0, 1, ...detour);
    animal.herdProgress = { gap, at: clock };
    return;
  }
  const heading = Math.atan2(target.y - p.y, target.x - p.x);
  const step = Math.min(gap, dt * 48);
  const side = animal.herdSide || (animal.cell % 2 ? -1 : 1);
  for (const turn of [0, side * 0.6, side * 1.2, -side * 0.6, -side * 1.2]) {
    const next = {
      x: p.x + Math.cos(heading + turn) * step,
      y: p.y + Math.sin(heading + turn) * step
    };
    if (!animalCanStep(animal, next)) continue;
    const dx = next.x - p.x;
    p.x = next.x;
    p.y = next.y;
    if (turn !== 0) animal.herdSide = Math.sign(turn);
    animal.walking = true;
    animal.stride = (animal.stride || 0) + step / 10;
    if (Math.abs(dx) > 0.5) animal.walkFacing = dx < 0 ? -1 : 1;
    break;
  }
  if (clock >= session.nextPlan) {
    // 窄门口先让到草地一侧，不能追到动物前面把通道堵住。
    const behind =
      p.x < 635 && p.y > 510
        ? { x: 650, y: 655 }
        : { x: p.x - Math.cos(heading) * 80, y: p.y - Math.sin(heading) * 60 };
    session.pet.route = findPetPath(behind, session.pet).slice(1);
    session.nextPlan = clock + 0.7;
  }
  movePet(session.pet, dt, 65);
}

function findHerdDetour(animal, target) {
  // 实测大动物会被几只鸡围住：按它自身的碰撞尺寸绕路，不强行穿过邻居。
  const step = 24,
    start = farmAnimalPosition(animal);
  const queue = [{ x: start.x, y: start.y, parent: -1 }];
  const visited = new Set(['0,0']);
  for (let index = 0; index < queue.length && index < 1800; index++) {
    const node = queue[index];
    if (index && distance(node, target) < step) {
      const path = [{ ...target }];
      let cursor = index;
      while (cursor > 0) {
        path.unshift({ x: queue[cursor].x, y: queue[cursor].y });
        cursor = queue[cursor].parent;
      }
      return path;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1]
    ]) {
      const point = { x: node.x + dx * step, y: node.y + dy * step };
      const key = `${Math.round((point.x - start.x) / step)},${Math.round((point.y - start.y) / step)}`;
      if (visited.has(key) || !animalCanStep(animal, point)) continue;
      visited.add(key);
      queue.push({ ...point, parent: index });
    }
  }
  return [];
}

document
  .querySelector('#shelter-animals')
  .addEventListener('click', () => startHerding());
