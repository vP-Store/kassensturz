import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const seed = JSON.parse(readFileSync("/tmp/kassensturz-startdaten.json", "utf8"));
const base = "http://127.0.0.1:4173/kassensturz/";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2, locale: "de-DE" });
const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push(String(e)));
await p.goto(base);
await p.evaluate((s) => localStorage.setItem("kassensturz.db.v2", JSON.stringify(s)), seed);
for (const [t, n] of [["light","hell"],["dark","dunkel"]]) {
  await p.evaluate((x) => localStorage.setItem("kassensturz.theme", x), t);
  await p.goto(base); await p.waitForTimeout(1000);
  await p.screenshot({ path: `/tmp/shots/scott-${n}.png`, fullPage: true });
}
await p.goto(base + "#/fixkosten"); await p.waitForTimeout(800);
await p.screenshot({ path: "/tmp/shots/scott-fixkosten.png", fullPage: true });
const state = await p.evaluate(() => JSON.parse(localStorage.getItem("kassensturz.db.v2")));
console.log(JSON.stringify({ errs, recurrings: state.recurrings.length, gebucht: state.transactions.length }, null, 2));
await b.close();
