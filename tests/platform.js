const { chromium } = require("playwright");
const assert = require("assert");

const launch = () => chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
const sdkInit = seed => ({ seed: seed || null });

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const browser = await launch();
  async function makePage(seed = null) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.route("https://sdk.crazygames.com/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
    await page.addInitScript(({ seed }) => {
      const cloud = new Map();
      if (seed) cloud.set("riftConvoyProductionV1", seed);
      window.__cloud = cloud;
      window.__adMode = "success";
      window.CrazyGames = { SDK: {
        init: async () => {}, game: { settings: { muteAudio: false }, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, addSettingsChangeListener() {} },
        data: { getItem: key => cloud.get(key) || null, setItem: (key, value) => cloud.set(key, value), removeItem: key => cloud.delete(key) },
        user: { getUser: async () => ({ username: "CloudTester" }) },
        ad: {
          hasAdblock: async () => false,
          requestAd(type, callbacks) {
            callbacks.adStarted();
            if (window.__adMode === "duplicate") { callbacks.adFinished(); callbacks.adFinished(); callbacks.adError({ code: "other" }); }
            else if (window.__adMode === "success") callbacks.adFinished();
            else callbacks.adError({ code: window.__adMode });
          }
        }
      }};
    }, sdkInit(seed));
    await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !document.querySelector("#loading"));
    return page;
  }

  const first = await makePage();
  const cleanStart = await first.evaluate(() => window.__RIFT_TEST__.progress);
  assert.strictEqual(cleanStart.shards, 0, "New players must begin with 0 Shards");
  assert.deepStrictEqual(cleanStart.completed, [], "New players must begin with no completed expeditions");
  assert.deepStrictEqual(cleanStart.unlocked, ["gun", "frost", "rocket", "repair"], "Only starter modules may be unlocked initially");
  await first.evaluate(() => {
    const api = window.__RIFT_TEST__;
    api.setShards(9);
    api.save();
    api.setState("REWARDS");
    window.__adMode = "duplicate";
    api.ad("shards");
  });
  const firstResult = await first.evaluate(() => ({
    progress: window.__RIFT_TEST__.progress,
    cloud: window.__cloud.get(window.__RIFT_TEST__.constants.SAVE_KEY)
  }));
  assert.strictEqual(firstResult.progress.shards, 14, "Duplicate callbacks must award only once");
  assert.strictEqual(JSON.parse(firstResult.cloud).shards, 14, "Cloud must receive the rewarded value immediately");

  const second = await makePage(firstResult.cloud);
  const restored = await second.evaluate(() => window.__RIFT_TEST__.progress);
  assert.strictEqual(restored.shards, 14, "A second device must restore the cloud save");
  assert.strictEqual(restored.version, 2);
  await second.evaluate(() => {
    window.__RIFT_TEST__.setState("REWARDS");
    window.__adMode = "adCooldown";
    window.__RIFT_TEST__.ad("shards");
  });
  const afterError = await second.evaluate(() => window.__RIFT_TEST__.progress.shards);
  assert.strictEqual(afterError, 14, "Ad errors must not grant rewards");

  await second.evaluate(() => {
    const api = window.__RIFT_TEST__;
    api.start(0);
    api.run.convoy.forEach(vehicle => vehicle.hp = 0);
    api.step(.1);
  });
  assert.strictEqual(await second.evaluate(() => window.__RIFT_TEST__.state), "DEFEAT");
  await second.evaluate(() => { window.__adMode = "success"; window.__RIFT_TEST__.ad("revive"); });
  const revive = await second.evaluate(() => ({
    state: window.__RIFT_TEST__.state,
    health: window.__RIFT_TEST__.run.convoy.map(vehicle => vehicle.hp),
    shards: window.__RIFT_TEST__.progress.shards
  }));
  assert.strictEqual(revive.state, "GAME");
  assert(revive.health.every(value => value > 0), "Revive must restore every convoy vehicle");
  assert.strictEqual(revive.shards, 14, "Revive must not alter Shards");

  console.log(JSON.stringify({ cleanStart, duplicateReward: firstResult.progress.shards, restored: restored.shards, revive, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
