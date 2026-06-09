import Phaser from 'phaser';
import { getControlsList } from '../systems/pause.js';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('PauseScene');
  }

  init(data) {
    this.touchMode = data?.touchMode ?? false;
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);

    this.add.text(width / 2, height * 0.15, 'PAUSED', {
      fontSize: '48px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const controls = getControlsList(this.touchMode);
    const startY = height * 0.3;
    const lineHeight = 32;
    const keyX = width / 2 - 20;
    const actionX = width / 2 + 20;

    for (let i = 0; i < controls.length; i++) {
      const y = startY + i * lineHeight;
      this.add.text(keyX, y, controls[i].key, {
        fontSize: '18px',
        color: '#ffd700',
        fontFamily: 'monospace',
      }).setOrigin(1, 0);
      this.add.text(actionX, y, controls[i].action, {
        fontSize: '18px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      }).setOrigin(0, 0);
    }

    const resumeText = this.touchMode ? 'Tap to resume' : 'Press ESC to resume';
    this.add.text(width / 2, height * 0.85, resumeText, {
      fontSize: '20px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());

    if (this.touchMode) {
      this.time.delayedCall(150, () => {
        this.input.on('pointerdown', () => this.resumeGame());
      });
    }

    const onResize = () => this.layoutPauseOverlay();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  layoutPauseOverlay() {
    this.scene.restart({ touchMode: this.touchMode });
  }

  resumeGame() {
    if (this.isResuming) return;
    this.isResuming = true;
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}
