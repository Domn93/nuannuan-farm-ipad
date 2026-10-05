// 侧边活动菜单；动作选定后收起，并把键盘焦点交还游戏。

const activityDrawer = document.querySelector('#activity-drawer');
const activityToggle = document.querySelector('#toggle-activities');

function setActivityMenu(open) {
  activityDrawer.hidden = !open;
  activityToggle.setAttribute('aria-expanded', String(open));
  activityToggle.textContent = open ? '☰ 收起活动' : '☰ 活动';
  keys.clear();
  if (!open && !document.querySelector('dialog[open]')) canvas.focus();
}

activityToggle.addEventListener('click', () => setActivityMenu(activityDrawer.hidden));
document.querySelector('#close-activities').addEventListener('click', () => setActivityMenu(false));
activityDrawer.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (button && button.id !== 'close-activities' && !button.disabled) setActivityMenu(false);
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !activityDrawer.hidden) setActivityMenu(false);
});
