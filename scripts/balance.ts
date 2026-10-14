// Simulation d'équilibrage : parties bot contre bot avec decks aléatoires cohérents,
// taux de victoire par carte (présence dans le deck gagnant). Usage : npm run balance -- [parties]
import { CARDS, CARD_MAP } from '../src/core/cards';
import { Rng } from '../src/core/rng';
import { Bot } from '../src/sim/ai';
import { Battle, STEP } from '../src/sim/battle';
import { generateBotDeck, levelForPower } from '../src/meta/match';

const N = Number(process.argv[2] ?? 300);
const stats: Record<string, { games: number; wins: number; played: number }> = {};
for (const c of CARDS) stats[c.id] = { games: 0, wins: 0, played: 0 };
let draws = 0, kings = 0, totalTime = 0, crowns = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const rng = new Rng(1000 + g);
  const decks = [generateBotDeck(rng), generateBotDeck(rng)];
  const b = new Battle({ seed: g, decks: decks.map((d) => d.map((cardId) => ({ cardId, level: levelForPower(CARD_MAP[cardId], 9) }))) as never, towerPower: [9, 9] });
  const bots = [new Bot(b, 0, 'cauchemar', g), new Bot(b, 1, 'cauchemar', g + 7)];
  while (!b.result) { bots[0].update(STEP); bots[1].update(STEP); b.step(); }
  const r = b.result;
  totalTime += r.time; crowns += r.crowns[0] + r.crowns[1];
  if (r.reason === 'king') kings++;
  if (r.winner === null) { draws++; continue; }
  decks.forEach((d, i) => d.forEach((id) => {
    stats[id].games++;
    if (r.winner === i) stats[id].wins++;
    stats[id].played += b.players[i].stats.played[id] ?? 0;
  }));
}
const rows = CARDS.map((c) => ({ id: c.id, rarity: c.rarity, cost: c.cost, games: stats[c.id].games, wr: stats[c.id].games ? stats[c.id].wins / stats[c.id].games : NaN }))
  .sort((a, b) => b.wr - a.wr);
console.log(`${N} parties en ${((Date.now() - t0) / 1000).toFixed(1)} s · égalités ${draws} · victoires au roi ${kings} · durée moyenne ${(totalTime / N).toFixed(0)} s · couronnes/partie ${(crowns / N).toFixed(2)}`);
console.log('carte'.padEnd(26), 'rareté'.padEnd(11), 'coût', 'parties', 'victoire');
for (const r of rows) {
  const flag = r.games >= 15 && (r.wr > 0.62 ? '  ▲ trop fort ?' : r.wr < 0.38 ? '  ▼ trop faible ?' : '');
  console.log(r.id.padEnd(26), r.rarity.padEnd(11), String(r.cost).padStart(4), String(r.games).padStart(7), `${(r.wr * 100).toFixed(0).padStart(6)} %${flag || ''}`);
}
