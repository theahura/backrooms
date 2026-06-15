export const STORE_FLOOR_COLOR = 0x5c4a3a;
export const STORE_WALL_COLOR = 0x7a6b5a;

const STORE_FURNITURE = [
  { type: 'counter', relX: 0.35, relY: 0.42, width: 120, height: 40, color: 0x5c3a21, canHide: false },
  { type: 'shelf', relX: 0.55, relY: 0.08, width: 100, height: 20, color: 0x6b4e2a, canHide: false },
  { type: 'shelf', relX: 0.55, relY: 0.18, width: 100, height: 20, color: 0x6b4e2a, canHide: false },
  { type: 'shelf', relX: 0.55, relY: 0.28, width: 100, height: 20, color: 0x6b4e2a, canHide: false },
  { type: 'bookcase', relX: 0.62, relY: 0.55, width: 30, height: 80, color: 0x4a2c17, canHide: false },
  { type: 'couch', relX: 0.08, relY: 0.6, width: 90, height: 50, color: 0x8b6b4e, canHide: false },
  { type: 'table', relX: 0.25, relY: 0.65, width: 40, height: 40, color: 0xc19a6b, canHide: true },
  { type: 'desk', relX: 0.08, relY: 0.15, width: 60, height: 40, color: 0x3a3a3a, canHide: true },
  { type: 'table', relX: 0.35, relY: 0.15, width: 80, height: 50, color: 0x5c3a21, canHide: true },
  { type: 'bookcase', relX: 0.62, relY: 0.08, width: 30, height: 80, color: 0x4a2c17, canHide: false },
];

export function generateStoreLayout(roomX, roomY, roomWidth, roomHeight, wallThickness) {
  const innerX = roomX + wallThickness;
  const innerY = roomY + wallThickness;
  const innerW = roomWidth - wallThickness * 2;
  const innerH = roomHeight - wallThickness * 2;

  const spawnCX = roomX + roomWidth / 2;
  const spawnCY = roomY + roomHeight / 2;
  const spawnHalf = 30;

  const result = [];

  for (const def of STORE_FURNITURE) {
    const x = innerX + Math.round(def.relX * innerW);
    const y = innerY + Math.round(def.relY * innerH);

    const overlapsSpawnX = x < spawnCX + spawnHalf && x + def.width > spawnCX - spawnHalf;
    const overlapsSpawnY = y < spawnCY + spawnHalf && y + def.height > spawnCY - spawnHalf;
    if (overlapsSpawnX && overlapsSpawnY) continue;

    if (x + def.width > roomX + roomWidth - wallThickness) continue;
    if (y + def.height > roomY + roomHeight - wallThickness) continue;

    result.push({
      type: def.type,
      x,
      y,
      width: def.width,
      height: def.height,
      color: def.color,
      canHide: def.canHide,
    });
  }

  return result;
}

export function generateCrackPoints(startX, startY, length, segments, vertical = true) {
  const points = [];
  const segLen = length / segments;

  for (let i = 0; i <= segments; i++) {
    const offset = i === 0 || i === segments ? 0 : (i % 2 === 0 ? -3 : 3);
    if (vertical) {
      points.push({ x: startX + offset, y: startY + i * segLen });
    } else {
      points.push({ x: startX + i * segLen, y: startY + offset });
    }
  }

  return points;
}

// True only when the player is past the rift's east edge AND within the rift
// opening's vertical band. The band check is essential: without it, ANY eastward
// crossing of the store's east-edge x triggers the rift transition, including a
// door one room north or south that happens to share that x (the "rift fires on
// an unrelated door crossing" bug).
export function isThroughRift(playerX, playerY, edgeX, riftRect) {
  const inBand = playerY >= riftRect.y && playerY <= riftRect.y + riftRect.height;
  return playerX > edgeX && inBand;
}

// One frame of the rift-crossing state machine. The dimensional transition (a
// white-out flash + jolt + crackle) fires once when the player passes THROUGH
// the rift opening into the backrooms, and re-arms only when the player is
// genuinely back INSIDE the entrance room (the store).
//
// Re-arming on a bare `playerX < edge - 40` (the crossing axis alone) is the bug:
// a column-0 room directly north or south of the store shares the store's
// east-edge x, so looping through one re-armed the one-shot and replayed the
// transition the next time the player re-entered the rift's horizontal band.
// Requiring full containment in the store's vertical extent fixes that; the
// `edge - 40` margin stays as hysteresis against the `edge + 4` trigger so jitter
// at the rift edge cannot double-fire. The trigger uses the rift BAND (a slice of
// the east wall); the re-arm uses the whole store rect -- two Y regions on
// purpose. Returns { riftCrossed, triggered }: the next latch state and whether
// to play the transition this frame.
export function nextRiftCrossing(playerX, playerY, room, riftRect, riftCrossed) {
  const edge = room.x + room.width;
  const inBackrooms = isThroughRift(playerX, playerY, edge + 4, riftRect);

  if (inBackrooms && !riftCrossed) {
    return { riftCrossed: true, triggered: true };
  }

  const backInStore =
    playerX >= room.x && playerX < edge - 40 &&
    playerY >= room.y && playerY <= room.y + room.height;
  if (!inBackrooms && riftCrossed && backInStore) {
    return { riftCrossed: false, triggered: false };
  }

  return { riftCrossed, triggered: false };
}

export function getExitPosition(room, wallThickness) {
  return {
    x: room.x + wallThickness + 40,
    y: room.y + room.height / 2,
  };
}
