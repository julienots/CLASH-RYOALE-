// Préparation des combats (decks du bot, niveaux) et application des résultats.
import { CARDS, CARD_MAP, getUnit } from '../core/cards';
import { powerLevel, RARITY_INFO, towerPowerForAccount } from '../core/progression';
import { hashString, Rng } from '../core/rng';
import type { CardDef } from '../core/types';
import { DIFFICULTIES, type Difficulty } from '../sim/ai';
import type { BattleConfig, BattleResult, DeckEntry, PlayerState } from '../sim/battle';
import { arenaFor, CHEST_CYCLE } from './catalog';
import { addChestToSlot, addXp, type LevelUp } from './economy';
import { EVENTS, recordEventResult } from './events';
import { type BattleSummary, recordMissionProgress } from './missions';
import type { ChestType, SaveData } from './state';

export type MatchMode = 'classe' | 'entrainement' | 'evenement';
export const DIFFICULTY_ORDER: Difficulty[] = ['initie', 'chasseur', 'cauchemar', 'abyssal'];

export interface MatchSetup {
  battleId: string;
  mode: MatchMode;
  difficulty: Difficulty;
  eventId?: string;
  config: BattleConfig;
  botName: string;
  arenaId: string;
}

const BOT_NAMES = ['Le Vicaire Pâle', 'Mère Cendre', 'Le Cousu', 'Sœur Vermine', 'Le Gardien Noyé', 'Maître Rouille', 'L’Enfant-Ruche', 'Le Collecteur', 'Dame Vertèbre', 'Le Sans-Visage'];

/** Deck de bot cohérent : condition de victoire, défense aérienne, sorts, soutien. */
export function generateBotDeck(rng: Rng): string[] {
  const pool = CARDS.slice();
  const pick = (f: (c: CardDef) => boolean, n: number, deck: string[]) => {
    const cands = rng.shuffle(pool.filter((c) => f(c) && !deck.includes(c.id)));
    deck.push(...cands.slice(0, n).map((c) => c.id));
  };
  const deck: string[] = [];
  const unitOf = (c: CardDef) => (c.spawns ? getUnit(c.spawns[0].unit) : null);
  pick((c) => c.kind === 'unit' && (unitOf(c)!.targets === 'buildings' || unitOf(c)!.hp >= 2000), 1, deck); // condition de victoire
  pick((c) => c.kind === 'unit' && (unitOf(c)!.targets === 'both') && c.cost <= 4, 2, deck); // anti-aérien
  pick((c) => c.kind === 'spell' && c.spell!.affects !== 'allies' && c.cost <= 3, 1, deck);
  pick((c) => c.kind === 'spell' && c.spell!.affects !== 'allies' && c.cost >= 3, 1, deck);
  pick((c) => c.kind === 'unit' && c.cost <= 2, 1, deck); // cycle
  pick((c) => c.kind !== 'spell', 8 - deck.length, deck);
  return deck.slice(0, 8);
}

/** Niveau de carte donnant une puissance cible (borné par la rareté). */
export function levelForPower(card: CardDef, power: number): number {
  const info = RARITY_INFO[card.rarity];
  return Math.max(1, Math.min(info.maxLevel, Math.round(power) - info.startPower + 1));
}

export function playerDeckEntries(s: SaveData, ids?: string[]): DeckEntry[] {
  return (ids ?? s.decks[s.activeDeck]).map((cardId) => ({ cardId, level: s.collection[cardId]?.level ?? 1 }));
}

export function averagePower(entries: DeckEntry[]): number {
  return entries.reduce((sum, e) => sum + powerLevel(CARD_MAP[e.cardId].rarity, e.level), 0) / entries.length;
}

export function setupMatch(s: SaveData, mode: MatchMode, now: number, opts: { difficulty?: Difficulty; eventId?: string } = {}): MatchSetup {
  const seed = hashString(`${now}:${s.stats.battles}:${s.createdAt}`);
  const rng = new Rng(seed);
  const arena = arenaFor(s.profile.trophies);
  const ev = opts.eventId ? EVENTS.find((e) => e.id === opts.eventId) : undefined;
  const difficulty = ev?.difficulty ?? opts.difficulty ?? arena.difficulty;
  const playerDeck = playerDeckEntries(s, ev?.playerDeck);
  if (ev?.playerDeck) for (const d of playerDeck) d.level = levelForPower(CARD_MAP[d.cardId], 7); // défi miroir : niveaux égalisés
  const avg = averagePower(playerDeck);
  const offset = DIFFICULTIES[difficulty].levelOffset + (mode === 'classe' ? arena.botLevelBonus : 0);
  const botIds = ev?.botDeck ?? generateBotDeck(rng);
  const botPower = ev?.playerDeck ? 7 : Math.max(1, avg + offset);
  const botDeck = botIds.map((cardId) => ({ cardId, level: levelForPower(CARD_MAP[cardId], botPower) }));
  const tp = towerPowerForAccount(s.profile.level);
  return {
    battleId: `b-${now}-${seed}`,
    mode, difficulty, eventId: ev?.id,
    botName: rng.pick(BOT_NAMES),
    arenaId: arena.id,
    config: {
      seed,
      decks: [playerDeck, botDeck],
      towerPower: ev?.playerDeck ? [7, 7] : [tp, Math.max(1, Math.min(14, tp + Math.round(offset / 2)))],
      ...(ev?.config ?? {}),
    },
  };
}

export interface MatchRewards {
  outcome: 'victoire' | 'defaite' | 'egalite';
  gold: number; xp: number; trophies: number; passXp: number; crowns: number;
  chest: ChestType | null; chestSlotsFull: boolean;
  levelUps: LevelUp[];
  duplicate: boolean;
}

export function summarize(setup: MatchSetup, result: BattleResult, me: PlayerState, foe: PlayerState): BattleSummary {
  const factions: Record<string, number> = {};
  for (const [id, n] of Object.entries(me.stats.played)) factions[CARD_MAP[id].faction] = (factions[CARD_MAP[id].faction] ?? 0) + n;
  return {
    battleId: setup.battleId,
    won: result.winner === 0, draw: result.winner === null,
    crowns: result.crowns[0], crownsLost: result.crowns[1],
    cardsPlayed: me.stats.cardsPlayed, spellsCast: me.stats.spellsCast, unitsDeployed: me.stats.unitsDeployed, unitsKilled: me.stats.unitsKilled,
    played: { ...me.stats.played }, factionsPlayed: factions,
    difficulty: DIFFICULTY_ORDER.indexOf(setup.difficulty), ranked: setup.mode === 'classe', eventId: setup.eventId,
  };
  void foe;
}

/** Applique les conséquences d'un combat terminé. Idempotent par identifiant de combat. */
export function applyMatchResult(s: SaveData, setup: MatchSetup, b: BattleSummary, now: number): MatchRewards {
  const outcome = b.won ? 'victoire' : b.draw ? 'egalite' : 'defaite';
  const empty: MatchRewards = { outcome, gold: 0, xp: 0, trophies: 0, passXp: 0, crowns: 0, chest: null, chestSlotsFull: false, levelUps: [], duplicate: true };
  if (s.rewardedBattles.includes(b.battleId)) return empty;
  s.rewardedBattles.push(b.battleId);
  if (s.rewardedBattles.length > 50) s.rewardedBattles.shift();

  const d = b.difficulty;
  const training = setup.mode === 'entrainement';
  const gold = b.won ? (training ? 10 : 25 + 10 * d) : b.draw ? 10 : training ? 3 : 8;
  const xp = b.won ? 20 + 4 * d : b.draw ? 12 : 8;
  const passXp = b.won ? 40 + 5 * d : 15;
  let trophies = 0;
  if (setup.mode === 'classe') {
    trophies = b.won ? 30 + 2 * d : b.draw ? 0 : -15;
    const before = s.profile.trophies;
    s.profile.trophies = Math.max(0, s.profile.trophies + trophies);
    trophies = s.profile.trophies - before;
    s.profile.bestTrophies = Math.max(s.profile.bestTrophies, s.profile.trophies);
  }
  s.gold += gold;
  s.pass.xp += passXp;
  const crowns = Math.min(b.crowns, Math.max(0, 10 - s.chests.crowns));
  s.chests.crowns += crowns;

  let chest: ChestType | null = null;
  let chestSlotsFull = false;
  if (b.won && !training) {
    const type = CHEST_CYCLE[s.chests.nextCycle % CHEST_CYCLE.length];
    if (addChestToSlot(s, type, now)) { chest = type; s.chests.nextCycle++; }
    else chestSlotsFull = true;
  }

  const st = s.stats;
  st.battles++;
  if (b.won) { st.wins++; st.winStreak++; st.bestStreak = Math.max(st.bestStreak, st.winStreak); st.bestDifficulty = Math.max(st.bestDifficulty, d); }
  else { st.winStreak = 0; if (b.draw) st.draws++; else st.losses++; }
  if (b.won && b.crowns >= 3) st.threeCrowns++;
  st.cardsPlayed += b.cardsPlayed;
  st.spellsCast += b.spellsCast;
  st.unitsKilled += b.unitsKilled;
  st.towersDestroyed += Math.min(3, b.crowns);

  recordMissionProgress(s, b);
  if (setup.eventId) recordEventResult(s, setup.eventId, b.won);
  const levelUps = addXp(s, xp);
  return { outcome, gold, xp, trophies, passXp, crowns: b.crowns, chest, chestSlotsFull, levelUps, duplicate: false };
}
