const { chromium } = require("playwright");
const assert = require("assert");

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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

  async function clickCanvas(x, y) { await page.mouse.click(x, y); }
  async function runMission(expedition, loadout) {
    await page.evaluate(({ expedition, loadout }) => window.__RIFT_TEST__.start(expedition, loadout), { expedition, loadout });
    // Buy a repair system immediately, then the cheapest available weapon.
    await clickCanvas(636, 661); await clickCanvas(681, 305);
    await clickCanvas(280, 661); await clickCanvas(437, 303);
    let simulated = 0, abilityClock = 0;
    while (simulated < 720) {
      let info = await page.evaluate(() => {
        const api = window.__RIFT_TEST__, run = api.run;
        return { state: api.state, loadout: api.loadout, scrap: run.scrap, abilities: { ...run.abilities }, hardpoints: run.hardpoints.map(h => ({ type: h.type, level: h.level, x: h.x, y: h.y })), choices: run.choice.map(c => c.id), enemies: run.enemies.length, enemyState: run.enemies.map(e => ({ kind: e.kind, boss: e.boss, hp: e.hp, damage: e.damage, x: e.x, y: e.y })), convoy: run.convoy.map(v => v.hp) };
      });
      if (info.state === "VICTORY" || info.state === "DEFEAT") return { ...info, simulated };
      if (info.state === "ROUTE") {
        const preferred = info.choices.indexOf("safe");
        await page.evaluate(index => window.__RIFT_TEST__.chooseRoute(index < 0 ? 0 : index), preferred);
        continue;
      }
      const empty = info.hardpoints.findIndex(h => !h.type);
      if (empty >= 0) {
        const options = loadout.map((id, index) => ({ id, index, cost: ({ gun: 70, frost: 100, rocket: 135, repair: 120, laser: 155, tesla: 175 })[id] }));
        const choice = options.filter(option => option.id !== "repair" && option.id !== "gun").sort((a, b) => b.cost - a.cost)[0] || options.find(option => option.id === "gun");
        if (choice && choice.cost <= info.scrap) { await clickCanvas(18 + choice.index * 178 + 84, 661); await clickCanvas(info.hardpoints[empty].x, info.hardpoints[empty].y); }
      } else {
        const upgrade = info.hardpoints.filter(h => h.level < 4).sort((a, b) => a.level - b.level)[0];
        if (upgrade && info.scrap >= 130) { await clickCanvas(upgrade.x, upgrade.y); await clickCanvas(600, 560); }
      }
      if (abilityClock <= 0) {
        if (info.abilities.repair <= 0) await page.keyboard.press("r");
        if (info.abilities.airstrike <= 0 && info.enemies) { const target = info.enemyState.find(enemy => enemy.boss) || info.enemyState.slice().sort((a, b) => a.x - b.x)[0]; await page.keyboard.press("a"); await clickCanvas(target.x, target.y); }
        if (info.abilities.strafe <= 0 && info.enemies) { const target = info.enemyState.slice().sort((a, b) => a.x - b.x)[0]; await page.keyboard.press("h"); await clickCanvas(target.x, target.y); }
        abilityClock = 5;
      }
      await page.evaluate(() => window.__RIFT_TEST__.step(.5));
      simulated += .5; abilityClock -= .5;
    }
    return { state: "TIMEOUT", simulated };
  }

  const first = await runMission(0, ["gun", "frost", "rocket", "repair"]);
  assert.strictEqual(first.state, "VICTORY", `Starter expedition must be beatable without test boosts: ${JSON.stringify(first)}`);
  const advanced = await runMission(4, ["gun", "laser", "tesla", "repair"]);
  assert.strictEqual(advanced.state, "VICTORY", `Advanced expedition must be beatable with unlocked modules: ${JSON.stringify(advanced)}`);
  const finalRoute = await runMission(7, ["rocket", "laser", "tesla", "repair"]);
  assert.strictEqual(finalRoute.state, "VICTORY", `Final expedition must be beatable with a complete armory: ${JSON.stringify(finalRoute)}`);
  console.log(JSON.stringify({ starter: first, advanced, finalRoute, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
