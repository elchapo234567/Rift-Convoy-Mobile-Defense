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
    const cloud = new Map();
    window.CrazyGames = { SDK: {
      init: async () => {}, game: { settings: {}, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, addSettingsChangeListener() {} },
      data: { getItem: key => cloud.get(key) || null, setItem: (key, value) => cloud.set(key, value), removeItem: key => cloud.delete(key) },
      user: { getUser: async () => null }, ad: { hasAdblock: async () => false, requestAd() {} }
    }};
  });
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector("#loading"));

  const results = [];
  for (let expedition = 0; expedition < 8; expedition++) {
    const result = await page.evaluate(expedition => {
      const api = window.__RIFT_TEST__;
      api.start(expedition);
      const run = api.run;
      const moduleIds = ["gun", "laser", "tesla", "repair"];
      run.hardpoints.forEach((hardpoint, index) => Object.assign(hardpoint, {
        type: moduleIds[index], level: 4, spent: 999, cooldown: 0, disabled: 0
      }));
      run.convoy.forEach(vehicle => { vehicle.maxHp = 1e9; vehicle.hp = 1e9; });
      const moduleFire = {};
      for (const id of ["gun", "frost", "rocket", "repair", "laser", "tesla"]) {
        run.hardpoints[0].type = id;
        run.hardpoints[0].level = 4;
        run.hardpoints[0].cooldown = 0;
        run.spawnTimer = 999;
        if (id !== "repair") {
          api.spawn("normal");
          const target = run.enemies[run.enemies.length - 1];
          target.x = run.hardpoints[0].x + 120;
          target.y = run.hardpoints[0].y;
        }
        else run.convoy[0].hp -= 200;
        const beforeEnemies = run.enemies.length;
        const beforeEnemyHp = beforeEnemies ? run.enemies[run.enemies.length - 1].hp : 0;
        const beforeHp = run.convoy[0].hp;
        api.step(1);
        moduleFire[id] = id === "repair" ? run.convoy[0].hp > beforeHp : run.enemies.length < beforeEnemies || run.enemies.some(enemy => enemy.hp < beforeEnemyHp);
        run.enemies = [];
      }
      run.hardpoints.forEach((hardpoint, index) => Object.assign(hardpoint, { type: moduleIds[index], level: 4, cooldown: 0 }));
      for (let sector = 0; sector < run.totalSectors; sector++) {
        if (sector === run.totalSectors - 1) {
          api.boss();
          const boss = run.enemies.find(enemy => enemy.boss);
          boss.special = 0;
          api.step(.1);
          const bossFinite = [boss.hp, boss.x, boss.y, boss.speed, boss.damage].every(Number.isFinite);
          if (!bossFinite) throw new Error(`Non-finite boss state in expedition ${expedition}`);
          run.enemies = [];
          run.bossSpawned = true;
          run.sectorTime = run.sectorDuration;
          api.step(.1);
        } else {
          run.enemies = [];
          run.sectorTime = run.sectorDuration;
          api.step(.1);
          if (api.state !== "ROUTE") throw new Error(`Missing route choice in expedition ${expedition}, sector ${sector}`);
          if (run.choice.length !== 3) throw new Error(`Expected three routes in expedition ${expedition}`);
          api.chooseRoute(0);
          run.convoy.forEach(vehicle => { vehicle.maxHp = 1e9; vehicle.hp = 1e9; });
        }
      }
      return {
        expedition,
        state: api.state,
        reward: run.finalReward,
        score: run.score,
        sectors: run.totalSectors,
        moduleFire
      };
    }, expedition);
    assert.strictEqual(result.state, "VICTORY", `Expedition ${expedition + 1} must reach victory`);
    assert(result.reward > 0 && Number.isFinite(result.score));
    assert(Object.values(result.moduleFire).every(Boolean), `A module failed to operate in expedition ${expedition + 1}: ${JSON.stringify(result.moduleFire)}`);
    results.push(result);
  }
  assert.deepStrictEqual(errors, [], `Browser errors: ${errors.join("\n")}`);
  console.log(JSON.stringify({ expeditions: results, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
