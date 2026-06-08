export const BULLET_SPEED = 500;
export const FIRE_RATE_MS = 200;
export const BULLET_MAX_RANGE = 600;

export const SPITTER_PROJECTILE_SPEED = 200;
export const SPITTER_PROJECTILE_RANGE = 400;

export function calculateBulletVelocity(originX, originY, targetX, targetY, speed) {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return { vx: 0, vy: 0 };
  return {
    vx: (dx / dist) * speed,
    vy: (dy / dist) * speed,
  };
}

export function getBulletVelocityFromAngle(angle, speed) {
  return {
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
}

export function canFire(cooldown) {
  return cooldown <= 0;
}

export function updateFireCooldown(cooldown, delta) {
  return Math.max(0, cooldown - delta);
}

export function isBulletExpired(originX, originY, currentX, currentY, maxRange) {
  const dx = currentX - originX;
  const dy = currentY - originY;
  return Math.sqrt(dx * dx + dy * dy) > maxRange;
}

export function calculateShotgunSpread(originX, originY, targetX, targetY, speed, bulletCount, spreadAngle) {
  const baseAngle = Math.atan2(targetY - originY, targetX - originX);
  if (bulletCount <= 1) {
    return [{ vx: Math.cos(baseAngle) * speed, vy: Math.sin(baseAngle) * speed }];
  }
  const halfSpread = spreadAngle / 2;
  const pellets = [];
  for (let i = 0; i < bulletCount; i++) {
    const offset = -halfSpread + (spreadAngle * i / (bulletCount - 1));
    const angle = baseAngle + offset;
    pellets.push({ vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }
  return pellets;
}
