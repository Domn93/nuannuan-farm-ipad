// 岔路口、森林、城市、朋友聚会，以及共享背包和交友互动。

const explorationScenes = ['junction', 'forest', 'city', 'friends'];
const friendsArt = new Image();
friendsArt.src = 'assets/friend-characters.png';
// 每行一个独立人物，每列为正面、迈左脚、侧面站姿、迈右脚。
// 原图1086×1448，各行高度不等；按实际透明轮廓裁切，不能均分行高。
// centerX 是该帧原始站位中心，脚底始终落在角色的地面坐标上。
const friendSpriteRegions = [
  [
    { x: 94, y: 17, width: 108, height: 242, centerX: 136 },
    { x: 338, y: 16, width: 141, height: 242, centerX: 407.5 },
    { x: 615, y: 16, width: 99, height: 243, centerX: 678.5 },
    { x: 864, y: 17, width: 141, height: 242, centerX: 950 }
  ],
  [
    { x: 99, y: 267, width: 95, height: 245, centerX: 136 },
    { x: 338, y: 267, width: 141, height: 246, centerX: 407.5 },
    { x: 628, y: 268, width: 90, height: 246, centerX: 678.5 },
    { x: 865, y: 269, width: 142, height: 244, centerX: 950 }
  ],
  [
    { x: 94, y: 519, width: 104, height: 246, centerX: 136 },
    { x: 339, y: 520, width: 148, height: 246, centerX: 407.5 },
    { x: 630, y: 522, width: 91, height: 244, centerX: 678.5 },
    { x: 864, y: 522, width: 151, height: 243, centerX: 950 }
  ],
  [
    { x: 78, y: 769, width: 132, height: 328, centerX: 136 },
    { x: 321, y: 771, width: 180, height: 326, centerX: 407.5 },
    { x: 622, y: 772, width: 101, height: 325, centerX: 678.5 },
    { x: 862, y: 771, width: 171, height: 327, centerX: 950 }
  ],
  [
    { x: 73, y: 1102, width: 141, height: 332, centerX: 136 },
    { x: 320, y: 1105, width: 189, height: 327, centerX: 407.5 },
    { x: 627, y: 1103, width: 85, height: 331, centerX: 678.5 },
    { x: 853, y: 1105, width: 194, height: 327, centerX: 950 }
  ]
];
const friendGroup = [
  {
    name: '小禾',
    x: 380,
    y: 570,
    row: 0,
    height: 180,
    friend: false,
    greeting: '你好，我叫小禾！要一起找漂亮的花吗？',
    familiar: '暖暖，你来啦！我发现了一朵好看的小花。'
  },
  {
    name: '米米',
    x: 680,
    y: 490,
    row: 1,
    height: 190,
    friend: false,
    greeting: '我是米米，最喜欢在草地上踢球啦！',
    familiar: '暖暖，要不要和我一起玩球？'
  },
  {
    name: '豆豆',
    x: 1030,
    y: 620,
    row: 2,
    height: 175,
    friend: false,
    greeting: '你好呀，我是豆豆。我刚刚看见一只蝴蝶！',
    familiar: '暖暖，今天也一起去看看小动物吧！'
  },
  {
    name: '林阿姨',
    x: 450,
    y: 740,
    row: 3,
    height: 230,
    friend: false,
    greeting: '你好，暖暖！我是林阿姨，欢迎来这里玩。',
    familiar: '暖暖，玩累了就歇一歇，阿姨给你留了点心。'
  },
  {
    name: '陈叔叔',
    x: 1160,
    y: 480,
    row: 4,
    height: 240,
    friend: false,
    greeting: '你好，我是陈叔叔。需要帮忙就来找我。',
    familiar: '暖暖，农场的小伙伴们今天都好吗？'
  }
];
let chattingFriend = null;
const forestMushrooms = [
  { x: 390, y: 580 },
  { x: 670, y: 680 },
  { x: 1070, y: 570 },
  { x: 1200, y: 760 }
].map((point) => ({ ...point, readyAt: 0 }));
const forestMushroomSpots = [
  [310, 465], [450, 375], [600, 425], [850, 345], [1010, 400], [1230, 460],
  [1280, 625], [1210, 775], [965, 755], [755, 625], [525, 730], [340, 745]
];
const explorePlaces = {
  junction: {
    forest: { x: 270, y: 490, label: '沿左边小路进森林', icon: '🌲' },
    city: { x: 1250, y: 500, label: '沿右边小路进集市', icon: '🏙' },
    village: { x: 830, y: 420, label: '沿前面的小路进村庄', icon: '🏘' },
    friends: { x: 768, y: 420, label: '直走找朋友', icon: '♡' },
    returnFarm: { x: 768, y: 900, label: '回农场', icon: '⌂' }
  },
  forest: {
    ...Object.fromEntries(
      forestMushrooms.map((m, i) => [
        `mushroom${i}`,
        { x: m.x, y: m.y, label: '采一朵蘑菇', icon: '🍄' }
      ])
    ),
    junction: { x: 768, y: 900, label: '返回岔路口', icon: '↩' }
  },
  city: {
    picnic: { x: 1110, y: 470, label: '买一份面包 · 2 金币', icon: '🥐', readyAt: 0 },
    junction: { x: 768, y: 900, label: '返回岔路口', icon: '↩' }
  },
  friends: {
    ...Object.fromEntries(
      friendGroup.map((f, i) => [
        `friend${i}`,
        { x: f.x, y: f.y + 55, label: `和${f.name}打招呼`, icon: '♡' }
      ])
    ),
    city: { x: 1350, y: 630, label: '沿右边小路去城市', icon: '🏙' },
    junction: { x: 768, y: 900, label: '返回岔路口', icon: '↩' }
  }
};
for (const map of Object.values(explorePlaces)) {
  map.dog = { x: 710, y: 680, label: '牵萨摩耶散步', icon: '🐕' };
  map.cat = { x: 925, y: 565, label: '摸摸布偶猫', icon: '♡' };
}
outdoorPlaces.travel = { x: 640, y: 900, label: '走出农场', icon: '🧭' };

function isExploring() {
  return explorationScenes.includes(scene);
}
function onForestFloor(x, y) {
  return insidePolygon(x, y, [
    [270, 335], [455, 265], [850, 265], [1090, 310], [1290, 390],
    [1350, 590], [1300, 815], [895, 865], [635, 855], [235, 810], [190, 565]
  ]) || (x > 645 && x < 890 && y >= 850 && y < 955);
}

function relocateForestMushroom(mushroom) {
  const options = forestMushroomSpots.filter(([x, y]) =>
    Math.hypot(x - mushroom.x, y - mushroom.y) > 130 &&
    Math.hypot(x - forestTimber.x, y - forestTimber.y) > 100 &&
    forestMushrooms.every((other) => other === mushroom || Math.hypot(x - other.x, y - other.y) > 150));
  if (!options.length) return;
  const [x, y] = options[Math.floor(Math.random() * options.length)];
  mushroom.x = x;
  mushroom.y = y;
  const marker = explorePlaces.forest[`mushroom${forestMushrooms.indexOf(mushroom)}`];
  marker.x = x;
  marker.y = y;
}

function onExploreGround(x, y) {
  // 台阶前的窄通道只通向仍保留的房门，不开放屋顶或整个后景。
  if (scene === 'friends' && x > 1360 && x < 1446 && y > 270 && y <= 400) return true;
  if (scene === 'city' && ((x > 375 && x < 475 && y > 355 && y <= 435) ||
    (x > 1175 && x < 1285 && y > 430 && y < 550) ||
    (x > 910 && x < 965 && y > 245 && y <= 415))) return true;
  if (scene === 'forest')
    return onForestFloor(x, y) && Math.hypot(x - forestTimber.x, y - forestTimber.y) > 35;
  if (x < 90 || x > 1446 || y < 365 || y > 965) return false;
  if (scene === 'city')
    return ((x > 340 && x < 1200 && y > 405 && y < 850) ||
      (x > 645 && x < 890 && y >= 850 && y < 955)) &&
      Math.hypot(x - 680, y - 450) > 24;
  // 外出地图的边缘花坛和近景围栏不是可穿行地面。
  if (y > 780 && (x < 400 || x > 1130)) return false;
  return true;
}

function setupExploration() {
  const exploring = isExploring();
  chattingFriend = null;
  document.querySelector('#friend-panel').hidden = true;
  document.querySelector('#explore-buttons').hidden = !exploring;
  if (!exploring) return;
  if (scene === 'city') setupMarketVisitors();
  document.querySelector('#scene-name').textContent = {
    junction: '🧭 农场外的岔路口',
    forest: '🌲 森林',
    city: '🥐 村庄集市',
    friends: '♡ 朋友聚会'
  }[scene];
  document.querySelector('#explore-title').textContent =
    scene === 'junction' ? '往哪里走？' : '这里可以做什么？';
  document.querySelector('#explore-grid').innerHTML =
    (scene === 'forest'
      ? '<button data-explore-place="mushroomNearest">🍄 采附近的蘑菇</button>'
      : '') +
    Object.entries(places)
      .filter(([key]) => key !== 'dog' && key !== 'cat' && !key.startsWith('mushroom'))
      .map(([key, p]) => `<button data-explore-place="${key}">${p.icon} ${p.label}</button>`)
      .join('');
  document.querySelector('#go-house').hidden = true;
  document.querySelector('#room-buttons').hidden = true;
  document.querySelector('#farm-buttons').hidden = true;
  player.x = 768;
  player.y = 820;
  // 宠物的位置由是否牵绳/抱起决定，重新进图不能把留下的狗搬到入口。
  updatePetPlaceMarkers();
  rebuildGrid();
  toast(
    {
      junction: '左边是森林，前面能进村庄，右边是集市，也可以去找朋友。',
      forest: '走进森林啦！可以捕虫、和小动物玩，或者收集木材。',
      city: '城市集市到了！可以买面包，也可以主动认识这里的新朋友。',
      friends: '走近打个招呼吧。沿右边的小路一直走，就能去城市。'
    }[scene],
    6
  );
}

function interactExploration(place) {
  if (place === 'travel' || place === 'returnFarm') {
    changeScene(place === 'travel' ? 'junction' : 'farm',
      place === 'returnFarm' ? { x: 690, y: 835 } : null);
    return true;
  }
  if (!isExploring()) return false;
  if (interactForestAdventure(place) || interactMarket(place)) return true;
  if (scene === 'junction' && place === 'village') {
    changeScene('city');
    return true;
  }
  if (scene === 'friends' && place === 'city') {
    changeScene('city', { x: 410, y: 650 });
    return true;
  }
  if (scene === 'city' && place === 'friends') {
    changeScene('friends', { x: 1260, y: 630 });
    return true;
  }
  if (explorationScenes.includes(place)) {
    const junctionArrival = scene === 'forest' ? { x: 420, y: 560 }
      : scene === 'city' ? { x: 1090, y: 560 }
        : scene === 'friends' ? { x: 768, y: 510 } : null;
    changeScene(place, place === 'junction' ? junctionArrival : null);
    return true;
  }
  if (place.startsWith('mushroom')) {
    const mushroom = forestMushrooms[Number(place.slice(8))];
    if (clock < mushroom.readyAt) toast('这朵已经采过啦，过一会儿再来。');
    else {
      mushroom.readyAt = clock + 90;
      relocateForestMushroom(mushroom);
      pocket.mushrooms++;
      recordDiscovery('mushroom');
      burst('🍄', player.x, player.y - 90, 3);
      toast('采到蘑菇啦，已经放进背包。');
    }
    return true;
  }
  if (place.startsWith('friend')) {
    chattingFriend = friendGroup[Number(place.slice(6))];
    const needsBath = hygiene.dirt >= 75;
    document.querySelector('#friend-title').textContent =
      `和${chattingFriend.name}${chattingFriend.friend ? '聊天' : '交朋友'}`;
    document.querySelector('#friend-line').textContent = needsBath
      ? '你身上有绿色脏东西，闻起来不太舒服。先回家洗个澡，我们再一起玩吧。'
      : chattingFriend.friend
      ? chattingFriend.familiar
      : chattingFriend.greeting;
    document.querySelectorAll('#friend-panel [data-friend-action]')
      .forEach((button) => { button.disabled = needsBath; });
    document.querySelector('#friend-panel').hidden = false;
    route = [];
    return true;
  }
  return false;
}

function friendAction(action) {
  if (!chattingFriend || !['hello', 'flower', 'food'].includes(action)) return;
  if (hygiene.dirt >= 75) {
    document.querySelector('#friend-line').textContent = '先回家洗澡，洗干净再来一起玩吧。';
    return;
  }
  synchronizeBagFood();
  const alreadyFriends = chattingFriend.friend;
  const sharedFood = action === 'food' ? ['bread', 'fruit', 'food'].find((item) => pocket[item] > 0) : null;
  if (action === 'flower' || action === 'food') {
    const item = action === 'flower' ? 'flowers' : sharedFood;
    if (!item || pocket[item] < 1) {
      document.querySelector('#friend-line').textContent =
        action === 'flower'
          ? '背包里还没有花，先去农场采一朵吧。'
          : '背包里还没有食物，去城市面包摊看看吧。';
      return;
    }
    pocket[item]--;
  }
  if (!chattingFriend.friend) {
    chattingFriend.friend = true;
    pocket.hearts++;
  }
  document.querySelector('#friend-title').textContent = `和${chattingFriend.name}聊天`;
  document.querySelector('#friend-line').textContent = {
    hello: alreadyFriends ? chattingFriend.familiar : '我们成为朋友啦！下次还可以一起来玩。',
    flower: '谢谢你的花！我很喜欢。',
    food: sharedFood ? `谢谢你分享${chilledItems[sharedFood].name}，我们一起野餐吧。` : ''
  }[action];
  burst('♡', player.x, player.y - 100, 4);
  refreshBackpack();
}

function refreshBackpack() {
  synchronizeBagFood();
  const supplies = [
    ['coins', '🪙 金币'],
    ['flowers', '🌼 花朵'],
    ['fish', '🐟 小鱼'],
    ['food', '🍚 做好的饭'],
    ['bread', '🥐 面包'],
    ['fruit', '🍎 水果'],
    ['vegetables', '🥬 蔬菜'],
    ['meat', '🥩 肉类'],
    ['icecream', '🍨 冰淇淋'],
    ['slush', '🍧 冰沙'],
    ['mushrooms', '🍄 蘑菇'],
    ['insects', '🦋 捕到的虫子'],
    ['wood', '🪵 木材'],
    ['leaves', '🍃 树叶'],
    ['spoiledFood', '🗑 变质食物（不能食用，回冰箱旁清理）']
  ]
    .map(([key, label]) => `<li><span>${label}</span><strong>${pocket[key]}</strong></li>`)
    .join('');
  const activePatients = medicinePatients().filter((patient) => patient.health.course);
  const medicineBag = activePatients.length
    ? `<li class="medicine-bag-item"><span><img src="assets/medicine-pouch.png" alt="" /><span class="medicine-bag-details"><strong>小药袋</strong>${activePatients.map((patient) => {
      const course = patient.health.course;
      currentMedicineDay(course);
      const bottles = course.location === 'pouch'
        ? gameMedicines.map((medicine, index) => `${medicine.name}×${course.remaining[index]}`).join('、')
        : course.collected.map((index) => gameMedicines[index].name).join('、');
      return `<small>${medicineOwnerLabel(patient)}：${bottles || '药在冰箱里，尚未取出'}</small>`;
    }).join('')}</span></span><button data-open-medicine>打开用药</button></li>`
    : '';
  document.querySelector('#bag-items').innerHTML = supplies + medicineBag;
  const nextFood = ['food', 'bread', 'fruit'].find((item) => pocket[item] > 0);
  document.querySelector('#eat-food').disabled = !nextFood;
  document.querySelector('#eat-food').textContent = nextFood ? `吃一份${chilledItems[nextFood].name}` : '吃一份食物';
}

function friendWanderGround(point) {
  // 活动范围沿真实草地铺开，避开房子、树下花坛、近景围栏和城市出口。
  return insidePolygon(point.x, point.y, [
    [300, 550], [475, 450], [1170, 445], [1240, 560],
    [1110, 755], [940, 825], [600, 825], [350, 730]
  ]) && canWalk(point.x, point.y);
}

function friendPersonalSpace(point, friend, other) {
  // 脚点相隔很远仍可能盖住脸：纵向间距跟随人物身高，而非只用脚边圆圈。
  const dx = (point.x - other.x) / 90;
  const dy = (point.y - other.y) / (Math.max(friend.height, other.height) * 0.75);
  return Math.hypot(dx, dy);
}

function updateFriendWandering(dt) {
  friendGroup.forEach((friend, index) => {
    const key = `friend${index}`, place = places[key];
    if (!friend.stroll) friend.stroll = {
      path: [], nextPlan: clock + index * 1.3,
      speed: (friend.row < 3 ? 32 : 25) + Math.random() * 5
    };
    const stroll = friend.stroll;
    friend.walking = false;
    const talking = chattingFriend === friend && document.querySelector('#friend-panel').hidden === false;
    // 暖暖正走来打招呼时也等一等，互动点不能一直逃离已选的路线。
    if (talking || pendingPlace === key) stroll.nextPlan = clock + 2;
    else {
      if (!stroll.path.length && clock >= stroll.nextPlan) {
        for (let attempt = 0; attempt < 16; attempt++) {
          const target = { x: 330 + Math.random() * 850, y: 455 + Math.random() * 350 };
          if (!friendWanderGround(target) || distance(friend, target) < 130 ||
              distance(player, target) < 90 ||
              friendGroup.some((other) => other !== friend &&
                (friendPersonalSpace(target, friend, other) < 1.2 ||
                  (other.stroll?.path.length && friendPersonalSpace(target, friend,
                    { ...other, ...other.stroll.path.at(-1) }) < 1.2)))) continue;
          const path = findPath(target, friend).slice(1);
          if (path.length && path.every(friendWanderGround)) {
            stroll.path = path;
            break;
          }
        }
        stroll.nextPlan = clock + 2 + Math.random() * 5;
      }
      // 绕行会略微偏离网格中心，走到附近即可取下一点，避免在同一格左右摆动。
      while (stroll.path.length && distance(friend, stroll.path[0]) < 12) stroll.path.shift();
      if (stroll.path.length && dt > 0) {
        const target = stroll.path[0], gap = distance(friend, target);
        const step = Math.min(gap, stroll.speed * dt);
        let dx = (target.x - friend.x) / gap, dy = (target.y - friend.y) / gap;
        // 提前轻轻绕开同行的人，不等撞到脚边后清路线、反复转身。
        for (const other of friendGroup) {
          if (other === friend) continue;
          const space = friendPersonalSpace(friend, friend, other);
          if (space >= 1.5) continue;
          const strength = (1.5 - space) * 2;
          const side = friend.x === other.x ? (index < friendGroup.indexOf(other) ? -1 : 1) : Math.sign(friend.x - other.x);
          dx += side * strength;
          dy += Math.sign(friend.y - other.y) * strength * 0.35;
        }
        const direction = Math.hypot(dx, dy) || 1;
        const point = { x: friend.x + dx / direction * step,
          y: friend.y + dy / direction * step };
        const crowded = distance(player, point) < 55 ||
          friendGroup.some((other) => other !== friend &&
            friendPersonalSpace(point, friend, other) < 1 &&
            friendPersonalSpace(point, friend, other) < friendPersonalSpace(friend, friend, other));
        if (crowded || !friendWanderGround(point)) {
          stroll.path = [];
          stroll.nextPlan = clock + 1.5 + Math.random() * 2;
        } else {
          const movedX = point.x - friend.x;
          friend.x = point.x;
          friend.y = point.y;
          friend.step = (friend.step || 0) + step / 12;
          friend.walking = step > 0;
          if (Math.abs(movedX) > step * 0.15 && clock >= (stroll.nextTurn || 0)) {
            friend.facing = movedX < 0 ? -1 : 1;
            stroll.nextTurn = clock + 0.6;
          }
          if (distance(friend, target) < 12) stroll.path.shift();
          if (!stroll.path.length) stroll.nextPlan = clock + 2 + Math.random() * 6;
        }
      }
    }
    place.x = friend.x;
    place.y = friend.y + 55;
  });
}

function explorationRoomHint() {
  const hint = scene === 'junction' ? '← 森林 · ↑ 朋友 · 前方村庄 · 集市 →' :
    scene === 'friends' ? '一直往右走 → 城市 · 走近新朋友，点动作按钮打招呼' :
      scene === 'city' ? '← 朋友聚会 · 医院和面包店间上楼去寄养所' :
        '走近探索，点动作按钮，也可打开活动菜单';
  return hint + (carriedPet || walkingDog ? ' · 点「放下 / 松绳」和伙伴歇歇脚' : '');
}

function updateExploration(dt = 0) {
  // 路口的画面道路就是入口，步行/点击走到这里即可进图，不必找到隐藏按钮。
  if (scene === 'junction' && clock >= busyUntil) {
    if ((!pendingPlace || pendingPlace === 'forest') &&
        player.x < 350 && player.y > 365 && player.y < 600) changeScene('forest');
    else if ((!pendingPlace || pendingPlace === 'city' || pendingPlace === 'village') &&
        player.x > 1150 && player.y > 425 && player.y < 600) changeScene('city');
  }
  // 聚会地图右侧与城市左侧连成一条路，落点留在出口以内，避免来回跳图。
  if (clock >= busyUntil) {
    // 去村舍的路线也经过侧边出口；有明确目标时，不能被路过的出口抢走。
    if (scene === 'friends' && (!pendingPlace || pendingPlace === 'city') &&
        player.x > 1320 && player.y > 420 && player.y < 760)
      changeScene('city', { x: 410, y: 650 });
    else if (scene === 'city' && (!pendingPlace || pendingPlace === 'friends') &&
        player.x < 395 && player.y > 580 && player.y < 740)
      changeScene('friends', { x: 1260, y: 630 });
  }
  if (scene === 'friends') updateFriendWandering(dt);
  if (isExploring()) {
    const hint = document.querySelector('#room-hint'), text = explorationRoomHint();
    if (hint.textContent !== text) hint.textContent = text;
  }
  if (document.querySelector('#backpack-dialog').open) refreshBackpack();
}

function drawExploreBackground() {
  ctx.drawImage(sceneryMaps[scene], 0, 0, W, H);
  if (scene === 'forest') {
    for (const mushroom of forestMushrooms) {
      if (clock < mushroom.readyAt) continue;
      ctx.save();
      ctx.translate(mushroom.x, mushroom.y);
      ctx.fillStyle = '#40532935';
      ctx.beginPath();
      ctx.ellipse(0, 0, 19, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      const stem = ctx.createLinearGradient(-6, 0, 6, 0);
      stem.addColorStop(0, '#b99e76');
      stem.addColorStop(0.5, '#f5e2ba');
      stem.addColorStop(1, '#cbb489');
      ctx.fillStyle = stem;
      ctx.beginPath();
      ctx.roundRect(-6, -25, 12, 25, 5);
      ctx.fill();
      const cap = ctx.createLinearGradient(0, -40, 0, -15);
      cap.addColorStop(0, '#df9b72');
      cap.addColorStop(0.6, '#a66343');
      cap.addColorStop(1, '#71482d');
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.ellipse(0, -25, 22, 14, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8dfae';
      for (const [x, y, r] of [
        [-8, -31, 3],
        [3, -35, 2],
        [12, -29, 2]
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

function drawFriends(front) {
  if (!friendsArt.complete || !friendsArt.naturalWidth) return;
  friendGroup.forEach((friend, i) => {
    if (friend.y > player.y !== front) return;
    const x = places[`friend${i}`].x,
      y = friend.y,
      size = friend.height * sceneScale(y);
    const walking = friend.walking,
      frame = walking ? [1, 2, 3, 2][Math.floor(friend.step || 0) % 4] : 0,
      sprite = seasonalFriendSprite(friend.row, frame),
      region = sprite.region;
    if (!region) return;
    const scale = size / region.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#31441b25';
    ctx.beginPath();
    ctx.ellipse(0, -2, size * 0.12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    if (walking) ctx.scale(friend.facing || 1, 1);
    ctx.drawImage(
      sprite.art,
      region.x,
      region.y,
      region.width,
      region.height,
      (region.x - region.centerX) * scale,
      -size,
      region.width * scale,
      region.height * scale
    );
    ctx.restore();
  });
}

document.querySelector('#explore-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-explore-place]');
  if (!button) return;
  let key = button.dataset.explorePlace;
  if (key === 'mushroomNearest') {
    const available = forestMushrooms
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => clock >= m.readyAt)
      .sort((a, b) => distance(player, a.m) - distance(player, b.m));
    if (!available.length) {
      toast('蘑菇都采过啦，过一会儿再来看看。');
      return;
    }
    key = `mushroom${available[0].i}`;
  }
  walkTo(places[key], key);
});
document.querySelector('#open-backpack').addEventListener('click', () => {
  refreshBackpack();
  document.querySelector('#backpack-dialog').showModal();
  keys.clear();
});
document.querySelector('#bag-items').addEventListener('click', (event) => {
  if (!event.target.closest('[data-open-medicine]')) return;
  document.querySelector('#backpack-dialog').close();
  document.querySelector('#open-medicine').click();
});
document
  .querySelector('#close-backpack')
  .addEventListener('click', () => document.querySelector('#backpack-dialog').close());
document.querySelector('#eat-food').addEventListener('click', () => {
  synchronizeBagFood();
  const item = ['food', 'bread', 'fruit'].find((key) => pocket[key] > 0);
  if (!item) return;
  pocket[item]--;
  pocket.hearts++;
  satisfyIPadHunger(item);
  refreshBackpack();
  toast(`吃了一份${chilledItems[item].name}，精神满满！`);
});
document
  .querySelectorAll('[data-friend-action]')
  .forEach((button) =>
    button.addEventListener('click', () => friendAction(button.dataset.friendAction))
  );
document.querySelector('#close-friend').addEventListener('click', () => {
  chattingFriend = null;
  document.querySelector('#friend-panel').hidden = true;
});
