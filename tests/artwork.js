const { chromium } = require("playwright");
const assert = require("assert");
const fs = require("fs");

(async () => {
  const base = process.env.RIFT_TEST_URL || "http://127.0.0.1:4200/";
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route("https://sdk.crazygames.com/**", route => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
  await page.addInitScript(() => {
    window.CrazyGames = { SDK: {
      init: async () => {}, game: { settings: {}, loadingStop() {}, gameplayStart() {}, gameplayStop() {}, addSettingsChangeListener() {} },
      data: { getItem: () => null, setItem() {}, removeItem() {} }, user: { getUser: async () => null },
      ad: { hasAdblock: async () => false, requestAd() {} }
    }};
  });
  await page.goto(`${base}?test=1`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__RIFT_TEST__ && !document.querySelector("#loading"));

  const paths = {
    vehicles: "assets/convoy/vehicles-top.webp",
    frostbiteSkin: "assets/skins/frostbite.webp",
    emberstrikeSkin: "assets/skins/emberstrike.webp",
    riftPhantomSkin: "assets/skins/rift-phantom.webp",
    gun: "assets/modules/gun-upgrades.webp",
    frost: "assets/modules/frost-upgrades.webp",
    rocket: "assets/modules/rocket-upgrades.webp",
    laser: "assets/modules/laser-upgrades.webp",
    tesla: "assets/modules/tesla-upgrades.webp",
    repair: "assets/modules/repair-upgrades.webp"
  };
  const metrics = await page.evaluate(async paths => {
    const result = {};
    for (const [name, path] of Object.entries(paths)) {
      const image = new Image();
      image.src = path;
      await image.decode();
      const cw = image.width / 2, ch = image.height / 2, cells = [];
      for (let i = 0; i < 4; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = 96; canvas.height = 72;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(image, (i % 2) * cw, Math.floor(i / 2) * ch, cw, ch, 0, 0, 96, 72);
        const data = ctx.getImageData(0, 0, 96, 72).data;
        let opaque = 0, hash = 2166136261;
        for (let p = 0; p < data.length; p += 4) {
          if (data[p + 3] > 20) opaque++;
          hash ^= data[p] + data[p + 1] * 3 + data[p + 2] * 7 + data[p + 3] * 11;
          hash = Math.imul(hash, 16777619);
        }
        cells.push({ opaque, hash: hash >>> 0 });
      }
      result[name] = cells;
    }
    return result;
  }, paths);

  for (const [name, cells] of Object.entries(metrics)) {
    assert(cells.every(cell => cell.opaque > 250), `${name} contains an empty sprite cell`);
    assert.strictEqual(new Set(cells.map(cell => cell.hash)).size, 4, `${name} must have four distinct designs`);
  }
  const source = fs.readFileSync("index.html", "utf8");
  assert(source.includes("ctx.rotate(clamp(Math.sin(heading)*.11,-.11,.11))"), "Enemy artwork rotation must stay within an upright-safe range");

  console.log(JSON.stringify({ generatedSheets: Object.keys(metrics).length, distinctCells: Object.keys(metrics).length * 4, enemiesUpright: true, result: "PASS" }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
