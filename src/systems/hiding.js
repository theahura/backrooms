export const HIDE_INTERACT_RANGE = 80;

export function createHidingState() {
  return { isHiding: false, furnitureRef: null };
}

export function enterHiding(state, furnitureRef) {
  return { isHiding: true, furnitureRef };
}

export function exitHiding(state) {
  return { isHiding: false, furnitureRef: null };
}

export function findNearestHideable(furnitureByRoom, px, py, maxRange) {
  let nearest = null;
  let nearestDist = maxRange + 1;

  for (const [roomId, items] of furnitureByRoom) {
    for (const item of items) {
      if (!item.canHide) continue;

      const cx = item.x + item.width / 2;
      const cy = item.y + item.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= maxRange && dist < nearestDist) {
        nearest = { roomId, furniture: item, center: { x: cx, y: cy }, dist };
        nearestDist = dist;
      }
    }
  }

  return nearest;
}
