const SUPABASE_URL = window.STUDYFLOW_SUPABASE_URL;
const SUPABASE_KEY = window.STUDYFLOW_SUPABASE_ANON_KEY;
const $ = (id) => document.getElementById(id);
let client = null;
let clientError = '';
try {
  if (!window.supabase) throw new Error('Supabaseライブラリを読み込めませんでした。');
  const parsedUrl = new URL(SUPABASE_URL || '');
  if (parsedUrl.protocol !== 'https:' || !SUPABASE_KEY || SUPABASE_KEY.includes('YOUR_')) {
    throw new Error('SupabaseのProject URLまたは公開可能キーが未設定です。');
  }
  client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (error) {
  clientError = error.message || 'Supabaseの接続設定を確認してください。';
  console.error('Supabase initialization failed:', error);
}
const state = { user: null, profile: null, mode: 'login', busy: false, saving: Promise.resolve() };
const today = () => new Date().toLocaleDateString('sv-SE');
const blankWorkspace = () => ({ tasks: [], notes: [], habits: [], events: [] });
const el = {
  authScreen: $('authScreen'), app: $('app'), authForm: $('authForm'), nameField: $('nameField'), displayName: $('displayName'), email: $('email'), password: $('password'), authMessage: $('authMessage'), authSubmit: $('authSubmit'), loginTab: $('loginTab'), signupTab: $('signupTab'), logoutBtn: $('logoutBtn'), profileName: $('profileName'), profileEmail: $('profileEmail'), avatar: $('avatar'), welcomeName: $('welcomeName'), todayLabel: $('todayLabel'), pageTitle: $('pageTitle'), taskForm: $('taskForm'), taskInput: $('taskInput'), taskList: $('taskList'), taskEmpty: $('taskEmpty'), homeTaskList: $('homeTaskList'), homeTaskEmpty: $('homeTaskEmpty'), noteForm: $('noteForm'), noteTitle: $('noteTitle'), noteBody: $('noteBody'), noteList: $('noteList'), noteEmpty: $('noteEmpty'), habitForm: $('habitForm'), habitInput: $('habitInput'), habitList: $('habitList'), habitEmpty: $('habitEmpty'), eventForm: $('eventForm'), eventTitle: $('eventTitle'), eventDate: $('eventDate'), eventList: $('eventList'), eventEmpty: $('eventEmpty'), homeEventList: $('homeEventList'), homeEventEmpty: $('homeEventEmpty'), summaryTasks: $('summaryTasks'), summaryNotes: $('summaryNotes'), summaryHabits: $('summaryHabits')
};
function message(text, success = false) { el.authMessage.textContent = text; el.authMessage.classList.toggle('success', success); }
function setMode(mode) {
  state.mode = mode;
  const signup = mode === 'signup';
  el.nameField.classList.toggle('hidden', !signup);
  el.displayName.required = signup;
  el.password.autocomplete = signup ? 'new-password' : 'current-password';
  el.loginTab.classList.toggle('active', !signup);
  el.signupTab.classList.toggle('active', signup);
  el.authSubmit.textContent = signup ? 'アカウントを作成' : 'ログイン';
  message(client ? '' : clientError);
}
// The tab buttons call this directly as well as using registered listeners, avoiding stale-handler issues.
window.myHubSetAuthMode = setMode;
function normalizeWorkspace(value) { const data = value && typeof value === 'object' ? value : {}; return { tasks: Array.isArray(data.tasks) ? data.tasks : [], notes: Array.isArray(data.notes) ? data.notes : [], habits: Array.isArray(data.habits) ? data.habits : [], events: Array.isArray(data.events) ? data.events : [] }; }
async function profileFor(user, name = '') {
  const { data, error } = await client.from('study_profiles').select('user_id,name,workspace').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data) return { name: data.name || name || user.user_metadata?.full_name || 'ユーザー', workspace: normalizeWorkspace(data.workspace) };
  const profile = { name: name || user.user_metadata?.full_name || 'ユーザー', workspace: blankWorkspace() };
  const { error: insertError } = await client.from('study_profiles').insert({ user_id: user.id, name: profile.name, workspace: profile.workspace });
  if (insertError) throw insertError;
  return profile;
}
function showApp(user) {
  state.user = user; el.authScreen.classList.add('hidden'); el.app.classList.remove('hidden');
  const name = state.profile?.name || user.user_metadata?.full_name || 'ユーザー';
  el.profileName.textContent = name; el.profileEmail.textContent = user.email || ''; el.avatar.textContent = [...name][0] || 'H'; el.welcomeName.textContent = name;
  el.todayLabel.textContent = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  render(); showView('home');
}
async function authenticate(event) {
  event.preventDefault(); if (state.busy) return; message('');
  if (!client) { message(clientError || 'Supabaseの接続設定を確認してください。'); return; }
  state.busy = true; el.authSubmit.disabled = true; el.authSubmit.textContent = '処理中…';
  try {
    const email = el.email.value.trim().toLowerCase(), password = el.password.value;
    if (password.length < 8) throw new Error('パスワードは8文字以上で入力してください。');
    if (state.mode === 'signup') {
      const name = el.displayName.value.trim().slice(0, 40); if (!name) throw new Error('表示名を入力してください。');
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
      if (data.session && data.user) { state.profile = await profileFor(data.user, name); showApp(data.user); }
      else message('確認メールを送りました。メール内のリンクを確認してからログインしてください。', true);
    } else {
      const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error;
      state.profile = await profileFor(data.user); showApp(data.user);
    }
  } catch (error) { console.error('Authentication failed:', error); message(error.message || '認証に失敗しました。'); }
  finally { state.busy = false; el.authSubmit.disabled = false; el.authSubmit.textContent = state.mode === 'signup' ? 'アカウントを作成' : 'ログイン'; }
}
function save() {
  if (!state.user || !state.profile || !client) return;
  const uid = state.user.id, payload = { user_id: uid, name: state.profile.name, workspace: state.profile.workspace, updated_at: new Date().toISOString() };
  state.saving = state.saving.catch(() => {}).then(async () => { if (state.user?.id !== uid) return; const { error } = await client.from('study_profiles').update(payload).eq('user_id', uid); if (error) { console.error(error); window.alert('保存できませんでした。通信とSupabase設定をご確認ください。'); } });
  return state.saving;
}
function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function makeButton(label, className, action) { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label; button.setAttribute('aria-label', label); button.addEventListener('click', action); return button; }
function renderTasks() {
  const tasks = state.profile.workspace.tasks; el.taskList.replaceChildren(); el.homeTaskList.replaceChildren(); const open = tasks.filter(task => !task.done); el.summaryTasks.textContent = String(open.length);
  for (const task of tasks) { const li = document.createElement('li'); li.className = `task-item${task.done ? ' completed' : ''}`; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = Boolean(task.done); check.setAttribute('aria-label', `${task.text}を完了`); check.addEventListener('change', () => { task.done = check.checked; render(); save(); }); const text = document.createElement('span'); text.className = 'item-copy'; text.textContent = task.text; const del = makeButton('削除', 'delete-button', () => { state.profile.workspace.tasks = tasks.filter(item => item.id !== task.id); render(); save(); }); li.append(check, text, del); el.taskList.append(li); }
  el.taskEmpty.classList.toggle('hidden', tasks.length > 0);
  for (const task of open.slice(0, 5)) { const li = document.createElement('li'); li.className = 'simple-item'; const dot = document.createElement('span'); dot.className = 'list-dot'; const text = document.createElement('span'); text.textContent = task.text; li.append(dot, text); el.homeTaskList.append(li); }
  el.homeTaskEmpty.classList.toggle('hidden', open.length > 0);
}
function renderNotes() {
  const notes = state.profile.workspace.notes; el.noteList.replaceChildren(); el.summaryNotes.textContent = String(notes.length);
  for (const note of [...notes].reverse()) { const card = document.createElement('article'); card.className = 'note-card'; const title = document.createElement('h3'); title.textContent = note.title; const body = document.createElement('p'); body.textContent = note.body || ''; const date = document.createElement('small'); date.textContent = new Date(note.createdAt).toLocaleDateString('ja-JP'); const del = makeButton('削除', 'delete-button', () => { state.profile.workspace.notes = notes.filter(item => item.id !== note.id); render(); save(); }); card.append(title, body, date, del); el.noteList.append(card); }
  el.noteEmpty.classList.toggle('hidden', notes.length > 0);
}
function renderHabits() {
  const habits = state.profile.workspace.habits, done = habits.filter(habit => habit.lastDone === today()).length; el.summaryHabits.textContent = `${done} / ${habits.length}`; el.habitList.replaceChildren();
  for (const habit of habits) { const li = document.createElement('li'); li.className = 'task-item'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = habit.lastDone === today(); check.setAttribute('aria-label', `${habit.text}を今日完了`); check.addEventListener('change', () => { habit.lastDone = check.checked ? today() : ''; render(); save(); }); const text = document.createElement('span'); text.className = 'item-copy'; text.textContent = habit.text; const del = makeButton('削除', 'delete-button', () => { state.profile.workspace.habits = habits.filter(item => item.id !== habit.id); render(); save(); }); li.append(check, text, del); el.habitList.append(li); }
  el.habitEmpty.classList.toggle('hidden', habits.length > 0);
}
function renderEvents() {
  const events = state.profile.workspace.events, sorted = [...events].sort((a, b) => a.date.localeCompare(b.date)); el.eventList.replaceChildren(); el.homeEventList.replaceChildren();
  for (const event of sorted) { const li = document.createElement('li'); li.className = 'event-item'; const date = document.createElement('time'); date.className = 'event-date'; date.dateTime = event.date; date.textContent = new Date(`${event.date}T00:00:00`).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' }); const text = document.createElement('span'); text.className = 'item-copy'; text.textContent = event.title; const del = makeButton('削除', 'delete-button', () => { state.profile.workspace.events = events.filter(item => item.id !== event.id); render(); save(); }); li.append(date, text, del); el.eventList.append(li); }
  const upcoming = sorted.filter(event => event.date >= today()).slice(0, 4);
  for (const event of upcoming) { const li = document.createElement('li'); li.className = 'simple-item'; const date = document.createElement('time'); date.className = 'event-date'; date.textContent = new Date(`${event.date}T00:00:00`).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }); const text = document.createElement('span'); text.textContent = event.title; li.append(date, text); el.homeEventList.append(li); }
  el.eventEmpty.classList.toggle('hidden', events.length > 0); el.homeEventEmpty.classList.toggle('hidden', upcoming.length > 0);
}
function render() { if (state.profile) { renderTasks(); renderNotes(); renderHabits(); renderEvents(); } }
const titles = { home: 'ホーム', tasks: 'タスク', notes: 'メモ', habits: '習慣', events: '予定' };
function showView(name) { for (const view of Object.keys(titles)) $(view + 'View').classList.toggle('hidden', view !== name); document.querySelectorAll('.nav-link').forEach(button => button.classList.toggle('active', button.dataset.view === name)); $('pageTitle').textContent = titles[name]; }
async function logout() { if (!client) return; const { error } = await client.auth.signOut(); if (error) { message('ログアウトできませんでした。もう一度お試しください。'); return; } state.user = null; state.profile = null; el.app.classList.add('hidden'); el.authScreen.classList.remove('hidden'); el.authForm.reset(); setMode('login'); }
async function init() {
  setMode('login'); el.eventDate.value = today();
  el.loginTab.addEventListener('click', () => setMode('login')); el.signupTab.addEventListener('click', () => setMode('signup')); el.authForm.addEventListener('submit', authenticate); el.logoutBtn.addEventListener('click', logout);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view))); document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showView(button.dataset.go)));
  el.taskForm.addEventListener('submit', event => { event.preventDefault(); const text = el.taskInput.value.trim(); if (!text || !state.profile) return; state.profile.workspace.tasks.unshift({ id: uid(), text, done: false }); el.taskForm.reset(); render(); save(); });
  el.noteForm.addEventListener('submit', event => { event.preventDefault(); const title = el.noteTitle.value.trim(); if (!title || !state.profile) return; state.profile.workspace.notes.unshift({ id: uid(), title, body: el.noteBody.value.trim(), createdAt: new Date().toISOString() }); el.noteForm.reset(); render(); save(); });
  el.habitForm.addEventListener('submit', event => { event.preventDefault(); const text = el.habitInput.value.trim(); if (!text || !state.profile) return; state.profile.workspace.habits.push({ id: uid(), text, lastDone: '' }); el.habitForm.reset(); render(); save(); });
  el.eventForm.addEventListener('submit', event => { event.preventDefault(); const title = el.eventTitle.value.trim(); if (!title || !el.eventDate.value || !state.profile) return; state.profile.workspace.events.push({ id: uid(), title, date: el.eventDate.value }); el.eventForm.reset(); el.eventDate.value = today(); render(); save(); });
  if (!client) { message(clientError || 'Supabase接続設定が確認できません。'); return; }
  try { const { data, error } = await client.auth.getSession(); if (error) throw error; if (data.session?.user) { state.profile = await profileFor(data.session.user); showApp(data.session.user); } client.auth.onAuthStateChange((event, session) => { if ((event === 'SIGNED_OUT' || !session) && state.user) { state.user = null; state.profile = null; el.app.classList.add('hidden'); el.authScreen.classList.remove('hidden'); } }); }
  catch (error) { console.error('Could not restore session:', error); message(error.message || 'ログイン状態を確認できませんでした。ページを再読み込みしてください。'); }
}
init();
