// 萤火虫只在温暖、干燥的夜晚偶尔出现，不跟随暖暖跨地图。
const fireflies = { wait: 50 + Math.random() * 25, swarm: null };

function fireflyNightIsSuitable() {
  return (
    ['farm', 'forest', 'friends', 'junction'].includes(scene) &&
    isFarmNight() &&
    (farmClimate.season === 0 || farmClimate.season === 1) &&
    ['sunny', 'wind', 'cloudy'].includes(farmClimate.weather)
  );
}

function updateFireflies(dt) {
  if (!fireflyNightIsSuitable()) {
    // 冬天、白天或坏天气立刻收起光点；重新适合时也留出等待时间。
    if (fireflies.swarm) fireflies.wait = 50 + Math.random() * 25;
    fireflies.swarm = null;
    canvas.dataset.fireflies = 'quiet';
    return;
  }
  if (fireflies.swarm && fireflies.swarm.scene !== scene) {
    fireflies.swarm = null;
    fireflies.wait = 50 + Math.random() * 25;
  }
  if (fireflies.swarm && clock >= fireflies.swarm.until) fireflies.swarm = null;
  if (!fireflies.swarm) {
    fireflies.wait -= dt;
    if (fireflies.wait <= 0) {
      fireflies.wait = 50 + Math.random() * 25;
      // 夏夜更容易遇见，春夜仍是偶尔；秋冬没有萤火虫。
      if (Math.random() < (farmClimate.season === 1 ? 0.6 : 0.4)) {
        const centerX = W * (0.25 + Math.random() * 0.5);
        const centerY = H * (0.54 + Math.random() * 0.12);
        fireflies.swarm = {
          scene,
          started: clock,
          until: clock + 15 + Math.random() * 10,
          lights: Array.from({ length: 6 + Math.floor(Math.random() * 5) }, () => ({
            x: centerX + (Math.random() - 0.5) * W * 0.16,
            y: centerY + (Math.random() - 0.5) * H * 0.08,
            phase: Math.random() * Math.PI * 2,
            speed: 0.45 + Math.random() * 0.35
          }))
        };
      }
    }
  }
  canvas.dataset.fireflies = fireflies.swarm ? String(fireflies.swarm.lights.length) : 'quiet';
}

function drawFireflies() {
  const swarm = fireflies.swarm;
  if (!swarm || swarm.scene !== scene || !fireflyNightIsSuitable()) return;
  const elapsed = clock - swarm.started;
  const fade = Math.max(0, Math.min(1, elapsed / 2, (swarm.until - clock) / 2));
  ctx.save();
  for (const light of swarm.lights) {
    const phase = elapsed * light.speed + light.phase;
    const x = light.x + Math.sin(phase) * 15;
    const y = light.y + Math.cos(phase * 0.7) * 9;
    const brightness = fade * (0.3 + 0.7 * Math.pow((Math.sin(phase * 2) + 1) / 2, 2));
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 7);
    glow.addColorStop(0, '#fff4a9');
    glow.addColorStop(0.3, '#e6ee75aa');
    glow.addColorStop(1, '#e6ee7500');
    ctx.globalAlpha = brightness;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbd5';
    ctx.beginPath();
    ctx.arc(x, y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
