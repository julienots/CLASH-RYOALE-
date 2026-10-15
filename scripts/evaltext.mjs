// Outil de debug : affiche le texte d'une page après exécution.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';
const hsDir = '/opt/pw-browsers/' + readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium_headless_shell'));
const exe = `${hsDir}/${readdirSync(hsDir).find((d) => d.startsWith('chrome'))}/headless_shell`;
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('ERR', e));
await p.goto(process.argv[2], { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
console.log(await p.evaluate(() => document.body.innerText));
await b.close();
