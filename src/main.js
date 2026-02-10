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

const app = document.querySelector('#app');
if (!app) throw new Error('App root not found');

function getUsername() {
  return localStorage.getItem(USERNAME_KEY) ?? '';
}

function setUsername(name) {
  localStorage.setItem(USERNAME_KEY, name);
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
@@ -301,89 +303,123 @@ function renderHome() {

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
  }
}

function requestPlayLayoutSync() {
  window.cancelAnimationFrame(layoutRaf);
  layoutRaf = window.requestAnimationFrame(() => {
    syncPlayBoardSize();
  });
}

function setupViewportListeners() {
  const viewport = window.visualViewport;
  if (!viewport) return;
  if (typeof viewport.addEventListener !== 'function') return;
  viewport.addEventListener('resize', requestPlayLayoutSync);
  viewport.addEventListener('scroll', requestPlayLayoutSync);
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
      <div class="row between"><h3>設定</h3><button class="ghost" data-act="close-modal">×</button></div>
      <label>ユーザーネーム<input data-role="settings-username" maxlength="12" value="${draft.username}" /></label>
      <label><input data-setting="mistakeHighlight" type="checkbox" ${draft.settings.mistakeHighlight ? 'checked' : ''}/>ミス表示</label>
      <label><input data-setting="highlightSameNumber" type="checkbox" ${draft.settings.highlightSameNumber ? 'checked' : ''}/>同一数字ハイライト</label>
      <label><input data-setting="darkMode" type="checkbox" ${draft.settings.darkMode ? 'checked' : ''}/>ダークモード</label>
@@ -407,52 +443,54 @@ function renderResultModal() {
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

function render() {
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

@@ -556,35 +594,38 @@ document.addEventListener('keydown', (e) => {
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

window.addEventListener('beforeunload', serialize);
window.addEventListener('resize', requestPlayLayoutSync);
window.addEventListener('orientationchange', requestPlayLayoutSync);
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
