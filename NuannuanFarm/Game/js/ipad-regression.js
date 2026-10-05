// 只由 DEBUG 原生测试入口读取，不在 index.html 加载，也不接触玩家存档。
window.runFarmRegressionCase = async function (test) {
  const started = performance.now();
  const fail = (message) => { throw new Error(message); };
  window.assert = {
    ok(value, message = '应为真') { if (!value) fail(message); },
    equal(actual, expected, message = '') {
      if (!Object.is(actual, expected)) fail(`${message}：${String(actual)} !== ${String(expected)}`);
    },
    notEqual(actual, expected, message = '应不相同') { if (Object.is(actual, expected)) fail(message); },
    deepEqual(actual, expected, message = '结构应相同') {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(message);
    },
    match(actual, expected) { if (!expected.test(actual)) fail(`${actual} 未匹配 ${expected}`); },
    doesNotMatch(actual, expected) { if (expected.test(actual)) fail(`${actual} 不应匹配 ${expected}`); }
  };
  window.events = [];
  window.regressionEvidence = null;
  for (const key of ['drawImage', 'moveTo', 'lineTo', 'rect']) {
    const actual = ctx[key].bind(ctx);
    ctx[key] = (...args) => { events.push([key, ...args]); return actual(...args); };
  }
  window.regressionPointer = ({ clientX, clientY }) => {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H);
    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, pointerId: 1, pointerType: 'touch',
      clientX: rect.left + (rect.width - W * scale) / 2 + clientX * scale,
      clientY: rect.top + (rect.height - H * scale) / 2 + clientY * scale
    }));
  };
  try {
    ready = true; clock = 100; busyUntil = 0; soundOn = false;
    farmTime.hour = 10; farmTime.day = 0;
    farmVoices.nextSpeech = Infinity; farmVoices.nextCall = Infinity;
    toiletNeed.nextAt = Infinity;
    homeCurtains.nextAttempt = Infinity;
    // VM 基线尚未执行首帧；把启动时寄养中的猫恢复为同一份测试初态。
    cat.boarded = false; cat.scene = 'farm'; cat.x = cat.home.x; cat.y = cat.home.y;
    setActivityMenu(false);
    await (0, eval)(test.body + '\n//# sourceURL=ipad-regression-case.js');
    return { name: test.name, passed: true, evidence: window.regressionEvidence,
      durationMs: Math.round(performance.now() - started) };
  } catch (error) {
    return JSON.parse(JSON.stringify({ name: test.name, passed: false, reason: String(error), stack: error.stack,
      state: { player: { x: player.x, y: player.y }, scene, clock, pendingPlace, routeLength: route.length,
        gate: penGate.open, horse: farmAnimalPosition(animals[3]), horsePlace: places.horse,
        toiletNeed: { ...toiletNeed }, medicine: Boolean(petMedicineRequest), busyUntil,
        dialogs: gameDialogs.filter((dialog) => dialog.open).map((dialog) => dialog.id),
        panels: gameChoicePanels.filter((panel) => !panel.hidden).map((panel) => panel.id) },
      durationMs: Math.round(performance.now() - started) }));
  }
};
