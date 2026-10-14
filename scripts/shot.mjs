// Capture d'écran d'une page via Chromium (outil de vérification visuelle).
import { chromium } from 'playwright-core';
const [url, out, w = '1280', h = '900'] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
p.on('pageerror', (e) => errors.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path: out, fullPage: true });
console.log(errors.length ? 'ERREURS: ' + errors.join('\n') : 'aucune erreur');
await b.close();
