// Missions quotidiennes / hebdomadaires et succès.
import { FACTION_PALETTE } from '../core/cards';
import { hashString, Rng } from '../core/rng';
import type { Faction } from '../core/types';
import { ownedCount, type Result } from './economy';
import type { Mission, SaveData } from './state';
import { dayKey, weekKey } from './time';

/** Résumé d'un combat terminé, utilisé par missions, succès, pass et événements. */
export interface BattleSummary {
  battleId: string;
  won: boolean; draw: boolean;
  crowns: number; crownsLost: number;
  cardsPlayed: number; spellsCast: number; unitsDeployed: number; unitsKilled: number;
  played: Record<string, number>;
  factionsPlayed: Record<string, number>;
  difficulty: number; // 0..3
  ranked: boolean;
  eventId?: string;
}

interface Template { kind: string; label: (n: number, p?: string) => string; targets: number[]; param?: () => string; gold: number; passXp: number; crystals?: number }

const FACTIONS = Object.keys(FACTION_PALETTE) as Faction[];

const DAILY: Template[] = [
  { kind: 'win', label: (n) => `Remporter ${n} combat${n > 1 ? 's' : ''}`, targets: [1, 2, 3], gold: 80, passXp: 60 },
  { kind: 'play', label: (n) => `Jouer ${n} cartes`, targets: [20, 30, 40], gold: 50, passXp: 40 },
  { kind: 'spell', label: (n) => `Lancer ${n} sorts`, targets: [3, 5, 8], gold: 60, passXp: 40 },
  { kind: 'crowns', label: (n) => `Gagner ${n} couronnes`, targets: [2, 4, 6], gold: 70, passXp: 50 },
  { kind: 'kills', label: (n) => `Éliminer ${n} unités ennemies`, targets: [20, 35, 50], gold: 60, passXp: 40 },
  { kind: 'faction', label: (n, p) => `Jouer ${n} cartes ${FACTION_PALETTE[p as Faction].label}`, targets: [8, 12, 16], param: () => '', gold: 70, passXp: 50 },
  { kind: 'battles', label: (n) => `Livrer ${n} combats`, targets: [2, 3, 4], gold: 50, passXp: 40 },
];
const WEEKLY: Template[] = [
  { kind: 'win', label: (n) => `Remporter ${n} combats`, targets: [10, 15], gold: 400, passXp: 250, crystals: 20 },
  { kind: 'threeCrowns', label: (n) => `Réaliser ${n} victoires à 3 couronnes`, targets: [3, 5], gold: 500, passXp: 300, crystals: 25 },
  { kind: 'play', label: (n) => `Jouer ${n} cartes`, targets: [200, 300], gold: 300, passXp: 200, crystals: 15 },
  { kind: 'kills', label: (n) => `Éliminer ${n} unités ennemies`, targets: [250, 400], gold: 350, passXp: 220, crystals: 15 },
  { kind: 'hard', label: (n) => `Vaincre ${n} bots Cauchemar ou plus`, targets: [3, 5], gold: 600, passXp: 300, crystals: 30 },
];

function build(t: Template, rng: Rng, id: string): Mission {
  const target = rng.pick(t.targets);
  const param = t.kind === 'faction' ? rng.pick(FACTIONS) : undefined;
  return { id, kind: t.kind, label: t.label(target, param), target, progress: 0, claimed: false, param,
    reward: { gold: t.gold * (1 + t.targets.indexOf(target) * 0.5), crystals: t.crystals, passXp: t.passXp } };
}

export function refreshMissions(s: SaveData, now: number): boolean {
  let changed = false;
  const dk = dayKey(now), wk = weekKey(now);
  if (s.missions.dayKey !== dk) {
    const rng = new Rng(hashString(`daily:${dk}:${s.createdAt}`));
    s.missions.daily = rng.shuffle(DAILY.slice()).slice(0, 3).map((t, i) => build(t, rng, `d-${dk}-${i}`));
    s.missions.dayKey = dk;
    changed = true;
  }
  if (s.missions.weekKey !== wk) {
    const rng = new Rng(hashString(`weekly:${wk}:${s.createdAt}`));
    s.missions.weekly = rng.shuffle(WEEKLY.slice()).slice(0, 3).map((t, i) => build(t, rng, `w-${wk}-${i}`));
    s.missions.weekKey = wk;
    changed = true;
  }
  return changed;
}

function increment(m: Mission, b: BattleSummary): number {
  switch (m.kind) {
    case 'win': return b.won ? 1 : 0;
    case 'battles': return 1;
    case 'play': return b.cardsPlayed;
    case 'spell': return b.spellsCast;
    case 'crowns': return b.crowns;
    case 'kills': return b.unitsKilled;
    case 'threeCrowns': return b.won && b.crowns >= 3 ? 1 : 0;
    case 'hard': return b.won && b.difficulty >= 2 ? 1 : 0;
    case 'faction': return b.factionsPlayed[m.param ?? ''] ?? 0;
    default: return 0;
  }
}

export function recordMissionProgress(s: SaveData, b: BattleSummary): void {
  for (const m of [...s.missions.daily, ...s.missions.weekly]) {
    if (m.claimed) continue;
    m.progress = Math.min(m.target, m.progress + increment(m, b));
  }
}

export function claimMission(s: SaveData, id: string): Result<Mission> {
  const m = [...s.missions.daily, ...s.missions.weekly].find((x) => x.id === id);
  if (!m) return { ok: false, reason: 'Mission introuvable' };
  if (m.claimed) return { ok: false, reason: 'Déjà réclamée' };
  if (m.progress < m.target) return { ok: false, reason: 'Mission incomplète' };
  m.claimed = true;
  s.gold += Math.round(m.reward.gold ?? 0);
  s.crystals += m.reward.crystals ?? 0;
  s.pass.xp += m.reward.passXp;
  return { ok: true, value: m };
}

// ------------------------------------------------------------------ succès
export interface Achievement { id: string; name: string; description: string; crystals: number; check: (s: SaveData) => number; target: number }

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'premier_sang', name: 'Premier sang', description: 'Remporter un combat.', crystals: 20, target: 1, check: (s) => s.stats.wins },
  { id: 'veteran', name: 'Vétéran des fosses', description: 'Remporter 25 combats.', crystals: 60, target: 25, check: (s) => s.stats.wins },
  { id: 'boucher', name: 'Boucherie', description: 'Remporter 100 combats.', crystals: 150, target: 100, check: (s) => s.stats.wins },
  { id: 'triple', name: 'Triple couronne', description: 'Gagner 10 fois à 3 couronnes.', crystals: 80, target: 10, check: (s) => s.stats.threeCrowns },
  { id: 'collection_30', name: 'Bestiaire naissant', description: 'Débloquer 30 cartes.', crystals: 80, target: 30, check: (s) => ownedCount(s) },
  { id: 'collection_70', name: 'Grand Bestiaire', description: 'Débloquer les 70 cartes.', crystals: 400, target: 70, check: (s) => ownedCount(s) },
  { id: 'ameliorations', name: 'Greffeur', description: 'Améliorer 20 fois des cartes.', crystals: 60, target: 20, check: (s) => s.stats.upgrades },
  { id: 'coffres', name: 'Pilleur de reliquaires', description: 'Ouvrir 30 coffres.', crystals: 60, target: 30, check: (s) => s.stats.chestsOpened },
  { id: 'niveau_10', name: 'Éveil profond', description: 'Atteindre le niveau 10.', crystals: 100, target: 10, check: (s) => s.profile.level },
  { id: 'abyssal', name: 'Regard dans le Gouffre', description: 'Vaincre un bot Abyssal.', crystals: 120, target: 3, check: (s) => s.stats.bestDifficulty },
  { id: 'serie', name: 'Insatiable', description: 'Enchaîner 5 victoires.', crystals: 80, target: 5, check: (s) => s.stats.bestStreak },
  { id: 'tueur', name: 'Exterminateur', description: 'Éliminer 1 000 unités.', crystals: 100, target: 1000, check: (s) => s.stats.unitsKilled },
];

export function claimAchievement(s: SaveData, id: string): Result<Achievement> {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return { ok: false, reason: 'Succès inconnu' };
  if (s.achievements[id]) return { ok: false, reason: 'Déjà réclamé' };
  if (a.check(s) < a.target) return { ok: false, reason: 'Objectif non atteint' };
  s.achievements[id] = true;
  s.crystals += a.crystals;
  return { ok: true, value: a };
}
