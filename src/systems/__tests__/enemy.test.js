import { describe, it, expect } from 'vitest';
import { hasLineOfSight, generateRoomEnemies, updateEnemyAI, ENEMY_SPEED_WANDER, ENEMY_SPEED_CHASE, getEnemyType, CRAWLER_CHASE_SPEED, CRAWLER_WANDER_SPEED, SPITTER_CHASE_SPEED, SPITTER_ATTACK_RANGE, SPITTER_ATTACK_COOLDOWN } from '../enemy.js';

describe('hasLineOfSight', () => {
  it('returns true when no walls between enemy and player', () => {
    const enemy = { x: 50, y: 50 };
    const player = { x: 150, y: 50 };
    const segments = [];

    expect(hasLineOfSight(enemy, player, segments, 300)).toBe(true);
  });

  it('returns false when a wall segment blocks the path', () => {
    const enemy = { x: 50, y: 50 };
    const player = { x: 150, y: 50 };
    const segments = [
      { x1: 100, y1: 0, x2: 100, y2: 100 },
    ];

    expect(hasLineOfSight(enemy, player, segments, 300)).toBe(false);
  });

  it('returns false when player is beyond detection range', () => {
    const enemy = { x: 0, y: 0 };
    const player = { x: 500, y: 0 };
    const segments = [];

    expect(hasLineOfSight(enemy, player, segments, 300)).toBe(false);
  });

  it('returns true when wall exists but does not block the direct path', () => {
    const enemy = { x: 50, y: 50 };
    const player = { x: 150, y: 50 };
    const segments = [
      { x1: 100, y1: 200, x2: 100, y2: 300 },
    ];

    expect(hasLineOfSight(enemy, player, segments, 300)).toBe(true);
  });

  it('returns true when player is exactly at detection range', () => {
    const enemy = { x: 0, y: 0 };
    const player = { x: 300, y: 0 };
    const segments = [];

    expect(hasLineOfSight(enemy, player, segments, 300)).toBe(true);
  });
});

describe('generateRoomEnemies', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;

  it('returns no enemies for room 0 (starting room)', () => {
    const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 0);
    expect(enemies).toEqual([]);
  });

  it('spawns 0-1 enemies near the entrance, including some empty rooms', () => {
    const counts = new Set();
    for (let seed = 0; seed < 30; seed++) {
      const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 1);
      expect(enemies.length).toBeLessThanOrEqual(1);
      counts.add(enemies.length);
    }
    expect(counts.has(0)).toBe(true);
    expect(counts.has(1)).toBe(true);
  });

  it('returns 1-2 enemies at mid distance', () => {
    const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 1, 4);
    expect(enemies.length).toBeGreaterThanOrEqual(1);
    expect(enemies.length).toBeLessThanOrEqual(2);
  });

  it('spawns more enemies in deep rooms than mid rooms on average', () => {
    let midTotal = 0;
    let deepTotal = 0;
    for (let seed = 0; seed < 100; seed++) {
      midTotal += generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 4).length;
      deepTotal += generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 15).length;
    }
    expect(midTotal).toBeGreaterThan(0);
    expect(deepTotal).toBeGreaterThan(midTotal);
  });

  it('caps total enemies at 5 in the deepest rooms', () => {
    for (let seed = 0; seed < 30; seed++) {
      const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 100);
      expect(enemies.length).toBeGreaterThanOrEqual(4);
      expect(enemies.length).toBeLessThanOrEqual(5);
    }
  });

  it('places enemies within room bounds', () => {
    const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42, [], 1, 4);
    expect(enemies.length).toBeGreaterThanOrEqual(1);

    for (const e of enemies) {
      expect(e.x).toBeGreaterThan(ROOM_X + WALL_THICKNESS);
      expect(e.y).toBeGreaterThan(ROOM_Y + WALL_THICKNESS);
      expect(e.x).toBeLessThan(ROOM_X + ROOM_WIDTH - WALL_THICKNESS);
      expect(e.y).toBeLessThan(ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS);
    }
  });

  it('produces deterministic output for the same seed', () => {
    const first = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1, 8);
    const second = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 99, [], 1, 8);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first).toEqual(second);
  });

  it('does not spawn enemies inside a stair/landing keep-out zone', () => {
    // The square where the player materializes after a stair transition; an
    // enemy here would hit the player before they can react.
    const keepOut = [{ x: 500, y: 350, width: 200, height: 200 }];

    let enemiesSeen = 0;
    for (let seed = 0; seed < 40; seed++) {
      const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 8, keepOut);
      enemiesSeen += enemies.length;
      for (const e of enemies) {
        for (const k of keepOut) {
          const inside = e.x >= k.x && e.x <= k.x + k.width && e.y >= k.y && e.y <= k.y + k.height;
          expect(inside).toBe(false);
        }
      }
    }
    expect(enemiesSeen).toBeGreaterThan(0);
  });

  it('does not place enemies overlapping furniture', () => {
    const furniture = [
      { x: 500, y: 400, width: 200, height: 200 },
      { x: 100, y: 100, width: 300, height: 300 },
    ];

    let enemiesSeen = 0;
    for (let seed = 0; seed < 20; seed++) {
      const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, furniture, 1, 8);
      enemiesSeen += enemies.length;

      for (const e of enemies) {
        for (const f of furniture) {
          const insideFurniture =
            e.x >= f.x && e.x <= f.x + f.width &&
            e.y >= f.y && e.y <= f.y + f.height;
          expect(insideFurniture).toBe(false);
        }
      }
    }
    expect(enemiesSeen).toBeGreaterThan(0);
  });
});

describe('updateEnemyAI', () => {
  function createEnemy(overrides = {}) {
    return {
      x: 100,
      y: 100,
      state: 'idle',
      velocityX: 0,
      velocityY: 0,
      wanderTimer: 0,
      wanderAngle: 0,
      lastKnownX: 0,
      lastKnownY: 0,
      searchTimer: 0,
      ...overrides,
    };
  }

  it('transitions from idle to chase when player is visible', () => {
    const enemy = createEnemy({ state: 'idle' });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('chase');
    expect(updated.velocityX).toBeGreaterThan(0);
  });

  it('transitions from chase to search toward the position the player was last seen', () => {
    const enemy = createEnemy({ state: 'chase', lastKnownX: 180, lastKnownY: 120 });
    const player = { x: 200, y: 100 };
    const segments = [
      { x1: 150, y1: 0, x2: 150, y2: 200 },
    ];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('search');
    expect(updated.lastKnownX).toBe(180);
    expect(updated.lastKnownY).toBe(120);
  });

  it('chasing enemy with LOS records the player position as last seen', () => {
    const enemy = createEnemy({ state: 'chase', lastKnownX: 0, lastKnownY: 0 });
    const player = { x: 200, y: 150 };

    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('chase');
    expect(updated.lastKnownX).toBe(200);
    expect(updated.lastKnownY).toBe(150);
  });

  it('on losing LOS the search heads toward the last-seen position, not the player', () => {
    const enemy = createEnemy({ state: 'chase', x: 100, y: 100, lastKnownX: 100, lastKnownY: 300 });
    const player = { x: 300, y: 100 };
    const segments = [
      { x1: 200, y1: 0, x2: 200, y2: 400 },
    ];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('search');
    expect(updated.velocityY).toBeGreaterThan(0);
    expect(Math.abs(updated.velocityX)).toBeLessThan(1);
  });

  it('noise-alerted chase investigates the noise position, not the player', () => {
    const enemy = createEnemy({ state: 'chase', x: 100, y: 100, lastKnownX: 100, lastKnownY: 400 });
    const player = { x: 900, y: 900 };

    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('search');
    expect(updated.velocityY).toBeGreaterThan(0);
    expect(Math.abs(updated.velocityX)).toBeLessThan(1);
  });

  it('in search state moves toward last known position', () => {
    const enemy = createEnemy({
      state: 'search',
      lastKnownX: 300,
      lastKnownY: 100,
      searchTimer: 1000,
    });
    const player = { x: 500, y: 500 };
    const segments = [
      { x1: 150, y1: 0, x2: 150, y2: 200 },
    ];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.velocityX).toBeGreaterThan(0);
    expect(Math.abs(updated.velocityY)).toBeLessThan(1);
  });

  it('transitions from search to idle when search timer expires', () => {
    const enemy = createEnemy({
      state: 'search',
      lastKnownX: 300,
      lastKnownY: 100,
      searchTimer: 10,
    });
    const player = { x: 500, y: 500 };
    const segments = [
      { x1: 150, y1: 0, x2: 150, y2: 200 },
    ];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('idle');
    expect(updated.velocityX).toBe(0);
    expect(updated.velocityY).toBe(0);
  });

  it('stays in chase state when LOS is maintained', () => {
    const enemy = createEnemy({ state: 'chase', x: 100, y: 100 });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('chase');
    expect(updated.velocityX).toBeGreaterThan(0);
  });

  it('transitions from search to idle after reaching last known position', () => {
    const enemy = createEnemy({
      state: 'search',
      x: 299,
      y: 100,
      lastKnownX: 300,
      lastKnownY: 100,
      searchTimer: 1000,
    });
    const player = { x: 500, y: 500 };
    const segments = [
      { x1: 400, y1: 0, x2: 400, y2: 600 },
    ];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('idle');
  });

  it('in idle state produces wander movement when timer expires', () => {
    const enemy = createEnemy({ state: 'idle', wanderTimer: 0 });
    const player = { x: 9999, y: 9999 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    const speed = Math.sqrt(updated.velocityX ** 2 + updated.velocityY ** 2);
    expect(speed).toBeCloseTo(ENEMY_SPEED_WANDER, 0);
  });

  it('chase velocity aims toward the player', () => {
    const enemy = createEnemy({ state: 'idle', x: 100, y: 100 });
    const player = { x: 100, y: 300 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('chase');
    expect(updated.velocityY).toBeGreaterThan(0);
    expect(Math.abs(updated.velocityX)).toBeLessThan(1);
  });

  it('search to chase if LOS reacquired during search', () => {
    const enemy = createEnemy({
      state: 'search',
      lastKnownX: 300,
      lastKnownY: 100,
      searchTimer: 1000,
    });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('chase');
  });

  it('idle enemy does not chase visible player when playerHidden is true', () => {
    const enemy = createEnemy({ state: 'idle' });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16, true);

    expect(updated.state).toBe('idle');
  });

  it('chasing enemy transitions to search toward the pre-hide position when player hides', () => {
    const enemy = createEnemy({ state: 'chase', lastKnownX: 150, lastKnownY: 130 });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16, true);

    expect(updated.state).toBe('search');
    expect(updated.lastKnownX).toBe(150);
    expect(updated.lastKnownY).toBe(130);
  });

  it('searching enemy does not reacquire chase when player is hidden', () => {
    const enemy = createEnemy({
      state: 'search',
      lastKnownX: 300,
      lastKnownY: 100,
      searchTimer: 1000,
    });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16, true);

    expect(updated.state).toBe('search');
  });

  it('omitting playerHidden preserves existing behavior', () => {
    const enemy = createEnemy({ state: 'idle' });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    expect(updated.state).toBe('chase');
  });

  it('uses custom chase speed when provided', () => {
    const enemy = createEnemy({ state: 'idle' });
    const player = { x: 200, y: 100 };
    const segments = [];
    const customChaseSpeed = 120;

    const updated = updateEnemyAI(enemy, player, segments, 16, false, customChaseSpeed);

    expect(updated.state).toBe('chase');
    const speed = Math.sqrt(updated.velocityX ** 2 + updated.velocityY ** 2);
    expect(speed).toBeCloseTo(customChaseSpeed, 0);
  });

  it('uses default chase speed when not provided', () => {
    const enemy = createEnemy({ state: 'idle' });
    const player = { x: 200, y: 100 };
    const segments = [];

    const updated = updateEnemyAI(enemy, player, segments, 16);

    const speed = Math.sqrt(updated.velocityX ** 2 + updated.velocityY ** 2);
    expect(speed).toBeCloseTo(ENEMY_SPEED_CHASE, 0);
  });
});

describe('getEnemyType', () => {
  it('returns basic for all rolls near the entrance (distance 0-3)', () => {
    for (const distance of [0, 1, 2, 3]) {
      for (let i = 0; i < 100; i++) {
        const roll = i / 100;
        expect(getEnemyType(() => roll, distance)).toBe('basic');
      }
    }
  });

  it('returns basic or crawler at mid distance, never spitter', () => {
    for (const distance of [4, 7]) {
      const types = new Set();
      for (let i = 0; i < 100; i++) {
        types.add(getEnemyType(() => i / 100, distance));
      }
      expect(types.has('basic')).toBe(true);
      expect(types.has('crawler')).toBe(true);
      expect(types.has('spitter')).toBe(false);
    }
  });

  it('returns all three types deep (distance 8+)', () => {
    const types = new Set();
    for (let i = 0; i < 100; i++) {
      types.add(getEnemyType(() => i / 100, 8));
    }
    expect(types.has('basic')).toBe(true);
    expect(types.has('crawler')).toBe(true);
    expect(types.has('spitter')).toBe(true);
  });
});

describe('generateRoomEnemies with types', () => {
  const ROOM_X = 0;
  const ROOM_Y = 0;
  const ROOM_WIDTH = 1200;
  const ROOM_HEIGHT = 1000;
  const WALL_THICKNESS = 16;

  it('produces only basic type near the entrance', () => {
    let enemiesSeen = 0;
    for (let seed = 0; seed < 10; seed++) {
      const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 3);
      enemiesSeen += enemies.length;
      for (const e of enemies) {
        expect(e.type).toBe('basic');
      }
    }
    expect(enemiesSeen).toBeGreaterThan(0);
  });

  it('can produce all three types in deep rooms', () => {
    const types = new Set();
    for (let seed = 0; seed < 50; seed++) {
      const enemies = generateRoomEnemies(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, seed, [], 1, 8);
      for (const e of enemies) {
        types.add(e.type);
      }
    }
    expect(types.has('basic')).toBe(true);
    expect(types.has('crawler')).toBe(true);
    expect(types.has('spitter')).toBe(true);
  });
});

function createTypedEnemy(overrides = {}) {
  return {
    x: 100,
    y: 100,
    state: 'idle',
    type: 'basic',
    velocityX: 0,
    velocityY: 0,
    wanderTimer: 0,
    wanderAngle: 0,
    lastKnownX: 0,
    lastKnownY: 0,
    searchTimer: 0,
    attackCooldown: 0,
    ...overrides,
  };
}

describe('updateEnemyAI crawler behavior', () => {
  it('crawler chases at CRAWLER_CHASE_SPEED', () => {
    const enemy = createTypedEnemy({ type: 'crawler', state: 'idle' });
    const player = { x: 200, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('chase');
    const speed = Math.sqrt(updated.velocityX ** 2 + updated.velocityY ** 2);
    expect(speed).toBeCloseTo(CRAWLER_CHASE_SPEED, 0);
  });

  it('crawler wanders at CRAWLER_WANDER_SPEED', () => {
    const enemy = createTypedEnemy({ type: 'crawler', state: 'idle', wanderTimer: 0 });
    const player = { x: 9999, y: 9999 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    const speed = Math.sqrt(updated.velocityX ** 2 + updated.velocityY ** 2);
    expect(speed).toBeCloseTo(CRAWLER_WANDER_SPEED, 0);
  });
});

describe('updateEnemyAI spitter behavior', () => {
  it('spitter transitions from chase to attack when within attack range', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'chase', x: 100, y: 100 });
    const player = { x: 100 + SPITTER_ATTACK_RANGE - 10, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('attack');
  });

  it('spitter in attack state has zero velocity', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'attack', attackCooldown: 1000, x: 100, y: 100 });
    const player = { x: 100 + SPITTER_ATTACK_RANGE - 10, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.velocityX).toBe(0);
    expect(updated.velocityY).toBe(0);
  });

  it('spitter stays in attack and does not fire while cooldown is high', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'attack', attackCooldown: 1000, x: 100, y: 100 });
    const player = { x: 100 + SPITTER_ATTACK_RANGE - 10, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('attack');
    expect(updated.wantsToFire).toBeFalsy();
  });

  it('spitter sets wantsToFire when enough time has passed', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'attack', attackCooldown: 10, x: 100, y: 100 });
    const player = { x: 100 + SPITTER_ATTACK_RANGE - 10, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.wantsToFire).toBe(true);
  });

  it('spitter transitions from attack to search toward last-seen position when LOS is lost', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'attack', attackCooldown: 1000, x: 100, y: 100, lastKnownX: 130, lastKnownY: 90 });
    const player = { x: 200, y: 100 };
    const wall = { x1: 150, y1: 0, x2: 150, y2: 200 };
    const updated = updateEnemyAI(enemy, player, [wall], 16);

    expect(updated.state).toBe('search');
    expect(updated.lastKnownX).toBe(130);
    expect(updated.lastKnownY).toBe(90);
  });

  it('spitter in attack with LOS records the player position as last seen', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'attack', attackCooldown: 1000, x: 100, y: 100, lastKnownX: 0, lastKnownY: 0 });
    const player = { x: 100 + SPITTER_ATTACK_RANGE - 10, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.lastKnownX).toBe(100 + SPITTER_ATTACK_RANGE - 10);
    expect(updated.lastKnownY).toBe(100);
  });

  it('spitter transitions from attack to chase when player exits attack range', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'attack', attackCooldown: 1000, x: 100, y: 100 });
    const player = { x: 100 + SPITTER_ATTACK_RANGE + 50, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('chase');
  });

  it('spitter in idle transitions to chase when LOS acquired (same as basic)', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'idle' });
    const player = { x: 200, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('chase');
  });

  it('spitter uses SPITTER_CHASE_SPEED when chasing', () => {
    const enemy = createTypedEnemy({ type: 'spitter', state: 'idle' });
    const player = { x: 100 + SPITTER_ATTACK_RANGE + 50, y: 100 };
    const updated = updateEnemyAI(enemy, player, [], 16);

    expect(updated.state).toBe('chase');
    const speed = Math.sqrt(updated.velocityX ** 2 + updated.velocityY ** 2);
    expect(speed).toBeCloseTo(SPITTER_CHASE_SPEED, 0);
  });
});

describe('updateEnemyAI with navContext', () => {
  function makeNavContext(overrides = {}) {
    return {
      roomTransitionCooldown: 0,
      targetDoorway: null,
      doorway: { x: 1200, y: 240 },
      seekDoorway: false,
      ...overrides,
    };
  }

  it('enemy in chase state stops following across rooms and searches its last-seen position when LOS is lost', () => {
    const enemy = createTypedEnemy({ state: 'chase', x: 1800, y: 500, lastKnownX: 1600, lastKnownY: 500 });
    const player = { x: 600, y: 500 };
    const wall = { x1: 1200, y1: 0, x2: 1200, y2: 200 };
    const wall2 = { x1: 1200, y1: 280, x2: 1200, y2: 1000 };
    const navContext = makeNavContext();

    const updated = updateEnemyAI(enemy, player, [wall, wall2], 16, false, ENEMY_SPEED_CHASE, navContext);

    expect(updated.state).toBe('search');
    expect(updated.velocityX).toBeLessThan(0);
    expect(Math.abs(updated.velocityY)).toBeLessThan(1);
  });

  it('enemy in chase state still chases directly when can see the player', () => {
    const enemy = createTypedEnemy({ state: 'chase', x: 1300, y: 240 });
    const player = { x: 1100, y: 240 };
    const navContext = makeNavContext();

    const updated = updateEnemyAI(enemy, player, [], 16, false, ENEMY_SPEED_CHASE, navContext);

    expect(updated.state).toBe('chase');
    expect(updated.velocityX).toBeLessThan(0);
  });

  it('enemy in chase state falls back to search when it cannot see the player', () => {
    const enemy = createTypedEnemy({ state: 'chase', x: 600, y: 100 });
    const player = { x: 600, y: 900 };
    const wall = { x1: 0, y1: 500, x2: 1200, y2: 500 };
    const navContext = makeNavContext();

    const updated = updateEnemyAI(enemy, player, [wall], 16, false, ENEMY_SPEED_CHASE, navContext);

    expect(updated.state).toBe('search');
  });

  it('enemy without navContext behaves exactly as before', () => {
    const enemy = createTypedEnemy({ state: 'chase', x: 1800, y: 500 });
    const player = { x: 600, y: 500 };
    const wall = { x1: 1200, y1: 0, x2: 1200, y2: 1000 };

    const updated = updateEnemyAI(enemy, player, [wall], 16);

    expect(updated.state).toBe('search');
  });

  it('enemy in idle state with doorway seek navigates toward a doorway', () => {
    const enemy = createTypedEnemy({ state: 'idle', wanderTimer: 0, x: 1800, y: 500 });
    const player = { x: 9999, y: 9999 };
    const navContext = makeNavContext({ seekDoorway: true });

    const updated = updateEnemyAI(enemy, player, [], 16, false, ENEMY_SPEED_CHASE, navContext);

    expect(updated.targetDoorway).toBeDefined();
    expect(updated.targetDoorway).toHaveProperty('x');
    expect(updated.targetDoorway).toHaveProperty('y');
  });

  it('enemy in idle state does not seek doorway when cooldown is active', () => {
    const enemy = createTypedEnemy({ state: 'idle', wanderTimer: 0, x: 1800, y: 500 });
    const player = { x: 9999, y: 9999 };
    const navContext = makeNavContext({ seekDoorway: true, roomTransitionCooldown: 5000 });

    const updated = updateEnemyAI(enemy, player, [], 16, false, ENEMY_SPEED_CHASE, navContext);

    expect(updated.targetDoorway == null).toBe(true);
  });

  it('decrements roomTransitionCooldown by delta', () => {
    const enemy = createTypedEnemy({ state: 'idle', wanderTimer: 1000, x: 1800, y: 500 });
    const player = { x: 9999, y: 9999 };
    const navContext = makeNavContext({ roomTransitionCooldown: 5000 });

    const updated = updateEnemyAI(enemy, player, [], 100, false, ENEMY_SPEED_CHASE, navContext);

    expect(updated.roomTransitionCooldown).toBe(4900);
  });
});
