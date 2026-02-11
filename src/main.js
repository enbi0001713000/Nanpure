import { getRandomPuzzle, pushRecentPuzzleId } from './core/puzzleBank.js';
import { getConflicts, isCompleteAndValid, isPeer, toGrid } from './core/sudoku.js';
import { clearSave, loadSave, loadSettings, loadStats, recordClearStats, saveGame, saveSettings } from './store/persistence.js';
const USERNAME_KEY = 'np_username_v1';
const HASH_TAG = '#えびナンプレ';
let screen = 'home';
let state = null;
let usernameModalOpen = false;
let usernameDraft = '';
let recentPuzzleIds = { easy: [], medium: [], hard: [], oni: [] };
const appEl = document.querySelector('#app');
if (!appEl)
    throw new Error('App root not found');
const app = appEl;
function getUsername() {
    try {
        return localStorage.getItem(USERNAME_KEY) ?? '';
    }
    catch {
        return '';
    }
}
function setUsername(value) {
    try {
        localStorage.setItem(USERNAME_KEY, value);
    }
    catch { }
}
function normalizeUsername(value) {
    return value.trim();
}
function isValidUsername(value) {
    const normalized = normalizeUsername(value);
    return normalized.length >= 1 && normalized.length <= 12;
}
function cloneSnapshot() {
    if (!state)
        throw new Error('Game state not initialized');
    return {
        grid: state.cells.map((row) => row.map((cell) => ({ value: cell.value, notes: [...cell.notes] }))),
        selected: state.selected,
        noteMode: state.noteMode
    };
}
function applySnapshot(snapshot) {
    if (!state)
        return;
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
    if (!state)
        return;
    state.history.push(cloneSnapshot());
    if (state.history.length > 200)
        state.history.shift();
    state.future = [];
}
function createCells(values, initial) {
    return values.map((row, r) => row.map((value, c) => ({
        value,
        fixed: initial[r][c] !== 0,
        notes: new Set()
    })));
}
function newGame(difficulty) {
    const p = getRandomPuzzle(difficulty, recentPuzzleIds[difficulty]);
    recentPuzzleIds[difficulty] = pushRecentPuzzleId(recentPuzzleIds[difficulty], p.id);
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
    serialize();
    screen = 'play';
    render();
}
function restoreSave() {
    const save = loadSave();
    if (!save)
        return;
    recentPuzzleIds = save.recentPuzzleIds;
    state = {
        difficulty: save.difficulty,
        initial: save.initial,
        solution: save.solution,
        cells: save.values.map((row, r) => row.map((v, c) => ({ value: v, fixed: save.fixed[r][c], notes: new Set(save.notes[r][c]) }))),
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
    serialize();
}
function serialize() {
    if (!state)
        return;
    if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value))))
        return;
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
        future: state.future,
        recentPuzzleIds
    });
}
let saveTimer;
function scheduleSave() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(serialize, 250);
}
function setSelected(pos) {
    if (!state)
        return;
    state.selected = pos;
    render();
}
function inputValue(value) {
    if (!state)
        return;
    const pos = state.selected;
    if (!pos)
        return;
    if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value))))
        return;
    const cell = state.cells[pos.r][pos.c];
    if (cell.fixed)
        return;
    pushHistory();
    if (state.noteMode) {
        if (value === 0)
            cell.notes.clear();
        else if (cell.notes.has(value))
            cell.notes.delete(value);
        else
            cell.notes.add(value);
    }
    else {
        const next = cell.value === value && state.settings.toggleToErase ? 0 : value;
        cell.value = next;
        cell.notes.clear();
    }
    render();
    scheduleSave();
}
function undo() {
    if (!state)
        return;
    if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value))))
        return;
    const prev = state.history.pop();
    if (!prev)
        return;
    state.future.push(cloneSnapshot());
    applySnapshot(prev);
    render();
    scheduleSave();
}
function redo() {
    if (!state)
        return;
    if (isCompleteAndValid(state.cells.map((r) => r.map((c) => c.value))))
        return;
    const next = state.future.pop();
    if (!next)
        return;
    state.history.push(cloneSnapshot());
    applySnapshot(next);
    render();
    scheduleSave();
}
function toggleSetting(key) {
    if (!state)
        return;
    state.settings[key] = !state.settings[key];
    saveSettings(state.settings);
    render();
}
function toggleSettingsPanel() {
    if (!state)
        return;
    state.settingsOpen = !state.settingsOpen;
    render();
}
function useHint() {
    if (!state)
        return;
    const pos = state.selected;
    if (!pos)
        return;
    const cell = state.cells[pos.r][pos.c];
    if (cell.fixed)
        return;
    const answer = state.solution[pos.r][pos.c];
    if (cell.value === answer)
        return;
    pushHistory();
    cell.value = answer;
    cell.notes.clear();
    render();
    scheduleSave();
}
function formattedTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    return `${m}:${s}`;
}
function formattedBestTime(ms) {
    return ms === null ? '--:--' : formattedTime(ms);
}
function difficultyLabel(difficulty) {
    if (difficulty === 'easy')
        return 'EASY';
    if (difficulty === 'medium')
        return 'NORMAL';
    if (difficulty === 'hard')
        return 'HARD';
    return 'ONI';
}
function clearText() {
    if (!state)
        return '';
    const name = normalizeUsername(getUsername()) || '匿名';
    return `${name} が ${difficultyLabel(state.difficulty)} を ${formattedTime(state.elapsedMs)} でクリア！ ${HASH_TAG}`;
}
function shareUrl() {
    const text = encodeURIComponent(clearText());
    const url = encodeURIComponent(window.location.href);
    return `https://x.com/intent/tweet?text=${text}&url=${url}`;
}
async function copyShareText() {
    try {
        await navigator.clipboard.writeText(`${clearText()}\n${window.location.href}`);
        window.alert('共有文をコピーしました。');
    }
    catch {
        window.alert('コピーに失敗しました。');
    }
}
function renderUsernameModal() {
    if (!usernameModalOpen)
        return '';
    return `<div class="modal-overlay">
    <section class="modal">
      <header class="modal-header">
        <h2>ユーザー名を設定</h2>
      </header>
      <p>クリア後のX共有・コピーで表示されます（1〜12文字）。</p>
      <label>
        名前
        <input data-role="username-input" type="text" maxlength="12" value="${usernameDraft}" placeholder="プレイヤー名" />
      </label>
      <button data-act="save-username" class="primary">この名前で進む</button>
      <button data-act="anonymous" class="ghost wide">匿名でプレイ</button>
    </section>
  </div>`;
}
function renderHome() {
    const darkMode = loadSettings().darkMode;
    document.body.classList.toggle('dark', darkMode);
    app.innerHTML = `
  <main class="app-main">
    <section class="screen home">
      <div class="home-noise"></div>
      <div class="home-grid home-grid-left" aria-hidden="true"></div>
      <div class="home-grid home-grid-right" aria-hidden="true"></div>
      <div class="home-center">
        <h1 class="home-title">ナンプレ</h1>
        <p class="home-subtitle">-えびの挑戦状-</p>
        <button class="cta" data-act="go-select">挑戦する</button>
      </div>
    </section>
  </main>`;
    const goSelect = app.querySelector('button[data-act="go-select"]');
    if (goSelect) {
        goSelect.onclick = () => {
            screen = 'select';
            usernameDraft = getUsername();
            usernameModalOpen = !isValidUsername(usernameDraft);
            render();
        };
    }
}
function renderSelect() {
    const settings = loadSettings();
    document.body.classList.toggle('dark', settings.darkMode);
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
    ${renderUsernameModal()}
  </main>`;
    app.querySelectorAll('button[data-new]').forEach((btn) => {
        btn.onclick = () => {
            if (!isValidUsername(getUsername())) {
                usernameDraft = getUsername();
                usernameModalOpen = true;
                render();
                return;
            }
            newGame(btn.dataset.new);
        };
    });
    const goHome = app.querySelector('button[data-act="go-home"]');
    if (goHome) {
        goHome.onclick = () => {
            screen = 'home';
            usernameModalOpen = false;
            render();
        };
    }
    const usernameInput = app.querySelector('input[data-role="username-input"]');
    if (usernameInput) {
        usernameInput.oninput = () => {
            usernameDraft = usernameInput.value;
        };
    }
    const saveUsername = app.querySelector('button[data-act="save-username"]');
    if (saveUsername) {
        saveUsername.onclick = () => {
            if (!isValidUsername(usernameDraft)) {
                window.alert('名前は1〜12文字で入力してください。');
                return;
            }
            setUsername(normalizeUsername(usernameDraft));
            usernameModalOpen = false;
            render();
        };
    }
    const anonymous = app.querySelector('button[data-act="anonymous"]');
    if (anonymous) {
        anonymous.onclick = () => {
            setUsername('匿名');
            usernameModalOpen = false;
            render();
        };
    }
}
function renderPlay() {
    if (!state)
        return;
    const game = state;
    document.body.classList.toggle('dark', game.settings.darkMode);
    const values = game.cells.map((r) => r.map((c) => c.value));
    const conflicts = getConflicts(values);
    const selectedValue = game.selected ? values[game.selected.r][game.selected.c] : 0;
    const cleared = isCompleteAndValid(values);
    const difficultyStats = game.stats[game.difficulty];
    if (cleared) {
        game.timerRunning = false;
        if (!game.clearRecorded) {
            game.clearRecorded = true;
            clearSave();
            game.stats = recordClearStats(game.difficulty, game.elapsedMs);
        }
    }
    app.innerHTML = `
  <main class="app-main play-main">
    <section class="screen play">
      <div class="play-root">
        <header class="play-header">
          <button data-act="go-select">難易度</button>
          <div class="meta">${difficultyLabel(game.difficulty)} / ${formattedTime(game.elapsedMs)} / BEST ${formattedBestTime(difficultyStats.bestMs)} / CLR ${difficultyStats.clearCount}</div>
          <button data-act="settings" class="icon-button settings-button" aria-expanded="${game.settingsOpen}" aria-label="設定を開く">⚙️</button>
        </header>
        <section class="controls top">
          <button data-act="undo">Undo</button>
          <button data-act="redo">Redo</button>
          <button data-act="note" class="${game.noteMode ? 'active' : ''}">メモ</button>
          <button data-act="hint">ヒント</button>
        </section>
        <div class="memo-indicator ${game.noteMode ? 'on' : ''}">メモモード: ${game.noteMode ? 'ON' : 'OFF'}</div>
        <div class="board-area">
          <section class="board" role="grid" aria-label="ナンプレ盤面">
            ${game.cells
        .map((row, r) => row
        .map((cell, c) => {
        const selected = game.selected?.r === r && game.selected?.c === c;
        const peer = game.selected ? isPeer(game.selected, { r, c }) : false;
        const same = game.settings.highlightSameNumber && selectedValue !== 0 && cell.value === selectedValue;
        const conflict = game.settings.mistakeHighlight && conflicts[r][c];
        const classes = ['cell', selected ? 'selected' : '', peer ? 'peer' : '', same ? 'same' : '', conflict ? 'conflict' : '', cell.fixed ? 'fixed' : ''].join(' ');
        if (cell.value !== 0) {
            return `<button data-cell="${r},${c}" role="gridcell" class="${classes}">${cell.value}</button>`;
        }
        const notes = Array.from({ length: 9 }, (_, i) => cell.notes.has(i + 1) ? `<span>${i + 1}</span>` : '<span></span>').join('');
        return `<button data-cell="${r},${c}" role="gridcell" class="${classes}"><small>${notes}</small></button>`;
    })
        .join(''))
        .join('')}
          </section>
        </div>
        <section class="controls keypad">
          ${Array.from({ length: 9 }, (_, i) => `<button data-num="${i + 1}">${i + 1}</button>`).join('')}
          <button data-num="0">消す</button>
        </section>
      </div>
    </section>

    ${game.settingsOpen
        ? `<div class="modal-overlay"><section class="modal"><header class="modal-header"><h2>設定</h2><button class="modal-close" data-act="settings-close">×</button></header>
      <label class="setting-check"><input data-setting="darkMode" type="checkbox" ${game.settings.darkMode ? 'checked' : ''}/> ダークモード</label>
      <label class="setting-check"><input data-setting="mistakeHighlight" type="checkbox" ${game.settings.mistakeHighlight ? 'checked' : ''}/> ミス表示</label>
      <label class="setting-check"><input data-setting="highlightSameNumber" type="checkbox" ${game.settings.highlightSameNumber ? 'checked' : ''}/> 同一数字ハイライト</label>
      <label class="setting-check"><input data-setting="toggleToErase" type="checkbox" ${game.settings.toggleToErase ? 'checked' : ''}/> 同数字で消去</label>
      </section></div>`
        : ''}

    ${cleared
        ? `<div class="modal-overlay"><section class="modal"><h2>クリア！</h2><p>${normalizeUsername(getUsername()) || '匿名'} / ${difficultyLabel(game.difficulty)} / ${formattedTime(game.elapsedMs)}</p><div class="row" style="margin-top:10px;"><button data-act="share-x">X共有</button><button data-act="copy">コピー</button></div><div class="row" style="margin-top:10px;"><button data-act="retry">もう一度</button><button data-act="title">タイトルへ</button></div></section></div>`
        : ''}
  </main>`;
    wirePlayEvents();
}
function wirePlayEvents() {
    if (!state)
        return;
    app.querySelectorAll('button[data-cell]').forEach((btn) => {
        btn.onclick = () => {
            const [r, c] = (btn.dataset.cell ?? '0,0').split(',').map(Number);
            setSelected({ r, c });
        };
    });
    app.querySelectorAll('button[data-num]').forEach((btn) => {
        btn.onclick = () => inputValue(Number(btn.dataset.num));
    });
    app.querySelectorAll('input[data-setting]').forEach((el) => {
        el.onchange = () => toggleSetting(el.dataset.setting);
    });
    const byAct = (act) => app.querySelector(`button[data-act="${act}"]`);
    const undoBtn = byAct('undo');
    if (undoBtn)
        undoBtn.onclick = undo;
    const redoBtn = byAct('redo');
    if (redoBtn)
        redoBtn.onclick = redo;
    const noteBtn = byAct('note');
    if (noteBtn) {
        noteBtn.onclick = () => {
            if (!state)
                return;
            state.noteMode = !state.noteMode;
            render();
        };
    }
    const hintBtn = byAct('hint');
    if (hintBtn)
        hintBtn.onclick = useHint;
    const settingsBtn = byAct('settings');
    if (settingsBtn)
        settingsBtn.onclick = toggleSettingsPanel;
    const settingsCloseBtn = byAct('settings-close');
    if (settingsCloseBtn)
        settingsCloseBtn.onclick = toggleSettingsPanel;
    const goSelectBtn = byAct('go-select');
    if (goSelectBtn) {
        goSelectBtn.onclick = () => {
            screen = 'select';
            if (state)
                state.settingsOpen = false;
            render();
        };
    }
    const shareBtn = byAct('share-x');
    if (shareBtn)
        shareBtn.onclick = () => window.open(shareUrl(), '_blank', 'noopener,noreferrer');
    const copyBtn = byAct('copy');
    if (copyBtn)
        copyBtn.onclick = () => void copyShareText();
    const retryBtn = byAct('retry');
    if (retryBtn) {
        retryBtn.onclick = () => {
            if (!state)
                return;
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
    if (screen !== 'play' || !state || !state.selected)
        return;
    const { r, c } = state.selected;
    if (e.key.startsWith('Arrow')) {
        const next = { r, c };
        if (e.key === 'ArrowUp')
            next.r = Math.max(0, r - 1);
        if (e.key === 'ArrowDown')
            next.r = Math.min(8, r + 1);
        if (e.key === 'ArrowLeft')
            next.c = Math.max(0, c - 1);
        if (e.key === 'ArrowRight')
            next.c = Math.min(8, c + 1);
        setSelected(next);
        return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'z')
        return undo();
    if (e.ctrlKey && e.key.toLowerCase() === 'y')
        return redo();
    if (e.key.toLowerCase() === 'n') {
        state.noteMode = !state.noteMode;
        return render();
    }
    if (/^[1-9]$/.test(e.key))
        return inputValue(Number(e.key));
    if (e.key === 'Backspace' || e.key === 'Delete')
        return inputValue(0);
});
window.addEventListener('beforeunload', serialize);
setInterval(() => {
    if (screen !== 'play' || !state || !state.timerRunning)
        return;
    state.elapsedMs += 1000;
    const meta = app.querySelector('.meta');
    if (meta) {
        const difficultyStats = state.stats[state.difficulty];
        meta.textContent = `${difficultyLabel(state.difficulty)} / ${formattedTime(state.elapsedMs)} / BEST ${formattedBestTime(difficultyStats.bestMs)} / CLR ${difficultyStats.clearCount}`;
    }
    scheduleSave();
}, 1000);
restoreSave();
render();
