const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 使用生产函数，控制系统 resume 的完成时机以复现后台/中断竞争。
const source = fs.readFileSync(path.join(__dirname, '../NuannuanFarm/Game/js/game.js'), 'utf8');
const start = source.indexOf('async function startMusic()');
const musicCode = source.slice(start, source.indexOf("\nwindow.addEventListener('pointerdown'", start));

function harness(initialState, delayed = false) {
  let resolveResume;
  const deferred = new Promise((resolve) => { resolveResume = resolve; });
  const calls = { started: 0, stopped: 0, closed: 0, notices: [] };
  class AudioContext {
    constructor() { this.state = 'suspended'; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; calls.closed++; return Promise.resolve(); }
  }
  class FarmMusic {
    setTrack() {}
    setOutside() {}
    start() { calls.started++; }
    stop() { calls.stopped++; }
  }
  const initial = new AudioContext();
  initial.state = initialState;
  if (delayed) initial.resume = () => deferred;
  const context = vm.createContext({
    audio: initial, music: new FarmMusic(), musicWanted: true, musicStarting: false,
    soundOn: false, selectedTrack: 'meadow', scene: 'farm',
    document: { hidden: false }, window: { ipadAppPaused: false, AudioContext }, FarmMusic,
    isBuildingInterior: () => false, requestLullabySleep() {}, updateSoundButton() {},
    toast: (message) => calls.notices.push(message)
  });
  vm.runInContext(musicCode, context);
  return { context, initial, calls, resolveResume, run: () => vm.runInContext('startMusic()', context) };
}

(async () => {
  const interrupted = harness('interrupted');
  await interrupted.run();
  assert.notEqual(interrupted.context.audio, interrupted.initial);
  assert.equal(interrupted.calls.closed, 1);
  assert.equal(interrupted.context.audio.state, 'running');
  assert.equal(interrupted.context.soundOn, true);
  console.log('PASS 被系统打断后，下一次触摸建立并播放新的音频上下文');

  const paused = harness('suspended', true);
  const pending = paused.run();
  paused.context.window.ipadAppPaused = true;
  paused.resolveResume();
  await pending;
  assert.equal(paused.calls.started, 0);
  assert.equal(paused.context.soundOn, false);
  assert.equal(paused.context.musicStarting, false);
  console.log('PASS 回首页后，迟到的 resume 不重新播放');

  const stale = harness('suspended', true);
  const oldRequest = stale.run();
  stale.initial.state = 'interrupted';
  await stale.run();
  const plays = stale.calls.started;
  stale.resolveResume();
  await oldRequest;
  assert.equal(stale.calls.started, plays);
  assert.equal(stale.context.soundOn, true);
  assert.equal(stale.context.musicStarting, false);
  console.log('PASS 旧音频请求不抢占已经恢复的新播放器');
})().catch((error) => { console.error(error); process.exitCode = 1; });
