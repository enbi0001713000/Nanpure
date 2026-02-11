export type Difficulty = 'easy' | 'medium' | 'hard' | 'oni';

export type Cell = {
  value: number;
  fixed: boolean;
  notes: Set<number>;
};

export type Position = { r: number; c: number };

export type Settings = {
  darkMode: boolean;
  mistakeHighlight: boolean;
  highlightSameNumber: boolean;
  toggleToErase: boolean;
  autoNotes: boolean;
};

export type SnapshotCell = { value: number; notes: number[] };

export type HistorySnapshot = {
  grid: SnapshotCell[][];
  selected: Position | null;
  noteMode: boolean;
};

export type DifficultyStats = {
  bestMs: number | null;
  clearCount: number;
  noMissClearCount: number;
  recentAvgMs: number | null;
  recentClearsMs: number[];
};

export type GameStats = Record<Difficulty, DifficultyStats>;
