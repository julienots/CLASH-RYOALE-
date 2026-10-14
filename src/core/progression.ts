// Échelle de puissance, niveaux de cartes et coûts d'amélioration.
import type { Rarity } from './types';

export const RARITIES: Rarity[] = ['commun', 'rare', 'epique', 'mythique', 'legendaire', 'abyssal'];

export const RARITY_INFO: Record<Rarity, { label: string; color: string; glow: string; startPower: number; maxLevel: number; dupValue: number }> = {
  commun: { label: 'Commun', color: '#9aa3ad', glow: '#c9d1da', startPower: 1, maxLevel: 14, dupValue: 1 },
  rare: { label: 'Rare', color: '#e08a3a', glow: '#ffb46b', startPower: 3, maxLevel: 12, dupValue: 1 },
  epique: { label: 'Épique', color: '#a64dff', glow: '#d39bff', startPower: 6, maxLevel: 9, dupValue: 1 },
  mythique: { label: 'Mythique', color: '#ff3d6e', glow: '#ff8fae', startPower: 7, maxLevel: 8, dupValue: 1 },
  legendaire: { label: 'Légendaire', color: '#ffd23d', glow: '#fff0a0', startPower: 9, maxLevel: 6, dupValue: 1 },
  abyssal: { label: 'Abyssale', color: '#3dfff0', glow: '#b0fff8', startPower: 10, maxLevel: 5, dupValue: 1 },
};

/** Niveau de puissance de référence auquel les stats du catalogue sont définies. */
export const REFERENCE_POWER = 9;
export const POWER_STEP = 1.08;
export const MAX_POWER = 14;

export function powerLevel(rarity: Rarity, cardLevel: number): number {
  return Math.min(MAX_POWER, RARITY_INFO[rarity].startPower + Math.max(1, cardLevel) - 1);
}

export function statMultiplier(power: number): number {
  return Math.pow(POWER_STEP, power - REFERENCE_POWER);
}

/** Fragments requis pour passer du niveau `level` au suivant. */
export function fragmentsToUpgrade(rarity: Rarity, level: number): number | null {
  if (level >= RARITY_INFO[rarity].maxLevel) return null;
  const tables: Record<Rarity, number[]> = {
    commun: [2, 4, 10, 20, 50, 100, 200, 400, 800, 1000, 1500, 2500, 3500],
    rare: [2, 4, 10, 20, 50, 100, 200, 400, 600, 800, 1000],
    epique: [2, 4, 10, 20, 40, 60, 80, 100],
    mythique: [2, 4, 8, 16, 24, 32, 40],
    legendaire: [2, 4, 8, 12, 20],
    abyssal: [2, 4, 6, 10],
  };
  return tables[rarity][level - 1] ?? null;
}

/** Or requis pour passer du niveau `level` au suivant. */
export function goldToUpgrade(rarity: Rarity, level: number): number | null {
  if (level >= RARITY_INFO[rarity].maxLevel) return null;
  const power = powerLevel(rarity, level);
  const base = [5, 20, 50, 150, 400, 1000, 2000, 4000, 8000, 15000, 25000, 40000, 60000, 80000];
  return base[power - 1] ?? 100000;
}

/** Courbe d'expérience du compte. */
export function xpForLevel(level: number): number {
  return Math.round(40 * Math.pow(level, 1.6) + 60);
}

/** Niveau des tours du joueur (puissance) dérivé du niveau de compte. */
export function towerPowerForAccount(accountLevel: number): number {
  return Math.min(MAX_POWER, Math.max(1, accountLevel));
}
