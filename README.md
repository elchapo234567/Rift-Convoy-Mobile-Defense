# Rift Convoy: Mobile Defense

Rift Convoy is a mobile-convoy defense game built as a dependency-free HTML5 canvas application. Instead of defending a stationary path, the player protects four moving vehicles, installs weapon modules directly on convoy hardpoints, commands air support, and chooses a new risk/reward route after every cleared sector. A continuous generated road crosses four terrain biomes while random multi-direction ambushes can attack from every battlefield edge. Generated orthographic chassis follow the road geometry while separately layered top-down weapons rotate toward targets and visibly change at every upgrade level. The Convoy Garage contains four complete skin sets, with optional rewarded-ad unlocks for the three generated variants.

## Play locally

Run the game through HTTP; do not open `index.html` directly from a ZIP viewer.

```bash
python3 -m http.server 4200 --bind 127.0.0.1
```

Open `http://127.0.0.1:4200/`.

## Controls

- Mouse or touch: navigate, select modules, install and upgrade hardpoints, and aim active abilities.
- `1`–`4`: select a module from the current loadout.
- `H`: target Heli Strafe.
- `A`: target Airstrike.
- `R`: activate Repair Drone.
- `Space`: cycle through 1×, 2×, and 3× speed.
- `P`: pause or resume.
- Right-click: cancel the current module or ability selection.

## Automated validation

Playwright and Chromium are expected to be available in the development environment.

```bash
node tests/smoke.js
node tests/platform.js
node tests/expeditions.js
node tests/balance.js
node tests/mobile.js
node tests/geometry.js
node tests/artwork.js
node tests/features.js
node tests/ui-audit.js
```

The suites cover asset loading, six unique weapon sounds, all module weapons, every expedition and boss type, normal-player balance paths, four-direction ambushes, skin selection and rewarded-ad unlocks, rewarded-ad success/error/duplicate callbacks, cloud restore, revive flow, desktop/mobile layouts, portrait guidance, and all major interface screens.

## CrazyGames build

```bash
bash scripts/build-release.sh
```

The resulting upload is `release/rift-convoy-mobile-defense-crazygames.zip`. See `CRAZYGAMES_UPLOAD.md` for the submission and Preview checklist.

