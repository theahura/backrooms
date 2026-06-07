import Phaser from 'phaser';
import { calculateVelocity } from '../systems/movement.js';
import { createFurnitureSegments, generateRoomFurniture } from '../systems/furniture.js';
import { getFlashlightPolygon } from '../systems/visibility.js';
import { generateLevel } from '../systems/level.js';
import { generateRoomEnemies, updateEnemyAI } from '../systems/enemy.js';
import { createCombatState, applyDamage, updateCombat, getHealthFraction, isInvulnerable, applyEnemyDamage, isEnemyDead, ENEMY_CONTACT_DAMAGE, ENEMY_MAX_HP, BULLET_DAMAGE } from '../systems/combat.js';
import { calculateBulletVelocity, canFire, updateFireCooldown, isBulletExpired, BULLET_SPEED, FIRE_RATE_MS, BULLET_MAX_RANGE } from '../systems/shooting.js';
import { createBatteryState, updateBattery, getBatteryFraction, getFlashlightConeAngle, shouldFlicker, rechargeBattery, BATTERY_RECHARGE_AMOUNT } from '../systems/battery.js';
import { generateRoomItems, ITEM_TYPES } from '../systems/items.js';
import { createInventoryState, pickupItem, useBattery } from '../systems/inventory.js';
import { getUpgradeValue } from '../systems/shop.js';
import { createDoorStates, toggleDoor, getDoorCenter, findNearestDoor, DOOR_INTERACT_RANGE } from '../systems/doors.js';
import { createSwitchStates, toggleSwitch, findNearestSwitch, getLitRoomIds, isPointInRoom, SWITCH_INTERACT_RANGE } from '../systems/lightswitch.js';

const WALL_THICKNESS = 16;
const ROOM_COUNT = 6;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  init() {
    const shopState = this.registry.get('shopState');
    const levels = shopState ? shopState.upgrades : { battery: 0, flashlight: 0, health: 0, speed: 0 };
    this.maxCharge = getUpgradeValue('battery', levels.battery);
    this.flashlightAngle = getUpgradeValue('flashlight', levels.flashlight);
    this.maxHp = getUpgradeValue('health', levels.health);
    this.playerSpeed = getUpgradeValue('speed', levels.speed);

    const runCount = this.registry.get('runCount') ?? 0;
    this.registry.set('runCount', runCount + 1);
    this.levelSeed = runCount + 1;
  }

  create() {
    this.level = generateLevel(this.levelSeed, ROOM_COUNT);
    this.walls = this.physics.add.staticGroup();
    this.furnitureGroup = this.physics.add.staticGroup();
    this.wallSegments = [...this.level.wallSegments];

    this.roomFurniture = new Map();
    this.combatState = createCombatState(this.maxHp);
    this.batteryState = createBatteryState(this.maxCharge);
    this.inventoryState = createInventoryState();
    this.fireCooldown = 0;
    this.dayEnding = false;

    this.createRooms();
    this.createDoors();
    this.createSwitches();
    this.createPlayer();
    this.createEnemies();
    this.createItemTextures();
    this.createItems();
    this.createBullets();
    this.createExitZone();
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
    }

    this.drawDoorways(gfx);
  }

  drawRoom(gfx, room) {
    gfx.fillStyle(0x333333, 1);
    gfx.fillRect(room.x, room.y, room.width, room.height);

    gfx.fillStyle(0x555555, 1);
    gfx.fillRect(room.x, room.y, room.width, WALL_THICKNESS);
    gfx.fillRect(room.x, room.y + room.height - WALL_THICKNESS, room.width, WALL_THICKNESS);
    gfx.fillRect(room.x, room.y, WALL_THICKNESS, room.height);
    gfx.fillRect(room.x + room.width - WALL_THICKNESS, room.y, WALL_THICKNESS, room.height);
  }

  drawDoorways(gfx) {
    gfx.fillStyle(0x333333, 1);
    for (const room of this.level.rooms) {
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
    const furniture = generateRoomFurniture(
      room.x, room.y, room.width, room.height, WALL_THICKNESS, room.seed
    );
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

      const segments = createFurnitureSegments(item.x, item.y, item.width, item.height);
      this.wallSegments.push(...segments);
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

    let target = null;
    let targetPos = null;

    if (nearestDoor && nearestSwitch) {
      const doorCenter = getDoorCenter(nearestDoor, this.level.rooms);
      const dDoor = Math.hypot(this.player.x - doorCenter.x, this.player.y - doorCenter.y);
      const dSwitch = Math.hypot(this.player.x - nearestSwitch.x, this.player.y - nearestSwitch.y);
      if (dDoor <= dSwitch) {
        target = { type: 'door', item: nearestDoor };
        targetPos = doorCenter;
      } else {
        target = { type: 'switch', item: nearestSwitch };
        targetPos = { x: nearestSwitch.x, y: nearestSwitch.y };
      }
    } else if (nearestDoor) {
      target = { type: 'door', item: nearestDoor };
      targetPos = getDoorCenter(nearestDoor, this.level.rooms);
    } else if (nearestSwitch) {
      target = { type: 'switch', item: nearestSwitch };
      targetPos = { x: nearestSwitch.x, y: nearestSwitch.y };
    }

    this.nearestInteractable = target;

    if (target) {
      this.interactText.setPosition(targetPos.x - 30, targetPos.y - 30);
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
    this.inventoryState = pickupItem(this.inventoryState, {
      type: itemSprite.getData('itemType'),
      value: itemSprite.getData('itemValue'),
    });
    itemSprite.destroy();
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
    this.physics.add.collider(this.player, this.furnitureGroup);
    this.physics.add.collider(this.player, this.doorGroup);
  }

  createEnemies() {
    this.enemyGroup = this.physics.add.group();
    this.enemyStates = [];

    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xcc3333, 1);
    gfx.fillCircle(10, 10, 10);
    gfx.fillStyle(0x992222, 1);
    gfx.fillCircle(7, 7, 3);
    gfx.fillCircle(13, 7, 3);
    gfx.generateTexture('enemy', 20, 20);
    gfx.destroy();

    for (const room of this.level.rooms) {
      const furniture = this.roomFurniture.get(room.id) || [];
      const spawnPoints = generateRoomEnemies(
        room.x, room.y, room.width, room.height,
        WALL_THICKNESS, room.seed, furniture, room.id
      );

      for (const spawn of spawnPoints) {
        const enemy = this.enemyGroup.create(spawn.x, spawn.y, 'enemy');
        enemy.body.setSize(16, 16, true);
        enemy.body.setCollideWorldBounds(true);
        enemy.setDepth(60);

        this.enemyStates.push({
          sprite: enemy,
          x: spawn.x,
          y: spawn.y,
          state: 'idle',
          velocityX: 0,
          velocityY: 0,
          wanderTimer: 0,
          wanderAngle: spawn.wanderAngle,
          lastKnownX: 0,
          lastKnownY: 0,
          searchTimer: 0,
          health: ENEMY_MAX_HP,
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
    const gfx = this.make.graphics({ add: false });
    gfx.fillStyle(0xffdd44, 1);
    gfx.fillCircle(3, 3, 3);
    gfx.generateTexture('bullet', 6, 6);
    gfx.destroy();

    this.bulletGroup = this.physics.add.group({ maxSize: 20 });

    this.physics.add.collider(this.bulletGroup, this.walls, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.bulletGroup, this.furnitureGroup, this.onBulletHitWall, null, this);
    this.physics.add.collider(this.bulletGroup, this.doorGroup, this.onBulletHitWall, null, this);
    this.physics.add.overlap(this.bulletGroup, this.enemyGroup, this.onBulletHitEnemy, null, this);
  }

  createHUD() {
    this.hudGraphics = this.add.graphics();
    this.hudGraphics.setScrollFactor(0);
    this.hudGraphics.setDepth(1000);

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
  }

  createExitZone() {
    const room = this.level.rooms[0];
    const exitX = room.x + WALL_THICKNESS + 32;
    const exitY = room.y + WALL_THICKNESS + 32;
    const exitSize = 64;

    this.exitGraphics = this.add.graphics();
    this.exitGraphics.setDepth(10);
    this.exitGraphics.fillStyle(0x44cc44, 0.3);
    this.exitGraphics.fillRect(exitX - exitSize / 2, exitY - exitSize / 2, exitSize, exitSize);
    this.exitGraphics.lineStyle(2, 0x44cc44, 0.6);
    this.exitGraphics.strokeRect(exitX - exitSize / 2, exitY - exitSize / 2, exitSize, exitSize);

    this.exitZone = this.add.zone(exitX, exitY, exitSize, exitSize);
    this.physics.add.existing(this.exitZone, true);
    this.physics.add.overlap(this.player, this.exitZone, this.onDayComplete, null, this);
  }

  onDayComplete() {
    if (this.dayEnding) return;
    this.dayEnding = true;
    this.player.body.stop();
    this.player.body.enable = false;
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ShopScene', { treasureEarned: this.inventoryState.treasureValue });
    });
  }

  fireBullet() {
    const bullet = this.bulletGroup.get(this.player.x, this.player.y, 'bullet');
    if (!bullet) return;

    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.body.reset(this.player.x, this.player.y);
    bullet.setDepth(150);
    bullet.body.setSize(6, 6, true);

    const pointer = this.input.activePointer;
    let { vx, vy } = calculateBulletVelocity(
      this.player.x, this.player.y,
      pointer.worldX, pointer.worldY,
      BULLET_SPEED
    );
    if (vx === 0 && vy === 0) {
      vx = Math.cos(this.playerAngle) * BULLET_SPEED;
      vy = Math.sin(this.playerAngle) * BULLET_SPEED;
    }
    bullet.setVelocity(vx, vy);
    bullet.setData('originX', this.player.x);
    bullet.setData('originY', this.player.y);
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

    enemyState.health = applyEnemyDamage(enemyState.health, BULLET_DAMAGE);

    if (isEnemyDead(enemyState.health)) {
      enemySprite.setActive(false);
      enemySprite.setVisible(false);
      enemySprite.body.stop();
      enemySprite.body.enable = false;
      this.enemyStates = this.enemyStates.filter(es => es !== enemyState);
    }
  }

  onEnemyContact() {
    const before = this.combatState;
    this.combatState = applyDamage(before, ENEMY_CONTACT_DAMAGE);

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

  updateEnemies(delta) {
    const playerPos = { x: this.player.x, y: this.player.y };
    const litRoomIds = getLitRoomIds(this.switchStates);
    const litRooms = litRoomIds.map(id => this.level.rooms.find(r => r.id === id)).filter(Boolean);

    for (const es of this.enemyStates) {
      es.x = es.sprite.x;
      es.y = es.sprite.y;

      const inLitRoom = litRooms.some(room => isPointInRoom(room, es.x, es.y));
      if (inLitRoom) {
        es.sprite.setVelocity(0, 0);
        continue;
      }

      const updated = updateEnemyAI(es, playerPos, this.wallSegments, delta);

      es.state = updated.state;
      es.velocityX = updated.velocityX;
      es.velocityY = updated.velocityY;
      es.wanderTimer = updated.wanderTimer;
      es.wanderAngle = updated.wanderAngle;
      es.lastKnownX = updated.lastKnownX;
      es.lastKnownY = updated.lastKnownY;
      es.searchTimer = updated.searchTimer;

      es.sprite.setVelocity(updated.velocityX, updated.velocityY);
    }
  }

  drawPlayer() {
    this.playerGraphics.clear();
    this.playerGraphics.x = this.player.x;
    this.playerGraphics.y = this.player.y;
    this.playerGraphics.setRotation(this.playerAngle || 0);

    const hurt = isInvulnerable(this.combatState);
    const alpha = hurt ? 0.5 : 1;

    this.playerGraphics.fillStyle(hurt ? 0xcc4444 : 0x44aa44, alpha);
    this.playerGraphics.fillCircle(0, 0, 10);

    this.playerGraphics.fillStyle(hurt ? 0xee8888 : 0x88ee88, alpha);
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
  }

  setupInput() {
    this.keys = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      E: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
    };

    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown() && !this.combatState.isDead && !this.dayEnding) {
        this.onUseBattery();
      }
    });
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
      if (isBulletExpired(originX, originY, bullet.x, bullet.y, BULLET_MAX_RANGE)) {
        bullet.setActive(false);
        bullet.setVisible(false);
        bullet.body.stop();
      }
    }
  }

  update(time, delta) {
    if (this.combatState.isDead || this.dayEnding) return;

    const keyState = {
      up: this.keys.W.isDown,
      down: this.keys.S.isDown,
      left: this.keys.A.isDown,
      right: this.keys.D.isDown,
    };

    const velocity = calculateVelocity(keyState, this.playerSpeed);
    this.player.setVelocity(velocity.x, velocity.y);

    const pointer = this.input.activePointer;
    this.playerAngle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      pointer.worldX,
      pointer.worldY
    );

    this.combatState = updateCombat(this.combatState, delta);
    this.batteryState = updateBattery(this.batteryState, delta);
    this.fireCooldown = updateFireCooldown(this.fireCooldown, delta);

    if (pointer.leftButtonDown() && canFire(this.fireCooldown)) {
      this.fireBullet();
      this.fireCooldown = FIRE_RATE_MS;
    }

    this.updateInteractPrompt();

    if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
      if (this.nearestInteractable) {
        if (this.nearestInteractable.type === 'door') {
          this.onToggleDoor(this.nearestInteractable.item.id);
        } else if (this.nearestInteractable.type === 'switch') {
          this.onToggleSwitch(this.nearestInteractable.item.id);
        }
      }
    }

    this.updateBullets();
    this.updateEnemies(delta);
    this.drawPlayer();
    this.updateDarkness(time);
    this.drawDoors();
    this.drawSwitches();
    this.drawHUD();
  }
}
