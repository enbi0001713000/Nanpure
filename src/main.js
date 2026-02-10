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
    noteMode: game.noteMode
  };
}
@@ -66,91 +69,94 @@ function applySnapshot(snapshot) {

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
@@ -222,50 +228,93 @@ function inputValue(value) {
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
@@ -322,50 +371,51 @@ function renderSelect() {
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
@@ -616,50 +666,51 @@ function wireEvents() {
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
