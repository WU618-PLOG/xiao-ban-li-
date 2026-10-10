/* =========================================================
   小板栗 · 主逻辑
   - 日期范围：2020.1 起，无上限，默认定位到系统当前月份
   - 待办：工作 / 生活分组，打勾完成，全部完成解锁隐藏任务
   - 倒计时：把某天设为考试 / 截止日，自动计算剩余天数
   - 专注模式：全屏陪伴小人 + 后台计时 + 当日专注统计
   - 动物伙伴：累计 30 / 60 / 90 个“使用并记录任务”的天数依次出现
   ========================================================= */
'use strict';

/* ============ 常量 ============ */
const STORAGE_KEY = 'pixel-calendar:v1';
const MIN_MONTH = { y: 2020, m: 0 }; // 最早 2020.1，无最大年份上限
const WEEK_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
const WEEKDAY_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const PET_THRESHOLDS = [30, 60, 90];                       // 动物伙伴出现条件
const ANIMAL_NAMES = ['一只小猫咪', '一只小狗', '又一只小猫咪'];
const FOCUS_MIN_SECONDS = 5;                               // 低于 5 秒的专注不计入统计

/* ============ 工具 ============ */
const $ = (sel) => document.querySelector(sel);

function pad2(n) { return String(n).padStart(2, '0'); }
function dateKey(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
function monthIndex(v) { return v.y * 12 + v.m; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function daysUntil(key) {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today0 = new Date(TODAY.y, TODAY.m, TODAY.d);
  return Math.round((target - today0) / 86400000);
}

function fmtFocusText(secs) {
  secs = Math.max(0, Math.round(secs));
  if (secs < 60) return `${secs} 秒`;
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m} 分钟`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} 小时 ${pad2(rm)} 分钟` : `${h} 小时`;
}

function fmtClock(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/* ============ 今天 & 状态 ============ */
const now = new Date();
const TODAY = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
const TODAY_KEY = dateKey(TODAY.y, TODAY.m, TODAY.d);

const store = {
  days: {},        // 'YYYY-MM-DD' -> { todos:[{id,text,done,cat}], hidden, focusSeconds }
  usedTasks: [],   // 已解锁过的隐藏任务下标（避免短期重复）
  settings: { theme: 'light', sound: true, lastCat: 'life' },
  countdowns: [],  // [{ id, date:'YYYY-MM-DD', name }]
  usageDays: [],   // 打开软件并记录过任务的天（'YYYY-MM-DD'）
  animals: { unlocked: 0 },
};

let view = { y: TODAY.y, m: TODAY.m };
let openKey = null;
let currentCat = 'life';
let focusState = null;

/* ============ 存储 ============ */
function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    if (parsed.days && typeof parsed.days === 'object') store.days = parsed.days;
    if (Array.isArray(parsed.usedTasks)) {
      store.usedTasks = parsed.usedTasks.filter((n) => Number.isInteger(n) && n >= 0);
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      store.settings.theme = parsed.settings.theme === 'dark' ? 'dark' : 'light';
      store.settings.sound = parsed.settings.sound !== false;
      store.settings.lastCat = parsed.settings.lastCat === 'work' ? 'work' : 'life';
    }
    if (Array.isArray(parsed.countdowns)) {
      store.countdowns = parsed.countdowns.filter(
        (c) => c && typeof c.date === 'string' && typeof c.name === 'string'
      );
    }
    if (Array.isArray(parsed.usageDays)) {
      store.usageDays = parsed.usageDays.filter((s) => typeof s === 'string');
    }
    if (parsed.animals && typeof parsed.animals === 'object') {
      const n = parseInt(parsed.animals.unlocked, 10);
      store.animals.unlocked = Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
    }
  } catch (e) {
    console.warn('[小板栗] 读取本地数据失败：', e);
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[小板栗] 保存失败：', e);
  }
}

function ensureDay(key) {
  if (!store.days[key] || typeof store.days[key] !== 'object') {
    store.days[key] = { todos: [], hidden: null, focusSeconds: 0 };
  }
  const day = store.days[key];
  if (!Array.isArray(day.todos)) day.todos = [];
  if (day.hidden === undefined) day.hidden = null;
  if (!Number.isFinite(day.focusSeconds)) day.focusSeconds = 0;
  return day;
}

function clampView(v) {
  if (monthIndex(v) < monthIndex(MIN_MONTH)) return { y: MIN_MONTH.y, m: MIN_MONTH.m };
  return v;
}

/* ============ 日历渲染 ============ */
function renderWeekdays() {
  $('#weekdays').innerHTML = WEEK_NAMES
    .map((n, i) => `<div class="weekday${i === 0 || i === 6 ? ' weekend' : ''}">${n}</div>`)
    .join('');
}

function renderCalendar() {
  $('#month-title').textContent = `${view.y}年${view.m + 1}月`;
  $('#btn-prev').disabled = monthIndex(view) <= monthIndex(MIN_MONTH);

  const firstDow = new Date(view.y, view.m, 1).getDay(); // 0 = 周日
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const prevMonthDays = new Date(view.y, view.m, 0).getDate();

  const frag = document.createDocumentFragment();

  for (let i = 0; i < 42; i++) {
    const offset = i - firstDow;
    let y = view.y;
    let m = view.m;
    let d;
    let kind = 'cur';

    if (offset < 0) {                       // 上月补位
      d = prevMonthDays + offset + 1;
      m = view.m - 1;
      if (m < 0) { m = 11; y--; }
      kind = 'prev';
    } else if (offset >= daysInMonth) {     // 下月补位
      d = offset - daysInMonth + 1;
      m = view.m + 1;
      if (m > 11) { m = 0; y++; }
      kind = 'next';
    } else {
      d = offset + 1;
    }

    frag.appendChild(buildCell(y, m, d, kind));
  }

  const grid = $('#days-grid');
  grid.innerHTML = '';
  grid.appendChild(frag);
}

function buildCell(y, m, d, kind) {
  const key = dateKey(y, m, d);
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'day-cell';

  if (kind !== 'cur') cell.classList.add('other-month');
  if (key < TODAY_KEY) cell.classList.add('past');
  if (key === TODAY_KEY) cell.classList.add('today');

  const num = document.createElement('span');
  num.className = 'day-num';
  num.textContent = d;
  cell.appendChild(num);

  const day = store.days[key];
  if (day) {
    if (day.hidden) {
      const star = document.createElement('span');
      star.className = 'hidden-star';
      star.textContent = '✦';
      star.title = '已解锁隐藏任务';
      cell.appendChild(star);
    }
    if (day.todos.length > 0) {
      const doneN = day.todos.filter((t) => t.done).length;
      const total = day.todos.length;
      const prog = document.createElement('span');
      prog.className = 'day-progress';
      if (doneN === total) {
        prog.classList.add('all-done');
        prog.textContent = `✓${doneN}/${total}`;
      } else {
        prog.textContent = `${doneN}/${total}`;
      }
      cell.appendChild(prog);
    }
  }

  cell.addEventListener('click', () => onCellClick(y, m, d, kind));
  return cell;
}

function onCellClick(y, m, d, kind) {
  if (monthIndex({ y, m }) < monthIndex(MIN_MONTH)) {
    Sound.error();
    toast('最早只能查看到 2020年1月哦');
    return;
  }

  if (kind !== 'cur') {          // 点相邻月份的日期：先跳到那个月
    view = clampView({ y, m });
    renderCalendar();
  }
  openDay(dateKey(y, m, d));
}

/* ============ 详情弹窗 ============ */
function openDay(key) {
  openKey = key;
  renderModal();
  $('#modal-mask').hidden = false;
  Sound.open();
}

function closeDay() {
  $('#modal-mask').hidden = true;
  openKey = null;
  Sound.close();
}

function renderModal() {
  if (!openKey) return;
  const [yy, mm, dd] = openKey.split('-').map(Number);

  $('#modal-title').textContent = `${yy}年${mm}月${dd}日`;
  const dow = new Date(yy, mm - 1, dd).getDay();
  let sub = WEEKDAY_FULL[dow];
  if (openKey === TODAY_KEY) sub += ' · 今天';
  else if (openKey < TODAY_KEY) sub += ' · 已经过去的日子';
  else sub += ' · 还没到来的日子';
  $('#modal-sub').textContent = sub;

  const day = ensureDay(openKey);

  /* 当日专注统计徽章 */
  const badge = $('#modal-focus');
  if (day.focusSeconds > 0) {
    badge.hidden = false;
    badge.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = fmtFocusText(day.focusSeconds);
    badge.append('当日专注累计：', b);
  } else {
    badge.hidden = true;
  }

  /* 待办列表（带工作 / 生活标签） */
  const list = $('#todo-list');
  list.innerHTML = '';
  day.todos.forEach((t) => {
    const cat = t.cat === 'work' ? 'work' : 'life';
    const li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' done' : '');
    li.dataset.id = t.id;

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'todo-check';
    check.dataset.act = 'toggle';
    check.setAttribute('aria-label', t.done ? '取消完成' : '标记完成');

    const tag = document.createElement('span');
    tag.className = `tag tag-${cat}`;
    tag.textContent = cat === 'work' ? '工作' : '生活';

    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = t.text;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'todo-del';
    del.dataset.act = 'delete';
    del.textContent = '✕';
    del.setAttribute('aria-label', '删除这条');

    li.append(check, tag, text, del);
    list.appendChild(li);
  });

  $('#todo-empty').hidden = day.todos.length > 0;

  renderCountdownZone();
  renderHiddenZone(day);
}

function renderHiddenZone(day) {
  const zone = $('#hidden-zone');
  zone.innerHTML = '';
  if (day.hidden) {
    const card = document.createElement('div');
    card.className = 'hidden-card';

    const label = document.createElement('div');
    label.className = 'hidden-label';
    label.textContent = '✦ 隐藏任务';

    const txt = document.createElement('p');
    txt.textContent = day.hidden.text;

    card.append(label, txt);
    zone.appendChild(card);
  } else {
    const locked = document.createElement('div');
    locked.className = 'hidden-locked';
    locked.innerHTML = '完成今日全部待办，解锁一个隐藏任务 <span class="lock-star">✦</span>';
    zone.appendChild(locked);
  }
}

/* ============ 待办操作 ============ */
function addTodo(text) {
  const t = (text || '').trim();
  if (!t) { Sound.error(); return; }
  const day = ensureDay(openKey);
  day.todos.push({ id: uid(), text: t, done: false, cat: currentCat });
  saveStore();
  Sound.add();
  markUsageDay();
  renderModal();
  renderCalendar();
  const list = $('#todo-list');
  list.scrollTop = list.scrollHeight;
}

function toggleTodo(id) {
  const day = ensureDay(openKey);
  const t = day.todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  saveStore();
  if (t.done) Sound.check(); else Sound.uncheck();
  renderModal();
  renderCalendar();
  checkAllDone(openKey);
}

function deleteTodo(id) {
  const day = ensureDay(openKey);
  const i = day.todos.findIndex((x) => x.id === id);
  if (i < 0) return;
  day.todos.splice(i, 1);
  saveStore();
  Sound.remove();
  renderModal();
  renderCalendar();
  checkAllDone(openKey);
}

/* ============ 隐藏任务 ============ */
function checkAllDone(key) {
  const day = ensureDay(key);
  if (day.hidden) return;
  if (day.todos.length === 0) return;
  if (!day.todos.every((t) => t.done)) return;
  unlockHidden(key);
}

function unlockHidden(key) {
  const day = ensureDay(key);
  if (day.hidden) return;

  let pool = HIDDEN_TASKS.map((_, i) => i).filter((i) => !store.usedTasks.includes(i));
  if (pool.length === 0) {
    store.usedTasks = [];
    pool = HIDDEN_TASKS.map((_, i) => i);
  }
  const idx = pool[Math.floor(Math.random() * pool.length)];
  store.usedTasks.push(idx);

  day.hidden = { text: HIDDEN_TASKS[idx], at: Date.now() };
  saveStore();

  Sound.hidden();
  showCelebrate({
    title: '✦ 全部完成 ✦',
    sub: '解锁了一个隐藏任务',
    body: day.hidden.text,
    btn: '开心收下',
  });
  renderModal();
  renderCalendar();
  if (typeof Pet !== 'undefined' && Pet.cheer) Pet.cheer();
}

/* ============ 倒计时 ============ */
function renderCountdownBar() {
  const bar = $('#countdown-bar');
  const items = store.countdowns
    .map((c) => ({ id: c.id, name: c.name, diff: daysUntil(c.date) }))
    .filter((c) => c.diff >= 0)
    .sort((a, b) => a.diff - b.diff);

  bar.innerHTML = '';
  if (items.length === 0) {
    bar.hidden = true;
    return;
  }

  items.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'cd-item';
    const name = document.createElement('span');
    name.textContent = `距离「${c.name}」`;
    const num = document.createElement('b');
    num.textContent = c.diff === 0 ? '就是今天' : `还有 ${c.diff} 天`;
    el.append(name, num);
    bar.appendChild(el);
  });
  bar.hidden = false;
}

function renderCountdownZone() {
  const zone = $('#countdown-zone');
  zone.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'cd-zone-title';
  title.textContent = '倒计时 · 考试 / 截止日';
  zone.appendChild(title);

  store.countdowns
    .filter((c) => c.date === openKey)
    .forEach((cd) => {
      const row = document.createElement('div');
      row.className = 'cd-row';

      const name = document.createElement('span');
      name.textContent = `「${cd.name}」`;

      const days = document.createElement('span');
      days.className = 'cd-days';
      const diff = daysUntil(cd.date);
      days.textContent = diff > 0 ? `还有 ${diff} 天` : diff === 0 ? '就是今天' : `已过去 ${-diff} 天`;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'cd-del';
      del.dataset.cdDel = cd.id;
      del.textContent = '✕';
      del.setAttribute('aria-label', '删除倒计时');

      row.append(name, days, del);
      zone.appendChild(row);
    });

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'cd-add-btn';
  addBtn.textContent = '＋ 把这天设为倒计时日';
  addBtn.addEventListener('click', () => showCdForm(zone));
  zone.appendChild(addBtn);
}

function showCdForm(zone) {
  const btn = zone.querySelector('.cd-add-btn');
  if (btn) btn.remove();

  const form = document.createElement('div');
  form.className = 'cd-add-form';

  const input = document.createElement('input');
  input.className = 'cd-input';
  input.maxLength = 20;
  input.placeholder = '事件名，如：期末考试 / 项目截止';

  const ok = document.createElement('button');
  ok.type = 'button';
  ok.className = 'cd-confirm';
  ok.textContent = '确定';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'cd-cancel';
  cancel.textContent = '取消';

  const submit = () => {
    const name = (input.value || '').trim() || '重要日子';
    addCountdown(openKey, name);
  };

  ok.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });
  cancel.addEventListener('click', () => { form.remove(); renderCountdownZone(); });

  form.append(input, ok, cancel);
  zone.appendChild(form);
  input.focus();
}

function addCountdown(date, name) {
  store.countdowns.push({ id: uid(), date, name, createdAt: Date.now() });
  saveStore();
  Sound.add();
  renderModal();
  renderCountdownBar();
}

function removeCountdown(id) {
  const i = store.countdowns.findIndex((c) => c.id === id);
  if (i < 0) return;
  store.countdowns.splice(i, 1);
  saveStore();
  Sound.remove();
  renderModal();
  renderCountdownBar();
}

/* ============ 分类 ============ */
function setCat(cat) {
  currentCat = cat === 'work' ? 'work' : 'life';
  store.settings.lastCat = currentCat;
  saveStore();
  updateCatPicker();
}

function updateCatPicker() {
  document.querySelectorAll('.cat-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cat === currentCat);
  });
}

/* ============ 专注模式 ============ */
function enterFocus() {
  if (focusState) return;

  const cv = $('#focus-canvas');
  Pet.renderTo(cv, Pet.focusPose());

  focusState = {
    startTs: Date.now(),
    startKey: TODAY_KEY,
    tickTimer: 0,
    animTimer: 0,
    bubbleTimer: 0,
    exitHideTimer: 0,
  };

  $('#focus-time').textContent = '00:00:00';
  $('#focus-bubble').hidden = true;
  $('#focus-layer').hidden = false;
  $('#focus-hint').classList.remove('fade');
  $('#btn-focus-exit').classList.add('show');
  document.body.classList.add('focus-on');

  Sound.focusStart();
  focusTick();
  scheduleFocusPose();

  setTimeout(() => {
    if (focusState) $('#focus-hint').classList.add('fade');
  }, 4000);

  focusState.exitHideTimer = setTimeout(() => {
    if (focusState) $('#btn-focus-exit').classList.remove('show');
  }, 3000);
}

function focusTick() {
  if (!focusState) return;
  const secs = Math.floor((Date.now() - focusState.startTs) / 1000);
  $('#focus-time').textContent = fmtClock(secs);
  focusState.tickTimer = setTimeout(focusTick, 500);
}

function scheduleFocusPose() {
  if (!focusState) return;
  const delay = 3200 + Math.random() * 3400; // 每 3.2s ~ 6.6s 动一下、卖个萌
  focusState.animTimer = setTimeout(() => {
    if (!focusState) return;
    Pet.renderTo($('#focus-canvas'), Pet.focusPose());
    if (Math.random() < 0.55) {
      const b = $('#focus-bubble');
      b.textContent = Pet.focusLine();
      b.hidden = false;
      clearTimeout(focusState.bubbleTimer);
      focusState.bubbleTimer = setTimeout(() => { b.hidden = true; }, 2800);
    }
    scheduleFocusPose();
  }, delay);
}

function wakeFocusUI() {
  if (!focusState) return;
  $('#btn-focus-exit').classList.add('show');
  clearTimeout(focusState.exitHideTimer);
  focusState.exitHideTimer = setTimeout(() => {
    if (focusState) $('#btn-focus-exit').classList.remove('show');
  }, 3000);
}

function exitFocus() {
  if (!focusState) return;

  clearTimeout(focusState.tickTimer);
  clearTimeout(focusState.animTimer);
  clearTimeout(focusState.bubbleTimer);
  clearTimeout(focusState.exitHideTimer);

  const secs = Math.round((Date.now() - focusState.startTs) / 1000);
  const startKey = focusState.startKey;
  focusState = null;

  $('#focus-layer').hidden = true;
  $('#btn-focus-exit').classList.remove('show');
  $('#focus-hint').classList.remove('fade');
  document.body.classList.remove('focus-on');
  Sound.focusEnd();

  if (secs >= FOCUS_MIN_SECONDS) {
    const day = ensureDay(startKey);
    day.focusSeconds = (day.focusSeconds || 0) + secs;
    saveStore();
    showCelebrate({
      title: '专注结束',
      sub: '辛苦啦，给自己一点掌声',
      body: `本次专注：${fmtFocusText(secs)}\n当日累计：${fmtFocusText(day.focusSeconds)}`,
      btn: '继续加油',
    });
  }
}

/* ============ 动物伙伴 ============ */
/* 达到阈值即解锁新伙伴，返回本次新解锁的只数（0 = 无变化） */
function checkAnimalUnlock() {
  let unlockedStep = 0;
  while (
    store.animals.unlocked < PET_THRESHOLDS.length
    && store.usageDays.length >= PET_THRESHOLDS[store.animals.unlocked]
  ) {
    store.animals.unlocked += 1;
    unlockedStep = store.animals.unlocked;
  }
  return unlockedStep;
}

function markUsageDay() {
  if (store.usageDays.includes(TODAY_KEY)) return;
  store.usageDays.push(TODAY_KEY);

  const unlockedStep = checkAnimalUnlock();
  saveStore();

  if (unlockedStep > 0) {
    Pet.setAnimals(store.animals.unlocked);
    Sound.animal();
    showCelebrate({
      title: '✦ 新的伙伴 ✦',
      sub: `使用记录满 ${PET_THRESHOLDS[unlockedStep - 1]} 天`,
      body: `${ANIMAL_NAMES[unlockedStep - 1]}来到了你身边！`,
      btn: '欢迎你呀',
    });
  }

  /* 小人台词更新为“相伴天数” */
  if (store.usageDays.length > 1) {
    Pet.setExtraLines([`我们已经相伴 ${store.usageDays.length} 天啦～`]);
  }
}

/* ============ 通用庆祝层 ============ */
function showCelebrate({ title, sub, body, btn }) {
  $('#celebrate-title').textContent = title || '';
  const subEl = $('#celebrate-sub');
  if (sub) {
    subEl.textContent = sub;
    subEl.hidden = false;
  } else {
    subEl.hidden = true;
  }
  $('#celebrate-task').textContent = body || '';
  $('#btn-celebrate-ok').textContent = btn || '好';
  $('#celebrate').hidden = false;
}

function hideCelebrate() {
  $('#celebrate').hidden = true;
}

/* ============ 主题 & 音效开关 ============ */
function applyTheme() {
  document.body.classList.toggle('theme-dark', store.settings.theme === 'dark');
  $('#btn-theme').textContent = store.settings.theme === 'dark' ? '白天模式' : '夜晚模式';
  /* 同步 PWA 状态栏/地址栏主题色 */
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = store.settings.theme === 'dark' ? '#17102e' : '#fff4e6';
}

function toggleTheme() {
  store.settings.theme = store.settings.theme === 'dark' ? 'light' : 'dark';
  saveStore();
  applyTheme();
  Sound.theme();
}

function applySoundSetting() {
  Sound.setMuted(!store.settings.sound);
  $('#btn-sound').textContent = store.settings.sound ? '音效·开' : '音效·关';
}

function toggleSound() {
  store.settings.sound = !store.settings.sound;
  saveStore();
  applySoundSetting();
  if (store.settings.sound) Sound.click();
}

/* ============ 月份导航（无上限） ============ */
function goMonth(delta) {
  const target = { y: view.y, m: view.m + delta };
  if (target.m < 0) { target.m = 11; target.y--; }
  if (target.m > 11) { target.m = 0; target.y++; }

  if (monthIndex(target) < monthIndex(MIN_MONTH)) {
    Sound.error();
    toast('最早只能查看到 2020年1月哦');
    return;
  }
  view = target;
  Sound.click();
  renderCalendar();
}

function goToday() {
  view = { y: TODAY.y, m: TODAY.m };
  renderCalendar();
  Sound.click();
  const cell = document.querySelector('.day-cell.today');
  if (cell) {
    cell.classList.remove('shake');
    void cell.offsetWidth; // 重置动画
    cell.classList.add('shake');
  }
}

/* ============ Toast ============ */
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

/* ============ 事件绑定 ============ */
function bindEvents() {
  $('#btn-prev').addEventListener('click', () => goMonth(-1));
  $('#btn-next').addEventListener('click', () => goMonth(1));
  $('#btn-today').addEventListener('click', goToday);
  $('#btn-focus').addEventListener('click', () => { Sound.click(); enterFocus(); });
  $('#btn-theme').addEventListener('click', toggleTheme);
  $('#btn-sound').addEventListener('click', toggleSound);

  $('#btn-modal-close').addEventListener('click', closeDay);
  $('#modal-mask').addEventListener('mousedown', (e) => {
    if (e.target === e.currentTarget) closeDay();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#focus-layer').hidden) { exitFocus(); return; }
    if (!$('#celebrate').hidden) { hideCelebrate(); return; }
    if (!$('#modal-mask').hidden) closeDay();
  });

  /* 分类选择 */
  $('#cat-picker').addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    Sound.click();
    setCat(btn.dataset.cat);
  });

  /* 添加待办 */
  $('#todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#todo-input');
    addTodo(input.value);
    input.value = '';
    input.focus();
  });

  /* 列表：打勾 / 删除 */
  $('#todo-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const li = btn.closest('.todo-item');
    if (!li) return;
    if (btn.dataset.act === 'toggle') toggleTodo(li.dataset.id);
    else if (btn.dataset.act === 'delete') deleteTodo(li.dataset.id);
  });

  /* 倒计时删除 */
  $('#countdown-zone').addEventListener('click', (e) => {
    const del = e.target.closest('[data-cd-del]');
    if (del) removeCountdown(del.dataset.cdDel);
  });

  /* 专注模式：鼠标移动唤醒退出按钮；按钮退出 */
  $('#focus-layer').addEventListener('mousemove', wakeFocusUI);
  $('#btn-focus-exit').addEventListener('click', exitFocus);

  /* 庆祝层按钮 */
  $('#btn-celebrate-ok').addEventListener('click', () => {
    hideCelebrate();
    Sound.click();
  });

  /* 首次点击时解锁音频上下文 */
  document.addEventListener('pointerdown', function once() {
    Sound.unlock();
    document.removeEventListener('pointerdown', once);
  }, { once: true });
}

/* ============ 初始化 ============ */
function init() {
  loadStore();

  /* 补算：历史使用天数已达标但尚未解锁的伙伴（静默补齐，不重复弹窗） */
  if (checkAnimalUnlock() > 0) saveStore();

  currentCat = store.settings.lastCat === 'work' ? 'work' : 'life';

  /* 自动定位到系统当前月份 */
  view = clampView({ y: TODAY.y, m: TODAY.m });

  applyTheme();
  applySoundSetting();
  renderWeekdays();
  renderCalendar();
  renderCountdownBar();
  updateCatPicker();
  bindEvents();

  if (typeof Pet !== 'undefined') {
    Pet.create($('#pet-root'));
    Pet.setAnimals(store.animals.unlocked);
    Pet.randomize(true); /* 每次打开随机一个姿势和表情并打招呼 */
    if (store.usageDays.length > 0) {
      Pet.setExtraLines([`我们已经相伴 ${store.usageDays.length} 天啦～`]);
    }
  }
}

init();
