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
import { getLocation, LOCATIONS } from '../systems/locations.js';

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('ShopScene');
  }

  init(data) {
    const treasureEarned = data?.treasureEarned ?? 0;
    const newLocation = data?.newLocation ?? null;
    let shopState = this.registry.get('shopState') || createShopState();
    const defaults = createShopState().upgrades;
    shopState = { ...shopState, upgrades: { ...defaults, ...shopState.upgrades } };
    shopState = addGold(shopState, treasureEarned);
    this.registry.set('shopState', shopState);

    this.unlockedLocations = this.registry.get('unlockedLocations') ?? ['store'];
    if (newLocation && !this.unlockedLocations.includes(newLocation)) {
      this.unlockedLocations = [...this.unlockedLocations, newLocation];
      this.registry.set('unlockedLocations', this.unlockedLocations);
    }
    this.activeLocation = this.registry.get('activeLocation') ?? 'store';

    saveGame(shopState, this.registry.get('runCount') ?? 0, this.registry.get('collectedLore') ?? [], this.unlockedLocations, this.activeLocation);
    this.shopState = shopState;
    this.treasureEarned = treasureEarned;
    this.newLocation = newLocation;
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

    const locationY = startY + UPGRADES.length * rowHeight + 20;
    if (this.unlockedLocations.length > 1) {
      this.locationText = this.add.text(512, locationY, '', {
        fontSize: '16px',
        color: '#88aaff',
        fontFamily: 'monospace',
      }).setOrigin(0.5);

      const prevBtn = this.add.text(340, locationY, '<', {
        fontSize: '20px',
        color: '#88aaff',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      prevBtn.on('pointerdown', () => this.cycleLocation(-1));

      const nextBtn = this.add.text(684, locationY, '>', {
        fontSize: '20px',
        color: '#88aaff',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      nextBtn.on('pointerdown', () => this.cycleLocation(1));

      this.updateLocationDisplay();
    } else {
      const locData = getLocation(this.activeLocation);
      this.add.text(512, locationY, `Starting from: ${locData ? locData.name : this.activeLocation}`, {
        fontSize: '14px',
        color: '#666666',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    if (this.newLocation) {
      const locData = getLocation(this.newLocation);
      this.add.text(512, locationY - 25, `New location discovered: ${locData ? locData.name : this.newLocation}!`, {
        fontSize: '14px',
        color: '#ffdd44',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
    }

    const enterBtnY = locationY + 40;
    const enterBtn = this.add.text(512, enterBtnY, '[ ENTER BACKROOMS ]', {
      fontSize: '24px',
      color: '#44cc44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    enterBtn.on('pointerover', () => enterBtn.setColor('#88ff88'));
    enterBtn.on('pointerout', () => enterBtn.setColor('#44cc44'));
    enterBtn.on('pointerdown', () => {
      this.registry.set('shopState', this.shopState);
      this.registry.set('activeLocation', this.activeLocation);
      saveGame(this.shopState, this.registry.get('runCount') ?? 0, this.registry.get('collectedLore') ?? [], this.unlockedLocations, this.activeLocation);
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
        saveGame(this.shopState, this.registry.get('runCount') ?? 0, this.registry.get('collectedLore') ?? [], this.unlockedLocations, this.activeLocation);
        this.refreshDisplay();
      }
    });

    return { upgrade, nameText, descText, levelText, costText, buyBtn };
  }

  cycleLocation(direction) {
    const idx = this.unlockedLocations.indexOf(this.activeLocation);
    const newIdx = (idx + direction + this.unlockedLocations.length) % this.unlockedLocations.length;
    this.activeLocation = this.unlockedLocations[newIdx];
    this.registry.set('activeLocation', this.activeLocation);
    this.updateLocationDisplay();
  }

  updateLocationDisplay() {
    if (!this.locationText) return;
    const locData = getLocation(this.activeLocation);
    this.locationText.setText(`Start: ${locData ? locData.name : this.activeLocation}`);
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
