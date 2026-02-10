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

const DEFAULT_SETTINGS: Settings = {
  darkMode: true,
  mistakeHighlight: true,
  highlightSameNumber: true,
  toggleToErase: true
};

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
    darkMode: true,
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
