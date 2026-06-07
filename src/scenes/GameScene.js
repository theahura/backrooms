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

const PLAYER_SPEED = 200;
const WALL_THICKNESS = 16;
const FLASHLIGHT_CONE_ANGLE = Math.PI / 4;
const LEVEL_SEED = 42;
const ROOM_COUNT = 6;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.level = generateLevel(LEVEL_SEED, ROOM_COUNT);
    this.walls = this.physics.add.staticGroup();
    this.furnitureGroup = this.physics.add.staticGroup();
    this.wallSegments = [...this.level.wallSegments];

    this.roomFurniture = new Map();
    this.combatState = createCombatState();
    this.batteryState = createBatteryState();
    this.inventoryState = createInventoryState();
    this.fireCooldown = 0;
    this.dayEnding = false;

    this.createRooms();
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
      this.scene.restart();
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
      this.scene.restart();
    });
  }

  updateEnemies(delta) {
    const playerPos = { x: this.player.x, y: this.player.y };

    for (const es of this.enemyStates) {
      es.x = es.sprite.x;
      es.y = es.sprite.y;

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

    const coneAngle = getFlashlightConeAngle(this.batteryState, FLASHLIGHT_CONE_ANGLE);
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

    const velocity = calculateVelocity(keyState, PLAYER_SPEED);
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

    this.updateBullets();
    this.updateEnemies(delta);
    this.drawPlayer();
    this.updateDarkness(time);
    this.drawHUD();
  }
}
