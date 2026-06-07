import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { ShopScene } from './scenes/ShopScene.js';

const config = {
  type: Phaser.AUTO,
  width: 1024,
  height: 768,
  parent: 'game-container',
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [GameScene, ShopScene],
};

new Phaser.Game(config);
