// 空调固定在客厅隔墙上；冷热只影响室内感受，阳台不享受制冷。
const homeAirConditioner = { on: false, vent: 0 };
const airConditionerLayout = { x: 688, y: 352, width: 132, height: 38 };
indoorPlaces.airConditioner = { x: 710, y: 475, label: '打开空调', icon: '❄' };

function homeAirTemperature() {
  if (scene !== 'house' || player.x >= 900) return 'outside';
  if (homeAirConditioner.on) return 'cool';
  return farmClimate.hotPeriod ? 'hot' : 'comfortable';
}

function interactAirConditioner(place) {
  if (place !== 'airConditioner' || scene !== 'house') return false;
  if (clock < busyUntil || distance(player, indoorPlaces.airConditioner) > 85) return true;
  route = [];
  pendingPlace = null;
  keys.clear();
  player.walking = false;
  homeAirConditioner.on = !homeAirConditioner.on;
  indoorPlaces.airConditioner.label = homeAirConditioner.on ? '关闭空调' : '打开空调';
  toast(homeAirConditioner.on ? '打开空调，客厅和卧室慢慢凉快起来啦。' : farmClimate.hotPeriod ? '空调关上了，夏天屋里也有点热。' : '空调关上了。');
  return true;
}

function updateAirConditioner(dt) {
  const target = homeAirConditioner.on ? 1 : 0;
  // 出风口缓慢打开，关机时收回；没有持续噪声或新的健康惩罚。
  homeAirConditioner.vent += Math.sign(target - homeAirConditioner.vent) *
    Math.min(Math.abs(target - homeAirConditioner.vent), Math.max(0, dt) * 1.8);
  canvas.dataset.airConditioner = homeAirConditioner.on ? 'on' : 'off';
  canvas.dataset.homeTemperature = homeAirTemperature();
}

function drawAirConditioner() {
  if (scene !== 'house') return;
  const { x, y, width, height } = airConditionerLayout;
  ctx.save();
  // 奶白机身与室内暖色画面一致；背板、机身和叶片各画一次。
  ctx.fillStyle = '#493c3033';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 4, width, height, 8);
  ctx.fill();
  const shell = ctx.createLinearGradient(x, y, x, y + height);
  shell.addColorStop(0, '#fffbed');
  shell.addColorStop(0.58, '#eee7d5');
  shell.addColorStop(1, '#d2c7ad');
  ctx.fillStyle = shell;
  ctx.strokeStyle = '#a99a7a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 7);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#fffdf0';
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 6);
  ctx.lineTo(x + width - 8, y + 6);
  ctx.stroke();
  ctx.fillStyle = '#b9aa8c';
  ctx.fillRect(x + 9, y + height - 10, width - 18, 2);
  const opening = homeAirConditioner.vent * 5;
  ctx.fillStyle = '#5a645a';
  ctx.fillRect(x + 12, y + height - 8, width - 24, opening);
  ctx.fillStyle = '#d7d3bc';
  ctx.fillRect(x + 12, y + height - 7 + opening, width - 24, 2);
  ctx.fillStyle = homeAirConditioner.on ? '#82b3a4' : '#b4ad98';
  ctx.beginPath();
  ctx.arc(x + width - 17, y + 17, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (homeAirConditioner.on) {
    ctx.fillStyle = '#536e66';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('24°', x + width - 27, y + 20);
  }
  ctx.restore();
}

function drawAirConditionerAir() {
  if (scene !== 'house' || homeAirConditioner.vent < 0.05) return;
  const { x, y, width, height } = airConditionerLayout;
  ctx.save();
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (let index = 0; index < 3; index++) {
    const phase = (clock * 0.6 + index / 3) % 1;
    ctx.strokeStyle = `rgba(182,218,215,${Math.sin(phase * Math.PI) * 0.24 * homeAirConditioner.vent})`;
    const windX = x + width * (0.25 + index * 0.25),
      windY = y + height + 6 + phase * 30;
    ctx.beginPath();
    ctx.moveTo(windX, windY);
    ctx.quadraticCurveTo(windX - 6, windY + 9, windX + 3, windY + 18);
    ctx.stroke();
  }
  ctx.restore();
}
