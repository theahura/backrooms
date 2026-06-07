import { raySegmentIntersection } from './visibility.js';
import { mulberry32 } from './random.js';

export const ENEMY_SPEED_CHASE = 80;
export const ENEMY_SPEED_WANDER = 30;
export const DETECTION_RANGE = 300;
const SEARCH_TIMEOUT = 3000;
const WANDER_INTERVAL = 2000;
const SEARCH_ARRIVAL_DIST = 10;

function velocityToward(fromX, fromY, toX, toY, speed) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { vx: 0, vy: 0 };
  return { vx: (dx / dist) * speed, vy: (dy / dist) * speed };
}

export function hasLineOfSight(enemyPos, playerPos, segments, maxRange) {
  const dx = playerPos.x - enemyPos.x;
  const dy = playerPos.y - enemyPos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > maxRange) return false;

  const ray = { x: enemyPos.x, y: enemyPos.y, dx, dy };

  for (const seg of segments) {
    const hit = raySegmentIntersection(ray, seg);
    if (hit && hit.t > 0 && hit.t < 1) return false;
  }

  return true;
}

export function generateRoomEnemies(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId) {
  if (roomId === 0) return [];

  const rand = mulberry32(seed + 10000);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const count = 1 + Math.floor(rand() * 2);
  const placed = [];
  const enemyRadius = 10;

  for (let attempt = 0; attempt < count * 20 && placed.length < count; attempt++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);

    let overlaps = false;
    for (const f of furnitureItems) {
      if (
        x >= f.x - enemyRadius &&
        x <= f.x + f.width + enemyRadius &&
        y >= f.y - enemyRadius &&
        y <= f.y + f.height + enemyRadius
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      placed.push({ x, y, wanderAngle: rand() * Math.PI * 2 });
    }
  }

  return placed;
}

export function updateEnemyAI(enemy, playerPos, segments, delta, playerHidden = false) {
  const canSee = !playerHidden && hasLineOfSight(enemy, playerPos, segments, DETECTION_RANGE);
  const result = { ...enemy };

  switch (enemy.state) {
    case 'idle': {
      if (canSee) {
        result.state = 'chase';
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, ENEMY_SPEED_CHASE);
        result.velocityX = vx;
        result.velocityY = vy;
      } else {
        result.wanderTimer = (enemy.wanderTimer || 0) - delta;
        if (result.wanderTimer <= 0) {
          result.wanderAngle = (enemy.wanderAngle || 0) + 1 + Math.PI * 0.7;
          result.wanderTimer = WANDER_INTERVAL;
        }
        result.velocityX = Math.cos(result.wanderAngle) * ENEMY_SPEED_WANDER;
        result.velocityY = Math.sin(result.wanderAngle) * ENEMY_SPEED_WANDER;
      }
      break;
    }
    case 'chase': {
      if (canSee) {
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, ENEMY_SPEED_CHASE);
        result.velocityX = vx;
        result.velocityY = vy;
      } else {
        result.state = 'search';
        result.lastKnownX = playerPos.x;
        result.lastKnownY = playerPos.y;
        result.searchTimer = SEARCH_TIMEOUT;
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, ENEMY_SPEED_WANDER);
        result.velocityX = vx;
        result.velocityY = vy;
      }
      break;
    }
    case 'search': {
      if (canSee) {
        result.state = 'chase';
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, ENEMY_SPEED_CHASE);
        result.velocityX = vx;
        result.velocityY = vy;
      } else {
        const dx = enemy.lastKnownX - enemy.x;
        const dy = enemy.lastKnownY - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < SEARCH_ARRIVAL_DIST) {
          result.state = 'idle';
          result.velocityX = 0;
          result.velocityY = 0;
          result.wanderTimer = 0;
        } else {
          result.searchTimer = (enemy.searchTimer || 0) - delta;
          if (result.searchTimer <= 0) {
            result.state = 'idle';
            result.velocityX = 0;
            result.velocityY = 0;
            result.wanderTimer = 0;
          } else {
            const { vx, vy } = velocityToward(enemy.x, enemy.y, enemy.lastKnownX, enemy.lastKnownY, ENEMY_SPEED_WANDER);
            result.velocityX = vx;
            result.velocityY = vy;
          }
        }
      }
      break;
    }
  }

  return result;
}
