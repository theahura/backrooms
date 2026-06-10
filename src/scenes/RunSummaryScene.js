import Phaser from 'phaser';
import { getSummaryData } from '../systems/runStats.js';

export class RunSummaryScene extends Phaser.Scene {
  constructor() {
    super('RunSummaryScene');
  }

  init(data) {
    this.isTransitioning = false;
    this.survived = data?.survived ?? false;
    this.treasureEarned = data?.treasureEarned ?? 0;
    this.runStats = data?.runStats ?? { enemiesKilled: 0, timeElapsed: 0, maxFloor: 0 };
    this.roomsExplored = data?.roomsExplored ?? 0;
    this.hp = data?.hp ?? 0;
    this.maxHp = data?.maxHp ?? 100;
    this.newLocation = data?.newLocation ?? null;
    this.touchMode = data?.touchMode ?? false;
  }

  create() {
    const { width, height } = this.cameras.main;
    const summary = getSummaryData(
      this.runStats, this.survived, this.treasureEarned,
      this.roomsExplored, this.hp, this.maxHp
    );

    this.cameras.main.setBackgroundColor('#000000');
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

    const titleText = this.add.text(width / 2, height * 0.15, summary.title, {
      fontSize: '52px',
      color: `#${summary.titleColor.toString(16).padStart(6, '0')}`,
      fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: titleText,
      alpha: 1,
      duration: 800,
      ease: 'Power2',
    });

    const startY = height * 0.32;
    const lineHeight = 42;
    const labelX = width / 2 - 20;
    const valueX = width / 2 + 20;
    const colorHex = `#${summary.accentColor.toString(16).padStart(6, '0')}`;

    const statObjects = [];
    for (let i = 0; i < summary.lines.length; i++) {
      const y = startY + i * lineHeight;
      const label = this.add.text(labelX, y, summary.lines[i].label, {
        fontSize: '22px',
        color: '#888888',
        fontFamily: 'monospace',
      }).setOrigin(1, 0).setAlpha(0);

      const value = this.add.text(valueX, y, summary.lines[i].value, {
        fontSize: '22px',
        color: colorHex,
        fontFamily: 'monospace',
      }).setOrigin(0, 0).setAlpha(0);

      statObjects.push(label, value);
    }

    this.tweens.add({
      targets: statObjects,
      alpha: 1,
      duration: 400,
      delay: this.tweens.stagger(200, { start: 1000 }),
      ease: 'Power2',
    });

    const totalDelay = 1000 + summary.lines.length * 200 + 400;

    const continuePrompt = this.touchMode ? 'Tap to continue' : 'Press any key to continue';
    const continueText = this.add.text(width / 2, height * 0.88, continuePrompt, {
      fontSize: '18px',
      color: '#555555',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setAlpha(0);

    this.time.delayedCall(totalDelay, () => {
      this.tweens.add({
        targets: continueText,
        alpha: 1,
        duration: 500,
      });
      this.enableContinue();
    });
  }

  enableContinue() {
    this.input.keyboard.once('keydown', () => this.goToShop());

    if (this.touchMode) {
      this.time.delayedCall(150, () => {
        this.input.once('pointerdown', () => this.goToShop());
      });
    } else {
      this.input.once('pointerdown', () => this.goToShop());
    }
  }

  goToShop() {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    this.scene.start('ShopScene', {
      treasureEarned: this.treasureEarned,
      newLocation: this.newLocation,
    });
  }
}
