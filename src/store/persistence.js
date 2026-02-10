
const SETTINGS_KEY = 'np_settings_v1';
const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';
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
const DEFAULT_SETTINGS = {
  darkMode: true,
  darkMode: true,
  mistakeHighlight: true,
  mistakeHighlight: true,
  highlightSameNumber: true,
  highlightSameNumber: true,
  toggleToErase: true
  toggleToErase: true
};
};


function readJson(key) {
function readJson(key) {
  const raw = localStorage.getItem(key);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  if (!raw) return null;
  try {
  try {
    return JSON.parse(raw);
    return JSON.parse(raw);
  } catch {
  } catch {
    localStorage.removeItem(key);
    localStorage.removeItem(key);
    return null;
    return null;
  }
  }
}
}


export function loadSettings() {
export function loadSettings() {
  const parsed = readJson(SETTINGS_KEY);
  const parsed = readJson(SETTINGS_KEY);
  if (!parsed || typeof parsed !== 'object') {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS };
  }
  }
  return {
  return {
    darkMode: true,
    darkMode: true,
    mistakeHighlight: parsed.mistakeHighlight !== false,
    mistakeHighlight: parsed.mistakeHighlight !== false,
    highlightSameNumber: parsed.highlightSameNumber !== false,
    highlightSameNumber: parsed.highlightSameNumber !== false,
    toggleToErase: parsed.toggleToErase !== false
    toggleToErase: parsed.toggleToErase !== false
  };
  };
}
}


export function saveSettings(settings) {
export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
}


export function loadSave() {
export function loadSave() {
  const parsed = readJson(SAVE_KEY);
  const parsed = readJson(SAVE_KEY);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.values) || !Array.isArray(parsed.fixed) || !Array.isArray(parsed.notes)) {
  if (!isNumberGrid(parsed.values) || !isBooleanGrid(parsed.fixed) || !isNotesGrid(parsed.notes)) {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SAVE_KEY);
    return null;
    return null;
  }
  }
  return parsed;

  return {
    ...parsed,
    history: Array.isArray(parsed.history) ? parsed.history : [],
    future: Array.isArray(parsed.future) ? parsed.future : [],
    hintUses: typeof parsed.hintUses === 'number' ? parsed.hintUses : 0
  };
}
}


export function saveGame(data) {
export function saveGame(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}
}


export function clearSave() {
export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY);
}
}