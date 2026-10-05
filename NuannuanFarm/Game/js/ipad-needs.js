// 只供 iPad 独立版使用。小肚子是饱腹度，数值越高越饱；干净度与现有脏污值相反。
const ipadHunger = { satiety: 80, stage: 0 };
const ipadFoodSatiety = { food: 60, bread: 35, fruit: 20, icecream: 10, slush: 5 };
let ipadNeedsDisplay = '';

function ipadHungerStage() {
  return ipadHunger.satiety <= 15 ? 2 : ipadHunger.satiety <= 35 ? 1 : 0;
}

function updateIPadNeeds(dt) {
  // 暂停由游戏帧统一控制；睡觉消耗更慢，快跑时肚子空得稍快一点。
  const resting = sleepSession || lateSleepSession;
  const rate = resting ? 0.035 : player.walking ? keys.has('Shift') ? 0.16 : 0.12 : 0.08;
  ipadHunger.satiety = Math.max(0, ipadHunger.satiety - Math.max(0, dt) * rate);
  const stage = ipadHungerStage();
  if (stage > ipadHunger.stage && !resting) {
    toast(stage === 2 ? '小肚子咕噜噜，找点好吃的吧！' : '肚子有点饿啦，背包里有好吃的吗？', 6);
  }
  ipadHunger.stage = stage;
  refreshIPadNeeds();
}

function satisfyIPadHunger(item) {
  const amount = ipadFoodSatiety[item];
  if (!amount) return;
  ipadHunger.satiety = Math.min(100, ipadHunger.satiety + amount);
  ipadHunger.stage = ipadHungerStage();
  refreshIPadNeeds();
}

function restoreIPadHunger(saved) {
  const value = saved?.satiety;
  // 旧存档没有小肚子：从正常饱腹度开始；坏值不能变成 NaN 或超出量表。
  ipadHunger.satiety = Number.isFinite(value) && value >= 0 && value <= 100 ? value : 80;
  ipadHunger.stage = ipadHungerStage();
}

function refreshIPadNeeds() {
  const belly = Math.round(ipadHunger.satiety);
  const clean = Math.round(100 - Math.max(0, Math.min(100, hygiene.dirt)));
  const bellyLabel = ipadHunger.satiety <= 15 ? '该吃饭啦' : ipadHunger.satiety <= 35
    ? '咕咕叫' : ipadHunger.satiety < 65 ? '还好呀' : '饱饱的';
  const cleanLabel = hygiene.dirt >= 75 ? '搓泡泡啦' : hygiene.dirt >= 35 ? '沾点泥' : '香香的';
  const display = [belly, clean, bellyLabel, cleanLabel].join('|');
  if (display === ipadNeedsDisplay) return;
  ipadNeedsDisplay = display;
  for (const [id, value, label, low] of [
    ['belly', belly, bellyLabel, ipadHunger.satiety <= 35],
    ['clean', clean, cleanLabel, hygiene.dirt >= 75]
  ]) {
    document.querySelector('#ipad-' + id + '-label').textContent = label;
    document.querySelector('#ipad-' + id + '-fill').style.width = value + '%';
    const meter = document.querySelector('#ipad-' + id + '-meter');
    meter.setAttribute('aria-valuenow', String(value));
    meter.setAttribute('aria-valuetext', label + '，' + value + '/100');
    document.querySelector('#ipad-' + id).classList.toggle('needs-care', low);
  }
  canvas.dataset.satiety = String(belly);
  canvas.dataset.cleanliness = String(clean);
}
