const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';

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
  if (!Array.isArray(parsed.values) || !Array.isArray(parsed.fixed) || !Array.isArray(parsed.notes)) {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
  return {
    ...parsed,
    hintUses: typeof parsed.hintUses === 'number' ? parsed.hintUses : 0
  };
}

export function saveGame(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
