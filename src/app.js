// ── STATE ──────────────────────────────────────
let state = { projects: [], activeId: null };

function save() {
  localStorage.setItem('flow_kanban', JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem('flow_kanban');
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.warn('Error al cargar datos:', e);
  }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── THEME ──────────────────────────────────────
const html       = document.documentElement;
const iconSun    = document.getElementById('iconSun');
const iconMoon   = document.getElementById('iconMoon');
const themeToggle = document.getElementById('themeToggle');

function getTheme() {
  return localStorage.getItem('flow_theme') || 'light';
}

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    iconSun.style.display  = 'block';
    iconMoon.style.display = 'none';
  } else {
    iconSun.style.display  = 'none';
    iconMoon.style.display = 'block';
  }
  localStorage.setItem('flow_theme', theme);
}

function toggleTheme() {
  const current = getTheme();
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

themeToggle.addEventListener('click', toggleTheme);

// ── FONT SIZE ──────────────────────────────────
const FONT_MIN     = 11;
const FONT_MAX     = 26;
const FONT_DEFAULT = 16;
const fontLabel    = document.getElementById('fontSizeLabel');

function getFontSize() {
  return parseInt(localStorage.getItem('flow_fontsize') || FONT_DEFAULT, 10);
}

function applyFontSize(size) {
  size = Math.min(FONT_MAX, Math.max(FONT_MIN, size));
  html.style.fontSize = size + 'px';
  fontLabel.textContent = size;
  document.getElementById('fontDecrease').disabled = size <= FONT_MIN;
  document.getElementById('fontIncrease').disabled = size >= FONT_MAX;
  localStorage.setItem('flow_fontsize', size);
}

document.getElementById('fontDecrease').addEventListener('click', () => {
  applyFontSize(getFontSize() - 1);
});

document.getElementById('fontIncrease').addEventListener('click', () => {
  applyFontSize(getFontSize() + 1);
});

// ── PROJECT CRUD ───────────────────────────────
function createProject(name) {
  const p = { id: uid(), name, tasks: [] };
  state.projects.push(p);
  state.activeId = p.id;
  save();
  render();
}

function deleteProject(id) {
  state.projects = state.projects.filter(p => p.id !== id);
  if (state.activeId === id) {
    state.activeId = state.projects[0]?.id || null;
  }
  save();
  render();
}

function getActive() {
  return state.projects.find(p => p.id === state.activeId) || null;
}

function selectProject(id) {
  state.activeId = id;
  save();
  render();
}

function confirmDeleteProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) return;
  if (confirm(`Delete the project "${p.name}" and all its tasks?`)) {
    deleteProject(id);
  }
}

// ── TASK CRUD ──────────────────────────────────
function createTask(title, desc) {
  const p = getActive();
  if (!p) return;
  p.tasks.push({ id: uid(), title, desc, status: 'todo' });
  save();
  renderBoard();
}

function moveTask(taskId, newStatus) {
  const p = getActive();
  if (!p) return;
  const t = p.tasks.find(t => t.id === taskId);
  if (t) {
    t.status = newStatus;
    save();
    renderBoard();
  }
}

function deleteTask(taskId) {
  const p = getActive();
  if (!p) return;
  p.tasks = p.tasks.filter(t => t.id !== taskId);
  save();
  renderBoard();
}

// ── HELPERS ────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMoves(status) {
  if (status === 'todo')  return [['→ Doing', 'doing']];
  if (status === 'doing') return [['← Todo', 'todo'], ['✓ Done', 'done']];
  if (status === 'done')  return [['↩ Doing', 'doing']];
  return [];
}

// ── RENDER ─────────────────────────────────────
function render() {
  renderSidebar();
  const p = getActive();
  if (p) {
    renderBoardShell(p);
  } else {
    document.getElementById('mainContent').innerHTML = `
      <div class="no-project">
        <div class="no-project-icon">⊹</div>
        <p>select or create a project</p>
      </div>`;
  }
}

function renderSidebar() {
  const list = document.getElementById('projectsList');
  if (!state.projects.length) {
    list.innerHTML = `<div class="empty-state" style="padding:24px 8px">without projects</div>`;
    return;
  }
  list.innerHTML = state.projects.map(p => {
    const total  = p.tasks.length;
    const active = state.activeId === p.id ? 'active' : '';
    return `
      <div class="project-item ${active}" data-id="${p.id}" onclick="selectProject('${p.id}')">
        <span class="project-name">${esc(p.name)}</span>
        ${total ? `<span class="project-count">${total}</span>` : ''}
        <button class="delete-project-btn"
          onclick="event.stopPropagation(); confirmDeleteProject('${p.id}')"
          title="Delete">×</button>
      </div>`;
  }).join('');
}

function renderBoardShell(p) {
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="board-header">
      <div class="board-title">${esc(p.name)}</div>
      <div class="board-meta">${p.tasks.length} task${p.tasks.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="kanban" id="kanban">
      ${renderCol('todo',  '← To Do', 'todo-dot',  p)}
      ${renderCol('doing', '↻ Doing', 'doing-dot', p)}
      ${renderCol('done',  '✓ Done',  'done-dot',  p)}
    </div>`;

  document.getElementById('addTaskTrigger').onclick = openNewTaskModal;
}

function renderCol(status, label, dotClass, p) {
  const tasks = p.tasks.filter(t => t.status === status);
  const cards = tasks.map(t => renderCard(t)).join('');
  const addTrigger = status === 'todo'
    ? `<button class="add-task-trigger" id="addTaskTrigger">+ add task</button>`
    : '';
  return `
    <div class="kanban-col">
      <div class="col-header">
        <div class="col-title">
          <span class="col-dot ${dotClass}"></span>
          ${label}
        </div>
        <span class="col-count">${tasks.length}</span>
      </div>
      <div class="col-body">
        ${cards || `<div class="empty-state">${status === 'todo' ? '—' : 'empty'}</div>`}
        ${addTrigger}
      </div>
    </div>`;
}

function renderCard(t) {
  const moves = getMoves(t.status).map(([label, s]) =>
    `<button class="move-btn" onclick="moveTask('${t.id}','${s}')">${label}</button>`
  ).join('');
  return `
    <div class="task-card ${t.status}">
      <div class="task-title">${esc(t.title)}</div>
      ${t.desc ? `<div class="task-desc">${esc(t.desc)}</div>` : ''}
      <div class="task-actions">
        <div class="task-moves">${moves}</div>
        <button class="delete-task-btn" onclick="deleteTask('${t.id}')" title="Delete">✕</button>
      </div>
    </div>`;
}

function renderBoard() {
  const p = getActive();
  if (p) renderBoardShell(p);
  renderSidebar();
}

// ── MODAL: NUEVO PROYECTO ──────────────────────
const newProjectModal = document.getElementById('newProjectModal');
const newProjectName  = document.getElementById('newProjectName');

document.getElementById('newProjectBtn').addEventListener('click', () => {
  newProjectName.value = '';
  newProjectModal.style.display = 'flex';
  setTimeout(() => newProjectName.focus(), 50);
});

document.getElementById('cancelNewProject').addEventListener('click', () => {
  newProjectModal.style.display = 'none';
});

document.getElementById('confirmNewProject').addEventListener('click', () => {
  const name = newProjectName.value.trim();
  if (!name) { newProjectName.focus(); return; }
  newProjectModal.style.display = 'none';
  createProject(name);
});

newProjectName.addEventListener('keydown', e => {
  if (e.key === 'Enter')  document.getElementById('confirmNewProject').click();
  if (e.key === 'Escape') document.getElementById('cancelNewProject').click();
});

newProjectModal.addEventListener('click', e => {
  if (e.target === newProjectModal) newProjectModal.style.display = 'none';
});

// ── MODAL: NUEVA TAREA ─────────────────────────
const newTaskModal  = document.getElementById('newTaskModal');
const newTaskTitle  = document.getElementById('newTaskTitle');
const newTaskDesc   = document.getElementById('newTaskDesc');

function openNewTaskModal() {
  newTaskTitle.value = '';
  newTaskDesc.value  = '';
  newTaskModal.style.display = 'flex';
  setTimeout(() => newTaskTitle.focus(), 50);
}

document.getElementById('cancelNewTask').addEventListener('click', () => {
  newTaskModal.style.display = 'none';
});

document.getElementById('confirmNewTask').addEventListener('click', () => {
  const title = newTaskTitle.value.trim();
  if (!title) { newTaskTitle.focus(); return; }
  const desc = newTaskDesc.value.trim();
  newTaskModal.style.display = 'none';
  createTask(title, desc);
});

newTaskTitle.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('cancelNewTask').click();
});

newTaskDesc.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.metaKey) document.getElementById('confirmNewTask').click();
  if (e.key === 'Escape') document.getElementById('cancelNewTask').click();
});

newTaskModal.addEventListener('click', e => {
  if (e.target === newTaskModal) newTaskModal.style.display = 'none';
});

// ── INIT ───────────────────────────────────────
applyTheme(getTheme());
applyFontSize(getFontSize());
load();
render();
