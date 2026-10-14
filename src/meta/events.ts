// Événements spéciaux horrifiques : défis contre des bots avec règles modifiées.
import type { Difficulty } from '../sim/ai';
import type { BattleConfig } from '../sim/battle';
import { applyReward, type ChestContents, type Result, type Reward } from './economy';
import { Rng, hashString } from '../core/rng';
import type { SaveData } from './state';
import { weekKey } from './time';

export interface GameEvent {
  id: string;
  name: string;
  tagline: string;
  rules: string[];
  difficulty: Difficulty;
  /** Deck imposé au bot (sinon aléatoire). */
  botDeck?: string[];
  /** Deck imposé au joueur (défi miroir). */
  playerDeck?: string[];
  config: Partial<BattleConfig>;
  /** Paliers de victoires et récompenses (réinitialisés chaque semaine). */
  milestones: { wins: number; reward: Reward; label: string }[];
  color: string;
}

export const EVENTS: GameEvent[] = [
  {
    id: 'nuit_sanglante', name: 'Nuit Sanglante', tagline: 'L’essence coule à flots… le sang aussi.',
    rules: ['Essence doublée pendant tout le combat', 'Bot de niveau Cauchemar', 'Durée : 3 min + 1 min de mort subite'],
    difficulty: 'cauchemar', config: { essenceMult: [2, 2], startEssence: 7 },
    milestones: [
      { wins: 1, reward: { gold: 300 }, label: '300 or' },
      { wins: 3, reward: { chest: 'coffre_chitine' }, label: 'Reliquaire de Chitine' },
      { wins: 5, reward: { crystals: 60 }, label: '60 cristaux' },
    ],
    color: '#c43c41',
  },
  {
    id: 'brume_eternelle', name: 'Brume Éternelle', tagline: 'Les tours sont fragiles. Chaque erreur est fatale.',
    rules: ['Tours à 50 % de vie', 'Combat de 2 min, mort subite de 1 min', 'Bot de niveau Chasseur'],
    difficulty: 'chasseur', config: { towerHpMult: 0.5, duration: 120, doubleAt: 30 },
    milestones: [
      { wins: 1, reward: { gold: 200 }, label: '200 or' },
      { wins: 3, reward: { chest: 'coffre_chair' }, label: 'Coffre de Chair' },
      { wins: 6, reward: { chest: 'coffre_abysse' }, label: 'Coffre des Abysses' },
    ],
    color: '#8fa3b8',
  },
  {
    id: 'maree_abyssale', name: 'Marée Abyssale', tagline: 'L’Innommable remonte des profondeurs.',
    rules: ['Le bot joue un deck Abysse avec L’Innommable', 'Bot de niveau Abyssal', 'Récompense : Coffre Légendaire à 5 victoires'],
    difficulty: 'abyssal',
    botDeck: ['l_innommable', 'sangsue_geante', 'oeil_aile', 'brume_terreur', 'chantre_noye', 'harponneur_noye', 'meduse_celeste', 'fosse_vorace'],
    config: {},
    milestones: [
      { wins: 1, reward: { crystals: 40 }, label: '40 cristaux' },
      { wins: 3, reward: { chest: 'coffre_abysse' }, label: 'Coffre des Abysses' },
      { wins: 5, reward: { chest: 'coffre_legendaire' }, label: 'Coffre Légendaire' },
    ],
    color: '#2fc6c0',
  },
  {
    id: 'defi_ossuaire', name: 'Défi de l’Ossuaire', tagline: 'Même deck d’os pour les deux camps. Que le meilleur stratège gagne.',
    rules: ['Decks miroirs imposés (faction Ossuaire)', 'Cartes au même niveau des deux côtés', 'Bot de niveau Chasseur'],
    difficulty: 'chasseur',
    playerDeck: ['charognard', 'osselets_rampants', 'arbaletrier_os', 'lance_cranes', 'moissonneur_vertebres', 'tambour_ossements', 'sceau_os', 'brasier_ossements'],
    botDeck: ['charognard', 'osselets_rampants', 'arbaletrier_os', 'lance_cranes', 'moissonneur_vertebres', 'tambour_ossements', 'sceau_os', 'brasier_ossements'],
    config: {},
    milestones: [
      { wins: 1, reward: { gold: 250 }, label: '250 or' },
      { wins: 3, reward: { cosmetic: 'emote_larmes', crystals: 30 }, label: 'Émote « Larmes de bile » + 30 cristaux' },
      { wins: 5, reward: { chest: 'coffre_chitine' }, label: 'Reliquaire de Chitine' },
    ],
    color: '#d8cfb8',
  },
];

export function refreshEvents(s: SaveData, now: number): boolean {
  const wk = weekKey(now);
  if (s.events.weekKey === wk) return false;
  s.events = { weekKey: wk, progress: {} };
  return true;
}

export function eventProgress(s: SaveData, id: string) {
  return (s.events.progress[id] ??= { wins: 0, played: 0, claimed: [] });
}

export function recordEventResult(s: SaveData, id: string, won: boolean): void {
  const p = eventProgress(s, id);
  p.played++;
  if (won) p.wins++;
}

export function claimEventMilestone(s: SaveData, id: string, index: number, now: number): Result<{ reward: Reward; chest?: ChestContents }> {
  const ev = EVENTS.find((e) => e.id === id);
  if (!ev) return { ok: false, reason: 'Événement inconnu' };
  const m = ev.milestones[index];
  if (!m) return { ok: false, reason: 'Palier inconnu' };
  const p = eventProgress(s, id);
  if (p.claimed.includes(index)) return { ok: false, reason: 'Déjà réclamé' };
  if (p.wins < m.wins) return { ok: false, reason: 'Victoires insuffisantes' };
  p.claimed.push(index);
  const r = applyReward(s, m.reward, new Rng(hashString(`${s.events.weekKey}:${id}:${index}:${s.createdAt}`)), now);
  return { ok: true, value: { reward: m.reward, chest: r.chest } };
}
