import { mulberry32 } from './random.js';

export const ITEM_TYPES = [
  { type: 'battery', value: 0, weight: { base: 25, perRoom: 0 }, color: 0xffff00, size: { w: 10, h: 14 } },
  { type: 'ammo', value: 0, weight: { base: 20, perRoom: 0 }, color: 0x88ff88, size: { w: 10, h: 10 } },
  { type: 'medkit', value: 0, weight: { base: 8, perRoom: 0 }, color: 0xff4444, size: { w: 10, h: 10 } },
  { type: 'copper_coin', value: 10, weight: { base: 34, perRoom: -5 }, color: 0xcd7f32, size: { w: 8, h: 8 } },
  { type: 'silver_coin', value: 50, weight: { base: 5, perRoom: 2.5 }, color: 0xc0c0c0, size: { w: 8, h: 8 } },
  { type: 'gold_coin', value: 200, weight: { base: -7, perRoom: 2.5 }, color: 0xffd700, size: { w: 8, h: 8 } },
  { type: 'gem', value: 1000, weight: { base: -11, perRoom: 2.4 }, color: 0x00cccc, size: { w: 10, h: 10 } },
];

export const NEAR_DISTANCE = 3;
export const DEEP_DISTANCE = 8;

function itemCountForRoll(r, distance) {
  if (distance <= NEAR_DISTANCE) return r < 0.15 ? 0 : r < 0.55 ? 1 : r < 0.85 ? 2 : 3;
  if (distance < DEEP_DISTANCE) return r < 0.35 ? 0 : r < 0.8 ? 1 : 2;
  return r < 0.55 ? 0 : r < 0.9 ? 1 : 2;
}

function weightForDistance(itemType, distance) {
  return Math.max(0, itemType.weight.base + itemType.weight.perRoom * distance);
}

function pickWeightedType(rand, distance) {
  const totalWeight = ITEM_TYPES.reduce((sum, t) => sum + weightForDistance(t, distance), 0);
  const roll = rand() * totalWeight;
  let cumulative = 0;
  for (const itemType of ITEM_TYPES) {
    cumulative += weightForDistance(itemType, distance);
    if (roll < cumulative) return itemType;
  }
  return ITEM_TYPES[ITEM_TYPES.length - 1];
}

export function generateRoomItems(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId, distance = 0, obstacles = []) {
  if (roomId === 0) return [];

  const rand = mulberry32(seed + 20000);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const r = rand();
  const count = itemCountForRoll(r, distance);
  if (count === 0) return [];
  const placed = [];
  const itemRadius = 8;
  const blockers = obstacles.length ? furnitureItems.concat(obstacles) : furnitureItems;

  for (let attempt = 0; attempt < count * 20 && placed.length < count; attempt++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);

    let overlaps = false;
    for (const f of blockers) {
      if (
        x >= f.x - itemRadius &&
        x <= f.x + f.width + itemRadius &&
        y >= f.y - itemRadius &&
        y <= f.y + f.height + itemRadius
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      const itemType = pickWeightedType(rand, distance);
      placed.push({
        x,
        y,
        type: itemType.type,
        value: itemType.value,
        color: itemType.color,
        size: itemType.size,
      });
    }
  }

  return placed;
}
