/**
 * Setzt nach dem Build die Liste der erzeugten Dateien in den Service Worker
 * ein. Nur so liegt die App nach dem ersten Öffnen vollständig offline vor —
 * sonst fehlen genau die Dateien mit Prüfsumme im Namen.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assetDir = join(dist, "assets");
const assets = readdirSync(assetDir).map((f) => `./assets/${f}`);
const swPath = join(dist, "sw.js");
let sw = readFileSync(swPath, "utf8");

const buildId = createHash("sha1").update(assets.join("|")).digest("hex").slice(0, 8);
sw = sw.replace("__BUILD_ID__", buildId).replace('"__ASSETS__"', assets.map((a) => JSON.stringify(a)).join(", "));
writeFileSync(swPath, sw);
console.log(`[sw] ${assets.length} Dateien vorgeladen, Version ${buildId}`);
