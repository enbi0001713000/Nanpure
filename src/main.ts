import './styles.css';
import { getRandomPuzzle } from './core/puzzleBank';
import { getConflicts, isCompleteAndValid, isPeer, toGrid } from './core/sudoku';
import type { Cell, Difficulty, GameStats, HistorySnapshot, Position, Settings } from './core/types';
import { clearSave, loadSave, loadSettings, loadStats, recordClearStats, saveGame, saveSettings } from './store/persistence';

type State = {
  difficulty: Difficulty;
  initial: number[][];
  solution: number[][];
  cells: Cell[][];
  selected: Position | null;
  noteMode: boolean;
  settings: Settings;
  elapsedMs: number;
  hintUses: number;
  timerRunning: boolean;
  history: HistorySnapshot[];
  future: HistorySnapshot[];
  stats: GameStats;
  clearRecorded: boolean;
};

let state: State;
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root not found');

function cloneSnapshot(): HistorySnapshot {
  return {
    grid: state.cells.map((row) => row.map((cell) => ({ value: cell.value, notes: [...cell.notes] }))),
    selected: state.selected,
    noteMode: state.noteMode
  };
}

function applySnapshot(snapshot: HistorySnapshot) {
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
    hintUses: 0,
    timerRunning: true,
    history: [],
    future: [],
    stats: loadStats(),
    clearRecorded: false
  };
  render();
}

function restoreOrBoot() {
  const settings = loadSettings();
  const save = loadSave();
  if (!save) {
    newGame('easy');
    state.settings = settings;
    return;
  }
  state = {
    difficulty: save.difficulty,
    initial: save.initial,
    solution: save.solution,
    cells: save.values.map((row, r) =>
      row.map((v, c) => ({ value: v, fixed: save.fixed[r][c], notes: new Set(save.notes[r][c]) }))
    ),
    selected: save.selected,
    noteMode: save.noteMode,
    settings,
    elapsedMs: save.elapsedMs,
    hintUses: save.hintUses,
    timerRunning: true,
    history: save.history,
    future: save.future,
    stats: loadStats(),
    clearRecorded: false
  };
  render();
}

function serialize() {
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
    hintUses: state.hintUses,
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
  state.selected = pos;
  render();
}

function inputValue(value: number) {
  const pos = state.selected;
  if (!pos) return;
  const cell = state.cells[pos.r][pos.c];
  if (cell.fixed) return;
  pushHistory();

  if (state.noteMode) {
    if (value === 0) {
      cell.notes.clear();
    } else if (cell.notes.has(value)) {
      cell.notes.delete(value);
    } else {
      cell.notes.add(value);
    }
  } else {
    const next = cell.value === value && state.settings.toggleToErase ? 0 : value;
    cell.value = next;
    cell.notes.clear();
  }

  render();
  scheduleSave();
}

function undo() {
  const prev = state.history.pop();
  if (!prev) return;
  state.future.push(cloneSnapshot());
  applySnapshot(prev);
  render();
  scheduleSave();
}

function redo() {
  const next = state.future.pop();
  if (!next) return;
  state.history.push(cloneSnapshot());
  applySnapshot(next);
  render();
  scheduleSave();
}

function toggleSetting(key: keyof Settings) {
  state.settings[key] = !state.settings[key];
  saveSettings(state.settings);
  render();
}

const HINT_LIMIT_PER_BOARD = 3;
const HINT_PENALTY_MS = 30_000;

function useHint() {
  const pos = state.selected;
  if (!pos) return;
  const cell = state.cells[pos.r][pos.c];
  if (cell.fixed) return;
  if (state.hintUses >= HINT_LIMIT_PER_BOARD) return;

  const answer = state.solution[pos.r][pos.c];
  if (cell.value === answer) return;

  pushHistory();
  cell.value = answer;
  cell.notes.clear();
  state.hintUses += 1;
  state.elapsedMs += HINT_PENALTY_MS;
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

function render() {
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
  <main>
    <header>
      <h1>Nanpure Web</h1>
      <div class="meta">${state.difficulty.toUpperCase()} / ${formattedTime(state.elapsedMs)} / BEST ${formattedBestTime(difficultyStats.bestMs)} / CLR ${difficultyStats.clearCount}</div>
    </header>
    <section class="controls top">
      <button data-new="easy">易</button>
      <button data-new="medium">中</button>
      <button data-new="hard">難</button>
      <button data-new="oni">鬼</button>
      <button data-act="undo">Undo</button>
      <button data-act="redo">Redo</button>
      <button data-act="note" class="${state.noteMode ? 'active' : ''}">メモ</button>
      <button data-act="hint" ${state.hintUses >= HINT_LIMIT_PER_BOARD ? 'disabled' : ''}>ヒント (${Math.max(0, HINT_LIMIT_PER_BOARD - state.hintUses)})</button>
    </section>
    <section class="board" role="grid" aria-label="ナンプレ盤面">
      ${state.cells
        .map((row, r) =>
          row
            .map((cell, c) => {
              const selected = state.selected?.r === r && state.selected?.c === c;
              const peer = state.selected ? isPeer(state.selected, { r, c }) : false;
              const same =
                state.settings.highlightSameNumber && selectedValue !== 0 && cell.value === selectedValue;
              const conflict = state.settings.mistakeHighlight && conflicts[r][c];
              const classes = [
                'cell',
                selected ? 'selected' : '',
                peer ? 'peer' : '',
                same ? 'same' : '',
                conflict ? 'conflict' : '',
                cell.fixed ? 'fixed' : ''
              ].join(' ');

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
    <section class="controls keypad">
      ${Array.from({ length: 9 }, (_, i) => `<button data-num="${i + 1}">${i + 1}</button>`).join('')}
      <button data-num="0">消す</button>
    </section>
    <section class="settings">
      <label><input data-setting="mistakeHighlight" type="checkbox" ${state.settings.mistakeHighlight ? 'checked' : ''}/>ミス表示</label>
      <label><input data-setting="highlightSameNumber" type="checkbox" ${state.settings.highlightSameNumber ? 'checked' : ''}/>同一数字ハイライト</label>
      <label><input data-setting="toggleToErase" type="checkbox" ${state.settings.toggleToErase ? 'checked' : ''}/>同数字で消去</label>
    </section>
    ${
      cleared
        ? `<div class="clear">クリア！ 今回タイム: ${formattedTime(state.elapsedMs)} / ベストタイム: ${formattedBestTime(
            difficultyStats.bestMs
          )} / 累計クリア: ${difficultyStats.clearCount}</div>`
        : ''
    }
  </main>`;

  wireEvents();
}

function wireEvents() {
  app.querySelectorAll<HTMLButtonElement>('button[data-cell]').forEach((btn) => {
    btn.onclick = () => {
      const [r, c] = (btn.dataset.cell ?? '0,0').split(',').map(Number);
      setSelected({ r, c });
    };
  });

  app.querySelectorAll<HTMLButtonElement>('button[data-num]').forEach((btn) => {
    btn.onclick = () => inputValue(Number(btn.dataset.num));
  });

  app.querySelectorAll<HTMLButtonElement>('button[data-new]').forEach((btn) => {
    btn.onclick = () => newGame(btn.dataset.new as Difficulty);
  });

  app.querySelectorAll<HTMLInputElement>('input[data-setting]').forEach((el) => {
    el.onchange = () => toggleSetting(el.dataset.setting as keyof Settings);
  });

  const byAct = (act: string) => app.querySelector<HTMLButtonElement>(`button[data-act="${act}"]`);
  byAct('undo')!.onclick = undo;
  byAct('redo')!.onclick = redo;
  byAct('note')!.onclick = () => {
    state.noteMode = !state.noteMode;
    render();
  };
  byAct('hint')!.onclick = useHint;
}

document.addEventListener('keydown', (e) => {
  if (!state.selected) return;
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
  if (!state?.timerRunning) return;
  state.elapsedMs += 1000;
  const meta = app.querySelector('.meta');
  if (meta) {
    const difficultyStats = state.stats[state.difficulty];
    meta.textContent = `${state.difficulty.toUpperCase()} / ${formattedTime(state.elapsedMs)} / BEST ${formattedBestTime(difficultyStats.bestMs)} / CLR ${difficultyStats.clearCount}`;
  }
  scheduleSave();
}, 1000);

restoreOrBoot();
