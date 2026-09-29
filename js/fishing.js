// 钓鱼状态流程：抛竿、等待、咬钩、提竿、收线和结束。

let fishingSession = null;
const catchSizes = [
  { label: '小鱼', scale: 0.55, message: '钓到一条小鱼，小小的也很可爱！🐟' },
  { label: '中等大小的鱼', scale: 0.78, message: '钓到一条鱼，大小刚刚好！🐟' },
  { label: '大鱼', scale: 1, message: '钓到一条大鱼！好大一条呀 🐟' }
];
const catchSpecies = [
  { name: '鲫鱼', cell: 0 },
  { name: '鲤鱼', cell: 1 },
  { name: '鲈鱼', cell: 2 },
  { name: '草鱼', cell: 3 },
  { name: '虹鳟', cell: null }
];
const caughtSpecies = new Set();
let lastCaughtFish = { ...catchSizes[1], species: catchSpecies[0] };

function chooseCatchSize() {
  const roll = Math.random();
  return catchSizes[roll < 0.3 ? 0 : roll < 0.75 ? 1 : 2];
}
const fishingPose = new Image(),
  trout = new Image(),
  fishAtlas = new Image();
fishingPose.src = 'assets/fishing-pose.png';
trout.src = 'assets/trout.png';
fishAtlas.src = 'assets/fish-species.png';

function chooseCatch() {
  return {
    ...chooseCatchSize(),
    species: catchSpecies[Math.floor(Math.random() * catchSpecies.length)]
  };
}

// 同一条鱼在水中、上岸和收藏弹窗共用鱼种与大小，不重新抽取外观。
function drawCaughtFish(context, fish, x, y, width, height) {
  if (fish.species.cell === null) {
    context.drawImage(trout, x, y, width, height);
    return;
  }
  const cw = fishAtlas.naturalWidth / 2,
    ch = fishAtlas.naturalHeight / 2,
    cell = fish.species.cell;
  context.drawImage(fishAtlas, (cell % 2) * cw, Math.floor(cell / 2) * ch,
    cw, ch, x, y, width, height);
}

function startFishing() {
  const wait = 4 + Math.random() * 4;
  fishingSession = {
    state: 'casting',
    fish: chooseCatch(),
    started: clock,
    biteAt: clock + 1.1 + wait,
    nibbles: [clock + 1.1 + wait * 0.3, clock + 1.1 + wait * 0.65, clock + 1.1 + wait * 0.87],
    progress: 0,
    tension: 0.22,
    pullUntil: 0,
    fightPhase: Math.random() * Math.PI * 2
  };
  busyUntil = Infinity;
  player.view = 1;
  player.facing = 1;
  player.walking = false;
  catchUntil = -Infinity;
  toast('暖暖抛出鱼饵…等浮漂真的沉下去，再按 E 提竿。', 7);
}

function cancelFishing(message = '收起鱼竿，先去走走吧。') {
  if (!fishingSession) return;
  fishingSession = null;
  busyUntil = 0;
  keys.delete('e');
  toast(message);
}

function fishingInput() {
  const session = fishingSession;
  if (!session) return;
  if (session.state === 'biting') {
    if (clock > session.biteAt + 4.2) {
      missFish('鱼已经松口啦，重新抛竿试试。');
      return;
    }
    session.state = 'hooking';
    session.started = clock;
    toast('钩住了！按住 E 或收线按钮，拉力变红时松开。', 6);
    playNote(330, 0, 0.15);
  } else if (session.state === 'reeling') session.pullUntil = clock + 0.3;
  else if (session.state === 'waiting') missFish('提竿太早，鱼还没咬稳。重新抛竿试试。');
}

function missFish(message) {
  if (!fishingSession || fishingSession.state === 'escaped') return;
  fishingSession.state = 'escaped';
  fishingSession.started = clock;
  toast(message, 5);
}

function updateFishing(dt) {
  const session = fishingSession;
  if (!session) return;
  const elapsed = clock - session.started;
  switch (session.state) {
    case 'casting':
      if (elapsed >= 1.1) {
        session.state = 'waiting';
        session.started = clock;
      }
      break;
    case 'waiting':
      if (clock >= session.biteAt) {
        session.state = 'biting';
        session.started = clock;
        toast('浮漂沉下去了！现在按 E 提竿！', 4.2);
        playNote(392, 0, 0.12);
        playNote(523, 0.14, 0.12);
      }
      break;
    case 'biting':
      if (clock > session.biteAt + 4.2) missFish('鱼吃完鱼饵游走了，下次看到漂沉下去就提竿。');
      break;
    case 'hooking':
      if (elapsed >= 0.65) {
        session.state = 'reeling';
        session.started = clock;
      }
      break;
    case 'reeling': {
      const pulling = keys.has('e') || clock < session.pullUntil;
      const struggle = 0.5 + 0.5 * Math.sin(clock * 2.7 + session.fightPhase);
      session.tension = Math.max(
        0.08,
        session.tension + (pulling ? 0.065 + struggle * 0.065 : -0.2) * dt
      );
      session.progress = Math.max(0, session.progress + (pulling ? 0.2 : -0.012) * dt);
      if (session.tension >= 1) missFish('线绷得太紧，鱼挣脱了。下次拉力变红就松开一下。');
      else if (elapsed > 45) missFish('鱼儿挣脱了，重新抛竿吧。');
      else if (session.progress >= 1) {
        session.state = 'landing';
        session.started = clock;
        keys.delete('e');
      }
      break;
    }
    case 'landing':
      if (elapsed >= 1.4) {
        fishingSession = null;
        busyUntil = 0;
        finishInteraction('pond', session.fish);
      }
      break;
    case 'escaped':
      if (elapsed >= 1.3) {
        fishingSession = null;
        busyUntil = 0;
        keys.delete('e');
      }
      break;
  }
}

function fishingLabel() {
  return {
    casting: '正在抛竿…',
    waiting: '等漂下沉再提竿',
    biting: '提竿！',
    hooking: '钩住了！',
    reeling: '按住收线 · 红色时松开',
    landing: '把鱼拉出水面…',
    escaped: '收回鱼线…'
  }[fishingSession.state];
}

function drawFishingGear() {
  const session = fishingSession;
  if (!session) return;
  const elapsed = clock - session.started;
  const casting = session.state === 'casting',
    pulling = session.state === 'hooking' || session.state === 'reeling';
  const height = 193 * (0.82 + ((player.y - 441) / 539) * 0.42);
  const grip = {
    casting: [-0.1, -0.77],
    waiting: [0.145, -0.48],
    biting: [0.145, -0.48],
    hooking: [0.37, -0.84],
    reeling: [0.145, -0.7],
    landing: [0.37, -0.84],
    escaped: [0.145, -0.48]
  }[session.state];
  const hand = { x: player.x + height * grip[0], y: player.y + height * grip[1] };
  const castProgress = casting ? Math.min(1, elapsed / 1.1) : 1;
  const lift = session.state === 'hooking' ? 35 * Math.min(1, elapsed / 0.65) : 0;
  const tip = {
    x: hand.x + 145 * castProgress,
    y: hand.y - 100 - lift + (pulling ? Math.sin(clock * 6) * 5 : 0)
  };
  const fishX = Math.min(W - 120, player.x + 125 + (1 - session.progress) * 80);
  let waterY = player.y + 100 + (1 - session.progress) * 30;
  let dip = Math.sin(clock * 2) * 2;
  if (session.state === 'waiting')
    for (const time of session.nibbles) {
      const age = clock - time;
      if (age >= 0 && age < 0.85) dip += Math.sin((age / 0.85) * Math.PI) * 7;
    }
  if (session.state === 'biting') dip = 15 + Math.sin(clock * 12) * 4;
  const floatX = casting
    ? tip.x + (fishX - tip.x) * castProgress
    : fishX + (pulling ? Math.sin(clock * 4) * 7 : Math.sin(clock * 0.6) * 2);
  const floatY = casting
    ? tip.y + (waterY - tip.y) * castProgress - 90 * Math.sin(castProgress * Math.PI)
    : waterY + dip;
  const lineEnd = { x: floatX, y: floatY };
  if (session.state === 'landing') {
    const p = Math.min(1, elapsed / 1.4);
    lineEnd.x = fishX + (player.x + 65 - fishX) * p;
    lineEnd.y = waterY + (player.y - 145 - waterY) * p - 80 * Math.sin(p * Math.PI);
  }
  ctx.save();
  ctx.strokeStyle = '#6b5234';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hand.x, hand.y);
  ctx.quadraticCurveTo(
    hand.x + 70,
    hand.y - 92 + (pulling ? session.tension * 30 : 0),
    tip.x,
    tip.y
  );
  ctx.stroke();
  ctx.save();
  ctx.translate(hand.x + 6, hand.y + 6);
  const winding = session.state === 'reeling' && (keys.has('e') || clock < session.pullUntil);
  ctx.rotate(winding ? clock * 13 : 0);
  ctx.strokeStyle = '#5c665c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.moveTo(-7, 0);
  ctx.lineTo(7, 0);
  ctx.moveTo(0, -7);
  ctx.lineTo(0, 7);
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#eee9ce';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.quadraticCurveTo(
    (tip.x + lineEnd.x) / 2,
    (tip.y + lineEnd.y) / 2 + (pulling ? 7 : 35),
    lineEnd.x,
    lineEnd.y
  );
  ctx.stroke();
  if (!casting && session.state !== 'landing') {
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.7 + i / 3) % 1;
      ctx.strokeStyle = `rgba(230,252,255,${(1 - phase) * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(floatX, waterY + 5, 7 + phase * 32, 2 + phase * 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (pulling || session.state === 'landing') {
    const underWater = session.state !== 'landing';
    ctx.save();
    ctx.globalAlpha = underWater ? 0.43 : 1;
    ctx.translate(lineEnd.x, lineEnd.y + (underWater ? 14 : 0));
    ctx.rotate(Math.sin(clock * 8) * 0.22);
    // 本次鱼的大小从抛竿起固定，水中挣扎和上岸展示保持一致。
    ctx.scale(session.fish.scale, session.fish.scale);
    drawCaughtFish(ctx, session.fish, -96, -48, 192, 128);
    ctx.restore();
  } else {
    ctx.fillStyle = '#d36447';
    ctx.beginPath();
    ctx.ellipse(floatX, floatY - 9, 4, 11, 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f7f1d8';
    ctx.fillRect(floatX - 3, floatY - 6, 6, 6);
  }
  ctx.restore();
  const panelX = player.x - 145,
    panelY = player.y + 46;
  ctx.fillStyle = '#fffbedec';
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, 290, session.state === 'reeling' ? 84 : 42, 14);
  ctx.fill();
  ctx.fillStyle = '#5f7057';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(fishingLabel(), player.x, panelY + 26);
  if (session.state === 'reeling') {
    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    ctx.fillText('收线', panelX + 15, panelY + 50);
    ctx.fillText('拉力', panelX + 15, panelY + 71);
    for (const [value, y, color] of [
      [session.progress, panelY + 40, '#789b65'],
      [session.tension, panelY + 61, session.tension > 0.78 ? '#d56e51' : '#d4b56d']
    ]) {
      ctx.fillStyle = '#e1e5d8';
      ctx.fillRect(panelX + 51, y, 222, 9);
      ctx.fillStyle = color;
      ctx.fillRect(panelX + 51, y, 222 * Math.min(1, value), 9);
    }
  }
}
