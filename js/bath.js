// 暖暖洗澡的阶段和水声；水声也供洗手及宠物洗澡使用。

let bathSession = null,
  bathVoice = null;
indoorPlaces.bath = { x: 1180, y: 285, label: '去浴缸洗澡', icon: '🛁' };

function stopBathSound() {
  if (bathVoice) {
    const source = bathVoice;
    bathVoice = null;
    source.stop();
  }
}

function playBathSound() {
  if (!soundOn || !audio || bathVoice) return;
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate),
    samples = buffer.getChannelData(0);
  let soft = 0;
  for (let i = 0; i < samples.length; i++) {
    soft = 0.88 * soft + 0.12 * (Math.random() * 2 - 1);
    samples[i] = soft;
  }
  const source = audio.createBufferSource(),
    filter = audio.createBiquadFilter(),
    gain = audio.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  gain.gain.value = 0.25;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    if (bathVoice === source) bathVoice = null;
  };
  bathVoice = source;
  source.start();
}

function startBath() {
  if (scene !== 'house' || bathSession) return;
  if (carriedPet) clearPetCare(carriedPet);
  stopFarmVoices();
  route = [];
  pendingPlace = null;
  targetMarker = null;
  keys.clear();
  player.walking = false;
  bathSession = { started: clock, state: 'curtain', returnTo: { x: player.x, y: player.y } };
  busyUntil = clock + 10;
  toast('拉好浴帘，准备洗澡啦。');
}

function finishBath(completed = false) {
  if (!bathSession) return;
  const point = bathSession.returnTo;
  // 真正洗过澡的出口都先穿浴袍，包括按方向键或 Escape 提前出来。
  if (completed || clock - bathSession.started >= 2) wearBathrobe();
  bathSession = null;
  stopBathSound();
  busyUntil = 0;
  keys.clear();
  route = [];
  pendingPlace = null;
  player.x = point.x;
  player.y = point.y;
  player.walking = false;
  toast(
    completed
      ? '擦干穿好浴袍啦，去卧室衣柜挑衣服吧。'
      : outfit === 'robe'
        ? '水关好了，披好浴袍出来休息一下。'
        : '水关好了，先出来休息一下。'
  );
}

function wearBathrobe() {
  if (outfit === 'robe') return;
  outfit = 'robe';
  document.querySelectorAll('[data-outfit]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.outfit === outfit));
  });
}

function updateBath() {
  if (!bathSession) return;
  if (movementKeys.some((key) => keys.has(key))) {
    finishBath();
    return;
  }
  const elapsed = clock - bathSession.started;
  bathSession.state =
    elapsed < 0.8
      ? 'curtain'
      : elapsed < 2
        ? 'filling'
        : elapsed < 7
          ? 'washing'
          : elapsed < 8.2
            ? 'drying'
            : elapsed < 9.2
              ? 'dressing'
              : 'opening';
  // 换浴袍时浴帘仍完全关闭，开帘后才露出穿好浴袍的暖暖。
  if (elapsed >= 9.2) wearBathrobe();
  if (elapsed >= 0.8 && elapsed < 7 && soundOn) playBathSound();
  if (elapsed >= 7) stopBathSound();
  if (elapsed >= 10) finishBath(true);
}

function drawBath() {
  canvas.dataset.bath = bathSession?.state || 'idle';
  if (scene !== 'house' || !bathSession) return;
  const elapsed = clock - bathSession.started;
  const closure =
    elapsed < 0.8 ? elapsed / 0.8 : elapsed > 9.2 ? Math.max(0, (10 - elapsed) / 0.8) : 1;
  ctx.save();
  if (elapsed > 0.8 && elapsed < 7) {
    ctx.fillStyle = '#a4d6dc';
    ctx.beginPath();
    ctx.ellipse(1277, 228, 34, 72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8ffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(1277, 210 + i * 18, 18 + Math.sin(clock * 3 + i) * 7, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#8c9c91';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(1160, 116);
  ctx.lineTo(1370, 116);
  ctx.stroke();
  ctx.fillStyle = '#e8f1e7';
  ctx.strokeStyle = '#b1c4b4';
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const width = 105 * closure,
      x = i === 0 ? 1160 : 1370 - width;
    if (width > 0) drawPrivacyCurtain(x, 123, width, 217);
    for (let fold = 12; fold < width; fold += 17) {
      ctx.beginPath();
      ctx.moveTo(x + fold, 125);
      ctx.lineTo(x + fold, 338);
      ctx.stroke();
    }
  }
  if (closure > 0.75) {
    ctx.fillStyle = '#627d6d';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      {
        curtain: '拉好浴帘',
        filling: '放好温水…',
        washing: '洗澡中 🫧',
        drying: '擦干身体…',
        dressing: '穿好浴袍…',
        opening: '穿好浴袍啦'
      }[bathSession.state],
      1265,
      238
    );
  }
  if (elapsed > 1 && elapsed < 7) {
    ctx.fillStyle = '#f9ffffa0';
    for (let i = 0; i < 7; i++) {
      const t = (elapsed * 0.28 + i / 7) % 1;
      ctx.beginPath();
      ctx.ellipse(1200 + i * 23, 138 - t * 50, 6 + t * 8, 9 + t * 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
