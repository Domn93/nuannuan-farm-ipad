// 集市的摊位在道路两侧，交互站位留在通道内，不在暖暖身上叠加柜台。
const marketStalls = {
  picnic: explorePlaces.city.picnic,
  marketFruit: { x: 1130, y: 570, label: '果蔬摊领取水果和蔬菜', icon: '🍎', readyAt: 0 },
  marketSeeds: { x: 420, y: 530, label: '花种摊领取小花束', icon: '🌼', readyAt: 0 },
  marketTalk: { x: 700, y: 520, label: '和摊主聊聊天', icon: '♡', readyAt: 0 }
};
Object.entries(marketStalls).forEach(([key, stall]) => {
  explorePlaces.city[key] = stall;
});
let marketVisit = null;
let marketGreetingIndex = 0;
let marketVisitors = [];
// 城市居民拥有自己的关系，进地图或打开聊天面板不会自动交友。
const cityFriends = [
  {
    name: '阿乐', row: 1, height: 190, x: 430, y: 700, friend: false,
    greeting: '你好，我叫阿乐！我住在城里，喜欢骑车和踢球。',
    familiar: '暖暖，又见面啦！要不要听听我今天的新发现？'
  },
  {
    name: '周叔叔', row: 4, height: 240, x: 1090, y: 780, friend: false,
    greeting: '你好，我是周叔叔。我常来这里买面包，认识你很高兴。',
    familiar: '暖暖，今天也来逛集市呀！最近农场怎么样？'
  }
];
cityFriends.forEach((friend, index) => {
  explorePlaces.city[`cityFriend${index}`] = {
    x: friend.x, y: friend.y + 45, label: `认识${friend.name}`, icon: '♡'
  };
});
explorePlaces.city.friends = { x: 370, y: 650, label: '沿左边小路回朋友聚会', icon: '↩' };

function setupMarketVisitors() {
  // 使用交友地图里的同一个朋友对象；在集市赠送礼物不会另建一份关系。
  Object.keys(explorePlaces.city).filter((key) => /^friend\d+$/.test(key))
    .forEach((key) => delete explorePlaces.city[key]);
  const familiar = friendGroup.map((friend, index) => ({ friend, index }))
    .filter(({ friend, index }) => friend.friend && index !== 3);
  if (familiar.length > 1) {
    const start = Math.floor(Math.random() * familiar.length);
    familiar.push(...familiar.splice(0, start));
  }
  marketVisitors = familiar.slice(0, 2).map((visitor, i) => ({
    ...visitor, x: i ? 1000 : 565, y: i ? 670 : 650
  }));
  marketVisitors.forEach(({ friend, index, x, y }) => {
    explorePlaces.city[`friend${index}`] = { x, y: y + 45, label: `和${friend.name}聊天`, icon: '♡' };
  });
  cityFriends.forEach((friend, index) => {
    explorePlaces.city[`cityFriend${index}`].label =
      `和${friend.name}${friend.friend ? '聊天' : '打招呼'}`;
  });
}

function interactMarket(place) {
  if (scene === 'city' && /^cityFriend\d+$/.test(place)) {
    const friend = cityFriends[Number(place.slice(10))];
    if (!friend) return false;
    chattingFriend = friend;
    document.querySelector('#friend-title').textContent =
      `和${friend.name}${friend.friend ? '聊天' : '交朋友'}`;
    document.querySelector('#friend-line').textContent = friend.friend ? friend.familiar : friend.greeting;
    document.querySelector('#friend-panel').hidden = false;
    route = [];
    return true;
  }
  const stall = marketStalls[place];
  if (!stall || (scene !== 'city' && !(scene === 'bakery' && place === 'picnic'))) return false;
  if (marketVisit || clock < busyUntil) return true;
  if (clock < stall.readyAt) {
    toast(place === 'marketTalk' ? '摊主正招呼客人，稍等一小会儿。' : '摊主正准备下一份，稍等一小会儿。');
    return true;
  }
  if (place === 'picnic' && pocket.coins < 2) {
    toast('一份面包要 2 金币，背包里的金币不够啦。');
    return true;
  }
  if (place === 'marketTalk') {
    if (friendGroup[3].friend) {
      chattingFriend = friendGroup[3];
      document.querySelector('#friend-title').textContent = '和林阿姨聊天';
      document.querySelector('#friend-line').textContent = '暖暖，你也来逛集市啦！我刚给家里挑好了新鲜蔬菜。';
      document.querySelector('#friend-panel').hidden = false;
      route = [];
      return true;
    }
    const greetings = [
      '早上摘的水果可甜啦！玩累了，记得吃一点。',
      '森林里的小松鼠很害羞，慢慢走近它就好。',
      '谢谢你来逛集市，欢迎带朋友一起来！'
    ];
    toast(greetings[marketGreetingIndex++ % greetings.length], 5);
    stall.readyAt = clock + 12;
    burst('♡', 780, 320, 2);
    return true;
  }
  // 发放在短暂打包结束后提交；离开集市会取消，避免返回地图时重复领到。
  marketVisit = { place, started: clock, scene };
  route = [];
  player.walking = false;
  busyUntil = clock + 1.3;
  toast(place === 'picnic' ? '摊主正在把香喷喷的面包装进纸袋……' :
    place === 'marketFruit' ? '摊主正在把水果装进纸袋……' : '摊主正在把小花束扎好……', 2);
  return true;
}

function updateMarket(dt) {
  if (!marketVisit) return;
  if (scene !== marketVisit.scene) {
    marketVisit = null;
    return;
  }
  if (clock - marketVisit.started < 1.3) return;
  const place = marketVisit.place;
  marketVisit = null;
  // 扣款和入包同时提交，打包途中离开地图不会丢钱。
  if (place === 'picnic') {
    if (pocket.coins < 2) {
      toast('金币不够，这次没有购买，也没有扣钱。');
      return;
    }
    pocket.coins -= 2;
    pocket.bread++;
    marketStalls[place].readyAt = clock + 4;
    toast(`买到一份面包，放进背包啦！还剩 ${pocket.coins} 金币。`);
    burst('🥐', player.x, player.y - 70, 3);
  } else if (place === 'marketFruit') {
    marketStalls[place].readyAt = clock + 45;
    pocket.fruit += 2;
    pocket.vegetables++;
    toast('领到两份新鲜水果和一份蔬菜，都放进背包啦！');
    burst('🍎', player.x, player.y - 70, 3);
  } else {
    marketStalls[place].readyAt = clock + 45;
    pocket.flowers += 2;
    toast('领到两朵花，可以带回家，也可以送给朋友。');
    burst('🌼', player.x, player.y - 70, 3);
  }
  refreshBackpack();
}

function drawMarket(front = false) {
  if (scene !== 'city' || !friendsArt.complete || !friendsArt.naturalWidth) return;
  // 医院门前留出通道，摊主站在旁边，不遮住真实门板和进门站位。
  const people = [{ friend: friendGroup[3], x: 680, y: 450 }, ...marketVisitors,
    ...cityFriends.map((friend) => ({ friend, x: friend.x, y: friend.y }))];
  people.filter(({ y }) => (y > player.y) === front).forEach(({ friend, x, y }) => {
    const sprite = seasonalFriendSprite(friend.row, 0), region = sprite.region;
    const size = friend.height * 0.7 * sceneScale(y);
    const scale = size / region.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#31441b25';
    ctx.beginPath();
    ctx.ellipse(0, -2, size * 0.12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // 完整透明人物只绘制一次，脚底固定在地面，呼吸不会造成贴图重影。
    ctx.drawImage(
      sprite.art, region.x, region.y, region.width, region.height,
      (region.x - region.centerX) * scale, -size, region.width * scale, size
    );
    ctx.restore();
  });
}
