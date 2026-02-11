import { getRandomPuzzle } from './core/puzzleBank.js';
import { getConflicts, isCompleteAndValid, isPeer, toGrid } from './core/sudoku.js';
import type { Cell, Difficulty, GameStats, HistorySnapshot, Position, Settings } from './core/types.js';
import { clearSave, loadSave, loadSettings, loadStats, recordClearStats, saveGame, saveSettings } from './store/persistence.js';

type State = {
  difficulty: Difficulty;
  initial: number[][];
  solution: number[][];
  cells: Cell[][];
  selected: Position | null;
  noteMode: boolean;
  settings: Settings;
  elapsedMs: number;
  timerRunning: boolean;
  history: HistorySnapshot[];
  future: HistorySnapshot[];
  stats: GameStats;
  clearRecorded: boolean;
  settingsOpen: boolean;
};

type Screen = 'home' | 'select' | 'play';

let screen: Screen = 'home';
let state: State | null = null;

const appEl = document.querySelector<HTMLDivElement>('#app');
if (!appEl) throw new Error('App root not found');
const app = appEl;

function cloneSnapshot(): HistorySnapshot {
  if (!state) throw new Error('Game state not initialized');
  return {
    grid: state.cells.map((row) => row.map((cell) => ({ value: cell.value, notes: [...cell.notes] }))),
    selected: state.selected,
    noteMode: state.noteMode
  };
}

function applySnapshot(snapshot: HistorySnapshot) {
  if (!state) return;
  state.cells.forEach((row, r) => {
    row.forEach((cell, c) => {
      const s = snapshot.grid[r][c];
      cell.value = s.value;
      cell.notes = new Set(s.notes);
    });
  });
  state.selected = snapshot.selected;
  state.noteMode = snapshot.noteMode;
}

function pushHistory() {
  if (!state) return;
  state.history.push(cloneSnapshot());
  if (state.history.length > 200) state.history.shift();
  state.future = [];
}

function createCells(values: number[][], initial: number[][]): Cell[][] {
  return values.map((row, r) =>
    row.map((value, c) => ({
      value,
      fixed: initial[r][c] !== 0,
      notes: new Set<number>()
    }))
  );
}

function newGame(difficulty: Difficulty) {
  const p = getRandomPuzzle(difficulty);
  const initial = toGrid(p.puzzle);
  const solution = toGrid(p.solution);
  state = {
    difficulty,
    initial,
    solution,
    cells: createCells(initial, initial),
    selected: null,
    noteMode: false,
    settings: loadSettings(),
    elapsedMs: 0,
    timerRunning: true,
    history: [],
    future: [],
    stats: loadStats(),
    clearRecorded: false,
    settingsOpen: false
  };
  screen = 'play';
  render();
}

function restoreSave() {
  const save = loadSave();
  if (!save) return;
  state = {
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
    timerRunning: true,
    history: save.history,
    future: save.future,
    stats: loadStats(),
    clearRecorded: false,
    settingsOpen: false
  };
}

function serialize() {
  if (!state) return;
  if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value)))) return;
  saveGame({
    difficulty: state.difficulty,
    initial: state.initial,
    solution: state.solution,
    values: state.cells.map((r) => r.map((c) => c.value)),
    fixed: state.cells.map((r) => r.map((c) => c.fixed)),
    notes: state.cells.map((r) => r.map((c) => [...c.notes])),
    selected: state.selected,
    noteMode: state.noteMode,
    elapsedMs: state.elapsedMs,
    hintUses: 0,
    history: state.history,
    future: state.future
  });
}

let saveTimer: number | undefined;
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(serialize, 250);
}

function setSelected(pos: Position) {
  if (!state) return;
  state.selected = pos;
  render();
}

function inputValue(value: number) {
  if (!state) return;
  const pos = state.selected;
  if (!pos) return;
  if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value)))) return;
  const cell = state.cells[pos.r][pos.c];
  if (cell.fixed) return;

  pushHistory();
  if (state.noteMode) {
    if (value === 0) cell.notes.clear();
    else if (cell.notes.has(value)) cell.notes.delete(value);
    else cell.notes.add(value);
  } else {
    const next = cell.value === value && state.settings.toggleToErase ? 0 : value;
    cell.value = next;
    cell.notes.clear();
  }

  render();
  scheduleSave();
}

function undo() {
  if (!state) return;
  if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value)))) return;
  const prev = state.history.pop();
  if (!prev) return;
  state.future.push(cloneSnapshot());
  applySnapshot(prev);
  render();
  scheduleSave();
}

function redo() {
  if (!state) return;
  if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value)))) return;
  const next = state.future.pop();
  if (!next) return;
  state.history.push(cloneSnapshot());
  applySnapshot(next);
  render();
  scheduleSave();
}

function toggleSetting(key: keyof Settings) {
  if (!state) return;
  state.settings[key] = !state.settings[key];
  saveSettings(state.settings);
  render();
}

function toggleSettingsPanel() {
  if (!state) return;
  state.settingsOpen = !state.settingsOpen;
  render();
}

function useHint() {
  if (!state) return;
  const pos = state.selected;
  if (!pos) return;
  const cell = state.cells[pos.r][pos.c];
  if (cell.fixed) return;

  const answer = state.solution[pos.r][pos.c];
  if (cell.value === answer) return;

  pushHistory();
  cell.value = answer;
  cell.notes.clear();
  render();
  scheduleSave();
}

function formattedTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function formattedBestTime(ms: number | null) {
  return ms === null ? '--:--' : formattedTime(ms);
}

function renderHome() {
  app.innerHTML = `
  <main class="app-main">
    <section class="screen home">
      <div class="home-noise"></div>
      <div class="home-grid home-grid-left" aria-hidden="true"></div>
      <div class="home-grid home-grid-right" aria-hidden="true"></div>
      <div class="home-center">
        <h1 class="home-title">Nanpure</h1>
        <p class="home-subtitle">Web</p>
        <button class="cta" data-act="go-select">挑戦する</button>
      </div>
    </section>
  </main>`;

  const goSelect = app.querySelector<HTMLButtonElement>('button[data-act="go-select"]');
  if (goSelect) {
    goSelect.onclick = () => {
      screen = 'select';
      render();
    };
  }
}

function renderSelect() {
  app.innerHTML = `
  <main class="app-main">
    <section class="screen select">
      <h2>難易度を選んでください</h2>
      <div class="difficulty-grid">
        <button data-new="easy">易しい</button>
        <button data-new="medium">普通</button>
        <button data-new="hard">難しい</button>
        <button data-new="oni">鬼</button>
      </div>
      <div class="row" style="margin-top:16px; justify-content:center;">
        <button data-act="go-home" class="ghost">タイトルへ戻る</button>
      </div>
    </section>
  </main>`;

  app.querySelectorAll<HTMLButtonElement>('button[data-new]').forEach((btn) => {
    btn.onclick = () => newGame(btn.dataset.new as Difficulty);
  });

  const goHome = app.querySelector<HTMLButtonElement>('button[data-act="go-home"]');
  if (goHome) {
    goHome.onclick = () => {
      screen = 'home';
      render();
    };
  }
}

function renderPlay() {
  if (!state) return;
  document.body.classList.toggle('dark', state.settings.darkMode);

  const values = state.cells.map((r) => r.map((c) => c.value));
  const conflicts = getConflicts(values);
  const selectedValue = state.selected ? values[state.selected.r][state.selected.c] : 0;
  const cleared = isCompleteAndValid(values);
  const difficultyStats = state.stats[state.difficulty];
  if (cleared) {
    state.timerRunning = false;
    if (!state.clearRecorded) {
      state.clearRecorded = true;
      clearSave();
      state.stats = recordClearStats(state.difficulty, state.elapsedMs);
    }
  }

  app.innerHTML = `
  <main class="app-main play-main">
    <section class="screen play">
      <div class="play-root">
        <header class="play-header">
          <button data-act="go-select">難易度</button>
          <div class="meta">${state.difficulty.toUpperCase()} / ${formattedTime(state.elapsedMs)} / BEST ${formattedBestTime(difficultyStats.bestMs)} / CLR ${difficultyStats.clearCount}</div>
          <button data-act="settings" class="icon-button settings-button" aria-expanded="${state.settingsOpen}" aria-label="設定を開く">⚙️</button>
        </header>
        <section class="controls top">
          <button data-act="undo">Undo</button>
          <button data-act="redo">Redo</button>
          <button data-act="note" class="${state.noteMode ? 'active' : ''}">メモ</button>
          <button data-act="hint">ヒント</button>
        </section>
        <div class="memo-indicator ${state.noteMode ? 'on' : ''}">メモモード: ${state.noteMode ? 'ON' : 'OFF'}</div>
        <div class="board-area">
          <section class="board" role="grid" aria-label="ナンプレ盤面">
            ${state.cells
              .map((row, r) =>
                row
                  .map((cell, c) => {
                    const selected = state?.selected?.r === r && state?.selected?.c === c;
                    const peer = state?.selected ? isPeer(state.selected, { r, c }) : false;
                    const same = state?.settings.highlightSameNumber && selectedValue !== 0 && cell.value === selectedValue;
                    const conflict = state?.settings.mistakeHighlight && conflicts[r][c];
                    const classes = ['cell', selected ? 'selected' : '', peer ? 'peer' : '', same ? 'same' : '', conflict ? 'conflict' : '', cell.fixed ? 'fixed' : ''].join(' ');

                    if (cell.value !== 0) {
                      return `<button data-cell="${r},${c}" role="gridcell" class="${classes}">${cell.value}</button>`;
                    }
                    const notes = Array.from({ length: 9 }, (_, i) =>
                      cell.notes.has(i + 1) ? `<span>${i + 1}</span>` : '<span></span>'
                    ).join('');
                    return `<button data-cell="${r},${c}" role="gridcell" class="${classes}"><small>${notes}</small></button>`;
                  })
                  .join('')
              )
              .join('')}
          </section>
        </div>
        <section class="controls keypad">
          ${Array.from({ length: 9 }, (_, i) => `<button data-num="${i + 1}">${i + 1}</button>`).join('')}
          <button data-num="0">消す</button>
        </section>
      </div>
    </section>

    ${
      state.settingsOpen
        ? `<div class="modal-overlay"><section class="modal"><header class="modal-header"><h2>設定</h2><button class="modal-close" data-act="settings-close">×</button></header>
      <label><input data-setting="darkMode" type="checkbox" ${state.settings.darkMode ? 'checked' : ''}/> ダークモード</label>
      <label><input data-setting="mistakeHighlight" type="checkbox" ${state.settings.mistakeHighlight ? 'checked' : ''}/> ミス表示</label>
      <label><input data-setting="highlightSameNumber" type="checkbox" ${state.settings.highlightSameNumber ? 'checked' : ''}/> 同一数字ハイライト</label>
      <label><input data-setting="toggleToErase" type="checkbox" ${state.settings.toggleToErase ? 'checked' : ''}/> 同数字で消去</label>
      </section></div>`
        : ''
    }

    ${
      cleared
        ? `<div class="modal-overlay"><section class="modal"><h2>クリア！</h2><p>今回: ${formattedTime(state.elapsedMs)}</p><p>ベスト: ${formattedBestTime(difficultyStats.bestMs)}</p><div class="row"><button data-act="retry">もう一度</button><button data-act="title">タイトルへ</button></div></section></div>`
        : ''
    }
  </main>`;

  wirePlayEvents();
}

function wirePlayEvents() {
  if (!state) return;

  app.querySelectorAll<HTMLButtonElement>('button[data-cell]').forEach((btn) => {
    btn.onclick = () => {
      const [r, c] = (btn.dataset.cell ?? '0,0').split(',').map(Number);
      setSelected({ r, c });
    };
  });

  app.querySelectorAll<HTMLButtonElement>('button[data-num]').forEach((btn) => {
    btn.onclick = () => inputValue(Number(btn.dataset.num));
  });

  app.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach((el) => {
    el.onchange = () => toggleSetting(el.dataset.setting as keyof Settings);
  });

  const byAct = (act: string) => app.querySelector<HTMLButtonElement>(`button[data-act="${act}"]`);
  const undoBtn = byAct('undo');
  if (undoBtn) undoBtn.onclick = undo;
  const redoBtn = byAct('redo');
  if (redoBtn) redoBtn.onclick = redo;
  const noteBtn = byAct('note');
  if (noteBtn) {
    noteBtn.onclick = () => {
      if (!state) return;
      state.noteMode = !state.noteMode;
      render();
    };
  }
  const hintBtn = byAct('hint');
  if (hintBtn) hintBtn.onclick = useHint;
  const settingsBtn = byAct('settings');
  if (settingsBtn) settingsBtn.onclick = toggleSettingsPanel;
  const settingsCloseBtn = byAct('settings-close');
  if (settingsCloseBtn) settingsCloseBtn.onclick = toggleSettingsPanel;
  const goSelectBtn = byAct('go-select');
  if (goSelectBtn) {
    goSelectBtn.onclick = () => {
      screen = 'select';
      if (state) state.settingsOpen = false;
      render();
    };
  }
  const retryBtn = byAct('retry');
  if (retryBtn) {
    retryBtn.onclick = () => {
      if (!state) return;
      newGame(state.difficulty);
    };
  }
  const titleBtn = byAct('title');
  if (titleBtn) {
    titleBtn.onclick = () => {
      state = null;
      screen = 'home';
      render();
    };
  }
}

function render() {
  document.body.classList.toggle('play-mode', screen === 'play');
  if (screen === 'home') {
    renderHome();
    return;
  }
  if (screen === 'select') {
    renderSelect();
    return;
  }
  renderPlay();
}

document.addEventListener('keydown', (e) => {
  if (screen !== 'play' || !state || !state.selected) return;
  const { r, c } = state.selected;
  if (e.key.startsWith('Arrow')) {
    const next = { r, c };
    if (e.key === 'ArrowUp') next.r = Math.max(0, r - 1);
    if (e.key === 'ArrowDown') next.r = Math.min(8, r + 1);
    if (e.key === 'ArrowLeft') next.c = Math.max(0, c - 1);
    if (e.key === 'ArrowRight') next.c = Math.min(8, c + 1);
    setSelected(next);
    return;
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'z') return undo();
  if (e.ctrlKey && e.key.toLowerCase() === 'y') return redo();
  if (e.key.toLowerCase() === 'n') {
    state.noteMode = !state.noteMode;
    return render();
  }
  if (/^[1-9]$/.test(e.key)) return inputValue(Number(e.key));
  if (e.key === 'Backspace' || e.key === 'Delete') return inputValue(0);
});

window.addEventListener('beforeunload', serialize);

setInterval(() => {
  if (screen !== 'play' || !state || !state.timerRunning) return;
  state.elapsedMs += 1000;
  const meta = app.querySelector<HTMLDivElement>('.meta');
  if (meta) {
    const difficultyStats = state.stats[state.difficulty];
    meta.textContent = `${state.difficulty.toUpperCase()} / ${formattedTime(state.elapsedMs)} / BEST ${formattedBestTime(difficultyStats.bestMs)} / CLR ${difficultyStats.clearCount}`;
  }
  scheduleSave();
}, 1000);

restoreSave();
render();