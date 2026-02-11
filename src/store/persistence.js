const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';
const STATS_KEY = 'np_stats_v1';
const DEFAULT_STATS = {
    easy: { bestMs: null, clearCount: 0 },
    medium: { bestMs: null, clearCount: 0 },
    hard: { bestMs: null, clearCount: 0 },
    oni: { bestMs: null, clearCount: 0 }
};
function safeGetItem(key) {
    try {
        return localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
    }
    catch { }
}
function safeRemoveItem(key) {
    try {
        localStorage.removeItem(key);
    }
    catch { }
}
function isNumberGrid(grid) {
    return (Array.isArray(grid) &&
        grid.length === 9 &&
        grid.every((row) => Array.isArray(row) && row.length === 9 && row.every((v) => Number.isInteger(v))));
}
function isBooleanGrid(grid) {
    return (Array.isArray(grid) &&
        grid.length === 9 &&
        grid.every((row) => Array.isArray(row) && row.length === 9 && row.every((v) => typeof v === 'boolean')));
}
function isNotesGrid(notes) {
    return (Array.isArray(notes) &&
        notes.length === 9 &&
        notes.every((row) => Array.isArray(row) &&
            row.length === 9 &&
            row.every((cell) => Array.isArray(cell) && cell.every((n) => Number.isInteger(n) && n >= 1 && n <= 9))));
}
function isDifficulty(value) {
    return value === 'easy' || value === 'medium' || value === 'hard' || value === 'oni';
}
function sanitizeRecentPuzzleIds(source) {
    const read = (difficulty) => {
        if (!source || typeof source !== 'object')
            return [];
        const value = source[difficulty];
        return Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(-20) : [];
    };
    return {
        easy: read('easy'),
        medium: read('medium'),
        hard: read('hard'),
        oni: read('oni')
    };
}
const DEFAULT_SETTINGS = {
    darkMode: true,
    mistakeHighlight: true,
    highlightSameNumber: true,
    toggleToErase: true
};
function readJson(key) {
    const raw = safeGetItem(key);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        safeRemoveItem(key);
        return null;
    }
}
export function loadSettings() {
    const parsed = readJson(SETTINGS_KEY);
    if (!parsed || typeof parsed !== 'object') {
        return { ...DEFAULT_SETTINGS };
    }
    const settings = parsed;
    return {
        darkMode: settings.darkMode !== false,
        mistakeHighlight: settings.mistakeHighlight !== false,
        highlightSameNumber: settings.highlightSameNumber !== false,
        toggleToErase: settings.toggleToErase !== false
    };
}
export function saveSettings(settings) {
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
}
export function loadSave() {
    const parsed = readJson(SAVE_KEY);
    if (!parsed || typeof parsed !== 'object')
        return null;
    const save = parsed;
    if (!isDifficulty(save.difficulty) || !isNumberGrid(save.values) || !isBooleanGrid(save.fixed) || !isNotesGrid(save.notes)) {
        safeRemoveItem(SAVE_KEY);
        return null;
    }
    return {
        ...save,
        difficulty: save.difficulty,
        history: Array.isArray(save.history) ? save.history : [],
        future: Array.isArray(save.future) ? save.future : [],
        hintUses: typeof save.hintUses === 'number' ? save.hintUses : 0,
        recentPuzzleIds: sanitizeRecentPuzzleIds(save.recentPuzzleIds)
    };
}
export function saveGame(data) {
    safeSetItem(SAVE_KEY, JSON.stringify(data));
}
export function clearSave() {
    safeRemoveItem(SAVE_KEY);
}
export function loadStats() {
    const parsed = readJson(STATS_KEY);
    if (!parsed || typeof parsed !== 'object')
        return { ...DEFAULT_STATS };
    const source = parsed;
    const readDifficulty = (difficulty) => {
        const value = source[difficulty];
        const clearCount = typeof value?.clearCount === 'number' && Number.isFinite(value.clearCount) ? Math.max(0, Math.floor(value.clearCount)) : 0;
        const bestMs = typeof value?.bestMs === 'number' && Number.isFinite(value.bestMs) ? Math.max(0, Math.floor(value.bestMs)) : null;
        return { clearCount, bestMs };
    };
    return {
        easy: readDifficulty('easy'),
        medium: readDifficulty('medium'),
        hard: readDifficulty('hard'),
        oni: readDifficulty('oni')
    };
}
export function saveStats(stats) {
    safeSetItem(STATS_KEY, JSON.stringify(stats));
}
export function recordClearStats(difficulty, elapsedMs) {
    const next = loadStats();
    const prev = next[difficulty];
    const safeElapsed = Math.max(0, Math.floor(elapsedMs));
    next[difficulty] = {
        clearCount: prev.clearCount + 1,
        bestMs: prev.bestMs === null ? safeElapsed : Math.min(prev.bestMs, safeElapsed)
    };
    saveStats(next);
    return next;
}
