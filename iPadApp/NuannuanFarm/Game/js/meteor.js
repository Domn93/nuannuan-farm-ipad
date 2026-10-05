// 流星只在适合观星的夜空出现；每次事件仅能许愿一次。
const meteor = {
  wait: 40 + Math.random() * 60,
  event: null,
  wish: null,
  placeMap: null
};

function meteorSkyIsClear() {
  return !['house', 'barn'].includes(scene) && !isBuildingInterior() && isFarmNight() && ['sunny', 'wind', 'cloudy'].includes(farmClimate.weather);
}

function clearMeteor() {
  if (meteor.placeMap) delete meteor.placeMap.wish;
  if (meteor.wish && busyUntil === meteor.wish.until) busyUntil = 0;
  meteor.event = null;
  meteor.wish = null;
  meteor.placeMap = null;
  canvas.dataset.meteor = 'quiet';
}

function meteorWishAvailable() {
  return !!(
    meteorSkyIsClear() &&
    meteor.event &&
    !meteor.event.wished &&
    clock < meteor.event.until &&
    clock >= busyUntil &&
    !riding &&
    !carriedPet &&
    !petCareRequest &&
    !animalTravel &&
    !animalTravelRequest &&
    !animalPetting &&
    !doorTransition &&
    !fishingSession &&
    !swingSession
  );
}

function updateMeteor(dt) {
  if (!meteorSkyIsClear()) {
    clearMeteor();
    return;
  }
  if (meteor.wish && clock >= meteor.wish.until) meteor.wish = null;
  if (meteor.event && clock >= meteor.event.until) meteor.event = null;
  if (!meteor.event) {
    meteor.wait -= dt;
    if (meteor.wait <= 0) {
      meteor.wait = 120 + Math.random() * 120;
      // 晴朗夜晚也可能没有流星，不能变成每晚固定的任务。
      if (Math.random() < 0.65) {
        meteor.event = {
          started: clock,
          until: clock + 12,
          x: 200 + Math.random() * 740,
          y: 45 + Math.random() * 65,
          wished: false
        };
        toast('看，流星！快许一个愿望吧。', 5);
      }
    }
  }
  if (meteorWishAvailable()) {
    meteor.placeMap = places;
    places.wish = { x: player.x, y: player.y, label: '对流星许愿', icon: '☆' };
  } else if (meteor.placeMap) {
    delete meteor.placeMap.wish;
    meteor.placeMap = null;
  }
  canvas.dataset.meteor = meteor.wish
    ? 'wishing'
    : meteor.event
      ? meteor.event.wished
        ? 'wished'
        : 'visible'
      : 'quiet';
}

function wishOnMeteor() {
  if (!meteorWishAvailable()) return;
  meteor.event.wished = true;
  meteor.wish = { started: clock, until: clock + 1.6 };
  route = [];
  pendingPlace = null;
  player.walking = false;
  player.view = 0;
  busyUntil = meteor.wish.until;
  if (meteor.placeMap) delete meteor.placeMap.wish;
  toast('希望小伙伴们每天都开心！', 5);
  canvas.dataset.meteor = 'wishing';
}

function drawMeteor() {
  if (!meteorSkyIsClear()) return;
  const event = meteor.event;
  if (event) {
    const progress = (clock - event.started) / 1.8;
    if (progress >= 0 && progress < 1) {
      const x = event.x + progress * 360,
        y = event.y + progress * 125,
        opacity = Math.sin(progress * Math.PI);
      ctx.save();
      const tail = ctx.createLinearGradient(x - 125, y - 43, x, y);
      tail.addColorStop(0, '#fffce600');
      tail.addColorStop(1, '#fffce6');
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = tail;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x - 125, y - 43);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = '#fffbe4';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (!meteor.wish) return;
  const elapsed = clock - meteor.wish.started,
    scale = sceneScale(player.y),
    size = 193 * scale,
    rise = Math.sin(Math.min(1, elapsed / 0.5) * Math.PI / 2),
    chest = player.y - size * 0.43;
  ctx.save();
  // 只补画身前的小手和星光，整个人仍由原来的步态贴图绘制一次。
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#f3c7a2';
  ctx.lineWidth = 6 * scale;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(player.x + side * 17 * scale, chest + 8 * scale);
    ctx.quadraticCurveTo(
      player.x + side * 12 * scale,
      chest + (10 - rise * 13) * scale,
      player.x + side * 2 * scale,
      chest - rise * 12 * scale
    );
    ctx.stroke();
  }
  ctx.fillStyle = '#fff2ac';
  ctx.font = `${14 * scale}px serif`;
  ctx.textAlign = 'center';
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + elapsed * 0.5;
    ctx.globalAlpha = Math.sin(Math.min(1, elapsed / 1.6) * Math.PI);
    ctx.fillText('✧', player.x + Math.cos(angle) * 40 * scale, chest - 38 * scale + Math.sin(angle) * 18 * scale);
  }
  ctx.restore();
}
