import type { Difficulty, HistorySnapshot, Settings } from '../core/types';

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
  if (!isNumberGrid(save.values) || !isBooleanGrid(save.fixed) || !isNotesGrid(save.notes)) {
    safeRemoveItem(SAVE_KEY);
    return null;
  }
  return {
    ...(save as SaveData),
    history: Array.isArray(save.history) ? save.history : [],
    future: Array.isArray(save.future) ? save.future : [],
    hintUses: typeof save.hintUses === 'number' ? save.hintUses : 0
  };
}

export function saveGame(data: SaveData) {
  safeSetItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  safeRemoveItem(SAVE_KEY);
}