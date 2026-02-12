const SETTINGS_KEY = 'np_settings_v1';
const LEGACY_SAVE_KEY = 'np_save_v1';
const STANDARD_SAVE_KEY = 'np_save_standard_v2';
const DAILY_SAVE_KEY_PREFIX = 'np_save_daily_v1_';
const STATS_KEY = 'np_stats_v1';
const RECENT_AVG_SAMPLE_SIZE = 5;
const DEFAULT_STATS = {
    easy: { bestMs: null, clearCount: 0, noMissClearCount: 0, recentAvgMs: null, recentClearsMs: [] },
    medium: { bestMs: null, clearCount: 0, noMissClearCount: 0, recentAvgMs: null, recentClearsMs: [] },
    hard: { bestMs: null, clearCount: 0, noMissClearCount: 0, recentAvgMs: null, recentClearsMs: [] },
    oni: { bestMs: null, clearCount: 0, noMissClearCount: 0, recentAvgMs: null, recentClearsMs: [] }
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
    toggleToErase: true,
    autoNotes: false
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
        toggleToErase: settings.toggleToErase !== false,
        autoNotes: settings.autoNotes === true
    };
}
export function saveSettings(settings) {
    safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
}
function parseSave(key) {
    const parsed = readJson(key);
    if (!parsed || typeof parsed !== 'object')
        return null;
    const save = parsed;
    if (!isDifficulty(save.difficulty) || !isNumberGrid(save.values) || !isBooleanGrid(save.fixed) || !isNotesGrid(save.notes)) {
        safeRemoveItem(key);
        return null;
    }
    return {
        ...save,
        mode: save.mode === 'daily' ? 'daily' : 'standard',
        dailyDate: typeof save.dailyDate === 'string' ? save.dailyDate : null,
        puzzleId: typeof save.puzzleId === 'string' ? save.puzzleId : 'unknown',
        difficulty: save.difficulty,
        history: Array.isArray(save.history) ? save.history : [],
        future: Array.isArray(save.future) ? save.future : [],
        hintUses: typeof save.hintUses === 'number' ? save.hintUses : 0,
        mistakeCount: typeof save.mistakeCount === 'number' && Number.isFinite(save.mistakeCount) ? Math.max(0, Math.floor(save.mistakeCount)) : 0,
        recentPuzzleIds: sanitizeRecentPuzzleIds(save.recentPuzzleIds)
    };
}
function saveByKey(key, data) {
    safeSetItem(key, JSON.stringify(data));
}
function clearByKey(key) {
    safeRemoveItem(key);
}
function dailySaveKey(dateSeed) {
    return `${DAILY_SAVE_KEY_PREFIX}${dateSeed}`;
}
function cleanupDailySaves(activeDate) {
    try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(DAILY_SAVE_KEY_PREFIX))
                continue;
            if (key !== dailySaveKey(activeDate)) {
                localStorage.removeItem(key);
            }
        }
    }
    catch { }
}
export function loadStandardSave() {
    return parseSave(STANDARD_SAVE_KEY) ?? parseSave(LEGACY_SAVE_KEY);
}
export function loadDailySave(dateSeed) {
    cleanupDailySaves(dateSeed);
    return parseSave(dailySaveKey(dateSeed));
}
export function saveStandardGame(data) {
    saveByKey(STANDARD_SAVE_KEY, data);
    clearByKey(LEGACY_SAVE_KEY);
}
export function saveDailyGame(dateSeed, data) {
    cleanupDailySaves(dateSeed);
    saveByKey(dailySaveKey(dateSeed), data);
}
export function clearStandardSave() {
    clearByKey(STANDARD_SAVE_KEY);
    clearByKey(LEGACY_SAVE_KEY);
}
export function clearDailySave(dateSeed) {
    clearByKey(dailySaveKey(dateSeed));
}
export function loadStats() {
    const parsed = readJson(STATS_KEY);
    if (!parsed || typeof parsed !== 'object')
        return { ...DEFAULT_STATS };
    const source = parsed;
    const readRecentClears = (value) => {
        if (!Array.isArray(value))
            return [];
        return value
            .filter((ms) => typeof ms === 'number' && Number.isFinite(ms))
            .map((ms) => Math.max(0, Math.floor(ms)))
            .slice(-RECENT_AVG_SAMPLE_SIZE);
    };
    const calcAvg = (times) => {
        if (times.length === 0)
            return null;
        const total = times.reduce((sum, ms) => sum + ms, 0);
        return Math.floor(total / times.length);
    };
    const readDifficulty = (difficulty) => {
        const value = source[difficulty];
        const clearCount = typeof value?.clearCount === 'number' && Number.isFinite(value.clearCount) ? Math.max(0, Math.floor(value.clearCount)) : 0;
        const noMissClearCount = typeof value?.noMissClearCount === 'number' && Number.isFinite(value.noMissClearCount) ? Math.max(0, Math.floor(value.noMissClearCount)) : 0;
        const bestMs = typeof value?.bestMs === 'number' && Number.isFinite(value.bestMs) ? Math.max(0, Math.floor(value.bestMs)) : null;
        const recentClearsMs = readRecentClears(value?.recentClearsMs);
        const recentAvgMsFromData = typeof value?.recentAvgMs === 'number' && Number.isFinite(value.recentAvgMs) ? Math.max(0, Math.floor(value.recentAvgMs)) : null;
        return {
            clearCount,
            noMissClearCount,
            bestMs,
            recentClearsMs,
            recentAvgMs: calcAvg(recentClearsMs) ?? recentAvgMsFromData
        };
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
export function recordClearStats(difficulty, elapsedMs, noMiss) {
    const next = loadStats();
    const prev = next[difficulty];
    const safeElapsed = Math.max(0, Math.floor(elapsedMs));
    const recentClearsMs = [...prev.recentClearsMs, safeElapsed].slice(-RECENT_AVG_SAMPLE_SIZE);
    const recentAvgMs = Math.floor(recentClearsMs.reduce((sum, ms) => sum + ms, 0) / recentClearsMs.length);
    next[difficulty] = {
        clearCount: prev.clearCount + 1,
        noMissClearCount: prev.noMissClearCount + (noMiss ? 1 : 0),
        bestMs: prev.bestMs === null ? safeElapsed : Math.min(prev.bestMs, safeElapsed),
        recentClearsMs,
        recentAvgMs
    };
    saveStats(next);
    return next;
}
