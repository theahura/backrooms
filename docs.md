# Noridoc: Backrooms (Project Root)

Path: @/

### Overview
- Survival horror top-down 2D twin-stick shooter built with Phaser 3, Vite, and plain JavaScript
- Based on the "Backrooms" creepypasta: player explores pitch-black rooms using only a flashlight, collects valuables, and must return before the battery dies
- Inspired by the Flash game Motherload -- roguelike loop of explore, collect, upgrade, repeat

### How it fits into the larger codebase
- `@/index.html` is the single HTML entry point, loading `@/src/main.js` as an ES module
- `@/src/main.js` creates the Phaser.Game instance and registers all scenes
- Game logic is split between pure systems (`@/src/systems/`) and Phaser scene classes (`@/src/scenes/`) to keep game math testable without a browser or Phaser runtime
- `@/APPLICATION_SPEC.md` is the source of truth for game design requirements
- `@/CURRENT-PROGRESS.md` tracks what has been implemented vs. what remains
- `@/RESEARCH-NOTES.md` captures technology decisions and design rationale

### Core Implementation
- **Build tooling**: Vite dev server on port 8080, Vite build targeting ES2020, Phaser chunked separately via Rollup `manualChunks` for cache efficiency
- **Testing**: Vitest with Node environment -- systems are pure functions that do not require a DOM or Phaser
- **Phaser config**: 1024x768 canvas, Arcade physics with zero gravity (top-down game), auto-renderer selection
- **Controls**: WASD movement, mouse aim, left-click shoot, right-click use items, Q/E weapon switch (movement and aiming implemented; shooting/items/weapons not yet)
- **Level generation**: a seeded procedural level generator (`@/src/systems/level.js`) produces multiple connected rooms with doorways. `GameScene` renders and wires physics for the entire level at startup

### Things to Know
- The project uses Phaser 3 (~3.90.x) deliberately over Phaser 4, because Phaser 4's BitmapMask API changed with incomplete docs -- and the flashlight system is the core visual mechanic (see `@/RESEARCH-NOTES.md`)
- Systems in `@/src/systems/` are designed as pure functions with no Phaser dependency, so they can be tested with `vitest run` in a Node environment
- The `vite.config.js` test environment is set to `node`, not `jsdom`, because the testable code has no DOM dependencies
- `package.json` uses `"type": "module"` -- all imports use ES module syntax throughout
- All procedural generation (level layout, furniture placement) uses a shared seeded PRNG (`@/src/systems/random.js`) so levels are deterministic for a given seed

Created and maintained by Nori.
