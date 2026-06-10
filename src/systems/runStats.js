export function createRunStats() {
  return { enemiesKilled: 0, timeElapsed: 0, maxFloor: 0 };
}

export function recordKill(stats) {
  return { ...stats, enemiesKilled: stats.enemiesKilled + 1 };
}

export function updateTime(stats, delta) {
  return { ...stats, timeElapsed: stats.timeElapsed + delta };
}

export function updateMaxFloor(stats, floor) {
  return { ...stats, maxFloor: Math.max(stats.maxFloor, floor) };
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function getSummaryData(stats, survived, treasureValue, roomsExplored, totalRooms, hp, maxHp) {
  // The backrooms are explored of one's own volition, not escaped, and the
  // world is unbounded -- so the summary shows only how many rooms the player
  // explored, never a "X / total" ratio (the total is infinite).
  const title = survived ? 'RETURNED' : 'YOU DIED';
  const titleColor = survived ? 0xffd700 : 0xcc0000;
  const accentColor = titleColor;

  const lines = [
    { label: 'Time', value: formatTime(stats.timeElapsed) },
    { label: 'Rooms Explored', value: `${roomsExplored}` },
    { label: 'Enemies Killed', value: `${stats.enemiesKilled}` },
    { label: 'Deepest Floor', value: `B${stats.maxFloor + 1}` },
    { label: 'Treasure', value: `${treasureValue} gold` },
  ];

  if (survived) {
    lines.push({ label: 'HP Remaining', value: `${hp} / ${maxHp}` });
  }

  return { title, titleColor, accentColor, lines };
}
