// 森林里的独立动物、捕虫和伐木。地面坐标与绘制锚点共用，避免贴图漂浮。
const forestWildlifeArt = new Image();
forestWildlifeArt.src = 'assets/forest-wildlife.png';
const forestWildlife = [
  { key: 'squirrel', x: 490, y: 550, width: 80, height: 88, cell: 0, label: '和小松鼠玩' },
  { key: 'rabbit', x: 770, y: 710, width: 85, height: 78, cell: 1, label: '轻轻摸摸小兔子' },
  { key: 'deer', x: 1100, y: 495, width: 155, height: 155, cell: 2, label: '和小鹿亲近一下' }
];
const forestTimber = { x: 1130, y: 730, readyAt: 0, fallingAt: -Infinity };
const forestButterfly = { x: 625, y: 535, readyAt: 0 };
let forestAdventureSession = null;

for (const animal of forestWildlife) {
  explorePlaces.forest[animal.key] = {
    x: animal.x - 55,
    y: animal.y + 30,
    label: animal.label,
    icon: '♡'
  };
}
// 网圈在右手上方，人物站位留出网柄长度，让网圈落到蝴蝶附近。
explorePlaces.forest.catchBug = { x: 560, y: 660, label: '用捕虫网捕虫', icon: '⌁' };
explorePlaces.forest.chopTree = { x: 1065, y: 765, label: '挥斧收集木材', icon: '♧' };

function clearForestAdventure() {
  if (forestAdventureSession && busyUntil === forestAdventureSession.endsAt) busyUntil = 0;
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
  toast(
    {
      catchBug: '慢慢靠近……挥一挥捕虫网！',
      chopTree: '站稳，挥斧……收集这一棵小树的木材。',
      squirrel: '小松鼠蹦过来，围着暖暖转了一小圈。',
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

function forestAnimalPose(animal) {
  const active = forestAdventureSession?.kind === animal.key;
  const t = active ? clock - forestAdventureSession.started : clock;
  return {
    x: animal.x + Math.sin(t * (active ? 2.6 : 0.48) + animal.cell) * (active ? 25 : 9),
    y: animal.y + Math.cos(t * 0.65 + animal.cell) * 4,
    hop: active && animal.key !== 'deer' ? Math.abs(Math.sin(t * 3.8)) * 12 : 0,
    tilt: Math.sin(t * (active ? 2 : 0.7)) * (animal.key === 'deer' ? 0.014 : 0.035)
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
function drawForestSprite(cell, x, y, width, height, angle = 0) {
  const region = forestWildlifeRegions[cell];
  if (!region || !forestWildlifeArt.complete || !forestWildlifeArt.naturalWidth) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
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
    drawForestSprite(
      animal.cell,
      pose.x,
      pose.y - pose.hop,
      animal.width,
      animal.height,
      pose.tilt
    );
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
