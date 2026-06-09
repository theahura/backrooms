export function getMoveVelocity(angle, force, speed) {
  const clamped = Math.max(0, Math.min(force, 1));
  return {
    x: Math.cos(angle) * speed * clamped,
    y: Math.sin(angle) * speed * clamped,
  };
}

export function resolveAimAngle({ touchMode, aimActive, aimAngle, pointerAngle, lastAngle }) {
  if (!touchMode) return pointerAngle;
  return aimActive ? aimAngle : lastAngle;
}

export function resolveFireIntent({ touchMode, fireButtonDown, leftButtonDown }) {
  return touchMode ? fireButtonDown : leftButtonDown;
}

export function resolveMoveVelocity({ touchMode, moveActive, stickVelocity, keyboardVelocity }) {
  return touchMode && moveActive ? stickVelocity : keyboardVelocity;
}

export function detectTouchPrimary({ maxTouchPoints, coarsePointer }) {
  return coarsePointer === true || maxTouchPoints > 0;
}

export function computeTouchLayout({ width, height, stickRadius }) {
  const edge = 30;
  const fireRadius = 52;
  const actionRadius = 34;
  const actionHalfSpacing = 45;
  const actionBottomMargin = 72;

  const inset = stickRadius + edge;
  const midY = Math.round(height / 2);
  const centerX = Math.round(width / 2);

  const moveStick = { x: inset, y: midY };
  const aimStick = { x: width - inset, y: midY };

  return {
    moveStick,
    aimStick,
    fireButton: {
      x: aimStick.x - stickRadius - fireRadius - 12,
      y: midY,
      radius: fireRadius,
    },
    useButton: {
      x: aimStick.x,
      y: Math.min(midY + stickRadius + actionRadius + 10, height - actionRadius - 8),
    },
    actionRow: {
      y: height - actionBottomMargin,
      weaponX: centerX - actionHalfSpacing,
      batteryX: centerX + actionHalfSpacing,
    },
    fullscreenButton: { x: centerX, y: 40 },
  };
}
