const SUPABASE_URL = window.STUDYFLOW_SUPABASE_URL;
const SUPABASE_KEY = window.STUDYFLOW_SUPABASE_ANON_KEY;
const focusMinutes = 25;
const isSupabaseConfigured = Boolean(
  window.supabase && SUPABASE_URL && SUPABASE_KEY &&
  !SUPABASE_URL.includes('YOUR_') && !SUPABASE_KEY.includes('YOUR_')
);
const supabase = isSupabaseConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let activeUser = null;
let userData = null;
let timerSeconds = focusMinutes * 60;
let timerId = null;
let isRunning = false;
let authMode = 'login';
let authBusy = false;
let saveQueue = Promise.resolve();
const $ = (id) => document.getElementById(id);
const el = {
  authScreen: $('authScreen'), appShell: $('appShell'), authForm: $('authForm'), nameField: $('nameField'), displayName: $('displayName'), email: $('email'), password: $('password'), authError: $('authError'), authSubmit: $('authSubmit'), loginTab: $('loginTab'), signupTab: $('signupTab'), welcomeName: $('welcomeName'), sidebarUserName: $('sidebarUserName'), sidebarUserEmail: $('sidebarUserEmail'), userAvatar: $('userAvatar'), logoutBtn: $('logoutBtn'), currentDate: $('currentDate'), timerDisplay: $('timerDisplay'), totalStudyTime: $('totalStudyTime'), pomodoroCount: $('pomodoroCount'), streakCount: $('streakCount'), taskForm: $('taskForm'), taskInput: $('taskInput'), taskCategory: $('taskCategory'), taskList: $('taskList'), emptyTasks: $('emptyTasks'), taskCount: $('taskCount'), planGrid: $('planGrid'), startBtn: $('startBtn'), pauseBtn: $('pauseBtn'), resetBtn: $('resetBtn'), todayStatus: $('todayStatus'), timerRing: document.querySelector('.timer-ring')
};

function showMessage(message, isError = true) {
  el.authError.textContent = message;
  el.authError.classList.toggle('success-message', !isError);
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === 'signup';
  el.nameField.classList.toggle('hidden', !signup);
  el.displayName.required = signup;
  el.password.autocomplete = signup ? 'new-password' : 'current-password';
  el.authSubmit.textContent = signup ? 'アカウントを作成' : 'ログイン';
  el.loginTab.classList.toggle('active', !signup);
  el.signupTab.classList.toggle('active', signup);
  showMessage('');
}
function setBusy(busy) {
  authBusy = busy;
  el.authSubmit.disabled = busy;
  el.authSubmit.textContent = busy ? '処理中…' : (authMode === 'signup' ? 'アカウントを作成' : 'ログイン');
}
function safeName(value) { return String(value || '').trim().slice(0, 40); }
function makeDefaultData(name) {
  return { name: name || '学習者', tasks: [], totalStudyTime: 0, pomodoroCount: 0, streakCount: 0 };
}
function normalizeData(row) {
  return {
    name: row.name || activeUser?.name || '学習者',
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    totalStudyTime: Number(row.total_study_time) || 0,
    pomodoroCount: Number(row.pomodoro_count) || 0,
    streakCount: Number(row.streak_count) || 0
  };
}
async function loadProfile(user, fallbackName) {
  const { data, error } = await supabase.from('study_profiles')
    .select('user_id,name,tasks,total_study_time,pomodoro_count,streak_count')
    .eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return normalizeData(data);

  const profile = makeDefaultData(fallbackName || user.user_metadata?.full_name);
  const { error: insertError } = await supabase.from('study_profiles').insert({
    user_id: user.id, name: profile.name, tasks: [], total_study_time: 0, pomodoro_count: 0, streak_count: 0
  });
  if (insertError) throw insertError;
  return profile;
}
async function persistProfile() {
  if (!activeUser || !userData || !supabase) return;
  const snapshot = {
    user_id: activeUser.id,
    name: userData.name,
    tasks: userData.tasks,
    total_study_time: userData.totalStudyTime,
    pomodoro_count: userData.pomodoroCount,
    streak_count: userData.streakCount,
    updated_at: new Date().toISOString()
  };
  // Serialize writes so quick checkbox/task actions cannot overwrite newer data.
  saveQueue = saveQueue.then(async () => {
    if (!activeUser || snapshot.user_id !== activeUser.id) return;
    const { error } = await supabase.from('study_profiles').update(snapshot).eq('user_id', snapshot.user_id);
    if (error) throw error;
  });
  try { await saveQueue; }
  catch (error) { console.error('Profile save failed:', error); showMessage('学習データを保存できませんでした。通信状態とSupabaseのRLS設定をご確認ください。'); }
}
function showDashboard(user) {
  activeUser = { id: user.id, email: user.email, name: userData.name || user.user_metadata?.full_name || '学習者' };
  el.authScreen.classList.add('hidden');
  el.appShell.classList.remove('hidden');
  el.welcomeName.textContent = activeUser.name;
  el.sidebarUserName.textContent = activeUser.name;
  el.sidebarUserEmail.textContent = activeUser.email || '';
  el.userAvatar.textContent = [...activeUser.name][0] || 'S';
  renderDashboard();
}
async function authenticate(event) {
  event.preventDefault();
  if (authBusy) return;
  showMessage('');
  if (!supabase) {
    showMessage('Supabaseの設定がまだです。supabase-config.js に Project URL と publishable/anon key を設定してください。');
    return;
  }
  const email = el.email.value.trim().toLowerCase();
  const password = el.password.value;
  if (password.length < 8) { showMessage('パスワードは8文字以上で入力してください。'); return; }
  setBusy(true);
  try {
    if (authMode === 'signup') {
      const name = safeName(el.displayName.value);
      if (!name) { showMessage('表示名を入力してください。'); return; }
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      if (data.session && data.user) {
        userData = await loadProfile(data.user, name);
        showDashboard(data.user);
      } else {
        showMessage('登録確認メールを送りました。メール内のリンクを確認してからログインしてください。', false);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      userData = await loadProfile(data.user);
      showDashboard(data.user);
    }
  } catch (error) {
    console.error(error);
    const message = error?.message || '認証に失敗しました。入力内容とSupabase設定をご確認ください。';
    showMessage(message.includes('Invalid login') ? 'メールアドレスまたはパスワードが違います。' : message);
  } finally { setBusy(false); }
}
async function logout() {
  pauseTimer();
  const { error } = await supabase.auth.signOut();
  if (error) { showMessage('ログアウトできませんでした。もう一度お試しください。'); return; }
  activeUser = null; userData = null;
  el.appShell.classList.add('hidden'); el.authScreen.classList.remove('hidden'); el.authForm.reset();
  setAuthMode('login'); timerSeconds = focusMinutes * 60; updateTimerDisplay();
}
function formatDate() {
  el.currentDate.textContent = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'long' });
}
function renderTasks() {
  el.taskList.replaceChildren();
  userData.tasks.forEach((task) => {
    const item = document.createElement('li'); item.className = `task-item${task.done ? ' done' : ''}`;
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.done); checkbox.setAttribute('aria-label', `${task.text}を完了`);
    checkbox.addEventListener('change', async () => { task.done = checkbox.checked; renderDashboard(); await persistProfile(); });
    const text = document.createElement('span'); text.className = 'task-text'; text.textContent = task.text;
    const tag = document.createElement('span'); tag.className = 'task-tag'; tag.textContent = task.category;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-task'; remove.textContent = '×'; remove.setAttribute('aria-label', `${task.text}を削除`);
    remove.addEventListener('click', async () => { userData.tasks = userData.tasks.filter((entry) => entry.id !== task.id); renderDashboard(); await persistProfile(); });
    item.append(checkbox, text, tag, remove); el.taskList.append(item);
  });
  el.emptyTasks.classList.toggle('hidden', userData.tasks.length > 0);
  el.taskCount.textContent = `${userData.tasks.filter((task) => task.done).length}/${userData.tasks.length}件`;
  const completed = userData.tasks.filter((task) => task.done).length;
  el.todayStatus.textContent = userData.tasks.length ? `${Math.round(completed / userData.tasks.length * 100)}% 達成` : '今日の学習を始めよう';
}
function renderProgress() {
  el.planGrid.replaceChildren();
  ['英語','数学','IT','国語'].forEach((category) => {
    const tasks = userData.tasks.filter((task) => task.category === category);
    const done = tasks.filter((task) => task.done).length;
    const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const card = document.createElement('div'); card.className = 'plan-card';
    const top = document.createElement('div'); top.className = 'plan-top';
    const title = document.createElement('h4'); title.textContent = category;
    const count = document.createElement('span'); count.className = 'progress-meta'; count.textContent = `${done}/${tasks.length}`; top.append(title, count);
    const bar = document.createElement('div'); bar.className = 'progress-bar'; bar.setAttribute('role','progressbar'); bar.setAttribute('aria-valuenow',String(percent)); bar.setAttribute('aria-valuemin','0'); bar.setAttribute('aria-valuemax','100');
    const fill = document.createElement('div'); fill.className = 'progress-fill'; fill.style.width = `${percent}%`; bar.append(fill);
    const caption = document.createElement('div'); caption.className = 'progress-meta'; caption.style.marginTop = '10px'; caption.textContent = `${percent}% 完了`;
    card.append(top, bar, caption); el.planGrid.append(card);
  });
}
function renderDashboard() {
  if (!userData) return;
  formatDate(); renderTasks(); renderProgress();
  el.totalStudyTime.textContent = `${userData.totalStudyTime}分`;
  el.pomodoroCount.textContent = String(userData.pomodoroCount);
  el.streakCount.textContent = `${userData.streakCount}日`;
}
function updateTimerDisplay() {
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2,'0');
  const seconds = String(timerSeconds % 60).padStart(2,'0');
  el.timerDisplay.textContent = `${minutes}:${seconds}`;
  const progress = 1 - timerSeconds / (focusMinutes * 60);
  el.timerRing.style.background = `conic-gradient(var(--primary) ${progress * 360}deg, #e7ecff ${progress * 360}deg 360deg)`;
}
function startTimer() {
  if (isRunning || !activeUser) return;
  isRunning = true; el.todayStatus.textContent = '集中中';
  timerId = window.setInterval(async () => {
    timerSeconds -= 1; updateTimerDisplay();
    if (timerSeconds <= 0) {
      window.clearInterval(timerId); timerId = null; isRunning = false;
      userData.pomodoroCount += 1; userData.totalStudyTime += focusMinutes;
      renderDashboard(); await persistProfile();
      el.todayStatus.textContent = '1ポモドーロ達成'; timerSeconds = focusMinutes * 60; updateTimerDisplay();
      document.title = 'StudyFlow — セッション完了';
    }
  }, 1000);
}
function pauseTimer() {
  if (timerId !== null) window.clearInterval(timerId);
  timerId = null; isRunning = false;
  if (activeUser && timerSeconds < focusMinutes * 60) el.todayStatus.textContent = '一時停止';
}
function resetTimer() {
  pauseTimer(); timerSeconds = focusMinutes * 60; updateTimerDisplay(); document.title = 'StudyFlow — 自分だけの学習スペース';
  if (activeUser) el.todayStatus.textContent = '集中開始';
}
async function addTask(event) {
  event.preventDefault();
  const text = el.taskInput.value.trim().slice(0,100);
  if (!text || !activeUser) return;
  userData.tasks.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), text, category: el.taskCategory.value, done: false });
  el.taskForm.reset(); renderDashboard(); await persistProfile(); el.taskInput.focus();
}
async function init() {
  setAuthMode('login'); updateTimerDisplay();
  el.loginTab.addEventListener('click', () => setAuthMode('login'));
  el.signupTab.addEventListener('click', () => setAuthMode('signup'));
  el.authForm.addEventListener('submit', authenticate);
  el.logoutBtn.addEventListener('click', logout);
  el.taskForm.addEventListener('submit', addTask);
  el.startBtn.addEventListener('click', startTimer);
  el.pauseBtn.addEventListener('click', pauseTimer);
  el.resetBtn.addEventListener('click', resetTimer);
  if (!supabase) {
    showMessage('Supabaseの接続設定が必要です。設定手順はリポジトリの README をご覧ください。');
    return;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) { showMessage('認証状態を確認できませんでした。再読み込みしてください。'); return; }
  if (data.session?.user) {
    try { userData = await loadProfile(data.session.user); showDashboard(data.session.user); }
    catch (profileError) { console.error(profileError); showMessage('プロフィールを読み込めません。Supabase のテーブルと RLS 設定をご確認ください。'); }
  }
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      if (activeUser) { activeUser = null; userData = null; el.appShell.classList.add('hidden'); el.authScreen.classList.remove('hidden'); }
    }
  });
}
init();
