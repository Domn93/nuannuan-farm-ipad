// 使用马桶、冲水动画及音效；结束或换场景时清理声音。

let toiletSession = null,
  flushVoice = null;
const toiletNeed = {
  started: null, wetClothes: false, nextAt: 60
};

function scheduleMorningToiletNeed() {
  if (toiletNeed.started === null && !toiletNeed.wetClothes)
    toiletNeed.nextAt = clock + 60;
}

function useToilet() {
  if (scene !== 'house' || toiletSession) return;
  route = [];
  pendingPlace = null;
  targetMarker = null;
  player.x = places.toilet.x;
  player.y = places.toilet.y;
  player.walking = false;
  toiletSession = { started: clock, flushing: false };
  toiletNeed.started = null;
  toiletNeed.nextAt = clock + 360 + Math.random() * 180;
  busyUntil = clock + 5.8;
  toast(toiletNeed.wetClothes
    ? '暖暖正在使用马桶。之后还要回衣柜换上干净衣服。'
    : '暖暖正在使用马桶，稍等一会儿。', 4);
}

function stopFlushSound() {
  if (!flushVoice) return;
  const source = flushVoice;
  flushVoice = null;
  source.stop();
}

function playFlushSound() {
  if (!soundOn || !audio) return;
  stopFlushSound();
  const duration = 3.8,
    buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let low = 0;
  // Rushing water gives way to slower, irregular gulps as the bowl empties.
  for (let i = 0; i < samples.length; i++) {
    const t = i / audio.sampleRate,
      noise = Math.random() * 2 - 1;
    low = (low + 0.035 * noise) / 1.035;
    const gulp = t > 1.4 ? 0.55 + 0.45 * Math.sin(t * 16 + Math.sin(t * 4)) : 1;
    samples[i] = (noise * 0.2 + low * 3) * gulp;
  }
  const source = audio.createBufferSource(),
    filter = audio.createBiquadFilter(),
    gain = audio.createGain();
  source.buffer = buffer;
  filter.type = 'lowpass';
  const now = audio.currentTime;
  filter.frequency.setValueAtTime(1800, now);
  filter.frequency.exponentialRampToValueAtTime(280, now + duration);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.55, now + 0.25);
  gain.gain.setValueAtTime(0.55, now + 1);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    gain.disconnect();
    if (flushVoice === source) flushVoice = null;
  };
  flushVoice = source;
  source.start(now);
  source.stop(now + duration);
}

function updateToilet(dt) {
  if (toiletNeed.started !== null && (nuannuanHealth.treatment || heatRescue))
    toiletNeed.started += dt;
  if (toiletNeed.started === null && !toiletNeed.wetClothes && !toiletSession &&
      clock >= toiletNeed.nextAt && !sleepSession && !lateSleepSession &&
      !nuannuanHealth.treatment && !bathSession && !doorTransition &&
      ['farm', 'house', 'barn'].includes(scene)) {
    toiletNeed.started = clock;
    route = [];
    pendingPlace = null;
    targetMarker = null;
    player.walking = false;
    toast('暖暖想上厕所了，脸都红了！请你控制她回家走到马桶旁，60 秒内到达。', 8);
  }
  if (toiletNeed.started !== null && clock - toiletNeed.started >= 60) {
    toiletNeed.started = null;
    toiletNeed.wetClothes = true;
    toast('没能及时到厕所，衣服弄湿了。回家打开衣柜，换一套干净衣服吧。', 8);
  }
  const status = document.querySelector('#toilet-status');
  status.hidden = toiletNeed.started === null && !toiletNeed.wetClothes;
  status.textContent = toiletNeed.wetClothes
    ? '👗 衣服弄湿了 · 回衣柜换衣服'
    : toiletNeed.started !== null ? `🚻 想上厕所 · 还剩 ${Math.max(0, Math.ceil(60 - (clock - toiletNeed.started)))} 秒` : '';
  canvas.dataset.toiletNeed = toiletNeed.wetClothes ? 'change-clothes'
    : toiletNeed.started !== null ? 'urgent' : 'well';
  if (!toiletSession) return;
  const elapsed = clock - toiletSession.started;
  if (!toiletSession.flushing && elapsed >= 2) {
    toiletSession.flushing = true;
    // 用完先站到马桶旁，再按冲水，不能让身体留在水面上。
    player.x = 1006;
    player.y = 260;
    player.view = 1;
    player.facing = -1;
    toast('用好了，按下冲水按钮，哗啦啦…', 4);
    playFlushSound();
  }
  if (elapsed >= 5.8) {
    toiletSession = null;
    busyUntil = 0;
    toast('冲干净啦，记得去洗洗手 🫧');
  }
}

function drawToilet(front = true) {
  canvas.dataset.toilet = toiletSession ? (toiletSession.flushing ? 'flushing' : 'using') : 'idle';
  if (scene !== 'house' || !toiletSession?.flushing || front) return;
  // 冲水仍画在人物身后，使用马桶时不再凭空出现帘子。
  ctx.save();
  const elapsed = clock - toiletSession.started - 2;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(953, 151, 17, 10, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#b9e1e4';
  ctx.beginPath();
  ctx.ellipse(951, 151, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2ffff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const phase = (elapsed * 0.75 + i / 3) % 1;
    ctx.beginPath();
    ctx.ellipse(951, 151, 4 + phase * 14, 2 + phase * 8, elapsed * 3, 0, Math.PI * 1.5);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#708c84';
  ctx.fillRect(951, 102 + Math.min(elapsed / 0.2, 1) * 2, 7, 3);
  ctx.restore();
}
