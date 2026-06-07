import Phaser from 'phaser';
import { calculateVelocity } from '../systems/movement.js';
import { createFurnitureSegments, generateRoomFurniture } from '../systems/furniture.js';
import { getFlashlightPolygon } from '../systems/visibility.js';
import { generateLevel } from '../systems/level.js';

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

    this.createRooms();
    this.createPlayer();
    this.setupInput();
    this.setupCamera();
    this.createDarknessOverlay();
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

  drawPlayer() {
    this.playerGraphics.clear();
    this.playerGraphics.x = this.player.x;
    this.playerGraphics.y = this.player.y;
    this.playerGraphics.setRotation(this.playerAngle || 0);

    this.playerGraphics.fillStyle(0x44aa44, 1);
    this.playerGraphics.fillCircle(0, 0, 10);

    this.playerGraphics.fillStyle(0x88ee88, 1);
    this.playerGraphics.fillTriangle(5, -4, 5, 4, 14, 0);
  }

  setupInput() {
    this.keys = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
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

  updateDarkness() {
    this.darkGraphics.clear();
    this.lightGraphics.clear();
    this.maskGraphics.clear();

    const origin = { x: this.player.x, y: this.player.y };
    const polygon = getFlashlightPolygon(
      origin,
      this.playerAngle || 0,
      FLASHLIGHT_CONE_ANGLE,
      this.wallSegments
    );

    const { minX, minY, maxX, maxY } = this.levelBounds;
    this.darkGraphics.fillStyle(0x000000, 0.95);
    this.darkGraphics.fillRect(minX - 100, minY - 100, maxX - minX + 200, maxY - minY + 200);

    if (polygon.length >= 3) {
      this.maskGraphics.fillStyle(0xffffff);
      this.drawPolygon(this.maskGraphics, polygon);

      this.lightGraphics.fillStyle(0xffffcc, 0.05);
      this.drawPolygon(this.lightGraphics, polygon);
    }
  }

  update() {
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

    this.drawPlayer();
    this.updateDarkness();
  }
}
