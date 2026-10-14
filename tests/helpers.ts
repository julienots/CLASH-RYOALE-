import { CARDS } from '../src/core/cards';
import { Battle, type BattleConfig, type DeckEntry } from '../src/sim/battle';
import type { PlayerId } from '../src/core/types';

export const FILLER = ['charognard', 'mante_corne', 'goule_jumelle', 'meute_crocs', 'sentinelle_rouillee', 'cracheur_acide', 'arbaletrier_os', 'fusilier_rivets', 'harponneur_noye'];

/** Deck de 8 cartes dont la première est `first`. */
export function deckWith(first: string, level = 1): DeckEntry[] {
  const rest = FILLER.filter((c) => c !== first).slice(0, 7);
  return [first, ...rest].map((cardId) => ({ cardId, level }));
}

export function makeBattle(p0: string[] | DeckEntry[], p1?: string[] | DeckEntry[], extra: Partial<BattleConfig> = {}): Battle {
  const norm = (d: string[] | DeckEntry[]) => (typeof d[0] === 'string' ? (d as string[]).map((cardId) => ({ cardId, level: 1 })) : (d as DeckEntry[]));
  return new Battle({ seed: 7, decks: [norm(p0), norm(p1 ?? FILLER.slice(0, 8))], towerPower: [9, 9], noShuffle: true, ...extra });
}

export function run(b: Battle, seconds: number): void {
  const n = Math.round(seconds * 30);
  for (let i = 0; i < n && !b.result; i++) b.step();
}

export function unitsOf(b: Battle, owner: PlayerId, unitId?: string) {
  return b.entities.filter((e) => e.alive && e.owner === owner && e.kind !== 'tower' && (!unitId || e.def?.id === unitId));
}

export const ALL_CARD_IDS = CARDS.map((c) => c.id);
