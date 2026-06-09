import { describe, it, expect } from 'vitest';
import {
  createRunStats,
  recordKill,
  updateTime,
  updateMaxFloor,
  formatTime,
  getSummaryData,
} from '../runStats.js';

describe('runStats', () => {
  describe('createRunStats', () => {
    it('starts with zero kills, zero time, and floor zero', () => {
      const stats = createRunStats();
      expect(stats.enemiesKilled).toBe(0);
      expect(stats.timeElapsed).toBe(0);
      expect(stats.maxFloor).toBe(0);
    });
  });

  describe('recordKill', () => {
    it('increments enemies killed count by one', () => {
      let stats = createRunStats();
      stats = recordKill(stats);
      expect(stats.enemiesKilled).toBe(1);
      stats = recordKill(stats);
      expect(stats.enemiesKilled).toBe(2);
    });
  });

  describe('updateTime', () => {
    it('accumulates elapsed time from delta', () => {
      let stats = createRunStats();
      stats = updateTime(stats, 1000);
      stats = updateTime(stats, 500);
      expect(stats.timeElapsed).toBe(1500);
    });
  });

  describe('updateMaxFloor', () => {
    it('tracks the highest floor reached', () => {
      let stats = createRunStats();
      stats = updateMaxFloor(stats, 1);
      expect(stats.maxFloor).toBe(1);
      stats = updateMaxFloor(stats, 2);
      expect(stats.maxFloor).toBe(2);
    });

    it('does not decrease when visiting a lower floor', () => {
      let stats = createRunStats();
      stats = updateMaxFloor(stats, 3);
      stats = updateMaxFloor(stats, 1);
      expect(stats.maxFloor).toBe(3);
    });
  });

  describe('formatTime', () => {
    it('formats zero milliseconds as 0:00', () => {
      expect(formatTime(0)).toBe('0:00');
    });

    it('formats seconds with zero-padding', () => {
      expect(formatTime(65000)).toBe('1:05');
    });

    it('handles long durations', () => {
      expect(formatTime(600000)).toBe('10:00');
    });
  });

  describe('getSummaryData', () => {
    const baseStats = { enemiesKilled: 5, timeElapsed: 90000, maxFloor: 2 };

    it('returns gold-themed data when the player survived', () => {
      const summary = getSummaryData(baseStats, true, 350, 6, 10, 75, 100);
      expect(summary.title).toBe('ESCAPED');
      expect(summary.titleColor).toBe(0xffd700);
    });

    it('returns red-themed data when the player died', () => {
      const summary = getSummaryData(baseStats, false, 0, 3, 10, 0, 100);
      expect(summary.title).toBe('YOU DIED');
      expect(summary.titleColor).toBe(0xcc0000);
    });

    it('produces at least five stat lines covering the run', () => {
      const summary = getSummaryData(baseStats, true, 500, 7, 10, 80, 100);
      expect(summary.lines.length).toBeGreaterThanOrEqual(5);
    });

    it('includes HP line only when survived', () => {
      const died = getSummaryData(baseStats, false, 0, 3, 10, 0, 100);
      const survived = getSummaryData(baseStats, true, 350, 6, 10, 75, 100);
      const diedLabels = died.lines.map(l => l.label);
      const survivedLabels = survived.lines.map(l => l.label);
      expect(diedLabels).not.toContain('HP Remaining');
      expect(survivedLabels).toContain('HP Remaining');
    });

    it('shows formatted time in the summary', () => {
      const stats = { enemiesKilled: 0, timeElapsed: 65000, maxFloor: 0 };
      const summary = getSummaryData(stats, true, 0, 1, 5, 100, 100);
      const allValues = summary.lines.map(l => l.value);
      expect(allValues.some(v => v.includes('1:05'))).toBe(true);
    });
  });
});
