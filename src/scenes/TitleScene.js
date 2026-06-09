import Phaser from 'phaser';
import { loadGame, clearSave } from '../systems/persistence.js';
import { getMenuOptions, getTitleText } from '../systems/titleMenu.js';
import { generateAllSounds, createAmbientDrone } from '../systems/audioEngine.js';
import { getEffectiveVolume, cycleVolume, saveSettings, createDefaultSettings } from '../systems/settings.js';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('TitleScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.fadeIn(1000, 0, 0, 0);
    this.isTransitioning = false;
    this.confirmOverlay = null;
    this.settingsOverlay = null;

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
      this.hideSettingsOverlay();
      this.hideDeleteConfirmation();
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
        else if (baseColor === '#aaaaaa') text.setColor('#cccccc');
      });
      text.on('pointerout', () => text.setColor(baseColor));
      text.on('pointerdown', () => this.onMenuSelect(opt.key));
      this.menuItems.push(text);
    }

    const settingsY = startY + options.length * spacing;
    const settingsText = this.add.text(512, settingsY, '[ SETTINGS ]', {
      fontSize: '22px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.enlargeHitArea(settingsText);
    settingsText.on('pointerover', () => settingsText.setColor('#cccccc'));
    settingsText.on('pointerout', () => settingsText.setColor('#aaaaaa'));
    settingsText.on('pointerdown', () => this.onMenuSelect('settings'));
    this.menuItems.push(settingsText);
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
    if (this.isTransitioning || this.confirmOverlay || this.settingsOverlay) return;

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
    } else if (key === 'settings') {
      this.showSettingsOverlay();
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

  showSettingsOverlay() {
    if (this.settingsOverlay) return;
    this.settingsOverlay = [];

    const settings = this.registry.get('audioSettings') || createDefaultSettings();
    const bg = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.8).setDepth(100).setInteractive();
    this.settingsOverlay.push(bg);

    const titleTxt = this.add.text(512, 260, 'AUDIO SETTINGS', {
      fontSize: '24px', color: '#cccccc', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);
    this.settingsOverlay.push(titleTxt);

    const keys = [
      { key: 'masterVolume', label: 'Master' },
      { key: 'sfxVolume', label: 'SFX' },
      { key: 'ambientVolume', label: 'Ambient' },
    ];

    keys.forEach((entry, i) => {
      const y = 320 + i * 50;
      const label = this.add.text(380, y, entry.label, {
        fontSize: '18px', color: '#aaaaaa', fontFamily: 'monospace',
      }).setOrigin(1, 0.5).setDepth(101);

      const btn = this.add.text(520, y, `[ ${settings[entry.key]} ]`, {
        fontSize: '18px', color: '#ffd700', fontFamily: 'monospace',
      }).setOrigin(0, 0.5).setDepth(101);
      this.enlargeHitArea(btn);
      btn.on('pointerover', () => btn.setColor('#ffee88'));
      btn.on('pointerout', () => btn.setColor('#ffd700'));
      btn.on('pointerdown', () => {
        settings[entry.key] = cycleVolume(settings[entry.key]);
        btn.setText(`[ ${settings[entry.key]} ]`);
        this.registry.set('audioSettings', { ...settings });
        saveSettings(settings);
        if (this._drone) {
          const ambientVol = getEffectiveVolume(settings.masterVolume, settings.ambientVolume);
          this._drone.setVolume(ambientVol);
        }
      });

      this.settingsOverlay.push(label, btn);
    });

    const closeBtn = this.add.text(512, 500, '[ CLOSE ]', {
      fontSize: '18px', color: '#44cc44', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(101);
    this.enlargeHitArea(closeBtn);
    closeBtn.on('pointerover', () => closeBtn.setColor('#88ff88'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#44cc44'));
    closeBtn.on('pointerdown', () => this.hideSettingsOverlay());
    this.settingsOverlay.push(closeBtn);
  }

  hideSettingsOverlay() {
    if (this.settingsOverlay) {
      this.settingsOverlay.forEach(obj => obj.destroy());
      this.settingsOverlay = null;
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

    const audioSettings = this.registry.get('audioSettings') || createDefaultSettings();

    const startAudio = () => {
      generateAllSounds(ctx, cache).then(() => {
        this.audioReady = true;
        if (ctx.state === 'running') {
          this._drone = createAmbientDrone(ctx, this.sound.destination);
          const ambientVol = getEffectiveVolume(audioSettings.masterVolume, audioSettings.ambientVolume);
          this._drone.setVolume(ambientVol);
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
