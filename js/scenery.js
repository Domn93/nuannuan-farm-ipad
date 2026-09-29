// 插画素材与遮挡边界。静态家具直接画在地图里，动态门沿用原图木纹。
const kennelArt = new Image();
kennelArt.src = 'assets/kennel.png';
const cookingPanArt = new Image();
cookingPanArt.src = 'assets/pan.png';
const sleepingPetsArt = new Image();
sleepingPetsArt.src = 'assets/pets-sleep.png';
// 两只宠物的轮廓不按图集等分：萨摩耶的头越过中线，须完整裁切。
const sleepingPetRegions = {
  dog: { x: 28, y: 250, width: 780, height: 520 },
  cat: { x: 840, y: 310, width: 680, height: 460 }
};
const sleepingAnimalsArt = new Image();
sleepingAnimalsArt.src = 'assets/animals-rest.png';
// 睡姿轮廓更低；不能复用站姿的裁切范围和高度，把趴卧动物拉成立姿。
const sleepingAnimalRegions = [
  { x: 38, y: 264, width: 345, height: 207 },
  { x: 408, y: 216, width: 358, height: 253 },
  { x: 792, y: 271, width: 312, height: 201 },
  { x: 1113, y: 85, width: 399, height: 396 },
  { x: 20, y: 664, width: 395, height: 257 },
  { x: 436, y: 648, width: 357, height: 276 },
  { x: 824, y: 686, width: 323, height: 238 },
  { x: 1178, y: 688, width: 321, height: 238 }
];
const fenceTexture = new Image();
fenceTexture.src = 'assets/farm-empty.png';
const originalInterior = new Image();
originalInterior.src = 'assets/interior.png';
const balconyFloorArt = new Image();
balconyFloorArt.src = 'assets/interior-door.png';
const doorPanelsArt = new Image();
doorPanelsArt.src = 'assets/door-panels.png';
const doorPanelRegions = {
  pen: { x: 110, y: 458, width: 712, height: 386 },
  balcony: { x: 939, y: 100, width: 394, height: 821 }
};
const homeFurnitureArt = new Image();
homeFurnitureArt.src = 'assets/home-furniture.png';
const diningPoseArt = new Image();
diningPoseArt.src = 'assets/dining-pose.png';
const diningPoseRegions = {
  pink: { x: 167, y: 80, width: 516, height: 859 },
  blue: { x: 846, y: 77, width: 516, height: 861 }
};
const homeFurnitureRegions = {
  wardrobe: { x: 72, y: 48, width: 386, height: 909 },
  wardrobeDoor: { x: 588, y: 145, width: 285, height: 737 },
  stove: { x: 1007, y: 505, width: 486, height: 421 }
};

// 以门底部铰链为原点投影门板；两端脚位随开门角度移动，高度不变。
// 不叠加开/关两张图，也不绕门板顶部旋转，否则会出现重影或悬空。
function drawGroundedDoor(region, hinge, closedEdge, openEdge, height, openness) {
  const angle = (Math.max(0, Math.min(1, openness)) * Math.PI) / 2;
  const dx = closedEdge.x * Math.cos(angle) + openEdge.x * Math.sin(angle);
  const dy = closedEdge.y * Math.cos(angle) + openEdge.y * Math.sin(angle);
  ctx.save();
  ctx.translate(hinge.x, hinge.y);
  ctx.transform(dx / region.width, dy / region.width, 0, height / region.height, 0, 0);
  ctx.drawImage(
    doorPanelsArt,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    -region.height,
    region.width,
    region.height
  );
  ctx.restore();
}
const petProps = Object.fromEntries(
  ['bowl', 'litter', 'pet-bed'].map((name) => {
    const image = new Image();
    image.src = `assets/${name}.png`;
    return [name, image];
  })
);
const sceneryMaps = Object.fromEntries(
  ['junction', 'forest', 'city', 'friends'].map((name) => {
    const image = new Image();
    image.src = name === 'forest' ? 'assets/forest-v2.png'
      : name === 'city' ? 'assets/market-v3.png' : `assets/${name}.png`;
    return [name, image];
  })
);

// 门绕竖直铰链转动：横向投影变窄，竖边保持直立，不能旋转整张图片。
function drawWoodDoor(image, source, target, openness, skew = 0) {
  const [sx, sy, sw, sh] = source;
  const [x, y, width, height] = target;
  ctx.save();
  ctx.translate(x, y);
  ctx.transform(Math.max(0.06, 1 - openness * 0.94), (skew * openness) / width, 0, 1, 0, 0);
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
  ctx.restore();
}

// 浴帘、换衣帘和隐私屏共用布料褶皱，而不是一块不透明的纯色矩形。
function drawPrivacyCurtain(x, y, width, height) {
  ctx.save();
  const cloth = ctx.createLinearGradient(x, y, x + width, y);
  for (let i = 0; i <= 12; i++) {
    cloth.addColorStop(i / 12, i % 2 ? '#b7c8b4' : '#edf0da');
  }
  ctx.fillStyle = cloth;
  ctx.shadowColor = '#3e463b35';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 5);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#899b7d';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = '#fff7dd88';
  for (const dy of [8, height - 8]) {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + dy);
    ctx.lineTo(x + width - 3, y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

// 只重绘木头，绝不把围栏背后的整片草地/沙地重新盖到人物身上。
const fenceRails = [
  [
    [21, 493],
    [176, 526],
    [360, 531],
    [488, 510]
  ],
  [
    [21, 526],
    [176, 560],
    [360, 559],
    [488, 537]
  ],
  [
    [566, 494],
    [623, 465]
  ],
  [
    [566, 519],
    [623, 490]
  ]
];
const fencePosts = [
  [54, 476, 17, 66],
  [108, 494, 16, 65],
  [168, 505, 17, 64],
  [271, 512, 17, 64],
  [291, 511, 14, 64],
  [368, 506, 17, 62],
  [488, 493, 18, 62],
  [566, 480, 13, 54],
  [623, 447, 12, 65]
];

function clipFenceWood() {
  ctx.beginPath();
  for (const points of fenceRails) {
    // 每段横梁用窄四边形裁切，避免草地成为不透明遮罩。
    for (let i = 1; i < points.length; i++) {
      const [x1, y1] = points[i - 1],
        [x2, y2] = points[i];
      ctx.moveTo(x1, y1 - 5);
      ctx.lineTo(x2, y2 - 5);
      ctx.lineTo(x2, y2 + 5);
      ctx.lineTo(x1, y1 + 5);
      ctx.closePath();
    }
  }
  for (const [x, y, w, h] of fencePosts) ctx.rect(x - w / 2, y, w, h);
  ctx.clip();
}
