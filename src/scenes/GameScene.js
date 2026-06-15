import Phaser from 'phaser';
import { calculateVelocity } from '../systems/movement.js';
import { generateRoomFurniture, FURNITURE_TYPES, blocksBullets, opaqueBounds, visibleFurnitureRect } from '../systems/furniture.js';
import { generateMazeWalls, wallRectSegments, wallRectOccluders, doorEntryZones } from '../systems/maze.js';
import { getRoomVibe } from '../systems/roomVibes.js';
import { getFlashlightPolygon, filterSegmentsNear, filterRectsNear, FLASHLIGHT_RANGE } from '../systems/visibility.js';
import { createRoomWalls } from '../systems/room.js';
import { STAIR_SIZE, STAIR_MARGIN, getStairTopLeft, stairKeepOut, getStairLandingPosition, stairLandingKeepOut } from '../systems/stairs.js';
import { getRoomAt, roomsWithinRadius, hasStairDown, localDistance, isRiftDoor, ROOM_WIDTH, ROOM_HEIGHT } from '../systems/worldgen.js';
import { mulberry32 } from '../systems/random.js';
import { generateRoomEnemies, updateEnemyAI, ENEMY_SPEED_CHASE, DETECTION_RANGE } from '../systems/enemy.js';
import { createCombatState, applyDamage, applyHeal, updateCombat, getHealthFraction, isInvulnerable, grantInvulnerability, applyEnemyDamage, isEnemyDead, getHurtFlash, getDamageFlashAlpha, DAMAGE_FLASH_DURATION_MS, ENEMY_CONTACT_DAMAGE, ENEMY_MAX_HP, CRAWLER_MAX_HP, SPITTER_MAX_HP, CRAWLER_CONTACT_DAMAGE, SPITTER_CONTACT_DAMAGE, SPITTER_PROJECTILE_DAMAGE, CORPSE_TINT, CORPSE_ALPHA, CORPSE_ANGLE, CORPSE_DEPTH, MEDKIT_HEAL_AMOUNT } from '../systems/combat.js';
import { createFlashlightState, toggleFlashlight, setFlashlightHiding, isFlashlightLit, updateBatteryWithFlashlight } from '../systems/flashlight.js';
import { calculateBulletVelocity, calculateShotgunSpread, canFire, updateFireCooldown, isBulletExpired, getBulletVelocityFromAngle, SPITTER_PROJECTILE_SPEED, SPITTER_PROJECTILE_RANGE } from '../systems/shooting.js';
import { getMoveVelocity, resolveAimAngle, resolveFireIntent, resolveMoveVelocity, detectTouchPrimary, computeTouchLayout } from '../systems/touchControls.js';
import { WEAPON_TYPES, createWeaponState, switchWeapon, pickupWeapon, getActiveWeapon, getEffectiveStats, generateRoomWeapon, hasAmmo, consumeAmmo, addAmmo, AMMO_PER_PICKUP } from '../systems/weapons.js';
import { getEnemyHP, getEnemyDamage } from '../systems/scaling.js';
import { createBatteryState, getBatteryFraction, getFlashlightConeAngle, shouldFlicker, rechargeBattery, getBatteryHint, BATTERY_RECHARGE_AMOUNT, BATTERY_RECHARGE_PER_MS } from '../systems/battery.js';
import { generateRoomItems, ITEM_TYPES } from '../systems/items.js';
import { createInventoryState, pickupItem, useBattery, canPickupItem } from '../systems/inventory.js';
import { getUpgradeValue, createShopState } from '../systems/shop.js';
import { toggleDoor, getDoorCenter, findNearestDoor, DOOR_INTERACT_RANGE } from '../systems/doors.js';
import { toggleSwitch, findNearestSwitch, getLitRoomIds, isPointInRoom, computeSwitchPosition, chooseSwitchWall, SWITCH_INTERACT_RANGE } from '../systems/lightswitch.js';
import { createHidingState, enterHiding, exitHiding, findNearestHideable, HIDE_INTERACT_RANGE, HIDING_SPEED_MULTIPLIER } from '../systems/hiding.js';
import { saveGame, resolveWorldSeed } from '../systems/persistence.js';
import { createExplorationState, updateExploration, getWindowedMinimapData, getCurrentRoom, MINIMAP_COLORS, MINIMAP_WINDOW_CELLS } from '../systems/exploration.js';
import { generateCrackPoints, nextRiftCrossing } from '../systems/startroom.js';
import { getLocation, getLocationLayout, getLocationExitPosition } from '../systems/locations.js';
import { generateRoomLore } from '../systems/lore.js';
import { buildRoomGraph, getRoomDistance, getDoorwayCenter, DOORWAY_SEEK_CHANCE, ROOM_TRANSITION_COOLDOWN, MAX_ROOM_DISTANCE, MAX_ROOM_ENEMIES } from '../systems/pathfinding.js';
import { createDangerState, updateDangerTime, shouldSpawnWave, advanceWave, getWaveComposition, getSpawnRoom } from '../systems/danger.js';
import { SOUND_CONFIGS, getFootstepInterval, getAmbientSoundDelay, getEnemySoundEvent, getEnemyDeathSound, getEnemyFireSound, getDistanceVolume, getRiftCrackleVolume, ENEMY_SOUND_RANGE } from '../systems/audio.js';
import { generateAllSounds, createAmbientDrone, playAmbientSound, createRiftCrackle } from '../systems/audioEngine.js';
import { getAlertedEnemies, GUNSHOT_ALERT_COOLDOWN } from '../systems/gunfireNoise.js';
import { createRunStats, recordKill, updateTime, updateMaxFloor } from '../systems/runStats.js';
import { getEffectiveVolume, createDefaultSettings } from '../systems/settings.js';
import { SPRITE_DEFS, getAllSpriteKeys, ANIM_DEFS, getAllAnimKeys, getEnemyTextureKey, getAnimKeyForState, getDirectionalFrame } from '../systems/sprites.js';
import { getLightSpillZones } from '../systems/lightSpill.js';
import { rollEnemyDrop } from '../systems/lootDrops.js';
import { CAMERA_ZOOM, partitionSceneObjects } from '../systems/camera.js';

// AI-generated pixel-art PNGs (generated offline by scripts/generate-art.mjs).
// Whatever is present is loaded in preload(); any sprite key without a PNG
// falls back to the procedural texture generated in generateSpriteTextures().
const SPRITE_PNGS = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const WALL_THICKNESS = 16;
// Breathing room carved out of maze walls around a room's centered stair, so
// the stair square is never embedded in (or flush against) an internal wall.
const STAIR_KEEPOUT_PAD = 16;
// Invulnerability granted the moment the player materializes after a stair
// transition, so an enemy that wandered near the landing cannot hit them before
// they can see and react (paired with the enemy stair/landing keep-out).
const STAIR_SPAWN_PROTECTION_MS = 1200;

// Floors are stacked as non-overlapping horizontal bands in one physics world.
// The offset is enormous so unbounded floors never collide in world space.
const FLOOR_Y_OFFSET = 5_000_000;
// Depth contribution of descending one floor (added to in-floor Manhattan
// distance) so scaling of items/loot keeps increasing across floors.
const FLOOR_DEPTH = 6;
// Fixed large world/camera bounds for the effectively-unbounded world.
const WORLD_BOUND = 50_000_000;

const TOUCH_STICK_RADIUS = 90;
const TOUCH_STICK_DEADZONE_PX = 12;
const TOUCH_UI_DEPTH = 1500;

// Per-frame duration of the directional walk cycle. While moving, the sprite
// cycles base -> _walk0 -> base -> _walk1 (contact, left step, contact, right
// step) every this-many ms, so one full stride is 4x this.
const CHARACTER_STEP_MS = 130;

// The flashlight cone starts this far ahead of the player's body center, along
// the aim vector, so the beam appears to emanate from the held flashlight (which
// sticks out in front of the character) rather than from the middle of the body.
const FLASHLIGHT_MUZZLE_OFFSET = 16;

// Soft pool of light around the player (drawn as stacked fading circles) so the
// character sits in diffuse near-field light and the cone blends out of it,
// instead of the beam stabbing from a single hard apex point.
const FLASHLIGHT_NEARFIELD_RADIUS = 50;
const FLASHLIGHT_NEARFIELD_STEPS = 26;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  preload() {
    for (const [path, url] of Object.entries(SPRITE_PNGS)) {
      const key = path.split('/').pop().replace('.png', '');
      if (key.startsWith('shop_')) continue;
      this.load.image(key, url);
    }
  }

  init() {
    const shopState = this.registry.get('shopState');
    const defaultLevels = createShopState().upgrades;
    const levels = shopState ? { ...defaultLevels, ...shopState.upgrades } : defaultLevels;
    this.maxCharge = getUpgradeValue('battery', levels.battery);
    this.flashlightAngle = getUpgradeValue('flashlight', levels.flashlight);
    this.maxHp = getUpgradeValue('health', levels.health);
    this.playerSpeed = getUpgradeValue('speed', levels.speed);
    this.upgradeBonuses = {
      damage: getUpgradeValue('weaponDamage', levels.weaponDamage) - 25,
      fireRate: getUpgradeValue('fireRate', levels.fireRate) - 200,
      range: getUpgradeValue('bulletRange', levels.bulletRange) - 600,
    };
    this.maxItems = getUpgradeValue('backpack', levels.backpack);
    const hasStartingPistol = (levels.startingPistol || 0) > 0;
    const hasStartingShotgun = (levels.startingShotgun || 0) > 0;
    const hasStartingRifle = (levels.startingRifle || 0) > 0;
    this.hasMinimap = (levels.minimap || 0) > 0;
    this.hasRechargeBattery = (levels.rechargeBattery || 0) > 0;
    this.weaponState = createWeaponState({
      startingPistol: hasStartingPistol,
      startingShotgun: hasStartingShotgun,
      startingRifle: hasStartingRifle,
    });
    this.updateWeaponStats();

    const runCount = this.registry.get('runCount') ?? 0;
    this.registry.set('runCount', runCount + 1);
    // The world seed is persisted per save and reused every run, so the level
    // stays stable day-to-day (the player can build a mental map) while still
    // differing between players. It is minted once on the first run of a save.
    const worldSeed = resolveWorldSeed(this.registry.get('worldSeed'));
    this.registry.set('worldSeed', worldSeed);
    this.levelSeed = worldSeed;
    this.runCount = runCount;
    this.collectedLore = new Set(this.registry.get('collectedLore') ?? []);
    this.activeLocation = this.registry.get('activeLocation') ?? 'store';
    this.activeLocationData = getLocation(this.activeLocation) || getLocation('store');
    this.unlockedLocations = this.registry.get('unlockedLocations') ?? ['store'];
    this.dangerState = createDangerState();
    this.runStats = createRunStats();
    this.audioSettings = this.registry.get('audioSettings') || createDefaultSettings();
    saveGame(shopState || createShopState(), runCount + 1, [...this.collectedLore], this.unlockedLocations, this.activeLocation, worldSeed);
  }

  updateWeaponStats() {
    const weapon = getActiveWeapon(this.weaponState);
    if (!weapon) {
      this.bulletDamage = 0;
      this.fireRate = 0;
      this.bulletRange = 0;
      this.bulletSpeed = 0;
      this.bulletCount = 0;
      this.bulletSpreadAngle = 0;
      this.bulletColor = 0;
      return;
    }
    const stats = getEffectiveStats(weapon, this.upgradeBonuses);
    this.bulletDamage = stats.damage;
    this.fireRate = stats.fireRate;
    this.bulletRange = stats.range;
    this.bulletSpeed = stats.speed;
    this.bulletCount = stats.bulletCount;
    this.bulletSpreadAngle = stats.spreadAngle;
    this.bulletColor = stats.color;
  }

  create() {
    this.level = { rooms: [], stairs: [] };
    this.walls = this.physics.add.staticGroup();
    this.furnitureGroup = this.physics.add.staticGroup();
    this.wallSegments = [];
    // Interior maze walls are kept as solid rects (not pre-expanded segments) so
    // the flashlight can light their near face (visible thickness) via back-face
    // culling, while enemy line-of-sight still expands them to full outlines.
    this.mazeWallRects = [];
    // Light-blocking furniture occludes the SAME way as maze walls: as solid
    // rects expanded to far faces only for the flashlight (back-face culling, so
    // the lit cone reaches the piece's near face instead of leaving it pitch
    // black) and to full outlines for enemy line-of-sight. Sized to the visible
    // art, not the padded logical rect.
    this.furnitureOccluderRects = [];
    // Per-furniture-texture normalized opaque-art box, computed once and cached.
    this.furnitureArtFrac = new Map();

    this.roomFurniture = new Map();
    this.combatState = createCombatState(this.maxHp);
    this.batteryState = createBatteryState(this.maxCharge);
    this.inventoryState = createInventoryState(this.maxItems);
    this.fireCooldown = 0;
    this.playerAngle = 0;
    this.dayEnding = false;
    this.isTeleporting = false;
    this.currentFloor = 0;
    this.hidingState = createHidingState();
    this.flashlightState = createFlashlightState();
    this.riftCrossed = false;
    this.explorationState = createExplorationState();

    this.roomGraph = null;
    this.roomGraphDirty = true;
    this.gunshotAlertCooldown = 0;

    // Lazy-generation bookkeeping. Cells (and their door targets) get numeric
    // ids assigned on first sight; the entrance (floor 0, cell 0,0) is always
    // generated first so it gets id 0 -- many systems treat id 0 as entrance.
    this.cellId = new Map();
    this.nextRoomId = 0;
    this.cellRooms = new Map();
    this.roomsById = new Map();
    this.activatedRoomIds = new Set();
    this.doorConnectionKeys = new Set();
    this.returnStack = [];
    this.roomThemes = new Map();
    this.weaponedFloors = new Set();

    this.generateSpriteTextures();

    // Shared scene infrastructure (groups, graphics, interaction state) created
    // once; per-room content is appended lazily in activateRoom().
    this.createRoomGraphics();
    this.createDoorInfra();
    this.createSwitchInfra();
    this.createItems();
    this.createLoreItems();
    this.createEnemies();
    this.createWeaponPickups();
    this.createStairInfra();

    // Generate + activate the entrance and everything within 2 door-hops.
    this.ensureRoomsAround(0, 0, 0);
    this.entranceRoom = this.roomsById.get(0);

    this.createPlayer();
    this.createBullets();
    this.createEnemyBullets();
    this.createExitZone();
    this.createCrackVisual();
    this.setupInput();
    this.setupCamera();
    this.createDarknessOverlay();
    this.createHUD();
    this.createTouchControls();
    this.setupCameraLayers();
    this.createSounds();
  }

  floorSeed(floor) {
    return this.levelSeed + floor * 1000;
  }

  cellKey(floor, gx, gy) {
    return `${floor}:${gx},${gy}`;
  }

  idForCell(floor, gx, gy) {
    const key = this.cellKey(floor, gx, gy);
    let id = this.cellId.get(key);
    if (id === undefined) {
      id = this.nextRoomId++;
      this.cellId.set(key, id);
    }
    return id;
  }

  // Build (and cache) the room object for one grid cell with numeric ids,
  // world-space Y in this floor's band, depth distance, and door targets
  // rewritten from worldgen string ids to our numeric ids.
  genRoom(floor, gx, gy) {
    const key = this.cellKey(floor, gx, gy);
    const cached = this.cellRooms.get(key);
    if (cached) return cached;

    const raw = getRoomAt(this.floorSeed(floor), gx, gy);
    const room = {
      ...raw,
      id: this.idForCell(floor, gx, gy),
      gridX: gx,
      gridY: gy,
      floor,
      x: gx * ROOM_WIDTH,
      y: floor * FLOOR_Y_OFFSET + gy * ROOM_HEIGHT,
      distance: floor * FLOOR_DEPTH + localDistance(gx, gy),
      doors: raw.doors.map((door) => {
        const [ngx, ngy] = this.neighborCell(gx, gy, door.wall);
        return { ...door, targetRoomId: this.idForCell(floor, ngx, ngy) };
      }),
    };
    this.cellRooms.set(key, room);
    return room;
  }

  neighborCell(gx, gy, wall) {
    if (wall === 'east') return [gx + 1, gy];
    if (wall === 'west') return [gx - 1, gy];
    if (wall === 'north') return [gx, gy - 1];
    return [gx, gy + 1];
  }

  ensureRoomsAround(floor, gx, gy) {
    const nearby = roomsWithinRadius(this.floorSeed(floor), gx, gy, 2);
    for (const raw of nearby) {
      const room = this.genRoom(floor, raw.gridX, raw.gridY);
      if (!this.activatedRoomIds.has(room.id)) {
        this.activateRoom(room);
      }
    }
  }

  // Generate ~2 rooms ahead of the player. Only re-runs activation when the
  // player crosses into a new grid cell on the current floor.
  ensureRoomsAroundPlayer() {
    const floor = this.currentFloor;
    const gx = Math.floor(this.player.x / ROOM_WIDTH);
    const gy = Math.floor((this.player.y - floor * FLOOR_Y_OFFSET) / ROOM_HEIGHT);
    const key = `${floor}:${gx},${gy}`;
    if (key === this._lastEnsureKey) return;
    this._lastEnsureKey = key;
    this.ensureRoomsAround(floor, gx, gy);
  }

  // All per-room scene wiring, run exactly once per room.
  activateRoom(room) {
    if (this.activatedRoomIds.has(room.id)) return;
    this.activatedRoomIds.add(room.id);

    this.level.rooms.push(room);
    this.roomsById.set(room.id, room);

    const theme = room.id === 0 ? this.activeLocationData : getRoomVibe(room.seed);
    this.roomThemes.set(room.id, theme);

    this.drawRoom(this.roomGfx, room, theme);
    this.createRoomPhysics(room);

    // Perimeter walls occlude light (with gaps at doors); the rift is sealed
    // against light by leaving it out of the door-gap list -- the store's
    // light never leaks into the backrooms or vice versa.
    const occluderDoors = room.doors.filter(d => !(room.floor === 0 && isRiftDoor(room, d)));
    this.wallSegments.push(...createRoomWalls(room.x, room.y, room.width, room.height, occluderDoors));

    // Generate the internal maze walls FIRST so furniture (placed next) and the
    // stair can be kept clear of them. A room with a stair carves a keep-out
    // square around both the centered stair AND the spot below it where the
    // player materializes after a stair transition (see getStairLandingPosition)
    // -- otherwise a wall or furniture piece can spawn on the landing.
    const hasStair = this.roomStairDirection(room);
    const stairKeep = hasStair
      ? [stairKeepOut(room, STAIR_SIZE, STAIR_MARGIN, STAIR_KEEPOUT_PAD)]
      : [];
    const landingKeep = hasStair ? [stairLandingKeepOut(room)] : [];
    const mazeRects = room.id !== 0
      ? generateMazeWalls(room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed, room.doors, [...stairKeep, ...landingKeep])
      : [];
    const furnitureObstacles = [...mazeRects, ...doorEntryZones(room, WALL_THICKNESS), ...landingKeep];

    this.createRoomFurniture(this.furnitureGfx, room, theme, furnitureObstacles);
    if (room.id !== 0) {
      this.renderRoomMaze(this.roomGfx, mazeRects, theme);
    }
    this.drawRoomDoorways(this.roomGfx, room, theme);

    this.activateRoomDoors(room);
    this.activateRoomSwitch(room, mazeRects);
    this.activateRoomItems(room, mazeRects);
    this.activateRoomLore(room, mazeRects);
    this.activateRoomEnemies(room, [...stairKeep, ...landingKeep]);
    this.activateRoomWeapon(room, mazeRects);
    this.activateRoomStairs(room);

    this.roomGraphDirty = true;
  }

  createSounds() {
    this.audioReady = false;
    this.footstepTimer = 0;
    this.batteryWarningTimer = 0;
    this.ambientDrone = null;
    this.ambientTimer = null;

    if (!this.sound || !this.sound.context) return;

    const ctx = this.sound.context;
    const cache = this.cache.audio;

    const startAudio = () => {
      generateAllSounds(ctx, cache).then(() => {
        this.audioReady = true;
        this.startAmbientAudio();
      }).catch(() => {});
    };

    if (this.sound.locked) {
      this._audioUnlockHandler = startAudio;
      this.sound.once('unlocked', this._audioUnlockHandler);
    } else {
      startAudio();
    }

    this.events.once('shutdown', () => {
      this.stopAmbientAudio();
      if (this._audioUnlockHandler && this.sound) {
        this.sound.off('unlocked', this._audioUnlockHandler);
        this._audioUnlockHandler = null;
      }
    });
  }

  startAmbientAudio() {
    if (!this.sound || !this.sound.context) return;

    this.ambientDrone = createAmbientDrone(this.sound.context, this.sound.destination);
    const ambientVol = getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.ambientVolume);
    this.ambientDrone.setVolume(ambientVol);
    this.ambientDrone.start();

    this.riftCrackle = createRiftCrackle(this.sound.context, this.sound.destination);
    this.riftCrackle.start();

    this.scheduleAmbientSound();
  }

  updateRiftCrackle() {
    if (!this.riftCrackle || !this.riftRect) return;
    const cx = this.riftRect.x + this.riftRect.width / 2;
    const cy = this.riftRect.y + this.riftRect.height / 2;
    const dist = Math.hypot(this.player.x - cx, this.player.y - cy);
    const ambientVol = getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.ambientVolume);
    this.riftCrackle.setVolume(getRiftCrackleVolume(dist) * ambientVol);
  }

  scheduleAmbientSound() {
    const delay = getAmbientSoundDelay(this.time ? this.time.now : 0);
    this.ambientTimer = this.time.addEvent({
      delay,
      callback: () => {
        if (this.audioReady) {
          const ambientVol = getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.ambientVolume);
          playAmbientSound(this.sound, this.time.now, ambientVol);
        }
        this.scheduleAmbientSound();
      },
    });
  }

  playSound(key) {
    if (!this.audioReady) return;
    const vol = getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.sfxVolume);
    if (vol <= 0) return;
    try {
      this.sound.play(key, { volume: vol });
    } catch (_) {}
  }

  playSoundAtDistance(key, distance) {
    if (!this.audioReady) return;
    const config = SOUND_CONFIGS[key];
    const baseGain = config ? config.gain : 0.3;
    const volume = getDistanceVolume(distance, ENEMY_SOUND_RANGE, baseGain);
    if (volume <= 0) return;
    const sfxVol = getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.sfxVolume);
    if (sfxVol <= 0) return;
    try {
      this.sound.play(key, { volume: volume * sfxVol });
    } catch (_) {}
  }

  applyVolumeSettings() {
    this.audioSettings = this.registry.get('audioSettings') || createDefaultSettings();
    if (this.ambientDrone) {
      const ambientVol = getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.ambientVolume);
      this.ambientDrone.setVolume(ambientVol);
    }
  }

  stopAmbientAudio() {
    if (this.ambientDrone) {
      this.ambientDrone.stop();
      this.ambientDrone = null;
    }
    if (this.riftCrackle) {
      this.riftCrackle.stop();
      this.riftCrackle = null;
    }
    if (this.ambientTimer) {
      this.ambientTimer.remove();
      this.ambientTimer = null;
    }
  }

  generateSpriteTextures() {
    for (const key of getAllSpriteKeys()) {
      if (this.textures.exists(key)) continue;
      const def = SPRITE_DEFS[key];
      this.textures.generate(key, {
        data: def.data,
        pixelWidth: def.pixelWidth || 1,
        pixelHeight: def.pixelHeight || def.pixelWidth || 1,
        palette: def.palette,
      });
    }

    for (const [animKey, animDef] of Object.entries(ANIM_DEFS)) {
      this.anims.create({
        key: animKey,
        frames: animDef.frames.map(k => ({ key: k })),
        frameRate: animDef.frameRate,
        repeat: animDef.repeat,
      });
    }
  }

  createRoomGraphics() {
    this.roomGfx = this.add.graphics();
    this.furnitureGfx = this.add.graphics();
    this.furnitureGfx.setDepth(50);
  }

  drawRoom(gfx, room, theme) {
    gfx.fillStyle(theme.floorColor, 1);
    gfx.fillRect(room.x, room.y, room.width, room.height);

    gfx.fillStyle(theme.wallColor, 1);
    gfx.fillRect(room.x, room.y, room.width, WALL_THICKNESS);
    gfx.fillRect(room.x, room.y + room.height - WALL_THICKNESS, room.width, WALL_THICKNESS);
    gfx.fillRect(room.x, room.y, WALL_THICKNESS, room.height);
    gfx.fillRect(room.x + room.width - WALL_THICKNESS, room.y, WALL_THICKNESS, room.height);
  }

  drawRoomDoorways(gfx, room, theme) {
    gfx.fillStyle(theme.floorColor, 1);
    for (const door of room.doors) {
      if (door.wall === 'north') {
        gfx.fillRect(room.x + door.offset, room.y, door.width, WALL_THICKNESS);
      } else if (door.wall === 'south') {
        gfx.fillRect(room.x + door.offset, room.y + room.height - WALL_THICKNESS, door.width, WALL_THICKNESS);
      } else if (door.wall === 'east') {
        gfx.fillRect(room.x + room.width - WALL_THICKNESS, room.y + door.offset, WALL_THICKNESS, door.width);
      } else if (door.wall === 'west') {
        gfx.fillRect(room.x, room.y + door.offset, WALL_THICKNESS, door.width);
      }
    }
  }

  createRoomPhysics(room) {
    const addHorizontalWall = (startX, y, wallLength, doors, thickness) => {
      const sorted = [...doors].sort((a, b) => a.offset - b.offset);
      let cursor = 0;
      for (const door of sorted) {
        if (door.offset > cursor) {
          const segW = door.offset - cursor;
          this.walls.add(this.add.zone(startX + cursor + segW / 2, y, segW, thickness));
        }
        cursor = door.offset + door.width;
      }
      if (cursor < wallLength) {
        const segW = wallLength - cursor;
        this.walls.add(this.add.zone(startX + cursor + segW / 2, y, segW, thickness));
      }
    };

    const addVerticalWall = (x, startY, wallLength, doors, thickness) => {
      const sorted = [...doors].sort((a, b) => a.offset - b.offset);
      let cursor = 0;
      for (const door of sorted) {
        if (door.offset > cursor) {
          const segH = door.offset - cursor;
          this.walls.add(this.add.zone(x, startY + cursor + segH / 2, thickness, segH));
        }
        cursor = door.offset + door.width;
      }
      if (cursor < wallLength) {
        const segH = wallLength - cursor;
        this.walls.add(this.add.zone(x, startY + cursor + segH / 2, thickness, segH));
      }
    };

    const northDoors = room.doors.filter(d => d.wall === 'north');
    const southDoors = room.doors.filter(d => d.wall === 'south');
    const eastDoors = room.doors.filter(d => d.wall === 'east');
    const westDoors = room.doors.filter(d => d.wall === 'west');

    addHorizontalWall(room.x, room.y + WALL_THICKNESS / 2, room.width, northDoors, WALL_THICKNESS);
    addHorizontalWall(room.x, room.y + room.height - WALL_THICKNESS / 2, room.width, southDoors, WALL_THICKNESS);
    addVerticalWall(room.x + room.width - WALL_THICKNESS / 2, room.y, room.height, eastDoors, WALL_THICKNESS);
    addVerticalWall(room.x + WALL_THICKNESS / 2, room.y, room.height, westDoors, WALL_THICKNESS);
  }

  createRoomFurniture(gfx, room, vibe, obstacles = []) {
    const furniture = room.id === 0
      ? getLocationLayout(this.activeLocation, room.x, room.y, room.width, room.height, WALL_THICKNESS)
      : generateRoomFurniture(room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed, vibe.furniture, obstacles);
    this.roomFurniture.set(room.id, furniture);

    for (const item of furniture) {
      const spriteKey = `furniture_${item.type}`;
      // The collision body and light occluder track the VISIBLE art, not the
      // padded logical rect. For a PNG the visible art fills only part of the
      // texture (transparent margins); the procedural fallback fills the whole
      // rect, so its visible rect is the full rect.
      let visible = { x: item.x, y: item.y, width: item.width, height: item.height };
      if (this.textures.exists(spriteKey)) {
        const sprite = this.add.sprite(
          item.x + item.width / 2,
          item.y + item.height / 2,
          spriteKey
        );
        sprite.setDisplaySize(item.width, item.height);
        sprite.setDepth(50);
        visible = visibleFurnitureRect(item, this.getFurnitureArtFrac(spriteKey));
      } else {
        gfx.fillStyle(item.color, 1);
        gfx.fillRect(item.x, item.y, item.width, item.height);
      }

      const zone = this.add.zone(
        visible.x + visible.width / 2,
        visible.y + visible.height / 2,
        visible.width,
        visible.height
      );
      zone.setData('blocksBullets', blocksBullets(item.type));
      this.furnitureGroup.add(zone);

      // Light-blocking furniture occludes as a back-face-culled rect (like maze
      // walls) sized to the visible art, so the cone lights its near face
      // (visible thickness) instead of leaving the footprint pitch black.
      if (FURNITURE_TYPES[item.type] && FURNITURE_TYPES[item.type].blocksLight) {
        this.furnitureOccluderRects.push(visible);
      }
    }
  }

  // Normalized opaque-art bounding box for a furniture texture (fractions of the
  // texture, 0..1), computed once via an offscreen scan and cached. Falls back
  // to the full rect if the texture cannot be inspected.
  getFurnitureArtFrac(key) {
    if (this.furnitureArtFrac.has(key)) return this.furnitureArtFrac.get(key);
    let frac = { x: 0, y: 0, width: 1, height: 1 };
    const tex = this.textures.get(key);
    const src = tex && tex.getSourceImage && tex.getSourceImage();
    if (src && src.width && src.height && typeof document !== 'undefined') {
      const w = src.width;
      const h = src.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(src, 0, 0);
      const bounds = opaqueBounds(ctx.getImageData(0, 0, w, h).data, w, h);
      if (bounds) {
        frac = { x: bounds.x / w, y: bounds.y / h, width: bounds.width / w, height: bounds.height / h };
      }
    }
    this.furnitureArtFrac.set(key, frac);
    return frac;
  }

  renderRoomMaze(gfx, mazeRects, theme) {
    for (const rect of mazeRects) {
      this.mazeWallRects.push(rect);
      this.walls.add(this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height));
      gfx.fillStyle(theme.wallColor, 1);
      gfx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  createDoorInfra() {
    this.doorStates = [];
    this.nextDoorId = 0;
    this.doorGroup = this.physics.add.staticGroup();
    this.doorZones = new Map();
    this.doorSprites = new Map();

    this.interactText = this.add.text(0, 0, 'Press E', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
    });
    this.interactText.setDepth(1000);
    this.interactText.setScrollFactor(1);
    this.interactText.setVisible(false);
  }

  doorSegment(room, wall, offset, width) {
    if (wall === 'north') {
      return { x1: room.x + offset, y1: room.y, x2: room.x + offset + width, y2: room.y };
    }
    if (wall === 'south') {
      return { x1: room.x + offset + width, y1: room.y + room.height, x2: room.x + offset, y2: room.y + room.height };
    }
    if (wall === 'east') {
      return { x1: room.x + room.width, y1: room.y + offset, x2: room.x + room.width, y2: room.y + offset + width };
    }
    return { x1: room.x, y1: room.y + offset + width, x2: room.x, y2: room.y + offset };
  }

  // Each connection between two cells is shared by both rooms' door lists. The
  // door state is created when the SECOND of the two rooms activates (so both
  // endpoints exist), keyed canonically by the lower-numbered room id so
  // getDoorCenter and pathfinding (which look up roomId === lo) stay consistent.
  // Closability is decided deterministically from the connection's seed.
  activateRoomDoors(room) {
    const CLOSABLE_DOOR_CHANCE = 0.5;
    for (const door of room.doors) {
      if (!this.activatedRoomIds.has(door.targetRoomId)) continue;
      // The rift is not a doorway -- never spawn a closable door on it.
      if (room.floor === 0 && isRiftDoor(room, door)) continue;

      const lo = Math.min(room.id, door.targetRoomId);
      const hi = Math.max(room.id, door.targetRoomId);
      const connKey = `${lo}-${hi}`;
      if (this.doorConnectionKeys.has(connKey)) continue;
      this.doorConnectionKeys.add(connKey);

      // Seed closability from the connection's canonical CELL identity (not the
      // numeric ids, which depend on traversal order) so the same world cell is
      // always equally closable regardless of how the player reached it.
      const [ngx, ngy] = this.neighborCell(room.gridX, room.gridY, door.wall);
      const cgx = Math.min(room.gridX, ngx);
      const cgy = Math.min(room.gridY, ngy);
      const axis = door.wall === 'east' || door.wall === 'west' ? 0 : 1;
      const rand = mulberry32(this.floorSeed(room.floor) + 30000 + cgx * 73856093 + cgy * 19349663 + axis * 83492791);
      if (rand() >= CLOSABLE_DOOR_CHANCE) continue;

      const owner = this.roomsById.get(lo);
      const ownerDoor = owner.doors.find(d => d.targetRoomId === hi);

      const doorState = {
        id: this.nextDoorId++,
        roomId: lo,
        targetRoomId: hi,
        wall: ownerDoor.wall,
        offset: ownerDoor.offset,
        width: ownerDoor.width,
        isClosed: true,
        segment: this.doorSegment(owner, ownerDoor.wall, ownerDoor.offset, ownerDoor.width),
      };
      this.doorStates.push(doorState);
      this.createDoorSprite(doorState);
    }
  }

  createDoorSprite(door) {
    const center = getDoorCenter(door, this.level.rooms);
    const isHorizontal = door.wall === 'north' || door.wall === 'south';
    const zoneW = isHorizontal ? door.width : WALL_THICKNESS;
    const zoneH = isHorizontal ? WALL_THICKNESS : door.width;

    const zone = this.add.zone(center.x, center.y, zoneW, zoneH);
    this.doorGroup.add(zone);

    const doorSprite = this.add.sprite(center.x, center.y, 'door_closed');
    doorSprite.setDisplaySize(zoneW, zoneH);
    doorSprite.setDepth(50);
    doorSprite.setVisible(door.isClosed);
    this.doorSprites.set(door.id, doorSprite);

    if (door.isClosed) {
      this.wallSegments.push(door.segment);
    } else {
      zone.body.enable = false;
    }

    this.doorZones.set(door.id, zone);
  }

  createSwitchInfra() {
    this.switchStates = [];
    this.nextSwitchId = 0;
    this.switchSprites = new Map();
  }

  activateRoomSwitch(room, mazeRects = []) {
    if (room.id === 0) return;
    const SWITCH_CHANCE = 0.15;
    const WALLS = ['north', 'south', 'east', 'west'];
    const rand = mulberry32(this.floorSeed(room.floor) + 40000 + room.gridX * 131 + room.gridY * 977);
    if (rand() >= SWITCH_CHANCE) return;

    // Place the switch flush to a wall but clear of any doorway AND of any
    // interior maze wall on it (the door- and maze-aware free-span search lives
    // in lightswitch.js). chooseSwitchWall skips a wall a maze wall has buried.
    const startWall = Math.floor(rand() * WALLS.length);
    const wall = chooseSwitchWall(room, WALL_THICKNESS, mazeRects, startWall);
    const { x, y } = computeSwitchPosition(room, wall, WALL_THICKNESS, mazeRects);

    const sw = { id: this.nextSwitchId++, roomId: room.id, x, y, isOn: false };
    this.switchStates.push(sw);

    const sprite = this.add.sprite(sw.x, sw.y, sw.isOn ? 'switch_on' : 'switch_off');
    sprite.setDepth(50);
    this.switchSprites.set(sw.id, sprite);
  }

  onToggleSwitch(switchId) {
    this.switchStates = toggleSwitch(this.switchStates, switchId);
    this.playSound('switch_click');
  }

  onToggleDoor(doorId) {
    const door = this.doorStates.find(d => d.id === doorId);
    if (!door) return;

    if (door.isClosed) {
      const idx = this.wallSegments.indexOf(door.segment);
      if (idx !== -1) this.wallSegments.splice(idx, 1);
    }

    this.doorStates = toggleDoor(this.doorStates, doorId);
    const updatedDoor = this.doorStates.find(d => d.id === doorId);

    const zone = this.doorZones.get(doorId);
    if (updatedDoor.isClosed) {
      zone.body.enable = true;
      this.wallSegments.push(updatedDoor.segment);
    } else {
      zone.body.enable = false;
    }
    this.roomGraphDirty = true;
    this.playSound(updatedDoor.isClosed ? 'door_close' : 'door_open');
  }

  onEnterHiding(furniture) {
    this.playSound('hide_enter');
    this.hidingState = enterHiding(this.hidingState, furniture);
    this.flashlightState = setFlashlightHiding(this.flashlightState, true);
    const centerX = furniture.x + furniture.width / 2;
    const centerY = furniture.y + furniture.height / 2;
    this.player.body.reset(centerX, centerY);
    this.player.body.setBoundsRectangle(
      new Phaser.Geom.Rectangle(furniture.x, furniture.y, furniture.width, furniture.height)
    );
    this.player.body.setCollideWorldBounds(true);
    this.playerFurnitureCollider.active = false;
  }

  onExitHiding() {
    this.playSound('hide_exit');
    this.hidingState = exitHiding(this.hidingState);
    this.flashlightState = setFlashlightHiding(this.flashlightState, false);
    this.player.body.setBoundsRectangle(null);
    this.player.body.setCollideWorldBounds(false);
    this.playerFurnitureCollider.active = true;
  }

  drawDoors() {
    for (const door of this.doorStates) {
      const sprite = this.doorSprites.get(door.id);
      if (sprite) sprite.setVisible(door.isClosed);
    }
  }

  drawSwitches() {
    for (const sw of this.switchStates) {
      const sprite = this.switchSprites.get(sw.id);
      if (sprite) sprite.setTexture(sw.isOn ? 'switch_on' : 'switch_off');
    }
  }

  updateInteractPrompt() {
    if (this.hidingState.isHiding) {
      this.interactText.setVisible(false);
      this.nearestInteractable = null;
      return;
    }

    const nearestDoor = findNearestDoor(
      this.doorStates, this.level.rooms,
      this.player.x, this.player.y,
      DOOR_INTERACT_RANGE
    );
    const nearestSwitch = findNearestSwitch(
      this.switchStates,
      this.player.x, this.player.y,
      SWITCH_INTERACT_RANGE
    );
    const nearestHideable = findNearestHideable(
      this.roomFurniture,
      this.player.x, this.player.y,
      HIDE_INTERACT_RANGE
    );

    const candidates = [];

    if (nearestDoor) {
      const pos = getDoorCenter(nearestDoor, this.level.rooms);
      const dist = Math.hypot(this.player.x - pos.x, this.player.y - pos.y);
      candidates.push({ type: 'door', item: nearestDoor, pos, dist });
    }
    if (nearestSwitch) {
      const pos = { x: nearestSwitch.x, y: nearestSwitch.y };
      const dist = Math.hypot(this.player.x - pos.x, this.player.y - pos.y);
      candidates.push({ type: 'switch', item: nearestSwitch, pos, dist });
    }
    if (nearestHideable) {
      candidates.push({
        type: 'furniture',
        item: nearestHideable.furniture,
        pos: nearestHideable.center,
        dist: nearestHideable.dist,
      });
    }

    const WEAPON_PICKUP_RANGE = 80;
    for (const wpnSprite of this.weaponPickupSprites) {
      if (!wpnSprite.active) continue;
      const dist = Math.hypot(this.player.x - wpnSprite.x, this.player.y - wpnSprite.y);
      if (dist <= WEAPON_PICKUP_RANGE) {
        candidates.push({
          type: 'weapon',
          item: wpnSprite,
          pos: { x: wpnSprite.x, y: wpnSprite.y },
          dist,
        });
      }
    }

    candidates.sort((a, b) => a.dist - b.dist);
    const winner = candidates[0] || null;

    this.nearestInteractable = winner ? { type: winner.type, item: winner.item } : null;

    if (winner) {
      this.interactText.setPosition(winner.pos.x - 30, winner.pos.y - 30);
      this.interactText.setVisible(true);
    } else {
      this.interactText.setVisible(false);
    }
  }


  createItems() {
    this.itemGroup = this.physics.add.staticGroup();
  }

  activateRoomItems(room, mazeRects = []) {
    const furniture = this.roomFurniture.get(room.id) || [];
    const items = generateRoomItems(
      room.x, room.y, room.width, room.height,
      WALL_THICKNESS, room.seed, furniture, room.id,
      room.distance, mazeRects
    );

    for (const item of items) {
      const sprite = this.itemGroup.create(item.x, item.y, `item_${item.type}`);
      sprite.setScale(1.6);
      sprite.refreshBody();
      sprite.setDepth(5);
      sprite.setData('itemType', item.type);
      sprite.setData('itemValue', item.value);
    }
  }

  onItemPickup(player, itemSprite) {
    if (!itemSprite.active) return;
    if (this.combatState.isDead) return;
    const itemType = itemSprite.getData('itemType');
    if (itemType === 'medkit') {
      if (this.combatState.hp >= this.combatState.maxHp) return;
      this.combatState = applyHeal(this.combatState, MEDKIT_HEAL_AMOUNT);
      this.playSound('medkit_pickup');
      this.cameras.main.flash(100, 0, 255, 0);
      itemSprite.destroy();
      return;
    }
    if (!canPickupItem(this.inventoryState)) return;
    if (itemType === 'ammo' && !getActiveWeapon(this.weaponState)) return;
    if (itemType === 'ammo') {
      const weapon = getActiveWeapon(this.weaponState);
      if (this.weaponState.ammo[this.weaponState.activeSlot] >= weapon.maxAmmo) return;
    }
    this.inventoryState = pickupItem(this.inventoryState, {
      type: itemType,
      value: itemSprite.getData('itemValue'),
    });
    if (itemType === 'ammo') {
      const weapon = getActiveWeapon(this.weaponState);
      const amount = AMMO_PER_PICKUP[weapon.id] || 10;
      this.weaponState = addAmmo(this.weaponState, amount);
      this.playSound('ammo_pickup');
    } else {
      this.playSound('item_pickup');
    }
    itemSprite.destroy();
  }

  createLoreItems() {
    this.loreGroup = this.physics.add.staticGroup();
    this.lorePopup = null;
  }

  activateRoomLore(room, mazeRects = []) {
    const furniture = this.roomFurniture.get(room.id) || [];
    const loreItems = generateRoomLore(
      room.x, room.y, room.width, room.height,
      WALL_THICKNESS, room.seed, furniture, room.id, this.collectedLore, mazeRects
    );

    for (const item of loreItems) {
      const sprite = this.loreGroup.create(item.x, item.y, 'lore_note');
      sprite.setDepth(5);
      sprite.setData('loreId', item.loreId);
      sprite.setData('loreText', item.text);
    }
  }

  onLorePickup(player, loreSprite) {
    if (!loreSprite.active) return;
    if (this.dayEnding || this.isTeleporting) return;

    const loreId = loreSprite.getData('loreId');
    const loreText = loreSprite.getData('loreText');

    this.collectedLore.add(loreId);
    this.registry.set('collectedLore', [...this.collectedLore]);

    loreSprite.destroy();
    this.playSound('lore_pickup');
    this.showLorePopup(loreText);
  }

  showLorePopup(text) {
    if (this.lorePopup) {
      this.lorePopup.bg.destroy();
      this.lorePopup.text.destroy();
      if (this.lorePopup.timer) this.lorePopup.timer.remove();
      this.lorePopup = null;
    }

    const cam = this.cameras.main;
    // This popup is HUD: route it to the un-zoomed UI camera (see setupCameraLayers).
    this._buildingHud = true;
    const bg = this.add.graphics();
    bg.setScrollFactor(0);
    bg.setDepth(1001);
    bg.fillStyle(0x000000, 0.75);
    bg.fillRoundedRect(cam.width / 2 - 250, cam.height - 140, 500, 80, 8);
    bg.setAlpha(0);

    const loreText = this.add.text(cam.width / 2, cam.height - 100, text, {
      fontSize: '13px',
      color: '#ddccaa',
      fontFamily: 'monospace',
      wordWrap: { width: 460 },
      align: 'center',
    });
    loreText.setOrigin(0.5);
    loreText.setScrollFactor(0);
    loreText.setDepth(1002);
    loreText.setAlpha(0);
    this._buildingHud = false;

    this.tweens.add({ targets: [bg, loreText], alpha: 1, duration: 300 });

    const timer = this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [bg, loreText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          bg.destroy();
          loreText.destroy();
          if (this.lorePopup && this.lorePopup.bg === bg) {
            this.lorePopup = null;
          }
        },
      });
    });

    this.lorePopup = { bg, text: loreText, timer };
  }

  createPlayer() {
    const spawnRoom = this.entranceRoom;
    const playerX = spawnRoom.x + spawnRoom.width / 2;
    const playerY = spawnRoom.y + spawnRoom.height / 2;

    this.player = this.physics.add.sprite(playerX, playerY, 'player_down');
    this.player.setDepth(200);
    // Directional 64px PNG displayed at 48px (scale 0.75). Arcade bodies are
    // multiplied by the sprite's display scale, so 32 yields a ~24px effective
    // hitbox -- unchanged from the pre-directional 40px/19 player.
    this.player.setDisplaySize(48, 48);
    this.player.body.setSize(32, 32, true);

    this.physics.add.collider(this.player, this.walls);
    this.playerFurnitureCollider = this.physics.add.collider(this.player, this.furnitureGroup);
    this.physics.add.collider(this.player, this.doorGroup);

    this.physics.add.overlap(this.player, this.itemGroup, this.onItemPickup, null, this);
    this.physics.add.overlap(this.player, this.loreGroup, this.onLorePickup, null, this);
    this.physics.add.overlap(this.player, this.enemyGroup, this.onEnemyContact, null, this);
  }

  getEnemyStats(type, distance) {
    // bodySize is in texture pixels and gets multiplied by the display scale
    // (display/texture), so these stay close to the pre-scale-up hitboxes.
    // crawler/spitter are the 24px/32px procedural textures; basic is the 64px
    // directional PNG, so its bodySize is sized against 64 to keep the same ~22px
    // effective world hitbox.
    if (type === 'crawler') return { hp: getEnemyHP(CRAWLER_MAX_HP, distance), contactDamage: getEnemyDamage(CRAWLER_CONTACT_DAMAGE, distance), textureKey: getEnemyTextureKey('crawler'), bodySize: 12, displaySize: 34 };
    if (type === 'spitter') return { hp: getEnemyHP(SPITTER_MAX_HP, distance), contactDamage: getEnemyDamage(SPITTER_CONTACT_DAMAGE, distance), textureKey: getEnemyTextureKey('spitter'), bodySize: 16, displaySize: 44 };
    return { hp: getEnemyHP(ENEMY_MAX_HP, distance), contactDamage: getEnemyDamage(ENEMY_CONTACT_DAMAGE, distance), textureKey: getEnemyTextureKey('basic'), bodySize: 28, displaySize: 50 };
  }

  spawnDangerWave(playerRoomId, litRoomIds) {
    const types = getWaveComposition(this.dangerState.waveCount);
    const room = getSpawnRoom(this.level.rooms, playerRoomId, litRoomIds, this.currentFloor);
    if (!room) return;
    this.playSound('distant_bang');

    const margin = 40;
    const minX = room.x + WALL_THICKNESS + margin;
    const minY = room.y + WALL_THICKNESS + margin;
    const maxX = room.x + room.width - WALL_THICKNESS - margin;
    const maxY = room.y + room.height - WALL_THICKNESS - margin;

    for (const type of types) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      const stats = this.getEnemyStats(type, room.distance);
      const enemy = this.enemyGroup.create(x, y, stats.textureKey);
      enemy.setDisplaySize(stats.displaySize, stats.displaySize);
      enemy.body.setSize(stats.bodySize, stats.bodySize, true);
      enemy.body.setCollideWorldBounds(true);
      enemy.setDepth(60);
      if (type !== 'basic') enemy.play(getAnimKeyForState(type, 'idle'), true);

      this.enemyStates.push({
        sprite: enemy,
        x,
        y,
        type,
        state: 'idle',
        facingAngle: Math.PI / 2,
        velocityX: 0,
        velocityY: 0,
        wanderTimer: 0,
        wanderAngle: Math.random() * Math.PI * 2,
        lastKnownX: x,
        lastKnownY: y,
        searchTimer: 0,
        attackCooldown: 0,
        health: stats.hp,
        contactDamage: stats.contactDamage,
        spawnRoomId: room.id,
        currentRoomId: room.id,
        roomTransitionCooldown: 0,
        targetDoorway: null,
        soundCooldown: 1000 + Math.random() * 3000,
      });
    }
  }

  createEnemies() {
    this.enemyGroup = this.physics.add.group();
    this.enemyStates = [];

    this.physics.add.collider(this.enemyGroup, this.walls);
    this.physics.add.collider(this.enemyGroup, this.furnitureGroup);
    this.physics.add.collider(this.enemyGroup, this.doorGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
  }

  activateRoomEnemies(room, keepOut = []) {
    const furniture = this.roomFurniture.get(room.id) || [];
    const spawnPoints = generateRoomEnemies(
      room.x, room.y, room.width, room.height,
      WALL_THICKNESS, room.seed, furniture, room.id, room.distance, keepOut
    );

    for (const spawn of spawnPoints) {
      const stats = this.getEnemyStats(spawn.type, room.distance);
      const enemy = this.enemyGroup.create(spawn.x, spawn.y, stats.textureKey);
      enemy.setDisplaySize(stats.displaySize, stats.displaySize);
      enemy.body.setSize(stats.bodySize, stats.bodySize, true);
      enemy.body.setCollideWorldBounds(true);
      enemy.setDepth(60);
      if (spawn.type !== 'basic') enemy.play(getAnimKeyForState(spawn.type, 'idle'), true);

      this.enemyStates.push({
        sprite: enemy,
        x: spawn.x,
        y: spawn.y,
        type: spawn.type,
        state: 'idle',
        facingAngle: Math.PI / 2,
        velocityX: 0,
        velocityY: 0,
        wanderTimer: 0,
        wanderAngle: spawn.wanderAngle,
        lastKnownX: spawn.x,
        lastKnownY: spawn.y,
        searchTimer: 0,
        attackCooldown: 0,
        health: stats.hp,
        contactDamage: stats.contactDamage,
        spawnRoomId: room.id,
        currentRoomId: room.id,
        roomTransitionCooldown: 0,
        targetDoorway: null,
        soundCooldown: 1000 + Math.random() * 3000,
      });
    }
  }

  createBullets() {
    this.bulletGroup = this.physics.add.group({ maxSize: 30 });

    this.physics.add.collider(this.bulletGroup, this.walls, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.bulletGroup, this.furnitureGroup, this.onBulletHitWall, this.bulletHitsFurniture, this);
    this.physics.add.collider(this.bulletGroup, this.doorGroup, this.onBulletHitWall, null, this);
    this.physics.add.overlap(this.bulletGroup, this.enemyGroup, this.onBulletHitEnemy, null, this);
  }

  createEnemyBullets() {
    this.enemyBulletGroup = this.physics.add.group({ maxSize: 30 });

    this.physics.add.collider(this.enemyBulletGroup, this.walls, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.enemyBulletGroup, this.furnitureGroup, this.onBulletHitWall, this.bulletHitsFurniture, this);
    this.physics.add.collider(this.enemyBulletGroup, this.doorGroup, this.onBulletHitWall, null, this);
    this.physics.add.overlap(this.enemyBulletGroup, this.player, this.onEnemyBulletHitPlayer, null, this);
  }

  createWeaponPickups() {
    this.weaponPickupSprites = [];
  }

  // One ground weapon spawns per floor, in the first non-entrance room on that
  // floor (in activation order) where a valid placement is found.
  activateRoomWeapon(room, mazeRects = []) {
    if (room.id === 0) return;
    if (this.weaponedFloors.has(room.floor)) return;

    const furniture = this.roomFurniture.get(room.id) || [];
    const wpnData = generateRoomWeapon(
      room.x, room.y, room.width, room.height,
      WALL_THICKNESS, this.levelSeed + room.floor * 100, furniture, room.id, mazeRects
    );
    if (!wpnData) return;

    this.weaponedFloors.add(room.floor);
    const sprite = this.add.sprite(wpnData.x, wpnData.y, `pickup_${wpnData.weaponId}`);
    sprite.setScale(1.5);
    sprite.setDepth(5);
    sprite.setData('weaponId', wpnData.weaponId);
    this.weaponPickupSprites.push(sprite);
  }

  fireEnemyBullet(fromX, fromY, toX, toY) {
    const bullet = this.enemyBulletGroup.get(fromX, fromY, 'enemyBullet');
    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.body.reset(fromX, fromY);
    bullet.setDepth(150);
    bullet.body.setSize(6, 6, true);

    const { vx, vy } = calculateBulletVelocity(fromX, fromY, toX, toY, SPITTER_PROJECTILE_SPEED);
    bullet.setVelocity(vx, vy);
    bullet.setData('originX', fromX);
    bullet.setData('originY', fromY);
  }

  onEnemyBulletHitPlayer(bullet) {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.body.stop();

    if (this.hidingState.isHiding) return;

    const before = this.combatState;
    this.combatState = applyDamage(before, SPITTER_PROJECTILE_DAMAGE);

    if (this.combatState.hp < before.hp) {
      this.playSound('player_damage');
      this.cameras.main.shake(100, 0.01);
      this.triggerDamageFlash();

      if (this.combatState.isDead) {
        this.onPlayerDeath();
      }
    }
  }

  updateEnemyBullets() {
    for (const bullet of this.enemyBulletGroup.getChildren()) {
      if (!bullet.active) continue;
      const originX = bullet.getData('originX');
      const originY = bullet.getData('originY');
      if (isBulletExpired(originX, originY, bullet.x, bullet.y, SPITTER_PROJECTILE_RANGE)) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();
      }
    }
  }

  createHUD() {
    this.hudGraphics = this.add.graphics();
    this.hudGraphics.setScrollFactor(0);
    this.hudGraphics.setDepth(1000);

    if (this.hasMinimap) {
      this.minimapGraphics = this.add.graphics();
      this.minimapGraphics.setScrollFactor(0);
      this.minimapGraphics.setDepth(1000);
    }

    this.hpLabelText = this.add.text(226, 22, 'HP', {
      fontSize: '12px',
      color: '#88cc88',
      fontFamily: 'monospace',
    });
    this.hpLabelText.setScrollFactor(0);
    this.hpLabelText.setDepth(1000);

    this.batteryLabelText = this.add.text(226, 44, this.touchMode ? 'FLASHLIGHT' : 'FLASHLIGHT [F]', {
      fontSize: '12px',
      color: '#cccc66',
      fontFamily: 'monospace',
    });
    this.batteryLabelText.setScrollFactor(0);
    this.batteryLabelText.setDepth(1000);

    this.batteryHintText = this.add.text(20, 126, '', {
      fontSize: '13px',
      color: '#ffcc66',
      fontFamily: 'monospace',
    });
    this.batteryHintText.setScrollFactor(0);
    this.batteryHintText.setDepth(1000);

    this.batteryCountText = this.add.text(20, 66, '', {
      fontSize: '14px',
      color: '#ffff00',
      fontFamily: 'monospace',
    });
    this.batteryCountText.setScrollFactor(0);
    this.batteryCountText.setDepth(1000);

    this.treasureText = this.add.text(120, 66, '', {
      fontSize: '14px',
      color: '#ffd700',
      fontFamily: 'monospace',
    });
    this.treasureText.setScrollFactor(0);
    this.treasureText.setDepth(1000);

    this.capacityText = this.add.text(220, 66, '', {
      fontSize: '14px',
      color: '#cccccc',
      fontFamily: 'monospace',
    });
    this.capacityText.setScrollFactor(0);
    this.capacityText.setDepth(1000);

    this.weaponText = this.add.text(20, 86, '', {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'monospace',
    });
    this.weaponText.setScrollFactor(0);
    this.weaponText.setDepth(1000);

    this.dangerText = this.add.text(20, 106, '', {
      fontSize: '14px',
      color: '#ff4444',
      fontFamily: 'monospace',
    });
    this.dangerText.setScrollFactor(0);
    this.dangerText.setDepth(1000);

    if (this.hasMinimap) {
      this.floorText = this.add.text(this.cameras.main.width - 180, 145, 'B1', {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      });
      this.floorText.setScrollFactor(0);
      this.floorText.setDepth(1000);
    }

    // First run: spell out the battery mechanic once, up front.
    if (this.runCount === 0) {
      const tip = this.add.text(
        this.cameras.main.width / 2, 150,
        'Your flashlight drains its battery -- the beam narrows as it dies.\n' +
        (this.touchMode
          ? 'LIGHT toggles it off to conserve. BATT inserts a spare battery.'
          : 'Press F to switch it off and conserve. Right-click to insert a spare battery.'),
        {
          fontSize: '14px',
          color: '#ffe9a0',
          fontFamily: 'monospace',
          backgroundColor: '#000000cc',
          padding: { x: 12, y: 8 },
          align: 'center',
        }
      );
      tip.setOrigin(0.5, 0);
      tip.setScrollFactor(0);
      tip.setDepth(1100);
      this.tweens.add({
        targets: tip,
        alpha: 0,
        delay: 9000,
        duration: 1200,
        onComplete: () => tip.destroy(),
      });
    }
  }

  createExitZone() {
    const room = this.entranceRoom;
    const { x: exitX, y: exitY } = getLocationExitPosition(this.activeLocation, room, WALL_THICKNESS);
    const exitSize = 64;
    this.exitPosition = { x: exitX, y: exitY };

    this.exitGraphics = this.add.graphics();
    this.exitGraphics.setDepth(10);
    this.exitGraphics.fillStyle(0x44cc44, 0.3);
    this.exitGraphics.fillRect(exitX - exitSize / 2, exitY - exitSize / 2, exitSize, exitSize);
    this.exitGraphics.lineStyle(2, 0x44cc44, 0.6);
    this.exitGraphics.strokeRect(exitX - exitSize / 2, exitY - exitSize / 2, exitSize, exitSize);

    this.exitZone = this.add.zone(exitX, exitY, exitSize, exitSize);
    this.physics.add.existing(this.exitZone, true);
    this.physics.add.overlap(this.player, this.exitZone, () => this.onDayComplete(), null, this);
  }

  createCrackVisual() {
    const room = this.entranceRoom;
    const door = room.doors.find(d => d.wall === 'east') || room.doors[0];
    if (!door) return;

    let crackX, crackY, crackW, crackH;
    if (door.wall === 'north') {
      crackX = room.x + door.offset + door.width / 2;
      crackY = room.y;
      crackW = door.width;
      crackH = WALL_THICKNESS;
    } else if (door.wall === 'south') {
      crackX = room.x + door.offset + door.width / 2;
      crackY = room.y + room.height - WALL_THICKNESS;
      crackW = door.width;
      crackH = WALL_THICKNESS;
    } else if (door.wall === 'east') {
      crackX = room.x + room.width - WALL_THICKNESS;
      crackY = room.y + door.offset + door.width / 2;
      crackW = WALL_THICKNESS;
      crackH = door.width;
    } else {
      crackX = room.x;
      crackY = room.y + door.offset + door.width / 2;
      crackW = WALL_THICKNESS;
      crackH = door.width;
    }

    const isVerticalWall = door.wall === 'east' || door.wall === 'west';
    const crackLength = isVerticalWall ? crackH : crackW;
    const segments = 10;

    const points = isVerticalWall
      ? generateCrackPoints(crackX + WALL_THICKNESS / 2, crackY - crackLength / 2, crackLength, segments, true)
      : generateCrackPoints(crackX - crackLength / 2, crackY + WALL_THICKNESS / 2, crackLength, segments, false);

    this.crackGlowGraphics = this.add.graphics();
    this.crackGlowGraphics.setDepth(95);
    this.crackGlowGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.crackGlowCenter = { x: crackX + (isVerticalWall ? WALL_THICKNESS / 2 : 0), y: crackY + (isVerticalWall ? 0 : WALL_THICKNESS / 2) };
    this.crackGlowSize = { w: isVerticalWall ? WALL_THICKNESS + 8 : crackLength + 8, h: isVerticalWall ? crackLength + 8 : WALL_THICKNESS + 8 };

    // World-space rect of the rift opening, used to keep light spill from
    // passing through it and to drive the proximity crackle.
    this.riftRect = {
      x: this.crackGlowCenter.x - this.crackGlowSize.w / 2 - 12,
      y: this.crackGlowCenter.y - this.crackGlowSize.h / 2 - 12,
      width: this.crackGlowSize.w + 24,
      height: this.crackGlowSize.h + 24,
    };

    const crackGfx = this.add.graphics();
    crackGfx.setDepth(2);

    crackGfx.lineStyle(3, 0x111111, 0.9);
    crackGfx.beginPath();
    crackGfx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      crackGfx.lineTo(points[i].x, points[i].y);
    }
    crackGfx.strokePath();

    const secondaryOffsetX = isVerticalWall ? -2 : 0;
    const secondaryOffsetY = isVerticalWall ? 0 : -2;
    crackGfx.lineStyle(1, 0x222222, 0.6);
    crackGfx.beginPath();
    crackGfx.moveTo(points[0].x + secondaryOffsetX, points[0].y + secondaryOffsetY);
    for (let i = 1; i < points.length; i++) {
      crackGfx.lineTo(points[i].x + secondaryOffsetX, points[i].y + secondaryOffsetY);
    }
    crackGfx.strokePath();
  }

  // The rift is not a doorway: it renders as a sizzling tear of light in the
  // wall, flickering at high frequency with arcing sparks.
  updateCrackGlow(time) {
    if (!this.crackGlowGraphics) return;
    this.crackGlowGraphics.clear();

    const cx = this.crackGlowCenter.x;
    const cy = this.crackGlowCenter.y;
    const hw = this.crackGlowSize.w / 2;
    const hh = this.crackGlowSize.h / 2;

    const sizzle = 0.25 + 0.12 * Math.sin(time * 0.021) * Math.sin(time * 0.0137) + 0.12 * Math.random();
    this.crackGlowGraphics.fillStyle(0xd4c073, sizzle);
    this.crackGlowGraphics.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);

    const core = 0.35 + 0.3 * Math.random();
    this.crackGlowGraphics.fillStyle(0xfff2b0, core);
    this.crackGlowGraphics.fillRect(cx - hw / 3, cy - hh, (hw * 2) / 3, hh * 2);

    const vertical = this.crackGlowSize.h > this.crackGlowSize.w;
    this.crackGlowGraphics.lineStyle(1, 0xffffff, 0.3 + 0.5 * Math.random());
    for (let i = 0; i < 3; i++) {
      const along = Math.random() * 2 - 1;
      const sx = vertical ? cx + (Math.random() * 2 - 1) * hw : cx + along * hw;
      const sy = vertical ? cy + along * hh : cy + (Math.random() * 2 - 1) * hh;
      this.crackGlowGraphics.lineBetween(
        sx, sy,
        sx + (Math.random() * 2 - 1) * 10,
        sy + (Math.random() * 2 - 1) * 10
      );
    }
  }

  zoneTouchesRift(zone) {
    if (!this.riftRect) return false;
    const r = this.riftRect;
    return (
      zone.x < r.x + r.width &&
      zone.x + zone.width > r.x &&
      zone.y < r.y + r.height &&
      zone.y + zone.height > r.y
    );
  }

  // Crossing the rift is a dimensional transition, not a doorway: white-out
  // flash, a jolt, and the crackle peaking as the player passes through.
  // Re-arms when the player returns to the store so every entry transitions.
  updateRiftCrossing() {
    if (this.currentFloor !== 0) return;
    // The one-shot transition fires only when the player passes THROUGH the rift
    // opening into the backrooms, and re-arms only once they are genuinely back
    // inside the store (not merely west of its east edge -- see nextRiftCrossing).
    const { riftCrossed, triggered } = nextRiftCrossing(
      this.player.x, this.player.y, this.entranceRoom, this.riftRect, this.riftCrossed);
    this.riftCrossed = riftCrossed;
    if (triggered) {
      this.cameras.main.flash(500, 235, 225, 190);
      this.cameras.main.shake(250, 0.006);
      this.playSound('stair_transition');
    }
  }

  createStairInfra() {
    this.stairGlowGraphics = this.add.graphics();
    this.stairGlowGraphics.setDepth(1);
    this.stairZones = [];
  }

  // Whether this room has a stair, and which way it goes. Shared by activateRoom
  // (to carve a maze keep-out around the stair) and activateRoomStairs (to build
  // it), so the two never disagree about which rooms get a stair.
  roomStairDirection(room) {
    const isEntranceCell = room.gridX === 0 && room.gridY === 0;
    if (room.floor > 0 && isEntranceCell) return 'up';
    if (!isEntranceCell && hasStairDown(this.floorSeed(room.floor), room.gridX, room.gridY)) return 'down';
    return null;
  }

  // Stairs are deep-links discovered as rooms activate. A non-entrance room with
  // hasStairDown gets a DOWN stair; a non-entrance floor's (0,0) cell gets an UP
  // stair. Direction/target is resolved against the return stack on entry.
  activateRoomStairs(room) {
    const direction = this.roomStairDirection(room);
    if (!direction) return;

    const { x, y } = getStairTopLeft(room);
    const stairGfx = this.add.graphics();
    stairGfx.setDepth(2);
    this.drawStairVisual(stairGfx, x, y, direction);

    const zone = this.add.zone(x + STAIR_SIZE / 2, y + STAIR_SIZE / 2, STAIR_SIZE, STAIR_SIZE);
    this.physics.add.existing(zone, true);
    zone.setData('direction', direction);
    zone.setData('floor', room.floor);
    zone.setData('gx', room.gridX);
    zone.setData('gy', room.gridY);
    zone.setData('glowX', x);
    zone.setData('glowY', y);
    this.physics.add.overlap(this.player, zone, this.onStairEnter, null, this);
    this.stairZones.push(zone);
  }

  drawStairVisual(gfx, x, y, direction) {
    gfx.fillStyle(0x111111, 0.9);
    gfx.fillRect(x, y, STAIR_SIZE, STAIR_SIZE);

    gfx.lineStyle(2, 0x555555, 0.8);
    const stepCount = 5;
    const stepH = STAIR_SIZE / stepCount;
    for (let i = 0; i < stepCount; i++) {
      const sy = direction === 'down' ? y + i * stepH : y + STAIR_SIZE - (i + 1) * stepH;
      const indent = i * 3;
      gfx.beginPath();
      gfx.moveTo(x + indent, sy + stepH);
      gfx.lineTo(x + STAIR_SIZE - indent, sy + stepH);
      gfx.strokePath();
    }

    gfx.lineStyle(1, 0x7733aa, 0.6);
    gfx.strokeRect(x, y, STAIR_SIZE, STAIR_SIZE);
  }

  updateStairGlow(time) {
    if (!this.stairGlowGraphics) return;
    this.stairGlowGraphics.clear();
    const alpha = 0.1 + 0.1 * Math.sin(time * 0.004);
    this.stairGlowGraphics.fillStyle(0x7733aa, alpha);
    const pad = 6;
    for (const zone of this.stairZones) {
      const gx = zone.getData('glowX');
      const gy = zone.getData('glowY');
      this.stairGlowGraphics.fillRect(
        gx - pad, gy - pad,
        STAIR_SIZE + pad * 2, STAIR_SIZE + pad * 2
      );
    }
  }

  onStairEnter(player, stairZone) {
    if (this.isTeleporting || this.dayEnding || this.hidingState.isHiding) return;
    const direction = stairZone.getData('direction');
    const fromFloor = stairZone.getData('floor');

    let destFloor, destGx, destGy;
    if (direction === 'down') {
      this.returnStack.push({
        floor: fromFloor,
        gx: stairZone.getData('gx'),
        gy: stairZone.getData('gy'),
      });
      destFloor = fromFloor + 1;
      destGx = 0;
      destGy = 0;
    } else {
      const back = this.returnStack.pop();
      if (back) {
        destFloor = back.floor;
        destGx = back.gx;
        destGy = back.gy;
      } else {
        // Defensive: an up-stair with nothing to pop returns to the entrance.
        destFloor = 0;
        destGx = 0;
        destGy = 0;
      }
    }

    this.playSound('stair_transition');
    this.isTeleporting = true;
    player.body.stop();
    player.body.enable = false;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    if (this.uiCamera) this.uiCamera.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.currentFloor = destFloor;
      this.ensureRoomsAround(destFloor, destGx, destGy);

      // Land the player below the destination room's centered stair, not on
      // top of it -- otherwise the overlap re-fires the instant isTeleporting
      // clears and the player bounces between floors forever. activateRoom keeps
      // this spot clear of walls/furniture via stairLandingKeepOut.
      const destRoom = this.roomsById.get(this.idForCell(destFloor, destGx, destGy));
      const { x: destX, y: destY } = getStairLandingPosition(destRoom);

      player.body.reset(destX, destY);
      player.body.enable = true;
      // Snap the camera onto the landing while the screen is still black.
      // The camera smooth-follows the player (startFollow lerp 0.1); without an
      // explicit snap it would ease in across the (huge, cross-floor) teleport
      // distance, so the fade-in would reveal the player far off-centre --
      // "dropped in a random place nowhere near the stairs".
      this.cameras.main.centerOn(destX, destY);
      this.combatState = grantInvulnerability(this.combatState, STAIR_SPAWN_PROTECTION_MS);
      this.runStats = updateMaxFloor(this.runStats, destFloor);

      this.cameras.main.fadeIn(300, 0, 0, 0);
      if (this.uiCamera) this.uiCamera.fadeIn(300, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this.isTeleporting = false;
      });
    });
  }

  onDayComplete(newLocation) {
    if (this.dayEnding) return;
    this.playSound('day_complete');
    this.stopAmbientAudio();
    this.dayEnding = true;
    this.player.body.stop();
    this.player.body.enable = false;
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    if (this.uiCamera) this.uiCamera.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('RunSummaryScene', {
        survived: true,
        treasureEarned: this.inventoryState.treasureValue,
        runStats: this.runStats,
        roomsExplored: this.explorationState.visitedRoomIds.size,
        hp: this.combatState.hp,
        maxHp: this.combatState.maxHp,
        newLocation: newLocation || null,
        touchMode: this.touchMode,
      });
    });
  }

  fireBullet() {
    const weapon = getActiveWeapon(this.weaponState);
    this.playSound(`${weapon.id}_fire`);
    const textureKey = `bullet_${weapon.id}`;

    let targetX, targetY;
    if (this.touchMode) {
      targetX = this.player.x + Math.cos(this.playerAngle) * 100;
      targetY = this.player.y + Math.sin(this.playerAngle) * 100;
    } else {
      const pointer = this.input.activePointer;
      targetX = pointer.worldX;
      targetY = pointer.worldY;
    }

    if (this.bulletCount > 1 && this.bulletSpreadAngle > 0) {
      const pellets = calculateShotgunSpread(
        this.player.x, this.player.y,
        targetX, targetY,
        this.bulletSpeed, this.bulletCount, this.bulletSpreadAngle
      );
      for (const pellet of pellets) {
        this.spawnBullet(textureKey, pellet.vx, pellet.vy);
      }
    } else {
      let { vx, vy } = calculateBulletVelocity(
        this.player.x, this.player.y,
        targetX, targetY,
        this.bulletSpeed
      );
      if (vx === 0 && vy === 0) {
        ({ vx, vy } = getBulletVelocityFromAngle(this.playerAngle, this.bulletSpeed));
      }
      this.spawnBullet(textureKey, vx, vy);
    }
  }

  spawnBullet(textureKey, vx, vy) {
    const bullet = this.bulletGroup.get(this.player.x, this.player.y, textureKey);
    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.body.reset(this.player.x, this.player.y);
    bullet.setDepth(150);
    bullet.body.setSize(6, 6, true);
    bullet.setVelocity(vx, vy);
    bullet.setData('originX', this.player.x);
    bullet.setData('originY', this.player.y);
    bullet.setData('damage', this.bulletDamage);
    bullet.setData('range', this.bulletRange);
  }

  // Arcade physics process callback: gunfire is stopped only by tall, solid
  // furniture. Returning false lets the bullet fly over low furniture (tables,
  // desks, beds) without separation or the collide callback firing.
  bulletHitsFurniture(bullet, furnitureZone) {
    return furnitureZone.getData('blocksBullets');
  }

  onBulletHitWall(bullet) {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.body.stop();
  }

  onBulletHitEnemy(bullet, enemySprite) {
    bullet.setActive(false);
    bullet.setVisible(false);
    bullet.body.stop();

    const enemyState = this.enemyStates.find(es => es.sprite === enemySprite);
    if (!enemyState) return;

    const damage = bullet.getData('damage') || this.bulletDamage;
    enemyState.health = applyEnemyDamage(enemyState.health, damage);
    this.playSound('bullet_hit');

    if (isEnemyDead(enemyState.health)) {
      this.runStats = recordKill(this.runStats);
      const dx = enemySprite.x - this.player.x;
      const dy = enemySprite.y - this.player.y;
      const deathDist = Math.sqrt(dx * dx + dy * dy);
      this.playSoundAtDistance(getEnemyDeathSound(enemyState.type), deathDist);
      enemySprite.stop();
      enemySprite.setActive(false);
      enemySprite.body.stop();
      enemySprite.body.enable = false;
      enemySprite.setTint(CORPSE_TINT);
      enemySprite.setAlpha(CORPSE_ALPHA);
      enemySprite.setAngle(CORPSE_ANGLE);
      enemySprite.setDepth(CORPSE_DEPTH);

      const enemyRoom = this.roomsById.get(enemyState.currentRoomId);
      const roomDist = enemyRoom ? enemyRoom.distance : 0;
      const drop = rollEnemyDrop(enemyState.type, roomDist, Math.random);
      if (drop) {
        const dropSprite = this.itemGroup.create(enemySprite.x, enemySprite.y, `item_${drop.type}`);
        dropSprite.setScale(1.6);
        dropSprite.refreshBody();
        dropSprite.setDepth(5);
        dropSprite.setData('itemType', drop.type);
        dropSprite.setData('itemValue', drop.value);
        this.playSoundAtDistance('loot_drop', deathDist);
      }

      this.enemyStates = this.enemyStates.filter(es => es !== enemyState);
    }
  }

  onEnemyContact(player, enemySprite) {
    if (this.hidingState.isHiding) return;

    const enemyState = this.enemyStates.find(es => es.sprite === enemySprite);
    if (!enemyState) return;

    const litRoomIds = getLitRoomIds(this.switchStates);
    if (!litRoomIds.includes(0)) litRoomIds.push(0);
    const inLitRoom = this.level.rooms.some(room =>
      litRoomIds.includes(room.id) && isPointInRoom(room, enemyState.x, enemyState.y)
    );
    if (inLitRoom) return;

    const damage = enemyState.contactDamage;

    const before = this.combatState;
    this.combatState = applyDamage(before, damage);

    if (this.combatState.hp < before.hp) {
      this.playSound('player_damage');
      this.cameras.main.shake(100, 0.01);
      this.triggerDamageFlash();

      if (this.combatState.isDead) {
        this.onPlayerDeath();
      }
    }
  }

  pauseGame() {
    if (this.combatState.isDead || this.dayEnding || this.isTeleporting) return;
    if (this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.launch('PauseScene', { touchMode: this.touchMode });
  }

  onPlayerDeath() {
    this.playSound('player_death');
    this.stopAmbientAudio();
    this.player.body.stop();
    this.player.body.enable = false;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    if (this.uiCamera) this.uiCamera.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('RunSummaryScene', {
        survived: false,
        treasureEarned: 0,
        runStats: this.runStats,
        roomsExplored: this.explorationState.visitedRoomIds.size,
        hp: 0,
        maxHp: this.combatState.maxHp,
        newLocation: null,
        touchMode: this.touchMode,
      });
    });
  }

  updateEnemies(delta) {
    const playerPos = { x: this.player.x, y: this.player.y };
    // Enemy line-of-sight only matters within DETECTION_RANGE of the player,
    // so prefilter the (ever-growing) occluder set once per frame. Maze walls
    // block sight from BOTH sides, so LOS expands them to their full outlines
    // (unlike the flashlight, which only uses their far faces).
    const losSegments = [
      ...filterSegmentsNear(playerPos, DETECTION_RANGE + 60, this.wallSegments),
      ...filterRectsNear(playerPos, DETECTION_RANGE + 60, this.mazeWallRects).flatMap(wallRectSegments),
      ...filterRectsNear(playerPos, DETECTION_RANGE + 60, this.furnitureOccluderRects).flatMap(wallRectSegments),
    ];
    const litRoomIds = getLitRoomIds(this.switchStates);
    if (!litRoomIds.includes(0)) litRoomIds.push(0);
    const litRooms = litRoomIds.map(id => this.level.rooms.find(r => r.id === id)).filter(Boolean);

    if (this.roomGraphDirty || !this.roomGraph) {
      this.roomGraph = buildRoomGraph(this.level.rooms, this.doorStates);
      this.roomGraphDirty = false;
    }

    const playerRoom = getCurrentRoom(playerPos.x, playerPos.y, this.level.rooms);
    const playerRoomId = playerRoom ? playerRoom.id : -1;

    const isInSafeRoom = litRoomIds.includes(playerRoomId);
    this.dangerState = updateDangerTime(this.dangerState, delta, isInSafeRoom);
    while (shouldSpawnWave(this.dangerState)) {
      this.spawnDangerWave(playerRoomId, litRoomIds);
      this.dangerState = advanceWave(this.dangerState);
    }

    const roomEnemyCounts = new Map();
    for (const es of this.enemyStates) {
      const rid = es.currentRoomId;
      roomEnemyCounts.set(rid, (roomEnemyCounts.get(rid) || 0) + 1);
    }

    for (const es of this.enemyStates) {
      es.x = es.sprite.x;
      es.y = es.sprite.y;

      const enemyRoom = getCurrentRoom(es.x, es.y, this.level.rooms);
      if (enemyRoom && enemyRoom.id !== es.currentRoomId) {
        es.currentRoomId = enemyRoom.id;
        es.roomTransitionCooldown = ROOM_TRANSITION_COOLDOWN;
        es.targetDoorway = null;
      }

      const inLitRoom = litRooms.some(room => isPointInRoom(room, es.x, es.y));
      if (inLitRoom) {
        es.sprite.setVelocity(0, 0);
        if (es.type === 'basic') this.applyDirectionalFrame(es.sprite, 'enemy', es.facingAngle, false);
        else es.sprite.play(getAnimKeyForState(es.type, 'idle'), true);
        continue;
      }

      const enemyRoomId = es.currentRoomId;

      let seekDoorway = false;
      let wanderDoorway = null;
      if (es.roomTransitionCooldown <= 0 && es.state === 'idle') {
        const wanderRand = Math.random();
        if (wanderRand < DOORWAY_SEEK_CHANCE) {
          const currentRoom = this.level.rooms.find(r => r.id === enemyRoomId);
          if (currentRoom) {
            const eligibleDoors = currentRoom.doors.filter(d => {
              const dist = getRoomDistance(this.roomGraph, es.spawnRoomId, d.targetRoomId);
              if (dist === -1 || dist > MAX_ROOM_DISTANCE) return false;
              const count = roomEnemyCounts.get(d.targetRoomId) || 0;
              if (count >= MAX_ROOM_ENEMIES) return false;
              return true;
            });
            if (eligibleDoors.length > 0) {
              const pickedIdx = Math.floor(Math.random() * eligibleDoors.length);
              const picked = eligibleDoors[pickedIdx];
              wanderDoorway = getDoorwayCenter(currentRoom, picked);
              seekDoorway = true;
            }
          }
        }
      }

      const navContext = {
        roomTransitionCooldown: es.roomTransitionCooldown,
        targetDoorway: es.targetDoorway,
        doorway: wanderDoorway,
        seekDoorway,
      };

      const oldState = es.state;
      const updated = updateEnemyAI(es, playerPos, losSegments, delta, this.hidingState.isHiding, ENEMY_SPEED_CHASE, navContext);

      const soundResult = getEnemySoundEvent(oldState, updated.state, es.type, es.soundCooldown || 0, delta);
      es.soundCooldown = soundResult.newCooldown;
      if (soundResult.soundKey) {
        const dx = es.x - playerPos.x;
        const dy = es.y - playerPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        this.playSoundAtDistance(soundResult.soundKey, dist);
      }

      es.state = updated.state;
      es.velocityX = updated.velocityX;
      es.velocityY = updated.velocityY;
      es.wanderTimer = updated.wanderTimer;
      es.wanderAngle = updated.wanderAngle;
      es.lastKnownX = updated.lastKnownX;
      es.lastKnownY = updated.lastKnownY;
      es.searchTimer = updated.searchTimer;
      es.attackCooldown = updated.attackCooldown;
      es.roomTransitionCooldown = updated.roomTransitionCooldown;
      es.targetDoorway = updated.targetDoorway;

      if (updated.wantsToFire) {
        this.fireEnemyBullet(es.x, es.y, playerPos.x, playerPos.y);
        const fireSound = getEnemyFireSound(es.type);
        if (fireSound) {
          const fdx = es.x - playerPos.x;
          const fdy = es.y - playerPos.y;
          this.playSoundAtDistance(fireSound, Math.sqrt(fdx * fdx + fdy * fdy));
        }
        es.wantsToFire = false;
      }

      es.sprite.setVelocity(updated.velocityX, updated.velocityY);

      const enemyMoving = updated.velocityX !== 0 || updated.velocityY !== 0;
      if (es.type === 'basic') {
        if (enemyMoving) es.facingAngle = Math.atan2(updated.velocityY, updated.velocityX);
        this.applyDirectionalFrame(es.sprite, 'enemy', es.facingAngle, enemyMoving);
      } else {
        if (enemyMoving) es.sprite.setRotation(Math.atan2(updated.velocityY, updated.velocityX));
        es.sprite.play(getAnimKeyForState(es.type, es.state), true);
      }
    }
  }

  // Set a character sprite to the directional frame for `angle` (8-way snap with
  // left-side facings mirrored). While moving, cycle the walk: base -> _walk0 ->
  // base -> _walk1 (each step pose bobs the body and swings the legs). Replaces
  // the old single-sprite rotation.
  applyDirectionalFrame(sprite, prefix, angle, moving) {
    const { textureKey, flipX } = getDirectionalFrame(prefix, angle);
    let key = textureKey;
    if (moving) {
      const phase = Math.floor(this.time.now / CHARACTER_STEP_MS) % 4;
      if (phase === 1) key = `${textureKey}_walk0`;
      else if (phase === 3) key = `${textureKey}_walk1`;
    }
    sprite.setTexture(key);
    sprite.setFlipX(flipX);
  }

  drawPlayer() {
    const hurt = isInvulnerable(this.combatState);
    const hiding = this.hidingState.isHiding;

    if (hiding) {
      this.player.setAlpha(0.3);
      this.player.setTint(0x336633);
    } else if (hurt) {
      const { alpha, tint } = getHurtFlash(this.combatState.damageCooldown);
      this.player.setAlpha(alpha);
      if (tint !== null) {
        this.player.setTint(tint);
      } else {
        this.player.clearTint();
      }
    } else {
      this.player.setAlpha(1);
      this.player.clearTint();
    }

    const isMoving = this.player.body.velocity.x !== 0 || this.player.body.velocity.y !== 0;
    this.applyDirectionalFrame(this.player, 'player', this.playerAngle || 0, isMoving);
  }

  drawHUD() {
    const gfx = this.hudGraphics;
    gfx.clear();

    const x = 20;
    const y = 20;
    const width = 200;
    const height = 16;
    const fraction = getHealthFraction(this.combatState);

    gfx.fillStyle(0x222222, 0.8);
    gfx.fillRect(x, y, width, height);

    gfx.fillStyle(fraction > 0.3 ? 0x44aa44 : 0xcc3333, 1);
    gfx.fillRect(x, y, width * fraction, height);

    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.strokeRect(x, y, width, height);

    const battY = y + height + 6;
    const battFraction = getBatteryFraction(this.batteryState);
    const lightOn = this.flashlightState.on;

    gfx.fillStyle(0x222222, 0.8);
    gfx.fillRect(x, battY, width, height);

    let battColor = 0xcccc33;
    if (!lightOn) battColor = 0x555555;
    else if (battFraction <= 0.25) battColor = 0xcc3333;
    else if (battFraction <= 0.5) battColor = 0xcc8833;

    gfx.fillStyle(battColor, 1);
    gfx.fillRect(x, battY, width * battFraction, height);

    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.strokeRect(x, battY, width, height);

    if (!lightOn) {
      this.batteryHintText.setText(this.touchMode ? 'FLASHLIGHT OFF -- tap LIGHT' : 'FLASHLIGHT OFF -- press F');
    } else if (this.hidingState.isHiding) {
      this.batteryHintText.setText('Hiding -- flashlight dark');
    } else {
      this.batteryHintText.setText(getBatteryHint(this.batteryState, this.inventoryState) || '');
    }

    this.batteryCountText.setText(`BAT x${this.inventoryState.batteries}`);
    this.treasureText.setText(`$${this.inventoryState.treasureValue}`);
    const isFull = !canPickupItem(this.inventoryState);
    this.capacityText.setColor(isFull ? '#ff4444' : '#cccccc');
    this.capacityText.setText(`[${this.inventoryState.itemCount}/${this.inventoryState.maxItems}]`);

    const weapon = getActiveWeapon(this.weaponState);
    if (weapon) {
      const colorHex = '#' + weapon.color.toString(16).padStart(6, '0');
      this.weaponText.setColor(colorHex);
      const slotIndicator = this.weaponState.slots[1] ? '[Q]' : '';
      const ammoCount = this.weaponState.ammo[this.weaponState.activeSlot];
      this.weaponText.setText(`${weapon.name.toUpperCase()} [${ammoCount}/${weapon.maxAmmo}] ${slotIndicator}`);
    } else {
      this.weaponText.setColor('#666666');
      this.weaponText.setText('UNARMED');
    }

    if (this.dangerState.waveCount > 0) {
      this.dangerText.setText(`DANGER ${this.dangerState.waveCount}`);
    } else {
      this.dangerText.setText('');
    }
  }

  drawMinimap() {
    if (!this.hasMinimap) return;
    const gfx = this.minimapGraphics;
    gfx.clear();

    const data = getWindowedMinimapData(
      this.explorationState,
      this.level.rooms,
      { x: this.player.x, y: this.player.y },
      this.exitPosition,
      this.cameras.main.width,
      this.currentFloor,
      FLOOR_Y_OFFSET,
      MINIMAP_WINDOW_CELLS
    );

    gfx.fillStyle(MINIMAP_COLORS.background, MINIMAP_COLORS.backgroundAlpha);
    gfx.fillRect(data.bgRect.x, data.bgRect.y, data.bgRect.w, data.bgRect.h);

    for (const rect of data.roomRects) {
      if (rect.isCurrent) {
        gfx.fillStyle(MINIMAP_COLORS.current, MINIMAP_COLORS.currentAlpha);
      } else {
        gfx.fillStyle(MINIMAP_COLORS.visited, MINIMAP_COLORS.visitedAlpha);
      }
      gfx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }

    if (this.currentFloor === 0) {
      gfx.fillStyle(MINIMAP_COLORS.exit, 1);
      gfx.fillCircle(data.exitDot.x, data.exitDot.y, 3);
    }

    gfx.fillStyle(MINIMAP_COLORS.player, 1);
    gfx.fillCircle(data.playerDot.x, data.playerDot.y, 2);

    if (this.floorText) {
      this.floorText.setText(`B${this.currentFloor + 1}`);
    }
  }

  setupInput() {
    this.keys = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      Q: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      F: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };

    const coarsePointer = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
    const maxTouchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints || 0) : 0;
    this.touchMode = detectTouchPrimary({ maxTouchPoints, coarsePointer });
    if (this.touchMode && this.input.pointer4 === undefined) {
      this.input.addPointer(3);
    }

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown() && !this.combatState.isDead && !this.dayEnding && !this.hidingState.isHiding) {
        this.onUseBattery();
      }
    });

    this.lastScrollTime = 0;
    this.input.on('wheel', (pointer, currentlyOver, deltaX, deltaY) => {
      if (this.combatState.isDead || this.dayEnding || this.isTeleporting) return;
      const now = this.time.now;
      if (now - this.lastScrollTime < 200) return;
      this.lastScrollTime = now;
      if (deltaY !== 0) {
        this.triggerWeaponSwitch();
      }
    });

    this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
  }

  createTouchControls() {
    if (!this.touchMode) return;

    const layout = computeTouchLayout({
      width: this.scale.width,
      height: this.scale.height,
      stickRadius: TOUCH_STICK_RADIUS,
    });
    const thumbRadius = TOUCH_STICK_RADIUS * 0.45;

    const moveBase = this.add.circle(0, 0, TOUCH_STICK_RADIUS, 0x88cc88, 0.12)
      .setStrokeStyle(2, 0x88cc88, 0.4).setScrollFactor(0).setDepth(TOUCH_UI_DEPTH);
    const moveThumb = this.add.circle(0, 0, thumbRadius, 0x88cc88, 0.35)
      .setScrollFactor(0).setDepth(TOUCH_UI_DEPTH + 1);
    this.moveStick = this.plugins.get('rexVirtualJoystick').add(this, {
      x: layout.moveStick.x,
      y: layout.moveStick.y,
      radius: TOUCH_STICK_RADIUS,
      base: moveBase,
      thumb: moveThumb,
      fixed: true,
      enable: true,
    });

    const aimBase = this.add.circle(0, 0, TOUCH_STICK_RADIUS, 0xccaa55, 0.12)
      .setStrokeStyle(2, 0xccaa55, 0.4).setScrollFactor(0).setDepth(TOUCH_UI_DEPTH);
    const aimThumb = this.add.circle(0, 0, thumbRadius, 0xccaa55, 0.35)
      .setScrollFactor(0).setDepth(TOUCH_UI_DEPTH + 1);
    this.aimStick = this.plugins.get('rexVirtualJoystick').add(this, {
      x: layout.aimStick.x,
      y: layout.aimStick.y,
      radius: TOUCH_STICK_RADIUS,
      base: aimBase,
      thumb: aimThumb,
      fixed: true,
      enable: true,
    });

    this.fireButtonRadius = layout.fireButton.radius;
    this.fireButton = this.add.circle(layout.fireButton.x, layout.fireButton.y, this.fireButtonRadius, 0xcc4444, 0.3)
      .setStrokeStyle(2, 0xff6666, 0.6).setScrollFactor(0).setDepth(TOUCH_UI_DEPTH);
    this.fireButtonLabel = this.add.text(layout.fireButton.x, layout.fireButton.y, 'FIRE', {
      fontSize: '16px', color: '#ffcccc', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(TOUCH_UI_DEPTH + 1);

    const row = layout.actionRow;
    this.useButton = this.makeTouchButton(layout.useButton.x, layout.useButton.y, 'USE', () => this.triggerInteract());
    this.weaponButton = this.makeTouchButton(row.weaponX, row.y, 'WPN', () => this.triggerWeaponSwitch());
    this.batteryButton = this.makeTouchButton(row.batteryX, row.y, 'BATT', () => {
      if (this.combatState.isDead || this.dayEnding || this.hidingState.isHiding) return;
      this.onUseBattery();
    });
    this.lightButton = this.makeTouchButton(row.lightX, row.y, 'LIGHT', () => this.toggleFlashlightAction());

    if (this.scale.fullscreen && this.scale.fullscreen.available) {
      this.fullscreenButton = this.makeTouchButton(layout.fullscreenButton.x, layout.fullscreenButton.y, 'FS', () => {
        if (this.scale.isFullscreen) {
          this.scale.stopFullscreen();
        } else {
          this.scale.startFullscreen();
        }
      });
    }

    this.pauseButton = this.makeTouchButton(layout.pauseButton.x, layout.pauseButton.y, '| |', () => this.pauseGame());

    this.setButtonVisible(this.useButton, false);
    this.setButtonVisible(this.weaponButton, false);

    this.input.once('pointerdown', () => {
      if (this.scale.fullscreen && this.scale.fullscreen.available && !this.scale.isFullscreen) {
        this.scale.startFullscreen();
      }
    });

    const onResize = () => this.layoutTouchControls();
    this.scale.on('resize', onResize);

    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      if (this.moveStick) { this.moveStick.destroy(); this.moveStick = null; }
      if (this.aimStick) { this.aimStick.destroy(); this.aimStick = null; }
    });
  }

  layoutTouchControls() {
    if (!this.touchMode) return;

    const layout = computeTouchLayout({
      width: this.scale.width,
      height: this.scale.height,
      stickRadius: TOUCH_STICK_RADIUS,
    });

    if (this.moveStick) this.moveStick.setPosition(layout.moveStick.x, layout.moveStick.y);
    if (this.aimStick) this.aimStick.setPosition(layout.aimStick.x, layout.aimStick.y);

    if (this.fireButton) {
      this.fireButton.setPosition(layout.fireButton.x, layout.fireButton.y);
      this.fireButtonLabel.setPosition(layout.fireButton.x, layout.fireButton.y);
    }

    const row = layout.actionRow;
    this.moveTouchButton(this.useButton, layout.useButton.x, layout.useButton.y);
    this.moveTouchButton(this.weaponButton, row.weaponX, row.y);
    this.moveTouchButton(this.batteryButton, row.batteryX, row.y);
    this.moveTouchButton(this.lightButton, row.lightX, row.y);
    this.moveTouchButton(this.fullscreenButton, layout.fullscreenButton.x, layout.fullscreenButton.y);
    this.moveTouchButton(this.pauseButton, layout.pauseButton.x, layout.pauseButton.y);

    if (this.floorText) {
      this.floorText.setPosition(this.scale.width - 180, 145);
    }
  }

  moveTouchButton(button, x, y) {
    if (!button) return;
    button.circle.setPosition(x, y);
    button.text.setPosition(x, y);
  }

  makeTouchButton(x, y, label, onTap) {
    const radius = 34;
    const circle = this.add.circle(x, y, radius, 0x224422, 0.4)
      .setStrokeStyle(2, 0x88cc88, 0.5).setScrollFactor(0).setDepth(TOUCH_UI_DEPTH);
    circle.setInteractive(new Phaser.Geom.Circle(radius, radius, radius), Phaser.Geom.Circle.Contains);
    circle.on('pointerdown', (pointer, lx, ly, event) => {
      if (event) event.stopPropagation();
      onTap();
    });
    const text = this.add.text(x, y, label, {
      fontSize: '13px', color: '#aaffaa', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(TOUCH_UI_DEPTH + 1);
    return { circle, text };
  }

  setButtonVisible(button, visible) {
    if (!button) return;
    button.circle.setVisible(visible);
    button.text.setVisible(visible);
    if (visible) {
      button.circle.setInteractive();
    } else {
      button.circle.disableInteractive();
    }
  }

  isFireHeld() {
    if (!this.fireButton) return false;
    const bx = this.fireButton.x;
    const by = this.fireButton.y;
    const r = this.fireButtonRadius;
    const pointers = [
      this.input.pointer1, this.input.pointer2,
      this.input.pointer3, this.input.pointer4,
    ];
    for (const p of pointers) {
      if (p && p.isDown) {
        const dx = p.x - bx;
        const dy = p.y - by;
        if (dx * dx + dy * dy <= r * r) return true;
      }
    }
    return false;
  }

  updateTouchButtons() {
    if (!this.touchMode) return;

    const showUse = this.hidingState.isHiding || !!this.nearestInteractable;
    this.setButtonVisible(this.useButton, showUse);

    const weaponCount = this.weaponState.slots.filter(Boolean).length;
    this.setButtonVisible(this.weaponButton, weaponCount > 1);

    if (this.fireButton) {
      const canShoot = !!getActiveWeapon(this.weaponState) && hasAmmo(this.weaponState) && !this.hidingState.isHiding;
      const alpha = canShoot ? 0.45 : 0.15;
      this.fireButton.setFillStyle(0xcc4444, alpha);
      this.fireButtonLabel.setAlpha(canShoot ? 1 : 0.4);
    }
  }

  triggerWeaponSwitch() {
    if (this.combatState.isDead || this.dayEnding || this.isTeleporting) return;
    this.weaponState = switchWeapon(this.weaponState);
    this.updateWeaponStats();
    this.playSound('weapon_switch');
  }

  toggleFlashlightAction() {
    if (this.combatState.isDead || this.dayEnding || this.isTeleporting) return;
    this.flashlightState = toggleFlashlight(this.flashlightState);
    this.playSound('switch_click');
  }

  triggerInteract() {
    if (this.combatState.isDead || this.dayEnding || this.isTeleporting) return;
    if (this.hidingState.isHiding) {
      this.onExitHiding();
    } else if (this.nearestInteractable) {
      if (this.nearestInteractable.type === 'door') {
        this.onToggleDoor(this.nearestInteractable.item.id);
      } else if (this.nearestInteractable.type === 'switch') {
        this.onToggleSwitch(this.nearestInteractable.item.id);
      } else if (this.nearestInteractable.type === 'furniture') {
        this.onEnterHiding(this.nearestInteractable.item);
      } else if (this.nearestInteractable.type === 'weapon') {
        this.onWeaponPickup(this.nearestInteractable.item);
      }
    }
  }

  onWeaponPickup(wpnSprite) {
    const weaponId = wpnSprite.getData('weaponId');
    const weaponType = WEAPON_TYPES.find(w => w.id === weaponId);
    if (!weaponType) return;

    const savedAmmo = wpnSprite.getData('weaponAmmo');
    const result = pickupWeapon(this.weaponState, weaponType, savedAmmo);
    this.weaponState = result.state;
    this.updateWeaponStats();
    this.playSound('item_pickup');

    wpnSprite.setActive(false);
    wpnSprite.setVisible(false);
    this.weaponPickupSprites = this.weaponPickupSprites.filter(s => s !== wpnSprite);

    if (result.droppedWeapon) {
      const dropSprite = this.add.sprite(
        this.player.x, this.player.y,
        `pickup_${result.droppedWeapon.id}`
      );
      dropSprite.setScale(1.5);
      dropSprite.setDepth(5);
      dropSprite.setData('weaponId', result.droppedWeapon.id);
      dropSprite.setData('weaponAmmo', result.droppedWeapon.ammo);
      this.weaponPickupSprites.push(dropSprite);
    }
  }

  onUseBattery() {
    const result = useBattery(this.inventoryState);
    if (result.used) {
      this.inventoryState = result.state;
      this.batteryState = rechargeBattery(this.batteryState, BATTERY_RECHARGE_AMOUNT);
      this.playSound('battery_recharge');
    }
  }

  setupCamera() {
    // The world is effectively unbounded; use a large fixed region so lazily
    // generated rooms (in any direction, on any floor band) always fit.
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(-WORLD_BOUND, -WORLD_BOUND, WORLD_BOUND * 2, WORLD_BOUND * 2);
    this.physics.world.setBounds(-WORLD_BOUND, -WORLD_BOUND, WORLD_BOUND * 2, WORLD_BOUND * 2);
  }

  // Zoom the world in for a claustrophobic, "everything is closer" feel and pin
  // the HUD to its own un-zoomed camera. Phaser's setZoom() scales scrollFactor-0
  // objects too, so the HUD needs a dedicated camera. The main camera ignores
  // HUD objects; the UI camera ignores world objects. Objects created later
  // (pooled bullets, spawned enemies, loot, the lore popup) are routed by the
  // `_buildingHud` flag because ADDED_TO_SCENE fires before chained
  // setScrollFactor() runs, so scrollFactor can't be read in the listener.
  setupCameraLayers() {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setName('ui');

    const { hud, world } = partitionSceneObjects(this.children.list);
    this.cameras.main.ignore(hud);
    this.uiCamera.ignore(world);

    this._buildingHud = false;
    this._routeNewObject = (obj) => {
      if (this._buildingHud) this.cameras.main.ignore(obj);
      else this.uiCamera.ignore(obj);
    };
    this.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this._routeNewObject);
    this.events.once('shutdown', () => {
      this.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this._routeNewObject);
    });

    this.cameras.main.setZoom(CAMERA_ZOOM);
  }

  createDarknessOverlay() {
    this.darkGraphics = this.add.graphics();
    this.darkGraphics.setDepth(100);

    this.lightGraphics = this.add.graphics();
    this.lightGraphics.setDepth(99);

    this.maskGraphics = this.make.graphics({ add: false });
    const bitmapMask = new Phaser.Display.Masks.BitmapMask(this, this.maskGraphics);
    bitmapMask.invertAlpha = true;
    this.darkGraphics.setMask(bitmapMask);

    // Red damage tint shown when the player is shot. Depth 190 keeps it BELOW the
    // player (200) so it reddens the world for feedback but never covers the
    // player -- a world object the main camera draws and the HUD camera ignores.
    this.damageFlashGraphics = this.add.graphics();
    this.damageFlashGraphics.setDepth(190);
    this.damageFlashRemaining = 0;
  }

  // Start the red damage tint (replaces the old full-opacity camera flash that
  // erased the whole screen, player included, on every hit).
  triggerDamageFlash() {
    this.damageFlashRemaining = DAMAGE_FLASH_DURATION_MS;
  }

  // Repaint the damage tint each frame as it decays. Fills the camera's world
  // view (so it covers the viewport at any zoom/scroll, like the darkness) at the
  // capped, fading alpha from getDamageFlashAlpha -- never fully opaque.
  updateDamageFlash(delta) {
    this.damageFlashGraphics.clear();
    if (this.damageFlashRemaining <= 0) return;
    this.damageFlashRemaining = Math.max(0, this.damageFlashRemaining - delta);
    const alpha = getDamageFlashAlpha(this.damageFlashRemaining);
    if (alpha <= 0) return;
    const v = this.cameras.main.worldView;
    const pad = 100;
    this.damageFlashGraphics.fillStyle(0xff0000, alpha);
    this.damageFlashGraphics.fillRect(v.x - pad, v.y - pad, v.width + pad * 2, v.height + pad * 2);
  }

  drawPolygon(gfx, polygon) {
    gfx.beginPath();
    gfx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) {
      gfx.lineTo(polygon[i].x, polygon[i].y);
    }
    gfx.closePath();
    gfx.fillPath();
  }

  // Stacked concentric circles of fixed per-ring alpha approximate a radial
  // gradient: every ring covers the centre and fewer cover the rim, so alpha
  // accumulates to a bright core that fades smoothly to the edge.
  drawRadialGlow(gfx, x, y, radius, steps, color, ringAlpha) {
    for (let i = steps; i >= 1; i--) {
      gfx.fillStyle(color, ringAlpha);
      gfx.fillCircle(x, y, (radius * i) / steps);
    }
  }

  updateDarkness(time) {
    this.darkGraphics.clear();
    this.lightGraphics.clear();
    this.maskGraphics.clear();

    // Cover the full visible viewport regardless of (unbounded) world size.
    const cam = this.cameras.main;
    const view = cam.worldView;
    const pad = 100;
    this.darkGraphics.fillStyle(0x000000, 0.95);
    this.darkGraphics.fillRect(view.x - pad, view.y - pad, view.width + pad * 2, view.height + pad * 2);

    const litRoomIds = getLitRoomIds(this.switchStates);
    if (!litRoomIds.includes(0)) litRoomIds.push(0);
    for (const roomId of litRoomIds) {
      const room = this.level.rooms.find(r => r.id === roomId);
      if (!room) continue;
      this.maskGraphics.fillStyle(0xffffff);
      this.maskGraphics.fillRect(room.x, room.y, room.width, room.height);
      this.lightGraphics.fillStyle(0xffffcc, 0.05);
      this.lightGraphics.fillRect(room.x, room.y, room.width, room.height);
    }

    // No light leaks through the rift in either direction -- the backrooms
    // must stay invisible until the player passes through.
    const spillZones = getLightSpillZones(this.level.rooms, litRoomIds, this.doorStates)
      .filter(zone => !this.zoneTouchesRift(zone));
    for (const zone of spillZones) {
      this.maskGraphics.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff,
        zone.alphas.topLeft, zone.alphas.topRight, zone.alphas.bottomLeft, zone.alphas.bottomRight);
      this.maskGraphics.fillRect(zone.x, zone.y, zone.width, zone.height);
      this.lightGraphics.fillGradientStyle(0xffffcc, 0xffffcc, 0xffffcc, 0xffffcc,
        zone.alphas.topLeft * 0.05, zone.alphas.topRight * 0.05,
        zone.alphas.bottomLeft * 0.05, zone.alphas.bottomRight * 0.05);
      this.lightGraphics.fillRect(zone.x, zone.y, zone.width, zone.height);
    }

    if (!isFlashlightLit(this.flashlightState)) return;

    const coneAngle = getFlashlightConeAngle(this.batteryState, this.flashlightAngle);
    if (coneAngle <= 0 || shouldFlicker(this.batteryState, time)) return;

    const aim = this.playerAngle || 0;
    const origin = {
      x: this.player.x + Math.cos(aim) * FLASHLIGHT_MUZZLE_OFFSET,
      y: this.player.y + Math.sin(aim) * FLASHLIGHT_MUZZLE_OFFSET,
    };
    // Maze walls only contribute their far faces (back-face culling), so the
    // cone reaches across each wall band to light its near face -- walls read
    // as solid bands of thickness instead of infinitely-thin shadow lines.
    const occluders = [
      ...filterSegmentsNear(origin, FLASHLIGHT_RANGE, this.wallSegments),
      ...filterRectsNear(origin, FLASHLIGHT_RANGE, this.mazeWallRects).flatMap(r => wallRectOccluders(r, origin)),
      ...filterRectsNear(origin, FLASHLIGHT_RANGE, this.furnitureOccluderRects).flatMap(r => wallRectOccluders(r, origin)),
    ];
    const polygon = getFlashlightPolygon(
      origin,
      aim,
      coneAngle,
      occluders,
      FLASHLIGHT_RANGE
    );

    if (polygon.length >= 3) {
      this.maskGraphics.fillStyle(0xffffff);
      this.drawPolygon(this.maskGraphics, polygon);

      this.lightGraphics.fillStyle(0xffffcc, 0.05);
      this.drawPolygon(this.lightGraphics, polygon);
    }

    // Diffuse near-field pool centred on the player so the beam doesn't read as a
    // hard point at the cone apex. Drawn unoccluded (small radius), on top of the
    // cone, in both the reveal mask and the warm light tint.
    this.drawRadialGlow(this.maskGraphics, this.player.x, this.player.y,
      FLASHLIGHT_NEARFIELD_RADIUS, FLASHLIGHT_NEARFIELD_STEPS, 0xffffff, 0.09);
    this.drawRadialGlow(this.lightGraphics, this.player.x, this.player.y,
      FLASHLIGHT_NEARFIELD_RADIUS, FLASHLIGHT_NEARFIELD_STEPS, 0xffffcc, 0.003);
  }

  updateBullets() {
    for (const bullet of this.bulletGroup.getChildren()) {
      if (!bullet.active) continue;
      const originX = bullet.getData('originX');
      const originY = bullet.getData('originY');
      const range = bullet.getData('range') || this.bulletRange;
      if (isBulletExpired(originX, originY, bullet.x, bullet.y, range)) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();
      }
    }
  }

  update(time, delta) {
    if (this.combatState.isDead || this.dayEnding || this.isTeleporting) return;

    this.runStats = updateTime(this.runStats, delta);

    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    const pointerAngle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.worldX,
      pointer.worldY
    );

    let aimActive = false;
    let aimAngle = this.playerAngle;
    if (this.touchMode && this.aimStick) {
      aimActive = this.aimStick.force > TOUCH_STICK_DEADZONE_PX;
      aimAngle = this.aimStick.rotation;
    }
    this.playerAngle = resolveAimAngle({
      touchMode: this.touchMode,
      aimActive,
      aimAngle,
      pointerAngle,
      lastAngle: this.playerAngle,
    });

    const keyState = {
      up: this.keys.W.isDown,
      down: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
    };

    const moveSpeed = this.hidingState.isHiding
      ? this.playerSpeed * HIDING_SPEED_MULTIPLIER
      : this.playerSpeed;
    const keyboardVelocity = calculateVelocity(keyState, moveSpeed);

    let moveActive = false;
    let stickVelocity = { x: 0, y: 0 };
    if (this.touchMode && this.moveStick) {
      moveActive = this.moveStick.force > TOUCH_STICK_DEADZONE_PX;
      const moveForce = Math.min(this.moveStick.force / TOUCH_STICK_RADIUS, 1);
      stickVelocity = getMoveVelocity(this.moveStick.rotation, moveForce, moveSpeed);
    }
    const velocity = resolveMoveVelocity({
      touchMode: this.touchMode,
      moveActive,
      stickVelocity,
      keyboardVelocity,
    });
    this.player.setVelocity(velocity.x, velocity.y);

    this.combatState = updateCombat(this.combatState, delta);
    this.batteryState = updateBatteryWithFlashlight(this.batteryState, this.flashlightState, delta, this.hasRechargeBattery ? BATTERY_RECHARGE_PER_MS : 0);
    this.fireCooldown = updateFireCooldown(this.fireCooldown, delta);

    const fireButtonDown = this.touchMode ? this.isFireHeld() : false;
    const wantFire = resolveFireIntent({
      touchMode: this.touchMode,
      fireButtonDown,
      leftButtonDown: pointer.leftButtonDown(),
    });
    this.gunshotAlertCooldown = Math.max(0, this.gunshotAlertCooldown - delta);
    if (!this.hidingState.isHiding && wantFire && canFire(this.fireCooldown) && getActiveWeapon(this.weaponState) && hasAmmo(this.weaponState)) {
      this.fireBullet();
      this.weaponState = consumeAmmo(this.weaponState);
      this.fireCooldown = this.fireRate;

      if (this.gunshotAlertCooldown <= 0 && this.roomGraph) {
        const weapon = getActiveWeapon(this.weaponState);
        const playerRoom = getCurrentRoom(this.player.x, this.player.y, this.level.rooms);
        if (playerRoom && weapon) {
          const alertedIndices = getAlertedEnemies(this.enemyStates, this.roomGraph, playerRoom.id, weapon.noiseRange);
          for (const idx of alertedIndices) {
            this.enemyStates[idx].state = 'chase';
            this.enemyStates[idx].lastKnownX = this.player.x;
            this.enemyStates[idx].lastKnownY = this.player.y;
          }
          if (alertedIndices.length > 0) {
            this.gunshotAlertCooldown = GUNSHOT_ALERT_COOLDOWN;
          }
        }
      }
    }

    this.updateInteractPrompt();
    this.updateTouchButtons();

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) {
      this.triggerWeaponSwitch();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      this.triggerInteract();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.F)) {
      this.toggleFlashlightAction();
    }

    this.ensureRoomsAroundPlayer();
    this.updateRiftCrossing();

    this.updateBullets();
    this.updateEnemyBullets();
    this.updateEnemies(delta);
    this.drawPlayer();
    this.updateDarkness(time);
    this.updateDamageFlash(delta);
    this.updateCrackGlow(time);
    this.updateStairGlow(time);
    this.drawDoors();
    this.drawSwitches();
    this.explorationState = updateExploration(this.explorationState, this.player.x, this.player.y, this.level.rooms);
    this.drawHUD();
    this.drawMinimap();

    if (this.audioReady) {
      this.updateRiftCrackle();

      const speed = Math.sqrt(this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2);
      const interval = getFootstepInterval(speed);
      this.footstepTimer += delta;
      if (this.footstepTimer >= interval) {
        this.playSound('footstep');
        this.footstepTimer = 0;
      }

      const batteryFraction = this.batteryState.charge / this.batteryState.maxCharge;
      const isLow = isFlashlightLit(this.flashlightState) && batteryFraction > 0 && batteryFraction <= 0.25;
      if (isLow) {
        this.batteryWarningTimer += delta;
        if (this.batteryWarningTimer >= 3000) {
          this.playSound('battery_warning');
          this.batteryWarningTimer = 0;
        }
      } else {
        this.batteryWarningTimer = 0;
      }
    }
  }
}
