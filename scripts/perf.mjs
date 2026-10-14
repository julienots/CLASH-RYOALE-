// Mesure de fluidité du combat dans Chromium headless (serveur dev requis). Usage : node scripts/perf.mjs [dpr]
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const hsDir = '/opt/pw-browsers/' + readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium_headless_shell'));
const exe = `${hsDir}/${readdirSync(hsDir).find((d) => d.startsWith('chrome'))}/headless_shell`;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.argv[2] ?? 2), hasTouch: true, isMobile: true });
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { window.__game.data.tutorialDone = true; window.__app.go('battle', { mode: 'entrainement', difficulty: 'initie' }); });
await page.waitForTimeout(1000);
const measure = () => page.evaluate(async () => { let f = 0; const t0 = performance.now(); await new Promise((r) => { const s = () => { f++; if (performance.now() - t0 < 2000) requestAnimationFrame(s); else r(); }; requestAnimationFrame(s); }); return (f / ((performance.now() - t0) / 1000)).toFixed(1); });
console.log('vide', await measure());
await page.evaluate(() => { const b = window.__battle; const ids = ['charognard', 'larve', 'oeil_aile', 'mouche_os', 'crabe_siege', 'arbaletrier_os']; for (let i = 0; i < 30; i++) { b.spawnUnit(0, ids[i % 6], 2 + (i % 14), 20 + (i % 5), 9, null, 0); b.spawnUnit(1, ids[(i + 3) % 6], 2 + (i % 14), 12 - (i % 5), 9, null, 0); } });
console.log('60 unités', await measure());
await page.waitForTimeout(4000);
console.log('60 unités après 4 s de mêlée', await measure(), await page.evaluate(() => `entités=${window.__battle.entities.length} projectiles=${window.__battle.projectiles.length} zones=${window.__battle.zones.length}`));
await browser.close();
