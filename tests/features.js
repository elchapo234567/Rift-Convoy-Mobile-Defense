const { chromium } = require("playwright");
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const sounds = ["gun", "frost", "rocket", "laser", "tesla", "repair"].map(id => `assets/audio/weapon-${id}.ogg`);
  const hashes = sounds.map(path => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex"));
  assert.strictEqual(new Set(hashes).size, sounds.length, "Every weapon must use a unique audio file");
  assert(sounds.every(path => fs.statSync(path).size > 3000), "Weapon sounds must contain real audio data");

  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.route("https://sdk.crazygames.com/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.addInitScript(() => {
    const cloud = new Map();
    window.__cloud = cloud;
    window.__adMode = "success";
    window.CrazyGames = { SDK: {
      init: async () => {},
      game: { settings: { muteAudio: false }, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, addSettingsChangeListener() {} },
      data: { getItem: key => cloud.get(key) || null, setItem: (key, value) => cloud.set(key, value), removeItem: key => cloud.delete(key) },
      user: { getUser: async () => ({ username: "FeatureTester" }) },
      ad: {
        hasAdblock: async () => false,
        requestAd(type, callbacks) {
          window.__lastAdType = type;
          callbacks.adStarted();
          if (window.__adMode === "success") callbacks.adFinished();
          else callbacks.adError({ code: window.__adMode });
        }
      }
    }};
  });
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__RIFT_TEST__ && !document.querySelector("#loading"));

  assert.deepStrictEqual(await page.evaluate(() => __RIFT_TEST__.skins), { selected: "standard", unlocked: ["standard"] });
  await page.evaluate(() => { __RIFT_TEST__.setState("SKINS"); __RIFT_TEST__.ad("skin:frostbite"); });
  const unlocked = await page.evaluate(() => ({ skins: __RIFT_TEST__.skins, cloud: JSON.parse(__cloud.get(__RIFT_TEST__.constants.SAVE_KEY)) }));
  assert(unlocked.skins.unlocked.includes("frostbite"), "Completed rewarded ad must unlock the chosen skin");
  assert.strictEqual(unlocked.skins.selected, "frostbite", "New skin should equip immediately");
  assert(unlocked.cloud.unlockedSkins.includes("frostbite"), "Skin unlock must be saved to CrazyGames Cloud");
  assert.strictEqual(await page.evaluate(() => window.__lastAdType), "rewarded", "Skin unlock must use a rewarded ad");
  await page.evaluate(() => { window.__adMode = "adblock"; __RIFT_TEST__.ad("skin:emberstrike"); });
  assert(!await page.evaluate(() => __RIFT_TEST__.skins.unlocked.includes("emberstrike")), "Failed skin ad must not grant a cosmetic reward");
  await page.screenshot({ path: "/tmp/rift-garage.png" });

  await page.evaluate(() => { __RIFT_TEST__.start(7); for (const side of ["left", "right", "top", "bottom"]) __RIFT_TEST__.spawn("normal", side); });
  const directional = await page.evaluate(() => __RIFT_TEST__.run.enemies.slice(-4).map(e => ({ side: e.spawnSide, x: e.x, y: e.y, angle: e.angle })));
  assert(directional.every(e => Number.isFinite(e.angle)), "Every directional attacker needs a valid heading");
  assert(directional.find(e => e.side === "left").x < 0, "Left ambush must start beyond the left edge");
  assert(directional.find(e => e.side === "right").x > 1280, "Right ambush must start beyond the right edge");
  assert(directional.find(e => e.side === "top").y < 82, "Top ambush must start beyond the battlefield");
  assert(directional.find(e => e.side === "bottom").y > 604, "Bottom ambush must start beyond the battlefield");
  await page.evaluate(() => __RIFT_TEST__.ambush());
  const ambush = await page.evaluate(() => ({ sides: __RIFT_TEST__.run.ambushSides, text: __RIFT_TEST__.run.ambushText, count: __RIFT_TEST__.run.enemies.length }));
  assert.strictEqual(ambush.sides.length, 3, "Nightmare ambush must attack from three directions");
  assert(ambush.count >= 7, "Ambush must add a meaningful attack group");
  await page.screenshot({ path: "/tmp/rift-ambush.png" });

  assert.deepStrictEqual(errors, [], `Browser errors: ${errors.join("\n")}`);
  console.log(JSON.stringify({ uniqueWeaponSounds: hashes.length, skinUnlocked: unlocked.skins.selected, ambush, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
