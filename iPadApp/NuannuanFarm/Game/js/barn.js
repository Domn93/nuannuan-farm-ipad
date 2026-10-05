// 内景与外面的动物共用成长、睡眠和感情状态，不复制第二批动物。
const barnArt = new Image();
barnArt.src = 'assets/barn-interior.png';
const barnPlaces = {
  barnExit: { x: 768, y: 850, label: '从养殖场门出去', icon: '↩' },
  barnFeed: { x: 768, y: 380, label: '给食槽添今天一顿饲料', icon: '🌾' },
  dog: { x: -10000, y: -10000, label: '牵萨摩耶散步', icon: '🐕' },
  cat: { x: -10000, y: -10000, label: '摸摸布偶猫', icon: '♡' }
};
const barnAnimalSpots = [
  [155, 459], [365, 222], [551, 220], [976, 222],
  [1165, 222], [140, 610], [1350, 460], [1350, 610]
];
// 门口望向外面的农场，草地上的动物仍在同一位置活动。
const barnYardSpots = {
  0: [660, 765],
  6: [850, 765]
};

function onBarnFloor(x, y) {
  // 只走中央空地和唯一门槛，床位、食槽和木墙在通道外。
  return (x > 310 && x < 1230 && y > 295 && y < 730) ||
    (x > 645 && x < 870 && y >= 730 && y < 925);
}

function animalInBarn(animal) {
  return !animal.visitScene && !animal.grazing && insidePen(farmAnimalPosition(animal));
}

function animalVisibleFromBarn(animal) {
  return !animal.visitScene &&
    (animalInBarn(animal) || (animal.grazing && barnYardSpots[animal.cell]));
}

function drawBarnAnimals(front) {
  if (scene !== 'barn') return;
  for (const animal of animals) {
    if (!animalVisibleFromBarn(animal)) continue;
    const inStall = animalInBarn(animal);
    const [x, y] = inStall ? barnAnimalSpots[animal.cell] : barnYardSpots[animal.cell];
    if ((y > player.y) !== front) continue;
    ctx.save();
    ctx.translate(x, y - (animal.sleeping ? 0 : Math.sin(clock * 1.8 + animal.seed) * 1.5));
    const width = animal.width * Math.min(animal.growth, 1.4) * 1.1;
    const height = animal.height * Math.min(animal.growth, 1.4) * 1.1;
    // 棚内床位表示休息位置，不在固定床位上播放走路动画。
    drawAnimalWalk(animal, animalRegions[animal.cell], width, height, false);
    ctx.restore();
    if (animal.sleeping) {
      const crop = sleepingAnimalRegions[animal.cell];
      drawSleepMark(x, y - width * crop.height / crop.width - 10);
    }
  }
  canvas.dataset.barnAnimals = String(animals.filter(animalInBarn).length);
  canvas.dataset.barnYardAnimals = String(animals.filter((animal) =>
    animal.grazing && !animal.visitScene && barnYardSpots[animal.cell]
  ).length);
}

function interactBarn(place) {
  if (scene !== 'barn') return false;
  if (place === 'barnExit') {
    changeScene('farm');
    player.x = 595;
    player.y = 615;
    if (carriedPet) updatePetCare(0);
    toast('从同一个养殖场门出来啦。');
    return true;
  }
  if (place === 'barnFeed') {
    const feeding = feedFarmAnimals(animals.filter(animalInBarn));
    if (!feeding.available) {
      toast('小动物现在都不在棚里，食槽暂时不用添饲料。');
      return true;
    }
    if (!feeding.fed) {
      toast('今天已经添过饲料了，等明天再喂吧。');
      return true;
    }
    feedingStarted = clock;
    burst('🌾', 768, 350, 5);
    toast('今天一顿饲料添好啦，小动物慢慢吃，幼崽会一天天长大。');
    return true;
  }
  return false;
}
