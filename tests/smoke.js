const { chromium } = require("playwright");
const assert = require("assert");

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text());
  });
  await page.route("https://sdk.crazygames.com/**", route => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: "window.dispatchEvent(new Event('crazygames-sdk-ready'));"
  }));
  await page.addInitScript(() => {
    const cloud = new Map();
    window.__adMode = "success";
    window.__cloud = cloud;
    window.CrazyGames = { SDK: {
      init: async () => {},
      game: {
        settings: { muteAudio: false },
        loadingStop() {}, gameplayStart() {}, gameplayStop() {}, addSettingsChangeListener() {}
      },
      data: {
        getItem: key => cloud.get(key) || null,
        setItem: (key, value) => cloud.set(key, value),
        removeItem: key => cloud.delete(key)
      },
      user: { getUser: async () => ({ username: "SmokeTest" }) },
      ad: {
        hasAdblock: async () => false,
        requestAd(type, callbacks) {
          callbacks.adStarted();
          if (window.__adMode === "success") callbacks.adFinished();
          else callbacks.adError({ code: window.__adMode });
        }
      }
    }};
  });
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector("#loading"), null, { timeout: 15000 });

  const assets = await page.evaluate(() => window.__RIFT_TEST__.assets);
  assert.strictEqual(assets.declared, 21, "Expected 21 declared gameplay artworks");
  assert.strictEqual(assets.loaded, assets.declared, `Missing artwork: ${assets.missing.join(", ")}`);

  await page.screenshot({ path: "/tmp/rift-menu.png" });
  await page.evaluate(() => { window.__RIFT_TEST__.setState("ARMORY"); });
  await page.screenshot({ path: "/tmp/rift-armory.png" });
  await page.evaluate(() => window.__RIFT_TEST__.start(0));
  await page.evaluate(() => {
    window.__RIFT_TEST__.install(1, "frost");
    window.__RIFT_TEST__.install(2, "rocket");
    window.__RIFT_TEST__.install(3, "repair");
    window.__RIFT_TEST__.upgrade(0);
    for (const kind of ["normal", "fast", "armored", "phantom", "brute", "swarm"]) window.__RIFT_TEST__.spawn(kind);
    window.__RIFT_TEST__.boss();
    window.__RIFT_TEST__.step(1);
  });
  const combat = await page.evaluate(() => ({
    hardpoints: window.__RIFT_TEST__.run.hardpoints.map(h => [h.type, h.level]),
    enemies: window.__RIFT_TEST__.run.enemies.length,
    convoy: window.__RIFT_TEST__.run.convoy.map(v => v.hp),
    state: window.__RIFT_TEST__.state
  }));
  assert.deepStrictEqual(combat.hardpoints.map(h => h[0]), ["gun", "frost", "rocket", "repair"]);
  assert.strictEqual(combat.hardpoints[0][1], 2);
  assert(combat.enemies > 0, "Enemies should be active after spawn");
  assert(combat.convoy.every(Number.isFinite), "Convoy health must stay finite");
  assert.strictEqual(combat.state, "GAME");
  await page.screenshot({ path: "/tmp/rift-game.png" });

  const before = await page.evaluate(() => window.__RIFT_TEST__.progress.shards);
  await page.evaluate(() => { window.__RIFT_TEST__.setState("REWARDS"); window.__RIFT_TEST__.ad("shards"); });
  const rewarded = await page.evaluate(() => ({
    shards: window.__RIFT_TEST__.progress.shards,
    cloud: window.__cloud.get(window.__RIFT_TEST__.constants.SAVE_KEY)
  }));
  assert.strictEqual(rewarded.shards, before + 5, "Completed rewarded ad must grant exactly 5 Shards");
  assert(rewarded.cloud && JSON.parse(rewarded.cloud).shards === before + 5, "Reward must immediately reach cloud save");

  await page.evaluate(() => { window.__adMode = "adblock"; window.__RIFT_TEST__.ad("shards"); });
  const afterError = await page.evaluate(() => window.__RIFT_TEST__.progress.shards);
  assert.strictEqual(afterError, before + 5, "Failed ad must not grant a reward");

  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => window.__RIFT_TEST__.start(2));
  await page.screenshot({ path: "/tmp/rift-mobile.png" });
  const canvasBox = await page.locator("#game").boundingBox();
  assert(canvasBox.width <= 844 && canvasBox.height <= 390, "Canvas must fit mobile landscape viewport");
  await page.setViewportSize({ width: 390, height: 844 });
  const rotateDisplay = await page.locator("#rotate").evaluate(el => getComputedStyle(el).display);
  assert.strictEqual(rotateDisplay, "grid", "Portrait mobile must show rotate guidance");

  assert.deepStrictEqual(errors, [], `Browser errors: ${errors.join("\n")}`);
  console.log(JSON.stringify({ assets, combat, rewardedShards: rewarded.shards, mobile: canvasBox, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
