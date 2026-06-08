import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { loadGame, saveGame } from './systems/persistence.js';

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

const game = new Phaser.Game(config);

const saved = loadGame();
if (saved) {
  game.registry.set('shopState', saved.shopState);
  game.registry.set('runCount', saved.runCount);
  game.registry.set('collectedLore', saved.collectedLore);
  game.registry.set('unlockedLocations', saved.unlockedLocations);
  game.registry.set('activeLocation', saved.activeLocation);
}

function saveCurrentState() {
  const shopState = game.registry.get('shopState');
  const runCount = game.registry.get('runCount') ?? 0;
  if (shopState) {
    saveGame(shopState, runCount, game.registry.get('collectedLore') ?? [], game.registry.get('unlockedLocations') ?? ['store'], game.registry.get('activeLocation') ?? 'store');
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveCurrentState();
  }
});

window.addEventListener('beforeunload', saveCurrentState);
