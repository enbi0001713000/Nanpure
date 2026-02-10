import type { Difficulty, DifficultyStats, GameStats, HistorySnapshot, Settings } from '../core/types';

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
};

const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';
const STATS_KEY = 'np_stats_v1';

const DEFAULT_SETTINGS: Settings = {
  darkMode: true,
  mistakeHighlight: true,
  highlightSameNumber: true,
  toggleToErase: true
};

const DEFAULT_DIFFICULTY_STATS: DifficultyStats = {
  bestMs: null,
  clearCount: 0
};


function cloneDefaultStats(): GameStats {
  return {
    easy: { ...DEFAULT_DIFFICULTY_STATS },
    medium: { ...DEFAULT_DIFFICULTY_STATS },
    hard: { ...DEFAULT_DIFFICULTY_STATS },
    oni: { ...DEFAULT_DIFFICULTY_STATS }
  };
}

function sanitizeDifficultyStats(parsed: unknown): DifficultyStats {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_DIFFICULTY_STATS };
  }
  const stats = parsed as Partial<DifficultyStats>;
  const bestMs = typeof stats.bestMs === 'number' && stats.bestMs >= 0 ? stats.bestMs : null;
  const clearCount = typeof stats.clearCount === 'number' && stats.clearCount >= 0 ? Math.floor(stats.clearCount) : 0;
  return { bestMs, clearCount };
}

function readJson(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    localStorage.removeItem(key);
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
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave(): SaveData | null {
  const parsed = readJson(SAVE_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  const save = parsed as Partial<SaveData>;
  if (!Array.isArray(save.values) || !Array.isArray(save.fixed) || !Array.isArray(save.notes)) {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
  return {
    ...(save as SaveData),
    hintUses: typeof save.hintUses === 'number' ? save.hintUses : 0
  };
}

export function saveGame(data: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function loadStats(): GameStats {
  const parsed = readJson(STATS_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return cloneDefaultStats();
  }
  const partial = parsed as Partial<GameStats>;
  return {
    easy: sanitizeDifficultyStats(partial.easy),
    medium: sanitizeDifficultyStats(partial.medium),
    hard: sanitizeDifficultyStats(partial.hard),
    oni: sanitizeDifficultyStats(partial.oni)
  };
}

export function saveStats(stats: GameStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordClearStats(difficulty: Difficulty, clearMs: number): GameStats {
  const current = loadStats();
  const existing = current[difficulty];
  const nextBest = existing.bestMs === null ? clearMs : Math.min(existing.bestMs, clearMs);
  const next: GameStats = {
    ...current,
    [difficulty]: {
      bestMs: nextBest,
      clearCount: existing.clearCount + 1
    }
  };
  saveStats(next);
  return next;
}
