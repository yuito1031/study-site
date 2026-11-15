const USERS_KEY = 'studyflow-users-v1';
const SESSION_KEY = 'studyflow-session-v1';
const focusMinutes = 25;
let activeUser = null;
let userData = null;
let timerSeconds = focusMinutes * 60;
let timerId = null;
let isRunning = false;
let authMode = 'login';

const $ = (id) => document.getElementById(id);
const elements = {
  authScreen: $('authScreen'), appShell: $('appShell'), authForm: $('authForm'), nameField: $('nameField'), displayName: $('displayName'), email: $('email'), password: $('password'), authError: $('authError'), authSubmit: $('authSubmit'), loginTab: $('loginTab'), signupTab: $('signupTab'),
  welcomeName: $('welcomeName'), sidebarUserName: $('sidebarUserName'), sidebarUserEmail: $('sidebarUserEmail'), userAvatar: $('userAvatar'), logoutBtn: $('logoutBtn'), currentDate: $('currentDate'), timerDisplay: $('timerDisplay'), totalStudyTime: $('totalStudyTime'), pomodoroCount: $('pomodoroCount'), streakCount: $('streakCount'), taskForm: $('taskForm'), taskInput: $('taskInput'), taskCategory: $('taskCategory'), taskList: $('taskList'), emptyTasks: $('emptyTasks'), taskCount: $('taskCount'), planGrid: $('planGrid'), startBtn: $('startBtn'), pauseBtn: $('pauseBtn'), resetBtn: $('resetBtn'), todayStatus: $('todayStatus'), timerRing: document.querySelector('.timer-ring')
};

function readUsers() {
  try { const users = JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); return users && typeof users === 'object' ? users : {}; }
  catch { return {}; }
}
function saveUser() {
  if (!activeUser || !userData) return;
  try { localStorage.setItem(`studyflow-data:${activeUser.email}`, JSON.stringify(userData)); }
  catch { showAuthError('保存できませんでした。ブラウザーのストレージ設定をご確認ください。'); }
}
function loadUserData(email) {
  try {
    const saved = JSON.parse(localStorage.getItem(`studyflow-data:${email}`) || 'null');
    if (saved && Array.isArray(saved.tasks)) return { ...saved, tasks: saved.tasks };
  } catch { /* Start with an empty personal dashboard if stored data is invalid. */ }
  return { tasks: [], totalStudyTime: 0, pomodoroCount: 0, streakCount: 0 };
}
function showAuthError(message) { elements.authError.textContent = message; }
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  elements.nameField.classList.toggle('hidden', !signup);
  elements.displayName.required = signup;
  elements.password.autocomplete = signup ? 'new-password' : 'current-password';
  elements.authSubmit.textContent = signup ? 'アカウントを作成' : 'ログイン';
  elements.loginTab.classList.toggle('active', !signup);
  elements.signupTab.classList.toggle('active', signup);
  showAuthError('');
}
function cleanString(value, maxLength) { return String(value || '').trim().slice(0, maxLength); }
function handleAuth(event) {
  event.preventDefault();
  showAuthError('');
  const email = cleanString(elements.email.value, 254).toLowerCase();
  const password = elements.password.value;
  const users = readUsers();
  if (password.length < 8) { showAuthError('パスワードは8文字以上で入力してください。'); return; }

  if (authMode === 'signup') {
    const name = cleanString(elements.displayName.value, 40);
    if (!name) { showAuthError('表示名を入力してください。'); return; }
    if (users[email]) { showAuthError('このメールアドレスは登録済みです。ログインしてください。'); return; }
    // Demo only: this static-site prototype stores credentials locally, not securely.
    users[email] = { name, password };
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
    catch { showAuthError('アカウントを保存できませんでした。'); return; }
    signIn(email, users[email]);
    return;
  }
  const user = users[email];
  if (!user || user.password !== password) { showAuthError('メールアドレスまたはパスワードが違います。'); return; }
  signIn(email, user);
}
function signIn(email, user) {
  activeUser = { email, name: user.name };
  userData = loadUserData(email);
  try { sessionStorage.setItem(SESSION_KEY, email); } catch { /* Session persistence is optional. */ }
  elements.authScreen.classList.add('hidden');
  elements.appShell.classList.remove('hidden');
  elements.welcomeName.textContent = user.name;
  elements.sidebarUserName.textContent = user.name;
  elements.sidebarUserEmail.textContent = email;
  elements.userAvatar.textContent = [...user.name][0] || 'S';
  renderDashboard();
}
function logout() {
  pauseTimer();
  activeUser = null;
  userData = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* Ignore unavailable session storage. */ }
  elements.appShell.classList.add('hidden');
  elements.authScreen.classList.remove('hidden');
  elements.authForm.reset();
  setAuthMode('login');
  timerSeconds = focusMinutes * 60;
  updateTimerDisplay();
}
function formatDate() {
  elements.currentDate.textContent = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}
function renderTasks() {
  elements.taskList.replaceChildren();
  userData.tasks.forEach((task) => {
    const item = document.createElement('li');
    item.className = `task-item${task.done ? ' done' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.done); checkbox.setAttribute('aria-label', `${task.text}を完了`);
    checkbox.addEventListener('change', () => { task.done = checkbox.checked; saveUser(); renderDashboard(); });
    const text = document.createElement('span'); text.className = 'task-text'; text.textContent = task.text;
    const tag = document.createElement('span'); tag.className = 'task-tag'; tag.textContent = task.category;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-task'; remove.textContent = '×'; remove.setAttribute('aria-label', `${task.text}を削除`);
    remove.addEventListener('click', () => { userData.tasks = userData.tasks.filter((entry) => entry.id !== task.id); saveUser(); renderDashboard(); });
    item.append(checkbox, text, tag, remove);
    elements.taskList.append(item);
  });
  elements.emptyTasks.classList.toggle('hidden', userData.tasks.length > 0);
  elements.taskCount.textContent = `${userData.tasks.filter((task) => task.done).length}/${userData.tasks.length}件`;
  const completed = userData.tasks.filter((task) => task.done).length;
  elements.todayStatus.textContent = userData.tasks.length ? `${Math.round(completed / userData.tasks.length * 100)}% 達成` : '今日の学習を始めよう';
}
function renderProgress() {
  const categories = ['英語', '数学', 'IT', '国語'];
  elements.planGrid.replaceChildren();
  categories.forEach((category) => {
    const tasks = userData.tasks.filter((task) => task.category === category);
    const done = tasks.filter((task) => task.done).length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const card = document.createElement('div'); card.className = 'plan-card';
    const top = document.createElement('div'); top.className = 'plan-top';
    const title = document.createElement('h4'); title.textContent = category;
    const meta = document.createElement('span'); meta.className = 'progress-meta'; meta.textContent = `${done}/${tasks.length}`;
    top.append(title, meta);
    const bar = document.createElement('div'); bar.className = 'progress-bar'; bar.setAttribute('role','progressbar'); bar.setAttribute('aria-valuenow',String(percent)); bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax','100');
    const fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = `${percent}%`; bar.append(fill);
    const caption = document.createElement('div'); caption.className = 'progress-meta'; caption.style.marginTop = '10px'; caption.textContent = `${percent}% 完了`;
    card.append(top, bar, caption); elements.planGrid.append(card);
  });
}
function renderDashboard() {
  if (!userData) return;
  formatDate(); renderTasks(); renderProgress();
  elements.totalStudyTime.textContent = `${userData.totalStudyTime}分`;
  elements.pomodoroCount.textContent = String(userData.pomodoroCount);
  elements.streakCount.textContent = `${userData.streakCount}日`;
}
function updateTimerDisplay() {
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const seconds = String(timerSeconds % 60).padStart(2, '0');
  elements.timerDisplay.textContent = `${minutes}:${seconds}`;
  const progress = 1 - timerSeconds / (focusMinutes * 60);
  elements.timerRing.style.background = `conic-gradient(var(--primary) ${progress * 360}deg, #e7ecff ${progress * 360}deg 360deg)`;
}
function startTimer() {
  if (isRunning || !activeUser) return;
  isRunning = true; elements.todayStatus.textContent = '集中中';
  timerId = window.setInterval(() => {
    timerSeconds -= 1; updateTimerDisplay();
    if (timerSeconds <= 0) {
      window.clearInterval(timerId); timerId = null; isRunning = false;
      userData.pomodoroCount += 1; userData.totalStudyTime += focusMinutes;
      saveUser(); renderDashboard();
      elements.todayStatus.textContent = '1ポモドーロ達成';
      timerSeconds = focusMinutes * 60; updateTimerDisplay();
    }
  }, 1000);
}
function pauseTimer() {
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null; isRunning = false;
  if (activeUser && timerSeconds < focusMinutes * 60) elements.todayStatus.textContent = '一時停止';
}
function resetTimer() {
  pauseTimer(); timerSeconds = focusMinutes * 60; updateTimerDisplay();
  if (activeUser) elements.todayStatus.textContent = '集中開始';
}
function addTask(event) {
  event.preventDefault();
  const text = cleanString(elements.taskInput.value, 100);
  if (!text || !activeUser) return;
  userData.tasks.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, category: elements.taskCategory.value, done: false });
  saveUser(); elements.taskForm.reset(); renderDashboard(); elements.taskInput.focus();
}
function restoreSession() {
  try {
    const email = sessionStorage.getItem(SESSION_KEY);
    const user = email && readUsers()[email];
    if (user) { signIn(email, user); return; }
  } catch { /* Show login screen if session storage is unavailable. */ }
  elements.authScreen.classList.remove('hidden');
}

elements.loginTab.addEventListener('click', () => setAuthMode('login'));
elements.signupTab.addEventListener('click', () => setAuthMode('signup'));
elements.authForm.addEventListener('submit', handleAuth);
elements.logoutBtn.addEventListener('click', logout);
elements.taskForm.addEventListener('submit', addTask);
elements.startBtn.addEventListener('click', startTimer);
elements.pauseBtn.addEventListener('click', pauseTimer);
elements.resetBtn.addEventListener('click', resetTimer);
updateTimerDisplay();
restoreSession();
