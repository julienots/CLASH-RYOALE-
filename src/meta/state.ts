// Données sauvegardées du joueur et état initial.
import { CARDS } from '../core/cards';

export type ChestType = 'coffre_os' | 'coffre_chair' | 'coffre_chitine' | 'coffre_abysse' | 'coffre_legendaire' | 'coffre_gratuit' | 'coffre_couronnes';

export interface ChestInstance { id: string; type: ChestType; unlockAt: number | null; obtainedAt: number }

export interface CardOwnership { owned: boolean; level: number; fragments: number }

export interface Mission { id: string; kind: string; label: string; target: number; progress: number; reward: { gold?: number; crystals?: number; passXp: number }; claimed: boolean; param?: string }

export interface Settings {
  music: number; sfx: number; quality: 'basse' | 'moyenne' | 'haute';
  deployMode: 'glisser' | 'toucher'; showGrid: boolean; vibration: boolean; damageNumbers: boolean;
}

export interface Stats {
  battles: number; wins: number; losses: number; draws: number; threeCrowns: number;
  cardsPlayed: number; towersDestroyed: number; unitsKilled: number; chestsOpened: number;
  spellsCast: number; upgrades: number; bestDifficulty: number; winStreak: number; bestStreak: number;
}

export interface SaveData {
  version: number;
  createdAt: number;
  /** Horodatage maximal observé (anti-retour d'horloge). */
  maxSeen: number;
  profile: { name: string; level: number; xp: number; trophies: number; bestTrophies: number };
  gold: number;
  crystals: number;
  collection: Record<string, CardOwnership>;
  decks: string[][];
  activeDeck: number;
  chests: { slots: (ChestInstance | null)[]; nextCycle: number; freeAt: number; crowns: number; crownDay: string };
  shop: { day: string; offers: ShopOfferState[]; purchases: Record<string, number>; weekly: string; weeklyPurchases: Record<string, number> };
  pass: { seasonId: string; xp: number; premium: boolean; claimedFree: number[]; claimedPremium: number[] };
  missions: { dayKey: string; weekKey: string; daily: Mission[]; weekly: Mission[] };
  events: { weekKey: string; progress: Record<string, { wins: number; played: number; claimed: number[] }> };
  achievements: Record<string, boolean>;
  cosmetics: { owned: string[]; banner: string; emote: string; summonFx: string };
  stats: Stats;
  settings: Settings;
  /** Identifiants des combats déjà récompensés (anti-double récompense). */
  rewardedBattles: string[];
  tutorialDone: boolean;
}

export interface ShopOfferState { id: string; kind: 'card' | 'chest' | 'gold' | 'gift'; cardId?: string; chest?: ChestType; amount: number; price: number; currency: 'gold' | 'crystals' | 'free'; limit: number }

export const SAVE_VERSION = 1;

export const STARTER_DECK = ['charognard', 'larve_rongeuse', 'mante_corne', 'arbaletrier_os', 'cracheur_acide', 'pluie_bile', 'tour_dards', 'goule_jumelle'];
export const STARTER_EXTRA = ['salve_epines', 'meute_crocs', 'sentinelle_rouillee', 'essaim_mouches'];

export function newSave(now: number): SaveData {
  const collection: Record<string, CardOwnership> = {};
  for (const c of CARDS) collection[c.id] = { owned: false, level: 1, fragments: 0 };
  for (const id of [...STARTER_DECK, ...STARTER_EXTRA]) collection[id].owned = true;
  return {
    version: SAVE_VERSION,
    createdAt: now,
    maxSeen: now,
    profile: { name: 'Éveilleur', level: 1, xp: 0, trophies: 0, bestTrophies: 0 },
    gold: 200,
    crystals: 60,
    collection,
    decks: [STARTER_DECK.slice(), STARTER_DECK.slice(), STARTER_DECK.slice()],
    activeDeck: 0,
    chests: { slots: [{ id: 'start-1', type: 'coffre_os', unlockAt: null, obtainedAt: now }, null, null, null], nextCycle: 0, freeAt: now, crowns: 0, crownDay: '' },
    shop: { day: '', offers: [], purchases: {}, weekly: '', weeklyPurchases: {} },
    pass: { seasonId: '', xp: 0, premium: false, claimedFree: [], claimedPremium: [] },
    missions: { dayKey: '', weekKey: '', daily: [], weekly: [] },
    events: { weekKey: '', progress: {} },
    achievements: {},
    cosmetics: { owned: ['banniere_cendre', 'emote_rictus', 'fx_standard'], banner: 'banniere_cendre', emote: 'emote_rictus', summonFx: 'fx_standard' },
    stats: { battles: 0, wins: 0, losses: 0, draws: 0, threeCrowns: 0, cardsPlayed: 0, towersDestroyed: 0, unitsKilled: 0, chestsOpened: 0, spellsCast: 0, upgrades: 0, bestDifficulty: -1, winStreak: 0, bestStreak: 0 },
    settings: { music: 0.6, sfx: 0.8, quality: 'haute', deployMode: 'glisser', showGrid: true, vibration: true, damageNumbers: true },
    rewardedBattles: [],
    tutorialDone: false,
  };
}
