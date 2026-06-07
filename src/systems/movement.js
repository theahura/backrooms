export function calculateVelocity(keys, speed) {
  let x = 0;
  let y = 0;

  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;

  const magnitude = Math.sqrt(x * x + y * y);
  if (magnitude > 0) {
    x = (x / magnitude) * speed;
    y = (y / magnitude) * speed;
  }

  return { x, y };
}
