// Catalogues méta : coffres, cosmétiques, cercles (arènes) — avec probabilités transparentes.
import type { Rarity } from '../core/types';
import type { ChestType } from './state';

export interface ChestDef {
  type: ChestType;
  name: string;
  unlockSeconds: number;
  stacks: number;
  totalFragments: number;
  gold: [number, number];
  crystals: [number, number];
  /** Poids par rareté pour chaque pile de cartes (transparence). */
  weights: Record<Rarity, number>;
  /** Raretés minimales garanties. */
  guaranteed?: Rarity[];
  color: string;
  crystalSkipPerHour: number;
}

export const CHESTS: Record<ChestType, ChestDef> = {
  coffre_gratuit: { type: 'coffre_gratuit', name: 'Offrande Gratuite', unlockSeconds: 0, stacks: 2, totalFragments: 6, gold: [20, 40], crystals: [0, 2],
    weights: { commun: 80, rare: 18, epique: 2, mythique: 0, legendaire: 0, abyssal: 0 }, color: '#8a8f99', crystalSkipPerHour: 0 },
  coffre_os: { type: 'coffre_os', name: "Coffre d'Os", unlockSeconds: 15 * 60, stacks: 3, totalFragments: 12, gold: [30, 60], crystals: [0, 3],
    weights: { commun: 75, rare: 20, epique: 4.5, mythique: 0.4, legendaire: 0.1, abyssal: 0 }, color: '#d8cfb8', crystalSkipPerHour: 12 },
  coffre_chair: { type: 'coffre_chair', name: 'Coffre de Chair', unlockSeconds: 60 * 60, stacks: 4, totalFragments: 28, gold: [80, 140], crystals: [1, 5],
    weights: { commun: 65, rare: 26, epique: 7.5, mythique: 1, legendaire: 0.45, abyssal: 0.05 }, guaranteed: ['rare'], color: '#c43c41', crystalSkipPerHour: 12 },
  coffre_chitine: { type: 'coffre_chitine', name: 'Reliquaire de Chitine', unlockSeconds: 3 * 3600, stacks: 5, totalFragments: 60, gold: [200, 320], crystals: [3, 8],
    weights: { commun: 55, rare: 30, epique: 11, mythique: 2.8, legendaire: 1, abyssal: 0.2 }, guaranteed: ['epique'], color: '#9bc23a', crystalSkipPerHour: 10 },
  coffre_abysse: { type: 'coffre_abysse', name: 'Coffre des Abysses', unlockSeconds: 8 * 3600, stacks: 6, totalFragments: 120, gold: [500, 800], crystals: [8, 16],
    weights: { commun: 45, rare: 32, epique: 15, mythique: 5, legendaire: 2.5, abyssal: 0.5 }, guaranteed: ['epique', 'mythique'], color: '#2fc6c0', crystalSkipPerHour: 8 },
  coffre_legendaire: { type: 'coffre_legendaire', name: 'Coffre Légendaire', unlockSeconds: 0, stacks: 1, totalFragments: 1, gold: [0, 0], crystals: [0, 0],
    weights: { commun: 0, rare: 0, epique: 0, mythique: 0, legendaire: 92, abyssal: 8 }, guaranteed: ['legendaire'], color: '#ffd23d', crystalSkipPerHour: 0 },
  coffre_couronnes: { type: 'coffre_couronnes', name: 'Coffre des Couronnes', unlockSeconds: 0, stacks: 4, totalFragments: 40, gold: [150, 250], crystals: [5, 10],
    weights: { commun: 60, rare: 28, epique: 9, mythique: 2, legendaire: 0.9, abyssal: 0.1 }, guaranteed: ['rare'], color: '#ff9f3d', crystalSkipPerHour: 0 },
};

/** Cycle déterministe des coffres gagnés en combat. */
export const CHEST_CYCLE: ChestType[] = ['coffre_os', 'coffre_os', 'coffre_chair', 'coffre_os', 'coffre_chair', 'coffre_os', 'coffre_chitine', 'coffre_os', 'coffre_chair', 'coffre_os', 'coffre_os', 'coffre_abysse'];

/** Fragments obtenus par pile selon la rareté (proportion du total). */
export const RARITY_STACK_FACTOR: Record<Rarity, number> = { commun: 1, rare: 0.35, epique: 0.08, mythique: 0.04, legendaire: 0, abyssal: 0 };

export function chestOdds(type: ChestType): { rarity: Rarity; pct: number }[] {
  const w = CHESTS[type].weights;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return (Object.keys(w) as Rarity[]).filter((r) => w[r] > 0).map((r) => ({ rarity: r, pct: (w[r] / total) * 100 }));
}

export interface Cosmetic { id: string; kind: 'banniere' | 'emote' | 'invocation'; name: string; description: string; colors: string[]; price?: { gold?: number; crystals?: number } }

export const COSMETICS: Cosmetic[] = [
  { id: 'banniere_cendre', kind: 'banniere', name: 'Bannière de Cendre', description: 'Toile grise des premiers éveillés.', colors: ['#2a2626', '#6b6262'] },
  { id: 'banniere_sang', kind: 'banniere', name: 'Bannière Sanglante', description: 'Teinte au sang de larve.', colors: ['#3a0b10', '#c43c41'], price: { gold: 1500 } },
  { id: 'banniere_ruche', kind: 'banniere', name: 'Étendard de la Ruche', description: 'Alvéoles de chitine vivante.', colors: ['#2e3314', '#c6ff4a'], price: { crystals: 120 } },
  { id: 'banniere_gouffre', kind: 'banniere', name: 'Voile du Gouffre', description: 'Tissé de lumière abyssale.', colors: ['#071a24', '#4dfff0'] },
  { id: 'banniere_os', kind: 'banniere', name: 'Bannière Ossuaire', description: 'Vertèbres cousues sur velours.', colors: ['#241a2e', '#d8cfb8'] },
  { id: 'emote_rictus', kind: 'emote', name: 'Rictus', description: 'Un sourire trop large.', colors: ['#d8cfb8'] },
  { id: 'emote_hurlement', kind: 'emote', name: 'Hurlement', description: 'Le cri qui glace l’arène.', colors: ['#ff4d3d'], price: { gold: 800 } },
  { id: 'emote_oeil', kind: 'emote', name: 'Œil qui cligne', description: 'Il vous a vu.', colors: ['#4dfff0'], price: { crystals: 60 } },
  { id: 'emote_larmes', kind: 'emote', name: 'Larmes de bile', description: 'Pour les défaites honorables.', colors: ['#c6ff4a'] },
  { id: 'fx_standard', kind: 'invocation', name: 'Invocation standard', description: 'Cercle d’essence simple.', colors: ['#b98cff'] },
  { id: 'fx_sang', kind: 'invocation', name: 'Geyser de sang', description: 'Les unités surgissent d’une flaque écarlate.', colors: ['#ff2a2a'], price: { crystals: 200 } },
  { id: 'fx_abysse', kind: 'invocation', name: 'Portail abyssal', description: 'Vortex cyan d’invocation.', colors: ['#4dfff0'] },
  { id: 'fx_os', kind: 'invocation', name: 'Pluie d’os', description: 'Fragments d’os qui s’assemblent.', colors: ['#e8e3d0'], price: { gold: 3000 } },
];
export const COSMETIC_MAP = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export interface Arena { id: string; name: string; minTrophies: number; difficulty: 'initie' | 'chasseur' | 'cauchemar' | 'abyssal'; botLevelBonus: number; ground: string; accent: string }
export const ARENAS: Arena[] = [
  { id: 'fosse', name: 'Fosse des Larves', minTrophies: 0, difficulty: 'initie', botLevelBonus: 0, ground: '#2a1f1c', accent: '#c43c41' },
  { id: 'ossuaire', name: 'Ossuaire Inondé', minTrophies: 300, difficulty: 'chasseur', botLevelBonus: 0, ground: '#1f1c26', accent: '#b98cff' },
  { id: 'forge', name: 'Forge Rouillée', minTrophies: 700, difficulty: 'chasseur', botLevelBonus: 1, ground: '#261c14', accent: '#ffb347' },
  { id: 'ruche', name: 'Ruche Chitineuse', minTrophies: 1200, difficulty: 'cauchemar', botLevelBonus: 1, ground: '#1d2112', accent: '#c6ff4a' },
  { id: 'gouffre', name: 'Gouffre Abyssal', minTrophies: 2000, difficulty: 'cauchemar', botLevelBonus: 2, ground: '#0e1a20', accent: '#4dfff0' },
  { id: 'trone', name: 'Trône de Chair', minTrophies: 3000, difficulty: 'abyssal', botLevelBonus: 2, ground: '#240d10', accent: '#ff3d6e' },
];
export function arenaFor(trophies: number): Arena {
  let a = ARENAS[0];
  for (const x of ARENAS) if (trophies >= x.minTrophies) a = x;
  return a;
}
