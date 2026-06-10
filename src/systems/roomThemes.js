// One desaturated, sickly-yellow family across every room type: the
// monotone sameness is what makes the backrooms read as liminal. Types vary
// only subtly so repeated rooms feel familiar-but-off rather than distinct.
const DEFAULT_THEME = { floorColor: 0x57503a, wallColor: 0x665e44 };

const ROOM_THEMES = {
  open:     { floorColor: 0x6b6045, wallColor: 0x7a6f4d },
  maze:     { floorColor: 0x5e5640, wallColor: 0x6d6448 },
  columns:  { floorColor: 0x655c42, wallColor: 0x74694a },
  corridor: { floorColor: 0x615938, wallColor: 0x6f6540 },
  storage:  { floorColor: 0x57503c, wallColor: 0x665e44 },
  cubicles: { floorColor: 0x5f5841, wallColor: 0x6e664a },
};

export function getRoomTheme(roomType) {
  return ROOM_THEMES[roomType] || DEFAULT_THEME;
}
