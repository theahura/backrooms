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
