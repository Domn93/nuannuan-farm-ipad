// 秋千的重力、阻尼和操作；必须停稳后才能回到地面。

const swingRider = new Image();
swingRider.src = 'assets/swing.png';
const swing = { x: 1380, y: 278, length: 231, angle: 0, velocity: 0 };
let swingSession = null;

function sitOnSwing() {
  if (scene !== 'farm' || swingSession) return;
  if (riding) {
    toast('先下马，再坐秋千吧。');
    return;
  }
  if (carriedPet) clearPetCare(carriedPet);
  if (walkingDog) stopDogWalk(null);
  player.x = places.swing.x;
  player.y = places.swing.y;
  player.walking = false;
  route = [];
  pendingPlace = null;
  targetMarker = null;
  swing.angle = 0;
  swing.velocity = 0.12;
  swingSession = { stopping: false };
  busyUntil = Infinity;
  toast('坐好啦！按住空格或「用力荡」慢慢加速，E 停稳后下来。', 7);
}

function stopSwing() {
  if (!swingSession || swingSession.stopping) return;
  swingSession.stopping = true;
  keys.delete(' ');
  toast('暖暖收起双腿，等秋千慢慢停稳再下来。', 6);
}

function leaveSwing() {
  swingSession = null;
  swing.angle = 0;
  swing.velocity = 0;
  keys.delete(' ');
  busyUntil = 0;
  player.walking = false;
}

function updateSwing(dt) {
  const button = document.querySelector('#pump-swing');
  button.hidden = !swingSession;
  button.disabled = !!swingSession?.stopping;
  if (!swingSession) return;
  // Gravity and damping produce a real pendulum arc. Substeps stabilize slower frames.
  const steps = Math.max(1, Math.ceil(dt * 120)),
    h = dt / steps;
  const gravity = 4.2,
    maxEnergy = gravity * (1 - Math.cos(0.43));
  for (let i = 0; i < steps; i++) {
    const energy = swing.velocity ** 2 / 2 + gravity * (1 - Math.cos(swing.angle));
    const pumping = keys.has(' ') && !swingSession.stopping;
    const push = pumping
      ? Math.sign(swing.velocity || 1) * 0.46 * Math.max(0, 1 - energy / maxEnergy)
      : 0;
    swing.velocity +=
      (-gravity * Math.sin(swing.angle) -
        (swingSession.stopping ? 2.7 : 0.13) * swing.velocity +
        push) *
      h;
    swing.angle += swing.velocity * h;
  }
  if (swingSession.stopping && Math.abs(swing.angle) < 0.015 && Math.abs(swing.velocity) < 0.035) {
    leaveSwing();
    button.hidden = true;
    toast('秋千停稳了，暖暖回到草地上。');
  }
}

function drawSwing() {
  if (scene !== 'farm') return;
  const angle = swing.angle,
    seatX = swing.x + Math.sin(angle) * swing.length;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Join the attachment to the existing tree trunk, so the ropes have a fixed anchor.
  ctx.strokeStyle = '#705539';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(1464, 343);
  ctx.quadraticCurveTo(1424, 283, 1342, 274);
  ctx.stroke();
  ctx.strokeStyle = '#a58a58';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(1462, 337);
  ctx.quadraticCurveTo(1420, 278, 1345, 269);
  ctx.stroke();
  ctx.fillStyle = '#30472230';
  ctx.beginPath();
  ctx.ellipse(seatX, 553, 39 - Math.abs(angle) * 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(swing.x, swing.y);
  ctx.rotate(-angle);
  for (const x of [-38, 38]) {
    ctx.strokeStyle = '#665840';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, swing.length);
    ctx.stroke();
    ctx.strokeStyle = '#d2bd85';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(x - 1, 0);
    ctx.lineTo(x - 1, swing.length);
    ctx.stroke();
  }
  ctx.drawImage(fenceTexture, 365, 524, 85, 12, -46, swing.length - 5, 92, 12);
  if (swingSession) {
    ctx.drawImage(swingRider, -82.5, swing.length - 100, 165, 165);
  }
  ctx.restore();
  canvas.dataset.swing = swingSession ? (swingSession.stopping ? 'stopping' : 'swinging') : 'idle';
  canvas.dataset.swingAngle = angle.toFixed(3);
}
