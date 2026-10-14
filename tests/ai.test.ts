import { CARDS } from '../src/core/cards';
import { Rng } from '../src/core/rng';
import { Bot, type Difficulty } from '../src/sim/ai';
import { Battle, STEP } from '../src/sim/battle';

function match(seed: number, d0: Difficulty, d1: Difficulty) {
  const rng = new Rng(seed);
  const pick = () => rng.shuffle(CARDS.slice()).slice(0, 8).map((c) => ({ cardId: c.id, level: 1 }));
  const deck = pick();
  const b = new Battle({ seed, decks: [deck, deck.map((d) => ({ ...d }))], towerPower: [9, 9] });
  const bots = [new Bot(b, 0, d0, seed), new Bot(b, 1, d1, seed + 1)];
  let n = 0;
  while (!b.result && n < 30 * 260) { bots[0].update(STEP); bots[1].update(STEP); b.step(); n++; }
  return b;
}

describe('IA adverse', () => {
  it('termine les parties et joue des cartes à tous les niveaux', () => {
    for (const d of ['initie', 'chasseur', 'cauchemar', 'abyssal'] as Difficulty[]) {
      const b = match(3, d, d);
      expect(b.result, d).not.toBeNull();
      expect(b.players[0].stats.cardsPlayed, d).toBeGreaterThan(5);
      expect(b.players[1].stats.cardsPlayed, d).toBeGreaterThan(5);
    }
  });

  it('défend : réagit à une unité qui menace sa tour', () => {
    const deck = ['charognard', 'mante_corne', 'goule_jumelle', 'meute_crocs', 'sentinelle_rouillee', 'cracheur_acide', 'arbaletrier_os', 'fusilier_rivets'].map((cardId) => ({ cardId, level: 1 }));
    const b = new Battle({ seed: 1, decks: [deck, deck], towerPower: [9, 9], noShuffle: true });
    const bot = new Bot(b, 1, 'cauchemar', 5);
    b.players[1].essence = 10;
    b.spawnUnit(0, 'golem_rivets', 3.5, 14, 9, null, 0);
    for (let i = 0; i < 30 * 4; i++) { bot.update(STEP); b.step(); }
    expect(b.players[1].stats.cardsPlayed).toBeGreaterThan(0);
  });

  it('un bot difficile bat un bot débutant plus souvent', () => {
    let hard = 0, easy = 0;
    for (let s = 0; s < 8; s++) {
      const r = match(100 + s, 'abyssal', 'initie').result!;
      if (r.winner === 0) hard++; else if (r.winner === 1) easy++;
    }
    expect(hard).toBeGreaterThan(easy);
  });
});
