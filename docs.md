# Noridoc: Backrooms (Project Root)

Path: @/

### Overview
- Survival horror top-down 2D twin-stick shooter built with Phaser 3, Vite, and plain JavaScript
- Based on the "Backrooms" creepypasta: player explores pitch-black rooms using only a flashlight, collects treasure, fights zombies, and must return to the exit before the battery dies
- Implements a Motherload-inspired roguelike loop: explore rooms, collect treasure, exit (or die), spend gold on upgrades in the shop, re-enter with stronger stats

### How it fits into the larger codebase
- `@/index.html` is the single HTML entry point, loading `@/src/main.js` as an ES module
- `@/src/main.js` creates the Phaser.Game instance and registers both scenes (GameScene and ShopScene)
- Game logic is split between pure systems (`@/src/systems/`) and Phaser scene classes (`@/src/scenes/`) to keep game math testable without a browser or Phaser runtime
- Persistent cross-run state (gold balance, upgrade levels, run counter) lives in Phaser's `game.registry`, which survives scene transitions
- `@/APPLICATION_SPEC.md` is the source of truth for game design requirements
- `@/CURRENT-PROGRESS.md` tracks what has been implemented vs. what remains
- `@/RESEARCH-NOTES.md` captures technology decisions and design rationale

### Core Implementation
- **Build tooling**: Vite dev server on port 8080, Vite build targeting ES2020, Phaser chunked separately via Rollup `manualChunks` for cache efficiency
- **Testing**: Vitest with Node environment -- systems are pure functions that do not require a DOM or Phaser
- **Phaser config**: 1024x768 canvas, Arcade physics with zero gravity (top-down game), auto-renderer selection
- **Controls**: WASD movement, mouse aim, left-click shoot, right-click use battery item, E key to interact with nearby doors, light switches, or hideable furniture (nearest one wins by distance). WASD or E exits hiding. Q/E weapon switch is spec'd but not yet implemented (E is currently used for interactable toggling)
- **Game loop**: the game alternates between two scenes. `GameScene` is the gameplay scene where the player explores, fights, and collects treasure. On exit or death, the game transitions to `ShopScene` where the player spends accumulated gold on upgrades (battery capacity, flashlight width, max health, movement speed). Clicking "Enter Backrooms" transitions back to `GameScene` with upgraded stats. Death forfeits all treasure earned that run; exiting keeps it
- **Level generation**: a seeded procedural level generator (`@/src/systems/level.js`) produces multiple connected rooms with doorways. The seed increments each run via a `runCount` stored in `game.registry`, so each run produces a different layout. `GameScene` renders and wires physics for the entire level at startup
- **Closable doors**: approximately half of room connections (seeded random, 50% chance) have closable doors managed by `@/src/systems/doors.js`. Closable doors start closed, blocking movement (physics colliders), flashlight rays (wall segments), and enemy line-of-sight. The player can toggle them with the E key when within range. Opening a door removes its segment from the `wallSegments` array; closing it re-adds the segment -- following the same mutable array pattern as furniture
- **Light switches**: ~40% of non-starting rooms get a light switch placed on a random wall, managed by `@/src/systems/lightswitch.js`. The player toggles switches with the E key (same as doors -- nearest interactable wins by Euclidean distance). Turning a switch on reveals the entire room by drawing a white rectangle into the BitmapMask (same system the flashlight uses), despawns all enemies currently in that room, and freezes any enemies that later wander in. Switches use a seeded PRNG with offset +40000
- **Enemy system**: zombie enemies spawn in every room except the starting room, using a pure-function AI state machine (`@/src/systems/enemy.js`) with idle/chase/search states. Enemies detect the player via line-of-sight raycasting against the same wall segment array used by the flashlight system. Detection is suppressed when the player is hiding (via the `playerHidden` parameter on `updateEnemyAI()`)
- **Hiding mechanics**: the player can hide inside `canHide` furniture (tables and desks) by pressing E when near them, managed by `@/src/systems/hiding.js`. While hidden: movement, shooting, and battery use are disabled; the player is invisible to enemy line-of-sight detection and immune to contact damage; the player graphic renders semi-transparent. The player exits by pressing any WASD key or E. Hiding adds strategic depth by creating safe spots within enemy-occupied rooms
- **Combat loop**: enemies damage the player on contact (with invulnerability cooldown), player shoots bullets toward the mouse cursor to kill enemies. Player death triggers scene restart. All combat/shooting math lives in pure-function systems (`@/src/systems/combat.js`, `@/src/systems/shooting.js`), with Phaser wiring in `GameScene`
- **Survival loop**: the flashlight battery drains over 90 seconds, progressively narrowing the flashlight cone from 100% to 25% of its base angle. Below 25% charge, the flashlight flickers. At 0%, the flashlight goes completely dark. The player can collect battery items and use them (right-click) to recharge the flashlight by 30 charge. The player must reach the exit zone (in room 0) before the battery dies. Reaching the exit transitions to the shop with all treasure earned. Battery math lives in `@/src/systems/battery.js`, following the same pure-function immutable-state pattern as combat and shooting
- **Items and inventory**: collectible items (batteries, coins, gems) spawn in every room except the starting room via a seeded PRNG. Items are auto-collected on player overlap. Battery items are stored in inventory and consumed with right-click to recharge the flashlight. Treasure items (coins, gems) accumulate a value total that converts to gold in the shop. Item spawning lives in `@/src/systems/items.js`, inventory state management in `@/src/systems/inventory.js`, both following the pure-function pattern
- **Shop and upgrades**: between runs, the player visits a shop (`@/src/scenes/ShopScene.js`) where treasure earned converts to gold. Gold can be spent on upgrades across four categories with three tiers each (costs: 100/300/800). Upgrade definitions, pricing, and purchase logic live in the pure-function module `@/src/systems/shop.js`. Shop state persists in `game.registry` across scene transitions

### Things to Know
- The project uses Phaser 3 (~3.90.x) deliberately over Phaser 4, because Phaser 4's BitmapMask API changed with incomplete docs -- and the flashlight system is the core visual mechanic (see `@/RESEARCH-NOTES.md`)
- Systems in `@/src/systems/` are designed as pure functions with no Phaser dependency, so they can be tested with `vitest run` in a Node environment
- The `vite.config.js` test environment is set to `node`, not `jsdom`, because the testable code has no DOM dependencies
- `package.json` uses `"type": "module"` -- all imports use ES module syntax throughout
- All procedural generation (level layout, furniture placement, enemy spawning, item placement, door closability, light switch placement) uses a shared seeded PRNG (`@/src/systems/random.js`) so levels are deterministic for a given seed. Each system uses a different seed offset to avoid correlation: furniture uses +0, enemies use +10000, items use +20000, doors use +30000, light switches use +40000. The seed changes each run via an incrementing `runCount` stored in `game.registry`. The hiding system (`@/src/systems/hiding.js`) does not use a seeded PRNG -- it operates on furniture objects already placed by the furniture system

Created and maintained by Nori.
