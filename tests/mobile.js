const { chromium } = require("playwright");
const assert = require("assert");

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36"
  });
  const page = await context.newPage();
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
  async function tapGame(x, y) {
    const box = await page.locator("#game").boundingBox();
    await page.touchscreen.tap(box.x + x * box.width / 1280, box.y + y * box.height / 720);
  }
  await tapGame(640, 450); // Start Expedition
  assert.strictEqual(await page.evaluate(() => __RIFT_TEST__.state), "EXPEDITIONS");
  await tapGame(350, 220); // First route
  assert.strictEqual(await page.evaluate(() => __RIFT_TEST__.state), "LOADOUT");
  await tapGame(640, 678); // Deploy
  assert.strictEqual(await page.evaluate(() => __RIFT_TEST__.state), "GAME");
  for (let step = 0; step < 5; step++) await tapGame(905, 605); // Five briefing pages
  const tutorialDone = await page.evaluate(() => __RIFT_TEST__.progress.tutorialComplete);
  assert.strictEqual(tutorialDone, true, "Touch must complete onboarding");
  await tapGame(280, 661); // Cryo module
  const hardpoint = await page.evaluate(() => ({ x: __RIFT_TEST__.run.hardpoints[1].x, y: __RIFT_TEST__.run.hardpoints[1].y }));
  await tapGame(hardpoint.x, hardpoint.y); // Empty moving hardpoint
  const installed = await page.evaluate(() => __RIFT_TEST__.run.hardpoints[1].type);
  assert.strictEqual(installed, "frost", "Touch must install a convoy module");
  await tapGame(1045, 661); // Repair Drone
  await page.screenshot({ path: "/tmp/rift-touch-mobile.png" });
  assert.deepStrictEqual(errors, []);

  await page.setViewportSize({ width: 390, height: 844 });
  const rotate = await page.locator("#rotate").evaluate(el => getComputedStyle(el).display);
  assert.strictEqual(rotate, "grid");
  console.log(JSON.stringify({ tutorialDone, installed, portraitOverlay: rotate, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
