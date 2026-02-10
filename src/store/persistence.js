const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';


function isNumberGrid(grid) {
  return Array.isArray(grid) && grid.length === 9 && grid.every((row) => Array.isArray(row) && row.length === 9 && row.every((v) => Number.isInteger(v)));
}

function isBooleanGrid(grid) {
  return Array.isArray(grid) && grid.length === 9 && grid.every((row) => Array.isArray(row) && row.length === 9 && row.every((v) => typeof v === 'boolean'));
}

function isNotesGrid(notes) {
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

const DEFAULT_SETTINGS = {
  darkMode: true,
  mistakeHighlight: true,
  highlightSameNumber: true,
  toggleToErase: true
};

function readJson(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function loadSettings() {
  const parsed = readJson(SETTINGS_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    darkMode: true,
    mistakeHighlight: parsed.mistakeHighlight !== false,
    highlightSameNumber: parsed.highlightSameNumber !== false,
    toggleToErase: parsed.toggleToErase !== false
  };
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave() {
  const parsed = readJson(SAVE_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!isNumberGrid(parsed.values) || !isBooleanGrid(parsed.fixed) || !isNotesGrid(parsed.notes)) {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }

  return {
    ...parsed,
    history: Array.isArray(parsed.history) ? parsed.history : [],
    future: Array.isArray(parsed.future) ? parsed.future : [],
    hintUses: typeof parsed.hintUses === 'number' ? parsed.hintUses : 0
  };
}

export function saveGame(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
