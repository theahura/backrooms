import { raySegmentIntersection } from './visibility.js';
import { mulberry32 } from './random.js';

export const ENEMY_SPEED_CHASE = 80;
export const ENEMY_SPEED_WANDER = 30;
export const DETECTION_RANGE = 300;
const SEARCH_TIMEOUT = 3000;
const WANDER_INTERVAL = 2000;
const SEARCH_ARRIVAL_DIST = 10;

export const CRAWLER_CHASE_SPEED = 112;
export const CRAWLER_WANDER_SPEED = 50;
export const SPITTER_CHASE_SPEED = 60;
export const SPITTER_WANDER_SPEED = 20;
export const SPITTER_ATTACK_RANGE = 250;
export const SPITTER_ATTACK_COOLDOWN = 2000;
export const SPITTER_TELEGRAPH_MS = 300;

export function getEnemyType(rand, runCount) {
  const roll = rand();
  if (runCount >= 2) {
    if (roll < 0.50) return 'basic';
    if (roll < 0.75) return 'crawler';
    return 'spitter';
  }
  if (runCount >= 1) {
    if (roll < 0.80) return 'basic';
    return 'crawler';
  }
  return 'basic';
}

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

export function generateRoomEnemies(roomX, roomY, roomWidth, roomHeight, wallThickness, seed, furnitureItems, roomId, extraCount = 0, runCount = 0) {
  if (roomId === 0) return [];

  const rand = mulberry32(seed + 10000);
  const margin = 40;
  const minX = roomX + wallThickness + margin;
  const minY = roomY + wallThickness + margin;
  const maxX = roomX + roomWidth - wallThickness - margin;
  const maxY = roomY + roomHeight - wallThickness - margin;

  const count = Math.min(1 + Math.floor(rand() * 2) + extraCount, 5);
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
      placed.push({ x, y, wanderAngle: rand() * Math.PI * 2, type: getEnemyType(rand, runCount) });
    }
  }

  return placed;
}

function getTypeSpeeds(type, chaseSpeed) {
  if (type === 'crawler') return { chase: CRAWLER_CHASE_SPEED, wander: CRAWLER_WANDER_SPEED };
  if (type === 'spitter') return { chase: SPITTER_CHASE_SPEED, wander: SPITTER_WANDER_SPEED };
  return { chase: chaseSpeed, wander: ENEMY_SPEED_WANDER };
}

function distanceBetween(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function updateEnemyAI(enemy, playerPos, segments, delta, playerHidden = false, chaseSpeed = ENEMY_SPEED_CHASE, navContext = null) {
  const canSee = !playerHidden && hasLineOfSight(enemy, playerPos, segments, DETECTION_RANGE);
  const result = { ...enemy };
  const type = enemy.type || 'basic';
  const speeds = getTypeSpeeds(type, chaseSpeed);

  if (navContext) {
    result.roomTransitionCooldown = Math.max(0, (navContext.roomTransitionCooldown || 0) - delta);
    result.targetDoorway = navContext.targetDoorway || null;
  }

  switch (enemy.state) {
    case 'idle': {
      if (canSee) {
        result.state = 'chase';
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, speeds.chase);
        result.velocityX = vx;
        result.velocityY = vy;
        result.targetDoorway = null;
      } else {
        result.wanderTimer = (enemy.wanderTimer || 0) - delta;
        if (result.wanderTimer <= 0) {
          result.wanderTimer = WANDER_INTERVAL;

          if (navContext && navContext.seekDoorway && result.roomTransitionCooldown <= 0 && navContext.doorway) {
            result.targetDoorway = navContext.doorway;
          } else {
            result.wanderAngle = (enemy.wanderAngle || 0) + 1 + Math.PI * 0.7;
            result.targetDoorway = navContext ? null : result.targetDoorway;
          }
        }

        if (result.targetDoorway) {
          const { vx, vy } = velocityToward(enemy.x, enemy.y, result.targetDoorway.x, result.targetDoorway.y, speeds.wander);
          result.velocityX = vx;
          result.velocityY = vy;
        } else {
          result.velocityX = Math.cos(result.wanderAngle || enemy.wanderAngle || 0) * speeds.wander;
          result.velocityY = Math.sin(result.wanderAngle || enemy.wanderAngle || 0) * speeds.wander;
        }
      }
      break;
    }
    case 'chase': {
      if (canSee) {
        const dist = distanceBetween(enemy.x, enemy.y, playerPos.x, playerPos.y);
        if (type === 'spitter' && dist <= SPITTER_ATTACK_RANGE) {
          result.state = 'attack';
          result.velocityX = 0;
          result.velocityY = 0;
          result.attackCooldown = SPITTER_TELEGRAPH_MS;
        } else {
          const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, speeds.chase);
          result.velocityX = vx;
          result.velocityY = vy;
        }
      } else if (navContext && navContext.enemyRoomId !== navContext.playerRoomId && navContext.doorway) {
        const { vx, vy } = velocityToward(enemy.x, enemy.y, navContext.doorway.x, navContext.doorway.y, speeds.chase);
        result.velocityX = vx;
        result.velocityY = vy;
      } else {
        result.state = 'search';
        result.lastKnownX = playerPos.x;
        result.lastKnownY = playerPos.y;
        result.searchTimer = SEARCH_TIMEOUT;
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, speeds.wander);
        result.velocityX = vx;
        result.velocityY = vy;
      }
      break;
    }
    case 'attack': {
      if (!canSee) {
        result.state = 'search';
        result.lastKnownX = playerPos.x;
        result.lastKnownY = playerPos.y;
        result.searchTimer = SEARCH_TIMEOUT;
        result.velocityX = 0;
        result.velocityY = 0;
      } else {
        const dist = distanceBetween(enemy.x, enemy.y, playerPos.x, playerPos.y);
        if (dist > SPITTER_ATTACK_RANGE) {
          result.state = 'chase';
          const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, speeds.chase);
          result.velocityX = vx;
          result.velocityY = vy;
        } else {
          result.velocityX = 0;
          result.velocityY = 0;
          result.attackCooldown = (enemy.attackCooldown || 0) - delta;
          if (result.attackCooldown <= 0) {
            result.wantsToFire = true;
            result.attackCooldown = SPITTER_ATTACK_COOLDOWN;
          }
        }
      }
      break;
    }
    case 'search': {
      if (canSee) {
        result.state = 'chase';
        const { vx, vy } = velocityToward(enemy.x, enemy.y, playerPos.x, playerPos.y, speeds.chase);
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
            const { vx, vy } = velocityToward(enemy.x, enemy.y, enemy.lastKnownX, enemy.lastKnownY, speeds.wander);
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
