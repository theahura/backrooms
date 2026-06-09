export const DESKTOP_CONTROLS = [
  { key: 'WASD', action: 'Move' },
  { key: 'Mouse', action: 'Aim flashlight' },
  { key: 'Left Click', action: 'Shoot' },
  { key: 'Right Click', action: 'Use battery' },
  { key: 'E', action: 'Interact' },
  { key: 'Q / Scroll', action: 'Switch weapon' },
  { key: 'ESC', action: 'Resume' },
];

export const MOBILE_CONTROLS = [
  { key: 'Left Stick', action: 'Move' },
  { key: 'Right Stick', action: 'Aim flashlight' },
  { key: 'FIRE', action: 'Shoot' },
  { key: 'USE', action: 'Interact' },
  { key: 'WPN', action: 'Switch weapon' },
  { key: 'BATT', action: 'Use battery' },
];

export function getControlsList(touchMode) {
  return touchMode ? MOBILE_CONTROLS : DESKTOP_CONTROLS;
}
