# CrazyGames Release Guide

## Upload artifact

Upload `release/rift-convoy-mobile-defense-crazygames.zip` as an HTML5 build. `index.html` and `assets/` are located directly at the archive root. The game has no package installation or external runtime asset dependency; only the official CrazyGames SDK v3 is loaded from CrazyGames.

The build contains:

- eight escalating convoy expeditions with three to six sectors;
- four generated top-down convoy vehicles and four installable rotating hardpoints;
- a continuous procedural road across four crossfading terrain biomes, with vehicles aligned to every curve;
- six modules with four individually generated and visibly distinct upgrade designs each;
- six individually processed CC0 weapon sounds, one unique sound profile per module;
- random ambush events that attack from the left, right, top, and bottom with direction-safe enemy rendering;
- four complete convoy skin sets in the Garage, including three generated rewarded-ad unlocks;
- Heli Strafe, Airstrike, and Repair Drone active abilities;
- six risk/reward route decisions, with a safe option always available;
- seven normal enemy classes and four boss behavior families;
- 1×, 2×, and 3× simulation speed;
- a five-step skippable visual onboarding flow;
- landscape desktop and mobile controls with portrait rotation guidance;
- CrazyGames Data cloud progress plus local fallback;
- optional rewarded ads for 5 Shards, one post-defeat convoy revive, and cosmetic convoy skins.

## Portal steps

1. Create a new **HTML5** game entry named **Rift Convoy: Mobile Defense**.
2. Upload `release/rift-convoy-mobile-defense-crazygames.zip`.
3. Add the English description and controls from `marketing/crazygames-listing.txt`.
4. Upload the three exact-size images from `marketing/covers/`.
5. Open the private Preview/Sandbox link and complete the checklist below.
6. Submit only after the Preview checks pass without console errors.

## Mandatory Preview checklist

- Start with a clean browser profile: 0 Shards, only the four starter modules, and only First Escort unlocked.
- Complete or skip the five-step tutorial.
- Install, upgrade, and sell convoy modules while the convoy is moving.
- Confirm every vehicle follows the road angle and that a destroyed vehicle removes its mounted module at the same time.
- Confirm enemies remain upright and direction markers point toward the convoy during left, right, top, and bottom ambushes.
- Open the Convoy Garage, equip Vanguard, and verify all four chassis change together when another skin is selected.
- Aim Heli Strafe and Airstrike; activate Repair Drone.
- Clear a sector and choose each route category at least once.
- Win First Escort and verify the next expedition unlocks and Shards persist after reload.
- Test pause and 1×/2×/3× speed.
- Test desktop mouse, mobile landscape touch, and portrait rotation guidance.
- Sign in to CrazyGames, progress on one browser/device, then confirm the same progress on another signed-in browser/device.
- In Full Launch or a Preview that permits test ads, complete a Get Shards ad and verify exactly +5 Shards.
- Fail or cancel an ad and verify that no reward is granted.
- Lose a run, complete the optional revive ad, and verify it can be used only once during that run.
- Complete a Garage skin ad and verify only the selected cosmetic skin unlocks, equips, saves, and restores after reload.
- Confirm that audio pauses when an ad starts and resumes after `adFinished` or `adError`.

CrazyGames disables ads during Basic Launch. An `adsDisabledBasicLaunch` error is expected there and must not grant a reward. Real ad delivery cannot be validated from localhost or GitHub Pages.

## Advertisement compliance

- Only the CrazyGames `rewarded` ad type is used.
- Every ad starts from an explicit `WATCH AD` or `REVIVE CONVOY` player action.
- Rewards are granted only inside `adFinished`.
- `adError`, cancellation, unfilled inventory, cooldown, or adblock grants nothing.
- A settled guard prevents duplicate or late callbacks from awarding twice.
- All game input is blocked while an ad is active.
- The current game pause state is preserved; active sounds stop and audio is suspended on `adStarted`.
- Audio and the previous pause state are restored after both `adFinished` and `adError`.
- The game remains fully playable when advertisements are unavailable or blocked.
- `hasAdblock()` is used only to show an informational message; it never blocks core gameplay.

## Saving

The production namespace is `riftConvoyProductionV1`. The synchronized snapshot stores Shards, completed expeditions, unlocked modules, selected loadout, unlocked and selected convoy skins, tutorial state, sound preference, and best score. CrazyGames Data is used when available and local storage is maintained as a fallback. Snapshots are validated before use; the newest valid cloud/device snapshot wins. Rewarded-ad progress is written immediately.

## Lifecycle and quality

- `loadingStop` is sent after artwork and the initial save restore are ready.
- `gameplayStart` is sent when an expedition begins or resumes after a route decision.
- `gameplayStop` is sent for route choices, victory, defeat, or an aborted expedition.
- The first click enters gameplay quickly and onboarding occurs inside the first expedition.
- Tutorial text is concise, visual, and skippable.
- No Escape, Ctrl/Cmd, or other browser-sensitive controls are required.
- All gameplay art and audio are bundled locally; the initial archive is well below 50 MB.
- The core differentiator is visible immediately: a moving, damageable multi-vehicle convoy with onboard module construction, direct air commands, and route choices.

