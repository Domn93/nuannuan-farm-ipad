// 错开动物上厕所的时间；全场共享一个会话，防止同时触发。

// A single shared session keeps bathroom breaks staggered across every animal.
const animalCare = { session: null, nextAt: 22, lastActor: null };
// 猫砂盆只放一个，绘制和猫的寻路都使用这同一份位置。
const catLitterBoxes = [{ x: 1120, y: 685, color: '#e6eadf' }];
indoorPlaces.litter = { x: 1177, y: 699, label: '拿猫砂铲清理', icon: '♧' };

function cancelAnimalBathroom() {
  const actor = animalCare.session?.actor;
  if (actor) {
    actor.route = [];
    actor.walking = false;
    actor.nextPlan = clock + 2;
  }
  animalCare.session = null;
  animalCare.nextAt = clock + 40 + Math.random() * 45;
}

function animalBathroomPose(actor) {
  const session = animalCare.session;
  if (!session || session.actor !== actor || session.phase === 'approach') return null;
  const t = clock - session.started;
  const crouch =
    session.phase === 'sniff'
      ? Math.min(1, t / 1.2) * 0.3
      : session.phase === 'squat'
        ? 0.3 + 0.7 * Math.min(1, t / 0.6)
        : Math.max(0, 1 - t / 0.8);
  return { crouch, phase: session.phase };
}

function startAnimalBathroom(actor) {
  if (
    animalCare.session ||
    actor.care ||
    petVetVisit?.pet === actor ||
    petCareRequest?.pet === actor ||
    actor.sleeping ||
    actor.playing ||
    actor.restMoving ||
    clock < actor.eatingUntil
  )
    return false;
  if (actor === cat && scene === 'house' && livingSession?.kind === 'litter') return false;
  const pet = actor.cell === undefined;
  if (pet && (pendingPlace === actor.kind || (actor === dog && walkingDog))) return false;
  let target = null;
  if (pet) {
    if (scene === 'house' && actor.x < 901 && !balconyDoor.open) {
      // Let pets open the door only while Nuannuan is idle, preserving her destination.
      if (
        balconyDoor.started === null &&
        !route.length &&
        !pendingPlace &&
        !balconyDoor.destination &&
        clock >= busyUntil
      )
        openBalconyDoor();
      return false;
    }
    if (scene === 'house')
      target =
        actor === cat
          ? [...catLitterBoxes]
              .sort((a, b) => distance(actor, a) - distance(actor, b))
              .find((box) => findPetPath(box, actor).length)
          : { x: 1300, y: 600 };
    else
      for (let i = 0; i < 12; i++) {
        const candidate = {
          x: actor.x + (Math.random() - 0.5) * 140,
          y: actor.y + (Math.random() - 0.5) * 100
        };
        if (canWalk(candidate.x, candidate.y) && findPetPath(candidate, actor).length) {
          target = candidate;
          break;
        }
      }
    if (!target || !findPetPath(target, actor).length) return false;
    actor.route = findPetPath(target, actor).slice(1);
  }
  animalCare.session = {
    actor,
    phase: pet ? 'approach' : 'sniff',
    started: clock,
    began: clock,
    target
  };
  actor.nextBathroom = clock + 180 + Math.random() * 120;
  animalCare.lastActor = actor;
  return true;
}

function updateAnimalCare(dt) {
  const session = animalCare.session;
  if (session) {
    const actor = session.actor;
    if (
      actor.sleeping ||
      actor.restMoving ||
      actor.playing ||
      (actor === dog && walkingDog) ||
      clock < actor.eatingUntil ||
      (actor.cell !== undefined && (isFarmNight() || clock - feedingStarted < 6)) ||
      (actor.cell === 3 && riding) ||
      pendingPlace === actor.kind ||
      clock - session.began > 45
    ) {
      cancelAnimalBathroom();
      return;
    }
    if (session.phase === 'approach') {
      movePet(actor, dt, actor === dog ? 60 : 45);
      if (distance(actor, session.target) < 20) {
        actor.route = [];
        actor.walking = false;
        actor.view = 0;
        session.phase = 'sniff';
        session.started = clock;
      }
    } else {
      actor.walking = false;
      const duration = session.phase === 'sniff' ? 1.2 : session.phase === 'squat' ? 2.4 : 0.8;
      if (clock - session.started >= duration) {
        if (session.phase === 'finish') {
          cancelAnimalBathroom();
          return;
        }
        session.phase = session.phase === 'sniff' ? 'squat' : 'finish';
        session.started = clock;
      }
    }
    return;
  }
  if (herdSession || clock < animalCare.nextAt || clock < busyUntil || doorTransition) return;
  const candidates = [
    ...pets,
    ...(scene === 'farm' && !isFarmNight() && clock - feedingStarted >= 6 ? animals : [])
  ].filter(
    (actor) =>
      (actor.cell !== undefined || petIsHere(actor)) &&
      !actor.sleeping &&
      !actor.playing &&
      !actor.herdRoute &&
      animalPetting?.animal !== actor &&
      !actor.restMoving &&
      !(clock < actor.nextBathroom) &&
      !(clock < actor.eatingUntil) &&
      !(actor === dog && walkingDog) &&
      !(actor.cell === 3 && riding) &&
      pendingPlace !== actor.kind
  );
  if (candidates.length > 1 && candidates.includes(animalCare.lastActor))
    candidates.splice(candidates.indexOf(animalCare.lastActor), 1);
  while (candidates.length) {
    const index = Math.floor(Math.random() * candidates.length),
      actor = candidates.splice(index, 1)[0];
    if (startAnimalBathroom(actor)) return;
  }
  animalCare.nextAt = clock + 8;
}

function drawAnimalBathroomPlaces() {
  if (scene !== 'house') return;
  for (const box of catLitterBoxes) {
    ctx.drawImage(petProps.litter, box.x - 55, box.y - 43, 110, 110 / 1.5);
  }
  if (livingSession?.kind !== 'litter') drawLitterScoop(1195, 677, -0.3);
  ctx.save();
  ctx.fillStyle = '#dce5d7';
  ctx.shadowColor = '#403c2825';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.roundRect(1264, 592, 72, 25, 5);
  ctx.fill();
  ctx.strokeStyle = '#a8bca1';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawLitterScoop(x, y, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // 短柄连着带漏砂孔的铲头，不画第二个盆或大片覆盖物。
  ctx.strokeStyle = '#728d82';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-20, 9);
  ctx.stroke();
  ctx.fillStyle = '#abc2b3';
  ctx.beginPath();
  ctx.roundRect(-35, 5, 19, 14, 3);
  ctx.fill();
  ctx.strokeStyle = '#5d796e';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-31 + i * 5, 8);
    ctx.lineTo(-31 + i * 5, 16);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLitterCleaning(t) {
  const scoopX = 1165 + Math.sin(t * 4) * 4;
  const scoopY = 650 + Math.cos(t * 4) * 3;
  ctx.save();
  ctx.strokeStyle = '#f3c4a0';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(player.x - 12, player.y - 65);
  ctx.lineTo(scoopX, scoopY);
  ctx.stroke();
  drawLitterScoop(scoopX, scoopY, Math.sin(t * 4) * 0.12);
  // 轻轻抖铲，让干净的小砂粒落回盆内。
  ctx.fillStyle = '#d2bd8e';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(scoopX - 28 + i * 2, scoopY + 16 + ((t * 18 + i * 3) % 9), 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawAnimalBathroomDetails(actor, x, y) {
  const pose = animalBathroomPose(actor);
  if (!pose) return;
  const size = actor.width * (actor.growth || 1),
    side = actor.facing === -1 ? -1 : 1;
  ctx.save();
  ctx.translate(x, y);
  // A tucked body and raised tail suggest the action without graphic waste.
  if (actor === cat) {
    ctx.strokeStyle = '#93877e';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size * 0.3, -12);
    ctx.quadraticCurveTo(-size * 0.55, -42 * pose.crouch, -size * 0.3, -50 * pose.crouch);
    ctx.stroke();
  }
  if (actor === dog && pose.phase === 'squat') {
    ctx.strokeStyle = '#f7f5ed';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-side * size * 0.2, -22);
    ctx.lineTo(-side * size * 0.4, -29);
    ctx.stroke();
  }
  if (pose.phase === 'squat') {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#d5bd76';
    ctx.beginPath();
    ctx.ellipse(-side * size * 0.24, 1, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function recordAnimalCareState() {
  const session = animalCare.session;
  canvas.dataset.animalBathroom = session
    ? `${session.actor.kind || ['pig', 'sheep', 'lamb', 'horse', 'cow', 'chicken', 'chicken', 'chicken'][session.actor.cell]}:${session.phase}`
    : 'idle';
}
