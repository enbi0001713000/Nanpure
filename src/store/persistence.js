const SETTINGS_KEY = 'np_settings_v1';
const SAVE_KEY = 'np_save_v1';

export function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return {
      darkMode: false,
      mistakeHighlight: true,
      highlightSameNumber: true,
      toggleToErase: true
    };
  }
  return JSON.parse(raw);
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export function saveGame(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function clearSave() {
  localStorage.removeItem(SAVE_KEY);
}
