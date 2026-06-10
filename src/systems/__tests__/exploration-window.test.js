import { describe, it, expect } from 'vitest';
import {
  createExplorationState,
  updateExploration,
  getWindowedMinimapData,
  MINIMAP_WINDOW_CELLS,
} from '../exploration.js';

const ROOM_WIDTH = 1200;
const ROOM_HEIGHT = 1000;
const FLOOR_Y_OFFSET = 5_000_000;

function makeRoom(id, gridX, gridY, floor = 0) {
  return {
    id,
    gridX,
    gridY,
    floor,
    x: gridX * ROOM_WIDTH,
    y: floor * FLOOR_Y_OFFSET + gridY * ROOM_HEIGHT,
    width: ROOM_WIDTH,
    height: ROOM_HEIGHT,
    doors: [],
    seed: id * 1000,
  };
}

function centerOf(room) {
  return { x: room.x + room.width / 2, y: room.y + room.height / 2 };
}

describe('getWindowedMinimapData', () => {
  it('shows only visited rooms inside the window around the player', () => {
    const rooms = [
      makeRoom(0, 0, 0),
      makeRoom(1, 1, 0),
      makeRoom(2, 2, 0),
      // far away, outside a small window around (0,0)
      makeRoom(3, 50, 0),
    ];
    let state = createExplorationState();
    for (const r of rooms) state = updateExploration(state, ...Object.values(centerOf(r)), rooms);

    const player = centerOf(rooms[0]);
    const data = getWindowedMinimapData(
      state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET, 4
    );

    const ids = data.roomRects.length;
    // rooms 0,1,2 are within 4 cells; room 3 (gx=50) is not.
    expect(ids).toBe(3);
  });

  it('only shows rooms on the current floor', () => {
    const rooms = [
      makeRoom(0, 0, 0, 0),
      makeRoom(1, 1, 0, 0),
      makeRoom(2, 0, 0, 1), // different floor, same grid cell
    ];
    let state = createExplorationState();
    state = updateExploration(state, ...Object.values(centerOf(rooms[0])), rooms);
    state = updateExploration(state, ...Object.values(centerOf(rooms[1])), rooms);
    state = updateExploration(state, ...Object.values(centerOf(rooms[2])), rooms);

    const player = centerOf(rooms[0]);
    const data = getWindowedMinimapData(
      state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET, 4
    );
    expect(data.roomRects.length).toBe(2);
  });

  it('marks the player current room as current', () => {
    const rooms = [makeRoom(0, 0, 0), makeRoom(1, 1, 0)];
    let state = createExplorationState();
    state = updateExploration(state, ...Object.values(centerOf(rooms[0])), rooms);
    state = updateExploration(state, ...Object.values(centerOf(rooms[1])), rooms);

    const player = centerOf(rooms[1]);
    const data = getWindowedMinimapData(
      state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET, 4
    );
    const current = data.roomRects.filter(r => r.isCurrent);
    expect(current.length).toBe(1);
  });

  it('keeps the player dot inside the minimap background box', () => {
    const rooms = [makeRoom(0, 0, 0)];
    let state = createExplorationState();
    const player = centerOf(rooms[0]);
    state = updateExploration(state, player.x, player.y, rooms);
    const data = getWindowedMinimapData(
      state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET, 4
    );
    const bg = data.bgRect;
    expect(data.playerDot.x).toBeGreaterThanOrEqual(bg.x);
    expect(data.playerDot.x).toBeLessThanOrEqual(bg.x + bg.w);
    expect(data.playerDot.y).toBeGreaterThanOrEqual(bg.y);
    expect(data.playerDot.y).toBeLessThanOrEqual(bg.y + bg.h);
  });

  it('repositions the minimap when the screen width changes', () => {
    const rooms = [makeRoom(0, 0, 0)];
    let state = createExplorationState();
    const player = centerOf(rooms[0]);
    state = updateExploration(state, player.x, player.y, rooms);
    const narrow = getWindowedMinimapData(state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET, 4);
    const wide = getWindowedMinimapData(state, rooms, player, { x: 48, y: 48 }, 1200, 0, FLOOR_Y_OFFSET, 4);
    expect(wide.bgRect.x).toBeGreaterThan(narrow.bgRect.x);
  });

  it('uses MINIMAP_WINDOW_CELLS as the default window when none is given', () => {
    // A room exactly at the default window edge must be shown when windowCells
    // is omitted, and a room one cell beyond it must be hidden.
    const rooms = [
      makeRoom(0, 0, 0),
      makeRoom(1, MINIMAP_WINDOW_CELLS, 0),
      makeRoom(2, MINIMAP_WINDOW_CELLS + 1, 0),
    ];
    let state = createExplorationState();
    for (const r of rooms) state = updateExploration(state, ...Object.values(centerOf(r)), rooms);

    const player = centerOf(rooms[0]);
    const data = getWindowedMinimapData(state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET);
    const explicit = getWindowedMinimapData(
      state, rooms, player, { x: 48, y: 48 }, 800, 0, FLOOR_Y_OFFSET, MINIMAP_WINDOW_CELLS
    );

    expect(data.roomRects.length).toBe(2);
    expect(data.roomRects).toEqual(explicit.roomRects);
  });
});
