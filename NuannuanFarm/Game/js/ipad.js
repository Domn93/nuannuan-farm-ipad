// 本地 WebKit 与原生首页之间只传递加载、暂停和生活存档，不请求网络服务。
function postToIPad(type, extra = {}) {
  window.webkit?.messageHandlers?.farm?.postMessage({ type, ...extra });
}

const ipadControlBar = document.createElement('section');
ipadControlBar.className = 'ipad-controls';
ipadControlBar.setAttribute('aria-label', '农场触屏操作');
const ipadContext = document.createElement('div');
ipadContext.className = 'ipad-context';
ipadContext.append(document.querySelector('#interaction-actions'), document.querySelector('#pump-swing'));
const ipadTools = document.createElement('div');
ipadTools.className = 'ipad-tools';
ipadTools.innerHTML = '<button id="ipad-run" aria-label="按住小跑">小跑</button>' +
  '<button id="ipad-cancel">停一下</button><button id="ipad-release">放下 / 松绳</button>';
ipadControlBar.append(document.querySelector('.dpad'), ipadContext, ipadTools);
document.querySelector('.game-shell').append(ipadControlBar);

const ipadHomeButton = document.createElement('button');
ipadHomeButton.id = 'ipad-home';
ipadHomeButton.textContent = '‹ 首页';
ipadHomeButton.setAttribute('aria-label', '返回农场首页');
document.querySelector('.brand').prepend(ipadHomeButton);
document.querySelector('.header-right').prepend(document.querySelector('#toggle-activities'));
document.querySelector('#activity-drawer .travel-bar').append(document.querySelector('#music-track'));

document.querySelector('#game').setAttribute('aria-label', '暖暖的小农场，轻点地面前往，走近后轻点动作按钮');
document.querySelector('.instructions').hidden = true;
document.querySelector('#backpack-dialog p:last-child').textContent = '生活进度会自动保存在这台 iPad 上，返回首页后可以继续。';
const ipadHelpParagraphs = document.querySelectorAll('#help-dialog p');
ipadHelpParagraphs[0].textContent = '点点地面，暖暖就走过去。走近小动物和家具，点下面的动作按钮试试吧。不想继续走啦？再点一个地方换方向，或点「停一下」。';
ipadHelpParagraphs[1].textContent = '左上角的小肚子和干净度，越满越舒服！肚子咕咕叫，吃点背包里的食物，或回家坐好吃饭；身上沾了泥，就去浴缸搓泡泡。猫猫抱累啦？点放下。狗狗遛够啦？点松绳。其他事情想歇一歇，就点「停一下」。';
ipadHelpParagraphs[2].textContent = '浮漂沉下去啦！快点提竿，再按住收线。拉力变红就松手。荡秋千时按住用力，想下来就等秋千慢慢停稳。';
document.querySelector('.drawer-heading h2').textContent = '今天想玩点啥？';
// 保留滑动，也提供明显的翻页按钮，小朋友能直接找到列表下方的小伙伴。
const ipadMenuPages = document.createElement('nav');
ipadMenuPages.className = 'ipad-menu-pages';
ipadMenuPages.setAttribute('aria-label', '活动列表翻页');
ipadMenuPages.innerHTML = '<button id="ipad-menu-up" aria-label="活动往上翻">↑ 往上翻</button>' +
  '<button id="ipad-menu-down" aria-label="活动往下翻">往下翻 ↓</button>';
const ipadMenuHeader = document.createElement('div');
ipadMenuHeader.className = 'ipad-menu-header';
const ipadDrawerHeading = document.querySelector('.drawer-heading');
ipadDrawerHeading.before(ipadMenuHeader);
ipadMenuHeader.append(ipadDrawerHeading, ipadMenuPages);
for (const [id, direction] of [['ipad-menu-up', -1], ['ipad-menu-down', 1]]) {
  document.querySelector('#' + id).addEventListener('click', (event) => {
    event.stopPropagation();
    activityDrawer.scrollBy({ top: direction * activityDrawer.clientHeight * 0.7, behavior: 'instant' });
  });
}

document.querySelector('#ipad-run').addEventListener('pointerdown', (event) => {
  if (gameDialogOpen() || gameChoicePanelOpen()) return;
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
  keys.add('Shift');
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  document.querySelector('#ipad-run').addEventListener(type, () => keys.delete('Shift'));

document.querySelector('#ipad-cancel').addEventListener('click', () => {
  if (gameDialogOpen()) return;
  clearForestAdventure();
  clearPetMedicineRequest();
  clearAnimalPetting();
  cancelPetPlay();
  if (petFeedingAction) { petFeedingAction = null; busyUntil = 0; }
  penGate.destination = null;
  balconyDoor.destination = null;
  keys.clear();
  route = [];
  pendingPlace = null;
  targetMarker = null;
  player.walking = false;
  if (riding) dismountHorse();
  if (petCareRequest) { petCareRequest = null; delete places.petCare; }
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  setActivityMenu(false);
});
document.querySelector('#ipad-release').addEventListener('click', () => {
  if (!gameDialogOpen() && !gameChoicePanelOpen()) releaseCarriedPetOrDog();
});
ipadHomeButton.addEventListener('click', () => {
  if (window.webkit?.messageHandlers?.farm) postToIPad('home');
  else window.farmIPad.setPaused(true);
});

let ipadLoaded = false;
let ipadSavePending = false;
let ipadSaveChanged = '';
let ipadLastCheckpoint = null;

function saveIPadLife() {
  if (!ipadLoaded || ipadSavePending) return false;
  const snapshot = captureIPadLife();
  if (!snapshot) return false;
  const comparable = JSON.stringify({ ...snapshot, savedAt: null });
  if (comparable === ipadSaveChanged) return true;
  ipadSavePending = true;
  ipadLastCheckpoint = snapshot;
  postToIPad('save', { snapshot });
  // 浏览器预览也使用独立键，绝不读写网页版的生活存档。
  if (!window.webkit?.messageHandlers?.farm) {
    try {
      localStorage.setItem('nuannuan-ipad-life-v1', JSON.stringify(snapshot));
      window.farmIPad.saveResult(true);
    } catch { window.farmIPad.saveResult(false); }
  }
  return true;
}

function reportIPadDiagnostic() {
  postToIPad('diagnostic', {
    ready, paused: window.ipadAppPaused === true, scene, clock,
    satiety: ipadHunger.satiety, cleanliness: 100 - hygiene.dirt,
    player: ipadPick(player, ['x', 'y']), pocket: { ...pocket },
    viewport: { width: innerWidth, height: innerHeight },
    canvas: { width: canvas.clientWidth, height: canvas.clientHeight },
    dpadVisible: getComputedStyle(document.querySelector('.dpad')).display !== 'none',
    cartoonFontReady: document.fonts.check('16px FarmPlay'),
    lastAudioClip: window.ipadAudioDiagnostic || null,
    soundOn, restored: window.ipadSaveRestored === true, saved: Boolean(ipadSaveChanged),
    audioState: audio?.state || '未开启',
    voiceState: farmVoices.speechAudio ? {
      ready: farmVoices.speechAudio.readyState, error: farmVoices.speechAudio.error?.code || 0,
      paused: farmVoices.speechAudio.paused, time: farmVoices.speechAudio.currentTime
    } : null,
    routeLength: route.length, pendingPlace, nearPlace,
    assetsLoaded: [...document.images].every((image) => image.complete),
    timestamp: new Date().toISOString()
  });
}

window.farmIPad = {
  save: saveIPadLife,
  setPaused(paused) {
    if (paused && !window.ipadAppPaused) saveIPadLife();
    window.ipadAppPaused = paused;
    keys.clear();
    cancelPetReleaseTimer();
    lastTime = 0;
    if (paused) {
      music?.stop();
      stopFlushSound();
      stopBathSound();
      stopFarmVoices();
      soundOn = false;
      updateSoundButton();
      audio?.suspend().catch(() => {});
    }
    reportIPadDiagnostic();
  },
  saveResult(success) {
    ipadSavePending = false;
    if (success && ipadLastCheckpoint) {
      ipadSaveChanged = JSON.stringify({ ...ipadLastCheckpoint, savedAt: null });
    } else if (!success) {
      toast('这次进度暂时没存好，请稍后再试。', 6);
    }
  }
};

window.addEventListener('farm-ready', () => {
  let saved = window.ipadSavedGame;
  if (!window.webkit?.messageHandlers?.farm) {
    try { saved = JSON.parse(localStorage.getItem('nuannuan-ipad-life-v1') || 'null'); } catch { /* 保留新农场。 */ }
  }
  window.ipadSaveRestored = restoreIPadLife(saved);
  refreshIPadNeeds();
  ipadLoaded = true;
  draw();
  postToIPad('ready');
  reportIPadDiagnostic();
});
window.addEventListener('farm-load-error', () => postToIPad('error', { reason: '本地游戏素材加载失败' }));
window.addEventListener('error', (event) => postToIPad('error', { reason: event.message, source: event.filename, line: event.lineno }));
window.addEventListener('unhandledrejection', (event) => postToIPad('error', { reason: String(event.reason) }));
document.addEventListener('visibilitychange', () => { if (document.hidden) saveIPadLife(); });
setInterval(() => {
  document.querySelector('#ipad-release').disabled = !carriedPet && !walkingDog;
}, 250);
setInterval(() => {
  if (!window.ipadAppPaused && !document.hidden) {
    saveIPadLife();
    reportIPadDiagnostic();
  }
}, 5000);
