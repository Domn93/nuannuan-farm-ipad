// 厨房、饭桌、沙发和洗手；做饭取消时退回预扣食材。

let livingSession = null;
const diningMeal = { servings: 0, name: '', eatAt: null };
const mealDeliveryPoint = { x: 810, y: 650 };
const diningPlate = { x: 760, y: 568 };
// 皂液、双手和流水共用洗手台上的位置，手臂只在身边小幅活动。
const handwashLayout = {
  stand: { x: 1110, y: 223 },
  // 坐标是泵头；瓶底在 y + 27，落在水池右侧的台面内。
  soap: { x: 1103, y: 117 },
  hands: { x: 1077, y: 142 },
  faucet: { x: 1063, y: 120 }
};
// 新灶台在厨房旁的空地；锅、食物、火焰和手部动作共用这一个位置变换。
const kitchenLayout = {
  stand: { x: 285, y: 431, width: 72, height: 62.4 },
  pot: { x: 291, y: 418, scale: 0.73 },
  // 点击覆盖炉柜及伸出桌面的锅柄，不再借用左侧水槽的旧区域。
  hitArea: { x: 285, y: 418, width: 76, height: 76 },
  sink: { x: 300, y: 666 }
};

function applyKitchenSurface() {
  ctx.translate(kitchenLayout.pot.x, kitchenLayout.pot.y);
  ctx.scale(kitchenLayout.pot.scale, kitchenLayout.pot.scale);
  ctx.translate(-178, -506);
}
const recipes = {
  vegetables: { name: '蔬菜饭', item: null, amount: 1 },
  mushroom: { name: '蘑菇汤', item: 'mushrooms', amount: 2 },
  fish: { name: '煎鱼', item: 'fish', amount: 2 },
  meat: { name: '肉菜饭', item: 'meat', amount: 2 }
};
Object.assign(indoorPlaces, {
  bathroom: { ...handwashLayout.stand, label: '挤洗手液洗手', icon: '🫧' },
  sofa: { x: 510, y: 650, label: '坐在沙发上', icon: '🛋' },
  dining: { x: 690, y: 700, label: '在饭桌吃饭', icon: '🍽' },
  kitchen: { x: 370, y: 498, label: '去厨房做饭', icon: '🍳' }
});
indoorPlaces.petFood.x = petFoodBin.stand.x;
indoorPlaces.petFood.y = petFoodBin.stand.y;
Object.assign(foodBowls.dog, { x: 1090, y: 480 });
Object.assign(foodBowls.cat, { x: 1260, y: 480 });

function stopLivingAction(completed = false) {
  // 未煮熟时退回食材；煮熟后只转移熟饭，不能同时退回食材又发放食物。
  const session = livingSession;
  if (!session) return;
  stopBathSound();
  livingSession = null;
  busyUntil = 0;
  keys.clear();
  player.walking = false;
  if (session.kind === 'cook') {
    route = [];
    pendingPlace = null;
    if (completed) {
      diningMeal.servings++;
      diningMeal.name = session.recipe.name;
      diningMeal.eatAt = clock + 12;
      pocket.food += session.recipe.amount - 1;
      toast(`${session.recipe.name}端到饭桌上啦，休息一会儿再坐下吃。`);
    } else if (session.cooked) {
      // 饭已煮熟，取消端菜只能收进背包，不能再退回生食材。
      pocket.food += session.recipe.amount;
    } else if (session.recipe.item) {
      refundCookingIngredient(session.ingredientReservation);
    }
  }
  if (session.kind === 'wash' && completed) toast('搓好泡泡、冲干净、擦干手啦！');
  if (session.kind === 'litter' && completed) toast('猫砂清理好啦，铲子放回盆旁边。');
  if (session.kind === 'eat' && completed) {
    pocket.hearts++;
    toast('吃好饭啦，精神满满！');
  }
}

function beginLivingAction(kind, recipe = null) {
  if (scene !== 'house' || livingSession || clock < busyUntil) return;
  synchronizeBagFood();
  if (kind === 'litter' && animalCare.session?.actor === cat) {
    toast('布偶猫正在用猫砂盆，等它离开再清理吧。');
    return;
  }
  if (kind === 'cook' && distance(player, places.kitchen) > 100) {
    toast('先走到厨房的炉灶旁，再开始做饭吧。');
    return;
  }
  const snack = kind === 'eat' && !diningMeal.servings && !pocket.food
    ? pocket.icecream ? 'icecream' : pocket.slush ? 'slush' : null : null;
  if (kind === 'eat' && pocket.food < 1 && diningMeal.servings < 1 && !snack) {
    toast('背包里还没有饭，先去厨房做一份吧。');
    return;
  }
  if (kind === 'cook' && recipe.item && pocket[recipe.item] + fridge.stock[recipe.item] < 1) {
    toast(`背包和冰箱里都没有${chilledItems[recipe.item].name}，先准备食材吧。`);
    return;
  }
  if (kind === 'eat') {
    if (diningMeal.servings) diningMeal.servings--;
    else if (snack) {
      pocket[snack]--;
      diningMeal.name = chilledItems[snack].name;
    } else {
      pocket.food--;
      diningMeal.name = '饭';
    }
    diningMeal.eatAt = null;
  }
  const ingredientReservation = kind === 'cook' && recipe.item
    ? reserveCookingIngredient(recipe.item) : null;
  const ingredientSource = ingredientReservation?.source || 'bag';
  if (carriedPet && kind !== 'sofa') clearPetCare(carriedPet);
  route = [];
  pendingPlace = null;
  keys.clear();
  player.walking = false;
  if (kind === 'wash') {
    player.x = handwashLayout.stand.x;
    player.y = handwashLayout.stand.y;
    player.view = 1;
    player.facing = -1;
  }
  if (kind === 'litter') {
    player.x = places.litter.x;
    player.y = places.litter.y;
    player.view = 1;
    player.facing = -1;
  }
  if (kind === 'cook') {
    // 固定在锅边的脚位开始动作，不能在“可互动”的一百像素范围内隔空做饭。
    player.x = places.kitchen.x;
    player.y = places.kitchen.y;
    player.view = 1;
    player.facing = -1;
  }
  if (kind === 'eat') {
    player.x = 712;
    player.y = 650;
    player.view = 2;
  }
  stopFarmVoices();
  document.querySelector('#kitchen-panel').hidden = true;
  livingSession = { kind, recipe, ingredientSource, ingredientReservation, started: clock, stage: 'cooking' };
  busyUntil = kind === 'sofa' ? Infinity : clock + (kind === 'wash' ? 6 : kind === 'cook' ? 7 : 4);
  if (kind === 'sofa' && (diningMeal.servings || pocket.food)) diningMeal.eatAt = clock + 12;
  if (kind === 'cook' && recipe.item === 'mushrooms') {
    // 食材只预扣一次；清洗和回炉都属于同一次做饭，取消仍退回蘑菇。
    livingSession.stage = 'to-sink';
    route = findPath(kitchenLayout.sink);
    busyUntil = 0;
    if (!route.length) {
      stopLivingAction();
      toast('水槽旁暂时走不到，请换个位置再试。');
      return;
    }
    toast('先拿蘑菇到水槽，冲洗干净再煮汤。', 5);
    return;
  }
  toast(
    {
      wash: '先挤洗手液，再认真搓搓手。',
      litter: '拿起猫砂铲，轻轻铲一铲、抖掉干净的砂。',
      sofa: '慢慢坐下，在沙发上休息。按 E 或移动可以起来。',
      cook: '打开炉灶，放入食材，慢慢搅拌…',
      eat: '在饭桌旁坐好，开始吃饭啦。'
    }[kind],
    5
  );
}

function updateLiving() {
  if (!livingSession) return;
  if (movementKeys.some((key) => keys.has(key))) {
    stopLivingAction();
    return;
  }
  const t = clock - livingSession.started;
  if (livingSession.kind === 'cook' && livingSession.stage === 'carrying' && !route.length) {
    player.x = mealDeliveryPoint.x;
    player.y = mealDeliveryPoint.y;
    player.view = 1;
    player.facing = -1;
    livingSession.stage = 'placing';
    livingSession.started = clock;
    busyUntil = clock + 0.9;
    return;
  }
  if (livingSession.kind === 'cook' && livingSession.stage === 'placing') {
    if (clock >= busyUntil) stopLivingAction(true);
    return;
  }
  if (livingSession.kind === 'cook' && livingSession.stage !== 'cooking') {
    if (livingSession.stage === 'to-sink' && !route.length) {
      player.x = kitchenLayout.sink.x;
      player.y = kitchenLayout.sink.y;
      player.view = 1;
      player.facing = -1;
      livingSession.stage = 'washing';
      livingSession.started = clock;
      busyUntil = clock + 3.5;
      playBathSound();
      toast('打开水龙头，轻轻揉洗蘑菇，冲掉泥土。');
    } else if (livingSession.stage === 'washing' && clock >= busyUntil) {
      stopBathSound();
      livingSession.stage = 'to-pot';
      route = findPath(places.kitchen);
      busyUntil = 0;
      if (!route.length) {
        stopLivingAction();
        toast('锅边暂时走不到，蘑菇已放回背包。');
      } else toast('蘑菇洗干净啦，拿回锅边煮汤。');
    } else if (livingSession.stage === 'to-pot' && !route.length) {
      player.x = places.kitchen.x;
      player.y = places.kitchen.y;
      player.view = 1;
      player.facing = -1;
      livingSession.stage = 'cooking';
      livingSession.started = clock;
      busyUntil = clock + 7;
    }
    return;
  }
  if (livingSession.kind === 'wash' && t >= 4 && t < 5.5) playBathSound();
  if (livingSession.kind === 'wash' && t >= 5.5) stopBathSound();
  if (livingSession.kind === 'cook' && clock >= busyUntil) {
    livingSession.cooked = true;
    livingSession.stage = 'carrying';
    route = findPath(mealDeliveryPoint);
    busyUntil = 0;
    if (!route.length) {
      stopLivingAction();
      toast('饭做好了，桌边暂时走不到，先放进背包。');
    } else toast('做好啦！端稳饭碗，送到饭桌上。');
    return;
  }
  if (livingSession.kind !== 'sofa' && clock >= busyUntil) stopLivingAction(true);
}

function updateMealTime() {
  if (scene !== 'house' || diningMeal.eatAt === null || clock < diningMeal.eatAt) return;
  if (
    sleepSession ||
    bathSession ||
    doorTransition ||
    petFeedingAction ||
    shoeAction ||
    (livingSession && livingSession.kind !== 'sofa') ||
    (!livingSession && clock < busyUntil) ||
    route.length ||
    pendingPlace ||
    keys.size ||
    wardrobe.open ||
    gameChoicePanelOpen() ||
    gameDialogOpen()
  )
    return;
  diningMeal.eatAt = null;
  if (diningMeal.servings < 1 && pocket.food < 1) return;
  if (livingSession?.kind === 'sofa') stopLivingAction();
  toast('休息好啦，走到饭桌旁，转身坐好吃饭。');
  walkTo(places.dining, 'dining');
}

function drawMealDish(x, y) {
  ctx.save();
  if (livingSession?.kind === 'eat' && ['冰淇淋', '冰沙'].includes(diningMeal.name)) {
    ctx.fillStyle = '#f3edd8';
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 15, 24, 19, 4);
    ctx.fill();
    ctx.fillStyle = diningMeal.name === '冰淇淋' ? '#edc9b8' : '#efa35a';
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#eee6cb';
  ctx.beginPath();
  ctx.ellipse(x, y, 19, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9b475';
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 14, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLivingFurniture() {
  if (scene !== 'house') return;
  // 沙发、饭桌和鞋架保留在底图；新灶台独立绘制，底图中已去掉旧炉灶。
  const stand = kitchenLayout.stand;
  const crop = homeFurnitureRegions.stove;
  ctx.drawImage(
    homeFurnitureArt,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    stand.x,
    stand.y,
    stand.width,
    stand.height
  );
  drawKitchenPot();
  // 食物在开吃时已从库存扣除，但这一份仍留在桌上，直到吃完。
  // 盘子先于人物绘制，不能在坐姿头部上再叠一份食物。
  if (diningMeal.servings || livingSession?.kind === 'eat')
    drawMealDish(diningPlate.x, diningPlate.y);
  ctx.save();
  const bottle = handwashLayout.soap;
  const soap = ctx.createLinearGradient(bottle.x - 7, bottle.y + 7, bottle.x + 7, bottle.y + 27);
  soap.addColorStop(0, '#d2e8da');
  soap.addColorStop(1, '#789c8a');
  ctx.fillStyle = soap;
  ctx.beginPath();
  ctx.roundRect(bottle.x - 7, bottle.y + 7, 14, 20, 4);
  ctx.fill();
  ctx.strokeStyle = '#738b7b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const pumpPress = livingSession?.kind === 'wash' && clock - livingSession.started < 1.2
    ? Math.sin((clock - livingSession.started) / 1.2 * Math.PI) * 3
    : 0;
  ctx.moveTo(bottle.x, bottle.y + 7);
  ctx.lineTo(bottle.x, bottle.y + pumpPress);
  ctx.lineTo(bottle.x - 10, bottle.y + pumpPress);
  ctx.stroke();
  ctx.restore();
}

function drawKitchenPot() {
  const cooking = livingSession?.kind === 'cook' && livingSession.stage === 'cooking';
  const t = cooking ? clock - livingSession.started : 0;
  ctx.save();
  applyKitchenSurface();
  if (cooking) {
    // 火焰先画在锅底，再画锅，避免火苗盖住食物。
    ctx.fillStyle = '#efab477d';
    ctx.beginPath();
    ctx.ellipse(216, 548, 22, 7 + Math.sin(t * 14), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 保持铁锅原始比例；锅柄朝向站在炉灶右侧的暖暖。
  ctx.drawImage(cookingPanArt, 24, 351, 1212, 583, 178, 506, 96, (96 * 583) / 1212);
  if (cooking && t > 0.5) {
    const recipe = livingSession.recipe;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(216, 537, 21, 10, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = recipe.item === 'mushrooms' ? '#cfac73' : '#eedbb0';
    ctx.fillRect(193, 526, 46, 24);
    if (recipe.item === 'fish') {
      ctx.drawImage(trout, 195, 524, 42, 24);
    } else {
      for (let i = 0; i < 18; i++) {
        const x = 200 + ((i * 11) % 33) + Math.sin(t * 5 + i) * 1.5;
        const y = 529 + ((i * 7) % 15);
        ctx.fillStyle =
          recipe.item === 'mushrooms' ? '#886746' : ['#679657', '#ed995c', '#fff1cf'][i % 3];
        ctx.beginPath();
        ctx.ellipse(x, y, recipe.item === 'mushrooms' ? 4 : 2.5, 2, i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawCookingAction(t) {
  ctx.save();
  applyKitchenSurface();
  const pouring = t < 1.3;
  const serving = t >= 5.5;
  const handX = pouring ? 264 : serving ? 267 : 254 + Math.sin(t * 6) * 7;
  const handY = pouring ? 510 : serving ? 520 : 515 + Math.cos(t * 6) * 4;
  ctx.strokeStyle = '#f3c4a0';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(
    (player.x - 20 - kitchenLayout.pot.x) / kitchenLayout.pot.scale + 178,
    (player.y - 78 - kitchenLayout.pot.y) / kitchenLayout.pot.scale + 506
  );
  ctx.lineTo(handX, handY);
  ctx.stroke();
  if (pouring) {
    ctx.fillStyle = '#e7e7ca';
    ctx.beginPath();
    ctx.ellipse(handX, handY, 14, 6, -0.35, 0, Math.PI * 2);
    ctx.fill();
    // 食材从手里的小碗落到锅里，而不是凭空出现在灶台上。
    for (let i = 0; i < 6; i++) {
      const p = Math.max(0, Math.min(1, (t - i * 0.09) / 0.7));
      if (!p || p === 1) continue;
      ctx.fillStyle = i % 2 ? '#719452' : '#e2ad63';
      ctx.beginPath();
      ctx.ellipse(handX + (216 - handX) * p, handY + (537 - handY) * p, 3, 2, p, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = '#936a40';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(216 + Math.sin(t * 6) * (serving ? 0 : 9), 536 + Math.cos(t * 6) * 3);
    ctx.stroke();
    // 手握木柄，勺头始终落在锅内，沿锅底小幅绕圈翻搅。
    ctx.fillStyle = '#bbc3c3';
    ctx.beginPath();
    ctx.ellipse(
      216 + Math.sin(t * 6) * (serving ? 0 : 9),
      536 + Math.cos(t * 6) * 3,
      5,
      3,
      -0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.fillStyle = '#f3c4a0';
    ctx.beginPath();
    ctx.arc(handX, handY, 4, 0, Math.PI * 2);
    ctx.fill();
    if (serving) {
      ctx.fillStyle = '#f4edce';
      ctx.beginPath();
      ctx.ellipse(245, 538, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d7ac76';
      ctx.beginPath();
      ctx.ellipse(245, 535, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (t > 1.3) {
    for (let i = 0; i < 5; i++) {
      const phase = (t * 0.45 + i / 5) % 1;
      ctx.globalAlpha = (1 - phase) * 0.55;
      ctx.fillStyle = '#fff8e7';
      ctx.beginPath();
      ctx.ellipse(
        202 + i * 7 + Math.sin(t * 2 + i) * 4,
        524 - phase * 44,
        3 + phase * 5,
        7 + phase * 4,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMushroomWashing(t) {
  const washing = livingSession.stage === 'washing';
  const x = washing ? 224 + Math.sin(t * 7) * 3 : player.x - 26;
  const y = washing ? 600 : player.y - 64;
  ctx.save();
  if (washing) {
    ctx.strokeStyle = '#f3c4a0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(player.x - 20, player.y - 78 + side * 4);
      ctx.lineTo(x + 4, y + side * 4);
      ctx.stroke();
    }
    ctx.strokeStyle = '#b9e5f4b3';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(215, 578);
    ctx.lineTo(x - 4, y + 7);
    ctx.stroke();
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i < 3 && t < 2 ? '#8b6e50' : '#d9f4f9b3';
      ctx.beginPath();
      ctx.arc(x - 10 + ((i * 7) % 24), y + 8 + ((t * 25 + i * 5) % 13), 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#f2dfbd';
  ctx.fillRect(x - 2, y, 5, 8);
  ctx.fillStyle = '#967350';
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 10, 6, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSittingGirl(x, y, view = 0) {
  const atlas = currentClothes(),
    cw = atlas.naturalWidth / 4,
    ch = atlas.naturalHeight / 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.drawImage(atlas, cw, view * ch, cw, ch * 0.76, -57, -112, 114, 112);
  // 面向电视时腿在沙发前侧，被座垫和靠背挡住，不能画在靠背外面。
  if (view === 2) {
    ctx.restore();
    return;
  }
  ctx.strokeStyle = '#f8eedf';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 13, -3);
    ctx.lineTo(side * 22, 13);
    ctx.lineTo(side * 22, 29);
    ctx.stroke();
    drawFootwear(side * 22, 33, 1);
  }
  ctx.restore();
}

function drawLivingAction() {
  canvas.dataset.living = livingSession?.kind || 'idle';
  canvas.dataset.cookingStage =
    livingSession?.kind === 'cook'
      ? livingSession.stage !== 'cooking'
        ? livingSession.stage
        : clock - livingSession.started < 1.3
          ? 'ingredients'
          : clock - livingSession.started < 5.5
            ? 'stirring'
            : 'serving'
      : 'idle';
  if (!livingSession) return;
  const t = clock - livingSession.started,
    kind = livingSession.kind;
  if (kind === 'litter') {
    drawLitterCleaning(t);
    return;
  }
  if (kind === 'cook' && ['carrying', 'placing'].includes(livingSession.stage)) {
    const p = livingSession.stage === 'placing' ? Math.min(1, t / 0.9) : 0;
    const handX = player.x + (player.view === 1 ? player.facing * 26 : 20);
    const handY = player.y - 78;
    const dishX = handX + (diningPlate.x - handX) * p;
    const dishY = handY + (diningPlate.y - handY) * p;
    ctx.save();
    ctx.strokeStyle = '#f3c4a0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(player.x + (handX > player.x ? 16 : -16), handY - 4);
    ctx.lineTo(dishX + (handX > player.x ? -10 : 10), dishY + 4);
    ctx.stroke();
    drawMealDish(dishX, dishY);
    ctx.restore();
    return;
  }
  if (kind === 'cook' && livingSession.stage !== 'cooking') {
    drawMushroomWashing(t);
    return;
  }
  if (kind === 'sofa') {
    ctx.save();
    // 从沙发后面看，靠背遮住下半身；头和上背露在靠背上方。
    ctx.beginPath();
    ctx.rect(360, 440, 246, 130);
    ctx.clip();
    drawSittingGirl(510, 584 + Math.min(1, t / 0.7) * 8, 2);
    ctx.restore();
    return;
  }
  if (kind === 'eat') {
    const pose = diningPoseRegions[outfit];
    // 独立坐姿朝向桌面；站姿由主绘制分支排除，椅背再遮住臀部。
    if (['pajamas', 'down', 'robe'].includes(outfit)) {
      ctx.save();
      ctx.translate(712, 644 + Math.min(1, t / 0.5) * 5);
      ctx.scale(0.63, 1);
      drawSittingGirl(0, 0, 2);
      ctx.restore();
    } else
      ctx.drawImage(
        diningPoseArt,
        pose.x,
        pose.y,
        pose.width,
        pose.height,
        712 - 36,
        530 + Math.min(1, t / 0.5) * 5,
        72,
        120
      );
    ctx.drawImage(interior, 684, 622, 68, 31, 684, 622, 68, 31);
    return;
  }
  ctx.save();
  ctx.strokeStyle = '#f5c2a1';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  if (kind === 'wash') {
    const rub = t >= 1.2 && t < 4,
      handX = handwashLayout.hands.x + Math.sin(t * 11) * (rub ? 3 : 0),
      handY = handwashLayout.hands.y;
    for (const side of [-1, 1]) {
      const pressing = t < 1.2 && side === 1;
      const catching = t < 1.2 && side === -1;
      const x = pressing ? handwashLayout.soap.x
        : catching ? handwashLayout.soap.x - 10 : handX + side * 3;
      const y = pressing
        ? handwashLayout.soap.y + Math.sin(t / 1.2 * Math.PI) * 3
        : catching ? handwashLayout.soap.y + 15
        : handY + side * 2 + (rub ? Math.cos(t * 9) * 2 : 0);
      ctx.beginPath();
      ctx.moveTo(player.x - 12, player.y - 65 + side * 3);
      ctx.quadraticCurveTo(player.x - 22, player.y - 59, x, y);
      ctx.stroke();
    }
    if (t < 1.2) {
      // 一只手按泵头，另一只手接住从短嘴落下的皂液。
      ctx.fillStyle = '#edf9e8';
      ctx.beginPath();
      ctx.arc(handwashLayout.soap.x - 10, handwashLayout.soap.y + 4 + (t / 1.2 % 1) * 8, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#edf9e8';
      ctx.beginPath();
      ctx.ellipse(handwashLayout.soap.x - 10, handwashLayout.soap.y + 15, 5 * Math.min(1, t / 1.2), 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t >= 1.1 && t < 5.2) {
      ctx.fillStyle = '#f6ffffcc';
      for (let i = 0; i < 14; i++) {
        const fade = t > 4 ? Math.max(0, (5.2 - t) / 1.2) : 1;
        ctx.globalAlpha = fade;
        ctx.beginPath();
        ctx.arc(
          handX - 7 + ((i * 13) % 15),
          handY - 5 + ((i * 7) % 11),
          2 + (i % 2),
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (t >= 4 && t < 5.5) {
      ctx.strokeStyle = '#a7d8e9';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(handwashLayout.faucet.x, handwashLayout.faucet.y);
      ctx.lineTo(handX, handY);
      ctx.stroke();
    }
    if (t >= 5.5) {
      ctx.fillStyle = '#b9d4cc';
      ctx.beginPath();
      ctx.roundRect(handX - 10, handY - 4, 20, 10, 3);
      ctx.fill();
    }
  } else if (kind === 'cook') {
    drawCookingAction(t);
  }
  ctx.restore();
}

document
  .querySelectorAll('[data-recipe]')
  .forEach((button) =>
    button.addEventListener('click', () =>
      beginLivingAction('cook', recipes[button.dataset.recipe])
    )
  );
document
  .querySelector('#close-kitchen')
  .addEventListener('click', () => (document.querySelector('#kitchen-panel').hidden = true));
