import Phaser from 'phaser';
import { calculateVelocity } from '../systems/movement.js';
import { createRoomWalls } from '../systems/room.js';
import { createFurnitureSegments, generateRoomFurniture } from '../systems/furniture.js';
import { getFlashlightPolygon } from '../systems/visibility.js';

const PLAYER_SPEED = 200;
const ROOM_X = 0;
const ROOM_Y = 0;
const ROOM_WIDTH = 1200;
const ROOM_HEIGHT = 1000;
const WALL_THICKNESS = 16;
const FLASHLIGHT_CONE_ANGLE = Math.PI / 4;

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.createRoom();
    this.createFurniture();
    this.createPlayer();
    this.setupInput();
    this.setupCamera();
    this.createDarknessOverlay();
  }

  createRoom() {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x333333, 1);
    gfx.fillRect(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);

    gfx.fillStyle(0x555555, 1);
    gfx.fillRect(ROOM_X, ROOM_Y, ROOM_WIDTH, WALL_THICKNESS);
    gfx.fillRect(ROOM_X, ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS, ROOM_WIDTH, WALL_THICKNESS);
    gfx.fillRect(ROOM_X, ROOM_Y, WALL_THICKNESS, ROOM_HEIGHT);
    gfx.fillRect(ROOM_X + ROOM_WIDTH - WALL_THICKNESS, ROOM_Y, WALL_THICKNESS, ROOM_HEIGHT);

    this.walls = this.physics.add.staticGroup();

    this.walls.add(
      this.add.zone(ROOM_X + ROOM_WIDTH / 2, ROOM_Y + WALL_THICKNESS / 2, ROOM_WIDTH, WALL_THICKNESS)
    );
    this.walls.add(
      this.add.zone(ROOM_X + ROOM_WIDTH / 2, ROOM_Y + ROOM_HEIGHT - WALL_THICKNESS / 2, ROOM_WIDTH, WALL_THICKNESS)
    );
    this.walls.add(
      this.add.zone(ROOM_X + WALL_THICKNESS / 2, ROOM_Y + ROOM_HEIGHT / 2, WALL_THICKNESS, ROOM_HEIGHT)
    );
    this.walls.add(
      this.add.zone(ROOM_X + ROOM_WIDTH - WALL_THICKNESS / 2, ROOM_Y + ROOM_HEIGHT / 2, WALL_THICKNESS, ROOM_HEIGHT)
    );

    this.wallSegments = createRoomWalls(
      ROOM_X + WALL_THICKNESS,
      ROOM_Y + WALL_THICKNESS,
      ROOM_WIDTH - WALL_THICKNESS * 2,
      ROOM_HEIGHT - WALL_THICKNESS * 2
    );
  }

  createFurniture() {
    const furniture = generateRoomFurniture(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT, WALL_THICKNESS, 42);
    const gfx = this.add.graphics();
    gfx.setDepth(50);

    this.furnitureGroup = this.physics.add.staticGroup();

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
    const playerX = ROOM_X + ROOM_WIDTH / 2;
    const playerY = ROOM_Y + ROOM_HEIGHT / 2;

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
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(ROOM_X, ROOM_Y, ROOM_WIDTH, ROOM_HEIGHT);
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

    this.darkGraphics.fillStyle(0x000000, 0.95);
    this.darkGraphics.fillRect(
      ROOM_X - 100,
      ROOM_Y - 100,
      ROOM_WIDTH + 200,
      ROOM_HEIGHT + 200
    );

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
