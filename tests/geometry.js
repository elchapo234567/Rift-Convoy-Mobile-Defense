const { chromium } = require("playwright");
const assert = require("assert");

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.route("https://sdk.crazygames.com/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.addInitScript(() => {
    window.CrazyGames = { SDK: {
      init: async () => {}, game: { settings: {}, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, addSettingsChangeListener() {} },
      data: { getItem: () => null, setItem() {}, removeItem() {} },
      user: { getUser: async () => null }, ad: { hasAdblock: async () => false, requestAd() {} }
    }};
  });
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__RIFT_TEST__ && !document.querySelector("#loading"));

  await page.evaluate(() => __RIFT_TEST__.start(2));
  const verifyAlignment = async () => {
    const sample = await page.evaluate(() => ({
      geometry: __RIFT_TEST__.geometry(),
      road: __RIFT_TEST__.run.convoy.map(v => __RIFT_TEST__.roadAt(v.baseX))
    }));
    sample.geometry.forEach((g, index) => {
      assert(Math.abs(g.vehicle.y - sample.road[index].y) < 1e-6, `Vehicle ${index} left the road`);
      assert(Math.abs(g.vehicle.angle - sample.road[index].angle) < 1e-6, `Vehicle ${index} has the wrong road angle`);
      assert.strictEqual(g.hardpoint.x, g.vehicle.x, `Hardpoint ${index} detached on X`);
      assert.strictEqual(g.hardpoint.y, g.vehicle.y, `Hardpoint ${index} detached on Y`);
    });
    return sample;
  };
  const before = await verifyAlignment();
  await page.evaluate(() => __RIFT_TEST__.step(3));
  const after = await verifyAlignment();
  assert(after.geometry.some((g, i) => Math.abs(g.vehicle.y - before.geometry[i].vehicle.y) > 2), "Convoy should follow the scrolling road curve");

  await page.evaluate(() => {
    __RIFT_TEST__.run.enemies = [];
    __RIFT_TEST__.run.spawnTimer = 999;
    __RIFT_TEST__.spawn("normal");
    const v = __RIFT_TEST__.run.convoy[0];
    const e = __RIFT_TEST__.run.enemies[0];
    Object.assign(e, { x: v.x + 90, y: v.y, speed: 0, cooldown: 999, hp: 9999, maxHp: 9999 });
    __RIFT_TEST__.run.hardpoints[0].cooldown = 0;
    __RIFT_TEST__.destroy(0);
  });
  const enemyHp = await page.evaluate(() => __RIFT_TEST__.run.enemies[0].hp);
  await page.evaluate(() => __RIFT_TEST__.step(.4));
  const destroyed = await page.evaluate(() => ({
    hp: __RIFT_TEST__.run.enemies[0].hp,
    cooldown: __RIFT_TEST__.run.hardpoints[0].cooldown,
    vehicleHp: __RIFT_TEST__.run.convoy[0].hp
  }));
  assert.strictEqual(destroyed.vehicleHp, 0, "Test vehicle must be destroyed");
  assert.strictEqual(destroyed.hp, enemyHp, "Weapon on a destroyed vehicle must not fire");
  assert(destroyed.cooldown <= 0, "Destroyed vehicle hardpoint must remain ready but inactive");
  await page.screenshot({ path: "/tmp/rift-geometry-destroyed.png" });

  await page.evaluate(() => { __RIFT_TEST__.run.enemies = []; __RIFT_TEST__.checkpoint(); });
  const transition = await page.evaluate(() => {
    const roadBefore = __RIFT_TEST__.roadAt(640);
    const previous = __RIFT_TEST__.run.currentTerrain;
    __RIFT_TEST__.chooseRoute(0);
    return { roadBefore, roadAfter: __RIFT_TEST__.roadAt(640), previous, current: __RIFT_TEST__.run.currentTerrain, blend: __RIFT_TEST__.run.terrainBlend };
  });
  assert.deepStrictEqual(transition.roadAfter, transition.roadBefore, "Road geometry must remain continuous across terrain changes");
  assert.notStrictEqual(transition.current, transition.previous, "Expedition 3 should transition to a new terrain");
  assert.strictEqual(transition.blend, 0, "New terrain should begin with a smooth crossfade");
  await page.evaluate(() => __RIFT_TEST__.step(.5));
  assert((await page.evaluate(() => __RIFT_TEST__.run.terrainBlend)) > 0, "Terrain crossfade must progress");
  await page.screenshot({ path: "/tmp/rift-geometry-transition.png" });

  assert.deepStrictEqual(errors, [], `Browser errors: ${errors.join("\n")}`);
  console.log(JSON.stringify({ alignment: "PASS", destroyedVehicle: "PASS", connectedTransition: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
