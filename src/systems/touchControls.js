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
