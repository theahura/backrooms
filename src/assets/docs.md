# Noridoc: assets

Path: @/src/assets

### Overview
- Holds the committed, AI-generated pixel-art PNGs that the game ships (`sprites/`), one file per texture key
- These are build artifacts of the offline generator `@/scripts/generate-art.mjs`; they are committed so the running game never calls any image API

### How it fits into the larger codebase
- Each PNG is named exactly after a Phaser texture key (e.g. `player_walk_0.png`, `furniture_couch.png`, `trap_spike.png`, `shop_bg.png`, `shop_icon_battery.png`). The key set is driven by `ART_MANIFEST` in `@/src/systems/art.js`
- The PNGs are discovered at build time via Vite `import.meta.glob` and loaded in the scenes' `preload()`: `@/src/scenes/GameScene.js` loads every non-`shop_` file; `@/src/scenes/ShopScene.js` loads only the `shop_`-prefixed files (background + per-upgrade icons)
- At runtime a loaded PNG always wins for its key; any key WITHOUT a PNG falls back to the procedural pixel-grid texture defined in `@/src/systems/sprites.js` (see `getTextureSource` in `@/src/systems/art.js`). The texture keys are identical either way, so no gameplay code depends on the art source
- Only meaningful sprites are generated here; tiny micro-sprites (bullets, small coins) are intentionally left procedural and have no file in this folder

### Things to Know
- These files are regenerated only by running `npm run generate-art` (build-time, requires `GEMINI_KEY` in the repo-root `.env`); the key is NEVER shipped to the browser. See the root `@/docs.md` "Offline AI-art pipeline"
- nano banana cannot output transparency, so committed sprite PNGs have already had their background flood-filled to alpha by the generator's chroma-key step (`isBackgroundSample` in `@/src/systems/art.js`); the opaque `shop_bg` is the exception (`chroma: false`)
- Furniture/icon PNGs are generated at a target size and stretched to logical in-game dimensions via `setDisplaySize()`, so they do not need to match gameplay dimensions exactly

Created and maintained by Nori.
