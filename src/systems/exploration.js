import { isPointInRoom } from './lightswitch.js';

export const MINIMAP_WIDTH = 160;
export const MINIMAP_HEIGHT = 130;
export const MINIMAP_MARGIN = 10;
export const MINIMAP_PADDING = 5;

export const MINIMAP_COLORS = {
  background: 0x000000,
  backgroundAlpha: 0.7,
  visited: 0x444444,
  visitedAlpha: 0.8,
  current: 0x888888,
  currentAlpha: 0.9,
  player: 0x00ff00,
  exit: 0xffff00,
};

export function createExplorationState() {
  return { visitedRoomIds: new Set(), currentRoomId: null };
}

export function getCurrentRoom(playerX, playerY, rooms) {
  for (const room of rooms) {
    if (isPointInRoom(room, playerX, playerY)) {
      return room;
    }
  }
  return null;
}

export function updateExploration(state, playerX, playerY, rooms) {
  const room = getCurrentRoom(playerX, playerY, rooms);
  if (!room) {
    return state;
  }

  if (state.currentRoomId === room.id && state.visitedRoomIds.has(room.id)) {
    return state;
  }

  const visitedRoomIds = new Set(state.visitedRoomIds);
  visitedRoomIds.add(room.id);
  return { visitedRoomIds, currentRoomId: room.id };
}

export function getMinimapData(state, rooms, levelBounds, playerPos, exitPos, screenWidth) {
  const worldW = levelBounds.maxX - levelBounds.minX;
  const worldH = levelBounds.maxY - levelBounds.minY;

  const innerW = MINIMAP_WIDTH - MINIMAP_PADDING * 2;
  const innerH = MINIMAP_HEIGHT - MINIMAP_PADDING * 2;

  const scaleX = innerW / worldW;
  const scaleY = innerH / worldH;
  const scale = Math.min(scaleX, scaleY);

  const mapW = worldW * scale;
  const mapH = worldH * scale;

  const bgX = screenWidth - MINIMAP_WIDTH - MINIMAP_MARGIN;
  const bgY = MINIMAP_MARGIN;

  const offsetX = bgX + MINIMAP_PADDING + (innerW - mapW) / 2;
  const offsetY = bgY + MINIMAP_PADDING + (innerH - mapH) / 2;

  function toMinimap(worldX, worldY) {
    return {
      x: offsetX + (worldX - levelBounds.minX) * scale,
      y: offsetY + (worldY - levelBounds.minY) * scale,
    };
  }

  const roomRects = [];
  for (const room of rooms) {
    if (!state.visitedRoomIds.has(room.id)) continue;
    const pos = toMinimap(room.x, room.y);
    roomRects.push({
      x: pos.x,
      y: pos.y,
      w: room.width * scale,
      h: room.height * scale,
      isCurrent: room.id === state.currentRoomId,
    });
  }

  const playerDot = toMinimap(playerPos.x, playerPos.y);
  const exitDot = toMinimap(exitPos.x, exitPos.y);

  return {
    bgRect: { x: bgX, y: bgY, w: MINIMAP_WIDTH, h: MINIMAP_HEIGHT },
    roomRects,
    playerDot,
    exitDot,
  };
}
