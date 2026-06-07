# Noridoc: src

Path: @/src

### Overview
- Contains all game source code, organized into scenes (Phaser integration) and systems (pure game logic)
- Entry point is `@/src/main.js`, which creates the Phaser.Game instance and registers scenes

### How it fits into the larger codebase
- `@/index.html` loads `@/src/main.js` as an ES module via `<script type="module">`
- `@/src/main.js` wires Phaser config (resolution, physics, renderer) and passes scene classes to the engine
- `@/src/scenes/` contains Phaser Scene subclasses that orchestrate rendering, input, and physics each frame
- `@/src/systems/` contains pure functions that scenes call for game math (movement, visibility, room geometry, furniture placement)
- The architecture enforces a one-way dependency: scenes import from systems, but systems never import from scenes or Phaser

### Core Implementation
- **Game initialization** (`@/src/main.js`): creates a `Phaser.Game` with 1024x768 resolution, Arcade physics (zero gravity for top-down), and `GameScene` as the only registered scene
- **Frame loop**: Phaser calls `GameScene.update()` every frame, which reads input, computes velocity via the movement system, updates physics, computes the flashlight polygon via the visibility system, and redraws the darkness overlay

```
index.html
  -> src/main.js (Phaser.Game config)
       -> src/scenes/GameScene.js (create + update loop)
            -> src/systems/movement.js   (velocity math)
            -> src/systems/visibility.js (raycasting)
            -> src/systems/room.js       (wall segments)
            -> src/systems/furniture.js  (obstacle segments + placement)
```

### Things to Know
- The player sprite uses `__DEFAULT` texture (Phaser built-in fallback) and is set invisible -- the actual player visual is drawn via a Graphics object (`playerGraphics`) so it can rotate with the aim direction
- Camera follows the player with lerp 0.1 for smooth tracking, bounded to room dimensions
- Mouse coordinates must use `pointer.worldX`/`worldY` (not `pointer.x`/`pointer.y`) because the camera moves with the player

Created and maintained by Nori.
