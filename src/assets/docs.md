# Noridoc: assets

Path: @/src/assets

### Overview
- Holds the committed, AI-generated pixel-art PNGs that the game ships (`sprites/`), one file per texture key
- These are build artifacts of TWO offline generators -- `@/scripts/generate-art.mjs` (furniture-top + shop sprites, driven by `ART_MANIFEST`) and `@/scripts/gen-character-directional.mjs` (the player/enemy 8-direction character frames, NOT in `ART_MANIFEST`); they are committed so the running game never calls any image API

### How it fits into the larger codebase
- Each PNG is named exactly after a Phaser texture key (e.g. `furniture_table.png`, `shop_bg.png`, `player_down.png`, `enemy_up_right_walk0.png`). For the furniture/shop set the key list is driven by `ART_MANIFEST` in `@/src/systems/art.js`. The character set is the player/basic-zombie directional frames: `{player,enemy}_{down,down_right,right,up_right,up}.png` plus two walk-step variants of each (`_walk0`/`_walk1` -- AI-generated left/right leg-step poses, registered to the base by the head) -- only FIVE base facings per character, because `@/src/systems/sprites.js` mirrors the three left-side facings with `flipX` (so there are no `*_left`/`*_down_left`/`*_up_left` files). Crawler/spitter and `furniture_armoire`/`furniture_couch`/`furniture_counter` have NO files here -- they are hand-authored procedural top-down grids in `@/src/systems/sprites.js`, because the image model cannot draw them from directly overhead
- The PNGs are discovered at build time via Vite `import.meta.glob` and loaded in the scenes' `preload()`: `@/src/scenes/GameScene.js` loads every non-`shop_` file (furniture tops AND character directional frames, via the same glob); `@/src/scenes/ShopScene.js` loads only the `shop_`-prefixed files (background + per-upgrade icons)
- At runtime a loaded PNG always wins for its key; any key WITHOUT a PNG falls back to the procedural pixel-grid texture defined in `@/src/systems/sprites.js`. The texture keys are identical either way, so no gameplay code depends on the art source. The per-key choice is the scenes' inline `this.textures.exists(key)` check, NOT the `getTextureSource()` helper in `@/src/systems/art.js` (which states the same policy but has no production caller)
- Only the sprites the model can actually draw are generated; anything the model gets wrong is intentionally left procedural and has no file in this folder -- tiny micro-sprites (bullets, small coins), the crawler/spitter creatures, and the armoire/couch/counter furniture. The player and basic zombie ARE PNG-backed, but as 8-direction frames from `gen-character-directional.mjs` (a separate pipeline that builds the facings consistently via image-to-image), not from the `generate-art.mjs`/`ART_MANIFEST` path

### Things to Know
- These files are regenerated only at build time (requires `GEMINI_KEY` in the repo-root `.env`); the key is NEVER shipped to the browser. The furniture/shop set comes from `npm run generate-art` (`@/scripts/generate-art.mjs`); the player/enemy directional frames come from `node scripts/gen-character-directional.mjs`. See the root `@/docs.md` "Offline AI-art pipeline"
- nano banana cannot output transparency, so committed sprite PNGs have already had their background flood-filled to alpha by the generator's chroma-key step (`isBackgroundSample` in `@/src/systems/art.js`); the opaque `shop_bg` is the exception (`chroma: false`)
- Furniture/icon PNGs are generated at a target size and stretched to logical in-game dimensions via `setDisplaySize()`, so they do not need to match gameplay dimensions exactly

Created and maintained by Nori.
