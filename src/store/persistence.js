const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}


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
  const raw = safeGetItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    safeRemoveItem(key);
    return null;
  }
}

export function loadSettings() {
  const parsed = readJson(SETTINGS_KEY);
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    darkMode: parsed.darkMode !== false,
    mistakeHighlight: parsed.mistakeHighlight !== false,
    highlightSameNumber: parsed.highlightSameNumber !== false,
    toggleToErase: parsed.toggleToErase !== false
  };
}

export function saveSettings(settings) {
  safeSetItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave() {
  const parsed = readJson(SAVE_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!isNumberGrid(parsed.values) || !isBooleanGrid(parsed.fixed) || !isNotesGrid(parsed.notes)) {
    safeRemoveItem(SAVE_KEY);
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
  safeSetItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  safeRemoveItem(SAVE_KEY);
}
