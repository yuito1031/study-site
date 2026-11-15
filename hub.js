const URL = window.STUDYFLOW_SUPABASE_URL;
const KEY = window.STUDYFLOW_SUPABASE_ANON_KEY;
const state = { user: null, profile: null, notebooks: [], mode:'login', busy:false, saving: Promise.resolve() };
const $ = (id) => document.getElementById(id);
const blankWorkspace = () => ({ tasks: [], notes: [], notebooks: [], habits: [], events: [] });
function normalizeWorkspace(value) {
  const data = value && typeof value === 'object' ? value : {};
  return {
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    notebooks: Array.isArray(data.notebooks) ? data.notebooks : [],
    habits: Array.isArray(data.habits) ? data.habits : [],
    events: Array.isArray(data.events) ? data.events : []
  };
}
const client = window.supabase && URL && KEY && !URL.includes('YOUR_') && !KEY.includes('YOUR_')
  ? window.supabase.createClient(URL, KEY) : null;

async function loadProfileForUser(user) {
  if (!client) throw new Error('Supabaseの設定を確認してください。');
  const { data, error } = await client.from('study_profiles').select('user_id,name,workspace').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data) {
    state.profile = data;
    state.notebooks = Array.isArray(data.workspace?.notebooks) ? data.workspace.notebooks : [];
    return data;
  }
  const profile = { name: user.user_metadata?.full_name || 'ユーザー', workspace: blankWorkspace() };
  const { error: insertError } = await client.from('study_profiles').insert({ user_id: user.id, name: profile.name, workspace: profile.workspace });
  if (insertError) throw insertError;
  state.profile = { user_id: user.id, name: profile.name, workspace: profile.workspace };
  state.notebooks = [];
  return state.profile;
}

async function loadNotebookList() {
  const list = $('notebookList');
  const empty = $('notebookEmpty');
  list.replaceChildren();
  const notebooks = [...state.notebooks].reverse();
  if (!notebooks.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  for (const item of notebooks) {
    const card = document.createElement('article');
    card.className = 'notebook-card';
    const preview = document.createElement('img');
    preview.src = item.imageDataUrl || '';
    preview.alt = item.title || 'ノート';
    preview.className = 'notebook-preview';
    const row = document.createElement('div');
    row.className = 'notebook-row';
    const title = document.createElement('strong');
    title.textContent = item.title || '無題';
    const actions = document.createElement('div');
    actions.className = 'notebook-actions';
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.textContent = '開く';
    openBtn.addEventListener('click', () => openNotebook(item));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '削除';
    delBtn.classList.add('danger');
    delBtn.addEventListener('click', () => deleteNotebook(item));
    actions.append(openBtn, delBtn);
    row.append(title, actions);
    card.append(preview, row);
    list.append(card);
  }
}

async function refreshNotebookListFromServer() {
  if (!state.user || !client) return;
  const { data, error } = await client.from('study_profiles').select('workspace').eq('user_id', state.user.id).maybeSingle();
  if (error) throw error;
  const workspace = normalizeWorkspace(data?.workspace);
  state.notebooks = workspace.notebooks;
  loadNotebookList();
}

const canvas = $('sheet');
const ctx = canvas.getContext('2d');
const stateDraw = { tool: 'pen', strokes: [], activeStroke: null, baseImage: null, currentId: null };

function setStatus(text, isError = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height)
  };
}

function drawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (stateDraw.baseImage) {
    ctx.drawImage(stateDraw.baseImage, 0, 0, canvas.width, canvas.height);
  }
  for (const stroke of stateDraw.strokes) {
    if (!stroke.points.length) continue;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over';
    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i += 1) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

function startNewPage() {
  stateDraw.currentId = null;
  stateDraw.strokes = [];
  stateDraw.baseImage = null;
  $('titleInput').value = '';
  drawCanvas();
  setStatus('新しいノートです。書いて保存してください。');
}

canvas.addEventListener('pointerdown', (event) => {
  if (!state.user) return;
  const pen = stateDraw.tool === 'pen';
  stateDraw.activeStroke = {
    erase: !pen,
    color: $('colorInput').value,
    width: Number($('sizeInput').value),
    points: [pointFromEvent(event)]
  };
  stateDraw.strokes.push(stateDraw.activeStroke);
  drawCanvas();
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!stateDraw.activeStroke) return;
  stateDraw.activeStroke.points.push(pointFromEvent(event));
  drawCanvas();
});

function endStroke() {
  stateDraw.activeStroke = null;
}

canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointerleave', endStroke);
canvas.addEventListener('pointercancel', endStroke);

$('penTool').addEventListener('click', () => {
  stateDraw.tool = 'pen';
  $('penTool').classList.add('active');
  $('eraserTool').classList.remove('active');
});

$('eraserTool').addEventListener('click', () => {
  stateDraw.tool = 'eraser';
  $('eraserTool').classList.add('active');
  $('penTool').classList.remove('active');
});

$('undoBtn').addEventListener('click', () => {
  if (stateDraw.strokes.length) {
    stateDraw.strokes.pop();
    drawCanvas();
  }
});

$('clearBtn').addEventListener('click', () => {
  if (confirm('このページの内容を消去しますか？')) {
    stateDraw.strokes = [];
    stateDraw.baseImage = null;
    drawCanvas();
  }
});

$('saveNoteBtn').addEventListener('click', async () => {
  if (!state.user || !client) {
    setStatus('ログインしてから保存できます。', true);
    return;
  }
  try {
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.75);
    const title = $('titleInput').value.trim() || '無題';
    const notebook = {
      id: stateDraw.currentId || crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
      imageDataUrl
    };
    const { data, error } = await client.from('study_profiles').select('workspace').eq('user_id', state.user.id).maybeSingle();
    if (error) throw error;
    const workspace = normalizeWorkspace(data?.workspace);
    const notebooks = Array.isArray(workspace.notebooks) ? workspace.notebooks : [];
    const index = notebooks.findIndex(item => item.id === notebook.id);
    if (index >= 0) notebooks[index] = notebook;
    else notebooks.push(notebook);
    const { error: updateError } = await client.from('study_profiles').update({
      workspace: { ...workspace, notebooks },
      updated_at: new Date().toISOString()
    }).eq('user_id', state.user.id);
    if (updateError) throw updateError;
    state.notebooks = notebooks;
    stateDraw.currentId = notebook.id;
    loadNotebookList();
    setStatus('ノートを保存しました。');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'ノートの保存に失敗しました。', true);
  }
});

function openNotebook(item) {
  stateDraw.currentId = item.id;
  $('titleInput').value = item.title || '無題';
  stateDraw.strokes = [];
  const image = new Image();
  image.onload = () => {
    stateDraw.baseImage = image;
    drawCanvas();
    setStatus(`「${item.title || '無題'}」を開きました。`);
  };
  image.onerror = () => {
    stateDraw.baseImage = null;
    drawCanvas();
    setStatus('ノートの画像を開けませんでした。', true);
  };
  image.src = item.imageDataUrl;
}

async function deleteNotebook(item) {
  if (!confirm(`「${item.title || '無題'}」を削除しますか？`)) return;
  const { data, error } = await client.from('study_profiles').select('workspace').eq('user_id', state.user.id).maybeSingle();
  if (error) throw error;
  const workspace = normalizeWorkspace(data?.workspace);
  const notebooks = (workspace.notebooks || []).filter((entry) => entry.id !== item.id);
  const { error: updateError } = await client.from('study_profiles').update({
    workspace: { ...workspace, notebooks },
    updated_at: new Date().toISOString()
  }).eq('user_id', state.user.id);
  if (updateError) throw updateError;
  state.notebooks = notebooks;
  if (stateDraw.currentId === item.id) startNewPage();
  loadNotebookList();
  setStatus('ノートを削除しました。');
}

async function initNotebookPage() {
  try {
    if (!window.supabase || !window.STUDYFLOW_SUPABASE_URL || !window.STUDYFLOW_SUPABASE_ANON_KEY) {
      throw new Error('Supabaseの設定が読み込まれていません。');
    }
    if (!window.supabase.createClient) throw new Error('Supabaseライブラリが正しく読み込まれていません。');
    client = window.supabase.createClient(window.STUDYFLOW_SUPABASE_URL, window.STUDYFLOW_SUPABASE_ANON_KEY);
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      $('loginPrompt').classList.remove('hidden');
      $('editor').classList.add('hidden');
      setStatus('ログインが必要です。', true);
      return;
    }
    state.user = data.session.user;
    $('editor').classList.remove('hidden');
    $('loginPrompt').classList.add('hidden');
    await loadProfileForUser(state.user);
    await refreshNotebookListFromServer();
    startNewPage();
    setStatus('ペンか消しゴムで書いて、保存してください。');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'ノートの初期化に失敗しました。', true);
  }
}

window.addEventListener('DOMContentLoaded', initNotebookPage);

$('newPageBtn').addEventListener('click', startNewPage);

setStatus('読み込み中…');
startNewPage();
