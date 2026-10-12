const { chromium } = require("playwright");

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
      user: { getUser: async () => ({ username: "VisualAudit" }) }, ad: { hasAdblock: async () => false, requestAd() {} }
    }};
  });
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.querySelector("#loading"));
  const shots = [];
  async function snap(name, action) {
    if (action) await page.evaluate(action);
    await page.waitForTimeout(80);
    const path = `/tmp/rift-ui-${name}.png`;
    await page.screenshot({ path });
    shots.push(path);
  }
  await snap("01-menu", () => { __RIFT_TEST__.unlockAll(); __RIFT_TEST__.setState("MENU"); });
  await snap("02-expeditions-1", () => { __RIFT_TEST__.setState("EXPEDITIONS"); });
  await page.mouse.click(780, 686);
  await snap("03-expeditions-2");
  await snap("04-loadout", () => { __RIFT_TEST__.setExpedition(7); __RIFT_TEST__.setState("LOADOUT"); });
  await snap("05-armory", () => { __RIFT_TEST__.setState("ARMORY"); });
  await snap("06-rewards", () => { __RIFT_TEST__.setState("REWARDS"); });
  await snap("07-game", () => { __RIFT_TEST__.start(7, ["rocket", "laser", "tesla", "repair"]); __RIFT_TEST__.boost(); for (const kind of ["normal", "fast", "armored", "phantom", "brute", "swarm"]) __RIFT_TEST__.spawn(kind); __RIFT_TEST__.boss(); __RIFT_TEST__.step(.2); });
  await snap("08-route", () => { __RIFT_TEST__.run.enemies = []; __RIFT_TEST__.checkpoint(); });
  await snap("09-tutorial-1", () => { __RIFT_TEST__.start(0); __RIFT_TEST__.setTutorial(0); });
  await snap("10-tutorial-2", () => __RIFT_TEST__.setTutorial(1));
  await snap("11-tutorial-3", () => __RIFT_TEST__.setTutorial(2));
  await snap("12-tutorial-4", () => __RIFT_TEST__.setTutorial(3));
  await snap("13-tutorial-5", () => __RIFT_TEST__.setTutorial(4));
  await snap("14-victory", () => { __RIFT_TEST__.setTutorial(-1); __RIFT_TEST__.win(); });
  await snap("15-defeat", () => { __RIFT_TEST__.start(0); __RIFT_TEST__.lose(); });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(shots.join("\n"));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
