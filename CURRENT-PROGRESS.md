# Current Progress

## Status: Character & Enemy Pixel Art Animations

Added pixel art animations for player and all enemy types (basic, crawler, spitter), replacing the Graphics-drawn player circle and generateTexture() enemy circles with animated pixel art sprites. Key changes: (1) New `CHARACTER_PALETTES` in `sprites.js` with per-entity-type color palettes (green tones for player, red for basic enemy, purple for crawler, blue for spitter). (2) 16 new `SPRITE_DEFS` entries for animation frames: `player_idle_0/1`, `player_walk_0/1`, `enemy_idle_0`, `enemy_walk_0/1`, `crawler_idle_0`, `crawler_walk_0/1`, `spitter_idle_0/1`, `spitter_walk_0/1`, `spitter_attack_0`. Player/basic/spitter sprites are 20x20px, crawler sprites are 14x14px (matching existing body sizes). (3) New `ANIM_DEFS` export: pure-data animation configuration mapping animation keys to frame lists, frame rates, and repeat settings. 9 animations total (idle + walk for each type, plus spitter_attack). (4) Three new helper functions: `getEnemyTextureKey(type)` returns initial texture for enemy type, `getAnimKeyForState(entityType, aiState)` maps AI state to animation key, `getAllAnimKeys()` returns all animation keys. (5) Player changed from invisible physics sprite + Graphics overlay to visible animated sprite — `createPlayer()` creates sprite with 'player_idle_0' texture and plays 'player_idle' animation. `drawPlayer()` replaced from Graphics clear/redraw to `setRotation()` + `setTint()`/`setAlpha()`/`clearTint()` for visual states (hiding=0x336633 alpha 0.3, hurt=0xcc4444 alpha 0.5, normal=no tint alpha 1) + velocity-based animation switching (player_walk when moving, player_idle when still). (6) Removed `createEnemyTextures()` method entirely — enemy textures come from centralized `sprites.js` via `getEnemyTextureKey()`. `getEnemyStats()` uses helper function. (7) Enemies play idle animation on creation in both `createEnemies()` and `spawnDangerWave()`. (8) `updateEnemies()` now sets rotation from velocity (`Math.atan2(vy, vx)`) and switches animation state via `getAnimKeyForState(type, state)` with `play(key, true)` to prevent frame restarts. (9) `onBulletHitEnemy()` calls `enemySprite.stop()` before corpse visuals to freeze animation on death frame. (10) `generateSpriteTextures()` now also creates Phaser animations from `ANIM_DEFS` via `anims.create()`. 17 new behavioral tests (character sprite coverage, dimension contracts, animation definition integrity, helper function behavior). 575 tests passing.

## Previous: Pixel Art Sprite System

Replaced all simple colored rectangles with detailed pixel art sprites for furniture, items, weapons, bullets, doors, switches, and lore notes. Key changes: (1) New pure data module `sprites.js` with `SPRITE_DEFS` containing 25 pixel art definitions using Phaser's `textures.generate()` data array format — each entry has `data` (array of character strings), `palette` (character-to-hex-color mapping), and `pixelWidth`/`pixelHeight` scaling multipliers. Shared `PALETTES` constant defines 8 color themes (wood, metal, items, weapons, bullets, door, switchPl, lore). Furniture sprites use `pixelWidth=5` to scale small data arrays (e.g., 16x10 → 80x50 for table). Items/bullets use `pixelWidth=1`. (2) `pixelArt: true` added to Phaser game config in `main.js` for global nearest-neighbor rendering. (3) New `generateSpriteTextures()` method in GameScene called at the start of `create()` — iterates all SPRITE_DEFS and calls `this.textures.generate()` once per key, before any creation methods that reference textures. (4) Furniture rendering converted from Graphics `fillRect()` to Phaser sprites with `setDisplaySize()` for dimension matching. Falls back to Graphics for location-specific types (counter, couch) without sprite definitions. (5) Doors converted from per-frame Graphics clear/redraw to static sprites stored in `this.doorSprites` Map — `drawDoors()` now just toggles visibility. (6) Switches converted from per-frame Graphics to static sprites stored in `this.switchSprites` Map — `drawSwitches()` now swaps textures (`switch_on`/`switch_off`). (7) Removed inline texture generation from `createItemTextures()`, `createBullets()`, `createEnemyBullets()`, `createWeaponPickups()`, and `createLoreItems()` — all textures pre-generated centrally. Player and enemy sprites unchanged (those are the next commit — pixel art animations). 10 new tests validating sprite coverage and dimension contracts. 558 tests passing.

## Previous: Additional Room Types (Corridor, Storage, Cubicles)

Added 3 new room type archetypes to `maze.js`, expanding internal room variety from 3 types to 6. Key changes: (1) `getRoomType(seed)` now distributes across 6 types: open (20%), maze (15%), columns (15%), corridor (20%), storage (15%), cubicles (15%). (2) New `corridor` type uses a parameterized recursive division with deeper recursion (`maxDepth=4`), smaller minimum size (120px vs 200px), and narrower gaps (60px vs 80px) creating winding passage layouts that evoke the classic Backrooms yellow hallway aesthetic. (3) New `storage` type uses rejection-sampling placement of 6-10 rectangular crates from 3 size classes (40x40, 60x40, 80x60) with 50px minimum gap between crates and `wallThickness+40` margin from walls. Each crate produces 4 wall segments (same pattern as columns). AABB overlap detection prevents crate intersection. (4) New `cubicles` type divides the room into a 150px grid and stamps U-shaped partition templates (3 walls with one open side, 120px wall length) per cell. 30% of cells are randomly left empty for navigability. Open side direction is randomized per cell. (5) Refactored the duplicated `subdivide()`/`subdivideCorridor()` into a single `subdivideGeneric(bounds, segments, rand, doorZones, depth, maxDepth, minSize, gapWidth)` function. (6) All new types reuse existing `segmentCrossesDoorZone()` filtering and produce axis-aligned `{x1,y1,x2,y2}` segments compatible with the raycasting/physics systems. No GameScene changes — the module's external interface is unchanged. 15 new tests (5 corridor, 5 storage, 5 cubicles). 547 tests passing.

## Previous: Crawler Door-Opening

Crawlers can now open closed doors when chasing the player, creating asymmetric threat — doors remain a valid defense against basic zombies and spitters but not crawlers. Key changes: (1) New `buildFullRoomGraph(rooms, doorStates)` in `pathfinding.js` builds a room adjacency graph that includes edges through closed doors (unlike `buildRoomGraph` which excludes them), with `closedDoorId` annotations on each edge. New `getClosedDoorOnPath()` detects if the next BFS step toward the player crosses a closed door, returning `{ doorId, center }` or null. (2) New `opening_door` state in the enemy FSM (`enemy.js`) — when a crawler in chase state reaches a closed door within `CRAWLER_DOOR_INTERACT_RANGE` (60px), it stops, counts down `doorOpenTimer` (1000ms = `DOOR_OPEN_TIME`), then sets `wantsToOpenDoor: true` and `targetDoorId` on the return object (same signal pattern as spitter's `wantsToFire`). If the crawler gains LOS to the player mid-timer (e.g., player opened the door), it transitions directly to chase. Only crawlers can enter `opening_door` — basic and spitter enemies are unaffected. (3) GameScene integration: builds two room graphs (`roomGraph` for basic/spitter, `fullRoomGraph` for crawlers) on the same dirty flag, runs separate BFS per graph type, computes `closedDoorOnPath` for crawlers in navContext, handles `wantsToOpenDoor` signal by calling `onToggleDoor()` with a `door.isClosed` guard to prevent double-toggle. New enemy state fields `doorOpenTimer` and `targetDoorId` copied from AI result. 13 new tests (4 pathfinding, 9 enemy AI). 532 tests passing.

## Previous: Procedural Audio System

Full procedural audio/sound effects system using Web Audio API — no audio file assets needed. Key changes: (1) New pure config module `audio.js` with `SOUND_CONFIGS` (24 sound definitions covering gunshots, noise bursts, chimes, tones, sweeps, growls, door sounds, and filtered noise), `AMBIENT_SOUND_TYPES` (distant_bang, drip, whisper), and behavioral functions `getFootstepInterval(speed)`, `getAmbientSoundDelay(time)`, `getSoundConfig(key)`. (2) New synthesis engine `audioEngine.js` with `generateAllSounds(audioContext, cache)` (pre-renders all sounds via OfflineAudioContext and injects AudioBuffers into Phaser's cache), `createAmbientDrone(audioContext, destination)` (live oscillator nodes: 120Hz + 120.5Hz sawtooth beat, 60Hz sine sub, 0.3Hz LFO), and `playAmbientSound(soundManager, time)` (randomly selects ambient one-shot). (3) GameScene integration: `createSounds()` handles browser autoplay policy (`sound.locked`), `playSound(key)` wraps `sound.play()` with `audioReady` guard. Sound triggers on all game events — weapon fire (`${weapon.id}_fire`), bullet_hit, enemy_death, player_damage, player_death, item_pickup, lore_pickup, ammo_pickup, battery_recharge, door_open/close, switch_click, hide_enter/exit, stair_transition, day_complete, weapon_switch. Update loop adds footstep timer (driven by player velocity via `getFootstepInterval`) and battery warning beep every 3s when battery ≤ 25%. Ambient drone starts on audio init, ambient one-shots scheduled on a recursive timer. (4) ShopScene integration: same `initAudio()`/`playSound()` pattern, shop_purchase on successful buy, shop_denied on failed buy, shop_click on all button interactions (journal, location cycle, enter, close, pagination). 11 new behavioral tests for audio config functions. 519 tests passing.

## Previous: Time-Based Enemy Difficulty Escalation

Enemies now spawn dynamically as the player spends time in unsafe rooms, creating escalating danger pressure. Key changes: (1) New pure function module `danger.js` tracks cumulative time in unsafe rooms (not room 0, not lit rooms). Timer pauses in safe rooms but does NOT reset — prevents cycling exploit. (2) Every 30 seconds of unsafe time (`DANGER_WAVE_INTERVAL = 30000`), a wave of enemies spawns in a valid nearby room (not room 0, not lit, not the player's current room, same floor). (3) Wave composition shifts toward harder enemy types as waves progress: waves 0-1 spawn only basic zombies, waves 2-3 add crawlers, waves 4-5 use crawlers and spitters, waves 6-7 mix all types. (4) Wave enemy count increases with wave number: `1 + floor(waveCount / 3)`, capped at 4. (5) Maximum 8 waves per run (`MAX_DANGER_WAVES = 8`) — 240 seconds of unsafe time to see all waves. (6) `getSpawnRoom()` filters candidate rooms by floor, excludes safe rooms and player's current room; returns null if no valid room exists (wave is silently skipped). (7) GameScene integration: `dangerState` initialized in `init()`, updated each frame in `updateEnemies()`, `spawnDangerWave()` creates enemy sprites via existing `enemyGroup.create()` — group colliders auto-cover new members, no new colliders needed. (8) HUD shows red "DANGER N" indicator when waves have spawned. New module `danger.js`, 29 new tests covering timing, wave thresholds, composition, room selection, and full session simulation. 508 tests passing.

## Previous: Enemy Corpse Persistence + Lit Room Enemy Behavior

Two related enemy lifecycle changes: (1) Dead enemies now persist as visible corpses — `onBulletHitEnemy` keeps the sprite visible with gray tint (0x666666), faded alpha (0.6), toppled angle (90°), and low depth (5, below living enemies at 60). Sprite gets `setActive(false)` and `body.enable = false` so it's excluded from physics/collision checks — player and bullets pass through corpses. Enemy state is still removed from `enemyStates` array so no AI updates occur. New constants `CORPSE_TINT`, `CORPSE_ALPHA`, `CORPSE_ANGLE`, `CORPSE_DEPTH` exported from `combat.js`. (2) Enemies no longer automatically despawn when a light switch is turned on — `onToggleSwitch` was simplified from 20 lines to a single `toggleSwitch()` call with no enemy interaction. The existing freeze behavior in `updateEnemies()` (velocity zeroed, AI skipped via `continue`) is now the sole mechanism for handling enemies in lit rooms. Enemies remain alive and visible in lit rooms but frozen in place; if the switch is toggled off, they resume AI. No new modules, no save format changes, no new tests (feature is GameScene wiring changes only — existing tests for `isEnemyDead`, `applyEnemyDamage`, `isPointInRoom`, and `updateEnemyAI` cover the underlying behavioral contracts). 479 tests passing.

## Previous: New Hiding Furniture Types + Scroll Wheel Weapon Switching

Added 4 new hideable furniture types from the APPLICATION_SPEC and scroll wheel weapon switching. Key changes: (1) Four new entries in `FURNITURE_TYPES` in `furniture.js`: `bed` (90x60, canHide: true, blocksLight: false — large hiding area, hide under), `armoire` (40x70, canHide: true, blocksLight: true — tall wardrobe, hide inside, blocks light/LOS), `closet` (50x60, canHide: true, blocksLight: true — tall enclosed space, hide inside, blocks light/LOS), `vent` (30x30, canHide: true, blocksLight: false — small floor grate, crawl inside, constrained movement area). (2) Armoire and closet introduce a new gameplay dynamic: furniture that is both a hiding spot AND blocks light/LOS — previously these properties were mutually exclusive. This creates double-safe hiding spots where the player is invisible AND enemies can't see through the furniture. (3) `TYPE_KEYS` auto-updates from `Object.keys(FURNITURE_TYPES)` — type distribution changes from 4 types (25% each) to 8 types (12.5% each), increasing room variety. (4) Scroll wheel weapon switching via `this.input.on('wheel', ...)` in `setupInput()` with 200ms cooldown — reuses existing `switchWeapon()` from `weapons.js`, same guards as other input (dead/dayEnding/hiding). No new modules, no new exports, no save format changes. 6 new tests covering light blocking behavior, generation distribution, hideable integration, and blocksLight properties.

## Previous: Balance Tuning — Making the Player Feel More Lost

Rebalanced the game to create a more disorienting, lost-feeling experience. Key changes: (1) Flashlight FOV narrowed from PI/4 (45°) to PI/6 (30°) base angle — players see less at any given moment, creating tunnel vision and claustrophobia. (2) Battery duration extended from 90s to 150s — players explore longer, venture deeper, and have more time to get lost. (3) Items per room reduced from 2-5 to 1-3, and loot table reweighted to favor utility items (battery 25, ammo 20) over treasures (copper 30, silver 15, gold 8, gem 2) — treasure drops from ~76% to ~55% of all items. (4) Shop costs increased across the board: standard upgrades from [100, 300, 800] to [200, 600, 1500], starting pistol from 500 to 1000, minimap from 1500 to 3000. Combined effect: thinner FOV + longer battery = more rooms explored with less visibility; fewer treasures + higher costs = slower progression where each find matters more. No new modules or functions. No save migration needed (costs are not persisted; stats are recomputed from upgrade levels). Updated tests for new item count bounds, shop cost assertions, flashlight base value, and battery drain duration.

## Previous: Cross-Room Enemy Movement

Enemies can now navigate between rooms through open doorways to chase the player. Key changes: (1) New pure function module `pathfinding.js` with BFS-based room graph pathfinding — `buildRoomGraph()` creates adjacency list from room doors (excluding closed doors), `bfsFromRoom()` runs BFS from player room, `getNextDoorway()` finds the next doorway on the path toward the player, `getDoorwayCenter()` computes world position of doorway centers, `getRoomDistance()` returns BFS hop count. (2) `updateEnemyAI()` in `enemy.js` gains optional 7th parameter `navContext` — in chase state, enemies in different rooms navigate to doorways instead of transitioning to search; in idle state, enemies probabilistically seek doorways for room transitions. (3) GameScene builds and caches room graph (invalidated on door toggle via `roomGraphDirty` flag), runs BFS from player room each frame, tracks per-enemy room state (`spawnRoomId`, `currentRoomId`, `roomTransitionCooldown`, `targetDoorway`), computes per-room enemy density, and constructs navContext per enemy. (4) Constraints: 10s cooldown between room transitions, max 2 rooms from spawn (leash), max 4 enemies per room during idle wander. (5) Closed doors block pathfinding — closing a door is a valid defensive strategy. (6) Fixed 6 pre-existing test failures (shop prices, item count range, battery drain timing, flashlight angle). 25 new tests: 18 for pathfinding, 7 for navContext-driven enemy AI.

## Previous: Lore Journal Overlay

Players can now review collected lore notes between runs via a paginated journal overlay in ShopScene. Key changes: (1) Two new pure functions in `lore.js`: `getJournalEntries(collectedLoreIds)` maps all 20 lore entries to `{id, text, collected}` objects with collected/total counts, and `getJournalPage(entries, page, perPage)` handles pagination with page clamping. (2) ShopScene gains a "[ NOTES X/20 ]" button at top-right (900, 90) that opens the journal. (3) `showJournal()` creates a full-screen overlay (depth 2000-2001) with 5 entries per page — collected notes show quoted text in white/gray, uncollected show "???" in dim gray. Prev/Next buttons navigate pages, Close button and ESC key dismiss. (4) `hideJournal()` destroys all overlay objects and removes ESC handler. (5) Fixed pre-existing TDZ bug in `maze.js` where `const doorZones` was declared after the `columns` branch that used it, causing a crash on column-type rooms. 9 new tests: 5 for `getJournalEntries` (uncollected, some collected, all collected, ID ordering, entry count) and 4 for `getJournalPage` (first page, last page partial, total page count, page clamping).

## Previous: Alternate Exit Locations

Players can now discover alternate exit portals on deeper floors that permanently unlock new starting locations. Key changes: (1) New pure function module `locations.js` defines 5 starting locations (furniture store, office building, parking garage, hotel lobby, laundromat), each with unique floor/wall colors and hand-crafted furniture layouts. (2) `generateAlternateExit(rooms, stairs, seed, unlockedIds)` spawns a rare (~20% chance) glowing blue-white exit zone on floors 1+, avoiding stair rooms and only spawning when unlockable locations remain. Uses seed offset +100000. (3) Room 0 rendering (colors, furniture, exit position) is now fully data-driven via `getLocation()`, `getLocationLayout()`, and `getLocationExitPosition()` instead of hardcoded STORE constants. (4) `GameScene.onAlternateExitComplete()` unlocks the new location, sets it as active, and transitions to ShopScene with `newLocation` data. (5) ShopScene gains a location selector — when multiple locations are unlocked, `<` and `>` arrows let the player cycle through them. A "New location discovered!" message appears when arriving via an alternate exit. (6) Persistence bumped from v2 to v3 with `unlockedLocations` (array, default `['store']`) and `activeLocation` (string, default `'store'`) fields — backward compatible with v1/v2 saves. (7) `main.js` loads location data into registry on boot; all `saveGame()` calls across GameScene, ShopScene, and main.js pass location data. 21 new tests: 18 for locations (data, layouts, exit spawning), 3 for persistence round-trip with location fields.

## Previous: Run-Scaling Floor Counts

Floor count now increases with run progression, giving experienced players more content and risk. Key changes: (1) New pure function `getFloorRoomCounts(runCount)` in `stairs.js` returns the floor array: run 0-1 = `[4, 3]` (2 floors, 7 rooms), run 2-3 = `[4, 3, 3]` (3 floors, 10 rooms), run 4+ = `[4, 3, 3, 2]` (4 floors, 12 rooms). (2) `createStairConnections()` generalized from hardcoded floor 0-to-1 to N adjacent floor pairs — iterates floor pairs and creates up to 2 stair connections per pair. (3) Each stair object now has `fromFloor` and `toFloor` fields. (4) GameScene uses `getFloorRoomCounts(this.runCount)` instead of static `FLOOR_ROOM_COUNTS` constant. (5) `createStairs()` reads `stair.fromFloor`/`stair.toFloor` for destination floor and visual direction instead of hardcoded values. 17 new tests covering floor count progression, 3-floor and 4-floor generation, and generalized stair connections.

## Previous: Lore Items in Rooms

Collectible lore notes now spawn in rooms. ~25% of non-room-0 rooms contain a lore note (max 1 per room). Key changes: (1) New pure function module `lore.js` with 20 Backrooms-themed lore entries and `generateRoomLore()` spawning function (seed offset +90000, same placement pattern as `items.js`). (2) Lore items do NOT consume inventory space — they are meta-progression collectibles. (3) On pickup, a tween-animated text popup appears at the bottom of the screen (dark semi-transparent background, monospace text) and auto-dismisses after 5 seconds with fade-out. (4) Collected lore IDs are persisted across runs via `persistence.js` — save format bumped from v1 to v2 with new `collectedLore` field (backward compatible: v1 saves default to `[]`). (5) Already-collected notes don't respawn. (6) GameScene creates a separate `loreGroup` physics static group with its own overlap handler. (7) Lore textures are small paper/note shapes (off-white, 12x10px with line details) at depth 5 (hidden by darkness). 12 new tests: 9 for lore spawning behavior, 3 for persistence round-trip.

## Previous: Starting Location Entry Consistency & Shop Positioning

Room 0 now has a consistent layout: (1) The crack to the backrooms is always on the east wall — `generateLevel()` forces `DIRECTIONS[1]` (east) for the first room connection (`i === 1`), consuming the PRNG roll but discarding it to preserve sequence for subsequent rooms. (2) The exit zone (front entrance) moved from center-north to west-center of room 0 (`x: room.x + wallThickness + 40, y: room.y + room.height / 2`) — representing the furniture store's front door, ~544px from player spawn at center. (3) The shop counter moved from far-left (`relX: 0.08`) to center-left (`relX: 0.35, relY: 0.42`) — centered within the store without overlapping the 60x60 spawn exclusion zone. (4) Bookcases moved from `relX: 0.75` to `relX: 0.62` to avoid blocking the now-guaranteed east doorway. 7 new tests covering east direction consistency, exit positioning, and furniture layout.

## Previous: Movement While Hidden

Player can now move at half speed while hidden under furniture (tables/desks), constrained to the furniture bounds. Key changes: (1) `HIDING_SPEED_MULTIPLIER = 0.5` constant in `hiding.js`. (2) `onEnterHiding(furniture)` method in GameScene snaps player to furniture center, sets `body.setBoundsRectangle()` to furniture area, enables `setCollideWorldBounds(true)`, disables player-furniture collider. (3) `onExitHiding()` restores collider and removes bounds constraint. (4) WASD no longer exits hiding -- E key is the only exit. (5) Player-furniture collider stored as `this.playerFurnitureCollider` for toggling.

## Previous: Minimap Shop Upgrade + Reduced Light Switches

Minimap is now a shop upgrade (not available by default). Players must purchase the "Minimap" upgrade for 1500 gold before explored rooms appear on the map. Key changes: (1) New `minimap` entry in UPGRADES array — single tier, 1500 gold, follows `startingPistol` binary-unlock pattern. (2) `GameScene.init()` reads `levels.minimap` to set `this.hasMinimap` flag. (3) Minimap Graphics and floor text only created in `createHUD()` when `this.hasMinimap` is true. (4) `drawMinimap()` early-returns when minimap not purchased. (5) Exploration state still tracked unconditionally (for future features). (6) Light switch frequency reduced from 40% to 15% — most rooms no longer have switches, creating darker/scarier runs.

## Previous: Weaponless Start + Ammo System

Player no longer starts with a gun — must find weapons in the backrooms. All weapons now have per-weapon ammo that depletes on firing. Key changes: (1) `createWeaponState()` starts with empty slots by default; `pickupWeapon()` fills the first empty slot. (2) Per-weapon ammo tracking via `ammo` array parallel to `slots` — pistol (max 50, start 15), shotgun (max 20, start 6), rifle (max 15, start 4). Shotgun consumes 1 ammo per trigger pull regardless of pellets. (3) New `ammo` item type spawns in rooms (weight 12, ~11% chance) and restores current weapon's ammo (pistol +10, shotgun +4, rifle +3). (4) "Starting Pistol" shop upgrade (single tier, 500 gold) gives the player a pistol at run start. (5) `generateLevelWeapons()` guarantees 1 weapon per floor (all weapon types including pistol can appear as floor drops). (6) HUD shows "UNARMED" when no weapon equipped, or "WEAPON [ammo/max] [Q]" when armed. Firing is disabled when unarmed or out of ammo. Ammo pickups are ignored when unarmed (item stays on ground).

## Previous: Room Variety, Light-Transparent Furniture, More Connections

Added three level design improvements: (1) Maze-like room variety via new `maze.js` module — ~40% of non-starting rooms remain open, ~30% get recursive-division internal walls with passage gaps, ~30% get staggered column grids that create interesting flashlight shadow patterns. (2) Tables and desks no longer block flashlight rays — only tall furniture (shelves, bookcases) blocks light via new `blocksLight` property on `FURNITURE_TYPES`. Physics collision still applies to all furniture. (3) Level connectivity increased — extra doors are probabilistically added between grid-adjacent rooms not already connected (~50% chance), and 2 stair connections now link floors instead of 1 (using distinct rooms).

## Previous: Backpack / Inventory Capacity

Added inventory capacity system. Players now have a limited number of item slots (base 8). When full, items remain on the ground instead of being auto-picked up. Using a battery frees a slot (dual-purpose: flashlight recharge + inventory management). New "Backpack Size" shop upgrade adds +4 capacity per level (8→12→16→20 at max). HUD shows `[itemCount/maxItems]` indicator that turns red when full.

## Previous: Weapon Switching System

Added multi-floor level generation with bidirectional stairs connecting floors. Level now generates 2 floors (4 rooms on floor 0, 3 rooms on floor 1 = 7 total rooms). Floors are separated by 10000px in world-space Y. One stair connection links a non-starting room on floor 0 to a room on floor 1. Stairs are overlap zones that trigger camera fade teleportation (300ms fade out, reposition, 300ms fade in). Minimap shows only the current floor's visited rooms with a "B1"/"B2" floor indicator. Stair visuals: dark rectangles with step lines and pulsing purple glow. Player input/physics frozen during teleport via `isTeleporting` flag.

## Completed
- Application spec written
- Project scaffolding: Phaser 3 + Vite + Vitest
- Player character (green circle with direction indicator) with WASD movement
- Mouse-based aiming (player/flashlight follows mouse cursor)
- Camera follows player with smooth lerp
- Single room with physics walls (player collides with walls)
- 2D raycasting visibility system (rays cast to wall segment endpoints)
- Flashlight cone (90-degree cone clipped from visibility polygon)
- Darkness overlay with BitmapMask (only flashlight area is visible)
- Player rendered above darkness layer (always visible)
- Room furniture/obstacles (tables, shelves, desks, bookcases) that block flashlight rays and provide physics collision
- Seeded PRNG for deterministic furniture placement (4-8 items per room, no overlaps)
- Furniture marked with `canHide` flag for future hiding mechanics
- Multi-room level generation with seeded growth algorithm (6 connected rooms)
- Doorways between rooms (gaps in wall segments that allow light and movement)
- Paired door system (if room A connects to room B, room B connects back)
- Room wall segments support door specifications (split segments with gaps)
- Shared seeded PRNG module (`random.js`) for deterministic level generation
- Camera and physics bounds dynamically computed from all room positions
- Each room gets its own furniture with a unique seed
- Zombie enemies with line-of-sight AI
  - LOS detection reuses `raySegmentIntersection` from visibility system (single ray from enemy to player)
  - Three-state AI: idle (wander randomly), chase (pursue player), search (go to last known position then give up)
  - 1-2 enemies spawn per room (except starting room), placed avoiding furniture with seeded PRNG
  - Enemy physics: dynamic group with wall/furniture/enemy colliders and player overlap detection
  - Enemies render at depth 60 (below darkness at 100) — automatically hidden by flashlight mask
  - Camera shake on player-enemy contact (placeholder for future damage system)
  - `generateTexture` creates red circle sprite for enemies
- Player health/damage system
  - 100 HP, 20 damage per enemy contact, 1 second invulnerability cooldown after hit
  - Camera shake + red flash on damage, player turns red/translucent during invulnerability
  - Death at 0 HP: camera fade to black, scene restart
  - HUD health bar (top-left, always visible above darkness)
- Shooting mechanics
  - Left-click fires yellow projectile bullets toward mouse cursor
  - Bullet speed 500, max range 600px, fire rate 200ms cooldown
  - Bullets collide with walls and furniture (destroyed on impact)
  - Bullets damage enemies (25 per hit, 2 shots to kill)
  - Object pooling via Phaser physics group (max 20 active bullets)
  - Bullets render at depth 150 (visible above darkness layer)
- Enemy health system
  - 50 HP per zombie, killed after 2 bullet hits
  - Dead enemies persist as visible corpses (gray tint, faded alpha, toppled), removed from physics and AI updates
- Flashlight battery drain system
  - 90-second full drain, battery depletes linearly over time
  - Flashlight cone angle scales from 100% to 25% of base as battery drains
  - Below 25% battery: deterministic sine-wave flickering effect
  - At 0% battery: flashlight dies completely (total darkness)
  - HUD battery bar below health bar (yellow > orange > red color transitions)
- Exit zone and day/exit cycle
  - Green exit marker in top-left of room 0 (starting room)
  - Overlap detection triggers day completion (camera fadeout + scene restart)
  - `dayEnding` flag freezes game state during exit transition
- Items and inventory system
  - 5 item types with weighted rarity: battery (15%), copper coin (40%), silver coin (25%), gold coin (15%), gem (5%)
  - Seeded PRNG spawning (seed + 20000 offset) with furniture overlap avoidance
  - 2-5 items per room, no items in room 0 (starting room)
  - Auto-pickup via overlap detection, items destroyed on contact
  - Inventory tracks battery count and treasure value total
  - Right-click uses a stored battery to recharge flashlight by 30%
  - Browser context menu disabled for right-click input
  - HUD shows battery count (yellow) and treasure value (gold) below the bars
  - Items render at depth 5 (hidden by darkness, only visible in flashlight)
  - Item textures generated once per type (rect for coins/batteries, triangle for gems)
- Battery recharge system
  - `rechargeBattery(state, amount)` restores flashlight charge, capped at max
  - Recharging a depleted battery restores functionality (resets isDepleted)
  - BATTERY_RECHARGE_AMOUNT = 30 (restores ~27 seconds of flashlight)
- Shop/upgrade system between runs
  - ShopScene appears after exiting or dying in the backrooms
  - 4 upgrade categories: Battery Capacity, Flashlight Width, Max Health, Movement Speed
  - Each upgrade has 3 tiers priced at 100/300/800 gold (~3x multiplier)
  - Upgrades apply via parameterized state creation: `createCombatState(maxHp)`, `createBatteryState(maxCharge)`
  - GameScene reads upgrade levels from `game.registry` in `init()` method
  - Persistent state: shop state (gold + upgrade levels) and run counter stored in `game.registry`
  - Death penalty: `treasureEarned: 0` passed to ShopScene (lose all treasure from that run)
  - Level seed randomized per run via incrementing run counter
  - Text-based UI with interactive buy buttons and level indicators
- Closable doors on room connections
  - ~50% of door connections (seeded PRNG, seed+30000 offset) have closable doors
  - Doors start closed — player must open them to explore
  - Press E within 80px to toggle open/closed
  - Closed doors block movement (physics), flashlight (wall segments), and enemy LOS
  - Deduplication: one physical door per connection (room.id < targetRoomId)
  - Door graphics rendered at depth 50, interaction prompt at depth 1000
  - Pure function module `doors.js`: createDoorStates, toggleDoor, getClosedDoorSegments, getDoorCenter, findNearestDoor
  - Colliders for player, enemies, and bullets vs door group
- Light switches in rooms
  - ~40% of non-room-0 rooms (seeded PRNG, seed+40000 offset) have a light switch on a random wall
  - Press E within 80px to toggle on/off
  - When ON: entire room illuminated (darkness mask removed via fillRect in BitmapMask)
  - When ON: enemies in the room are frozen in place (velocity zeroed, AI skipped); they remain visible and alive
  - Switch visual: small rectangle on wall (gray when off, yellow when on) at depth 50
  - Pure function module `lightswitch.js`: createSwitchStates, toggleSwitch, findNearestSwitch, getLitRoomIds, isPointInRoom
  - E-key interaction resolves nearest interactable (door vs switch) by Euclidean distance
- Hiding mechanics (interact with canHide furniture to become invisible to enemies)
  - Press E within 80px of a table or desk to hide
  - While hidden: player moves at half speed within furniture bounds, shooting disabled, contact damage immune, semi-transparent (alpha 0.3)
  - Player constrained to furniture area via `body.setBoundsRectangle()` + `setCollideWorldBounds(true)`; player-furniture collider disabled during hiding
  - Enemies cannot detect hidden player (playerHidden flag forces canSee=false in updateEnemyAI)
  - Exit hiding: press E only (WASD moves within furniture, does not exit)
  - Pure function module `hiding.js`: createHidingState, enterHiding, exitHiding, findNearestHideable, HIDING_SPEED_MULTIPLIER
  - GameScene methods `onEnterHiding(furniture)` / `onExitHiding()` manage physics constraints
  - E-key interaction resolves nearest of three interactable types (door, switch, furniture) via distance-sorted candidates
- localStorage persistence for cross-session save/load
  - Pure function module `persistence.js`: saveGame, loadGame, clearSave
  - Versioned save format (`{ version: 1, shopState, runCount }`) under key `backrooms_save`
  - Save triggers: every registry mutation in ShopScene (3 points) and GameScene (1 point), plus `visibilitychange`/`beforeunload` lifecycle listeners in main.js
  - Load on boot: main.js loads saved state into game.registry before scenes start
  - Graceful degradation: all localStorage access wrapped in try-catch (handles private browsing, quota exceeded)
  - 11 unit tests covering round-trip, corruption, version validation, shape validation, missing field defaults, and unavailable storage
- Fog-of-war minimap (exploration tracking)
  - Pure function module `exploration.js`: createExplorationState, getCurrentRoom, updateExploration, getMinimapData
  - Reuses `isPointInRoom` from `lightswitch.js` for room detection (point-in-AABB)
  - Top-right HUD overlay using Graphics with `setScrollFactor(0)` at depth 1000
  - Visited rooms shown as dark gray rectangles, current room brighter (light gray)
  - Green player dot and green exit marker always visible
  - Fog of war by omission: only visited rooms are drawn
  - Exploration state resets each run — no persistence needed
  - Minimap coordinates computed from levelBounds with scale fitting into 160x130px area
  - 18 unit tests covering state creation, room detection, state accumulation, reference identity optimization, minimap data computation, screen width repositioning, and negative-coordinate rooms
- Furniture store starting room (room 0)
  - Pure function module `startroom.js`: generateStoreLayout, generateCrackPoints, getExitPosition, STORE_FLOOR_COLOR, STORE_WALL_COLOR
  - Room 0 rendered with warm wood-tone colors (floor 0x5C4A3A, walls 0x7A6B5A) instead of default cold gray
  - Hand-crafted store furniture layout (counter, display shelves, couches, coffee tables, desks, bookcases, potted plants) instead of random generation
  - Room 0 permanently lit — added to lit room list unconditionally in both `updateDarkness()` and `updateEnemies()`
  - Crack in the wall visual at the first doorway from room 0 — jagged line drawn with Graphics path API, with a secondary thinner parallel line
  - Pulsing sickly-yellow glow behind the crack (0xD4C073, sine-wave alpha 0.15-0.25) updated per frame
  - Crack supports both vertical walls (east/west) and horizontal walls (north/south) — `generateCrackPoints` takes a `vertical` parameter
  - Exit zone positioned at west-center of room 0 (front entrance of furniture store)
  - 12 unit tests covering store layout bounds, spawn zone avoidance, determinism, crack point generation for both orientations, and exit position
- Enemy scaling per run
  - Pure function module `scaling.js`: getEnemyHP, getEnemyCount, getEnemyChaseSpeed, getEnemyDamage
  - Enemy HP scales at +25% per run, hard cap at 3x base (150 HP max)
  - Extra enemies per room: +1 every 2 runs, cap at +3 (max 5 per room)
  - Chase speed scales at +5% per run, cap at +30% (run 6+)
  - Contact damage scales +5 per run, cap at +20 (40 max)
  - All scaling values precomputed in GameScene `init()` as instance properties
  - 14 unit tests covering base values, scaling progression, and hard caps
- Weapon upgrade categories
  - Weapon Damage: base 25, +10/level, 3 tiers (25→35→45→55) — one-shots base enemies at max
  - Fire Rate: base 200ms, -30ms/level, 3 tiers (200→170→140→110ms) — 9.1 shots/sec at max
  - Bullet Range: base 600px, +100/level, 3 tiers (600→700→800→900px)
  - Same [100, 300, 800] pricing as existing upgrades
  - GameScene uses `this.bulletDamage`, `this.fireRate`, `this.bulletRange` instead of hardcoded constants
  - Upgrade level fallback uses `createShopState().upgrades` spread for save compatibility
  - ShopScene layout compacted (row height 80→60px) to fit 7 upgrades in 768px canvas
- Multiple enemy types (crawler and spitter alongside basic zombie)
  - Crawler: fast melee (112 chase, 50 wander speed), low HP (30), lower contact damage (15), smaller purple circle (14px)
  - Spitter: ranged (60 chase, 20 wander speed), moderate HP (40), low contact damage (10), fires projectiles at player
  - Spitter AI adds `attack` state: stops at 250px range, fires after cooldown (300ms telegraph, 2000ms between shots)
  - Enemy projectile system: separate `enemyBulletGroup` with pooling (maxSize 30), red texture, 200px/s speed, 400px range, 15 damage
  - Projectiles collide with walls, furniture, and doors; overlap with player triggers damage
  - Run-gated type distribution: run 0 = basic only, run 1 = 80/20 basic/crawler, run 2+ = 50/25/25 basic/crawler/spitter
  - `getEnemyType(rand, runCount)` pure function for type assignment in `enemy.js`
  - Per-enemy `contactDamage` stored on enemy state, looked up in `onEnemyContact(player, enemySprite)`
  - Type-specific scaled chase speeds computed in `init()` via `getEnemyChaseSpeed()` with per-type base values
  - Per-type HP constants: `CRAWLER_MAX_HP=30`, `SPITTER_MAX_HP=40` in `combat.js`
  - Per-type contact damage: `CRAWLER_CONTACT_DAMAGE=15`, `SPITTER_CONTACT_DAMAGE=10` in `combat.js`
  - Projectile constants: `SPITTER_PROJECTILE_SPEED=200`, `SPITTER_PROJECTILE_RANGE=400` in `shooting.js`
  - Animated pixel art sprites: basic=red 20px, crawler=purple 14px, spitter=blue 20px — idle/walk animations driven by AI state via `getAnimKeyForState()`, velocity-based rotation
  - 17 new unit tests covering type assignment, spawn typing, crawler speeds, spitter attack state machine
- Multi-floor level generation with bidirectional stairs
  - Pure function module `stairs.js`: `generateMultiFloorLevel`, `getFloorBounds`, `createStairConnections`
  - Level generates 2 floors: 4 rooms (floor 0) + 3 rooms (floor 1) = 7 total
  - Floors separated by `FLOOR_Y_OFFSET = 10000` in world-space Y — no physics/visibility bleed
  - One stair pair connects a non-room-0 room on floor 0 to a room on floor 1
  - Stair placement uses seeded PRNG (seed offset +50000) for determinism
  - Stairs are overlap zones (same pattern as exit zone) triggering camera fade teleportation
  - 300ms fade out → `body.reset(destX, destY)` → 300ms fade in
  - `isTeleporting` flag freezes player input/physics during transition
  - Stair visuals: dark rectangles with diagonal step lines + pulsing purple glow (depth 1-2)
  - Minimap shows only current floor, uses `getFloorBounds()` for per-floor scaling
  - `getMinimapData()` accepts `floorFilter` parameter to filter rooms by floor
  - Floor indicator ("B1"/"B2") shown below minimap
  - Room objects extended with `floor` field (integer)
  - Room IDs globally unique across floors (floor 1 IDs offset by floor 0 count)
  - 12 new unit tests covering multi-floor generation, stair connections, ID uniqueness, bounds, determinism
  - 2 new exploration tests for floor filtering
- Weapon switching system (Q key to cycle, E key to pick up)
  - Pure function module `weapons.js`: WEAPON_TYPES, createWeaponState, switchWeapon, pickupWeapon, getActiveWeapon, getEffectiveStats, generateRoomWeapon
  - 3 weapon types: Pistol (default, balanced), Shotgun (4 pellets, spread, close range), Rifle (high damage, long range, slow fire rate)
  - 2 weapon slots: pistol always in slot 0, found weapons in slot 1
  - Weapon pickups spawn in rooms via seeded PRNG (seed offset +60000)
  - Pickups integrate with E-key interaction system (distance-sorted candidates alongside doors, switches, furniture)
  - When picking up with full slots: swaps slot 1, drops old weapon on ground
  - `calculateShotgunSpread()` added to shooting.js for multi-pellet spread fire
  - Per-bullet damage and range stored via `setData()` on each bullet (supports mixed weapons)
  - Upgrade bonuses (weaponDamage, fireRate, bulletRange) computed as deltas from base and applied additively to equipped weapon
  - Per-weapon bullet textures: yellow (pistol), orange (shotgun), cyan (rifle)
  - HUD shows current weapon name in weapon color, with [Q] indicator when second weapon is held
  - Bullet pool increased from 20 to 30 to accommodate shotgun bursts
  - 22 unit tests covering weapon state, switching, pickup/swap, effective stats, shotgun spread, and spawn logic
- Inventory capacity system
  - Base capacity 8 items per run, upgradeable via "Backpack Size" shop upgrade (+4/level, max 20)
  - `canPickupItem(state)` predicate: returns false when `itemCount >= maxItems`
  - Items remain on ground when inventory is full (not destroyed)
  - Battery consumption frees a slot (`itemCount` decremented on use)
  - HUD capacity indicator `[N/M]` turns red when full
  - `createInventoryState(maxItems)` accepts capacity from upgrade level
  - Backward compatible: old saves without `backpack` key default to level 0 via spread pattern
  - 8 unit tests covering capacity limits, canPickupItem boundaries, and backpack shop upgrade values
- Maze-like room variety
  - Pure function module `maze.js`: getRoomType, generateMazeWalls, generateColumns
  - Room type determination: seeded PRNG (seed+70000) → 'open' (40%), 'maze' (30%), 'columns' (30%)
  - Maze rooms: recursive division with depth-2, gaps of 80px for passage, door zone avoidance
  - Column rooms: staggered 24x24 pillars at 200px spacing creating shadow interplay
  - Room 0 (store) never gets maze treatment
  - Internal walls integrate with existing raycasting and physics systems
  - 12 unit tests covering type assignment, segment generation, bounds, gaps, door avoidance, determinism
- Tables/desks no longer block flashlight
  - `FURNITURE_TYPES` gains `blocksLight` property: false for tables/desks, true for shelves/bookcases
  - GameScene conditionally pushes wall segments only for `blocksLight: true` furniture
  - Physics collision still applies to all furniture types
  - 2 new behavioral tests verifying tables don't block and shelves do block
- Extra door connections between rooms
  - Post-placement pass in `level.js` (`addExtraDoors`) checks all grid-adjacent room pairs
  - ~50% chance per unconnected neighbor pair (seeded PRNG with offset +80000)
  - Doors are bidirectional (added to both rooms' doors arrays)
  - Creates loops in the level graph for more navigability
  - 3 new unit tests covering extra connections, bidirectionality, and grid-adjacency
- Two stair connections between floors
  - `createStairConnections` in `stairs.js` creates 2 stairs using distinct rooms per floor
  - Falls back to fewer if not enough rooms available
  - 2 new unit tests covering count and room distinctness
- Weaponless start + ammo system
  - Player starts unarmed by default (empty weapon slots)
  - Per-weapon ammo: pistol (50 max, 15 start), shotgun (20 max, 6 start), rifle (15 max, 4 start)
  - `hasAmmo(state)`, `consumeAmmo(state)`, `addAmmo(state, amount)` pure functions for ammo management
  - Ammo item type in ITEM_TYPES (weight 12, ~11% spawn chance, green color)
  - Ammo pickups restore current weapon's ammo (pistol +10, shotgun +4, rifle +3 per pickup)
  - "Starting Pistol" shop upgrade (1 tier, 500 gold) gives pistol at run start
  - `generateLevelWeapons()` guarantees 1 weapon per floor (all types valid drops including pistol)
  - `pickupWeapon()` fills first empty slot (slot 0 if empty, then slot 1)
  - HUD shows "UNARMED" or "WEAPON [ammo/max] [Q]"
  - Firing disabled when unarmed or out of ammo
  - Ammo pickups ignored when unarmed (item stays on ground)
  - 26 new unit tests covering ammo consumption, ammo refill, weaponless state, multi-floor weapon spawns
- Minimap as shop upgrade (gated behind purchase)
  - New "Minimap" upgrade in shop: single tier, 1500 gold (late-game investment)
  - `this.hasMinimap` flag read from upgrade level in `GameScene.init()`
  - Minimap graphics and floor text conditionally created/drawn
  - Exploration tracking remains active regardless (for potential future features)
  - 5 new unit tests covering minimap upgrade purchase, pricing, and value
- Reduced light switch frequency
  - SWITCH_CHANCE reduced from 0.4 (40%) to 0.15 (15%)
  - Most rooms no longer have switches — darker, scarier atmosphere
  - 1 new statistical test validating ~15% distribution
- Lore items in rooms
  - Pure function module `lore.js`: 20 Backrooms-themed entries, `generateRoomLore()` with seed offset +90000
  - ~25% of non-room-0 rooms contain 1 lore note, spawned with furniture overlap avoidance
  - Lore does not consume inventory space (meta-progression collectible)
  - On pickup: tween-animated text popup at bottom of screen, auto-dismiss after 5s
  - Collected lore IDs persisted across runs in localStorage (save format v2, backward compatible with v1)
  - Already-collected notes don't respawn
  - Separate `loreGroup` physics static group and 'lore_note' texture (off-white paper with line details)
  - 12 new tests: 9 lore spawning behavior, 3 persistence round-trip
- Lore journal overlay (between-run lore review in ShopScene)
  - Two pure functions in `lore.js`: `getJournalEntries()` and `getJournalPage()` — no new module needed
  - ShopScene "[ NOTES X/20 ]" button opens full-screen overlay (depth 2000-2001)
  - Paginated display: 5 entries per page, prev/next navigation, page clamping
  - Collected notes show quoted text (white/gray), uncollected show "???" (dim gray)
  - Close button + ESC key to dismiss, overlay destroys all objects on close
  - 9 new tests covering journal entries and pagination logic
- Fixed pre-existing TDZ bug in `maze.js` (doorZones used before declaration in columns branch)
- Alternate exit locations (discoverable exits on deeper floors unlock new starting locations)
  - Pure function module `locations.js`: 5 locations (store, office, garage, hotel, laundromat) with unique colors and furniture
  - `generateAlternateExit()` spawns rare exit zones on floors 1+ (seed offset +100000, ~20% chance)
  - Room 0 rendering parameterized by active location (colors, furniture, exit position all data-driven)
  - ShopScene location selector with `<`/`>` cycling when multiple locations unlocked
  - Persistence v3: `unlockedLocations` and `activeLocation` fields (backward compatible)
  - Alternate exit zones: blue-white pulsing glow, 60x60 overlap zones with location labels
  - 21 new tests: 18 locations (data, layouts, exit spawning), 3 persistence
- New hiding furniture types (bed, armoire, closet, vent) + scroll wheel weapon switching
  - 4 new entries in `FURNITURE_TYPES`: bed (90x60, hideable, no light blocking), armoire (40x70, hideable, blocks light), closet (50x60, hideable, blocks light), vent (30x30, hideable, no light blocking)
  - Armoire and closet are the first furniture types that are both hideable AND block light/LOS
  - Scroll wheel weapon switching via `this.input.on('wheel', ...)` with 200ms debounce cooldown
  - 4 new tests: generation distribution, hideable integration, blocksLight properties
- Enemy corpse persistence + lit room enemy behavior
  - Dead enemies remain visible as corpses: gray tint (CORPSE_TINT=0x666666), faded alpha (0.6), toppled angle (90°), depth 5 (below living enemies at 60)
  - Corpse sprites have `active=false` and `body.enable=false` — no physics, no overlap callbacks, player/bullets pass through
  - Enemies no longer despawn when light switches are toggled on — `onToggleSwitch` is now a pure state toggle
  - Enemies in lit rooms are frozen in place (velocity zeroed, AI skipped) by the existing `updateEnemies()` freeze check
  - If switch toggled off, frozen enemies resume their AI
- Procedural audio system (Web Audio API, no audio file assets)
  - Pure config module `audio.js`: 24 sound definitions in `SOUND_CONFIGS`, 3 ambient types, `getFootstepInterval(speed)`, `getAmbientSoundDelay(time)`, `getSoundConfig(key)`
  - Synthesis engine `audioEngine.js`: `generateAllSounds()` pre-renders all sounds via OfflineAudioContext → Phaser cache injection, `createAmbientDrone()` for live oscillator drone, `playAmbientSound()` for random ambient one-shots
  - GameScene: all game events trigger sounds (weapon fire, hits, pickups, doors, switches, hiding, stairs, death, day complete), footstep timer in update loop, battery warning beep when ≤ 25%, ambient drone + scheduled ambient sounds
  - ShopScene: purchase/denied/click sounds on all interactive elements
  - Browser autoplay policy handled via `sound.locked` + `'unlocked'` event listener
  - 11 behavioral tests for audio config pure functions
- Crawler door-opening (crawlers can open closed doors when chasing the player)
  - New `buildFullRoomGraph()` in `pathfinding.js` includes closed-door edges with `closedDoorId` annotations; `getClosedDoorOnPath()` detects closed doors on BFS path
  - New `opening_door` FSM state in `enemy.js`: crawler stops at closed door, 1000ms timer, signals `wantsToOpenDoor`/`targetDoorId` (same pattern as spitter's `wantsToFire`)
  - Only crawlers can open doors — basic and spitter enemies remain blocked by closed doors
  - GameScene builds dual room graphs (standard for basic/spitter, full for crawlers) and handles the `wantsToOpenDoor` signal via existing `onToggleDoor()`
  - 13 new tests (4 pathfinding, 9 enemy AI)
- Additional room types (corridor, storage, cubicles)
  - 6 room archetypes total: open (20%), maze (15%), columns (15%), corridor (20%), storage (15%), cubicles (15%)
  - Corridor: deep recursive division (maxDepth 4, minSize 120, gap 60) for winding passages
  - Storage: rejection-sampling crate placement (3 size classes, 50px gap, up to 8 crates)
  - Cubicles: grid-based U-shaped partition templates (150px cells, 120px walls, random open sides, 30% empty)
  - Refactored subdivision logic into parameterized `subdivideGeneric()`
  - 15 new tests (5 per type)
- Pixel art sprite system (centralized sprites.js with SPRITE_DEFS, PALETTES, textures.generate() for all entities)
  - 25+ sprite definitions: furniture, items, weapons, bullets, doors, switches, lore notes
  - pixelArt: true in Phaser config for nearest-neighbor rendering
  - Static sprites for furniture, doors, switches replacing per-frame Graphics redraws
  - 10 tests for sprite coverage and dimension contracts
- Character & enemy pixel art animations
  - 16 animation frame sprite definitions with CHARACTER_PALETTES (player, basic, crawler, spitter)
  - ANIM_DEFS: 9 animations (idle/walk per type + spitter_attack) with frame lists and rates
  - Player: visible animated sprite replacing invisible sprite + Graphics overlay
  - Enemies: animated sprites with velocity-based rotation and AI-state-driven animation switching
  - enemySprite.stop() on death freezes animation before corpse visuals
  - 17 behavioral tests for sprites, animations, and helper functions
- 575 unit tests covering movement, raycasting, visibility, room generation, furniture, level generation, enemy spawning, LOS detection, AI state machine, combat, shooting, battery, items, inventory, shop, doors, light switches, hiding, persistence, exploration, starting room, scaling, weapon upgrades, enemy types, stairs, weapons, inventory capacity, maze generation, room connections, weaponless start, ammo system, minimap upgrade, switch frequency, lore spawning, lore persistence, lore journal, floor scaling, multi-floor stair connections, alternate locations, location persistence, cross-room pathfinding, navContext-driven enemy AI, new furniture types, time-based danger escalation, audio system, crawler door-opening, additional room types, pixel art sprites, and character animations
- Documentation (docs.md files for root, src, systems, scenes)
- Bug fix: flashlight mouse tracking drift during WASD movement
  - Root cause: Phaser 3 `pointer.worldX`/`worldY` are cached properties only refreshed on mouse events, not camera scroll
  - Fix: `pointer.updateWorldPoint(this.cameras.main)` called at start of `update()` each frame
  - Also fixes bullet direction when shooting while moving

## Architecture
- `src/systems/` — Pure functions (movement, visibility/raycasting, room, furniture, level, random, enemy, items, inventory, shop, doors, lightswitch, hiding, persistence, exploration, startroom, scaling, stairs, weapons, maze, lore, locations, pathfinding, danger, audio) and browser-dependent synthesis (audioEngine) — pure modules testable without Phaser, audioEngine requires Web Audio API
- `src/scenes/` — Phaser scene classes that wire systems together for rendering (GameScene for gameplay, ShopScene for upgrades between runs)
- Darkness uses BitmapMask with invertAlpha on a Graphics overlay
- Furniture segments use the same `{x1,y1,x2,y2}` format as walls — concatenated into `wallSegments` for raycasting with zero visibility code changes. 8 furniture types with three property combinations: hideable-only (table, desk, bed, vent), blocking-only (shelf, bookcase), and both hideable and blocking (armoire, closet)
- Level generation uses a growth algorithm on a logical grid — rooms placed in adjacent cells, connected via paired doorways
- Doorways are gaps in wall segments — the visibility system naturally handles light passing through without any changes
- Enemy LOS reuses `raySegmentIntersection` from visibility.js — single ray from enemy to player, checked against wall segments
- Enemy AI is a pure function state machine — takes state in, returns updated state with velocity. Three enemy types (basic, crawler, spitter) share the same FSM with type-aware speed constants via `getTypeSpeeds()`. Five states: `idle`, `chase`, `search`, `attack` (spitter-only), and `opening_door` (crawler-only). Spitters signal `wantsToFire` to the scene in attack state. Crawlers signal `wantsToOpenDoor`/`targetDoorId` to the scene in opening_door state. Optional `navContext` parameter enables cross-room navigation: in chase state, enemies in different rooms move toward doorways; in idle state, enemies probabilistically seek doorways for room transitions. Crawlers receive `closedDoorOnPath` in navContext to detect closed doors on their path.
- Cross-room pathfinding: `pathfinding.js` provides two graph builders. `buildRoomGraph` excludes closed doors (used for basic/spitter pathfinding). `buildFullRoomGraph` includes closed-door edges with `closedDoorId` annotations (used for crawler pathfinding). Both are cached in GameScene and invalidated on door toggle (`roomGraphDirty` flag). `getClosedDoorOnPath()` detects if the next BFS step crosses a closed door. Constraints: `ROOM_TRANSITION_COOLDOWN` (10s) between room transitions, `MAX_ROOM_DISTANCE` (2 rooms from spawn, leash), `MAX_ROOM_ENEMIES` (4 per room during idle wander). Enemy state extended with `spawnRoomId`, `currentRoomId`, `roomTransitionCooldown`, `targetDoorway`, `doorOpenTimer`, `targetDoorId`.
- Enemy type is assigned at spawn time by `getEnemyType(rand, runCount)` — run-gated distribution ensures gradual introduction of new types
- Combat/shooting/battery/inventory/hiding/exploration/startroom/scaling/weapons/lore/pathfinding/danger are pure function modules (`combat.js`, `shooting.js`, `battery.js`, `inventory.js`, `hiding.js`, `exploration.js`, `startroom.js`, `scaling.js`, `weapons.js`, `lore.js`, `pathfinding.js`, `danger.js`) — same architecture pattern as enemy/movement
- Items system (`items.js`) follows same spawning pattern as enemy.js: seeded PRNG, furniture overlap avoidance, skip room 0
- Player combat, battery, inventory, hiding, exploration, weapon, and shop states are immutable objects; enemy health is a mutable field on the enemy state (asymmetry: player state is passed through pure functions, enemy health is mutated in-place in the scene callback)
- Item spawning uses seed offset +20000 (furniture: +0, enemies: +10000, items: +20000, doors: +30000, switches: +40000, weapons: +60000, maze: +70000, extra doors: +80000, lore: +90000) to avoid correlation
- Closable door segments are dynamically pushed/spliced from `wallSegments` — same mutable array pattern as furniture, but toggled at runtime via `body.enable` on Phaser static bodies
- Light switch lit rooms are drawn as fillRect into maskGraphics (same BitmapMask as flashlight) — drawn before the flashlight early-return so lit rooms stay visible even when battery is dead
- E-key interaction resolves nearest interactable (door, switch, hideable furniture, or weapon pickup) via distance-sorted candidates array in `updateInteractPrompt()`
- Shop state persists in `game.registry` (in-memory, survives scene transitions) and is backed by localStorage via `persistence.js` (survives browser reloads)
- GameScene `init()` reads upgrade levels from registry and computes stat values via `getUpgradeValue()` — spreads `createShopState().upgrades` as default for forward compatibility with new upgrade keys
- Enemy stats (HP, count, chase speed, contact damage) are precomputed per type in `init()` via `scaling.js` functions — `scaledEnemyHP`, `scaledCrawlerHP`, `scaledSpitterHP`, etc. Constants in `combat.js`/`shooting.js`/`enemy.js` serve as base values only
- `generateRoomEnemies()` accepts optional `extraCount` (default 0) and `runCount` (default 0) parameters — type assigned per enemy via `getEnemyType()`
- `updateEnemyAI()` reads `enemy.type` to select speeds via `getTypeSpeeds()` — the `chaseSpeed` parameter is used as fallback for basic type. 7th parameter `navContext` (optional, default null) provides room/doorway info for cross-room navigation — backward compatible with existing callers
- Per-enemy `contactDamage` field on enemy state replaces uniform `scaledEnemyDamage` — `onEnemyContact(player, enemySprite)` looks up the enemy by sprite reference
- ShopScene `init(data)` receives `treasureEarned` via scene start data, adds to registry gold balance
- Two-scene flow: GameScene → (exit/death) → ShopScene → (enter backrooms) → GameScene
- Player bullet physics group uses Phaser's built-in pooling (`maxSize: 30`); enemy bullet group uses same pattern (`maxSize: 30`) with distinct red texture
- `fireBullet()` reads active weapon stats: single-bullet weapons use `calculateBulletVelocity`, multi-pellet weapons use `calculateShotgunSpread`. Each bullet stores its own damage/range via `setData()`.
- `fireEnemyBullet()` in GameScene mirrors `fireBullet()` — spawned from spitter position toward player, uses `SPITTER_PROJECTILE_SPEED`/`SPITTER_PROJECTILE_RANGE` from `shooting.js`
- HUD uses `setScrollFactor(0)` at depth 1000 to stay fixed on screen above all game layers
- Battery feeds into flashlight rendering: `getFlashlightConeAngle()` scales the cone angle passed to `getFlashlightPolygon()` — no changes to the visibility system itself
- Exit zone uses Phaser's zone + overlap detection pattern (same as enemy contact)
- `pointer.updateWorldPoint(this.cameras.main)` at the top of `update()` ensures `pointer.worldX`/`worldY` are current before all downstream reads (aim angle, bullet velocity)
- Minimap uses separate `minimapGraphics` object (not shared with `hudGraphics`) — both at depth 1000 with `setScrollFactor(0)`
- Exploration state tracks visited room IDs (Set) and current room ID — updated each frame via point-in-AABB check against all rooms
- `getMinimapData()` computes world-to-minimap coordinate mapping from `levelBounds` with uniform scale to fit 160x130px area in top-right corner
- `exploration.js` reuses `isPointInRoom()` from `lightswitch.js` — avoids duplicating room containment logic
- Room 0 (starting room) uses `startroom.js` instead of `furniture.js` for furniture generation — hand-crafted positions via relative proportions, not seeded PRNG
- Room 0 is permanently lit by unconditionally adding it to `litRoomIds` in both `updateDarkness()` and `updateEnemies()` — same mechanism as light switch lit rooms
- Crack visual uses two Graphics objects: static crack line at depth 2 (baked once in `create()`) and animated glow at depth 1 (redrawn per frame with time-based sine-wave alpha)
- Exit zone position computed by `getExitPosition()` from `startroom.js` — west-center of room 0 (front entrance of furniture store)
- Multi-floor level: `stairs.js` wraps `generateLevel()` per floor, offsets room IDs and Y positions, then creates stair connections. `generateMultiFloorLevel` replaces direct `generateLevel` call in GameScene. `getFloorRoomCounts(runCount)` returns the floor array for the current run (2→3→4 floors as runs progress).
- Stair connections: `createStairConnections()` iterates adjacent floor pairs (0→1, 1→2, 2→3) and creates up to 2 stair connections per pair using distinct rooms. Each stair has `fromFloor`/`toFloor` fields. Room 0 is excluded from floor 0 stairs.
- Stair zones use identical overlap + camera fade pattern as exit zone — `onStairEnter()` mirrors `onDayComplete()` structure with `body.reset()` instead of scene transition
- `getMinimapData(state, rooms, bounds, playerPos, exitPos, screenWidth, floorFilter)` — 7th param filters rooms by floor; null/undefined shows all (backward compatible)
- Weapon system: `weapons.js` defines WEAPON_TYPES (pistol, shotgun, rifle) with per-weapon stats. `createWeaponState()` returns 2-slot inventory (pistol default + one pickup slot). Upgrade bonuses computed as deltas from pistol base values and applied additively to any weapon via `getEffectiveStats()`. Q-key cycles `activeSlot`, E-key on weapon pickup calls `pickupWeapon()` which fills empty slot or swaps.
- Seed offset scheme: furniture +0, enemies +10000, items +20000, doors +30000, switches +40000, stairs +50000, weapons +60000, maze +70000, extra doors +80000, lore +90000, alternate exits +100000, floor seed +1000*floorIndex
- Inventory capacity: `inventory.js` exports `canPickupItem(state)` predicate. State now includes `itemCount` (incremented on pickup, decremented on battery use) and `maxItems` (set from backpack upgrade at run start). GameScene checks predicate before destroying item sprites — items stay on ground when full. Constants: `BASE_INVENTORY_CAPACITY=8`, `INVENTORY_CAPACITY_PER_LEVEL=4`.
- Maze/room variety: `maze.js` classifies rooms into 6 types (open/maze/columns/corridor/storage/cubicles) using seeded PRNG. Maze rooms use recursive division (depth 2, minSize 200, gap 80) to place internal wall segments. Corridor rooms use deeper recursive division (depth 4, minSize 120, gap 60) for winding passages. Column rooms use a staggered grid of 24x24 pillars at 200px spacing. Storage rooms use rejection-sampling to place 6-10 rectangular crates (3 size classes: 40x40, 60x40, 80x60) with 50px minimum gap. Cubicle rooms divide the room into a 150px grid and stamp U-shaped partition templates (3 walls, 120px length, one random open side) per cell with 30% empty cells. All types produce `{x1,y1,x2,y2}` segments that integrate directly into the existing `wallSegments` array — no raycasting changes needed. `generateMazeWalls()` accepts the room's `doors` array and avoids placing walls that would block door entry zones. Maze and corridor types share a parameterized `subdivideGeneric()` function.
- Furniture light-blocking: `FURNITURE_TYPES` has `blocksLight` field. GameScene checks `FURNITURE_TYPES[item.type].blocksLight` before pushing furniture segments to `wallSegments`. Low furniture (tables, desks) has physics collision but doesn't cast shadows. Items with unknown types (store furniture like 'counter', 'couch') fall through gracefully (no segments pushed — irrelevant since room 0 is always lit).
- Extra doors: `addExtraDoors(rooms, grid, seed)` in `level.js` iterates all rooms post-placement, checks each of 4 directions for grid-adjacent rooms without existing connections, and adds doors with 50% probability. Uses `alreadyConnected` check to prevent duplicates. Doors are always bidirectional.
- Multiple stairs: `createStairConnections` uses `usedFrom`/`usedTo` Sets per floor pair to pick distinct rooms for each stair connection. Falls back to fewer stairs if insufficient rooms are available. Generalized from hardcoded 2-floor to N-floor support.
- Minimap gating: `this.hasMinimap` boolean in GameScene set from `levels.minimap` upgrade. When false, `minimapGraphics` and `floorText` are never created, `drawMinimap()` early-returns. Exploration tracking still runs (cheap, no Phaser dependency in the pure module).
- Light switch frequency: `SWITCH_CHANCE = 0.15` in lightswitch.js (previously 0.4). With 6 eligible rooms per level, expect ~0.9 switches per run (often zero).
- Lore items: `lore.js` defines 20 `LORE_ENTRIES` (Backrooms-themed notes) and `generateRoomLore()` which spawns 0-1 notes per non-room-0 room (~25% chance) using seed offset +90000. Same placement retry pattern as `items.js` (furniture overlap avoidance). Returns `[{ x, y, loreId, text }]`. Already-collected IDs (passed as Set) are filtered out at generation time.
- Lore persistence: `persistence.js` save format v2 adds `collectedLore` (array of numeric IDs). v1 saves load with `collectedLore` defaulting to `[]`.
- Location persistence: `persistence.js` save format v3 adds `unlockedLocations` (array of location ID strings) and `activeLocation` (string). v1/v2 saves load with `unlockedLocations: ['store']` and `activeLocation: 'store'`. `saveGame()` accepts 5 parameters (shopState, runCount, collectedLore, unlockedLocations, activeLocation). All call sites (GameScene, ShopScene, main.js) pass location data from `game.registry`.
- Lore display: GameScene `showLorePopup(text)` renders a dark semi-transparent rounded rectangle (depth 1001) with monospace text (depth 1002) at the bottom of the screen. Uses Phaser tweens for fade-in (300ms) and delayed fade-out (5000ms wait + 500ms fade). Only one popup shown at a time — new pickups dismiss the current popup.
- Lore physics: `this.loreGroup` is a separate `physics.add.staticGroup()` from `this.itemGroup`. Lore sprites use a distinct 'lore_note' texture (12x10 off-white paper with line details). `onLorePickup()` skips inventory checks — lore never consumes backpack space.
- Alternate locations: `locations.js` defines `LOCATIONS` array with 5 entries (store, office, garage, hotel, laundromat). Each has `id`, `name`, `floorColor`, `wallColor`, and `furniture` (relative-positioned layout data). `getLocationLayout()` converts relative positions to absolute coordinates (same algorithm as `generateStoreLayout()` in startroom.js). Room 0 rendering is now fully data-driven: GameScene reads `this.activeLocationData` (resolved from registry in `init()`) for colors and layout instead of hardcoded `STORE_FLOOR_COLOR`/`STORE_WALL_COLOR`. `startroom.js` is still imported for `generateCrackPoints()` only.
- Alternate exit zones: `generateAlternateExit()` in `locations.js` filters rooms to floor 1+, excludes stair rooms, applies ~20% spawn chance via seeded PRNG (offset +100000), and picks a random unlockable location. Returns `{ roomId, locationId, position }` or null. GameScene creates a 60x60 overlap zone with pulsing blue-white glow (0x88aaff) and a location name label. `onAlternateExitComplete()` adds the location to `unlockedLocations`, sets it as `activeLocation`, and calls `onDayComplete(locationId)`.
- Lore journal: `getJournalEntries(collectedLoreIds)` maps `LORE_ENTRIES` to `{id, text, collected}` with counts. `getJournalPage(entries, page, perPage)` paginates with page clamping. Both are pure functions in `lore.js` (no PRNG, no side effects). ShopScene overlay uses `this.journalOverlay` (array of Phaser objects) for lifecycle management — `showJournal()` creates all objects, `hideJournal()` destroys them. Depth 2000 (background) and 2001 (text/controls) ensure overlay sits above all shop content. ESC key handled via `input.keyboard.on('keydown-ESC')`.
- ShopScene location cycling: When `unlockedLocations.length > 1`, ShopScene renders `< LocationName >` with clickable arrow buttons. `cycleLocation(direction)` wraps around the unlocked array. Active location is stored in registry and persisted. "New location discovered!" banner shown when arriving via alternate exit.

## Next Steps (from APPLICATION_SPEC.md)
- All pixel art sprite and animation items from the spec are now implemented
