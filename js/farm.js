// 围栏门、动物闲逛、成长及步态；动物移动始终受养殖场边界约束。

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
  return point.x > 500 - margin && point.x < 572 + margin && point.y > 520 && point.y < 610;
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
  for (const animal of animals) {
    animal.growth += (animal.targetGrowth - animal.growth) * Math.min(1, dt * 0.65);
    if (Math.abs(animal.growth - animal.targetGrowth) < 0.001) animal.growth = animal.targetGrowth;
    // 喂食、睡觉和成长时也检查边界，不能只约束自主闲逛的脚位。
    returnStrayFarmAnimal(animal);
  }
  updateAnimalWandering(dt);
  if (scene !== 'farm') {
    penGate.closeRequested = false;
    return;
  }
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
  places.penGate.x = 535;
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
      penGate.destination = null;
      if (destination) walkTo(destination.point, destination.place);
    }
  }
}

function animalCanStep(animal, point) {
  if (animal.cell !== 3 && !animal.herdRoute && !animalFitsPen(animal, point)) return false;
  const roaming = animal.grazing || animal.herdRoute;
  if (roaming) {
    const meadow = point.x >= 630 && point.x <= 870 && point.y >= 600 && point.y <= 760;
    const gateway =
      animal.herdRoute && penGate.open && point.x >= 495 && point.x <= 635 && point.y >= 510 && point.y <= 655;
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
  if (animal.cell === 3 || animal.herdRoute || animal.visitScene) return;
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
  if (animal.cell === 3 || animal.herdRoute || animal.visitScene || animalFitsPen(animal, pose))
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
      (riding && animal.cell === 3) ||
      animalCare.session?.actor === animal ||
      clock - feedingStarted < 6
    )
      continue;
    returnStrayFarmAnimal(animal);
    const position = farmAnimalPosition(animal);
    if (animal.nextWander === undefined) animal.nextWander = clock + animal.seed * 0.25;
    if (!animal.wanderTarget && clock >= animal.nextWander) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const point = {
          x: animal.grazing ? 650 + Math.random() * 185 : animal.x + (Math.random() - 0.5) * 230,
          y: animal.grazing
            ? 620 + Math.random() * 100
            : Math.max(455, Math.min(547, animal.y + (Math.random() - 0.5) * 105))
        };
        if (distance(position, point) > 20 && animalCanStep(animal, point)) {
          animal.wanderTarget = point;
          break;
        }
      }
      animal.nextWander = clock + 0.15 + Math.random() * 0.3;
    }
    if (!animal.wanderTarget) continue;
    const dx = animal.wanderTarget.x - position.x,
      dy = animal.wanderTarget.y - position.y,
      gap = Math.hypot(dx, dy);
    if (gap < 2) {
      animal.wanderTarget = null;
      animal.nextWander = clock + 0.35 + Math.random() * 0.7;
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
      animal.nextWander = clock + 1.2 + Math.random() * 0.8;
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

function drawAnimalWalk(animal, region, width, height) {
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

function growFarmAnimals() {
  for (const animal of animals)
    animal.targetGrowth = Math.min(1.75, animal.targetGrowth + (animal.cell === 2 ? 0.12 : 0.08));
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
  if (scene !== 'farm' || front !== player.y < 552) return;
  drawGroundedDoor(
    doorPanelRegions.pen,
    { x: 501, y: 550 },
    { x: 64, y: -16 },
    { x: 8, y: 35 },
    // 闭合时按门板原始比例缩放；门高不跟开门后的横向投影一起拉伸。
    64 * doorPanelRegions.pen.height / doorPanelRegions.pen.width,
    penGate.progress
  );

  canvas.dataset.penGate = penGate.started !== null ? 'moving' : penGate.open ? 'open' : 'closed';
  canvas.dataset.inPen = String(insidePen(player));
  canvas.dataset.animalGrowth = animals.map((a) => a.growth.toFixed(2)).join(',');
}
