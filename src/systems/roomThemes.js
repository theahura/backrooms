const DEFAULT_THEME = { floorColor: 0x333333, wallColor: 0x555555 };

const ROOM_THEMES = {
  open:     { floorColor: 0x4a4530, wallColor: 0x5a5540 },
  maze:     { floorColor: 0x303238, wallColor: 0x484a52 },
  columns:  { floorColor: 0x282830, wallColor: 0x404048 },
  corridor: { floorColor: 0x45403a, wallColor: 0x5a5548 },
  storage:  { floorColor: 0x3a3530, wallColor: 0x504a40 },
  cubicles: { floorColor: 0x303540, wallColor: 0x505560 },
};

export function getRoomTheme(roomType) {
  return ROOM_THEMES[roomType] || DEFAULT_THEME;
}
