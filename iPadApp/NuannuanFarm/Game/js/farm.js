// 围栏门、动物闲逛、成长及步态；动物移动始终受养殖场边界约束。

const livestockGaitArt = new Image();
livestockGaitArt.src = 'assets/livestock-gait.png';
// 每行四张完整步态。按实际透明边界裁切，避免取到相邻动物。
const livestockGaitRegions = [
  [[37, 21, 205, 153], [292, 20, 203, 153], [539, 20, 211, 152], [792, 20, 205, 150]],
  [[31, 182, 199, 175], [280, 182, 210, 178], [538, 182, 208, 175], [790, 182, 213, 175]],
  [[46, 367, 184, 158], [293, 367, 186, 157], [541, 367, 195, 158], [795, 367, 196, 158]],
  [[16, 527, 234, 210], [260, 527, 240, 211], [505, 527, 248, 214], [753, 527, 248, 214]],
  [[13, 747, 244, 189], [261, 747, 250, 189], [515, 747, 250, 189], [768, 747, 248, 188]],
  [[32, 945, 197, 190], [280, 946, 201, 193], [533, 946, 203, 193], [781, 947, 209, 192]],
  [[48, 1143, 180, 185], [295, 1143, 185, 186], [548, 1143, 184, 186], [796, 1143, 190, 181]],
  [[37, 1331, 191, 188], [290, 1337, 189, 184], [547, 1334, 188, 187], [799, 1334, 192, 187]]
];

const penFloor = [
  [45, 443],
  [570, 443],
  [628, 466],
  [628, 542],
  [551, 566],
  [178, 570],
  [45, 536]
];
const penGate = {
  open: false,
  progress: 0,
  started: null,
  from: 0,
  to: 0,
  destination: null,
  closeRequested: false
};
const penGateOpening = { minX: 468, maxX: 594, centerX: 531 };
const penGateLeaves = [
  { hinge: { x: 468, y: 550 }, closed: { x: 64, y: -10 }, open: { x: -24, y: 40 } },
  { hinge: { x: 596, y: 530 }, closed: { x: -64, y: 10 }, open: { x: 24, y: 40 } }
];
const pastureRanges = {
  0: { minX: 650, maxX: 725, minY: 625, maxY: 700 },
  6: { minX: 790, maxX: 855, minY: 610, maxY: 700 }
};

function animalPastureRange(animal) {
  return pastureRanges[animal.cell] ?? { minX: 630, maxX: 870, minY: 600, maxY: 760 };
}

function insidePen(point) {
  return insidePolygon(point.x, point.y, penFloor);
}

function usePenGate(destination = null) {
  if (scene !== 'farm' || penGate.started !== null) return;
  if (riding) {
    toast('先下马，再走进养殖场吧。');
    return;
  }
  if (penGate.open) {
    if (penGate.closeRequested) return;
    penGate.closeRequested = true;
    pendingPlace = null;
    penGate.destination = null;
    clearPenGateActors();
    places.penGate.label = '等大家通过后关门';
    toast(herdSession ? '等小伙伴把动物带过来，门会自动关好。' : '暖暖让开一点，门会自动关好。');
    return;
  }
  animatePenGate(true, destination);
}

function animatePenGate(open, destination = null) {
  penGate.open = open;
  penGate.closeRequested = false;
  penGate.from = penGate.progress;
  penGate.to = Number(penGate.open);
  penGate.started = clock;
  penGate.destination = destination;
  route = [];
  pendingPlace = null;
  busyUntil = clock + 0.8;
  places.penGate.label = penGate.open ? '关上养殖场的门' : '打开养殖场的门';
  toast(penGate.open ? '围栏门慢慢打开啦，可以走进去。' : '围栏门关好啦。');
}

function inPenGatePassage(point, margin = 0) {
  return point.x > penGateOpening.minX - margin && point.x < penGateOpening.maxX + margin &&
    point.y > 520 && point.y < 610;
}

function clearPenGateActors() {
  // 只选同一侧的可走网格，让开动作沿正常寻路完成，不跨围栏或水面瞬移。
  rebuildGrid();
  for (const actor of [player, ...pets.filter(petIsHere)]) {
    if (!inPenGatePassage(actor, 8) || (actor !== player && actor === herdSession?.pet)) continue;
    const candidates = grid.filter(
      (point) =>
        !inPenGatePassage(point, 22) &&
        insidePen(point) === insidePen(actor) &&
        distance(point, actor) < 150
    );
    candidates.sort((a, b) => distance(a, actor) - distance(b, actor));
    for (const point of candidates) {
      const path = findPath(point, actor).slice(1);
      if (!path.length) continue;
      if (actor === player) route = path;
      else {
        actor.route = path;
        actor.nextPlan = clock + 3;
      }
      break;
    }
  }
}

function updateFarm(dt) {
  let grewToday = false;
  for (const animal of animals) {
    // 喂养在次日结算；只有羔羊会长大，成体不因一顿饲料变大。
    if (animal.lastFedDay < farmTime.day && animal.growthCreditedDay !== animal.lastFedDay) {
      animal.growthCreditedDay = animal.lastFedDay;
      const growthStep = animal.cell === 2 ? 0.035 : 0;
      const limit = 1.28;
      if (growthStep && animal.feedDays % 2 === 0 && animal.targetGrowth < limit) {
        animal.targetGrowth = Math.min(limit, animal.targetGrowth + growthStep);
        grewToday = true;
      }
    }
    animal.growth += (animal.targetGrowth - animal.growth) * Math.min(1, dt * 0.65);
    if (Math.abs(animal.growth - animal.targetGrowth) < 0.001) animal.growth = animal.targetGrowth;
    // 喂食、睡觉和成长时也检查边界，不能只约束自主闲逛的脚位。
    returnStrayFarmAnimal(animal);
  }
  if (grewToday && scene === 'farm') keepFarmActorsOnWalkableGround();
  updateAnimalWandering(dt);
  if (scene !== 'farm') {
    penGate.closeRequested = false;
    return;
  }
  // 骑马时不能操作关着的门，靠近门就自动为小马让出通路。
  if (riding && !penGate.open &&
      player.x > penGateOpening.minX - 70 && player.x < penGateOpening.maxX + 70 &&
      player.y > 455 && player.y < 670)
    animatePenGate(true);
  if (penGate.closeRequested && penGate.started === null) {
    const actorsAtGate = [player, ...pets.filter(petIsHere)].some((actor) =>
      inPenGatePassage(actor, 8)
    );
    const animalsAtGate = animals.some(
      (animal) =>
        !animal.visitScene &&
        inPenGatePassage(farmAnimalPosition(animal), animal.width * animal.targetGrowth * 0.25)
    );
    // 领队尚在通行时保留请求，不能把最后一只动物关在门外。
    if (!herdSession && !actorsAtGate && !animalsAtGate) animatePenGate(false);
  }
  places.penGate.x = penGateOpening.centerX;
  places.penGate.y = insidePen(player) ? 510 : 615;
  places.penGate.label = penGate.closeRequested
    ? '等大家通过后关门'
    : penGate.open
      ? '关上养殖场的门'
      : '打开养殖场的门';
  if (penGate.started !== null) {
    const t = Math.min(1, (clock - penGate.started) / 0.8),
      ease = t * t * (3 - 2 * t);
    penGate.progress = penGate.from + (penGate.to - penGate.from) * ease;
    if (t === 1) {
      penGate.started = null;
      busyUntil = 0;
      rebuildGrid();
      const destination = penGate.destination;
      if (destination?.place === 'horse') {
        updateHorseMountingPlace();
        destination.point = { ...places.horse };
      }
      penGate.destination = null;
      if (destination) walkTo(destination.point, destination.place);
    }
  }
}

function animalCanStep(animal, point) {
  if (animal.cell !== 3 && !animal.grazing && !animal.herdRoute && !animalFitsPen(animal, point)) return false;
  const roaming = animal.grazing || animal.herdRoute;
  if (roaming) {
    const pasture = animalPastureRange(animal);
    const meadow = point.x >= pasture.minX && point.x <= pasture.maxX &&
      point.y >= pasture.minY && point.y <= pasture.maxY;
    const gateway =
      animal.herdRoute && penGate.open && point.x >= penGateOpening.minX && point.x <= 635 &&
      point.y >= 510 && point.y <= 655;
    if (!insidePen(point) && !meadow && !gateway) return false;
    if (!insidePen(point) && !horseClearOfWater(point.x, point.y)) return false;
  }
  if (
    !roaming &&
    !animalFitsPen(animal, point)
  )
    return false;
  for (const other of animals) {
    if (other === animal || other.visitScene || (riding && other.cell === 3)) continue;
    const position = farmAnimalPosition(other),
      gap = (animal.width * animal.targetGrowth + other.width * other.targetGrowth) * 0.22;
    const separation = ((point.x - position.x) / gap) ** 2 + ((point.y - position.y) / 18) ** 2;
    if (separation < 1) {
      const current = farmAnimalPosition(animal);
      const previous = ((current.x - position.x) / gap) ** 2 + ((current.y - position.y) / 18) ** 2;
      // 出生位置或成长可能已有重叠：允许慢慢走出去，但不能继续挤向对方。
      if (previous >= 1 || separation <= previous + 0.000001) return false;
    }
  }
  if (scene === 'farm') {
    for (const actor of [player, ...pets.filter(petIsHere)]) {
      // 领路宠物沿可走网格避开动物的脚位，不再与被引导动物互相锁住。
      if (animal.herdRoute && herdSession?.pet === actor) continue;
      const radius = animal.width * animal.targetGrowth * 0.32 + 18;
      const separation = ((point.x - actor.x) / radius) ** 2 + ((point.y - actor.y) / 25) ** 2;
      if (separation >= 1) continue;
      const current = farmAnimalPosition(animal);
      const previous = ((current.x - actor.x) / radius) ** 2 + ((current.y - actor.y) / 25) ** 2;
      if (previous >= 1 || separation <= previous + 0.000001) return false;
    }
  }
  return true;
}

function animalFitsPen(animal, point) {
  // 鸡的整个轮廓要留在栏内；仅检查脚中心和四分之一宽度会让身体穿过侧栏。
  const chicken = animal.cell >= 5;
  const radius = animal.width * Math.max(animal.growth, animal.targetGrowth) * (chicken ? 0.55 : 0.25);
  const frontMargin = chicken ? 20 : 7;
  return [[0, 0], [-radius, 0], [radius, 0], [0, -7], [0, frontMargin]]
    .every(([dx, dy]) => insidePen({ x: point.x + dx, y: point.y + dy }));
}

function returnStrayFarmAnimal(animal) {
  if (animal.cell === 3 || animal.grazing || animal.herdRoute || animal.visitScene) return;
  const position = farmAnimalPosition(animal);
  if (animalFitsPen(animal, position)) return;
  // 修正成长和旧的放牧位置；避雨返棚的队伍仍沿门走回，不瞬移。
  animal.grazing = false;
  let nearest = null, nearestDistance = Infinity;
  for (let y = 455; y <= 545; y += 10)
    for (let x = 65; x <= 605; x += 10) {
      const point = { x, y }, gap = distance(position, point);
      if (gap < nearestDistance && animalCanStep(animal, point)) {
        nearest = point;
        nearestDistance = gap;
      }
    }
  if (!nearest) return;
  position.x = nearest.x;
  position.y = nearest.y;
  animal.wanderTarget = null;
}

function keepFarmAnimalPoseInsidePen(animal, pose) {
  if (animal.cell === 3 || animal.grazing || animal.herdRoute || animal.visitScene || animalFitsPen(animal, pose))
    return pose;
  // 喂食的靠近、蹦跳是绘制位移，也必须受围栏约束；脚位合法不代表动画合法。
  const ground = farmAnimalPosition(animal);
  let safe = 0, unsafe = 1;
  for (let i = 0; i < 12; i++) {
    const fraction = (safe + unsafe) / 2;
    const point = { x: ground.x + (pose.x - ground.x) * fraction,
      y: ground.y + (pose.y - ground.y) * fraction };
    if (animalFitsPen(animal, point)) safe = fraction;
    else unsafe = fraction;
  }
  return { ...pose, x: ground.x + (pose.x - ground.x) * safe,
    y: ground.y + (pose.y - ground.y) * safe };
}

function updateAnimalWandering(dt) {
  for (const animal of animals) {
    animal.walking = false;
    if (
      scene !== 'farm' ||
      animal.visitScene ||
      animal.herdRoute ||
      animal.sheltering ||
      animalPetting?.animal === animal ||
      animalTravelRequest?.animal === animal ||
      isFarmNight() ||
      animal.restMoving ||
      (animal.cell === 3 && (riding || pendingPlace === 'horse' || penGate.destination?.place === 'horse')) ||
      animalCare.session?.actor === animal ||
      clock < (animal.eatingUntil || 0)
    )
      continue;
    returnStrayFarmAnimal(animal);
    const position = farmAnimalPosition(animal);
    if (animal.nextWander === undefined) animal.nextWander = clock + 2 + animal.seed * 0.45;
    if (!animal.wanderTarget && clock >= animal.nextWander) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const point = {
          x: animal.grazing
            ? position.x + (Math.random() - 0.5) * 110
            : position.x + (Math.random() - 0.5) * 105,
          y: animal.grazing
            ? position.y + (Math.random() - 0.5) * 65
            : Math.max(455, Math.min(547, position.y + (Math.random() - 0.5) * 60))
        };
        if (distance(position, point) > 16 && animalCanStep(animal, point)) {
          animal.wanderTarget = point;
          break;
        }
      }
      animal.nextWander = clock + 2 + Math.random() * 2;
    }
    if (!animal.wanderTarget) continue;
    const dx = animal.wanderTarget.x - position.x,
      dy = animal.wanderTarget.y - position.y,
      gap = Math.hypot(dx, dy);
    if (gap < 2) {
      animal.wanderTarget = null;
      animal.nextWander = clock + 3 + Math.random() * 4;
      continue;
    }
    const step = Math.min(gap, dt * (animal.cell >= 5 ? 38 : animal.cell === 2 ? 34 : 27));
    let next = null;
    const heading = Math.atan2(dy, dx);
    // 一次避让保持同一侧，避免每帧在邻居两侧反复试探、左右翻转。
    const avoiding = clock < (animal.avoidUntil || 0);
    const side = animal.avoidSide || (animal.cell % 2 ? -1 : 1);
    const turns = avoiding
      ? [side * 0.55, side * 1.1, side * 1.6, 0]
      : [0, side * 0.55, side * 1.1, side * 1.6];
    for (const turn of turns) {
      const candidate = {
        x: position.x + Math.cos(heading + turn) * step,
        y: position.y + Math.sin(heading + turn) * step
      };
      if (animalCanStep(animal, candidate)) {
        next = candidate;
        if (turn !== 0 && !avoiding) {
          animal.avoidSide = side;
          animal.avoidUntil = clock + 0.8;
        }
        break;
      }
    }
    if (!next) {
      animal.wanderTarget = null;
      animal.nextWander = clock + 2 + Math.random() * 3;
      animal.avoidUntil = 0;
      continue;
    }
    const movedX = next.x - position.x;
    position.x = next.x;
    position.y = next.y;
    animal.walking = true;
    animal.stride = (animal.stride || 0) + step / (animal.cell >= 5 ? 5 : 12);
    if (Math.abs(movedX) > 0.01) {
      const facing = movedX < 0 ? -1 : 1;
      if (!animal.walkFacing) animal.walkFacing = facing;
      animal.facingTravel =
        facing === animal.walkFacing ? 0 : (animal.facingTravel || 0) + Math.abs(movedX);
      // 真正朝反方向走出一小段才转身，不能因避让的一点横向位移瞬间翻图。
      if (animal.facingTravel >= 6) {
        animal.walkFacing = facing;
        animal.facingTravel = 0;
      }
    }
  }
}

function drawAnimalWalk(animal, region, width, height, allowWalking = true) {
  const walking = allowWalking && !animal.sleeping && (animal.walking || animal.restMoving);
  if (walking && livestockGaitArt.complete && livestockGaitArt.naturalWidth) {
    // 距离驱动步频；回床位的动作由日程推进，使用同一组慢走步态。
    const phase = animal.restMoving ? clock * 5 : (animal.stride || 0) * 2;
    const [x, y, sourceWidth, sourceHeight] = livestockGaitRegions[animal.cell][Math.floor(phase) % 4];
    if (animal.walkFacing === -1) ctx.scale(-1, 1);
    ctx.drawImage(livestockGaitArt, x, y, sourceWidth, sourceHeight,
      -width / 2, -height, width, height);
    return;
  }
  const nativeFacing = [1, 2, 4, 5, 6].includes(animal.cell) ? -1 : 1;
  if (animal.walkFacing && animal.walkFacing !== nativeFacing) ctx.scale(-1, 1);
  // 每只动物每帧只绘制一张完整轮廓；分割再旋转腿部会把相邻像素拼出重影。
  const source = animal.sleeping ? sleepingAnimalsArt : animalAtlas;
  const crop = animal.sleeping ? sleepingAnimalRegions[animal.cell] : region;
  const visibleHeight = animal.sleeping ? (width * crop.height) / crop.width : height;
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    -width / 2,
    -visibleHeight,
    width,
    visibleHeight
  );
}

function feedFarmAnimals(candidates = animals.filter((animal) =>
  !animal.visitScene && insidePen(farmAnimalPosition(animal))
)) {
  const available = candidates.filter((animal) => !animal.visitScene);
  const hungry = available.filter((animal) => animal.lastFedDay !== farmTime.day);
  for (const animal of hungry) {
    animal.feedDays = animal.lastFedDay === farmTime.day - 1 ? (animal.feedDays || 0) + 1 : 1;
    animal.lastFedDay = farmTime.day;
    animal.fedAt = clock;
    animal.eatingUntil = clock + 6;
    animal.affinity = Math.min(100, (animal.affinity ?? 60) + 2);
  }
  return { fed: hungry.length, available: available.length };
}

function keepFarmActorsOnWalkableGround() {
  rebuildGrid();
  if (!canWalk(player.x, player.y)) {
    const safe = nearestNode(player);
    player.x = safe.x;
    player.y = safe.y;
  }
  // 当前地图的网格不能用于修正留在家里或其他地图的小伙伴。
  for (const pet of pets.filter(petIsHere))
    if (!canWalk(pet.x, pet.y)) {
      const safe = nearestNode(pet);
      pet.x = safe.x;
      pet.y = safe.y;
      pet.route = [];
    }
}

function drawPenFence(front) {
  if (scene !== 'farm' || front !== insidePen(player)) return;
  ctx.save();
  clipFenceWood();
  ctx.drawImage(background, 0, 0, W, H);
  ctx.restore();
}

function drawPenGate(front) {
  if (scene !== 'farm') return;
  const angle = penGate.progress * Math.PI / 2;
  for (const leaf of penGateLeaves) {
    const edgeY = leaf.closed.y * Math.cos(angle) + leaf.open.y * Math.sin(angle);
    // 两叶各自按落地中点分层，开门后左右门板仍贴着自己的铰链。
    const depth = leaf.hinge.y + edgeY / 2;
    if ((depth > player.y) !== front) continue;
    drawGroundedDoor(
      doorPanelRegions.pen, leaf.hinge, leaf.closed, leaf.open,
      // 每叶原始门宽64，开门只改变投影，不把门板高度撑成房门。
      64 * doorPanelRegions.pen.height / doorPanelRegions.pen.width,
      penGate.progress
    );
  }

  canvas.dataset.penGate = penGate.started !== null ? 'moving' : penGate.open ? 'open' : 'closed';
  canvas.dataset.inPen = String(insidePen(player));
  canvas.dataset.animalGrowth = animals.map((a) => a.growth.toFixed(2)).join(',');
}
