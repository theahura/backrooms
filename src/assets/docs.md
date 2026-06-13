# Noridoc: assets

Path: @/src/assets

### Overview
- Holds the committed, AI-generated pixel-art PNGs that the game ships (`sprites/`), one file per texture key
- These are build artifacts of the offline generator `@/scripts/generate-art.mjs`; they are committed so the running game never calls any image API

### How it fits into the larger codebase
- Each PNG is named exactly after a Phaser texture key (e.g. `furniture_table.png`, `shop_bg.png`, `shop_icon_battery.png`). The key set is driven by `ART_MANIFEST` in `@/src/systems/art.js` -- so any key removed from the manifest has its committed PNG deleted from this folder (this is why there are no longer any `player_*`/`enemy_*`/`crawler_*`/`spitter_*` or `furniture_armoire`/`furniture_couch`/`furniture_counter` files: those are now hand-authored procedural top-down art in `@/src/systems/sprites.js`, because the image model cannot draw them from directly overhead)
- The PNGs are discovered at build time via Vite `import.meta.glob` and loaded in the scenes' `preload()`: `@/src/scenes/GameScene.js` loads every non-`shop_` file; `@/src/scenes/ShopScene.js` loads only the `shop_`-prefixed files (background + per-upgrade icons)
- At runtime a loaded PNG always wins for its key; any key WITHOUT a PNG falls back to the procedural pixel-grid texture defined in `@/src/systems/sprites.js`. The texture keys are identical either way, so no gameplay code depends on the art source. The per-key choice is the scenes' inline `this.textures.exists(key)` check, NOT the `getTextureSource()` helper in `@/src/systems/art.js` (which states the same policy but has no production caller)
- Only the sprites the model can actually draw are generated here; anything the model gets wrong is intentionally left procedural and has no file in this folder -- tiny micro-sprites (bullets, small coins), AND the characters (player/enemy/crawler/spitter) and the armoire/couch/counter furniture (all of which the model renders front-facing instead of top-down)

### Things to Know
- These files are regenerated only by running `npm run generate-art` (build-time, requires `GEMINI_KEY` in the repo-root `.env`); the key is NEVER shipped to the browser. See the root `@/docs.md` "Offline AI-art pipeline"
- nano banana cannot output transparency, so committed sprite PNGs have already had their background flood-filled to alpha by the generator's chroma-key step (`isBackgroundSample` in `@/src/systems/art.js`); the opaque `shop_bg` is the exception (`chroma: false`)
- Furniture/icon PNGs are generated at a target size and stretched to logical in-game dimensions via `setDisplaySize()`, so they do not need to match gameplay dimensions exactly

Created and maintained by Nori.
