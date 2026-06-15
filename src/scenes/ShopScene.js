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
import { getLocation } from '../systems/locations.js';
import { getJournalEntries, getJournalPage } from '../systems/lore.js';
import { generateAllSounds } from '../systems/audioEngine.js';
import { getEffectiveVolume, createDefaultSettings } from '../systems/settings.js';
import { shopIconKey } from '../systems/art.js';

const SHOP_PNGS = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const JOURNAL_ENTRIES_PER_PAGE = 5;

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

    saveGame(shopState, this.registry.get('runCount') ?? 0, this.registry.get('collectedLore') ?? [], this.unlockedLocations, this.activeLocation, this.registry.get('worldSeed') ?? null);
    this.shopState = shopState;
    this.treasureEarned = treasureEarned;
    this.newLocation = newLocation;
    this.collectedLore = new Set(this.registry.get('collectedLore') ?? []);
    this.journalOverlay = null;
    this.journalPage = 0;
    this.audioSettings = this.registry.get('audioSettings') || createDefaultSettings();
  }

  preload() {
    for (const [path, url] of Object.entries(SHOP_PNGS)) {
      const key = path.split('/').pop().replace('.png', '');
      if (!key.startsWith('shop_')) continue;
      this.load.image(key, url);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#111111');
    this.fitShopCamera();

    if (this.textures.exists('shop_bg')) {
      const bg = this.add.image(512, 384, 'shop_bg');
      bg.setDisplaySize(1024, 768);
      bg.setAlpha(0.5);
      bg.setDepth(-10);
    }
    this._onResize = () => this.fitShopCamera();
    this.scale.on('resize', this._onResize);

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
    const startY = 140;
    const rowHeight = 42;

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
      }).setOrigin(0.5);
      this.enlargeHitArea(prevBtn, 32, 24);
      prevBtn.on('pointerdown', () => {
        this.playSound('shop_click');
        this.cycleLocation(-1);
      });

      const nextBtn = this.add.text(684, locationY, '>', {
        fontSize: '20px',
        color: '#88aaff',
        fontFamily: 'monospace',
      }).setOrigin(0.5);
      this.enlargeHitArea(nextBtn, 32, 24);
      nextBtn.on('pointerdown', () => {
        this.playSound('shop_click');
        this.cycleLocation(1);
      });

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
    }).setOrigin(0.5);
    this.enlargeHitArea(enterBtn);

    enterBtn.on('pointerover', () => enterBtn.setColor('#88ff88'));
    enterBtn.on('pointerout', () => enterBtn.setColor('#44cc44'));
    enterBtn.on('pointerdown', () => {
      this.playSound('shop_click');
      this.registry.set('shopState', this.shopState);
      this.registry.set('activeLocation', this.activeLocation);
      saveGame(this.shopState, this.registry.get('runCount') ?? 0, this.registry.get('collectedLore') ?? [], this.unlockedLocations, this.activeLocation, this.registry.get('worldSeed') ?? null);
      this.scene.start('GameScene');
    });

    const journalData = getJournalEntries(this.collectedLore);
    const journalBtn = this.add.text(900, 90, `[ NOTES ${journalData.collectedCount}/${journalData.totalCount} ]`, {
      fontSize: '14px',
      color: '#88aaff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);
    this.enlargeHitArea(journalBtn);

    journalBtn.on('pointerover', () => journalBtn.setColor('#bbddff'));
    journalBtn.on('pointerout', () => journalBtn.setColor('#88aaff'));
    journalBtn.on('pointerdown', () => {
      this.playSound('shop_click');
      this.showJournal();
    });

    this.refreshDisplay();
    this.initAudio();
  }

  initAudio() {
    this.audioReady = false;
    if (!this.sound || !this.sound.context) return;

    const ctx = this.sound.context;
    const cache = this.cache.audio;

    const startAudio = () => {
      generateAllSounds(ctx, cache).then(() => {
        this.audioReady = true;
      }).catch(() => {});
    };

    if (this.sound.locked) {
      this._audioUnlockHandler = startAudio;
      this.sound.once('unlocked', this._audioUnlockHandler);
    } else {
      startAudio();
    }

    this.events.once('shutdown', () => {
      this.scale.off('resize', this._onResize);
      if (this._audioUnlockHandler && this.sound) {
        this.sound.off('unlocked', this._audioUnlockHandler);
        this._audioUnlockHandler = null;
      }
    });
  }

  fitShopCamera() {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / 1024, this.scale.height / 768);
    cam.setZoom(zoom);
    cam.centerOn(512, 384);
  }

  playSound(key) {
    if (!this.audioReady) return;
    const vol = 0.5 * getEffectiveVolume(this.audioSettings.masterVolume, this.audioSettings.sfxVolume);
    if (vol <= 0) return;
    try {
      this.sound.play(key, { volume: vol });
    } catch (_) {}
  }

  enlargeHitArea(obj, padX = 24, padY = 18) {
    obj.setInteractive(
      new Phaser.Geom.Rectangle(-padX, -padY, obj.width + padX * 2, obj.height + padY * 2),
      Phaser.Geom.Rectangle.Contains
    );
    if (obj.input) obj.input.cursor = 'pointer';
  }

  createUpgradeRow(upgrade, y) {
    const iconKey = shopIconKey(upgrade.id);
    if (iconKey && this.textures.exists(iconKey)) {
      this.add.image(72, y + 14, iconKey).setDisplaySize(34, 34);
    }

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
    });
    this.enlargeHitArea(buyBtn, 20, 16);

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
        saveGame(this.shopState, this.registry.get('runCount') ?? 0, this.registry.get('collectedLore') ?? [], this.unlockedLocations, this.activeLocation, this.registry.get('worldSeed') ?? null);
        this.refreshDisplay();
        this.playSound('shop_purchase');
      } else {
        this.playSound('shop_denied');
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

  showJournal() {
    if (this.journalOverlay) return;

    const ENTRIES_PER_PAGE = JOURNAL_ENTRIES_PER_PAGE;
    const journalData = getJournalEntries(this.collectedLore);
    this.journalEntries = journalData.entries;
    this.journalPage = 0;

    const objects = [];

    const bg = this.add.graphics().setDepth(2000);
    bg.fillStyle(0x111111, 1);
    bg.fillRect(0, 0, 1024, 768);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, 1024, 768), Phaser.Geom.Rectangle.Contains);
    objects.push(bg);

    const title = this.add.text(512, 50, `COLLECTED NOTES  ${journalData.collectedCount}/${journalData.totalCount}`, {
      fontSize: '24px',
      color: '#cccccc',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2001);
    objects.push(title);

    const divider = this.add.graphics().setDepth(2001);
    divider.lineStyle(1, 0x555555);
    divider.lineBetween(100, 80, 924, 80);
    objects.push(divider);

    this.journalSlots = [];
    for (let i = 0; i < ENTRIES_PER_PAGE; i++) {
      const y = 100 + i * 110;

      const label = this.add.text(100, y, '', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
      }).setDepth(2001);

      const text = this.add.text(100, y + 22, '', {
        fontSize: '13px',
        color: '#cccccc',
        fontFamily: 'monospace',
        wordWrap: { width: 824 },
      }).setDepth(2001);

      const line = this.add.graphics().setDepth(2001);
      line.lineStyle(1, 0x333333);
      line.lineBetween(100, y + 95, 924, y + 95);

      objects.push(label, text, line);
      this.journalSlots.push({ label, text });
    }

    this.journalPrevBtn = this.add.text(400, 670, '< PREV', {
      fontSize: '16px',
      color: '#88aaff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2001);
    this.enlargeHitArea(this.journalPrevBtn);
    this.journalPrevBtn.on('pointerdown', () => {
      this.playSound('shop_click');
      this.journalPage--;
      this.renderJournalPage();
    });
    objects.push(this.journalPrevBtn);

    this.journalPageText = this.add.text(512, 670, '', {
      fontSize: '16px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2001);
    objects.push(this.journalPageText);

    this.journalNextBtn = this.add.text(624, 670, 'NEXT >', {
      fontSize: '16px',
      color: '#88aaff',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2001);
    this.enlargeHitArea(this.journalNextBtn);
    this.journalNextBtn.on('pointerdown', () => {
      this.playSound('shop_click');
      this.journalPage++;
      this.renderJournalPage();
    });
    objects.push(this.journalNextBtn);

    const closeBtn = this.add.text(512, 730, '[ CLOSE ]', {
      fontSize: '18px',
      color: '#44cc44',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(2001);
    this.enlargeHitArea(closeBtn);
    closeBtn.on('pointerover', () => closeBtn.setColor('#88ff88'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#44cc44'));
    closeBtn.on('pointerdown', () => {
      this.playSound('shop_click');
      this.hideJournal();
    });
    objects.push(closeBtn);

    this.journalEscHandler = () => this.hideJournal();
    this.input.keyboard.on('keydown-ESC', this.journalEscHandler);

    this.journalOverlay = objects;
    this.renderJournalPage();
  }

  renderJournalPage() {
    const ENTRIES_PER_PAGE = JOURNAL_ENTRIES_PER_PAGE;
    const { pageEntries, currentPage, totalPages } = getJournalPage(this.journalEntries, this.journalPage, ENTRIES_PER_PAGE);
    this.journalPage = currentPage;

    for (let i = 0; i < this.journalSlots.length; i++) {
      const slot = this.journalSlots[i];
      if (i < pageEntries.length) {
        const entry = pageEntries[i];
        if (entry.collected) {
          slot.label.setText(`Note #${entry.id + 1}`).setColor('#ffffff');
          slot.text.setText(`"${entry.text}"`).setColor('#cccccc');
        } else {
          slot.label.setText(`Note #${entry.id + 1}`).setColor('#555555');
          slot.text.setText('???').setColor('#555555');
        }
        slot.label.setVisible(true);
        slot.text.setVisible(true);
      } else {
        slot.label.setVisible(false);
        slot.text.setVisible(false);
      }
    }

    this.journalPageText.setText(`${currentPage + 1} / ${totalPages}`);
    this.journalPrevBtn.setVisible(currentPage > 0);
    this.journalNextBtn.setVisible(currentPage < totalPages - 1);
  }

  hideJournal() {
    if (!this.journalOverlay) return;
    for (const obj of this.journalOverlay) {
      obj.destroy();
    }
    this.journalOverlay = null;
    this.journalSlots = null;
    this.journalEntries = null;
    if (this.journalEscHandler) {
      this.input.keyboard.off('keydown-ESC', this.journalEscHandler);
      this.journalEscHandler = null;
    }
  }
}
