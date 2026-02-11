import { difficulties, getRandomPuzzle } from './core/puzzleBank.js';
import { getConflicts, isCompleteAndValid, isPeer, toGrid } from './core/sudoku.js';
import { clearSave, loadSave, loadSettings, saveGame, saveSettings } from './store/persistence.js';

const BASE_URL = 'https://enbi0001713000.github.io/Nanpure/';
const USERNAME_KEY = 'np_username_v1';
const APP_TITLE = 'ナンプレ-えびの挑戦状-';

let appState = {
  screen: 'home',
  modal: null,
  pendingDifficulty: null,
  toast: '',
  toastTimer: null,
  game: null,
  usernameDraft: '',
  settingsDraft: { username: '', settings: loadSettings() }
};

let layoutRaf = null;
let boardScale = 1;
let pinchStartDistance = 0;
let pinchStartScale = 1;

const app = document.querySelector('#app');
if (!app) throw new Error('App root not found');

const HINT_LIMIT_PER_BOARD = 3;
const HINT_PENALTY_MS = 30_000;

function getUsername() {
  try {
    return localStorage.getItem(USERNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function setUsername(name) {
  try {
    localStorage.setItem(USERNAME_KEY, name);
  } catch {}
}

function normalizeName(name) {
  return name.trim();
}

function validateName(name) {
  const normalized = normalizeName(name);
  return normalized.length >= 1 && normalized.length <= 12;
}

function cloneSnapshot() {
  const game = appState.game;
  return {
    grid: game.cells.map((row) => row.map((cell) => ({ value: cell.value, notes: [...cell.notes] }))),
    selected: game.selected,
    noteMode: game.noteMode
  };
}

function applySnapshot(snapshot) {
  const game = appState.game;
  game.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      const s = snapshot.grid[r][c];
      cell.value = s.value;
      cell.notes = new Set(s.notes);
    });
  });
  game.selected = snapshot.selected;
  game.noteMode = snapshot.noteMode;
}

function pushHistory() {
  const game = appState.game;
  game.history.push(cloneSnapshot());
  if (game.history.length > 200) game.history.shift();
  game.future = [];
}

function createCells(values, initial) {
  return values.map((row, r) => row.map((value, c) => ({ value, fixed: initial[r][c] !== 0, notes: new Set() })));
}

function createGame(difficulty) {
  const puzzle = getRandomPuzzle(difficulty);
  const initial = toGrid(puzzle.puzzle);
  const solution = toGrid(puzzle.solution);
  return {
    difficulty,
    initial,
    solution,
    cells: createCells(initial, initial),
    selected: null,
    noteMode: false,
    settings: loadSettings(),
    elapsedMs: 0,
    hintUses: 0,
    timerRunning: true,
    history: [],
    future: [],
    cleared: false
  };
}

function restoreSave() {
  const save = loadSave();
  if (!save) return;
  appState.game = {
    difficulty: save.difficulty,
    initial: save.initial,
    solution: save.solution,
    cells: save.values.map((row, r) =>
      row.map((v, c) => ({ value: v, fixed: save.fixed[r][c], notes: new Set(save.notes[r][c]) }))
    ),
    selected: save.selected,
    noteMode: save.noteMode,
    settings: loadSettings(),
    elapsedMs: save.elapsedMs,
    hintUses: save.hintUses ?? 0,
    timerRunning: true,
    history: save.history ?? [],
    future: save.future ?? [],
    cleared: false
  };
}

function serialize() {
  if (!appState.game || appState.game.cleared) return;
  const game = appState.game;
  saveGame({
    difficulty: game.difficulty,
    initial: game.initial,
    solution: game.solution,
    values: game.cells.map((r) => r.map((c) => c.value)),
    fixed: game.cells.map((r) => r.map((c) => c.fixed)),
    notes: game.cells.map((r) => r.map((c) => [...c.notes])),
    selected: game.selected,
    noteMode: game.noteMode,
    elapsedMs: game.elapsedMs,
    hintUses: game.hintUses,
    history: game.history,
    future: game.future
  });
}

let saveTimer;
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(serialize, 250);
}

function hasProgressGame() {
  return !!(appState.game && appState.screen === 'play' && !appState.game.cleared);
}

function startNewGame(difficulty) {
  appState.game = createGame(difficulty);
  boardScale = 1;
  appState.screen = 'play';
  appState.modal = null;
  render();
}

function requestStartDifficulty(difficulty) {
  if (hasProgressGame()) {
    const ok = window.confirm('現在のゲームを破棄して新規開始しますか？');
    if (!ok) return;
    clearSave();
  }
  appState.pendingDifficulty = difficulty;
  const username = getUsername();
  if (!validateName(username)) {
    appState.usernameDraft = username;
    appState.modal = 'username';
    render();
    return;
  }
  startNewGame(difficulty);
}

function showToast(text) {
  appState.toast = text;
  render();
  window.clearTimeout(appState.toastTimer);
  appState.toastTimer = window.setTimeout(() => {
    appState.toast = '';
    render();
  }, 1800);
}

function formattedDifficultyLabel(difficulty) {
  const map = { easy: 'EASY', medium: 'NORMAL', hard: 'HARD', oni: 'ONI' };
  return map[difficulty] ?? difficulty.toUpperCase();
}

function formattedTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  return `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`;
}

function checkClear() {
  if (appState.screen !== 'play' || !appState.game || appState.game.cleared) return;
  const values = appState.game.cells.map((r) => r.map((c) => c.value));
  if (!isCompleteAndValid(values)) return;
  appState.game.cleared = true;
  appState.game.timerRunning = false;
  clearSave();
  appState.modal = 'result';
}

function inputValue(value) {
  const game = appState.game;
  if (!game || game.cleared) return;
  const pos = game.selected;
  if (!pos) return;
  const cell = game.cells[pos.r][pos.c];
  if (cell.fixed) return;

  pushHistory();
  if (game.noteMode) {
    if (value === 0) cell.notes.clear();
    else if (cell.notes.has(value)) cell.notes.delete(value);
    else cell.notes.add(value);
  } else {
    const next = cell.value === value && game.settings.toggleToErase ? 0 : value;
    cell.value = next;
    cell.notes.clear();
  }
  checkClear();
  render();
  scheduleSave();
}

function undo() {
  const game = appState.game;
  if (!game || game.cleared) return;
  const prev = game.history.pop();
  if (!prev) return;
  game.future.push(cloneSnapshot());
  applySnapshot(prev);
  render();
  scheduleSave();
}

function redo() {
  const game = appState.game;
  if (!game || game.cleared) return;
  const next = game.future.pop();
  if (!next) return;
  game.history.push(cloneSnapshot());
  applySnapshot(next);
  render();
  scheduleSave();
}

function findHintTarget(game) {
  const selected = game.selected;
  if (selected) {
    const selectedCell = game.cells[selected.r][selected.c];
    if (!selectedCell.fixed && selectedCell.value !== game.solution[selected.r][selected.c]) {
      return selected;
    }
  }

  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const cell = game.cells[r][c];
      if (!cell.fixed && cell.value !== game.solution[r][c]) {
        return { r, c };
      }
    }
  }
  return null;
}

function useHint() {
  const game = appState.game;
  if (!game || game.cleared) return;
  if (game.hintUses >= HINT_LIMIT_PER_BOARD) return;

  const target = findHintTarget(game);
  if (!target) return;

  const { r, c } = target;
  const cell = game.cells[r][c];
  const answer = game.solution[r][c];

  pushHistory();
  game.selected = { r, c };
  cell.value = answer;
  cell.notes.clear();
  game.hintUses += 1;
  game.elapsedMs += HINT_PENALTY_MS;
  checkClear();
  render();
  scheduleSave();
}

function openSettings() {
  if (appState.modal === 'result') return;
  appState.settingsDraft = {
    username: getUsername(),
    settings: { ...loadSettings() }
  };
  appState.modal = 'settings';
  render();
}

function saveSettingsModal() {
  const { username, settings } = appState.settingsDraft;
  if (!validateName(username)) {
    window.alert('ユーザーネームは1〜12文字で入力してください。');
    return;
  }
  setUsername(normalizeName(username));
  saveSettings(settings);
  if (appState.game) appState.game.settings = settings;
  appState.modal = null;
  render();
}

function shareText() {
  const game = appState.game;
  const username = getUsername() || '匿名';
  return `【${APP_TITLE}】${username} が ${formattedDifficultyLabel(game.difficulty)} を ${formattedTime(game.elapsedMs)} でクリア！\n\n#えびナンプレ`;
}

function shareUrl() {
  const text = encodeURIComponent(shareText());
  const url = encodeURIComponent(BASE_URL);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}

async function copyResult() {
  const game = appState.game;
  const username = getUsername() || '匿名';
  const line = `【${APP_TITLE}】${username} が ${formattedDifficultyLabel(game.difficulty)} を ${formattedTime(game.elapsedMs)} でクリア！ #えびナンプレ ${BASE_URL}`;
  try {
    await navigator.clipboard.writeText(line);
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = line;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    textArea.remove();
  }
  showToast('コピーしました');
}

function renderHome() {
  return `
  <section class="screen home">
    <div class="home-noise" aria-hidden="true"></div>
    <div class="home-glow home-glow-left" aria-hidden="true"></div>
    <div class="home-glow home-glow-right" aria-hidden="true"></div>
    <div class="home-grid home-grid-left" aria-hidden="true"></div>
    <div class="home-grid home-grid-right" aria-hidden="true"></div>
    <div class="home-arc home-arc-left" aria-hidden="true"></div>
    <div class="home-arc home-arc-right" aria-hidden="true"></div>
    <button class="icon-button" data-act="open-settings" aria-label="設定">⚙</button>
    <div class="home-center">
      <h1 class="home-title">ナンプレ</h1>
      <p class="home-subtitle">-えびの挑戦状-</p>
      <button class="primary cta" data-act="go-select">挑戦する</button>
    </div>
  </section>`;
}

function renderSelect() {
  return `
  <section class="screen select">
    <div class="row between">
      <button class="ghost" data-act="go-home">← ホームへ</button>
      <button class="icon-button" data-act="open-settings" aria-label="設定">⚙</button>
    </div>
    <h2>難易度を選択</h2>
    <div class="difficulty-grid">
      ${difficulties
        .map((d) => `<button class="primary" data-act="pick-difficulty" data-difficulty="${d}">${formattedDifficultyLabel(d)}</button>`)
        .join('')}
    </div>
  </section>`;
}

function renderPlay() {
  const game = appState.game;
  const values = game.cells.map((r) => r.map((c) => c.value));
  const conflicts = getConflicts(values);
  const selectedValue = game.selected ? values[game.selected.r][game.selected.c] : 0;

  return `
  <section class="screen play ${game.cleared ? 'locked' : ''}">
    <div class="play-root">
      <header class="play-header">
        <button class="ghost" data-act="go-select">難易度</button>
        <div class="meta">${formattedDifficultyLabel(game.difficulty)} / ${formattedTime(game.elapsedMs)}</div>
        <button class="icon-button" data-act="open-settings" aria-label="設定">⚙</button>
      </header>
      <section class="controls top">
        <button data-act="undo" ${game.cleared ? 'disabled' : ''}>Undo</button>
        <button data-act="redo" ${game.cleared ? 'disabled' : ''}>Redo</button>
        <button data-act="note" class="${game.noteMode ? 'active' : ''}" ${game.cleared ? 'disabled' : ''}>✏️メモ${game.noteMode ? 'ON' : 'OFF'}</button>
        <button data-act="hint" ${game.cleared || game.hintUses >= HINT_LIMIT_PER_BOARD ? 'disabled' : ''}>💡ヒント(${Math.max(0, HINT_LIMIT_PER_BOARD - game.hintUses)})</button>
      </section>
      <div class="memo-indicator ${game.noteMode ? 'on' : ''}">${game.noteMode ? 'メモモードON ✏️' : 'メモモードOFF'}</div>
      <section class="board-area">
        <section class="board" role="grid" aria-label="ナンプレ盤面">
          ${game.cells
            .map((row, r) =>
              row
                .map((cell, c) => {
                  const selected = game.selected?.r === r && game.selected?.c === c;
                  const peer = game.selected ? isPeer(game.selected, { r, c }) : false;
                  const same = game.settings.highlightSameNumber && selectedValue !== 0 && cell.value === selectedValue;
                  const conflict = game.settings.mistakeHighlight && conflicts[r][c];
                  const classes = ['cell', selected && 'selected', peer && 'peer', same && 'same', conflict && 'conflict', cell.fixed && 'fixed']
                    .filter(Boolean)
                    .join(' ');

                  if (cell.value !== 0) return `<button data-cell="${r},${c}" role="gridcell" class="${classes}">${cell.value}</button>`;
                  const notes = Array.from({ length: 9 }, (_, i) => (cell.notes.has(i + 1) ? `<span>${i + 1}</span>` : '<span></span>')).join('');
                  return `<button data-cell="${r},${c}" role="gridcell" class="${classes}"><small>${notes}</small></button>`;
                })
                .join('')
            )
            .join('')}
        </section>
      </section>
      <section class="controls keypad">
        ${Array.from({ length: 9 }, (_, i) => `<button data-num="${i + 1}" ${game.cleared ? 'disabled' : ''}>${i + 1}</button>`).join('')}
        <button data-num="0" ${game.cleared ? 'disabled' : ''}>消す</button>
      </section>
    </div>
  </section>`;
}

function syncPlayBoardSize() {
  if (appState.screen !== 'play') return;
  const boardArea = app.querySelector('.board-area');
  const board = app.querySelector('.board');
  if (!boardArea || !board) return;
  const minimumMargin = 16;
  const availableWidth = boardArea.clientWidth - minimumMargin;
  const availableHeight = boardArea.clientHeight - minimumMargin;
  const size = Math.floor(Math.min(availableWidth, availableHeight));
  if (size > 0) {
    board.style.width = `${size}px`;
    board.style.height = `${size}px`;
    board.style.transformOrigin = 'center top';
    board.style.transform = `scale(${boardScale})`;
  }
}

function getTouchDistance(touchA, touchB) {
  const dx = touchA.clientX - touchB.clientX;
  const dy = touchA.clientY - touchB.clientY;
  return Math.hypot(dx, dy);
}

function clampBoardScale(value) {
  return Math.min(3, Math.max(1, value));
}

function bindBoardPinchZoom(boardArea) {
  if (boardArea.dataset.pinchZoomBound === '1') return;
  boardArea.dataset.pinchZoomBound = '1';

  boardArea.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 2) return;
    pinchStartDistance = getTouchDistance(event.touches[0], event.touches[1]);
    pinchStartScale = boardScale;
  });

  boardArea.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length !== 2 || pinchStartDistance <= 0) return;
      const currentDistance = getTouchDistance(event.touches[0], event.touches[1]);
      const nextScale = clampBoardScale((pinchStartScale * currentDistance) / pinchStartDistance);
      if (Math.abs(nextScale - boardScale) < 0.01) return;
      boardScale = nextScale;
      requestPlayLayoutSync();
      event.preventDefault();
    },
    { passive: false }
  );

  boardArea.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) pinchStartDistance = 0;
  });
}

function requestPlayLayoutSync() {
  window.cancelAnimationFrame(layoutRaf);
  layoutRaf = window.requestAnimationFrame(() => {
    syncPlayBoardSize();
  });
}


function updatePlayViewportHeight() {
  const viewport = window.visualViewport;
  const viewportHeight = viewport ? viewport.height * Math.max(1, viewport.scale || 1) : window.innerHeight;
  document.documentElement.style.setProperty('--play-viewport-height', `${Math.round(viewportHeight)}px`);
}

function setupViewportListeners() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  if (typeof viewport.addEventListener !== 'function') return;
  viewport.addEventListener('resize', () => {
    updatePlayViewportHeight();
    requestPlayLayoutSync();
  });
  viewport.addEventListener('scroll', () => {
    updatePlayViewportHeight();
    requestPlayLayoutSync();
  });
}

function renderUsernameModal() {
  return `
  <div class="modal-overlay">
    <div class="modal">
      <h3>ユーザーネーム登録</h3>
      <p>X共有・リンクコピーに表示されます（後から変更可能）</p>
      <input data-role="username-input" maxlength="12" placeholder="例）燕尾" value="${appState.usernameDraft}" />
      <div class="row">
        <button class="primary" data-act="save-username">保存して開始</button>
        <button data-act="anonymous-start">匿名で開始</button>
      </div>
    </div>
  </div>`;
}

function renderSettingsModal() {
  const draft = appState.settingsDraft;
  return `
  <div class="modal-overlay">
    <div class="modal">
      <div class="modal-header"><h3>設定</h3><button class="modal-close" data-act="close-modal" aria-label="設定を閉じる">×</button></div>
      <label>ユーザーネーム<input data-role="settings-username" maxlength="12" value="${draft.username}" /></label>
      <label class="setting-check"><input data-setting="mistakeHighlight" type="checkbox" ${draft.settings.mistakeHighlight ? 'checked' : ''}/>ミス表示</label>
      <label class="setting-check"><input data-setting="highlightSameNumber" type="checkbox" ${draft.settings.highlightSameNumber ? 'checked' : ''}/>同一数字ハイライト</label>
      <label class="setting-check"><input data-setting="toggleToErase" type="checkbox" ${draft.settings.toggleToErase ? 'checked' : ''}/>同数字で消去</label>
      <button class="theme-toggle-btn" data-act="toggle-darkmode">${draft.settings.darkMode ? '☀️ ライトモードに切替' : '🌙 ダークモードに切替'}</button>
      <button class="primary" data-act="save-settings">保存</button>
    </div>
  </div>`;
}

function renderResultModal() {
  const game = appState.game;
  const username = getUsername() || '匿名';
  return `
  <div class="modal-overlay">
    <div class="modal result">
      <div class="modal-header"><h2>CLEAR!</h2><button class="modal-close" data-act="close-result" aria-label="リザルトを閉じる">×</button></div>
      <div class="result-card">
        <div>ユーザー：${username}</div>
        <div>難易度：${formattedDifficultyLabel(game.difficulty)}</div>
        <div class="time">タイム：${formattedTime(game.elapsedMs)}</div>
      </div>
      <button class="primary wide" data-act="share-x">Xへ共有</button>
      <div class="row">
        <button data-act="copy-link">リンクコピー</button>
        <button data-act="retry">もう一度（同難易度）</button>
      </div>
      <button class="link" data-act="result-home">ホームへ</button>
    </div>
  </div>`;
}

let fatalRendering = false;

function showFatalScreen(error) {
  if (fatalRendering) return;
  fatalRendering = true;
  console.error('Fatal render error:', error);
  clearSave();
  appState.game = null;
  appState.modal = null;
  appState.screen = 'home';
  document.body.classList.remove('play-mode');
  app.innerHTML = `
    <main class="app-main">
      <section class="screen home">
        <h2>復旧のためデータを初期化しました</h2>
        <p>画面表示で問題を検知したため、保存データを削除して安全モードで起動しています。</p>
        <button class="primary" data-act="reload">再読み込み</button>
      </section>
    </main>`;
  const reload = app.querySelector('button[data-act="reload"]');
  if (reload) reload.onclick = () => window.location.reload();
}

function renderInternal() {
  const settings = appState.game?.settings ?? loadSettings();
  document.body.classList.toggle('dark', settings.darkMode);

  let content = '';
  if (appState.screen === 'home') content = renderHome();
  if (appState.screen === 'select') content = renderSelect();
  if (appState.screen === 'play' && appState.game) content = renderPlay();

  let modal = '';
  if (appState.modal === 'username') modal = renderUsernameModal();
  if (appState.modal === 'settings') modal = renderSettingsModal();
  if (appState.modal === 'result') modal = renderResultModal();

  document.body.classList.toggle('play-mode', appState.screen === 'play');
  app.innerHTML = `<main class="app-main ${appState.screen === 'play' ? 'play-main' : ''}">${content}${modal}${appState.toast ? `<div class="toast">${appState.toast}</div>` : ''}</main>`;
  wireEvents();
  requestPlayLayoutSync();
}

function render() {
  try {
    renderInternal();
    fatalRendering = false;
  } catch (error) {
    showFatalScreen(error);
  }
}

function wireEvents() {
  app.querySelectorAll('button[data-act="go-select"]').forEach((btn) => {
    btn.onclick = () => {
      appState.screen = 'select';
      appState.modal = null;
      render();
    };
  });

  app.querySelectorAll('button[data-act="go-home"],button[data-act="result-home"]').forEach((btn) => {
    btn.onclick = () => {
      appState.screen = 'home';
      appState.modal = null;
      appState.game = null;
      clearSave();
      render();
    };
  });

  app.querySelectorAll('button[data-act="pick-difficulty"]').forEach((btn) => {
    btn.onclick = () => requestStartDifficulty(btn.dataset.difficulty);
  });

  app.querySelectorAll('button[data-act="open-settings"]').forEach((btn) => {
    btn.onclick = openSettings;
  });

  const usernameInput = app.querySelector('input[data-role="username-input"]');
  if (usernameInput) {
    usernameInput.oninput = () => {
      appState.usernameDraft = usernameInput.value;
    };
  }

  const saveUsernameBtn = app.querySelector('button[data-act="save-username"]');
  if (saveUsernameBtn) {
    saveUsernameBtn.onclick = () => {
      if (!validateName(appState.usernameDraft)) {
        window.alert('ユーザーネームは1〜12文字で入力してください。');
        return;
      }
      setUsername(normalizeName(appState.usernameDraft));
      startNewGame(appState.pendingDifficulty || 'easy');
      scheduleSave();
    };
  }

  const anonymousBtn = app.querySelector('button[data-act="anonymous-start"]');
  if (anonymousBtn) {
    anonymousBtn.onclick = () => {
      setUsername('匿名');
      startNewGame(appState.pendingDifficulty || 'easy');
      scheduleSave();
    };
  }

  const closeModalBtn = app.querySelector('button[data-act="close-modal"]');
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      appState.modal = null;
      render();
    };
  }

  const settingsUsername = app.querySelector('input[data-role="settings-username"]');
  if (settingsUsername) {
    settingsUsername.oninput = () => {
      appState.settingsDraft.username = settingsUsername.value;
    };
  }

  app.querySelectorAll('input[data-setting]').forEach((el) => {
    el.onchange = () => {
      appState.settingsDraft.settings[el.dataset.setting] = el.checked;
    };
  });


  const toggleDarkModeBtn = app.querySelector('button[data-act="toggle-darkmode"]');
  if (toggleDarkModeBtn) {
    toggleDarkModeBtn.onclick = () => {
      appState.settingsDraft.settings.darkMode = !appState.settingsDraft.settings.darkMode;
      render();
    };
  }

  const saveSettingsBtn = app.querySelector('button[data-act="save-settings"]');
  if (saveSettingsBtn) saveSettingsBtn.onclick = saveSettingsModal;

  if (appState.screen === 'play' && appState.game) {
    const boardArea = app.querySelector('.board-area');
    if (boardArea) bindBoardPinchZoom(boardArea);

    app.querySelectorAll('button[data-cell]').forEach((btn) => {
      btn.onclick = () => {
        const [r, c] = (btn.dataset.cell || '0,0').split(',').map(Number);
        appState.game.selected = { r, c };
        render();
      };
    });

    app.querySelectorAll('button[data-num]').forEach((btn) => {
      btn.onclick = () => inputValue(Number(btn.dataset.num));
    });

    const byAct = (act) => app.querySelector(`button[data-act="${act}"]`);
    if (byAct('undo')) byAct('undo').onclick = undo;
    if (byAct('redo')) byAct('redo').onclick = redo;
    if (byAct('note')) {
      byAct('note').onclick = () => {
        if (appState.game.cleared) return;
        appState.game.noteMode = !appState.game.noteMode;
        render();
      };
    }
    if (byAct('hint')) byAct('hint').onclick = useHint;

    const shareBtn = byAct('share-x');
    if (shareBtn) shareBtn.onclick = () => window.open(shareUrl(), '_blank', 'noopener,noreferrer');
    const copyBtn = byAct('copy-link');
    if (copyBtn) copyBtn.onclick = copyResult;
    const retryBtn = byAct('retry');
    if (retryBtn) retryBtn.onclick = () => startNewGame(appState.game.difficulty);
    const closeResultBtn = byAct('close-result');
    if (closeResultBtn) closeResultBtn.onclick = () => {
      appState.modal = null;
      render();
    };
  }
}

document.addEventListener('keydown', (e) => {
  if (appState.screen !== 'play' || !appState.game || !appState.game.selected) return;
  const game = appState.game;
  const { r, c } = game.selected;

  if (e.key.startsWith('Arrow')) {
    const next = { r, c };
    if (e.key === 'ArrowUp') next.r = Math.max(0, r - 1);
    if (e.key === 'ArrowDown') next.r = Math.min(8, r + 1);
    if (e.key === 'ArrowLeft') next.c = Math.max(0, c - 1);
    if (e.key === 'ArrowRight') next.c = Math.min(8, c + 1);
    game.selected = next;
    render();
    return;
  }

  if (game.cleared) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'z') return undo();
  if (e.ctrlKey && e.key.toLowerCase() === 'y') return redo();
  if (e.key.toLowerCase() === 'n') {
    game.noteMode = !game.noteMode;
    return render();
  }
  if (/^[1-9]$/.test(e.key)) return inputValue(Number(e.key));
  if (e.key === 'Backspace' || e.key === 'Delete') return inputValue(0);
});

window.addEventListener('error', (event) => {
  if (event.error) showFatalScreen(event.error);
});
window.addEventListener('unhandledrejection', (event) => {
  showFatalScreen(event.reason);
});
window.addEventListener('beforeunload', serialize);
window.addEventListener('resize', () => {
  updatePlayViewportHeight();
  requestPlayLayoutSync();
});
window.addEventListener('orientationchange', () => {
  updatePlayViewportHeight();
  requestPlayLayoutSync();
});
updatePlayViewportHeight();
setupViewportListeners();
setInterval(() => {
  if (appState.screen !== 'play' || !appState.game?.timerRunning) return;
  appState.game.elapsedMs += 1000;
  const meta = app.querySelector('.meta');
  if (meta) meta.textContent = `${formattedDifficultyLabel(appState.game.difficulty)} / ${formattedTime(appState.game.elapsedMs)}`;
  scheduleSave();
}, 1000);

restoreSave();
render();
