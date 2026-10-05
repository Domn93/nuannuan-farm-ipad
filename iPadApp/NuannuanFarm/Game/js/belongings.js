// 图鉴、鞋架和袜子；室内穿拖鞋，外出鞋选择跨场景保留。

const footwear = { outdoor: 'sneakers', slippers: 'mint', socks: 'white' };
let shoeAction = null;
const shoeStyles = {
  sneakers: { name: '运动鞋', icon: '👟', color: '#d88ca2' },
  heels: { name: '高跟鞋', icon: '👠', color: '#b26679' },
  ballet: { name: '芭蕾舞鞋', icon: '🩰', color: '#e8b8c4' },
  boots: { name: '小靴子', icon: '🥾', color: '#a88051' }
};
const slipperStyles = {
  mint: { name: '薄荷拖鞋', color: '#86b9a5' },
  pink: { name: '粉色拖鞋', color: '#e4a6bb' },
  cream: { name: '奶油拖鞋', color: '#e9d3a6' }
};
const sockStyles = {
  white: { name: '白色短袜', color: '#fff5e9', long: false },
  pink: { name: '粉色短袜', color: '#efc4d2', long: false },
  striped: { name: '条纹长袜', color: '#e4eedd', long: true }
};
// 鞋架已绘入底图右下角；显示区域、脚下占地和站位采用同一份坐标。
const shoeRackLayout = {
  bounds: { x: 864, y: 547, width: 58, height: 163 },
  stand: { x: 825, y: 663 }
};
indoorPlaces.shoeRack = { ...shoeRackLayout.stand, label: '挑鞋子和袜子', icon: '👟' };

function currentShoes() {
  return scene === 'house'
    ? { ...slipperStyles[footwear.slippers], kind: 'slippers' }
    : { ...shoeStyles[footwear.outdoor], kind: footwear.outdoor };
}

function refreshShoeChoices() {
  for (const [id, choices, selected, attribute] of [
    ['shoe-options', shoeStyles, footwear.outdoor, 'shoe'],
    ['slipper-options', slipperStyles, footwear.slippers, 'slipper'],
    ['sock-options', sockStyles, footwear.socks, 'sock']
  ]) {
    document.querySelector('#' + id).innerHTML = Object.entries(choices)
      .map(
        ([key, item]) =>
          `<button data-${attribute}="${key}" aria-pressed="${key === selected}">${item.icon || '✿'} 拿出${item.name}</button>`
      )
      .join('');
  }
  document.querySelector('#shoe-summary').textContent =
    `现在穿着：${currentShoes().name} · ${sockStyles[footwear.socks].name}`;
}

function openShoeRack() {
  if (scene !== 'house' || clock < busyUntil) return;
  route = [];
  pendingPlace = null;
  keys.clear();
  player.walking = false;
  refreshShoeChoices();
  document.querySelector('#shoes-dialog').showModal();
}

// 鞋架已经绘入室内插画；挑鞋和袜子的互动仍使用原有对话框。

function updateShoeAction() {
  if (!shoeAction) return;
  if (scene !== 'house' || movementKeys.some((key) => keys.has(key))) {
    shoeAction = null;
    busyUntil = 0;
    return;
  }
  if (clock - shoeAction.started < 1.8) return;
  footwear[shoeAction.slot] = shoeAction.key;
  const name = shoeAction.item.name;
  const outdoor = shoeAction.slot === 'outdoor';
  shoeAction = null;
  busyUntil = 0;
  toast(outdoor ? `${name}准备好了，出门时换上；在家仍穿拖鞋。` : `从鞋架拿出并穿好了${name}。`);
}

function drawShoeAction() {
  canvas.dataset.shoeAction = shoeAction
    ? clock - shoeAction.started < 0.8
      ? 'taking'
      : 'wearing'
    : 'idle';
  if (!shoeAction || scene !== 'house') return;
  const t = clock - shoeAction.started;
  const p = Math.min(1, t / 0.8);
  const x = 890 + (player.x - 890) * p;
  const y = 630 + (player.y - 65 - 630) * p;
  ctx.save();
  if (t < 0.8) {
    ctx.fillStyle = shoeAction.item.color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * 9, y, 7, 15, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f8ead5';
      ctx.beginPath();
      ctx.ellipse(x + side * 9, y - 4, 4, 6, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shoeAction.item.color;
    }
  } else {
    ctx.fillStyle = '#fffbedee';
    ctx.beginPath();
    ctx.roundRect(player.x - 65, player.y - 28, 130, 30, 10);
    ctx.fill();
    ctx.fillStyle = '#5f7057';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      shoeAction.slot === 'outdoor' ? '收好外出鞋…' : '换好鞋袜…',
      player.x,
      player.y - 8
    );
  }
  ctx.restore();
}

const walkingShoeCache = new Map();

// 图集的侧身行较短：按三等分截取会带入下一行头顶，还会裁掉背面头发。
// 脚底值来自原图不透明鞋底，换鞋仅染色，因此所有鞋袜共用同一落脚点。
const walkingFootBottoms = {
  pink: [[415, 412, 414, 411], [392, 394, 393, 394], [411, 408, 409, 407]],
  blue: [[416, 412, 415, 411], [393, 395, 394, 395], [412, 409, 409, 408]],
  pajamas: [[417, 412, 415, 412], [393, 397, 395, 397], [413, 410, 413, 409]],
  down: [[411, 409, 409, 409], [394, 396, 394, 395], [411, 403, 411, 403]],
  robe: [[418, 416, 418, 417], [394, 399, 396, 398], [414, 410, 414, 411]]
};

function walkingFrameRegion(atlas, view, frame) {
  const sourceScale = atlas.naturalHeight / 1254;
  const row = [[0, 418], [418, 400], [818, 436]][view];
  return {
    x: frame * atlas.naturalWidth / 4,
    y: row[0] * sourceScale,
    width: atlas.naturalWidth / 4,
    height: row[1] * sourceScale,
    footBottom: walkingFootBottoms[outfit][view][frame] * sourceScale
  };
}

function footwearColor(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// 保留原帧的腿、鞋袜轮廓及遮挡关系，只调整原鞋袜像素的颜色。
// 不能截断小腿再用固定位置补画两只脚，否则抬脚和侧身时会脱节。
function walkingAtlasWithFootwear(atlas) {
  const shoe = currentShoes(), sock = sockStyles[footwear.socks];
  const key = `${outfit}:${shoe.kind}:${shoe.color}:${footwear.socks}`;
  if (walkingShoeCache.has(key)) return walkingShoeCache.get(key);
  const surface = document.createElement('canvas');
  surface.width = atlas.naturalWidth;
  surface.height = atlas.naturalHeight;
  const painter = surface.getContext('2d', { willReadFrequently: true });
  painter.drawImage(atlas, 0, 0);
  const pixels = painter.getImageData(0, 0, surface.width, surface.height);
  const shoeColor = footwearColor(shoe.color), sockColor = footwearColor(sock.color);
  const sourceScale = surface.height / 1254;
  for (let y = 0; y < surface.height; y++) {
    const sourceY = y / sourceScale;
    const view = sourceY < 418 ? 0 : sourceY < 818 ? 1 : 2;
    const rowTop = [0, 418, 818][view];
    const fy = (sourceY - rowTop) / 418;
    // 裤装盖住袜口，不把裤脚当袜子染色；侧面跨步的后脚比正面更高。
    const shoeTop = outfit === 'pajamas' || outfit === 'down'
      ? (view === 1 ? 0.85 : 0.89)
      : (view === 1 ? 0.79 : 0.83);
    if (fy < (view === 1 ? 0.78 : 0.81)) continue;
    for (let x = 0; x < surface.width; x++) {
      const i = (y * surface.width + x) * 4;
      if (pixels.data[i + 3] < 32) continue;
      const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
      const isShoe = fy >= shoeTop && (outfit === 'blue'
        ? b > r + 12 && g > r + 8
        : outfit === 'down'
          ? r > g + 8 && g > b + 8
          : r > g + 12 && b > g + 4);
      const isSock = outfit !== 'pajamas' && outfit !== 'down'
        && fy < 0.94
        && Math.max(r, g, b) - Math.min(r, g, b) < 32 && Math.min(r, g, b) > 175;
      if (!isShoe && !isSock) continue;
      const tint = isShoe ? shoeColor : sockColor;
      // 使用原像素明暗，而不是把鞋面、袜口和鞋底压成同一块平色。
      const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const shade = Math.max(0.3, Math.min(1.12, luminance / (isShoe ? 180 : 235)));
      for (let c = 0; c < 3; c++) {
        pixels.data[i + c] = Math.min(255, Math.round(tint[c] * shade));
      }
      if (isSock && sock.long && Math.floor(y / 5) % 2 === 0) {
        pixels.data[i] *= 0.8;
        pixels.data[i + 2] *= 0.85;
      }
    }
  }
  painter.putImageData(pixels, 0, 0);
  // 只缓存近期穿搭，避免切换全部鞋袜后长期保存大量图集。
  if (walkingShoeCache.size >= 8) walkingShoeCache.delete(walkingShoeCache.keys().next().value);
  walkingShoeCache.set(key, surface);
  return surface;
}

function drawFootwear(x, y, scale, side = false, back = false) {
  const shoe = currentShoes(),
    sock = sockStyles[footwear.socks];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#f3c6aa';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -23);
  ctx.lineTo(0, -7);
  ctx.stroke();
  ctx.strokeStyle = sock.color;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, sock.long ? -29 : -15);
  ctx.lineTo(0, -6);
  ctx.stroke();
  if (sock.long) {
    ctx.strokeStyle = '#98b4a1';
    ctx.lineWidth = 2;
    for (const y of [-25, -19, -13]) {
      ctx.beginPath();
      ctx.moveTo(-4, y);
      ctx.lineTo(4, y);
      ctx.stroke();
    }
  }
  ctx.fillStyle = shoe.color;
  ctx.beginPath();
  ctx.ellipse(side ? 3 : 0, 0, side ? 12 : 8, 5, side ? -0.15 : 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f7eee0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(side ? 13 : 7, 4);
  ctx.stroke();
  if (shoe.kind === 'slippers') {
    ctx.fillStyle = '#f1c9ac';
    ctx.beginPath();
    ctx.ellipse(side ? 9 : 0, back ? -2 : 2, side ? 4 : 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shoe.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.quadraticCurveTo(0, -8, side ? 8 : 5, -2);
    ctx.stroke();
  } else if (shoe.kind === 'heels') {
    ctx.fillStyle = shoe.color;
    ctx.fillRect(-7, 3, 3, 6);
  } else if (shoe.kind === 'ballet') {
    ctx.strokeStyle = '#b7798f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, -16);
    ctx.lineTo(4, -7);
    ctx.moveTo(4, -16);
    ctx.lineTo(-4, -7);
    ctx.stroke();
  } else if (shoe.kind === 'boots') {
    ctx.fillStyle = shoe.color;
    ctx.fillRect(-5, -18, 10, 17);
  } else {
    ctx.strokeStyle = '#fff3e5';
    ctx.lineWidth = 1.5;
    for (const y of [-4, -1]) {
      ctx.beginPath();
      ctx.moveTo(-4, y);
      ctx.lineTo(4, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function refreshGuide() {
  // 图鉴记录累计发现，不随食用、送礼或背包消耗而减少。
  const entry = (id, icon, name, description, counted = false, unit = '个') => {
    const discovered = hasDiscovery(id);
    const tally = id === 'mouse' || id === 'insect' ? '捕获' : '收集';
    const progress = discovered
      ? counted ? `已发现 · 累计${tally} ${discoveryCount(id)} ${unit}` : '已发现'
      : '未发现';
    return [icon, name, `${progress}。${description}`];
  };
  const sections = [
    [
      '老鼠',
      [
        entry('mouse', '🐭', '小老鼠', '偶尔在草丛中出现；布偶猫有机会抓到它。', true, '只')
      ]
    ],
    [
      '鱼',
      catchSpecies.map((species) => {
        // 兼容本轮前已经钓过的鱼种，不能打开新图鉴后又变成“未发现”。
        const discovered = hasDiscovery('fish-' + species.name) || caughtSpecies.has(species.name);
        const count = Math.max(discoveryCount('fish-' + species.name), caughtSpecies.has(species.name) ? 1 : 0);
        return ['🐟', species.name,
          `${discovered ? `已发现 · 累计 ${count} 条` : '未发现'}。同一种鱼也有小鱼、中等大小的鱼和大鱼。`, species];
      })
    ],
    [
      '蘑菇',
      [entry('mushroom', '🍄', '森林蘑菇', '在森林里采到，可以带回厨房做蘑菇汤。', true)]
    ],
    [
      '大树',
      [
        entry('tree-cherry', '🌸', '农场樱花树', '农场里开着粉色花朵的大树。'),
        entry('tree-forest', '🌳', '森林大树', '沿森林小路可以看见，也能在指定位置收集木材。')
      ]
    ],
    [
      '树叶',
      [
        entry('leaf-cherry', '🍃', '樱花树叶', '可以在农场树下捡起，收进背包。', true, '片'),
        entry('leaf-forest', '🍂', '森林落叶', '可以在森林小路旁捡起，收进背包。', true, '片')
      ]
    ],
    [
      '动物',
      [
        entry('animal-dog', '🐕', '萨摩耶', '家里的宠物。喜欢散步和接球，夜晚要睡觉。'),
        entry('animal-cat', '🐈', '布偶猫', '家里的宠物。会偶尔捕虫、抓鼠，也会午睡。'),
        entry('animal-cow', '🐄', '奶牛', '养殖场动物。会散步、吃东西，每天可以喂一顿。'),
        entry('animal-sheep', '🐑', '绵羊', '养殖场动物。软绵绵的小伙伴，喜欢在栏内散步。'),
        entry('animal-lamb', '🐑', '小羊', '养殖场动物。留在围栏内，可以喂食和轻轻抚摸。'),
        entry('animal-pig', '🐖', '小猪', '养殖场动物。喜欢吃东西，晚上也要好好休息。'),
        entry('animal-horse', '🐴', '小马', '养殖场动物。可以骑着散步，不能跑进池塘。'),
        entry('animal-rooster', '🐓', '公鸡', '养殖场动物。会走动和啄食，平时留在围栏里。'),
        entry('animal-hen', '🐔', '白母鸡', '养殖场动物。留在围栏内走动和啄食，天气不好时猫会帮忙带回棚里。'),
        entry('animal-chick', '🐔', '棕母鸡', '养殖场动物。会散步、啄食和发出叫声。'),
        entry('animal-bird', '🐦', '小鸟', '野生动物。在农场的天空里飞来飞去。'),
        entry('animal-squirrel', '🐿️', '小松鼠', '森林野生动物。走近它，可以和它玩。'),
        entry('animal-rabbit', '🐇', '小兔子', '森林野生动物。可以轻轻摸摸它。'),
        entry('animal-deer', '🦌', '小鹿', '森林野生动物。放慢脚步，可以和它亲近。'),
        entry('insect', '🦋', '小虫子', '森林里的昆虫。可以用捕虫网捕捉，猫也会偶尔捕虫。', true, '只')
      ]
    ]
  ];
  document.querySelector('#guide-items').innerHTML = sections
    .map(
      ([title, items]) =>
        `<h3>${title}</h3><div class="guide-grid">${items.map(([icon, name, description, fish]) => `<article>${fish ? `<canvas data-guide-fish="${fish.name}" width="220" height="110" aria-label="${name}的样子" style="width:100%;height:80px;object-fit:contain"></canvas>` : `<span>${icon}</span>`}<strong>${name}</strong><p>${description}</p></article>`).join('')}</div>`
    )
    .join('');
  // 复用钓鱼时的鱼种贴图；图鉴和上岸的鱼保持同一种外观。
  for (const preview of document.querySelectorAll('[data-guide-fish]')) {
    const species = catchSpecies.find((fish) => fish.name === preview.dataset.guideFish);
    const source = species.cell === null ? trout : fishAtlas;
    if (source.complete && source.naturalWidth) {
      drawCaughtFish(preview.getContext('2d'), { species }, 10, 5, 200, 100);
    }
  }
}

document.querySelector('#open-guide').addEventListener('click', () => {
  refreshGuide();
  keys.clear();
  document.querySelector('#guide-dialog').showModal();
});
document
  .querySelector('#close-guide')
  .addEventListener('click', () => document.querySelector('#guide-dialog').close());
document
  .querySelector('#close-shoes')
  .addEventListener('click', () => document.querySelector('#shoes-dialog').close());
document.querySelector('#shoes-dialog').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (scene !== 'house' || clock < busyUntil) return;
  if (button.dataset.shoe && shoeStyles[button.dataset.shoe])
    shoeAction = {
      slot: 'outdoor',
      key: button.dataset.shoe,
      item: shoeStyles[button.dataset.shoe]
    };
  else if (button.dataset.slipper && slipperStyles[button.dataset.slipper])
    shoeAction = {
      slot: 'slippers',
      key: button.dataset.slipper,
      item: slipperStyles[button.dataset.slipper]
    };
  else if (button.dataset.sock && sockStyles[button.dataset.sock])
    shoeAction = { slot: 'socks', key: button.dataset.sock, item: sockStyles[button.dataset.sock] };
  else return;
  shoeAction.started = clock;
  busyUntil = clock + 1.8;
  document.querySelector('#shoes-dialog').close();
  toast(`从鞋架拿出${shoeAction.item.name}…`);
});
document
  .querySelector('#close-fish')
  .addEventListener('click', () => document.querySelector('#fish-dialog').close());
