// 地图、互动点和静态碰撞边界；坐标统一使用 1536 × 1024 的场景坐标。

const dock = [
  [986, 643],
  [1165, 622],
  [1303, 657],
  [1287, 686],
  [1170, 712],
  [988, 681]
];
const shoreline = [
  [1536, 565],
  [1380, 581],
  [1250, 596],
  [1185, 631],
  [1205, 723],
  [1030, 740],
  [947, 795],
  [891, 858],
  [997, 1024],
  [1536, 1024]
];
const outdoorPlaces = {
  animals: { x: 475, y: 540, label: '喂喂小动物', icon: '♡' },
  pen: { x: 580, y: 535, label: '走进养殖场', icon: '⌂' },
  penGate: { x: 535, y: 615, label: '打开养殖场的门', icon: '⌂' },
  pond: { x: 1220, y: 671, label: '在小桥上钓鱼', icon: '🐟' },
  flowers: { x: 302, y: 703, label: '采一朵小花', icon: '🌼' },
  house: { x: 1007, y: 467, label: '开门回家', icon: '⌂' },
  horse: { x: 592, y: 613, label: '骑上小马', icon: '🐴' },
  dog: { x: 710, y: 680, label: '牵萨摩耶散步', icon: '🐕' },
  cat: { x: 925, y: 565, label: '摸摸布偶猫', icon: '♡' },
  swing: { x: 1380, y: 548, label: '坐上树下的秋千', icon: '♧' }
};
const indoorPlaces = {
  dog: { x: 595, y: 670, label: '牵萨摩耶散步', icon: '🐕' },
  cat: { x: 710, y: 670, label: '摸摸布偶猫', icon: '♡' },
  petFood: { x: 560, y: 660, label: '添猫粮和狗粮', icon: '🥣' },
  bed: { x: 456, y: 322, label: '上床睡觉', icon: '☾' },
  wardrobe: { x: 695, y: 265, label: '打开衣柜', icon: '♧' },
  toilet: { x: 960, y: 240, label: '使用马桶', icon: '🚽' },
  balconyDoor: { x: 850, y: 520, label: '打开阳台门', icon: '⌂' },
  bedroom: { x: 535, y: 280, label: '在卧室休息', icon: '☾' },
  bathroom: { x: 1100, y: 285, label: '洗洗手', icon: '🫧' },
  balcony: { x: 1175, y: 580, label: '在阳台吹吹风', icon: '☀' },
  tv: { x: 514, y: 475, label: '看电视', icon: '📺' },
  exit: { x: 650, y: 700, label: '开门去农场', icon: '⌂' }
};
// 宠物窝允许猫狗走进去休息；角色碰撞单独使用，不从共享宠物网格删掉。
const housePetBeds = [
  { x: 410, y: 612, width: 130, height: 82 },
  { x: 570, y: 620, width: 110, height: 69 }
];
const houseArrival = { x: 650, y: 700 };

function playerClearOfPetBeds(x, y) {
  return scene !== 'house' || !housePetBeds.some((bed) =>
    x > bed.x && x < bed.x + bed.width && y > bed.y && y < bed.y + bed.height
  );
}
const balconyDoor = { open: false, started: null, opening: true, destination: null };
const balconyDoorLayout = {
  hinge: { x: 942, y: 625 },
  closedEdge: { x: 18, y: -116 },
  // 开门后保留侧向透视；门宽约为高度的一半，不把窄门拉成正面的宽贴片。
  openEdge: { x: 60, y: 32 },
  height: 132
};

function openBalconyDoor(destination = null) {
  if (scene !== 'house' || balconyDoor.started !== null) return;
  balconyDoor.opening = !balconyDoor.open;
  if (
    !balconyDoor.opening &&
    ((player.x > 885 && player.x < 990 && player.y > 480 && player.y < 640) ||
      pets.filter(petIsHere).some((pet) => {
        const halfWidth = petSpriteSize(pet) / 2;
        return pet.x + halfWidth > 901 && pet.x - halfWidth < 972 &&
          pet.y > 480 && pet.y < 640;
      }))
  ) {
    toast('暖暖和小伙伴先离开门口，再关阳台门吧。');
    return;
  }
  balconyDoor.started = clock;
  balconyDoor.destination = destination;
  route = [];
  pendingPlace = null;
  busyUntil = clock + 0.85;
  toast(balconyDoor.opening ? '阳台门慢慢打开了…' : '把阳台门轻轻关上…');
  playNote(210, 0, 0.25);
}

function updateBalconyDoor() {
  if (scene !== 'house') return;
  indoorPlaces.balconyDoor.x = player.x > 972 ? 1020 : 850;
  if (balconyDoor.started === null || clock - balconyDoor.started < 0.85) return;
  balconyDoor.open = balconyDoor.opening;
  balconyDoor.started = null;
  indoorPlaces.balconyDoor.label = balconyDoor.open ? '关上阳台门' : '打开阳台门';
  busyUntil = 0;
  rebuildGrid();
  const destination = balconyDoor.destination;
  balconyDoor.destination = null;
  if (destination) walkTo(destination.point, destination.place);
}

function drawBalconyDoor() {
  if (scene !== 'house') return;
  const elapsed =
    balconyDoor.started === null ? 1 : Math.min(1, (clock - balconyDoor.started) / 0.85);
  const eased = elapsed * elapsed * (3 - 2 * elapsed);
  const openness =
    balconyDoor.started === null
      ? Number(balconyDoor.open)
      : balconyDoor.opening
        ? eased
        : 1 - eased;
  ctx.save();
  // 使用原位置编辑出的门洞，不复制其他房间的地板，避免木纹接缝和拉伸。
  ctx.drawImage(balconyFloorArt, 903, 498, 69, 127, 903, 498, 69, 127);
  const { hinge, closedEdge, openEdge, height } = balconyDoorLayout,
    angle = openness * Math.PI / 2,
    footX = hinge.x + closedEdge.x * Math.cos(angle) + openEdge.x * Math.sin(angle),
    footY = hinge.y + closedEdge.y * Math.cos(angle) + openEdge.y * Math.sin(angle);
  // 阴影跟随门底而非门顶，固定铰链脚位；打开后整条底边落在同一地板上。
  ctx.strokeStyle = '#59452d45';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y + 2);
  ctx.lineTo(footX, footY + 2);
  ctx.stroke();
  // 门板有厚度，上沿和自由边随同一脚位投影，避免像悬在墙旁的纸片。
  ctx.fillStyle = '#765136';
  ctx.beginPath();
  ctx.moveTo(footX, footY - height);
  ctx.lineTo(footX + 3, footY - height - 2);
  ctx.lineTo(footX + 3, footY - 2);
  ctx.lineTo(footX, footY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#bf9560';
  ctx.beginPath();
  ctx.moveTo(hinge.x, hinge.y - height);
  ctx.lineTo(footX, footY - height);
  ctx.lineTo(footX + 3, footY - height - 2);
  ctx.lineTo(hinge.x + 3, hinge.y - height - 2);
  ctx.closePath();
  ctx.fill();
  drawGroundedDoor(
    doorPanelRegions.balcony,
    hinge,
    closedEdge,
    openEdge,
    height,
    openness
  );

  ctx.restore();
}

function onFarmGround(x, y) {
  if (x < 45 || x > W - 45 || y < 440 || y > 980) return false;
  if (x > 646 && x < 757 && y > 485 && y < 585) return false;
  const inPen = insidePolygon(x, y, penFloor);
  const gatePassage = penGate.open && x > 500 && x < 572 && y > 525 && y < 610;
  if (x < 644 && y < 589 && !inPen && !gatePassage) return false;
  if (!penGate.open && x > 500 && x < 572 && y > 537 && y < 589) return false;
  if (inPen || animals.some((animal) => animal.grazing || animal.herdRoute))
    for (const animal of animals) {
      // 推行队伍占用动物脚位，其他动物会主动避让，不把整个出口堵死。
      if (animalTravel?.mode === 'push') continue;
      if ((animal.visitScene && animal.visitScene !== scene) || animalTravel?.animal === animal)
        continue;
      const growth = animal.targetGrowth;
      const position = farmAnimalPosition(animal);
      if (
        ((x - position.x) / (animal.width * growth * 0.32)) ** 2 +
          ((y - position.y + 8) / (13 * growth)) ** 2 <
        1
      )
        return false;
    }
  const entrance = x > 970 && x < 1043 && y > 440;
  if (x > 724 && y < 481 && !entrance) return false;
  if (insidePolygon(x, y, foregroundFence)) return false;
  if (insidePolygon(x, y, shoreline) && !insidePolygon(x, y, dock)) return false;
  for (const [cx, cy, rx, ry] of [
    [625, 444, 45, 38],
    [823, 772, 80, 46],
    [1470, 464, 50, 53],
    [28, 462, 36, 68]
  ]) {
    if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return false;
  }
  return true;
}

function onHouseFloor(x, y) {
  // 这些矩形是脚下不能经过的区域，必须与对应家具的绘制位置一起维护。
  if (x < 175 || x > 1350 || y < 170 || y > 715) return false;
  if (x > 824 && x < 875 && y < 443) return false;
  if (y > 351 && y < 443 && !(x > 600 && x < 677) && !(x > 977 && x < 1050)) return false;
  if (x > 901 && x < 972 && y > 432 && !(balconyDoor.open && y > 498 && y < 625)) return false;
  const furniture = [
    [245, 170, 420, 303],
    [175, 170, 247, 345],
    [765, 205, 825, 352],
    [1215, 170, 1340, 315],
    [916, 170, 1120, 204],
    [180, 462, 290, 710],
    [285, 448, 357, 494],
    [296, 685, 367, 710],
    [360, 518, 606, 626],
    [632, 511, 792, 600],
    [420, 443, 600, 468],
    [785, 438, 900, 490],
    [shoeRackLayout.bounds.x, shoeRackLayout.bounds.y,
      shoeRackLayout.bounds.x + shoeRackLayout.bounds.width,
      shoeRackLayout.bounds.y + shoeRackLayout.bounds.height],
    [1265, 636, 1350, 715],
    [1138, 525, 1202, 558],
    [965, 630, 1050, 715],
    [864, 616, 908, 710]
  ];
  return !furniture.some(([l, t, r, b]) => x > l && x < r && y > t && y < b);
}

function drawHouseDetails() {
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'center';
  const screen = { x: 469, y: 398, w: 89, h: 30 };
  ctx.fillStyle = '#433f36';
  ctx.beginPath();
  ctx.roundRect(screen.x - 7, screen.y - 7, screen.w + 14, screen.h + 14, 7);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(screen.x, screen.y, screen.w, screen.h);
  ctx.clip();
  ctx.fillStyle = tvOn ? '#96d8ed' : '#242a2c';
  ctx.fillRect(screen.x, screen.y, screen.w, screen.h);
  if (tvOn) {
    ctx.fillStyle = '#edfaff';
    for (let i = 0; i < 3; i++) {
      const x = screen.x + ((clock * 12 + i * 65) % 190) - 20;
      ctx.beginPath();
      ctx.ellipse(x, screen.y + 15, 22, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#51b6cc';
    ctx.fillRect(screen.x, screen.y + 17, screen.w, 13);
    ctx.font = '17px sans-serif';
    ctx.fillText('🐟', screen.x + 45 + Math.sin(clock * 1.3) * 26, screen.y + 29);
  }
  ctx.restore();
  drawBalconyDoor();
  drawHomeFurniture();
  drawLivingFurniture();
  drawHomeCurtains();
}

function drawDoorAnimation() {
  if (!doorTransition) return;
  const t = Math.min(1, (clock - doorTransition.started) / 1.25);
  const progress = Math.sin((Math.min(1, t / 0.75) * Math.PI) / 2);
  const outside = scene === 'farm';
  const x = outside ? 986 : 608,
    y = outside ? 344 : 753;
  const width = outside ? 42 : 78,
    height = outside ? 78 : 77;
  ctx.fillStyle = '#292119';
  ctx.fillRect(x, y, width, height);
  drawWoodDoor(
    outside ? fenceTexture : originalInterior,
    [x, y, width, height],
    [x, y, width, height],
    progress,
    9
  );

  if (t > 0.7) {
    ctx.fillStyle = `rgba(249,246,234,${(t - 0.7) / 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBigFish() {
  if (clock > catchUntil) return;
  ctx.save();
  ctx.translate(player.x + 105, player.y - 135 + Math.sin(clock * 5) * 5);
  ctx.rotate(Math.sin(clock * 7) * 0.12);
  const fishScale = lastCaughtFish.scale;
  drawCaughtFish(ctx, lastCaughtFish, -135 * fishScale, -90 * fishScale,
    270 * fishScale, 180 * fishScale);
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff9e8';
  ctx.strokeStyle = '#51644c';
  ctx.lineWidth = 3;
  const label = `${lastCaughtFish.species.name} · ${lastCaughtFish.label}`;
  ctx.strokeText(label, 0, 87);
  ctx.fillText(label, 0, 87);
  ctx.restore();
}
