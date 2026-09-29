// 只有小马可骑出围栏；其他农场动物留在养殖场内，猫狗照料另行处理。
const travelAnimalCells = { lamb: 2, chicken: 6, pig: 0, cow: 4, horse: 3 };
const travelAnimalNames = {
  lamb: '小羊',
  chicken: '小鸡',
  pig: '小猪',
  cow: '小牛',
  horse: '小马'
};
let animalTravel = null;
let animalTravelRequest = null;

function animalIsHere(animal) {
  return animal.visitScene ? animal.visitScene === scene : scene === 'farm';
}

function requestAnimalTravel(kind, mode) {
  const animal = animals[travelAnimalCells[kind]];
  if (!animal || !ready || clock < busyUntil) return;
  if (mode === 'release') {
    if (animalTravel?.animal === animal) releaseTravelAnimal();
    else if (kind === 'horse' && riding) dismountHorse();
    return;
  }
  if (kind === 'horse') {
    if (mode !== 'ride' || !animalIsHere(animal)) return;
    const point = animal.visitPosition || places.horse;
    places.horse = { ...point, label: '骑上小马', icon: '🐴' };
    walkTo(places.horse, 'horse');
    return;
  }
  toast('羊、猪、牛和鸡留在养殖场里，可以进去喂食和抚摸；只有小马能骑出去。');
}

function beginAnimalTravel() {
  if (!animalTravelRequest) return;
  // 即使旧的互动路线尚未完成，也不能重新启动已经取消的外出方式。
  animalTravelRequest = null;
  delete places.animalTravel;
}

function travelAnimalGround(animal, x, y) {
  const terrain = scene === 'farm' ? onFarmGround : onExploreGround;
  const radius = Math.min(30, animal.width * animal.growth * 0.24);
  if (
    scene === 'farm' &&
    [0, 4].includes(animal.cell) &&
    !insidePen({ x, y }) &&
    !horseClearOfWater(x, y)
  )
    return false;
  return [
    [0, 0],
    [-radius, 0],
    [radius, 0],
    [0, -18],
    [0, 18]
  ].every(([dx, dy]) => terrain(x + dx, y + dy));
}

function canPushAnimalAt(x, y) {
  if (animalTravel?.mode !== 'push') return true;
  // 推行时以动物的脚位作为整个队伍的寻路点，暖暖绘制在它后面。
  return travelAnimalGround(animalTravel.animal, x, y);
}

function updateAnimalTravel(dt) {
  if (animalTravelRequest && pendingPlace !== 'animalTravel' && !penGate.destination) {
    animalTravelRequest = null;
    delete places.animalTravel;
  }
  if (animalTravel) {
    const { animal, mode } = animalTravel;
    animal.visitScene = scene;
    animal.sleeping = false;
    const old = animal.visitPosition;
    if (mode === 'hold') {
      const lift = Math.min(1, (clock - animalTravel.started) / 0.7);
      const target = { x: player.x + player.facing * 8, y: player.y - 48 };
      animal.visitPosition = {
        x: animalTravel.from.x + (target.x - animalTravel.from.x) * lift,
        y: animalTravel.from.y + (target.y - animalTravel.from.y) * lift
      };
    } else {
      const previous = animalTravel.playerPosition || player;
      const dx = player.x - previous.x,
        dy = player.y - previous.y,
        length = Math.hypot(dx, dy);
      if (length > 0.01) {
        animalTravel.dx = dx / length;
        animalTravel.dy = dy / length;
      }
      const target = { x: player.x, y: player.y };
      if (travelAnimalGround(animal, target.x, target.y)) animal.visitPosition = target;
      animalTravel.playerPosition = { x: player.x, y: player.y };
      player.view =
        Math.abs(animalTravel.dy) > Math.abs(animalTravel.dx) ? (animalTravel.dy < 0 ? 2 : 0) : 1;
      if (player.view === 1) player.facing = animalTravel.dx < 0 ? -1 : 1;
    }
    animal.walking = mode === 'push' && player.walking;
    animal.stride = (animal.stride || 0) + distance(old, animal.visitPosition) / 12;
    if (Math.abs(animal.visitPosition.x - old.x) > 1)
      animal.walkFacing = animal.visitPosition.x < old.x ? -1 : 1;
  }
  for (const animal of animals) {
    if (
      !animal.visitScene ||
      animal.visitScene !== scene ||
      animalTravel?.animal === animal ||
      (riding && animal.cell === 3)
    )
      continue;
    animal.sleeping = isFarmNight();
    animal.walking = false;
    if (animal.sleeping) continue;
    if (!animal.visitTarget && clock >= (animal.nextVisitWander || 0)) {
      const p = animal.visitPosition;
      const target = { x: p.x + (Math.random() - 0.5) * 100, y: p.y + (Math.random() - 0.5) * 70 };
      if (travelAnimalGround(animal, target.x, target.y)) animal.visitTarget = target;
      animal.nextVisitWander = clock + 4 + Math.random() * 5;
    }
    if (animal.visitTarget) {
      const p = animal.visitPosition,
        gap = distance(p, animal.visitTarget),
        step = Math.min(gap, dt * 22);
      const next = {
        x: p.x + ((animal.visitTarget.x - p.x) * step) / (gap || 1),
        y: p.y + ((animal.visitTarget.y - p.y) * step) / (gap || 1)
      };
      if (gap < 2 || !travelAnimalGround(animal, next.x, next.y)) animal.visitTarget = null;
      else {
        animal.walking = true;
        animal.walkFacing = next.x < p.x ? -1 : 1;
        animal.visitPosition = next;
        animal.stride = (animal.stride || 0) + step / 12;
      }
    }
  }
  const horse = animals[3];
  if (!riding && horse.visitScene === scene)
    places.horse = { ...horse.visitPosition, label: '骑上小马', icon: '🐴' };
  else if (!animalIsHere(horse) && places.horse)
    // 只隐藏按钮还不够，旧站位也不能继续触发靠近提示或 E 上马。
    places.horse = { x: -10000, y: -10000, label: '骑上小马', icon: '🐴' };
  canvas.dataset.animalTravel = animalTravel ? `${animalTravel.kind}:${animalTravel.mode}` : 'idle';
}

function releaseTravelAnimal() {
  if (!animalTravel) return true;
  const { animal, kind, mode } = animalTravel;
  if (mode === 'hold') {
    let landing = null;
    for (const [dx, dy] of [
      [65, 25],
      [-65, 25],
      [0, 65]
    ]) {
      if (travelAnimalGround(animal, player.x + dx, player.y + dy)) {
        landing = { x: player.x + dx, y: player.y + dy };
        break;
      }
    }
    if (!landing) {
      toast('旁边没有安全的落脚处，先走到宽一点的地方。');
      return false;
    }
    animal.visitPosition = landing;
  }
  animal.visitScene = scene;
  animal.nextVisitWander = clock + 4;
  animal.walking = false;
  const pushHeading = mode === 'push' ? { dx: animalTravel.dx, dy: animalTravel.dy } : null;
  animalTravel = null;
  if (pushHeading) {
    const behind = { x: player.x - pushHeading.dx * 65, y: player.y - pushHeading.dy * 35 };
    if (canWalk(behind.x, behind.y)) {
      player.x = behind.x;
      player.y = behind.y;
    }
  }
  toast(`${travelAnimalNames[kind]}留在这里散步，可以再带它回农场。`);
  rebuildGrid();
  if (!canWalk(player.x, player.y)) {
    const safe = nearestNode(player);
    player.x = safe.x;
    player.y = safe.y;
  }
  return true;
}

function drawHeldFarmAnimal() {
  if (animalTravel?.mode === 'push') {
    const { animal, dx, dy } = animalTravel;
    const x = player.x - dx * 65,
      y = player.y - dy * 35;
    ctx.save();
    ctx.strokeStyle = '#f3c4a0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 12, y - 70);
      ctx.lineTo(
        player.x - dx * animal.width * animal.growth * 0.3,
        player.y - animal.height * animal.growth * 0.65 + side * 5
      );
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (animalTravel?.mode !== 'hold') return;
  const animal = animalTravel.animal,
    p = animal.visitPosition,
    region = animalRegions[animal.cell];
  const width = animal.width * animal.growth * sceneScale(player.y);
  ctx.save();
  ctx.translate(p.x, p.y);
  drawAnimalWalk(animal, region, width, (width * region.height) / region.width);
  ctx.restore();
  ctx.strokeStyle = '#f3c4a0';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(player.x + side * 20, player.y - 80);
    ctx.lineTo(p.x + side * width * 0.28, p.y - 12);
    ctx.stroke();
  }
}

function moveTravelAnimalToScene() {
  animalTravelRequest = null;
  if (animalTravel) {
    if (animalTravel.mode === 'hold')
      animalTravel.started = Math.min(animalTravel.started, clock - 0.7);
    animalTravel.animal.visitScene = scene;
    animalTravel.animal.visitPosition = { x: player.x - 75, y: player.y };
    animalTravel.playerPosition = { ...player };
    updateAnimalTravel(0);
  }
  if (riding) {
    animals[3].visitScene = scene;
    animals[3].visitPosition = { ...player };
  }
}
