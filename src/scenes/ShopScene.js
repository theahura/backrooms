import Phaser from 'phaser';
import {
  createShopState,
  addGold,
  canPurchase,
  purchaseUpgrade,
  getUpgradeCost,
  getUpgradeValue,
  UPGRADES,
} from '../systems/shop.js';
import { saveGame } from '../systems/persistence.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  init(data) {
    const treasureEarned = data?.treasureEarned ?? 0;
    let shopState = this.registry.get('shopState') || createShopState();
    const defaults = createShopState().upgrades;
    shopState = { ...shopState, upgrades: { ...defaults, ...shopState.upgrades } };
    shopState = addGold(shopState, treasureEarned);
    this.registry.set('shopState', shopState);
    saveGame(shopState, this.registry.get('runCount') ?? 0);
    this.shopState = shopState;
    this.treasureEarned = treasureEarned;
  }

  create() {
    this.cameras.main.setBackgroundColor('#111111');

    this.add.text(512, 40, 'THE SHOP', {
      fontSize: '36px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    const earnedColor = this.treasureEarned > 0 ? '#44cc44' : '#cc4444';
    this.add.text(512, 90, `Treasure earned: $${this.treasureEarned}`, {
      fontSize: '18px',
      color: earnedColor,
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.goldText = this.add.text(512, 120, '', {
      fontSize: '20px',
      color: '#ffd700',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.upgradeRows = [];
    const startY = 160;
    const rowHeight = 55;

    for (let i = 0; i < UPGRADES.length; i++) {
      const upgrade = UPGRADES[i];
      const y = startY + i * rowHeight;
      const row = this.createUpgradeRow(upgrade, y);
      this.upgradeRows.push(row);
    }

    const enterBtn = this.add.text(512, startY + UPGRADES.length * rowHeight + 40, '[ ENTER BACKROOMS ]', {
      fontSize: '24px',
      color: '#44cc44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    enterBtn.on('pointerover', () => enterBtn.setColor('#88ff88'));
    enterBtn.on('pointerout', () => enterBtn.setColor('#44cc44'));
    enterBtn.on('pointerdown', () => {
      this.registry.set('shopState', this.shopState);
      saveGame(this.shopState, this.registry.get('runCount') ?? 0);
      this.scene.start('GameScene');
    });

    this.refreshDisplay();
  }

  createUpgradeRow(upgrade, y) {
    const nameText = this.add.text(100, y, upgrade.name, {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'monospace',
    });

    const descText = this.add.text(100, y + 20, upgrade.description, {
      fontSize: '11px',
      color: '#888888',
      fontFamily: 'monospace',
    });

    const levelText = this.add.text(500, y, '', {
      fontSize: '16px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    });

    const costText = this.add.text(650, y, '', {
      fontSize: '16px',
      color: '#ffd700',
      fontFamily: 'monospace',
    });

    const buyBtn = this.add.text(820, y, '[ BUY ]', {
      fontSize: '16px',
      color: '#44cc44',
      fontFamily: 'monospace',
    }).setInteractive({ useHandCursor: true });

    buyBtn.on('pointerover', () => {
      if (canPurchase(this.shopState, upgrade.id)) {
        buyBtn.setColor('#88ff88');
      }
    });
    buyBtn.on('pointerout', () => this.refreshButton(upgrade, buyBtn));
    buyBtn.on('pointerdown', () => {
      if (canPurchase(this.shopState, upgrade.id)) {
        this.shopState = purchaseUpgrade(this.shopState, upgrade.id);
        this.registry.set('shopState', this.shopState);
        saveGame(this.shopState, this.registry.get('runCount') ?? 0);
        this.refreshDisplay();
      }
    });

    return { upgrade, nameText, descText, levelText, costText, buyBtn };
  }

  refreshButton(upgrade, buyBtn) {
    if (canPurchase(this.shopState, upgrade.id)) {
      buyBtn.setColor('#44cc44');
    } else {
      buyBtn.setColor('#555555');
    }
  }

  refreshDisplay() {
    this.goldText.setText(`Balance: $${this.shopState.gold}`);

    for (const row of this.upgradeRows) {
      const level = this.shopState.upgrades[row.upgrade.id];
      const maxLevel = row.upgrade.maxLevel;
      const dots = Array.from({ length: maxLevel }, (_, i) => i < level ? '●' : '○').join(' ');
      row.levelText.setText(`Lv ${level}/${maxLevel}  ${dots}`);

      const cost = getUpgradeCost(row.upgrade.id, level);
      if (cost !== null) {
        row.costText.setText(`$${cost}`);
        row.buyBtn.setVisible(true);
        this.refreshButton(row.upgrade, row.buyBtn);
      } else {
        row.costText.setText('MAX');
        row.costText.setColor('#44cc44');
        row.buyBtn.setVisible(false);
      }
    }
  }
}
