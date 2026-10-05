// 图鉴与背包分开：物品可消耗，发现和捕获记录不会因此消失。
const discoveryBook = { seen: new Set(), counts: {} };
const discoveryStorageKey = 'nuannuan-discoveries-v1';
try {
  const saved = JSON.parse(localStorage.getItem(discoveryStorageKey) || 'null');
  if (saved && Array.isArray(saved.seen))
    saved.seen.filter((id) => typeof id === 'string').forEach((id) => discoveryBook.seen.add(id));
  if (saved?.counts && typeof saved.counts === 'object')
    for (const [id, count] of Object.entries(saved.counts))
      if (Number.isSafeInteger(count) && count >= 0) discoveryBook.counts[id] = count;
} catch {
  // 存储不可用或旧记录损坏时，本次游玩仍能正常发现和收集。
}

function hasDiscovery(id) {
  return discoveryBook.seen.has(id);
}

function discoveryCount(id) {
  return discoveryBook.counts[id] || 0;
}

function recordDiscovery(id, count = 1) {
  const changed = !hasDiscovery(id) || count > 0;
  discoveryBook.seen.add(id);
  if (count > 0) discoveryBook.counts[id] = discoveryCount(id) + count;
  if (!changed) return;
  try {
    localStorage.setItem(discoveryStorageKey, JSON.stringify({
      seen: [...discoveryBook.seen], counts: discoveryBook.counts
    }));
  } catch {
    // 不让浏览器的存储限制中断动作完成和物品入包。
  }
}

function discoverMapLife() {
  if (scene === 'farm' || scene === 'barn') {
    ['pig', 'sheep', 'lamb', 'horse', 'cow', 'rooster', 'hen', 'chick', 'bird']
      .forEach((kind) => recordDiscovery(`animal-${kind}`, 0));
    if (scene === 'farm') recordDiscovery('tree-cherry', 0);
  }
  for (const pet of pets)
    if (petIsHere(pet)) recordDiscovery(`animal-${pet.kind}`, 0);
  if (scene === 'forest') {
    recordDiscovery('tree-forest', 0);
    forestWildlife.forEach((animal) => recordDiscovery(`animal-${animal.key}`, 0));
  }
}

const leafSpots = {
  farm: { key: 'cherryLeaves', x: 790, y: 590, label: '捡一片樱花树叶', icon: '🍃', readyAt: 0, discovery: 'leaf-cherry' },
  forest: { key: 'forestLeaves', x: 860, y: 620, label: '捡一片森林树叶', icon: '🍃', readyAt: 0, discovery: 'leaf-forest' }
};
outdoorPlaces.cherryLeaves = leafSpots.farm;
explorePlaces.forest.forestLeaves = leafSpots.forest;

function collectLeaf(place) {
  const spot = leafSpots[scene];
  if (!spot || spot.key !== place) return false;
  if (clock < spot.readyAt) {
    toast('刚捡过这里的叶子，去别处逛逛再来吧。');
    return true;
  }
  spot.readyAt = clock + 45;
  pocket.leaves++;
  recordDiscovery(spot.discovery);
  refreshBackpack();
  toast('捡到一片树叶，放进背包，也记进图鉴啦！');
  burst('🍃', player.x, player.y - 65, 2);
  return true;
}

function drawCollectibleLeaves() {
  const spot = leafSpots[scene];
  if (!spot || clock < spot.readyAt) return;
  ctx.save();
  ctx.translate(spot.x, spot.y);
  ctx.rotate(-0.4);
  ctx.fillStyle = scene === 'farm' ? '#b9bb5b' : '#7b9c50';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#586e35';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();
  ctx.restore();
}
