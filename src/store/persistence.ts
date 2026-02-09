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
  history: HistorySnapshot[];
  future: HistorySnapshot[];
};

const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';

export function loadSettings(): Settings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return {
      darkMode: false,
      mistakeHighlight: true,
      highlightSameNumber: true,
      toggleToErase: true
    };
  }
  return JSON.parse(raw) as Settings;
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave(): SaveData | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SaveData;
}

export function saveGame(data: SaveData) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
