// 盆栽沿用室内底图的位置；只改变叶片颜色，花盆和周围家具不重复绘制。
const housePlants = [
  { name: '卧室绿植', leaves: [735, 82, 78, 65], soil: { x: 770, y: 146 }, stand: { x: 720, y: 210 } },
  { name: '卫生间左边绿植', leaves: [855, 276, 65, 61], soil: { x: 890, y: 332 }, stand: { x: 935, y: 325 } },
  { name: '浴缸旁绿植', leaves: [1290, 273, 61, 64], soil: { x: 1320, y: 333 }, stand: { x: 1270, y: 335 } },
  { name: '客厅左边绿植', leaves: [189, 394, 61, 47], soil: { x: 217, y: 442 }, stand: { x: 305, y: 510 } },
  { name: '书架旁绿植', leaves: [742, 400, 59, 53], soil: { x: 770, y: 451 }, stand: { x: 734, y: 486 } },
  // 从冰箱上方接近花盆，保持原花盆位置，浇水不能站进新柜体的脚位。
  { name: '厨房角落绿植', leaves: [164, 641, 53, 51], soil: { x: 190, y: 692 }, stand: { x: 310, y: 666 } },
  { name: '阳台北边花盆', leaves: [1274, 384, 66, 61], soil: { x: 1304, y: 446 }, stand: { x: 1248, y: 466 } },
  { name: '阳台左角花盆', leaves: [960, 638, 86, 69], soil: { x: 1001, y: 707 }, stand: { x: 1080, y: 670 } },
  { name: '阳台右角花盆', leaves: [1295, 646, 68, 65], soil: { x: 1328, y: 710 }, stand: { x: 1235, y: 684 } }
].map((plant, index) => ({ ...plant, key: `plant${index}`, water: 1, dead: false, mask: null }));
let plantCare = null;
for (const plant of housePlants) {
  indoorPlaces[plant.key] = { ...plant.stand, label: `给${plant.name}浇水`, icon: '🌱' };
}

function interactHousePlants(place) {
  const plant = housePlants.find((candidate) => candidate.key === place);
  if (!plant || scene !== 'house') return false;
  if (clock < busyUntil || plantCare) return true;
  if (distance(player, plant.stand) > 85) return true;
  route = [];
  pendingPlace = null;
  keys.clear();
  player.walking = false;
  player.view = plant.soil.y < player.y - 45 ? 2 : 1;
  player.facing = plant.soil.x < player.x ? -1 : 1;
  plantCare = { plant, started: clock, replacing: plant.dead };
  busyUntil = clock + (plant.dead ? 3 : 2.6);
  toast(plant.dead ? '取走枯萎的植物，换上一株新苗。' : plant.water > 0.95 ? '土还湿润，补一点点水就好。' : '把水慢慢浇进花盆里的土。');
  return true;
}

function stopPlantCare() {
  if (!plantCare) return;
  const until = plantCare.started + (plantCare.replacing ? 3 : 2.6);
  plantCare = null;
  if (busyUntil === until) busyUntil = 0;
}

function updateHousePlants(dt) {
  // 游戏暂停时不扣水；离开房间仍会缺水。三日不照料会枯死，浇水不能复活死株。
  for (const plant of housePlants) {
    if (!plant.dead) {
      plant.water = Math.max(0, plant.water - Math.max(0, dt) / 2160);
      plant.dead = plant.water === 0;
    }
    indoorPlaces[plant.key].label = plant.dead
      ? `更换${plant.name}的新苗`
      : `给${plant.name}浇水`;
  }
  if (plantCare && (scene !== 'house' || sleepSession || lateSleepSession || doorTransition)) stopPlantCare();
  if (plantCare && clock - plantCare.started >= (plantCare.replacing ? 3 : 2.6)) {
    const { plant, replacing } = plantCare;
    plant.water = 1;
    plant.dead = false;
    indoorPlaces[plant.key].label = `给${plant.name}浇水`;
    stopPlantCare();
    toast(replacing ? '新苗种好了，记得照顾它。' : '土壤喝饱水啦，叶子慢慢恢复精神。');
  }
  canvas.dataset.plants = housePlants.map((plant) => plant.dead ? 'dead' : plant.water < 0.5 ? 'thirsty' : 'healthy').join(',');
  canvas.dataset.watering = plantCare ? plantCare.replacing ? 'replacing' : 'watering' : 'idle';
}

function housePlantLeafMask(plant) {
  if (plant.mask) return plant.mask;
  if (!interior.complete || !interior.naturalWidth) return null;
  const [x, y, width, height] = plant.leaves;
  const layer = document.createElement('canvas');
  layer.width = width;
  layer.height = height;
  const painter = layer.getContext('2d');
  painter.drawImage(interior, x, y, width, height, 0, 0, width, height);
  const pixels = painter.getImageData(0, 0, width, height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index], green = pixels.data[index + 1], blue = pixels.data[index + 2];
    // 去掉木地板、墙壁、花盆；仅覆盖植物自身偏绿的叶片，保留原来的明暗纹理。
    if (green <= red * 1.08 || green <= blue * 1.12) {
      pixels.data[index + 3] = 0;
      continue;
    }
    const light = 0.25 * red + 0.55 * green + 0.2 * blue;
    pixels.data[index] = Math.min(255, light * 1.2);
    pixels.data[index + 1] = light * 0.72;
    pixels.data[index + 2] = light * 0.33;
  }
  painter.putImageData(pixels, 0, 0);
  plant.mask = layer;
  return layer;
}

function drawHousePlantLeaves() {
  if (scene !== 'house') return;
  ctx.save();
  for (const plant of housePlants) {
    const dryness = Math.min(1, Math.max(0, (0.65 - plant.water) / 0.65));
    if (!dryness) continue;
    const mask = housePlantLeafMask(plant);
    if (!mask) continue;
    ctx.globalAlpha = dryness;
    ctx.drawImage(mask, plant.leaves[0], plant.leaves[1]);
  }
  ctx.restore();
}

function drawPlantWatering() {
  if (!plantCare || scene !== 'house') return;
  const { plant, started, replacing } = plantCare;
  const elapsed = clock - started;
  ctx.save();
  if (replacing) {
    ctx.font = '22px sans-serif';
    ctx.fillText('🌱', plant.soil.x - 10, plant.soil.y - 6 - Math.sin(elapsed * Math.PI) * 5);
  } else {
    const side = plant.soil.x < player.x ? -1 : 1;
    const hand = { x: player.x + side * 25, y: player.y - 76 };
    // 小水壶就在手边，长的是流向土壤的水线，手臂不伸长到花盆。
    ctx.fillStyle = '#91aaa0';
    ctx.strokeStyle = '#687f75';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hand.x + side * 10, hand.y + 9, 16, 13, side * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hand.x - side * 6, hand.y + 6, 9, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    const spout = { x: hand.x + side * 33, y: hand.y + 5 };
    ctx.beginPath();
    ctx.moveTo(hand.x + side * 19, hand.y + 9);
    ctx.lineTo(spout.x, spout.y);
    ctx.stroke();
    if (elapsed > 0.35 && elapsed < 2.3) {
      ctx.strokeStyle = '#8fcbd4b0';
      ctx.lineWidth = 1.8;
      for (let stream = 0; stream < 3; stream++) {
        ctx.beginPath();
        ctx.moveTo(spout.x, spout.y + stream * 2);
        ctx.quadraticCurveTo((spout.x + plant.soil.x) / 2, spout.y, plant.soil.x + (stream - 1) * 4, plant.soil.y - 1);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function goWaterHousePlant() {
  if (scene !== 'house' || clock < busyUntil) return;
  const candidates = [...housePlants].sort((left, right) => left.water - right.water || distance(player, left.stand) - distance(player, right.stand));
  const plant = candidates.find((candidate) => {
    const arrival = findPath(candidate.stand).at(-1);
    return arrival && distance(arrival, candidate.stand) < 20;
  });
  if (!plant) {
    toast('先打开阳台门，走近需要照顾的花盆吧。');
    return;
  }
  walkTo(plant.stand, plant.key);
}

document.querySelector('#water-plants').addEventListener('click', goWaterHousePlant);
