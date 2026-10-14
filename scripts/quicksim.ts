import { CARDS } from '../src/core/cards';
import { Battle, STEP } from '../src/sim/battle';
import { Bot } from '../src/sim/ai';
import { Rng } from '../src/core/rng';
const rng = new Rng(42);
let w = [0, 0, 0];
for (let g = 0; g < 10; g++) {
  const pick = () => rng.shuffle(CARDS.slice()).slice(0, 8).map((c) => ({ cardId: c.id, level: 1 }));
  const b = new Battle({ seed: g + 1, decks: [pick(), pick()], towerPower: [9, 9] });
  const bots = [new Bot(b, 0, 'cauchemar', g), new Bot(b, 1, 'chasseur', g + 100)];
  let n = 0;
  while (!b.result && n < 30 * 400) { bots[0].update(STEP); bots[1].update(STEP); b.step(); n++; }
  const r = b.result!;
  w[r.winner ?? 2]++;
  console.log(g, r.reason, r.crowns, r.time.toFixed(1), b.players.map((p) => p.stats.cardsPlayed), 'ents', b.entities.length);
}
console.log(w);
