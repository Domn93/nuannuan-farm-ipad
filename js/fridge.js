// 冰箱只转移现有库存；背包按批次记录取出/获得日期，冷冻库存不计保鲜时间。
const fridgeArt = new Image();
fridgeArt.src = 'assets/fridge.png';
const fridgeLayout = { x: 296, y: 622, width: 100, height: 87.38 };
// 两帧柜体同一左上锚点、同一像素缩放；打开帧多出来的是门，不能各自拉成同宽。
const fridgeRegions = {
  closed: { x: 179, y: 114, width: 507, height: 621 },
  open: { x: 921, y: 114, width: 753, height: 658 }
};
const fridge = {
  open: false, progress: 0, target: 0, contents: '',
  stock: { icecream: 4, slush: 3, meat: 3, fish: 2, food: 0, mushrooms: 0 }
};
const chilledItems = {
  icecream: { name: '冰淇淋', icon: '🍨', days: 1 },
  slush: { name: '冰沙', icon: '🍧', days: 1 },
  meat: { name: '冷冻肉', icon: '🥩', days: 3 },
  fish: { name: '鱼', icon: '🐟', days: 3 },
  food: { name: '食物', icon: '🥐', days: 3 },
  mushrooms: { name: '蘑菇', icon: '🍄', days: 3 }
};
const bagFoodBatches = Object.fromEntries(Object.keys(chilledItems).map(key => [key, []]));
indoorPlaces.fridge = { x: 410, y: 689, label: '打开厨房冰箱', icon: '❄' };

function synchronizeBagFood() {
  for (const [key, batches] of Object.entries(bagFoodBatches)) {
    const counted = batches.reduce((total, batch) => total + batch.amount, 0);
    const difference = pocket[key] - counted;
    if (difference > 0) batches.push({ amount: difference, day: farmTime.day });
    let consumed = -difference;
    // 喂食、做饭、送礼等原有消费路径共用背包数量，优先消耗最早的一批。
    while (consumed > 0 && batches.length) {
      const amount = Math.min(consumed, batches[0].amount);
      batches[0].amount -= amount;
      consumed -= amount;
      if (!batches[0].amount) batches.shift();
    }
    for (let i = batches.length - 1; i >= 0; i--) {
      const batch = batches[i];
      if (farmTime.day - batch.day < chilledItems[key].days) continue;
      pocket[key] -= batch.amount;
      pocket.spoiledFood += batch.amount;
      batches.splice(i, 1);
      toast('背包里的食物放久了已经变质，不能再吃；回家清理，并把新鲜食材存进冰箱吧。', 6);
    }
  }
}

// 做饭预扣一份原料，同时带走它的鲜度日期；取消时不能把旧原料当成新收获。
function reserveCookingIngredient(item) {
  synchronizeBagFood();
  if (pocket[item] > 0) {
    const batches = bagFoodBatches[item];
    const batch = batches[0];
    const reservation = { item, source: 'bag', day: batch.day };
    pocket[item]--;
    if (--batch.amount === 0) batches.shift();
    return reservation;
  }
  if (fridge.stock[item] > 0) {
    fridge.stock[item]--;
    return { item, source: 'fridge' };
  }
  return null;
}

function refundCookingIngredient(reservation) {
  if (!reservation) return;
  const { item, source, day } = reservation;
  if (source === 'fridge') {
    fridge.stock[item]++;
    return;
  }
  synchronizeBagFood();
  pocket[item]++;
  const batches = bagFoodBatches[item];
  const originalBatch = batches.find((batch) => batch.day === day);
  if (originalBatch) originalBatch.amount++;
  else batches.push({ amount: 1, day });
  batches.sort((a, b) => a.day - b.day);
  // 预扣期间跨过保鲜期限的原料，退回后仍会正常变质。
  synchronizeBagFood();
}

function fridgeContentsKey() {
  return Object.keys(chilledItems).map(key => `${fridge.stock[key]}:${pocket[key]}`).join('|') + `|${pocket.spoiledFood}`;
}

function refreshFridge() {
  synchronizeBagFood();
  fridge.contents = fridgeContentsKey();
  document.querySelector('#fridge-items').innerHTML = Object.entries(chilledItems)
    .map(([key, item]) => `<li><span>${item.icon} ${item.name}<small>冰箱 ${fridge.stock[key]} · 背包 ${pocket[key]}</small></span><button aria-label="存入一份${item.name}" data-fridge-item="${key}" data-fridge-action="store" ${pocket[key] ? '' : 'disabled'}>存入 1 份</button><button aria-label="取出一份${item.name}" data-fridge-item="${key}" data-fridge-action="take" ${fridge.stock[key] ? '' : 'disabled'}>取出 1 份</button></li>`).join('');
  document.querySelector('#discard-spoiled-food').disabled = !pocket.spoiledFood;
  document.querySelector('#fridge-freshness').textContent =
    `冰箱内持续保鲜。背包里的冰淇淋、冰沙保留 1 天，其他食材保留 3 天（游戏时间）。${pocket.spoiledFood ? ` 有 ${pocket.spoiledFood} 份变质食物需要清理。` : ''}`;
}

function openFridge() {
  if (scene !== 'house' || clock < busyUntil || distance(player, places.fridge) > 85) return;
  route = [];
  pendingPlace = null;
  keys.clear();
  fridge.open = true;
  fridge.target = 1;
  refreshFridge();
  document.querySelector('#fridge-dialog').showModal();
  toast('冰箱门打开啦，冷冻食材和甜点都在里面。');
}

function closeFridge() {
  fridge.open = false;
  fridge.target = 0;
  document.querySelector('#fridge-dialog').close();
}

function transferFridgeItem(key, action) {
  if (!fridge.open || scene !== 'house' || distance(player, places.fridge) > 85 ||
      clock < busyUntil || !chilledItems[key] || !['store', 'take'].includes(action)) return;
  synchronizeBagFood();
  const from = action === 'store' ? pocket : fridge.stock;
  const to = action === 'store' ? fridge.stock : pocket;
  if (from[key] < 1) return;
  from[key]--;
  to[key]++;
  // 此处同步而非等下一帧，连续点击存取也不会遗漏新批次或重复消费。
  synchronizeBagFood();
  refreshFridge();
  refreshBackpack();
  toast(`${chilledItems[key].name}${action === 'store' ? '存进冰箱保鲜啦。' : '取出放进背包啦，记得尽快吃或做饭。'}`);
}

function discardSpoiledFood() {
  if (!fridge.open || scene !== 'house' || distance(player, places.fridge) > 85) return;
  synchronizeBagFood();
  pocket.spoiledFood = 0;
  refreshFridge();
  refreshBackpack();
  toast('变质食物清理好了，背包干干净净。');
}

function updateFridge(dt) {
  synchronizeBagFood();
  if (fridge.open && (scene !== 'house' || distance(player, places.fridge) > 85 ||
      sleepSession || lateSleepSession || !document.querySelector('#fridge-dialog').open)) closeFridge();
  const step = dt * 2;
  fridge.progress += Math.sign(fridge.target - fridge.progress) * Math.min(step, Math.abs(fridge.target - fridge.progress));
  // 按住按钮时不能每帧替换 DOM，否则松手时按钮已消失，存取点击会丢失。
  if (document.querySelector('#fridge-dialog').open && fridge.contents !== fridgeContentsKey()) refreshFridge();
  canvas.dataset.fridge = fridge.open ? 'open' : 'closed';
  canvas.dataset.spoiledFood = String(pocket.spoiledFood);
}

function drawFridge(front = false) {
  if (scene !== 'house' || !fridgeArt.complete || !fridgeArt.naturalWidth) return;
  if ((fridgeLayout.y + 82.47 > player.y) !== front) return;
  const { x, y, width } = fridgeLayout;
  const scale = width / fridgeRegions.open.width;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const progress = fridge.progress;
  if (progress === 0 || progress === 1) {
    const region = fridgeRegions[progress === 1 ? 'open' : 'closed'];
    ctx.drawImage(fridgeArt, region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height);
  } else {
    // 柜体不移动；过渡期间只让一扇门围绕右侧铰链转动，不能晃动整个冰箱。
    ctx.drawImage(fridgeArt, 921, 114, 507, 621, 0, 0, 507, 621);
    if (progress < 0.5) {
      const doorWidth = (1 - progress * 2) * 400;
      ctx.drawImage(fridgeArt, 280, 258, 400, 452, 501 - doorWidth, 144, doorWidth, 452);
    } else {
      const doorWidth = (progress * 2 - 1) * 286;
      ctx.drawImage(fridgeArt, 1388, 274, 286, 498, 467, 160, doorWidth, 498);
    }
  }
  ctx.restore();
}

document.querySelector('#close-fridge').addEventListener('click', closeFridge);
document.querySelector('#fridge-dialog').addEventListener('cancel', closeFridge);
document.querySelector('#fridge-items').addEventListener('click', event => {
  const button = event.target.closest('[data-fridge-action]');
  if (button) transferFridgeItem(button.dataset.fridgeItem, button.dataset.fridgeAction);
});
document.querySelector('#discard-spoiled-food').addEventListener('click', discardSpoiledFood);
