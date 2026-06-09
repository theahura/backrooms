export const SETTINGS_KEY = 'backrooms_settings';

export const VOLUME_LEVELS = ['OFF', 'LOW', 'MED', 'HIGH', 'FULL'];

export const VOLUME_VALUES = { OFF: 0, LOW: 0.05, MED: 0.15, HIGH: 0.4, FULL: 1.0 };

export function createDefaultSettings() {
  return { masterVolume: 'FULL', sfxVolume: 'FULL', ambientVolume: 'FULL' };
}

export function cycleVolume(currentLevel) {
  const idx = VOLUME_LEVELS.indexOf(currentLevel);
  return VOLUME_LEVELS[(idx + 1) % VOLUME_LEVELS.length];
}

export function getVolumeValue(level) {
  return VOLUME_VALUES[level] ?? 1.0;
}

export function getEffectiveVolume(masterLevel, categoryLevel) {
  return getVolumeValue(masterLevel) * getVolumeValue(categoryLevel);
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return createDefaultSettings();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return createDefaultSettings();
    if (!VOLUME_LEVELS.includes(data.masterVolume)) return createDefaultSettings();
    return {
      masterVolume: data.masterVolume,
      sfxVolume: VOLUME_LEVELS.includes(data.sfxVolume) ? data.sfxVolume : 'FULL',
      ambientVolume: VOLUME_LEVELS.includes(data.ambientVolume) ? data.ambientVolume : 'FULL',
    };
  } catch (e) {
    return createDefaultSettings();
  }
}
