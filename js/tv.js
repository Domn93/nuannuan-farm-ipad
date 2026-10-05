// 同一段节目画在客厅电视和节目单预览里；切台后从该节目的开头播放。
const tvPrograms = [
  { name: '🐠 海底奇遇', description: '小鱼穿过海草，水母在水里轻轻飘。' },
  { name: '🐰 森林朋友', description: '小兔在草地上跳，蝴蝶跟着一起飞。' },
  { name: '🚀 星空旅行', description: '小火箭绕过星球，去找亮晶晶的星星。' },
  { name: '☀️ 田园天气', description: '看看太阳、云和小雨接下来会去哪里。' },
  { name: '🍳 小小厨房', description: '小厨师搅一搅，锅里冒出香香的热气。' }
];
const tvProgramLength = 22;
let tvProgram = 0;
let tvProgramStarted = 0;

function tvOval(g, x, y, rx, ry, color) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function tvCloud(g, x, y, color = '#f9fcf6') {
  tvOval(g, x, y + 8, 24, 8, color);
  tvOval(g, x - 10, y + 3, 12, 10, color);
  tvOval(g, x + 7, y, 15, 13, color);
}

function drawOceanProgram(g, t) {
  g.fillStyle = '#5ec6d8';
  g.fillRect(0, 0, 160, 72);
  g.fillStyle = '#238dad';
  g.beginPath();
  g.moveTo(0, 40);
  for (let x = 0; x <= 160; x += 8) g.lineTo(x, 42 + Math.sin(x / 13 + t * 1.5) * 3);
  g.lineTo(160, 72);
  g.lineTo(0, 72);
  g.fill();
  g.fillStyle = '#e6d49e';
  g.fillRect(0, 65, 160, 7);
  for (let i = 0; i < 6; i++) {
    const x = 12 + i * 27;
    g.strokeStyle = i % 2 ? '#4cc78e' : '#72d6a1';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x, 68);
    g.quadraticCurveTo(x + Math.sin(t * 2 + i) * 6, 53, x + Math.sin(t * 2 + i) * 5, 46);
    g.stroke();
  }
  const fishX = 26 + ((t * 22) % 175);
  const fishY = 36 + Math.sin(t * 2) * 6;
  tvOval(g, fishX, fishY, 17, 9, '#ffe077');
  g.fillStyle = '#f49c69';
  g.beginPath();
  g.moveTo(fishX - 14, fishY);
  g.lineTo(fishX - 29, fishY - 10);
  g.lineTo(fishX - 29, fishY + 10);
  g.fill();
  tvOval(g, fishX + 9, fishY - 3, 1.5, 1.5, '#31495a');
  const jellyX = 116 + Math.sin(t * 0.8) * 13;
  const jellyY = 18 + Math.sin(t * 1.7) * 6;
  tvOval(g, jellyX, jellyY, 11, 7, '#f6b8da');
  g.strokeStyle = '#f6b8da';
  g.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    g.beginPath();
    g.moveTo(jellyX + i * 5, jellyY + 4);
    g.lineTo(jellyX + i * 5 + Math.sin(t * 3 + i) * 2, jellyY + 15);
    g.stroke();
  }
  for (let i = 0; i < 4; i++) tvOval(g, 12 + i * 37, 15 + ((t * 13 + i * 19) % 47), 2, 2, '#d7fbf7');
}

function drawForestProgram(g, t) {
  g.fillStyle = '#c8e9d0';
  g.fillRect(0, 0, 160, 72);
  tvCloud(g, 28 + ((t * 3) % 145), 10);
  tvOval(g, 72, 72, 105, 42, '#82bd78');
  tvOval(g, 165, 75, 90, 44, '#69a969');
  for (const x of [12, 142]) {
    g.fillStyle = '#815f48';
    g.fillRect(x - 4, 24, 8, 38);
    tvOval(g, x, 24, 22, 21, '#458f62');
    tvOval(g, x - 8, 20, 12, 14, '#58a974');
  }
  const hop = Math.abs(Math.sin(t * 2.7)) * 12;
  const rabbitX = 65 + Math.sin(t * 0.65) * 28;
  const rabbitY = 54 - hop;
  tvOval(g, rabbitX - 13, rabbitY + 7, 5, 5, '#fff8e8');
  tvOval(g, rabbitX, rabbitY + 4, 16, 11, '#fff8e8');
  tvOval(g, rabbitX + 11, rabbitY - 8, 11, 10, '#fff8e8');
  tvOval(g, rabbitX + 7, rabbitY - 24, 4, 13, '#fff8e8');
  tvOval(g, rabbitX + 17, rabbitY - 24, 4, 13, '#fff8e8');
  tvOval(g, rabbitX + 15, rabbitY - 10, 1.5, 1.5, '#554750');
  tvOval(g, rabbitX + 21, rabbitY - 5, 2, 1.5, '#f4a5a9');
  const butterflyX = 111 + Math.sin(t * 1.8) * 17;
  const butterflyY = 27 + Math.sin(t * 3) * 7;
  tvOval(g, butterflyX - 4, butterflyY, 5, 4 + Math.abs(Math.sin(t * 8)) * 3, '#f7a9ce');
  tvOval(g, butterflyX + 4, butterflyY, 5, 4 + Math.abs(Math.sin(t * 8)) * 3, '#f7a9ce');
  tvOval(g, butterflyX, butterflyY, 1.5, 5, '#775569');
}

function drawSpaceProgram(g, t) {
  g.fillStyle = '#27375f';
  g.fillRect(0, 0, 160, 72);
  for (let i = 0; i < 20; i++) {
    const x = (i * 53 + 17) % 160;
    const y = (i * 29 + 11) % 67;
    tvOval(g, x, y, 0.8 + Math.abs(Math.sin(t * 2 + i)), 0.8 + Math.abs(Math.sin(t * 2 + i)), '#fff2b9');
  }
  tvOval(g, 132, 49, 24, 24, '#bd9cda');
  tvOval(g, 125, 43, 8, 5, '#d9bce9');
  tvOval(g, 143, 57, 5, 7, '#a98ccf');
  const rocketX = 28 + ((t * 17) % 104);
  const rocketY = 38 + Math.sin(t * 2.5) * 6;
  g.save();
  g.translate(rocketX, rocketY);
  g.rotate(-0.18);
  g.fillStyle = '#f4f4e9';
  g.beginPath();
  g.moveTo(23, 0);
  g.lineTo(4, -9);
  g.lineTo(-14, -8);
  g.lineTo(-14, 8);
  g.lineTo(4, 9);
  g.fill();
  g.fillStyle = '#f08f86';
  g.beginPath();
  g.moveTo(23, 0);
  g.lineTo(10, -7);
  g.lineTo(10, 7);
  g.fill();
  tvOval(g, 0, 0, 5, 5, '#8fc4e3');
  g.fillStyle = '#f1b44a';
  g.beginPath();
  g.moveTo(-14, -5);
  g.lineTo(-24 - Math.sin(t * 15) * 5, 0);
  g.lineTo(-14, 5);
  g.fill();
  g.restore();
}

function drawWeatherProgram(g, t) {
  g.fillStyle = '#9bd4e2';
  g.fillRect(0, 0, 160, 72);
  tvOval(g, 34, 25, 15, 15, '#ffe184');
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 + t * 0.15;
    g.strokeStyle = '#ffe184';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(34 + Math.cos(angle) * 19, 25 + Math.sin(angle) * 19);
    g.lineTo(34 + Math.cos(angle) * 25, 25 + Math.sin(angle) * 25);
    g.stroke();
  }
  tvCloud(g, 104 + Math.sin(t * 0.7) * 13, 20, '#ecf3f1');
  for (let i = 0; i < 6; i++) {
    const x = 84 + i * 11 + Math.sin(t * 0.7) * 13;
    const y = 39 + ((t * 15 + i * 8) % 22);
    g.strokeStyle = '#518fca';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - 2, y + 5);
    g.stroke();
  }
  g.fillStyle = '#659c74';
  g.fillRect(0, 65, 160, 7);
  g.fillStyle = '#365a69';
  g.font = 'bold 9px sans-serif';
  g.textAlign = 'left';
  g.fillText('晴天', 15, 59);
  g.fillText('小雨', 116, 59);
}

function drawKitchenProgram(g, t) {
  g.fillStyle = '#f5d8b6';
  g.fillRect(0, 0, 160, 72);
  g.fillStyle = '#b8d7cf';
  g.fillRect(108, 8, 38, 32);
  g.fillStyle = '#f9f3da';
  g.fillRect(125, 8, 3, 32);
  g.fillRect(108, 22, 38, 3);
  g.fillStyle = '#9e6952';
  g.fillRect(0, 49, 160, 23);
  g.fillStyle = '#d3a178';
  g.fillRect(0, 47, 160, 6);
  tvOval(g, 65, 42, 18, 20, '#f9f5df');
  tvOval(g, 65, 20, 11, 11, '#f8c9a5');
  tvOval(g, 65, 8, 16, 8, '#fffdf0');
  g.fillStyle = '#fffdf0';
  g.fillRect(53, 7, 24, 10);
  tvOval(g, 69, 19, 1.3, 1.3, '#5b4c45');
  g.fillStyle = '#8a9f7e';
  g.fillRect(25, 43, 34, 12);
  tvOval(g, 42, 43, 18, 5, '#556e62');
  tvOval(g, 42, 41, 14, 3, '#f9c777');
  g.strokeStyle = '#f8c9a5';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(55, 34);
  g.lineTo(44 + Math.sin(t * 5) * 5, 39);
  g.stroke();
  g.strokeStyle = '#f5eee2';
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const rise = (t * 12 + i * 11) % 30;
    g.beginPath();
    g.moveTo(36 + i * 6, 38 - rise);
    g.quadraticCurveTo(31 + i * 6, 34 - rise, 38 + i * 6, 29 - rise);
    g.stroke();
  }
  tvOval(g, 116, 43, 9, 5, '#e99569');
  tvOval(g, 123, 40, 4, 4, '#74a766');
}

const tvProgramDrawers = [
  drawOceanProgram, drawForestProgram, drawSpaceProgram, drawWeatherProgram, drawKitchenProgram
];

function drawTvProgram(g, screen) {
  const elapsed = Math.max(0, clock - tvProgramStarted);
  g.save();
  g.translate(screen.x, screen.y);
  g.scale(screen.w / 160, screen.h / 72);
  g.beginPath();
  g.rect(0, 0, 160, 72);
  g.clip();
  tvProgramDrawers[tvProgram](g, elapsed);
  g.restore();
}

function refreshTvGuide() {
  const program = tvPrograms[tvProgram];
  document.querySelector('#tv-title').textContent = `正在播放 · ${program.name}`;
  document.querySelector('#tv-description').textContent = program.description;
  document.querySelector('#tv-preview').setAttribute('aria-label', `正在播放${program.name}`);
  document.querySelectorAll('[data-tv-program]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.tvProgram) === tvProgram));
  });
  canvas.dataset.tvProgram = String(tvProgram);
}

function openTv() {
  if (scene !== 'house') return;
  if (!tvOn) {
    tvOn = true;
    tvProgramStarted = clock;
    places.tv.label = '选择电视节目';
  }
  refreshTvGuide();
  const dialog = document.querySelector('#tv-dialog');
  if (!dialog.open) dialog.showModal();
  toast(`电视正在播放${tvPrograms[tvProgram].name}，还可以换台。`);
}

function updateTv() {
  if (!tvOn || clock - tvProgramStarted < tvProgramLength) return;
  tvProgram = (tvProgram + 1) % tvPrograms.length;
  tvProgramStarted = clock;
  refreshTvGuide();
}

function drawTvPreview() {
  if (!document.querySelector('#tv-dialog').open || !tvOn) return;
  const preview = document.querySelector('#tv-preview');
  const picture = preview.getContext('2d');
  drawTvProgram(picture, { x: 0, y: 0, w: preview.width, h: preview.height });
}

document.querySelector('#tv-programs').innerHTML = tvPrograms
  .map((program, index) => `<button data-tv-program="${index}" type="button">${program.name}</button>`).join('');
document.querySelector('#tv-programs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-tv-program]');
  if (!button || !tvOn) return;
  tvProgram = Number(button.dataset.tvProgram);
  tvProgramStarted = clock;
  refreshTvGuide();
  toast(`换到${tvPrograms[tvProgram].name}啦。`);
});
document.querySelector('#close-tv').addEventListener('click', () => document.querySelector('#tv-dialog').close());
document.querySelector('#tv-power').addEventListener('click', () => {
  tvOn = false;
  places.tv.label = '看电视';
  document.querySelector('#tv-dialog').close();
  toast('电视关好啦。');
});
