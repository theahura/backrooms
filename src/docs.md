# Noridoc: src

Path: @/src

### Overview
- Contains all game source code, organized into scenes (Phaser integration) and systems (pure game logic)
- Entry point is `@/src/main.js`, which creates the Phaser.Game instance and registers scenes

### How it fits into the larger codebase
- `@/index.html` loads `@/src/main.js` as an ES module via `<script type="module">`
- `@/src/main.js` wires Phaser config (resolution, physics, renderer) and passes scene classes to the engine
- `@/src/scenes/` contains Phaser Scene subclasses that orchestrate rendering, input, and physics each frame
- `@/src/systems/` contains pure functions that scenes call for game math (movement, visibility, room geometry, furniture placement, enemy spawning/AI)
- The architecture enforces a one-way dependency: scenes import from systems, but systems never import from scenes or Phaser. Systems may import from each other (e.g., `enemy.js` imports `raySegmentIntersection` from `visibility.js`)

### Core Implementation
- **Game initialization** (`@/src/main.js`): creates a `Phaser.Game` with 1024x768 resolution, Arcade physics (zero gravity for top-down), and `GameScene` as the only registered scene
- **Frame loop**: Phaser calls `GameScene.update()` every frame, which reads input, computes velocity via the movement system, runs enemy AI updates, redraws the player, and recomputes the flashlight/darkness overlay
- **Level generation**: at scene creation, `GameScene` calls `generateLevel()` which produces a set of connected rooms with doorways. The scene then iterates over all rooms for rendering, physics setup, furniture placement, and enemy spawning

```
index.html
  -> src/main.js (Phaser.Game config)
       -> src/scenes/GameScene.js (create + update loop)
            -> src/systems/level.js      (multi-room level generation)
            -> src/systems/movement.js   (velocity math)
            -> src/systems/visibility.js (raycasting + raySegmentIntersection)
            -> src/systems/room.js       (wall segments with door support)
            -> src/systems/furniture.js  (obstacle segments + placement)
            -> src/systems/enemy.js      (enemy spawning + LOS + AI state machine)
            -> src/systems/random.js     (shared seeded PRNG)
```

### Things to Know
- The player sprite uses `__DEFAULT` texture (Phaser built-in fallback) and is set invisible -- the actual player visual is drawn via a Graphics object (`playerGraphics`) so it can rotate with the aim direction
- Camera follows the player with lerp 0.1 for smooth tracking, bounded to the full level extent (all rooms)
- Mouse coordinates must use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) because the camera moves with the player
- The wall segment array (`wallSegments`) is the shared data structure consumed by both the visibility system (flashlight raycasting) and the enemy system (line-of-sight checks). Any new occluder type must produce segments in this format to participate in both systems

Created and maintained by Nori.
