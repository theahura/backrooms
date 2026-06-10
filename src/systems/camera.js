// Camera layering helpers. The main gameplay camera is zoomed in so the player
// and world read bigger and "closer" (a claustrophobic feel); a second, fixed
// UI camera renders the HUD at 1:1. These pure helpers classify which objects
// belong to which camera. HUD objects are pinned to the screen on BOTH axes
// (scrollFactor 0); anything that scrolls with the world (including a world
// label pinned on only one axis, like the "Press E" prompt) is a world object.

export const CAMERA_ZOOM = 2.0;

export function isHudObject(obj) {
  return obj.scrollFactorX === 0 && obj.scrollFactorY === 0;
}

export function partitionSceneObjects(objects) {
  const hud = [];
  const world = [];
  for (const obj of objects) {
    if (isHudObject(obj)) hud.push(obj);
    else world.push(obj);
  }
  return { hud, world };
}
