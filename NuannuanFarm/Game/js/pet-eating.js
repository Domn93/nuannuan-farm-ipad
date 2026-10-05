// 独立低头进食贴图：保留四脚着地，不再压扁整只宠物模拟低头。
const petEatingArt = {
  dog: new Image(),
  cat: new Image()
};
petEatingArt.dog.src = 'assets/dog-eating.png';
petEatingArt.cat.src = 'assets/cat-eating.png';
const petEatingReady = Promise.all(Object.values(petEatingArt).map(image => image.decode()));

// source 去掉透明留白；mouth 是原图鼻尖坐标，站位与绘制共用同一个锚点。
const petEatingRegions = {
  dog: { source: [90, 190, 1160, 950], mouth: [215, 1090] },
  cat: { source: [112, 17, 1406, 974], mouth: [245, 954] }
};

function petEatingMouthOffset(pet, width) {
  const { source: [sx, sy, sw, sh], mouth: [mx, my] } = petEatingRegions[pet.kind];
  const scale = width / sw;
  return { x: (mx - sx - sw / 2) * scale, y: (my - sy - sh) * scale };
}

function petEatingTarget(pet) {
  const surface = petBowlSurface(foodBowls[pet.kind]);
  let target = { x: surface.x, y: surface.y };
  // 室内透视尺寸也由脚的位置决定；两次计算使站位与实际绘制尺寸一致。
  for (let i = 0; i < 2; i++) {
    const width = (pet.kind === 'dog' ? 135 : 102) * sceneScale(target.y);
    const mouth = petEatingMouthOffset(pet, width);
    target = { x: surface.x - mouth.x, y: surface.y - mouth.y };
  }
  return target;
}

// 在 drawPets 的宠物脚坐标局部系中调用，只画身体，不重复画盆或粮食。
function drawPetEatingPose(pet, width) {
  const image = petEatingArt[pet.kind];
  const [sx, sy, sw, sh] = petEatingRegions[pet.kind].source;
  const height = width * sh / sw;
  ctx.drawImage(image, sx, sy, sw, sh, -width / 2, -height, width, height);
  return height;
}
