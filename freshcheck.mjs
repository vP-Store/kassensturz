import { chromium } from "playwright";
const base = "http://127.0.0.1:4173/kassensturz/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2, locale: "de-DE" });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(String(e)));
await p.goto(base); await p.waitForTimeout(1200);
const db = await p.evaluate(() => JSON.parse(localStorage.getItem("kassensturz.db.v2")));
await p.screenshot({ path: "/tmp/shots/fresh-hell.png", fullPage: true });
console.log(JSON.stringify({
  errs,
  konten: db.accounts.map(a => `${a.name}: ${a.openingBalance}`),
  positionen: db.recurrings.length,
  einkommenTag: db.settings.incomeDay,
}, null, 2));
await b.close();
