import Phaser from 'phaser';
import { loadGame, clearSave } from '../systems/persistence.js';
import { getMenuOptions, getTitleText } from '../systems/titleMenu.js';
import { generateAllSounds, createAmbientDrone } from '../systems/audioEngine.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    this.isTransitioning = false;
    this.confirmOverlay = null;

    this.fitCamera();
    const onResize = () => this.fitCamera();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      if (this._audioUnlockHandler && this.sound) {
        this.sound.off('unlocked', this._audioUnlockHandler);
        this._audioUnlockHandler = null;
      }
      if (this._drone) {
        this._drone.stop();
        this._drone = null;
      }
    });

    const { title, subtitle } = getTitleText();

    const titleText = this.add.text(512, 240, title, {
      fontSize: '64px',
      color: '#D4C073',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.3 },
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.text(512, 310, subtitle, {
      fontSize: '16px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.buildMenu();
    this.initAudio();
  }

  buildMenu() {
    if (this.menuItems) {
      this.menuItems.forEach(item => item.destroy());
    }
    this.menuItems = [];

    const saved = loadGame();
    const hasSave = saved !== null;
    const options = getMenuOptions(hasSave);
    const startY = 400;
    const spacing = 50;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const y = startY + i * spacing;
      const text = this.add.text(512, y, `[ ${opt.label} ]`, {
        fontSize: '22px',
        color: opt.color,
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      this.enlargeHitArea(text);
      const baseColor = opt.color;
      text.on('pointerover', () => {
        if (baseColor === '#44cc44') text.setColor('#88ff88');
        else if (baseColor === '#cc4444') text.setColor('#ff6666');
      });
      text.on('pointerout', () => text.setColor(baseColor));
      text.on('pointerdown', () => this.onMenuSelect(opt.key));
      this.menuItems.push(text);
    }
  }

  resetSaveState() {
    clearSave();
    this.registry.set('shopState', null);
    this.registry.set('runCount', 0);
    this.registry.set('collectedLore', []);
    this.registry.set('unlockedLocations', ['store']);
    this.registry.set('activeLocation', 'store');
  }

  onMenuSelect(key) {
    if (this.isTransitioning || this.confirmOverlay) return;

    if (key === 'continue') {
      this.isTransitioning = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('ShopScene');
      });
    } else if (key === 'new_game') {
      this.isTransitioning = true;
      this.resetSaveState();
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    } else if (key === 'delete_save') {
      this.showDeleteConfirmation();
    }
  }

  showDeleteConfirmation() {
    if (this.confirmOverlay) return;
    this.confirmOverlay = [];

    const bg = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.7).setDepth(100).setInteractive();
    const prompt = this.add.text(512, 350, 'Delete all progress?', {
      fontSize: '20px',
      color: '#cc4444',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);

    const yesBtn = this.add.text(420, 400, '[ YES ]', {
      fontSize: '18px',
      color: '#cc4444',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);
    this.enlargeHitArea(yesBtn);
    yesBtn.on('pointerover', () => yesBtn.setColor('#ff6666'));
    yesBtn.on('pointerout', () => yesBtn.setColor('#cc4444'));
    yesBtn.on('pointerdown', () => {
      this.resetSaveState();
      this.hideDeleteConfirmation();
      this.buildMenu();
    });

    const noBtn = this.add.text(604, 400, '[ NO ]', {
      fontSize: '18px',
      color: '#44cc44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);
    this.enlargeHitArea(noBtn);
    noBtn.on('pointerover', () => noBtn.setColor('#88ff88'));
    noBtn.on('pointerout', () => noBtn.setColor('#44cc44'));
    noBtn.on('pointerdown', () => this.hideDeleteConfirmation());

    this.confirmOverlay = [bg, prompt, yesBtn, noBtn];
  }

  hideDeleteConfirmation() {
    if (this.confirmOverlay) {
      this.confirmOverlay.forEach(obj => obj.destroy());
      this.confirmOverlay = null;
    }
  }

  fitCamera() {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / 1024, this.scale.height / 768);
    cam.setZoom(zoom);
    cam.centerOn(512, 384);
  }

  enlargeHitArea(obj, padX = 24, padY = 18) {
    obj.setInteractive(
      new Phaser.Geom.Rectangle(-padX, -padY, obj.width + padX * 2, obj.height + padY * 2),
      Phaser.Geom.Rectangle.Contains
    );
    if (obj.input) obj.input.cursor = 'pointer';
  }

  initAudio() {
    this.audioReady = false;
    if (!this.sound || !this.sound.context) return;

    const ctx = this.sound.context;
    const cache = this.cache.audio;

    const startAudio = () => {
      generateAllSounds(ctx, cache).then(() => {
        this.audioReady = true;
        if (ctx.state === 'running') {
          this._drone = createAmbientDrone(ctx, this.sound.destination);
          this._drone.start();
        }
      }).catch(() => {});
    };

    if (this.sound.locked) {
      this._audioUnlockHandler = startAudio;
      this.sound.once('unlocked', this._audioUnlockHandler);
    } else {
      startAudio();
    }
  }
}
