// Types fondamentaux partagés par la simulation, la méta-progression et le rendu.

export type Rarity = 'commun' | 'rare' | 'epique' | 'mythique' | 'legendaire' | 'abyssal';
export type Faction = 'chitine' | 'ossuaire' | 'chair' | 'abysse' | 'rouille';
export type CardKind = 'unit' | 'spell' | 'building';
export type Category = 'melee' | 'distance' | 'aerien' | 'support' | 'sort' | 'batiment';
export type TargetType = 'ground' | 'air' | 'both' | 'buildings';

export type BodyPlan =
  | 'worm' | 'biped' | 'brute' | 'quadruped' | 'insect' | 'mantis' | 'spider' | 'crab'
  | 'serpent' | 'floater' | 'winged' | 'fly' | 'blob' | 'skeletal' | 'hulk' | 'priest'
  | 'tower' | 'nest' | 'trap' | 'pump' | 'brazier' | 'jelly' | 'eye' | 'leech' | 'mech'
  | 'spell';

export interface Visual {
  plan: BodyPlan;
  /** Taille relative (1 = humanoïde standard). */
  scale: number;
  c1: string; // couleur principale (chair / chitine)
  c2: string; // couleur secondaire (os, plaques)
  c3: string; // accent / lueur
  eyes: number;
  spikes: number;
  limbs: number;
  tentacles: number;
  horns: number;
  seed: number;
  /** Variante de silhouette (châssis / arme) pour certains plans. */
  variant?: number;
  /** Matériau de rendu réaliste (chair, chitine, os, abysse, rouille, pierre). */
  mat?: string;
}

export type Ability =
  | { type: 'charge'; distance: number; mult: number; speedMult: number }
  | { type: 'deathSpawn'; unit: string; count: number }
  | { type: 'deathBlast'; damage: number; radius: number; stun?: number }
  | { type: 'spawner'; unit: string; count: number; interval: number }
  | { type: 'aura'; effect: 'heal' | 'haste' | 'fear' | 'poison'; value: number; radius: number }
  | { type: 'shieldPulse'; amount: number; radius: number; interval: number }
  | { type: 'rampUp'; stages: number[]; stageTime: number }
  | { type: 'slowOnHit'; amount: number; duration: number }
  | { type: 'stunOnHit'; duration: number }
  | { type: 'poisonOnHit'; dps: number; duration: number }
  | { type: 'chain'; jumps: number; radius: number }
  | { type: 'lifesteal'; pct: number }
  | { type: 'riverLeap' }
  | { type: 'burrow' }
  | { type: 'stealth' }
  | { type: 'enrage'; threshold: number; hitSpeedMult: number; speedMult: number }
  | { type: 'pierce'; length: number; width: number }
  | { type: 'thorns'; pct: number }
  | { type: 'reviveOnce'; hpPct: number }
  | { type: 'dash'; min: number; max: number; cooldown: number }
  | { type: 'kamikaze' }
  | { type: 'devour'; interval: number; maxHp: number }
  | { type: 'hook'; range: number; cooldown: number }
  | { type: 'raiseDead'; radius: number; unit: string; cooldown: number }
  | { type: 'tidePull'; interval: number; radius: number; stun: number; damage: number }
  | { type: 'burnTrail'; every: number; dps: number; radius: number; duration: number }
  | { type: 'essencePump'; amount: number; interval: number }
  | { type: 'trap'; trigger: number; damage: number; radius: number; root: number };

export interface UnitDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  /** Secondes entre deux attaques. */
  hitSpeed: number;
  /** Portée d'attaque en cases (bord à bord). */
  range: number;
  /** Cases par seconde (0 pour les bâtiments). */
  speed: number;
  /** Portée d'acquisition des cibles. */
  sight: number;
  targets: TargetType;
  flying?: boolean;
  building?: boolean;
  radius: number;
  mass: number;
  splash?: number;
  /** Vitesse du projectile en cases/s (absent = attaque de mêlée instantanée). */
  projectile?: number;
  shield?: number;
  /** Durée de vie des bâtiments (secondes). */
  lifetime?: number;
  abilities?: Ability[];
  visual: Visual;
}

export interface SpellDef {
  radius: number;
  /** Délai avant impact (secondes). */
  delay: number;
  damage?: number;
  /** Fraction des dégâts infligés aux tours (0..1). */
  towerPct?: number;
  knockback?: number;
  stun?: number;
  slow?: number;
  duration?: number;
  dps?: number;
  heal?: number;
  shield?: number;
  pull?: number;
  spawn?: { unit: string; count: number };
  crater?: { dps: number; duration: number };
  /** Cible : ennemis (par défaut) ou alliés. */
  affects?: 'enemies' | 'allies';
}

export interface CardDef {
  id: string;
  name: string;
  rarity: Rarity;
  faction: Faction;
  cost: number;
  kind: CardKind;
  category: Category;
  role: string;
  description: string;
  /** Capacité signature (légendaires et abyssales). */
  signature?: string;
  strengths: string;
  weaknesses: string;
  counters: string[];
  /** Unités invoquées (cartes unité / bâtiment). */
  spawns?: { unit: string; count: number }[];
  spell?: SpellDef;
  /** Peut être déployée n'importe où (sauf zone du roi adverse). */
  deployAnywhere?: boolean;
}

export type PlayerId = 0 | 1;
