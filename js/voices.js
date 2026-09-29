// 动物叫声和暖暖说话；同时管理语音、音效来源及文字气泡的清理。

const farmVoices = {
  animalAudio: null,
  bubble: null,
  nextCall: 12,
  nextSpeech: 30,
  lastSpeech: -Infinity,
  lastLine: '',
  speechAudio: null
};
// 固定短句使用本地自然语音，避免各浏览器默认音色不同，也不在游玩时联网合成。
const nuannuanVoiceClips = {
  '回家啦，真暖和。': 'home-warm',
  '小猫也来陪我啦。': 'home-cat',
  '在家休息一会儿吧。': 'home-rest',
  '鱼儿慢慢来，我不着急。': 'fish-wait',
  '看看浮漂，有没有动呀？': 'fish-float',
  '月亮出来啦。': 'night-moon',
  '小动物睡着了，我们轻一点。': 'night-quiet',
  '小猫还在散步呢。': 'night-cat',
  '小动物们，你们好呀。': 'animal-hello',
  '吃饱了，慢慢长大哦。': 'animal-grow',
  '这里有好多小伙伴。': 'animal-friends',
  '风轻轻吹过来，好舒服呀。': 'wind-gentle',
  '这条鱼我还没钓过呢！': 'fish-new',
  '钓到大鱼啦！': 'fish-big',
  '钓到一条小鱼啦！': 'fish-small',
  '又钓到一条鱼啦！': 'fish-again',
  '我们慢慢逛一逛吧。': 'stroll',
  '小猫小狗，要一起玩吗？': 'play',
  '这里的花真好看。': 'flowers'
};
const animalCalls = [
  { kind: 'pig', text: '哼哼' },
  { kind: 'sheep', text: '咩——' },
  { kind: 'sheep', text: '咩～' },
  { kind: 'horse', text: '嘶——' },
  { kind: 'cow', text: '哞——' },
  { kind: 'chicken', text: '咯咯' }
];

// 上床准备、午觉和午夜困倒都保持安静，起床动作结束后才恢复说话。
function nuannuanIsResting() {
  return Boolean(sleepSession || lateSleepSession);
}

function stopNuannuanSpeech() {
  if (farmVoices.speechAudio) {
    farmVoices.speechAudio.pause();
    farmVoices.speechAudio.currentTime = 0;
    farmVoices.speechAudio = null;
  }
  if (farmVoices.bubble?.actor === player) farmVoices.bubble = null;
}

function stopFarmVoices() {
  if (farmVoices.animalAudio) {
    farmVoices.animalAudio.pause();
    farmVoices.animalAudio.currentTime = 0;
    farmVoices.animalAudio = null;
  }
  stopNuannuanSpeech();
  farmVoices.bubble = null;
}

function animalCall(kind, actor) {
  if (actor.cell === undefined && !petIsHere(actor)) return false;
  if (!soundOn || !audio || document.hidden || actor.sleeping || clock < actor.nextCall)
    return false;
  const definition =
    kind === 'dog'
      ? { text: '汪！汪！' }
      : kind === 'cat'
        ? { text: '喵～' }
        : animalCalls.find((call) => call.kind === kind);
  if (!definition) return false;
  if (farmVoices.animalAudio || farmVoices.speechAudio) return false;
  // 本地动物录音，不再将随机噪声叠进叫声；加载失败时安静退出。
  const clip = new Audio(`assets/animals-audio/${kind === 'dog' ? 'dog-v2' : kind}.mp3`);
  const position = actor.cell === undefined ? actor : farmAnimalPosition(actor);
  clip.volume = 0.5 * Math.max(0.25, 1 - distance(player, position) / 850);
  farmVoices.animalAudio = clip;
  const finish = () => {
    if (farmVoices.animalAudio === clip) farmVoices.animalAudio = null;
  };
  clip.onended = clip.onerror = finish;
  clip.play().catch(finish);
  actor.nextCall = clock + 20 + Math.random() * 25;
  farmVoices.bubble = { actor, text: definition.text, until: clock + 2 };
  farmVoices.nextCall = clock + 10 + Math.random() * 15;
  return true;
}

// 台词描述的是眼前的小伙伴，不能把留在别处或正在睡觉的宠物说成在玩。
function petSpeechFitsScene(text) {
  const catNearby = petIsHere(cat) && distance(cat, player) <= 240;
  if (text === '小猫也来陪我啦。') return catNearby;
  if (text === '小猫还在散步呢。') return catNearby && !cat.sleeping;
  if (text === '小猫小狗，要一起玩吗？')
    return catNearby && petIsHere(dog) && distance(dog, player) <= 240 && !cat.sleeping && !dog.sleeping;
  return true;
}

function sayNuannuan(manual = false) {
  if (
    !ready ||
    nuannuanIsResting() ||
    bathSession ||
    farmVoices.animalAudio ||
    farmVoices.speechAudio ||
    document.hidden ||
    clock - farmVoices.lastSpeech < 12
  )
    return;
  if (!manual && (!soundOn || clock < farmVoices.nextSpeech)) return;
  const lines =
    scene === 'house'
      ? [...(isFarmWinter() ? ['回家啦，真暖和。'] : []), '小猫也来陪我啦。', '在家休息一会儿吧。']
      : fishingSession
        ? ['鱼儿慢慢来，我不着急。', '看看浮漂，有没有动呀？']
        : isFarmNight()
          ? ['月亮出来啦。', '小动物睡着了，我们轻一点。', '小猫还在散步呢。']
          : insidePen(player)
            ? ['小动物们，你们好呀。', '吃饱了，慢慢长大哦。', '这里有好多小伙伴。']
            : [
                '风轻轻吹过来，好舒服呀。',
                '我们慢慢逛一逛吧。',
                '小猫小狗，要一起玩吗？',
                '这里的花真好看。'
              ];
  const choices = lines.filter((line) => line !== farmVoices.lastLine && petSpeechFitsScene(line)),
    text = choices[Math.floor(Math.random() * choices.length)];
  if (text) speakNuannuanLine(text);
}

// 上岸报喜优先于闲聊；只播当前这一句，不排队积压旧台词。
function sayFishCatch(isNew, sizeLabel) {
  if (!ready || nuannuanIsResting() || bathSession || document.hidden) return;
  const text = isNew
    ? '这条鱼我还没钓过呢！'
    : sizeLabel === '大鱼'
      ? '钓到大鱼啦！'
      : sizeLabel === '小鱼'
        ? '钓到一条小鱼啦！'
        : '又钓到一条鱼啦！';
  stopFarmVoices();
  speakNuannuanLine(text);
}

function speakNuannuanLine(text) {
  if (!petSpeechFitsScene(text)) return;
  if (text === '回家啦，真暖和。' && !isFarmWinter()) return;
  if (nuannuanIsResting()) {
    stopNuannuanSpeech();
    return;
  }
  farmVoices.lastLine = text;
  farmVoices.lastSpeech = clock;
  farmVoices.nextSpeech = clock + 45 + Math.random() * 35;
  farmVoices.bubble = { actor: player, text, until: clock + 5 };
  if (soundOn && !farmVoices.speechAudio && nuannuanVoiceClips[text]) {
    const speech = new Audio(`assets/voices/${nuannuanVoiceClips[text]}.mp3`);
    speech.volume = 0.58;
    farmVoices.speechAudio = speech;
    const finish = () => {
      // 旧音频结束或加载失败时，不清除新地图正在播放的声音。
      if (farmVoices.speechAudio === speech) farmVoices.speechAudio = null;
    };
    speech.onended = speech.onerror = finish;
    // 自动播放被阻止时仍保留文字气泡，下次用户互动可以再播放。
    speech.play().catch(finish);
  }
}

function updateFarmVoices() {
  if (farmVoices.lastLine === '回家啦，真暖和。' && !isFarmWinter()) stopNuannuanSpeech();
  // 清理先于静音/切后台判断，避免暂停中的旧台词在睡眠期间重新播放。
  if (nuannuanIsResting()) stopNuannuanSpeech();
  if (!soundOn || document.hidden) return;
  if (clock >= farmVoices.nextSpeech && !toiletSession && !doorTransition && clock >= busyUntil)
    sayNuannuan();
  if (
    clock < farmVoices.nextCall ||
    farmVoices.animalAudio ||
    farmVoices.speechAudio ||
    clock < farmVoices.bubble?.until
  )
    return;
  const candidates = pets.filter((pet) => petIsHere(pet) && !pet.sleeping && !pet.walking && !pet.playing);
  if (scene === 'farm')
    candidates.push(
      ...animals.filter(
        (animal) => !animal.sleeping && !animal.restMoving && !(riding && animal.cell === 3)
      )
    );
  const available = candidates.filter((actor) => !(clock < actor.nextCall));
  if (!available.length) {
    farmVoices.nextCall = clock + 5;
    return;
  }
  const actor = available[Math.floor(Math.random() * available.length)];
  animalCall(
    actor.cell === undefined ? actor.kind : animalCalls[Math.min(actor.cell, 5)].kind,
    actor
  );
}

function drawFarmVoiceBubble() {
  if (nuannuanIsResting()) stopNuannuanSpeech();
  const bubble = farmVoices.bubble;
  canvas.dataset.animalPlayback = farmVoices.animalAudio
    ? farmVoices.animalAudio.paused
      ? 'loading'
      : 'playing'
    : 'quiet';
  canvas.dataset.voicePlayback = farmVoices.speechAudio
    ? farmVoices.speechAudio.paused
      ? 'loading'
      : 'playing'
    : 'quiet';
  canvas.dataset.speaking =
    clock < bubble?.until
      ? bubble.actor === player
        ? 'nuannuan'
        : bubble.actor.kind || animalCalls[Math.min(bubble.actor.cell, 5)].kind
      : 'quiet';
  if (!bubble || clock >= bubble.until) return;
  const actor = bubble.actor,
    position = actor.cell === undefined ? actor : farmAnimalPosition(actor);
  const height = actor === player ? 190 : actor.height * (actor.growth || 1);
  ctx.save();
  ctx.font = '19px sans-serif';
  ctx.textAlign = 'center';
  const width = Math.min(380, ctx.measureText(bubble.text).width + 32),
    x = Math.max(width / 2 + 10, Math.min(W - width / 2 - 10, position.x)),
    y = Math.max(35, position.y - height - 35);
  ctx.fillStyle = '#fff9eaf2';
  ctx.strokeStyle = '#c6ceb4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 27, width, 43, 16);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 15);
  ctx.lineTo(x, y + 24);
  ctx.lineTo(x + 7, y + 15);
  ctx.fill();
  ctx.fillStyle = '#53674b';
  ctx.fillText(bubble.text, x, y + 2);
  ctx.restore();
}

document.querySelector('#talk-nuannuan').addEventListener('click', async () => {
  if (!soundOn && musicWanted) await startMusic();
  sayNuannuan(true);
});
