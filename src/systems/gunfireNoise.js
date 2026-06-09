import { getRoomDistance } from './pathfinding.js';

export const GUNSHOT_ALERT_COOLDOWN = 5000;

const ALERTABLE_STATES = new Set(['idle', 'search']);

export function getAlertedEnemies(enemyStates, roomGraph, sourceRoomId, noiseRange) {
  const alerted = [];
  for (let i = 0; i < enemyStates.length; i++) {
    const enemy = enemyStates[i];
    if (!ALERTABLE_STATES.has(enemy.state)) continue;
    const dist = getRoomDistance(roomGraph, sourceRoomId, enemy.currentRoomId);
    if (dist >= 0 && dist <= noiseRange) {
      alerted.push(i);
    }
  }
  return alerted;
}
