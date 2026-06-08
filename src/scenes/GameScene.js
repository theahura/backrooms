import Phaser from 'phaser';
import { calculateVelocity } from '../systems/movement.js';
import { createFurnitureSegments, generateRoomFurniture, FURNITURE_TYPES } from '../systems/furniture.js';
import { generateMazeWalls } from '../systems/maze.js';
import { getFlashlightPolygon } from '../systems/visibility.js';
import { generateMultiFloorLevel, getFloorBounds, getFloorRoomCounts, STAIR_SIZE } from '../systems/stairs.js';
import { generateRoomEnemies, updateEnemyAI, ENEMY_SPEED_CHASE, CRAWLER_CHASE_SPEED, SPITTER_CHASE_SPEED } from '../systems/enemy.js';
import { createCombatState, applyDamage, updateCombat, getHealthFraction, isInvulnerable, applyEnemyDamage, isEnemyDead, ENEMY_CONTACT_DAMAGE, ENEMY_MAX_HP, CRAWLER_MAX_HP, SPITTER_MAX_HP, CRAWLER_CONTACT_DAMAGE, SPITTER_CONTACT_DAMAGE, SPITTER_PROJECTILE_DAMAGE } from '../systems/combat.js';
import { calculateBulletVelocity, calculateShotgunSpread, canFire, updateFireCooldown, isBulletExpired, SPITTER_PROJECTILE_SPEED, SPITTER_PROJECTILE_RANGE } from '../systems/shooting.js';
import { WEAPON_TYPES, createWeaponState, switchWeapon, pickupWeapon, getActiveWeapon, getEffectiveStats, generateLevelWeapons, hasAmmo, consumeAmmo, addAmmo, AMMO_PER_PICKUP } from '../systems/weapons.js';
import { getEnemyHP, getEnemyCount, getEnemyChaseSpeed, getEnemyDamage } from '../systems/scaling.js';
import { createBatteryState, updateBattery, getBatteryFraction, getFlashlightConeAngle, shouldFlicker, rechargeBattery, BATTERY_RECHARGE_AMOUNT } from '../systems/battery.js';
import { generateRoomItems, ITEM_TYPES } from '../systems/items.js';
import { createInventoryState, pickupItem, useBattery, canPickupItem } from '../systems/inventory.js';
import { getUpgradeValue, createShopState } from '../systems/shop.js';
import { createDoorStates, toggleDoor, getDoorCenter, findNearestDoor, DOOR_INTERACT_RANGE } from '../systems/doors.js';
import { createSwitchStates, toggleSwitch, findNearestSwitch, getLitRoomIds, isPointInRoom, SWITCH_INTERACT_RANGE } from '../systems/lightswitch.js';
import { createHidingState, enterHiding, exitHiding, findNearestHideable, HIDE_INTERACT_RANGE, HIDING_SPEED_MULTIPLIER } from '../systems/hiding.js';
import { saveGame } from '../systems/persistence.js';
import { createExplorationState, updateExploration, getMinimapData, getCurrentRoom, MINIMAP_COLORS } from '../systems/exploration.js';
import { generateCrackPoints } from '../systems/startroom.js';
import { getLocation, getLocationLayout, getLocationExitPosition, generateAlternateExit } from '../systems/locations.js';
import { generateRoomLore } from '../systems/lore.js';
import { buildRoomGraph, bfsFromRoom, getNextDoorway, getRoomDistance, getDoorwayCenter, DOORWAY_SEEK_CHANCE, ROOM_TRANSITION_COOLDOWN, MAX_ROOM_DISTANCE, MAX_ROOM_ENEMIES } from '../systems/pathfinding.js';

const WALL_THICKNESS = 16;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
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
    this.hasMinimap = (levels.minimap || 0) > 0;
    this.weaponState = createWeaponState({ startingPistol: hasStartingPistol });
    this.updateWeaponStats();

    const runCount = this.registry.get('runCount') ?? 0;
    this.registry.set('runCount', runCount + 1);
    this.levelSeed = runCount + 1;
    this.runCount = runCount;
    this.scaledEnemyHP = getEnemyHP(ENEMY_MAX_HP, runCount);
    this.scaledCrawlerHP = getEnemyHP(CRAWLER_MAX_HP, runCount);
    this.scaledSpitterHP = getEnemyHP(SPITTER_MAX_HP, runCount);
    this.scaledEnemyChaseSpeed = getEnemyChaseSpeed(ENEMY_SPEED_CHASE, runCount);
    this.scaledCrawlerChaseSpeed = getEnemyChaseSpeed(CRAWLER_CHASE_SPEED, runCount);
    this.scaledSpitterChaseSpeed = getEnemyChaseSpeed(SPITTER_CHASE_SPEED, runCount);
    this.scaledEnemyDamage = getEnemyDamage(ENEMY_CONTACT_DAMAGE, runCount);
    this.scaledCrawlerDamage = getEnemyDamage(CRAWLER_CONTACT_DAMAGE, runCount);
    this.scaledSpitterDamage = getEnemyDamage(SPITTER_CONTACT_DAMAGE, runCount);
    this.extraEnemyCount = getEnemyCount(runCount);
    this.collectedLore = new Set(this.registry.get('collectedLore') ?? []);
    this.activeLocation = this.registry.get('activeLocation') ?? 'store';
    this.activeLocationData = getLocation(this.activeLocation) || getLocation('store');
    this.unlockedLocations = this.registry.get('unlockedLocations') ?? ['store'];
    saveGame(shopState || createShopState(), runCount + 1, [...this.collectedLore], this.unlockedLocations, this.activeLocation);
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
    this.level = generateMultiFloorLevel(this.levelSeed, getFloorRoomCounts(this.runCount));
    this.walls = this.physics.add.staticGroup();
    this.furnitureGroup = this.physics.add.staticGroup();
    this.wallSegments = [...this.level.wallSegments];

    this.roomFurniture = new Map();
    this.combatState = createCombatState(this.maxHp);
    this.batteryState = createBatteryState(this.maxCharge);
    this.inventoryState = createInventoryState(this.maxItems);
    this.fireCooldown = 0;
    this.dayEnding = false;
    this.isTeleporting = false;
    this.currentFloor = 0;
    this.hidingState = createHidingState();
    this.explorationState = createExplorationState();

    this.roomGraph = null;
    this.roomGraphDirty = true;

    this.createRooms();
    this.createDoors();
    this.createSwitches();
    this.createPlayer();
    this.createEnemies();
    this.createItemTextures();
    this.createItems();
    this.createLoreItems();
    this.createBullets();
    this.createEnemyBullets();
    this.createWeaponPickups();
    this.createExitZone();
    this.createStairs();
    this.createAlternateExits();
    this.createCrackVisual();
    this.setupInput();
    this.setupCamera();
    this.createDarknessOverlay();
    this.createHUD();
  }

  createRooms() {
    const gfx = this.add.graphics();
    const furnitureGfx = this.add.graphics();
    furnitureGfx.setDepth(50);

    for (const room of this.level.rooms) {
      this.drawRoom(gfx, room);
      this.createRoomPhysics(room);
      this.createRoomFurniture(furnitureGfx, room);
      if (room.id !== 0) {
        this.createRoomMaze(gfx, room);
      }
    }

    this.drawDoorways(gfx);
  }

  drawRoom(gfx, room) {
    const floorColor = room.id === 0 ? this.activeLocationData.floorColor : 0x333333;
    const wallColor = room.id === 0 ? this.activeLocationData.wallColor : 0x555555;

    gfx.fillStyle(floorColor, 1);
    gfx.fillRect(room.x, room.y, room.width, room.height);

    gfx.fillStyle(wallColor, 1);
    gfx.fillRect(room.x, room.y, room.width, WALL_THICKNESS);
    gfx.fillRect(room.x, room.y + room.height - WALL_THICKNESS, room.width, WALL_THICKNESS);
    gfx.fillRect(room.x, room.y, WALL_THICKNESS, room.height);
    gfx.fillRect(room.x + room.width - WALL_THICKNESS, room.y, WALL_THICKNESS, room.height);
  }

  drawDoorways(gfx) {
    for (const room of this.level.rooms) {
      const floorColor = room.id === 0 ? this.activeLocationData.floorColor : 0x333333;
      gfx.fillStyle(floorColor, 1);
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

  createRoomFurniture(gfx, room) {
    const furniture = room.id === 0
      ? getLocationLayout(this.activeLocation, room.x, room.y, room.width, room.height, WALL_THICKNESS)
      : generateRoomFurniture(room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed);
    this.roomFurniture.set(room.id, furniture);

    for (const item of furniture) {
      gfx.fillStyle(item.color, 1);
      gfx.fillRect(item.x, item.y, item.width, item.height);

      const zone = this.add.zone(
        item.x + item.width / 2,
        item.y + item.height / 2,
        item.width,
        item.height
      );
      this.furnitureGroup.add(zone);

      if (FURNITURE_TYPES[item.type] && FURNITURE_TYPES[item.type].blocksLight) {
        const segments = createFurnitureSegments(item.x, item.y, item.width, item.height);
        this.wallSegments.push(...segments);
      }
    }
  }

  createRoomMaze(gfx, room) {
    const mazeSegments = generateMazeWalls(room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed, room.doors);
    for (const seg of mazeSegments) {
      this.wallSegments.push(seg);

      const isHorizontal = Math.abs(seg.y2 - seg.y1) < 1;
      const length = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.y2 - seg.y1) ** 2);
      if (isHorizontal) {
        const cx = (seg.x1 + seg.x2) / 2;
        const cy = seg.y1;
        this.walls.add(this.add.zone(cx, cy, length, WALL_THICKNESS));
      } else {
        const cx = seg.x1;
        const cy = (seg.y1 + seg.y2) / 2;
        this.walls.add(this.add.zone(cx, cy, WALL_THICKNESS, length));
      }

      gfx.fillStyle(0x555555, 1);
      if (isHorizontal) {
        gfx.fillRect(Math.min(seg.x1, seg.x2), seg.y1 - WALL_THICKNESS / 2, length, WALL_THICKNESS);
      } else {
        gfx.fillRect(seg.x1 - WALL_THICKNESS / 2, Math.min(seg.y1, seg.y2), WALL_THICKNESS, length);
      }
    }
  }

  createDoors() {
    this.doorStates = createDoorStates(this.level.rooms, this.levelSeed);
    this.doorGroup = this.physics.add.staticGroup();
    this.doorZones = new Map();
    this.doorGraphics = this.add.graphics();
    this.doorGraphics.setDepth(50);

    for (const door of this.doorStates) {
      const center = getDoorCenter(door, this.level.rooms);
      const isHorizontal = door.wall === 'north' || door.wall === 'south';
      const zoneW = isHorizontal ? door.width : WALL_THICKNESS;
      const zoneH = isHorizontal ? WALL_THICKNESS : door.width;

      const zone = this.add.zone(center.x, center.y, zoneW, zoneH);
      this.doorGroup.add(zone);

      if (door.isClosed) {
        this.wallSegments.push(door.segment);
      } else {
        zone.body.enable = false;
      }

      this.doorZones.set(door.id, zone);
    }

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

  createSwitches() {
    this.switchStates = createSwitchStates(this.level.rooms, this.levelSeed, WALL_THICKNESS);
    this.switchGraphics = this.add.graphics();
    this.switchGraphics.setDepth(50);
  }

  onToggleSwitch(switchId) {
    this.switchStates = toggleSwitch(this.switchStates, switchId);
    const sw = this.switchStates.find(s => s.id === switchId);
    if (!sw || !sw.isOn) return;

    const room = this.level.rooms.find(r => r.id === sw.roomId);
    if (!room) return;

    const toRemove = this.enemyStates.filter(es =>
      isPointInRoom(room, es.sprite.x, es.sprite.y)
    );
    for (const es of toRemove) {
      es.sprite.setActive(false);
      es.sprite.setVisible(false);
      es.sprite.body.stop();
      es.sprite.body.enable = false;
    }
    this.enemyStates = this.enemyStates.filter(es =>
      !toRemove.includes(es)
    );
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
  }

  onEnterHiding(furniture) {
    this.hidingState = enterHiding(this.hidingState, furniture);
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
    this.hidingState = exitHiding(this.hidingState);
    this.player.body.setBoundsRectangle(null);
    this.player.body.setCollideWorldBounds(false);
    this.playerFurnitureCollider.active = true;
  }

  drawDoors() {
    this.doorGraphics.clear();
    for (const door of this.doorStates) {
      if (!door.isClosed) continue;
      const center = getDoorCenter(door, this.level.rooms);
      const isHorizontal = door.wall === 'north' || door.wall === 'south';
      const w = isHorizontal ? door.width : WALL_THICKNESS;
      const h = isHorizontal ? WALL_THICKNESS : door.width;

      this.doorGraphics.fillStyle(0x664422, 1);
      this.doorGraphics.fillRect(center.x - w / 2, center.y - h / 2, w, h);
    }
  }

  drawSwitches() {
    this.switchGraphics.clear();
    for (const sw of this.switchStates) {
      this.switchGraphics.fillStyle(sw.isOn ? 0xffff44 : 0xcccccc, 1);
      this.switchGraphics.fillRect(sw.x - 5, sw.y - 7, 10, 14);
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

  createItemTextures() {
    for (const itemType of ITEM_TYPES) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(itemType.color, 1);
      if (itemType.type === 'gem') {
        gfx.fillTriangle(
          itemType.size.w / 2, 0,
          0, itemType.size.h,
          itemType.size.w, itemType.size.h
        );
      } else {
        gfx.fillRect(0, 0, itemType.size.w, itemType.size.h);
      }
      gfx.generateTexture(`item_${itemType.type}`, itemType.size.w, itemType.size.h);
      gfx.destroy();
    }
  }

  createItems() {
    this.itemGroup = this.physics.add.staticGroup();

    for (const room of this.level.rooms) {
      const furniture = this.roomFurniture.get(room.id) || [];
      const items = generateRoomItems(
        room.x, room.y, room.width, room.height,
        WALL_THICKNESS, room.seed, furniture, room.id
      );

      for (const item of items) {
        const sprite = this.itemGroup.create(item.x, item.y, `item_${item.type}`);
        sprite.setDepth(5);
        sprite.setData('itemType', item.type);
        sprite.setData('itemValue', item.value);
      }
    }

    this.physics.add.overlap(this.player, this.itemGroup, this.onItemPickup, null, this);
  }

  onItemPickup(player, itemSprite) {
    if (!itemSprite.active) return;
    if (!canPickupItem(this.inventoryState)) return;
    const itemType = itemSprite.getData('itemType');
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
    }
    itemSprite.destroy();
  }

  createLoreItems() {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xddccaa, 1);
    gfx.fillRect(0, 0, 12, 10);
    gfx.lineStyle(1, 0x998866, 0.8);
    gfx.beginPath();
    gfx.moveTo(2, 3);
    gfx.lineTo(10, 3);
    gfx.moveTo(2, 5);
    gfx.lineTo(10, 5);
    gfx.moveTo(2, 7);
    gfx.lineTo(8, 7);
    gfx.strokePath();
    gfx.generateTexture('lore_note', 12, 10);
    gfx.destroy();

    this.loreGroup = this.physics.add.staticGroup();

    for (const room of this.level.rooms) {
      const furniture = this.roomFurniture.get(room.id) || [];
      const loreItems = generateRoomLore(
        room.x, room.y, room.width, room.height,
        WALL_THICKNESS, room.seed, furniture, room.id, this.collectedLore
      );

      for (const item of loreItems) {
        const sprite = this.loreGroup.create(item.x, item.y, 'lore_note');
        sprite.setDepth(5);
        sprite.setData('loreId', item.loreId);
        sprite.setData('loreText', item.text);
      }
    }

    this.physics.add.overlap(this.player, this.loreGroup, this.onLorePickup, null, this);
    this.lorePopup = null;
  }

  onLorePickup(player, loreSprite) {
    if (!loreSprite.active) return;
    if (this.dayEnding || this.isTeleporting) return;

    const loreId = loreSprite.getData('loreId');
    const loreText = loreSprite.getData('loreText');

    this.collectedLore.add(loreId);
    this.registry.set('collectedLore', [...this.collectedLore]);

    loreSprite.destroy();
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
    const spawnRoom = this.level.rooms[0];
    const playerX = spawnRoom.x + spawnRoom.width / 2;
    const playerY = spawnRoom.y + spawnRoom.height / 2;

    this.player = this.physics.add.sprite(playerX, playerY, '__DEFAULT');
    this.player.setVisible(false);

    this.playerGraphics = this.add.graphics();
    this.playerGraphics.setDepth(200);
    this.player.body.setSize(20, 20, true);

    this.physics.add.collider(this.player, this.walls);
    this.playerFurnitureCollider = this.physics.add.collider(this.player, this.furnitureGroup);
    this.physics.add.collider(this.player, this.doorGroup);
  }

  createEnemyTextures() {
    const basicGfx = this.make.graphics({ add: false });
    basicGfx.fillStyle(0xcc3333, 1);
    basicGfx.fillCircle(10, 10, 10);
    basicGfx.fillStyle(0x992222, 1);
    basicGfx.fillCircle(7, 7, 3);
    basicGfx.fillCircle(13, 7, 3);
    basicGfx.generateTexture('enemy', 20, 20);
    basicGfx.destroy();

    const crawlerGfx = this.make.graphics({ add: false });
    crawlerGfx.fillStyle(0x9933cc, 1);
    crawlerGfx.fillCircle(7, 7, 7);
    crawlerGfx.generateTexture('crawler', 14, 14);
    crawlerGfx.destroy();

    const spitterGfx = this.make.graphics({ add: false });
    spitterGfx.fillStyle(0x3399cc, 1);
    spitterGfx.fillCircle(10, 10, 10);
    spitterGfx.fillStyle(0x226688, 1);
    spitterGfx.fillCircle(7, 7, 3);
    spitterGfx.fillCircle(13, 7, 3);
    spitterGfx.fillStyle(0x44bbdd, 1);
    spitterGfx.fillCircle(10, 13, 3);
    spitterGfx.generateTexture('spitter', 20, 20);
    spitterGfx.destroy();
  }

  getEnemyStats(type) {
    if (type === 'crawler') return { hp: this.scaledCrawlerHP, contactDamage: this.scaledCrawlerDamage, textureKey: 'crawler', bodySize: 12 };
    if (type === 'spitter') return { hp: this.scaledSpitterHP, contactDamage: this.scaledSpitterDamage, textureKey: 'spitter', bodySize: 16 };
    return { hp: this.scaledEnemyHP, contactDamage: this.scaledEnemyDamage, textureKey: 'enemy', bodySize: 16 };
  }

  createEnemies() {
    this.enemyGroup = this.physics.add.group();
    this.enemyStates = [];
    this.createEnemyTextures();

    for (const room of this.level.rooms) {
      const furniture = this.roomFurniture.get(room.id) || [];
      const spawnPoints = generateRoomEnemies(
        room.x, room.y, room.width, room.height,
        WALL_THICKNESS, room.seed, furniture, room.id, this.extraEnemyCount, this.runCount
      );

      for (const spawn of spawnPoints) {
        const stats = this.getEnemyStats(spawn.type);
        const enemy = this.enemyGroup.create(spawn.x, spawn.y, stats.textureKey);
        enemy.body.setSize(stats.bodySize, stats.bodySize, true);
        enemy.body.setCollideWorldBounds(true);
        enemy.setDepth(60);

        this.enemyStates.push({
          sprite: enemy,
          x: spawn.x,
          y: spawn.y,
          type: spawn.type,
          state: 'idle',
          velocityX: 0,
          velocityY: 0,
          wanderTimer: 0,
          wanderAngle: spawn.wanderAngle,
          lastKnownX: 0,
          lastKnownY: 0,
          searchTimer: 0,
          attackCooldown: 0,
          health: stats.hp,
          contactDamage: stats.contactDamage,
          spawnRoomId: room.id,
          currentRoomId: room.id,
          roomTransitionCooldown: 0,
          targetDoorway: null,
        });
      }
    }

    this.physics.add.collider(this.enemyGroup, this.walls);
    this.physics.add.collider(this.enemyGroup, this.furnitureGroup);
    this.physics.add.collider(this.enemyGroup, this.doorGroup);
    this.physics.add.collider(this.enemyGroup, this.enemyGroup);
    this.physics.add.overlap(this.player, this.enemyGroup, this.onEnemyContact, null, this);
  }

  createBullets() {
    const bulletTextures = [
      { key: 'bullet_pistol', color: 0xffdd44, radius: 3 },
      { key: 'bullet_shotgun', color: 0xff8844, radius: 2 },
      { key: 'bullet_rifle', color: 0x44ddff, radius: 3 },
    ];
    for (const tex of bulletTextures) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(tex.color, 1);
      gfx.fillCircle(tex.radius, tex.radius, tex.radius);
      gfx.generateTexture(tex.key, tex.radius * 2, tex.radius * 2);
      gfx.destroy();
    }

    this.bulletGroup = this.physics.add.group({ maxSize: 30 });

    this.physics.add.collider(this.bulletGroup, this.walls, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.bulletGroup, this.furnitureGroup, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.bulletGroup, this.doorGroup, this.onBulletHitWall, null, this);
    this.physics.add.overlap(this.bulletGroup, this.enemyGroup, this.onBulletHitEnemy, null, this);
  }

  createEnemyBullets() {
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xff4444, 1);
    gfx.fillCircle(3, 3, 3);
    gfx.generateTexture('enemyBullet', 6, 6);
    gfx.destroy();

    this.enemyBulletGroup = this.physics.add.group({ maxSize: 30 });

    this.physics.add.collider(this.enemyBulletGroup, this.walls, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.enemyBulletGroup, this.furnitureGroup, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.enemyBulletGroup, this.doorGroup, this.onBulletHitWall, null, this);
    this.physics.add.overlap(this.enemyBulletGroup, this.player, this.onEnemyBulletHitPlayer, null, this);
  }

  createWeaponPickups() {
    this.weaponPickupSprites = [];

    for (const wpn of WEAPON_TYPES) {
      const gfx = this.make.graphics({ add: false });
      gfx.fillStyle(wpn.pickupColor, 1);
      gfx.fillRect(0, 2, 16, 6);
      gfx.fillRect(6, 0, 4, 10);
      gfx.generateTexture(`pickup_${wpn.id}`, 16, 10);
      gfx.destroy();
    }

    const weapons = generateLevelWeapons(this.level.rooms, this.levelSeed, this.roomFurniture);
    for (const wpnData of weapons) {
      const sprite = this.add.sprite(wpnData.x, wpnData.y, `pickup_${wpnData.weaponId}`);
      sprite.setDepth(5);
      sprite.setData('weaponId', wpnData.weaponId);
      this.weaponPickupSprites.push(sprite);
    }
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
      this.cameras.main.shake(100, 0.01);
      this.cameras.main.flash(150, 255, 0, 0);

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

    if (this.hasMinimap) {
      this.floorText = this.add.text(this.cameras.main.width - 180, 145, 'B1', {
        fontSize: '12px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      });
      this.floorText.setScrollFactor(0);
      this.floorText.setDepth(1000);
    }
  }

  createExitZone() {
    const room = this.level.rooms[0];
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
    const room = this.level.rooms[0];
    const door = room.doors[0];
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
    this.crackGlowGraphics.setDepth(1);
    this.crackGlowCenter = { x: crackX + (isVerticalWall ? WALL_THICKNESS / 2 : 0), y: crackY + (isVerticalWall ? 0 : WALL_THICKNESS / 2) };
    this.crackGlowSize = { w: isVerticalWall ? WALL_THICKNESS + 8 : crackLength + 8, h: isVerticalWall ? crackLength + 8 : WALL_THICKNESS + 8 };

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

  updateCrackGlow(time) {
    if (!this.crackGlowGraphics) return;
    this.crackGlowGraphics.clear();
    const alpha = 0.15 + 0.1 * Math.sin(time * 0.003);
    this.crackGlowGraphics.fillStyle(0xd4c073, alpha);
    const cx = this.crackGlowCenter.x;
    const cy = this.crackGlowCenter.y;
    const hw = this.crackGlowSize.w / 2;
    const hh = this.crackGlowSize.h / 2;
    this.crackGlowGraphics.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
  }

  createStairs() {
    this.stairGlowGraphics = this.add.graphics();
    this.stairGlowGraphics.setDepth(1);
    this.stairZones = [];

    for (const stair of this.level.stairs) {
      const stairGfx = this.add.graphics();
      stairGfx.setDepth(2);

      const goingDown = stair.fromFloor < stair.toFloor;
      this.drawStairVisual(stairGfx, stair.fromPos.x, stair.fromPos.y, goingDown ? 'down' : 'up');
      this.drawStairVisual(stairGfx, stair.toPos.x, stair.toPos.y, goingDown ? 'up' : 'down');

      const fromZone = this.add.zone(
        stair.fromPos.x + STAIR_SIZE / 2,
        stair.fromPos.y + STAIR_SIZE / 2,
        STAIR_SIZE, STAIR_SIZE
      );
      this.physics.add.existing(fromZone, true);
      fromZone.setData('destX', stair.toPos.x + STAIR_SIZE / 2);
      fromZone.setData('destY', stair.toPos.y + STAIR_SIZE / 2);
      fromZone.setData('destFloor', stair.toFloor);
      this.physics.add.overlap(this.player, fromZone, this.onStairEnter, null, this);
      this.stairZones.push(fromZone);

      const toZone = this.add.zone(
        stair.toPos.x + STAIR_SIZE / 2,
        stair.toPos.y + STAIR_SIZE / 2,
        STAIR_SIZE, STAIR_SIZE
      );
      this.physics.add.existing(toZone, true);
      toZone.setData('destX', stair.fromPos.x + STAIR_SIZE / 2);
      toZone.setData('destY', stair.fromPos.y + STAIR_SIZE / 2);
      toZone.setData('destFloor', stair.fromFloor);
      this.physics.add.overlap(this.player, toZone, this.onStairEnter, null, this);
      this.stairZones.push(toZone);
    }
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
    for (const stair of this.level.stairs) {
      const pad = 6;
      this.stairGlowGraphics.fillRect(
        stair.fromPos.x - pad, stair.fromPos.y - pad,
        STAIR_SIZE + pad * 2, STAIR_SIZE + pad * 2
      );
      this.stairGlowGraphics.fillRect(
        stair.toPos.x - pad, stair.toPos.y - pad,
        STAIR_SIZE + pad * 2, STAIR_SIZE + pad * 2
      );
    }
  }

  onStairEnter(player, stairZone) {
    if (this.isTeleporting || this.dayEnding || this.hidingState.isHiding) return;
    this.isTeleporting = true;
    player.body.stop();
    player.body.enable = false;

    const destX = stairZone.getData('destX');
    const destY = stairZone.getData('destY') + STAIR_SIZE / 2 + 20;
    const destFloor = stairZone.getData('destFloor');

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      player.body.reset(destX, destY);
      player.body.enable = true;
      this.currentFloor = destFloor;

      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this.isTeleporting = false;
      });
    });
  }

  onDayComplete(newLocation) {
    if (this.dayEnding) return;
    this.dayEnding = true;
    this.player.body.stop();
    this.player.body.enable = false;
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ShopScene', {
        treasureEarned: this.inventoryState.treasureValue,
        newLocation: newLocation || null,
      });
    });
  }

  createAlternateExits() {
    this.alternateExitZones = [];
    const exitData = generateAlternateExit(
      this.level.rooms,
      this.level.stairs,
      this.levelSeed,
      this.unlockedLocations
    );
    if (!exitData) return;

    this.alternateExitGlowGraphics = this.add.graphics();
    this.alternateExitGlowGraphics.setDepth(1);

    const exitGfx = this.add.graphics();
    exitGfx.setDepth(2);
    const size = 60;
    const { x, y } = exitData.position;

    exitGfx.lineStyle(2, 0x88aaff, 0.8);
    exitGfx.strokeRect(x - size / 2, y - size / 2, size, size);

    const zone = this.add.zone(x, y, size, size);
    this.physics.add.existing(zone, true);
    zone.setData('locationId', exitData.locationId);
    zone.setData('posX', x);
    zone.setData('posY', y);
    zone.setData('size', size);
    this.physics.add.overlap(this.player, zone, this.onAlternateExitComplete, null, this);
    this.alternateExitZones.push(zone);

    const locationData = getLocation(exitData.locationId);
    const label = this.add.text(x, y - size / 2 - 12, locationData ? locationData.name : 'Exit', {
      fontSize: '10px',
      color: '#88aaff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(5);
  }

  updateAlternateExitGlow(time) {
    if (!this.alternateExitGlowGraphics || this.alternateExitZones.length === 0) return;
    this.alternateExitGlowGraphics.clear();
    const alpha = 0.1 + 0.15 * Math.sin(time * 0.004);
    this.alternateExitGlowGraphics.fillStyle(0x88aaff, alpha);
    for (const zone of this.alternateExitZones) {
      const x = zone.getData('posX');
      const y = zone.getData('posY');
      const size = zone.getData('size');
      this.alternateExitGlowGraphics.fillRect(x - size / 2 - 4, y - size / 2 - 4, size + 8, size + 8);
    }
  }

  onAlternateExitComplete(player, zone) {
    if (this.dayEnding || this.isTeleporting || this.hidingState.isHiding) return;
    const locationId = zone.getData('locationId');
    if (!this.unlockedLocations.includes(locationId)) {
      this.unlockedLocations = [...this.unlockedLocations, locationId];
      this.registry.set('unlockedLocations', this.unlockedLocations);
      this.registry.set('activeLocation', locationId);
    }
    this.onDayComplete(locationId);
  }

  fireBullet() {
    const weapon = getActiveWeapon(this.weaponState);
    const textureKey = `bullet_${weapon.id}`;
    const pointer = this.input.activePointer;

    if (this.bulletCount > 1 && this.bulletSpreadAngle > 0) {
      const pellets = calculateShotgunSpread(
        this.player.x, this.player.y,
        pointer.worldX, pointer.worldY,
        this.bulletSpeed, this.bulletCount, this.bulletSpreadAngle
      );
      for (const pellet of pellets) {
        this.spawnBullet(textureKey, pellet.vx, pellet.vy);
      }
    } else {
      let { vx, vy } = calculateBulletVelocity(
        this.player.x, this.player.y,
        pointer.worldX, pointer.worldY,
        this.bulletSpeed
      );
      if (vx === 0 && vy === 0) {
        vx = Math.cos(this.playerAngle) * this.bulletSpeed;
        vy = Math.sin(this.playerAngle) * this.bulletSpeed;
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

    if (isEnemyDead(enemyState.health)) {
      enemySprite.setActive(false);
      enemySprite.setVisible(false);
      enemySprite.body.stop();
      enemySprite.body.enable = false;
      this.enemyStates = this.enemyStates.filter(es => es !== enemyState);
    }
  }

  onEnemyContact(player, enemySprite) {
    if (this.hidingState.isHiding) return;

    const enemyState = this.enemyStates.find(es => es.sprite === enemySprite);
    const damage = enemyState ? enemyState.contactDamage : this.scaledEnemyDamage;

    const before = this.combatState;
    this.combatState = applyDamage(before, damage);

    if (this.combatState.hp < before.hp) {
      this.cameras.main.shake(100, 0.01);
      this.cameras.main.flash(150, 255, 0, 0);

      if (this.combatState.isDead) {
        this.onPlayerDeath();
      }
    }
  }

  onPlayerDeath() {
    this.player.body.stop();
    this.player.body.enable = false;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ShopScene', { treasureEarned: 0 });
    });
  }

  getScaledChaseSpeed(type) {
    if (type === 'crawler') return this.scaledCrawlerChaseSpeed;
    if (type === 'spitter') return this.scaledSpitterChaseSpeed;
    return this.scaledEnemyChaseSpeed;
  }

  updateEnemies(delta) {
    const playerPos = { x: this.player.x, y: this.player.y };
    const litRoomIds = getLitRoomIds(this.switchStates);
    if (!litRoomIds.includes(0)) litRoomIds.push(0);
    const litRooms = litRoomIds.map(id => this.level.rooms.find(r => r.id === id)).filter(Boolean);

    if (this.roomGraphDirty || !this.roomGraph) {
      this.roomGraph = buildRoomGraph(this.level.rooms, this.doorStates);
      this.roomGraphDirty = false;
    }

    const playerRoom = getCurrentRoom(playerPos.x, playerPos.y, this.level.rooms);
    const playerRoomId = playerRoom ? playerRoom.id : -1;
    const cameFrom = bfsFromRoom(this.roomGraph, playerRoomId);

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
        continue;
      }

      const enemyRoomId = es.currentRoomId;
      const doorway = getNextDoorway(this.roomGraph, cameFrom, enemyRoomId, playerRoomId);

      let seekDoorway = false;
      let wanderDoorway = doorway;
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
        enemyRoomId,
        playerRoomId,
        spawnRoomId: es.spawnRoomId,
        roomTransitionCooldown: es.roomTransitionCooldown,
        targetDoorway: es.targetDoorway,
        doorway: seekDoorway ? wanderDoorway : doorway,
        maxRoomDistance: MAX_ROOM_DISTANCE,
        roomEnemyCounts,
        seekDoorway,
      };

      const chaseSpeed = this.getScaledChaseSpeed(es.type);
      const updated = updateEnemyAI(es, playerPos, this.wallSegments, delta, this.hidingState.isHiding, chaseSpeed, navContext);

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
        es.wantsToFire = false;
      }

      es.sprite.setVelocity(updated.velocityX, updated.velocityY);
    }
  }

  drawPlayer() {
    this.playerGraphics.clear();
    this.playerGraphics.x = this.player.x;
    this.playerGraphics.y = this.player.y;
    this.playerGraphics.setRotation(this.playerAngle || 0);

    const hurt = isInvulnerable(this.combatState);
    const hiding = this.hidingState.isHiding;
    let alpha, bodyColor, indicatorColor;

    if (hiding) {
      alpha = 0.3;
      bodyColor = 0x336633;
      indicatorColor = 0x558855;
    } else if (hurt) {
      alpha = 0.5;
      bodyColor = 0xcc4444;
      indicatorColor = 0xee8888;
    } else {
      alpha = 1;
      bodyColor = 0x44aa44;
      indicatorColor = 0x88ee88;
    }

    this.playerGraphics.fillStyle(bodyColor, alpha);
    this.playerGraphics.fillCircle(0, 0, 10);

    this.playerGraphics.fillStyle(indicatorColor, alpha);
    this.playerGraphics.fillTriangle(5, -4, 5, 4, 14, 0);
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

    gfx.fillStyle(0x222222, 0.8);
    gfx.fillRect(x, battY, width, height);

    let battColor = 0xcccc33;
    if (battFraction <= 0.25) battColor = 0xcc3333;
    else if (battFraction <= 0.5) battColor = 0xcc8833;

    gfx.fillStyle(battColor, 1);
    gfx.fillRect(x, battY, width * battFraction, height);

    gfx.lineStyle(2, 0xffffff, 0.5);
    gfx.strokeRect(x, battY, width, height);

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
  }

  drawMinimap() {
    if (!this.hasMinimap) return;
    const gfx = this.minimapGraphics;
    gfx.clear();

    const floorBounds = getFloorBounds(this.level.rooms, this.currentFloor);
    const data = getMinimapData(
      this.explorationState,
      this.level.rooms,
      floorBounds,
      { x: this.player.x, y: this.player.y },
      this.exitPosition,
      this.cameras.main.width,
      this.currentFloor
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
    };

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown() && !this.combatState.isDead && !this.dayEnding && !this.hidingState.isHiding) {
        this.onUseBattery();
      }
    });
  }

  onWeaponPickup(wpnSprite) {
    const weaponId = wpnSprite.getData('weaponId');
    const weaponType = WEAPON_TYPES.find(w => w.id === weaponId);
    if (!weaponType) return;

    const savedAmmo = wpnSprite.getData('weaponAmmo');
    const result = pickupWeapon(this.weaponState, weaponType, savedAmmo);
    this.weaponState = result.state;
    this.updateWeaponStats();

    wpnSprite.setActive(false);
    wpnSprite.setVisible(false);
    this.weaponPickupSprites = this.weaponPickupSprites.filter(s => s !== wpnSprite);

    if (result.droppedWeapon) {
      const dropSprite = this.add.sprite(
        this.player.x, this.player.y,
        `pickup_${result.droppedWeapon.id}`
      );
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
    }
  }

  setupCamera() {
    const allRooms = this.level.rooms;
    const minX = Math.min(...allRooms.map(r => r.x));
    const minY = Math.min(...allRooms.map(r => r.y));
    const maxX = Math.max(...allRooms.map(r => r.x + r.width));
    const maxY = Math.max(...allRooms.map(r => r.y + r.height));

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
    this.physics.world.setBounds(minX, minY, maxX - minX, maxY - minY);

    this.levelBounds = { minX, minY, maxX, maxY };
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

  updateDarkness(time) {
    this.darkGraphics.clear();
    this.lightGraphics.clear();
    this.maskGraphics.clear();

    const { minX, minY, maxX, maxY } = this.levelBounds;
    this.darkGraphics.fillStyle(0x000000, 0.95);
    this.darkGraphics.fillRect(minX - 100, minY - 100, maxX - minX + 200, maxY - minY + 200);

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

    const coneAngle = getFlashlightConeAngle(this.batteryState, this.flashlightAngle);
    if (coneAngle <= 0 || shouldFlicker(this.batteryState, time)) return;

    const origin = { x: this.player.x, y: this.player.y };
    const polygon = getFlashlightPolygon(
      origin,
      this.playerAngle || 0,
      coneAngle,
      this.wallSegments
    );

    if (polygon.length >= 3) {
      this.maskGraphics.fillStyle(0xffffff);
      this.drawPolygon(this.maskGraphics, polygon);

      this.lightGraphics.fillStyle(0xffffcc, 0.05);
      this.drawPolygon(this.lightGraphics, polygon);
    }
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

    const pointer = this.input.activePointer;
    pointer.updateWorldPoint(this.cameras.main);
    this.playerAngle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.worldX,
      pointer.worldY
    );

    const keyState = {
      up: this.keys.W.isDown,
      down: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
    };

    if (this.hidingState.isHiding) {
      const velocity = calculateVelocity(keyState, this.playerSpeed * HIDING_SPEED_MULTIPLIER);
      this.player.setVelocity(velocity.x, velocity.y);
    } else {
      const velocity = calculateVelocity(keyState, this.playerSpeed);
      this.player.setVelocity(velocity.x, velocity.y);
    }

    this.combatState = updateCombat(this.combatState, delta);
    this.batteryState = updateBattery(this.batteryState, delta);
    this.fireCooldown = updateFireCooldown(this.fireCooldown, delta);

    if (!this.hidingState.isHiding && pointer.leftButtonDown() && canFire(this.fireCooldown) && getActiveWeapon(this.weaponState) && hasAmmo(this.weaponState)) {
      this.fireBullet();
      this.weaponState = consumeAmmo(this.weaponState);
      this.fireCooldown = this.fireRate;
    }

    this.updateInteractPrompt();

    if (Phaser.Input.Keyboard.JustDown(this.keys.Q)) {
      this.weaponState = switchWeapon(this.weaponState);
      this.updateWeaponStats();
    }

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
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

    this.updateBullets();
    this.updateEnemyBullets();
    this.updateEnemies(delta);
    this.drawPlayer();
    this.updateDarkness(time);
    this.updateCrackGlow(time);
    this.updateStairGlow(time);
    this.updateAlternateExitGlow(time);
    this.drawDoors();
    this.drawSwitches();
    this.explorationState = updateExploration(this.explorationState, this.player.x, this.player.y, this.level.rooms);
    this.drawHUD();
    this.drawMinimap();
  }
}
