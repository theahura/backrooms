import { describe, it, expect } from 'vitest';
import {
  getMoveVelocity,
  resolveAimAngle,
  resolveFireIntent,
  resolveMoveVelocity,
  detectTouchPrimary,
  computeTouchLayout,
} from '../touchControls.js';

describe('getMoveVelocity', () => {
  it('moves at full speed in the stick direction at full deflection', () => {
    const v = getMoveVelocity(0, 1, 200);
    expect(v.x).toBeCloseTo(200, 1);
    expect(v.y).toBeCloseTo(0, 1);
  });

  it('scales speed proportionally to partial deflection (analog)', () => {
    const v = getMoveVelocity(0, 0.5, 200);
    expect(v.x).toBeCloseTo(100, 1);
    expect(v.y).toBeCloseTo(0, 1);
  });

  it('points down when the angle is straight down', () => {
    const v = getMoveVelocity(Math.PI / 2, 1, 200);
    expect(v.x).toBeCloseTo(0, 1);
    expect(v.y).toBeCloseTo(200, 1);
  });

  it('produces no movement at zero deflection', () => {
    const v = getMoveVelocity(1.3, 0, 200);
    expect(v.x).toBeCloseTo(0, 1);
    expect(v.y).toBeCloseTo(0, 1);
  });

  it('never exceeds the max speed even when force overshoots 1', () => {
    const v = getMoveVelocity(0, 2, 200);
    const magnitude = Math.sqrt(v.x * v.x + v.y * v.y);
    expect(magnitude).toBeCloseTo(200, 1);
  });

  it('produces no movement when force is negative (clamps below zero)', () => {
    const v = getMoveVelocity(0, -0.5, 200);
    expect(v.x).toBeCloseTo(0, 1);
    expect(v.y).toBeCloseTo(0, 1);
  });

  it('splits velocity correctly on a down-right diagonal (guards sin/cos swap)', () => {
    const v = getMoveVelocity(Math.PI / 4, 1, 200);
    const expected = 200 * Math.SQRT1_2;
    expect(v.x).toBeCloseTo(expected, 1);
    expect(v.y).toBeCloseTo(expected, 1);
  });
});

describe('resolveAimAngle', () => {
  it('uses the aim stick angle while the stick is deflected (touch)', () => {
    const angle = resolveAimAngle({
      touchMode: true,
      aimActive: true,
      aimAngle: 1.2,
      pointerAngle: 9.9,
      lastAngle: 0.3,
    });
    expect(angle).toBeCloseTo(1.2, 5);
  });

  it('holds the last aim angle when the stick is released (touch) instead of snapping', () => {
    const angle = resolveAimAngle({
      touchMode: true,
      aimActive: false,
      aimAngle: 0,
      pointerAngle: 9.9,
      lastAngle: 0.3,
    });
    expect(angle).toBeCloseTo(0.3, 5);
  });

  it('follows the pointer angle on desktop and ignores the stick', () => {
    const angle = resolveAimAngle({
      touchMode: false,
      aimActive: true,
      aimAngle: 1.2,
      pointerAngle: 2.0,
      lastAngle: 0.3,
    });
    expect(angle).toBeCloseTo(2.0, 5);
  });
});

describe('resolveFireIntent', () => {
  it('does NOT fire on a generic screen touch in touch mode (left button maps to touch)', () => {
    const fire = resolveFireIntent({
      touchMode: true,
      fireButtonDown: false,
      leftButtonDown: true,
    });
    expect(fire).toBe(false);
  });

  it('fires only when the dedicated fire button is held in touch mode', () => {
    const fire = resolveFireIntent({
      touchMode: true,
      fireButtonDown: true,
      leftButtonDown: false,
    });
    expect(fire).toBe(true);
  });

  it('fires on left mouse button on desktop', () => {
    expect(resolveFireIntent({ touchMode: false, fireButtonDown: false, leftButtonDown: true })).toBe(true);
    expect(resolveFireIntent({ touchMode: false, fireButtonDown: false, leftButtonDown: false })).toBe(false);
  });
});

describe('resolveMoveVelocity', () => {
  it('uses the move stick velocity when the stick is active (touch)', () => {
    const v = resolveMoveVelocity({
      touchMode: true,
      moveActive: true,
      stickVelocity: { x: 50, y: 60 },
      keyboardVelocity: { x: 0, y: 0 },
    });
    expect(v).toEqual({ x: 50, y: 60 });
  });

  it('falls back to the keyboard when the move stick is released (touch/hybrid)', () => {
    const v = resolveMoveVelocity({
      touchMode: true,
      moveActive: false,
      stickVelocity: { x: 50, y: 60 },
      keyboardVelocity: { x: 100, y: 0 },
    });
    expect(v).toEqual({ x: 100, y: 0 });
  });

  it('uses the keyboard on desktop regardless of stick values', () => {
    const v = resolveMoveVelocity({
      touchMode: false,
      moveActive: true,
      stickVelocity: { x: 50, y: 60 },
      keyboardVelocity: { x: 100, y: 0 },
    });
    expect(v).toEqual({ x: 100, y: 0 });
  });
});

describe('detectTouchPrimary', () => {
  it('is false for a mouse-only device', () => {
    expect(detectTouchPrimary({ maxTouchPoints: 0, coarsePointer: false })).toBe(false);
  });

  it('is true when the primary pointer is coarse', () => {
    expect(detectTouchPrimary({ maxTouchPoints: 0, coarsePointer: true })).toBe(true);
  });

  it('is true when the hardware reports touch points', () => {
    expect(detectTouchPrimary({ maxTouchPoints: 5, coarsePointer: false })).toBe(true);
  });
});

describe('computeTouchLayout', () => {
  const radius = 90;

  it('centers both sticks vertically so the thumb can travel the full radius down', () => {
    const wideShortPhone = computeTouchLayout({ width: 844, height: 390, stickRadius: radius });
    expect(wideShortPhone.moveStick.y).toBe(195);
    expect(wideShortPhone.aimStick.y).toBe(195);
    // full downward (and upward) travel must fit on screen even on a short landscape phone
    expect(wideShortPhone.moveStick.y + radius).toBeLessThanOrEqual(390);
    expect(wideShortPhone.moveStick.y - radius).toBeGreaterThanOrEqual(0);
  });

  it('puts the move stick on the left and the aim stick on the right, symmetric and inset', () => {
    const layout = computeTouchLayout({ width: 1024, height: 768, stickRadius: radius });
    expect(layout.moveStick.x).toBeLessThan(512);
    expect(layout.aimStick.x).toBeGreaterThan(512);
    expect(layout.moveStick.x).toBe(1024 - layout.aimStick.x);
    // full radius must fit horizontally within the screen
    expect(layout.moveStick.x - radius).toBeGreaterThanOrEqual(0);
    expect(layout.aimStick.x + radius).toBeLessThanOrEqual(1024);
  });

  it('places the fire button on-screen near the aim stick (right thumb)', () => {
    const layout = computeTouchLayout({ width: 844, height: 390, stickRadius: radius });
    const fb = layout.fireButton;
    expect(fb.radius).toBeGreaterThan(0);
    expect(fb.x - fb.radius).toBeGreaterThanOrEqual(0);
    expect(fb.x + fb.radius).toBeLessThanOrEqual(844);
    expect(fb.y - fb.radius).toBeGreaterThanOrEqual(0);
    expect(fb.y + fb.radius).toBeLessThanOrEqual(390);
    // it lives on the aim-stick (right) side, not over the move stick
    expect(fb.x).toBeGreaterThan(layout.moveStick.x);
    expect(fb.x).toBeLessThan(layout.aimStick.x);
  });

  it('lays the weapon/battery action row centered along the bottom, clear of the very bottom edge', () => {
    const layout = computeTouchLayout({ width: 844, height: 390, stickRadius: radius });
    const row = layout.actionRow;
    expect(row.weaponX).toBeLessThan(row.batteryX);
    // the two-button row straddles the horizontal center
    expect((row.weaponX + row.batteryX) / 2).toBe(422);
    // below the centered sticks but not flush against the bottom edge
    expect(row.y).toBeGreaterThan(195);
    expect(row.y).toBeLessThan(390);
  });

  it('places the use button next to the right aim stick, within right-thumb reach', () => {
    const layout = computeTouchLayout({ width: 844, height: 390, stickRadius: radius });
    const use = layout.useButton;
    // far closer to the right aim stick than to the left move stick
    expect(Math.abs(use.x - layout.aimStick.x)).toBeLessThan(Math.abs(use.x - layout.moveStick.x));
    // sits below the aim stick so the right thumb can drop straight to it
    expect(use.y).toBeGreaterThan(layout.aimStick.y);
    // fully on-screen (button radius ~34)
    expect(use.x + 34).toBeLessThanOrEqual(844);
    expect(use.y + 34).toBeLessThanOrEqual(390);
  });

  it('keeps the fullscreen button on-screen near the top', () => {
    const layout = computeTouchLayout({ width: 844, height: 390, stickRadius: radius });
    expect(layout.fullscreenButton.x).toBeGreaterThanOrEqual(0);
    expect(layout.fullscreenButton.x).toBeLessThanOrEqual(844);
    expect(layout.fullscreenButton.y).toBeLessThan(195);
  });
});
