import Phaser from 'phaser';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { RunSummaryScene } from './scenes/RunSummaryScene.js';
import { loadGame, saveGame } from './systems/persistence.js';
import { loadSettings } from './systems/settings.js';
import { detectTouchPrimary } from './systems/touchControls.js';

const coarsePointer = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(pointer: coarse)').matches
  : false;
const maxTouchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints || 0) : 0;
const isTouch = detectTouchPrimary({ maxTouchPoints, coarsePointer });

const scale = isTouch
  ? {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
  }
  : {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: 'game-container',
    width: 1024,
    height: 768,
  };

const config = {
  type: Phaser.AUTO,
  backgroundColor: '#000000',
  pixelArt: true,
  scale,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  plugins: {
    global: [
      {
        key: 'rexVirtualJoystick',
        plugin: VirtualJoystickPlugin,
        start: true,
      },
    ],
  },
  scene: [TitleScene, GameScene, ShopScene, PauseScene, RunSummaryScene],
};

const game = new Phaser.Game(config);

// Exposed for Playwright playtesting (dev server only).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__game = game;
}

const saved = loadGame();
if (saved) {
  game.registry.set('shopState', saved.shopState);
  game.registry.set('runCount', saved.runCount);
  game.registry.set('collectedLore', saved.collectedLore);
  game.registry.set('unlockedLocations', saved.unlockedLocations);
  game.registry.set('activeLocation', saved.activeLocation);
  game.registry.set('worldSeed', saved.worldSeed);
}

game.registry.set('audioSettings', loadSettings());

function saveCurrentState() {
  const shopState = game.registry.get('shopState');
  const runCount = game.registry.get('runCount') ?? 0;
  if (shopState) {
    saveGame(shopState, runCount, game.registry.get('collectedLore') ?? [], game.registry.get('unlockedLocations') ?? ['store'], game.registry.get('activeLocation') ?? 'store', game.registry.get('worldSeed') ?? null);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    saveCurrentState();
  }
});

window.addEventListener('beforeunload', saveCurrentState);
