import type { Difficulty, GameStats, HistorySnapshot, Settings } from '../core/types.js';

export type SaveData = {
  difficulty: Difficulty;
  initial: number[][];
  solution: number[][];
  values: number[][];
  fixed: boolean[][];
  notes: number[][][];
  selected: { r: number; c: number } | null;
  noteMode: boolean;
  elapsedMs: number;
  hintUses: number;
  history: HistorySnapshot[];
  future: HistorySnapshot[];
  recentPuzzleIds: Record<Difficulty, string[]>;
};

const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';
const STATS_KEY = 'np_stats_v1';

const DEFAULT_STATS: GameStats = {
  easy: { bestMs: null, clearCount: 0 },
  medium: { bestMs: null, clearCount: 0 },
  hard: { bestMs: null, clearCount: 0 },
  oni: { bestMs: null, clearCount: 0 }
};

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeRemoveItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function isNumberGrid(grid: unknown): grid is number[][] {
  return (
    Array.isArray(grid) &&
    grid.length === 9 &&
    grid.every((row) => Array.isArray(row) && row.length === 9 && row.every((v) => Number.isInteger(v)))
  );
}

function isBooleanGrid(grid: unknown): grid is boolean[][] {
  return (
    Array.isArray(grid) &&
    grid.length === 9 &&
    grid.every((row) => Array.isArray(row) && row.length === 9 && row.every((v) => typeof v === 'boolean'))
  );
}

function isNotesGrid(notes: unknown): notes is number[][][] {
  return (
    Array.isArray(notes) &&
    notes.length === 9 &&
    notes.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 9 &&
        row.every((cell) => Array.isArray(cell) && cell.every((n) => Number.isInteger(n) && n >= 1 && n <= 9))
    )
  );
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard' || value === 'oni';
}

function sanitizeRecentPuzzleIds(source: unknown): Record<Difficulty, string[]> {
  const read = (difficulty: Difficulty): string[] => {
    if (!source || typeof source !== 'object') return [];
    const value = (source as Partial<Record<Difficulty, unknown>>)[difficulty];
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string').slice(-20) : [];
  };
  return {
    easy: read('easy'),
    medium: read('medium'),
    hard: read('hard'),
    oni: read('oni')
  };
}

const DEFAULT_SETTINGS: Settings = {
  darkMode: true,
  mistakeHighlight: true,
  highlightSameNumber: true,
  toggleToErase: true
};

function readJson(key: string): unknown {
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    safeRemoveItem(key);
    return null;
  }
}

export function loadSettings(): Settings {
  const parsed = readJson(SETTINGS_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const settings = parsed as Partial<Settings>;
  return {
    darkMode: settings.darkMode !== false,
    mistakeHighlight: settings.mistakeHighlight !== false,
    highlightSameNumber: settings.highlightSameNumber !== false,
    toggleToErase: settings.toggleToErase !== false
  };
}

export function saveSettings(settings: Settings) {
  safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave(): SaveData | null {
  const parsed = readJson(SAVE_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  const save = parsed as Partial<SaveData>;
  if (!isDifficulty(save.difficulty) || !isNumberGrid(save.values) || !isBooleanGrid(save.fixed) || !isNotesGrid(save.notes)) {
    safeRemoveItem(SAVE_KEY);
    return null;
  }
  return {
    ...(save as SaveData),
    difficulty: save.difficulty,
    history: Array.isArray(save.history) ? save.history : [],
    future: Array.isArray(save.future) ? save.future : [],
    hintUses: typeof save.hintUses === 'number' ? save.hintUses : 0,
    recentPuzzleIds: sanitizeRecentPuzzleIds(save.recentPuzzleIds)
  };
}

export function saveGame(data: SaveData) {
  safeSetItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  safeRemoveItem(SAVE_KEY);
}

export function loadStats(): GameStats {
  const parsed = readJson(STATS_KEY);
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_STATS };
  const source = parsed as Partial<GameStats>;

  const readDifficulty = (difficulty: Difficulty) => {
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

export function saveStats(stats: GameStats) {
  safeSetItem(STATS_KEY, JSON.stringify(stats));
}

export function recordClearStats(difficulty: Difficulty, elapsedMs: number): GameStats {
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
