import { describe, it, expect } from 'vitest';
import { getAlertedEnemies } from '../gunfireNoise.js';
import { WEAPON_TYPES } from '../weapons.js';

function createLinearGraph() {
  const graph = new Map();
  graph.set(0, [{ targetRoomId: 1, doorway: { x: 100, y: 50 } }]);
  graph.set(1, [
    { targetRoomId: 0, doorway: { x: 100, y: 50 } },
    { targetRoomId: 2, doorway: { x: 200, y: 50 } },
  ]);
  graph.set(2, [
    { targetRoomId: 1, doorway: { x: 200, y: 50 } },
    { targetRoomId: 3, doorway: { x: 300, y: 50 } },
  ]);
  graph.set(3, [{ targetRoomId: 2, doorway: { x: 300, y: 50 } }]);
  return graph;
}

function makeEnemy(overrides = {}) {
  return {
    currentRoomId: 1,
    state: 'idle',
    x: 100,
    y: 100,
    ...overrides,
  };
}

describe('getAlertedEnemies', () => {
  it('alerts idle enemy in same room as gunfire', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 0, state: 'idle' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([0]);
  });

  it('alerts idle enemy in adjacent room within noise range', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 1, state: 'idle' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([0]);
  });

  it('does not alert enemy beyond noise range', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 2, state: 'idle' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([]);
  });

  it('alerts enemy at distance 2 when noise range is 2', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 2, state: 'idle' })];
    const result = getAlertedEnemies(enemies, graph, 0, 2);
    expect(result).toEqual([0]);
  });

  it('alerts search-state enemies', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 1, state: 'search' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([0]);
  });

  it('does not alert chase-state enemies', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 1, state: 'chase' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([]);
  });

  it('does not alert attack-state enemies', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 1, state: 'attack' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([]);
  });

  it('does not alert opening_door-state enemies', () => {
    const graph = createLinearGraph();
    const enemies = [makeEnemy({ currentRoomId: 1, state: 'opening_door' })];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([]);
  });

  it('returns multiple enemy indices when several are in range', () => {
    const graph = createLinearGraph();
    const enemies = [
      makeEnemy({ currentRoomId: 0, state: 'idle' }),
      makeEnemy({ currentRoomId: 1, state: 'search' }),
      makeEnemy({ currentRoomId: 2, state: 'idle' }),
    ];
    const result = getAlertedEnemies(enemies, graph, 0, 1);
    expect(result).toEqual([0, 1]);
  });

  it('returns empty array when no enemies exist', () => {
    const graph = createLinearGraph();
    const result = getAlertedEnemies([], graph, 0, 1);
    expect(result).toEqual([]);
  });

  it('handles disconnected rooms', () => {
    const graph = new Map();
    graph.set(0, []);
    graph.set(5, []);
    const enemies = [makeEnemy({ currentRoomId: 5, state: 'idle' })];
    const result = getAlertedEnemies(enemies, graph, 0, 2);
    expect(result).toEqual([]);
  });

  it('noise range 0 only alerts enemies in the same room', () => {
    const graph = createLinearGraph();
    const enemies = [
      makeEnemy({ currentRoomId: 0, state: 'idle' }),
      makeEnemy({ currentRoomId: 1, state: 'idle' }),
    ];
    const result = getAlertedEnemies(enemies, graph, 0, 0);
    expect(result).toEqual([0]);
  });
});

describe('weapon noise ranges produce correct alert behavior', () => {
  it('pistol noise only reaches adjacent rooms', () => {
    const graph = createLinearGraph();
    const pistol = WEAPON_TYPES.find(w => w.id === 'pistol');
    const enemies = [
      makeEnemy({ currentRoomId: 1, state: 'idle' }),
      makeEnemy({ currentRoomId: 2, state: 'idle' }),
    ];
    const result = getAlertedEnemies(enemies, graph, 0, pistol.noiseRange);
    expect(result).toEqual([0]);
  });

  it('shotgun noise reaches further than pistol', () => {
    const graph = createLinearGraph();
    const shotgun = WEAPON_TYPES.find(w => w.id === 'shotgun');
    const enemies = [
      makeEnemy({ currentRoomId: 1, state: 'idle' }),
      makeEnemy({ currentRoomId: 2, state: 'idle' }),
      makeEnemy({ currentRoomId: 3, state: 'idle' }),
    ];
    const result = getAlertedEnemies(enemies, graph, 0, shotgun.noiseRange);
    expect(result).toEqual([0, 1]);
  });

  it('rifle noise only reaches adjacent rooms like pistol', () => {
    const graph = createLinearGraph();
    const rifle = WEAPON_TYPES.find(w => w.id === 'rifle');
    const enemies = [
      makeEnemy({ currentRoomId: 1, state: 'idle' }),
      makeEnemy({ currentRoomId: 2, state: 'idle' }),
    ];
    const result = getAlertedEnemies(enemies, graph, 0, rifle.noiseRange);
    expect(result).toEqual([0]);
  });
});
