// 森林里的独立动物、捕虫和伐木。地面坐标与绘制锚点共用，避免贴图漂浮。
const forestWildlifeArt = new Image();
forestWildlifeArt.src = 'assets/forest-wildlife.png';
const wildlifeGaitArt = new Image();
wildlifeGaitArt.src = 'assets/wildlife-gait.png';
const wildlifeGaitRegions = [
  [[67, 41, 282, 286], [445, 36, 292, 289], [807, 39, 297, 286], [1188, 43, 308, 282]],
  [[80, 360, 272, 267], [417, 356, 316, 270], [812, 358, 289, 270], [1192, 359, 300, 269]],
  [[35, 636, 332, 341], [402, 637, 361, 339], [789, 640, 360, 337], [1159, 640, 363, 338]]
];
const forestWildlife = [
  { key: 'squirrel', x: 490, y: 550, width: 80, height: 88, cell: 0, label: '和小松鼠玩' },
  { key: 'rabbit', x: 770, y: 710, width: 85, height: 78, cell: 1, label: '轻轻摸摸小兔子' },
  { key: 'deer', x: 1100, y: 495, width: 155, height: 155, cell: 2, label: '和小鹿亲近一下' }
];
const forestTimber = { x: 1130, y: 730, readyAt: 0, fallingAt: -Infinity };
const forestButterfly = { x: 625, y: 535, readyAt: 0 };
let forestAdventureSession = null;

function forestAnimalMeetingPoint(animal) {
  return { x: animal.x - animal.width * 0.5 - 55, y: animal.y + 30 };
}

for (const animal of forestWildlife) {
  const point = forestAnimalMeetingPoint(animal);
  explorePlaces.forest[animal.key] = {
    x: point.x,
    y: point.y,
    label: animal.label,
    icon: '♡'
  };
}
// 网圈在右手上方，人物站位留出网柄长度，让网圈落到蝴蝶附近。
explorePlaces.forest.catchBug = { x: 560, y: 660, label: '用捕虫网捕虫', icon: '⌁' };
explorePlaces.forest.chopTree = { x: 1065, y: 765, label: '挥斧收集木材', icon: '♧' };

function clearForestAdventure() {
  if (forestAdventureSession && busyUntil === forestAdventureSession.endsAt) busyUntil = 0;
  const animal = forestWildlife.find((candidate) => candidate.key === forestAdventureSession?.kind);
  if (animal) {
    animal.meetingTarget = null;
    animal.nextMoveAt = clock + 4;
  }
  forestAdventureSession = null;
}

function interactForestAdventure(place) {
  if (
    scene !== 'forest' ||
    !['catchBug', 'chopTree', ...forestWildlife.map((a) => a.key)].includes(place)
  )
    return false;
  if (riding || carriedPet || animalTravel) {
    toast('先下马、放下怀里的小伙伴，再来玩吧。');
    return true;
  }
  if (place === 'catchBug' && clock < forestButterfly.readyAt) {
    toast('小虫子躲起来啦，过一会儿再看看。');
    return true;
  }
  if (place === 'chopTree' && clock < forestTimber.readyAt) {
    toast('这里已经收集过木材了，先让小树慢慢长大。');
    return true;
  }
  const point = explorePlaces.forest[place];
  player.x = point.x;
  player.y = point.y;
  player.view = 1;
  player.facing = 1;
  player.walking = false;
  route = [];
  pendingPlace = null;
  const duration = place === 'chopTree' ? 3.6 : place === 'catchBug' ? 3 : 4;
  busyUntil = clock + duration;
  forestAdventureSession = { kind: place, started: clock, endsAt: busyUntil, duration };
  const animal = forestWildlife.find((candidate) => candidate.key === place);
  if (animal) {
    const dx = player.x - animal.x, dy = player.y - animal.y;
    const gap = Math.hypot(dx, dy);
    const approach = Math.max(0, gap - animal.width * 0.4 - 35);
    animal.meetingTarget = {
      x: animal.x + dx / gap * approach,
      y: animal.y + dy / gap * approach
    };
  }
  toast(
    {
      catchBug: '慢慢靠近……挥一挥捕虫网！',
      chopTree: '站稳，挥斧……收集这一棵小树的木材。',
      squirrel: '小松鼠蹦过来，在暖暖身边停下来。',
      rabbit: '小兔子动动耳朵，轻轻跳到暖暖身边。',
      deer: '小鹿慢慢靠近，低下头让暖暖摸摸。'
    }[place]
  );
  return true;
}

function updateForestAdventure(dt) {
  if (scene !== 'forest') {
    clearForestAdventure();
    return;
  }
  for (const animal of forestWildlife) {
    animal.moving = false;
    if (forestAdventureSession?.kind === animal.key) {
      animal.target = null;
      if (animal.meetingTarget) moveForestAnimal(animal, animal.meetingTarget, dt);
      const point = forestAnimalMeetingPoint(animal);
      explorePlaces.forest[animal.key].x = point.x;
      explorePlaces.forest[animal.key].y = point.y;
      continue;
    }
    if (pendingPlace === animal.key) {
      animal.target = null;
      continue;
    }
    if (!animal.target && clock >= (animal.nextMoveAt || 0)) {
      const range = animal.key === 'squirrel' ? [320, 650, 365, 750] :
        animal.key === 'rabbit' ? [620, 1030, 365, 790] : [900, 1260, 355, 705];
      for (let attempt = 0; attempt < 20; attempt++) {
        const point = {
          x: range[0] + Math.random() * (range[1] - range[0]),
          y: range[2] + Math.random() * (range[3] - range[2])
        };
        const travel = Math.hypot(point.x - animal.x, point.y - animal.y);
        if (onForestFloor(point.x, point.y) &&
            travel > 35 && travel < (animal.key === 'deer' ? 105 : 145) &&
            Math.hypot(point.x - player.x, point.y - player.y) > animal.width * 0.4 + 25 &&
            Math.hypot(point.x - forestTimber.x, point.y - forestTimber.y) > 100 &&
            forestWildlife.every((other) => other === animal || Math.hypot(point.x - other.x, point.y - other.y) > 100)) {
          animal.target = point;
          break;
        }
      }
      if (!animal.target) animal.nextMoveAt = clock + 3;
    }
    if (animal.target) {
      const gap = Math.hypot(animal.target.x - animal.x, animal.target.y - animal.y);
      if (gap < 2) {
        animal.target = null;
        animal.nextMoveAt = clock + (animal.key === 'deer' ? 6 : 3) + Math.random() * 4;
      } else {
        if (!moveForestAnimal(animal, animal.target, dt)) {
          animal.target = null;
          animal.nextMoveAt = clock + 3 + Math.random() * 3;
        }
      }
    }
    const point = forestAnimalMeetingPoint(animal);
    const marker = explorePlaces.forest[animal.key];
    marker.x = point.x;
    marker.y = point.y;
  }
  const session = forestAdventureSession;
  if (!session) return;
  // 移动键可打断，只有动作完整完成后才记入背包，不能连点重复领物品。
  if (
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'Escape'].some((key) =>
      keys.has(key)
    )
  ) {
    clearForestAdventure();
    return;
  }
  if (clock < session.endsAt) return;
  if (session.kind === 'catchBug') {
    pocket.insects++;
    recordDiscovery('insect');
    forestButterfly.readyAt = clock + 45;
    toast('捕到一只小蝴蝶，已经放进背包啦！');
  } else if (session.kind === 'chopTree') {
    pocket.wood += 3;
    forestTimber.readyAt = clock + 240;
    forestTimber.fallingAt = clock;
    toast('小树倒下，收集到三块木材。树桩会慢慢长出新芽。');
  } else {
    pocket.hearts++;
    toast('小动物记住暖暖啦，亲近了一点点。');
  }
  refreshBackpack();
  clearForestAdventure();
}

function moveForestAnimal(animal, target, dt) {
  const dx = target.x - animal.x, dy = target.y - animal.y;
  const gap = Math.hypot(dx, dy);
  if (gap < 1) return true;
  const speed = animal.key === 'rabbit' ? 36 : animal.key === 'squirrel' ? 30 : 22;
  const step = Math.min(gap, dt * speed);
  const nextX = animal.x + dx / gap * step, nextY = animal.y + dy / gap * step;
  if (!onForestFloor(nextX, nextY) ||
      Math.hypot(nextX - player.x, nextY - player.y) < animal.width * 0.4 + 25 ||
      forestWildlife.some((other) => other !== animal &&
        Math.hypot(nextX - other.x, nextY - other.y) < (animal.width + other.width) * 0.3))
    return false;
  // 鹿原图朝左，其他原图朝右；步态图集的朝向由绘制函数独立处理。
  if (Math.abs(nextX - animal.x) > 0.05) {
    animal.walkFacing = nextX < animal.x ? -1 : 1;
    animal.facing = animal.walkFacing * (animal.key === 'deer' ? -1 : 1);
  }
  animal.x = nextX;
  animal.y = nextY;
  animal.moving = step > 0;
  animal.stride = (animal.stride || 0) + step / (animal.key === 'deer' ? 16 : 10);
  return true;
}

function forestAnimalPose(animal) {
  const active = forestAdventureSession?.kind === animal.key;
  const t = active ? clock - forestAdventureSession.started : clock;
  const approach = active ? Math.min(1, t / 1.6) : 0;
  const deerStep = animal.key === 'deer' && animal.moving
    ? Math.abs(Math.sin((animal.stride || 0) * Math.PI)) : 0;
  return {
    x: animal.x,
    y: animal.y,
    hop: animal.key === 'deer' ? deerStep * 2.5 : animal.moving
      ? Math.abs(Math.sin((animal.stride || 0) * Math.PI)) * 5 : 0,
    tilt: animal.key === 'deer' && active ? -0.045 * approach :
      Math.sin(t * (active ? 2 : 0.7)) * (animal.key === 'deer' ? 0.014 : 0.035)
  };
}

// 具体透明边界在生成素材后测量；每个裁切矩形只包含一张动物或道具。
const forestWildlifeRegions = [
  { x: 74, y: 48, width: 394, height: 455 },
  { x: 581, y: 89, width: 361, height: 417 },
  { x: 1056, y: 17, width: 415, height: 544 },
  { x: 22, y: 507, width: 476, height: 502 },
  { x: 510, y: 625, width: 540, height: 340 },
  { x: 1052, y: 604, width: 464, height: 341 }
];
function drawForestSprite(cell, x, y, width, height, angle = 0, facing = 1) {
  const region = forestWildlifeRegions[cell];
  if (!region || !forestWildlifeArt.complete || !forestWildlifeArt.naturalWidth) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(facing, 1);
  ctx.drawImage(
    forestWildlifeArt,
    region.x,
    region.y,
    region.width,
    region.height,
    -width / 2,
    -height,
    width,
    height
  );
  ctx.restore();
}

function drawForestAdventure(front) {
  if (scene !== 'forest') return;
  for (const animal of forestWildlife) {
    const pose = forestAnimalPose(animal);
    if (pose.y > player.y !== front) continue;
    ctx.save();
    ctx.fillStyle = '#344d2728';
    ctx.beginPath();
    ctx.ellipse(pose.x, pose.y - 2, animal.width * 0.33, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (animal.moving && wildlifeGaitArt.complete && wildlifeGaitArt.naturalWidth) {
      const frame = Math.floor((animal.stride || 0) * 2) % 4;
      const [x, y, width, height] = wildlifeGaitRegions[animal.cell][frame];
      ctx.save();
      ctx.translate(pose.x, pose.y - pose.hop);
      ctx.rotate(pose.tilt);
      ctx.scale(animal.walkFacing || 1, 1);
      ctx.drawImage(wildlifeGaitArt, x, y, width, height,
        -animal.width / 2, -animal.height, animal.width, animal.height);
      ctx.restore();
    } else {
      drawForestSprite(
        animal.cell,
        pose.x,
        pose.y - pose.hop,
        animal.width,
        animal.height,
        pose.tilt,
        animal.facing || 1
      );
    }
  }
  if (forestTimber.y > player.y === front) {
    const felled = clock < forestTimber.readyAt;
    if (!felled) {
      const chopping = forestAdventureSession?.kind === 'chopTree';
      drawForestSprite(
        3,
        forestTimber.x,
        forestTimber.y,
        180,
        250,
        chopping ? Math.sin(clock * 18) * 0.018 : 0
      );
    } else {
      const fall = (clock - forestTimber.fallingAt) / 1.1;
      if (fall < 1) {
        drawForestSprite(3, forestTimber.x, forestTimber.y, 180, 250, Math.max(0, fall) * 0.95);
      } else drawForestSprite(4, forestTimber.x, forestTimber.y, 125, 70);
    }
  }
  if (!front && clock >= forestButterfly.readyAt) {
    const x = forestButterfly.x + Math.sin(clock * 0.8) * 22;
    const y = forestButterfly.y + Math.cos(clock * 1.1) * 12;
    drawForestSprite(5, x, y, 30 + Math.abs(Math.sin(clock * 9)) * 12, 30);
  }
}

function drawForestAction() {
  const session = forestAdventureSession;
  if (scene !== 'forest' || !session) return;
  const t = clock - session.started;
  const scale = sceneScale(player.y);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.scale(scale, scale);
  const reach = session.kind === 'chopTree' ? Math.sin(t * 7) : Math.sin(t * 3);
  // 短手臂从侧身肩部出发，不用长线跨越地图，也不绘制第二个人物。
  ctx.strokeStyle = '#efb995';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14, -95);
  ctx.lineTo(28, -84);
  ctx.lineTo(42, -92 + reach * 8);
  ctx.stroke();
  ctx.translate(42, -92 + reach * 8);
  if (session.kind === 'catchBug') {
    ctx.rotate(-0.4 + reach * 0.55);
    ctx.strokeStyle = '#8c613d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(18, -28);
    ctx.stroke();
    ctx.strokeStyle = '#d9e9cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(26, -41, 18, 14, -0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e2eed43d';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(11, -34);
    ctx.lineTo(14, -15);
    ctx.lineTo(36, -33);
    ctx.stroke();
  } else if (session.kind === 'chopTree') {
    ctx.rotate(-0.8 + reach * 0.85);
    ctx.strokeStyle = '#8a603e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 7);
    ctx.lineTo(5, -28);
    ctx.stroke();
    ctx.fillStyle = '#aebbb4';
    ctx.beginPath();
    ctx.moveTo(2, -30);
    ctx.lineTo(21, -33);
    ctx.lineTo(24, -18);
    ctx.lineTo(3, -20);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
