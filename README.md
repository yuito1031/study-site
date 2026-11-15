const STORAGE_KEY = 'studyflow-data-v1';

const defaultState = {
  tasks: [
    { id: 1, text: '英単語 20個を覚える', category: '英語', done: false },
    { id: 2, text: '数学の復習 30分', category: '数学', done: true },
    { id: 3, text: 'プログラミングの演習', category: 'IT', done: false }
  ],
  totalStudyTime: 120,
  pomodoroCount: 4,
  streakCount: 7,
  focusMinutes: 25
};

let state = loadState();
let timerSeconds = state.focusMinutes * 60;
let timerId = null;
let isRunning = false;

const elements = {
  currentDate: document.getElementById('currentDate'),
  timerDisplay: document.getElementById('timerDisplay'),
  totalStudyTime: document.getElementById('totalStudyTime'),
  pomodoroCount: document.getElementById('pomodoroCount'),
  streakCount: document.getElementById('streakCount'),
  taskForm: document.getElementById('taskForm'),
  taskInput: document.getElementById('taskInput'),
  taskCategory: document.getElementById('taskCategory'),
  taskList: document.getElementById('taskList'),
  planGrid: document.getElementById('planGrid'),
  startBtn: document.getElementById('startBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  resetBtn: document.getElementById('resetBtn'),
  todayStatus: document.getElementById('todayStatus')
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch {
    return defaultState;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate() {
  const now = new Date();
  const formatted = now.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'long'
  });
  elements.currentDate.textContent = formatted;
}

function updateProgressData() {
  const categories = ['英語', '数学', 'IT', '国語'];
  const cards = categories.map((category) => {
    const tasks = state.tasks.filter((task) => task.category === category);
    const done = tasks.filter((task) => task.done).length;
    const total = tasks.length || 1;
    const percent = Math.min(100, Math.round((done / total) * 100));

    return {
      category,
      percent,
      done,
      total
    };
  });

  elements.planGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="plan-card">
          <div class="plan-top">
            <h4>${card.category}</h4>
            <span class="progress-meta">${card.done}/${card.total}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${card.percent}%"></div>
          </div>
          <div class="progress-meta" style="margin-top: 10px;">${card.percent}% 完了</div>
        </div>
      `
    )
    .join('');
}

function renderTasks() {
  elements.taskList.innerHTML = state.tasks
    .map(
      (task) => `
        <li class="task-item ${task.done ? 'done' : ''}">
          <input type="checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''} />
          <span class="task-text">${task.text}</span>
          <span class="task-tag">${task.category}</span>
        </li>
      `
    )
    .join('');

  const doneTasks = state.tasks.filter((task) => task.done).length;
  const totalTasks = state.tasks.length || 1;
  const completionRate = Math.round((doneTasks / totalTasks) * 100);
  elements.todayStatus.textContent = `${completionRate}% 達成`;
}

function renderStats() {
  elements.totalStudyTime.textContent = `${state.totalStudyTime}分`;
  elements.pomodoroCount.textContent = String(state.pomodoroCount);
  elements.streakCount.textContent = `${state.streakCount}日`;
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const seconds = String(timerSeconds % 60).padStart(2, '0');
  elements.timerDisplay.textContent = `${minutes}:${seconds}`;
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  elements.todayStatus.textContent = '集中中';
  timerId = setInterval(() => {
    timerSeconds -= 1;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      clearInterval(timerId);
      isRunning = false;
      state.pomodoroCount += 1;
      state.totalStudyTime += state.focusMinutes;
      state.streakCount = Math.max(state.streakCount, 1);
      saveState();
      renderStats();
      elements.todayStatus.textContent = '1ポモドーロ達成';
      timerSeconds = state.focusMinutes * 60;
      updateTimerDisplay();
    }
  }, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  clearInterval(timerId);
  isRunning = false;
  elements.todayStatus.textContent = '一時停止';
}

function resetTimer() {
  clearInterval(timerId);
  isRunning = false;
  timerSeconds = state.focusMinutes * 60;
  updateTimerDisplay();
  elements.todayStatus.textContent = '集中開始';
}

function addTask(event) {
  event.preventDefault();
  const text = elements.taskInput.value.trim();
  const category = elements.taskCategory.value;

  if (!text) return;

  state.tasks.unshift({
    id: Date.now(),
    text,
    category,
    done: false
  });

  elements.taskInput.value = '';
  saveState();
  renderTasks();
  updateProgressData();
}

function handleTaskToggle(event) {
  const checkbox = event.target;
  if (!(checkbox instanceof HTMLInputElement) || !checkbox.dataset.id) return;

  const taskId = Number(checkbox.dataset.id);
  const targetTask = state.tasks.find((task) => task.id === taskId);
  if (!targetTask) return;

  targetTask.done = checkbox.checked;
  saveState();
  renderTasks();
  updateProgressData();
}

function init() {
  formatDate();
  renderTasks();
  renderStats();
  updateProgressData();
  updateTimerDisplay();

  elements.taskForm.addEventListener('submit', addTask);
  elements.taskList.addEventListener('change', handleTaskToggle);
  elements.startBtn.addEventListener('click', startTimer);
  elements.pauseBtn.addEventListener('click', pauseTimer);
  elements.resetBtn.addEventListener('click', resetTimer);
}

init();
