// Test de bout en bout dans Chromium (viewport mobile) : navigation, combat réel, glisser-déposer, captures.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173/';
const out = process.argv[3] ?? 'e2e-shots';
const hsDir = '/opt/pw-browsers/' + (readdirSync('/opt/pw-browsers').find((d) => d.startsWith('chromium_headless_shell')) ?? '');
const exe = process.env.CHROME_PATH ?? `${hsDir}/${readdirSync(hsDir).find((d) => d.startsWith('chrome'))}/headless_shell`;
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });
const step = async (label, fn) => { try { await fn(); console.log('✔', label); } catch (e) { errors.push(`${label}: ${e.message}`); console.log('✘', label, e.message); } };

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await shot('01-accueil');
for (const [label, nav] of [['Cartes', '02-collection'], ['Boutique', '03-boutique'], ['Super Pass', '04-pass'], ['Missions', '05-missions']]) {
  await step(`écran ${label}`, async () => { await page.click(`.nav button:has-text("${label}")`); await page.waitForTimeout(500); await shot(nav); });
}
await step('fiche carte', async () => { await page.click('.nav button:has-text("Cartes")'); await page.click('.card[data-card="titan_ossuaire"]'); await page.waitForTimeout(700); await shot('06-fiche'); });
await step('deck', async () => { await page.click('.nav button:has-text("Cartes")'); await page.click('.tabs button:has-text("Decks")'); await page.waitForTimeout(300); await shot('07-deck'); });
await step('paramètres', async () => { await page.click('.iconbtn'); await page.waitForTimeout(300); await shot('08-parametres'); });
await step('profil', async () => { await page.click('.lvl'); await page.waitForTimeout(300); await shot('09-profil'); });
await step('coffres', async () => { await page.click('.nav button:has-text("Combat")'); await page.click('button:has-text("Offrande")'); await page.waitForTimeout(300); await shot('10-coffres'); });
await step('ouverture offrande', async () => {
  await page.click('.panel button:has-text("Ouvrir")'); await page.waitForTimeout(300); await shot('11-coffre-ouverture');
  for (let i = 0; i < 6 && await page.$('.modal-bg'); i++) { await page.click('.modal'); await page.waitForTimeout(200); }
});
await step('combat', async () => {
  await page.click('.nav button:has-text("Combat")');
  await page.click('button.fight');
  await page.waitForSelector('.arena-wrap canvas');
  await page.waitForTimeout(1500);
  const canvas = await page.$('.arena-wrap canvas');
  const box = await canvas.boundingBox();
  // Glisser chaque carte jouable dans notre camp
  for (let k = 0; k < 6; k++) {
    await page.evaluate(() => { window.__battle.players[0].essence = 10; });
    const cards = await page.$$('.hand .card[data-idx]');
    const c = cards[k % cards.length];
    const b = await c.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * (k % 2 ? 0.25 : 0.75), box.y + box.height * 0.72, { steps: 8 });
    if (k === 0) await shot('12-combat-glisser');
    await page.mouse.up();
    await page.waitForTimeout(2200);
  }
  await shot('13-combat');
  const deployed = await page.evaluate(() => window.__battle.players[0].stats.cardsPlayed);
  if (deployed < 5) throw new Error(`seulement ${deployed} cartes jouées par glisser-déposer`);
  // mode toucher : sélectionner une carte puis toucher l'arène
  await page.evaluate(() => { window.__battle.players[0].essence = 10; });
  const c0 = await page.$('.hand .card[data-idx]');
  await c0.click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
  const after = await page.evaluate(() => window.__battle.players[0].stats.cardsPlayed);
  if (after !== deployed + 1) throw new Error('le déploiement au toucher a échoué');
  await page.waitForTimeout(6000);
  await shot('14-combat-mêlée');
});
await step('pause et abandon', async () => {
  await page.click('.pause-btn'); await page.waitForTimeout(300); await shot('15-pause');
  await page.click('button:has-text("Abandonner")'); await page.waitForTimeout(200);
  await page.click('.modal-bg:last-child button:has-text("Abandonner")');
  await page.waitForSelector('.result-title', { timeout: 8000 });
  await page.waitForTimeout(3500); await shot('16-resultats');
});
await step('persistance après rechargement', async () => {
  const before = await page.evaluate(() => window.__game.data.stats.battles);
  await page.reload({ waitUntil: 'networkidle' });
  const after = await page.evaluate(() => window.__game.data.stats.battles);
  if (before !== after || after < 1) throw new Error(`combats avant=${before} après=${after}`);
});
console.log(errors.length ? `ERREURS (${errors.length}):\n` + errors.join('\n') : 'Aucune erreur JavaScript.');
await browser.close();
process.exit(errors.length ? 1 : 0);
