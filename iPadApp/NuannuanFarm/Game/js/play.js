// 宠物接球、猫捉老鼠或虫子，以及农场飞鸟。

let ballGame = null,
  prey = null,
  nextPreyAt = 240,
  lastMouseAt = -Infinity;

function cancelPetPlay() {
  stopHerding();
  ballGame = null;
  prey = null;
  for (const pet of pets) {
    pet.playing = false;
    pet.playHop = 0;
    pet.route = [];
    pet.nextPlan = clock + 2;
  }
  scheduleNextCatHunt();
}

function scheduleNextCatHunt() {
  // 捕猎之间留出 4–7 分钟散步、休息；中断互动也不能缩短已有冷却。
  nextPreyAt = Math.max(nextPreyAt, clock + 240 + Math.random() * 180);
}

function throwPetBall(kind) {
  if (!ready || clock < busyUntil) return;
  if (kind === 'dog' && isFarmNight()) {
    toast('萨摩耶在休息，可以和布偶猫玩球。');
    return;
  }
  if (kind === 'cat' && isCatMorning()) {
    toast('布偶猫早上睡觉，等它睡醒再玩球吧。');
    return;
  }
  if (riding) {
    toast('先下马，再和小伙伴玩球吧。');
    return;
  }
  const pet = kind === 'dog' ? dog : cat;
  if (pet.boarded) {
    toast(`${pet.name}正在寄养，先接回它再玩球吧。`, 6);
    return;
  }
  if (petHealth[kind].sick || petVetVisit?.pet === pet) {
    toast(`${pet.name}先休息看病，康复以后再玩球吧。`);
    return;
  }
  if (!petIsHere(pet)) {
    toast(`${pet.name}不在这里，去找它再玩球吧。`);
    return;
  }
  if (pet.sleeping) {
    toast(`${pet.name}正在打盹，等它睡醒再玩吧。`);
    return;
  }
  if (walkingDog) stopDogWalk(null);
  cancelPetPlay();
  if (pet.care) clearPetCare(pet);
  let target = null;
  for (let i = 0; i < 16; i++) {
    const angle = Math.atan2(pet.y - player.y, pet.x - player.x) + (i * Math.PI) / 4;
    const candidate = { x: pet.x + Math.cos(angle) * 110, y: pet.y + Math.sin(angle) * 90 };
    if (canWalk(candidate.x, candidate.y) && findPetPath(candidate, pet).length) {
      target = candidate;
      break;
    }
  }
  if (!target) {
    toast('这里有点挤，到宽一点的地方再抛球吧。');
    return;
  }
  pet.playing = true;
  pet.eatingUntil = 0;
  ballGame = {
    pet,
    state: 'flight',
    started: clock,
    phaseStarted: clock,
    from: { x: player.x, y: player.y - 70 },
    target,
    x: player.x,
    y: player.y - 70,
    nextPlan: 0
  };
  toast(`暖暖把球抛出去啦，${pet.name}追上去接球！`, 5);
  playNote(660, 0, 0.1);
}

function chaseTarget(pet, target, dt, speed, game) {
  if (clock >= game.nextPlan) {
    pet.route = findPetPath(target, pet).slice(1);
    game.nextPlan = clock + 0.4;
  }
  movePet(pet, dt, speed);
}

function spawnPrey() {
  if (petHealth.cat.sick || petVetVisit?.pet === cat) return;
  if (prey || clock < nextPreyAt) return;
  // 出现猎物时就计入间隔，避免睡觉或切换活动取消追逐后立即再抓。
  scheduleNextCatHunt();
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const point = { x: cat.x + Math.cos(angle) * 130, y: cat.y + Math.sin(angle) * 90 };
    if (canWalk(point.x, point.y) && findPetPath(point, cat).length) {
      prey = {
        ...point,
        // 自然时间一昼夜是 12 分钟，老鼠至少间隔两昼夜，虫子更常见。
        kind: clock - lastMouseAt >= 1440 && Math.random() < 0.2 ? 'mouse' : 'bug',
        started: clock,
        nextPlan: 0,
        state: 'wandering',
        route: []
      };
      if (prey.kind === 'mouse') lastMouseAt = clock;
      recordDiscovery(prey.kind === 'mouse' ? 'mouse' : 'insect', 0);
      return;
    }
  }
}

function updatePetPlay(dt) {
  if (ballGame) {
    const game = ballGame,
      pet = game.pet;
    if (clock - game.started > 35) {
      cancelPetPlay();
      toast('小伙伴玩累啦，休息一会儿。');
      return;
    }
    if (game.state === 'flight' || game.state === 'chasing') {
      const t = Math.min(1, (clock - game.phaseStarted) / 1.2);
      game.x = game.from.x + (game.target.x - game.from.x) * t;
      game.y = game.from.y + (game.target.y - game.from.y) * t - Math.sin(t * Math.PI) * 95;
      if (t === 1) {
        game.state = 'chasing';
        game.y =
          game.target.y -
          Math.abs(Math.sin((clock - game.phaseStarted - 1.2) * 8)) *
            Math.exp(-(clock - game.phaseStarted - 1.2) * 3) *
            18;
      }
      chaseTarget(pet, game.target, dt, pet === dog ? 220 : 175, game);
      if (t > 0.85 && distance(pet, game.target) < 30) {
        game.state = 'catching';
        game.phaseStarted = clock;
        pet.route = [];
        pet.walking = false;
        toast(pet === dog ? '萨摩耶接住球啦，叼回来给暖暖！' : '布偶猫扑住球啦，把球带回来！');
      }
    } else if (game.state === 'catching') {
      pet.playHop = Math.sin(Math.min(1, (clock - game.phaseStarted) / 0.65) * Math.PI) * 18;
      if (clock - game.phaseStarted >= 0.65) {
        pet.playHop = 0;
        game.state = 'returning';
        game.nextPlan = 0;
      }
    } else {
      chaseTarget(pet, player, dt, pet === dog ? 180 : 145, game);
      if (distance(pet, player) < 65) {
        burst('♡', pet.x, pet.y - 70, 3);
        ballGame = null;
        pet.playing = false;
        pet.route = [];
        pet.walking = false;
        pet.nextPlan = clock + 3;
        toast(`${pet.name}把球送回来了，再点玩球可以继续！`);
        playNote(784, 0, 0.15);
      }
    }
  }
  if (
    herdSession ||
    !petIsHere(cat) ||
    scene !== 'farm' ||
    isCatMorning() ||
    cat.sleeping ||
    cat.care ||
    petCareRequest?.pet === cat
  )
    return;
  if (!prey && clock >= nextPreyAt && !cat.playing && pendingPlace !== 'cat') spawnPrey();
  if (!prey) return;
  if (ballGame?.pet === cat || pendingPlace === 'cat' || clock < cat.affectionUntil) return;
  if (prey.state === 'wandering' && distance(cat, prey) < 220) {
    prey.state = 'chasing';
    prey.nextPlan = 0;
    cat.playing = true;
    cat.route = [];
  }
  if (prey.state === 'chasing') {
    const dx = prey.x - cat.x,
      dy = prey.y - cat.y,
      length = Math.hypot(dx, dy) || 1;
    const speed = prey.kind === 'mouse' ? 24 : 12;
    const x = prey.x + (dx / length) * speed * dt,
      y = prey.y + (dy / length) * speed * dt;
    if (canWalk(x, prey.y)) prey.x = x;
    if (canWalk(prey.x, y)) prey.y = y;
    chaseTarget(cat, prey, dt, 145, prey);
    if (distance(cat, prey) < 25) {
      prey.state = 'pouncing';
      prey.caughtAt = clock;
      cat.route = [];
      cat.walking = false;
    }
  } else if (prey.state === 'pouncing') {
    cat.playHop = Math.sin(Math.min(1, (clock - prey.caughtAt) / 0.65) * Math.PI) * 20;
    if (clock - prey.caughtAt >= 0.65) {
      const mouse = prey.kind === 'mouse';
      recordDiscovery(mouse ? 'mouse' : 'insect');
      toast(
        mouse
          ? '布偶猫捉到小老鼠啦！这次抓住了，图鉴记下一次捕获。'
          : '布偶猫扑住了小虫子，图鉴里也记下啦！'
      );
      burst('✨', cat.x, cat.y - 40, 3);
      // 扑到后停止逃跑，留几秒给玩家看清捕获结果；不能立即显示“又溜走”。
      prey.state = 'caught';
      prey.caughtAt = clock;
      prey.x = cat.x + 18;
      prey.y = cat.y - 2;
      cat.playHop = 0;
    }
  } else if (prey.state === 'caught') {
    if (clock - prey.caughtAt >= 4) {
      prey = null;
      cat.playing = false;
      cat.playHop = 0;
      cat.nextPlan = clock + 3;
      scheduleNextCatHunt();
    }
  }
  // 已经扑到的猎物不再受追逐超时影响，避免最后一瞬间误判成逃脱。
  if (prey && ['wandering', 'chasing'].includes(prey.state) && clock - prey.started > 20) {
    prey = null;
    cat.playing = false;
    cat.playHop = 0;
    cat.route = [];
    scheduleNextCatHunt();
  }
}

function drawSkyBirds() {
  if (scene !== 'farm' || isFarmNight()) return;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const x = ((clock * (25 + i * 3) + i * 317) % (W + 160)) - 80;
    const y = 55 + i * 23 + Math.sin(clock * 0.55 + i) * 15;
    const flap = Math.sin(clock * (5 + i * 0.3) + i),
      size = 13 + (i % 3) * 3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.cos(clock * 0.55 + i) * 0.08);
    ctx.fillStyle = '#6e756b';
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.55, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#63726c';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-size * 0.5, -flap * size, -size, -flap * size * 0.7);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(size * 0.5, -flap * size, size, -flap * size * 0.7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawPetPlay() {
  canvas.dataset.ball = ballGame?.state ?? 'idle';
  canvas.dataset.prey = prey?.kind ?? 'none';
  canvas.dataset.preyState = prey?.state ?? 'idle';
  ctx.save();
  if (prey && scene === 'farm') {
    ctx.translate(prey.x, prey.y - 4);
    if (prey.kind === 'mouse') {
      ctx.strokeStyle = '#998b7c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.quadraticCurveTo(-26, -10, -28, 3);
      ctx.stroke();
      ctx.fillStyle = '#a69888';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c6b6a8';
      ctx.beginPath();
      ctx.arc(7, -5, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#433c35';
      ctx.beginPath();
      ctx.arc(10, -1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#566d35';
      ctx.lineWidth = 1.5;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-7, i * 4 - 3);
        ctx.lineTo(7, i * 4 + 3);
        ctx.stroke();
      }
      ctx.fillStyle = '#8b9e45';
      ctx.beginPath();
      ctx.ellipse(0, 0, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.translate(-prey.x, -prey.y + 4);
  }
  if (ballGame) {
    const game = ballGame,
      pet = game.pet;
    const held = game.state === 'catching' || game.state === 'returning';
    const x = held ? pet.x + Math.cos(pet.heading) * pet.width * 0.3 : game.x;
    const y = held ? pet.y - pet.height * 0.55 - (pet.playHop || 0) : game.y;
    if (!held) {
      const t = Math.min(1, (clock - game.phaseStarted) / 1.2);
      const shadowY = game.from.y + 70 + (game.target.y - game.from.y - 70) * t;
      ctx.fillStyle = '#344d2428';
      ctx.beginPath();
      ctx.ellipse(game.x, shadowY, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e9a35f';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff3d0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 6, -1, 1.6);
    ctx.stroke();
  }
  ctx.restore();
}
