// Catalogue SUPERESSENCE : 70 cartes jouables + unités-jetons.
// Toutes les statistiques sont exprimées au « niveau de puissance » de référence 9
// (voir progression.ts pour l'échelle). Créations originales.
import type { CardDef, UnitDef, Visual, BodyPlan, Faction } from './types';

export const FACTION_PALETTE: Record<Faction, { c1: string; c2: string; c3: string; label: string }> = {
  chitine: { c1: '#56652a', c2: '#c9b26a', c3: '#c6ff4a', label: 'Chitine' },
  ossuaire: { c1: '#d8cfb8', c2: '#4b3a5a', c3: '#b98cff', label: 'Ossuaire' },
  chair: { c1: '#8e2a2e', c2: '#e0a38f', c3: '#ff4d3d', label: 'Chair' },
  abysse: { c1: '#1d4e5c', c2: '#2a2550', c3: '#4dfff0', label: 'Abysse' },
  rouille: { c1: '#8a4b22', c2: '#3b3b3f', c3: '#ffb347', label: 'Rouille' },
};

let seedCounter = 1;
function vis(plan: BodyPlan, scale: number, f: Faction, o: Partial<Visual> = {}): Visual {
  const p = FACTION_PALETTE[f];
  return {
    plan, scale, c1: p.c1, c2: p.c2, c3: p.c3,
    eyes: 2, spikes: 0, limbs: 2, tentacles: 0, horns: 0,
    seed: seedCounter++ * 7919, ...o,
  };
}

type U = Omit<UnitDef, 'id' | 'name' | 'sight' | 'mass' | 'radius'> & Partial<Pick<UnitDef, 'sight' | 'mass' | 'radius'>>;
const UNITS_LIST: UnitDef[] = [];
function unit(id: string, name: string, d: U): void {
  UNITS_LIST.push({ id, name, sight: 5.5, radius: 0.45, mass: 4, ...d });
}

// ---------------------------------------------------------------- Jetons
unit('larve', 'Larve', { hp: 90, damage: 60, hitSpeed: 1.0, range: 0.5, speed: 1.6, targets: 'ground', radius: 0.3, mass: 1,
  visual: vis('worm', 0.55, 'chair') });
unit('osselet', 'Osselet', { hp: 75, damage: 75, hitSpeed: 1.0, range: 0.5, speed: 1.4, targets: 'ground', radius: 0.3, mass: 1,
  visual: vis('skeletal', 0.55, 'ossuaire', { eyes: 1 }) });
unit('drone_ruche', 'Drone de Ruche', { hp: 140, damage: 55, hitSpeed: 1.0, range: 0.6, speed: 1.6, targets: 'both', flying: true, radius: 0.3, mass: 1,
  visual: vis('fly', 0.5, 'chitine', { c3: '#f2ff7a' }) });
unit('eclat_chair', 'Éclat de Chair', { hp: 900, damage: 90, hitSpeed: 1.3, range: 0.6, speed: 1.0, targets: 'buildings', radius: 0.55, mass: 8,
  visual: vis('blob', 0.8, 'chair', { eyes: 3 }) });
unit('spore', 'Spore Rampante', { hp: 160, damage: 70, hitSpeed: 1.1, range: 0.5, speed: 1.4, targets: 'ground', radius: 0.3, mass: 1,
  visual: vis('blob', 0.45, 'chitine', { eyes: 1, spikes: 5 }) });

// ---------------------------------------------------------------- Mêlée & tanks (30)
unit('larve_rongeuse', 'Larve Rongeuse', { hp: 90, damage: 60, hitSpeed: 1.0, range: 0.5, speed: 1.6, targets: 'ground', radius: 0.3, mass: 1,
  visual: vis('worm', 0.6, 'chair', { eyes: 0, spikes: 3 }) });
unit('charognard', 'Charognard', { hp: 1100, damage: 140, hitSpeed: 1.2, range: 0.7, speed: 1.0, targets: 'ground',
  visual: vis('biped', 1.0, 'ossuaire', { c1: '#b8ad94', eyes: 2, spikes: 2, horns: 1 }) });
unit('mante_corne', 'Mante-Corne', { hp: 860, damage: 210, hitSpeed: 1.3, range: 0.9, speed: 1.33, targets: 'ground',
  visual: vis('mantis', 1.0, 'chitine', { eyes: 2, limbs: 4, horns: 2 }) });
unit('goule_jumelle', 'Goule Jumelle', { hp: 420, damage: 95, hitSpeed: 1.1, range: 0.6, speed: 1.33, targets: 'ground', radius: 0.38, mass: 3,
  visual: vis('biped', 0.8, 'ossuaire', { c1: '#9a8f7a', c3: '#7affb2', eyes: 2, spikes: 4 }) });
unit('colosse_chair', 'Colosse de Chair', { hp: 4200, damage: 210, hitSpeed: 1.5, range: 0.8, speed: 0.75, targets: 'buildings', sight: 7, radius: 0.9, mass: 20,
  abilities: [{ type: 'deathSpawn', unit: 'eclat_chair', count: 2 }],
  visual: vis('hulk', 1.7, 'chair', { eyes: 5, spikes: 6, tentacles: 2 }) });
unit('belier_ossueux', "Bélier d'Os", { hp: 1500, damage: 220, hitSpeed: 1.8, range: 0.8, speed: 1.33, targets: 'buildings', sight: 7, radius: 0.6, mass: 8,
  abilities: [{ type: 'charge', distance: 2.5, mult: 2, speedMult: 2 }],
  visual: vis('quadruped', 1.15, 'ossuaire', { horns: 4, eyes: 2, limbs: 4 }) });
unit('scarabee_cuirasse', 'Scarabée Cuirassé', { hp: 2600, damage: 120, hitSpeed: 1.3, range: 0.7, speed: 0.75, targets: 'ground', shield: 600, radius: 0.75, mass: 14,
  visual: vis('insect', 1.4, 'chitine', { c1: '#3e4a1e', limbs: 6, horns: 1, eyes: 4 }) });
unit('rodeur_epines', 'Rôdeur à Épines', { hp: 1700, damage: 150, hitSpeed: 1.4, range: 0.7, speed: 1.0, targets: 'ground', radius: 0.55, mass: 7,
  abilities: [{ type: 'thorns', pct: 0.3 }],
  visual: vis('quadruped', 1.1, 'chitine', { spikes: 14, limbs: 4, eyes: 3 }) });
unit('boucher_rouille', 'Boucher Rouillé', { hp: 1500, damage: 280, hitSpeed: 1.7, range: 0.8, speed: 1.0, targets: 'ground', radius: 0.55, mass: 7,
  abilities: [{ type: 'enrage', threshold: 0.5, hitSpeedMult: 0.6, speedMult: 1.3 }],
  visual: vis('brute', 1.2, 'rouille', { eyes: 1, spikes: 3 }) });
unit('meute_crocs', 'Meute de Crocs', { hp: 360, damage: 85, hitSpeed: 0.9, range: 0.6, speed: 1.67, targets: 'ground', radius: 0.38, mass: 3,
  visual: vis('quadruped', 0.8, 'chair', { c1: '#6d1f24', limbs: 4, eyes: 4, spikes: 5 }) });
unit('osselets_rampants', 'Osselet Rampant', { hp: 75, damage: 75, hitSpeed: 1.0, range: 0.5, speed: 1.4, targets: 'ground', radius: 0.3, mass: 1,
  visual: vis('skeletal', 0.55, 'ossuaire', { eyes: 1, limbs: 6 }) });
unit('abomination_suturee', 'Abomination Suturée', { hp: 3000, damage: 220, hitSpeed: 1.6, range: 0.8, speed: 0.75, targets: 'ground', radius: 0.85, mass: 18,
  abilities: [{ type: 'deathSpawn', unit: 'larve', count: 4 }],
  visual: vis('hulk', 1.55, 'chair', { c1: '#a3474a', eyes: 3, limbs: 3, tentacles: 3 }) });
unit('sentinelle_rouillee', 'Sentinelle Rouillée', { hp: 1250, damage: 130, hitSpeed: 1.2, range: 0.7, speed: 1.0, targets: 'ground', radius: 0.5, mass: 6,
  visual: vis('mech', 1.0, 'rouille', { eyes: 1, horns: 2, variant: 4 }) });
unit('hurleur_profondeurs', 'Hurleur des Profondeurs', { hp: 1900, damage: 160, hitSpeed: 1.4, range: 0.7, speed: 1.0, targets: 'ground', radius: 0.6, mass: 9,
  abilities: [{ type: 'aura', effect: 'fear', value: 0.35, radius: 2.5 }],
  visual: vis('brute', 1.25, 'abysse', { eyes: 6, tentacles: 4, horns: 0 }) });
unit('devoreur_tombes', 'Dévoreur de Tombes', { hp: 2000, damage: 200, hitSpeed: 1.3, range: 0.7, speed: 1.0, targets: 'ground', radius: 0.6, mass: 9,
  abilities: [{ type: 'lifesteal', pct: 0.45 }],
  visual: vis('brute', 1.3, 'ossuaire', { c1: '#7d6e8f', c3: '#d5ff6b', eyes: 2, spikes: 6, horns: 2 }) });
unit('bourreau_chitineux', 'Bourreau Chitineux', { hp: 1100, damage: 260, hitSpeed: 1.4, range: 0.8, speed: 1.33, targets: 'ground', radius: 0.5, mass: 6,
  abilities: [{ type: 'dash', min: 3, max: 6, cooldown: 4 }],
  visual: vis('mantis', 1.15, 'chitine', { c1: '#2e3814', c3: '#ff3d6e', limbs: 6, eyes: 4 }) });
unit('golem_rivets', 'Golem à Rivets', { hp: 3000, damage: 160, hitSpeed: 1.5, range: 0.8, speed: 0.75, targets: 'buildings', sight: 7, radius: 0.85, mass: 18,
  abilities: [{ type: 'deathBlast', damage: 300, radius: 2 }],
  visual: vis('mech', 1.55, 'rouille', { eyes: 2, spikes: 4, horns: 0, variant: 12 }) });
unit('rampant_bile', 'Rampant de Bile', { hp: 300, damage: 0, hitSpeed: 0.5, range: 0.4, speed: 1.67, targets: 'ground', radius: 0.35, mass: 2,
  abilities: [{ type: 'kamikaze' }, { type: 'deathBlast', damage: 360, radius: 1.8 }],
  visual: vis('blob', 0.75, 'chair', { c1: '#7c8a1d', c3: '#e6ff3d', eyes: 2, spikes: 0 }) });
unit('sangsue_geante', 'Sangsue Géante', { hp: 900, damage: 40, hitSpeed: 0.4, range: 0.5, speed: 1.0, targets: 'ground', radius: 0.5, mass: 5,
  abilities: [{ type: 'rampUp', stages: [1, 2.5, 5], stageTime: 2 }],
  visual: vis('leech', 1.0, 'abysse', { eyes: 0, spikes: 0 }) });
unit('berserker_greffe', 'Berserker Greffé', { hp: 1300, damage: 190, hitSpeed: 1.1, range: 0.7, speed: 1.33, targets: 'ground', radius: 0.5, mass: 6,
  abilities: [{ type: 'riverLeap' }],
  visual: vis('biped', 1.1, 'chair', { c2: '#b0b5bd', eyes: 1, limbs: 3, spikes: 4 }) });
unit('titan_ossuaire', 'Titan Ossuaire', { hp: 3800, damage: 260, hitSpeed: 1.6, range: 1.0, speed: 0.75, targets: 'ground', radius: 0.95, mass: 22,
  abilities: [{ type: 'reviveOnce', hpPct: 0.3 }, { type: 'deathSpawn', unit: 'osselet', count: 6 }],
  visual: vis('skeletal', 1.85, 'ossuaire', { eyes: 3, horns: 4, spikes: 8, limbs: 4 }) });
unit('bouche_sans_fin', 'La Bouche-sans-Fin', { hp: 2700, damage: 180, hitSpeed: 1.4, range: 0.9, speed: 0.75, targets: 'ground', radius: 0.85, mass: 18,
  abilities: [{ type: 'devour', interval: 10, maxHp: 700 }],
  visual: vis('blob', 1.6, 'abysse', { c1: '#24304f', c3: '#ff5af0', eyes: 9, tentacles: 6 }) });
unit('ecorcheur_nocturne', 'Écorcheur Nocturne', { hp: 1000, damage: 300, hitSpeed: 1.5, range: 0.8, speed: 1.33, targets: 'ground', radius: 0.45, mass: 5,
  abilities: [{ type: 'stealth' }],
  visual: vis('biped', 1.05, 'chair', { c1: '#3a1418', c3: '#ff2a55', eyes: 0, limbs: 4, spikes: 6 }) });
unit('crabe_siege', 'Crabe de Siège', { hp: 1800, damage: 120, hitSpeed: 1.2, range: 0.9, speed: 0.9, targets: 'ground', splash: 1.2, radius: 0.7, mass: 12,
  visual: vis('crab', 1.3, 'abysse', { eyes: 2, limbs: 6, spikes: 4 }) });
unit('moissonneur_vertebres', 'Moissonneur de Vertèbres', { hp: 1600, damage: 200, hitSpeed: 1.5, range: 1.1, speed: 1.0, targets: 'ground', splash: 1.5, radius: 0.55, mass: 7,
  visual: vis('skeletal', 1.25, 'ossuaire', { c3: '#ff9f3d', eyes: 2, limbs: 2, spikes: 10 }) });
unit('homoncule_vapeur', 'Homoncule à Vapeur', { hp: 330, damage: 85, hitSpeed: 1.0, range: 0.6, speed: 1.0, targets: 'ground', radius: 0.38, mass: 3,
  abilities: [{ type: 'deathBlast', damage: 60, radius: 1 }],
  visual: vis('mech', 0.7, 'rouille', { c3: '#9fe0ff', eyes: 1, variant: 14 }) });
unit('chimere_suturee', 'Chimère Suturée', { hp: 2000, damage: 170, hitSpeed: 1.2, range: 0.8, speed: 1.0, targets: 'ground', radius: 0.65, mass: 10,
  abilities: [{ type: 'chain', jumps: 2, radius: 2 }],
  visual: vis('quadruped', 1.3, 'chair', { c2: '#d6c3a5', eyes: 6, horns: 3, limbs: 4, tentacles: 2 }) });
unit('fouisseuse_chitineuse', 'Fouisseuse Chitineuse', { hp: 1000, damage: 120, hitSpeed: 1.2, range: 0.6, speed: 1.0, targets: 'ground', radius: 0.45, mass: 5,
  visual: vis('spider', 0.95, 'chitine', { c1: '#6e5a2b', limbs: 8, eyes: 6 }) });
unit('l_innommable', "L'Innommable", { hp: 4000, damage: 220, hitSpeed: 1.4, range: 1.0, speed: 0.75, targets: 'ground', radius: 1.0, mass: 25,
  abilities: [{ type: 'tidePull', interval: 10, radius: 4.5, stun: 0.6, damage: 120 }, { type: 'aura', effect: 'fear', value: 0.25, radius: 3 }],
  visual: vis('hulk', 2.0, 'abysse', { c1: '#120f22', c2: '#3b2b6e', c3: '#8affff', eyes: 12, tentacles: 8, horns: 2 }) });
unit('chevaucheur_scolopendre', 'Chevaucheur de Scolopendre', { hp: 1700, damage: 210, hitSpeed: 1.4, range: 0.8, speed: 1.33, targets: 'ground', radius: 0.6, mass: 9,
  abilities: [{ type: 'charge', distance: 2.5, mult: 2, speedMult: 2 }],
  visual: vis('serpent', 1.25, 'chitine', { c1: '#7a3b1d', limbs: 12, eyes: 2, horns: 2 }) });

// ---------------------------------------------------------------- Distance (12)
unit('cracheur_acide', "Cracheur d'Acide", { hp: 500, damage: 110, hitSpeed: 1.2, range: 5, speed: 1.0, targets: 'both', projectile: 9,
  abilities: [{ type: 'poisonOnHit', dps: 30, duration: 2 }],
  visual: vis('blob', 0.9, 'chair', { c1: '#6b7a20', c3: '#d4ff2a', eyes: 3, tentacles: 2 }) });
unit('arbaletrier_os', "Arbalétrier d'Os", { hp: 280, damage: 85, hitSpeed: 1.0, range: 5.5, speed: 1.0, targets: 'both', projectile: 12, radius: 0.38, mass: 3,
  visual: vis('skeletal', 0.85, 'ossuaire', { eyes: 2, limbs: 2 }) });
unit('lanceuse_epines', "Lanceuse d'Épines", { hp: 650, damage: 140, hitSpeed: 1.6, range: 6, speed: 1.0, targets: 'both', projectile: 12,
  abilities: [{ type: 'pierce', length: 7, width: 0.6 }],
  visual: vis('insect', 0.95, 'chitine', { limbs: 4, spikes: 10, eyes: 2 }) });
unit('bombardier_gonfle', 'Bombardier Gonflé', { hp: 800, damage: 180, hitSpeed: 2.2, range: 6.5, speed: 0.75, targets: 'ground', projectile: 6, splash: 1.5, radius: 0.55, mass: 7,
  visual: vis('blob', 1.1, 'chair', { c1: '#b05a4a', eyes: 2, tentacles: 3, spikes: 2 }) });
unit('sorciere_vase', 'Sorcière de Vase', { hp: 800, damage: 120, hitSpeed: 1.4, range: 5, speed: 1.0, targets: 'both', projectile: 8, splash: 1,
  abilities: [{ type: 'slowOnHit', amount: 0.35, duration: 2 }],
  visual: vis('priest', 1.05, 'abysse', { eyes: 3, tentacles: 4 }) });
unit('tourmenteur_electrique', 'Tourmenteur Électrique', { hp: 700, damage: 120, hitSpeed: 1.5, range: 5, speed: 1.0, targets: 'both', projectile: 30,
  abilities: [{ type: 'chain', jumps: 3, radius: 3 }],
  visual: vis('mech', 1.0, 'rouille', { c3: '#7fd8ff', eyes: 3, horns: 2, spikes: 2, variant: 10 }) });
unit('fusilier_rivets', 'Fusilier à Rivets', { hp: 600, damage: 150, hitSpeed: 1.1, range: 6.5, speed: 1.0, targets: 'both', projectile: 18,
  visual: vis('mech', 0.95, 'rouille', { eyes: 1, horns: 0, variant: 8 }) });
unit('lance_cranes', 'Lance-Crânes', { hp: 900, damage: 160, hitSpeed: 1.7, range: 5, speed: 1.0, targets: 'ground', projectile: 7, splash: 1.4, radius: 0.5, mass: 6,
  abilities: [{ type: 'deathSpawn', unit: 'osselet', count: 2 }],
  visual: vis('skeletal', 1.1, 'ossuaire', { c3: '#7affb2', eyes: 2, spikes: 4 }) });
unit('chantre_noye', 'Chantre Noyé', { hp: 750, damage: 130, hitSpeed: 1.6, range: 5, speed: 1.0, targets: 'both', projectile: 10,
  abilities: [{ type: 'stunOnHit', duration: 0.5 }],
  visual: vis('priest', 1.0, 'abysse', { c1: '#355a6b', eyes: 0, tentacles: 6 }) });
unit('canonnier_vapeur', 'Canonnier à Vapeur', { hp: 1400, damage: 300, hitSpeed: 2.5, range: 7, speed: 0.75, targets: 'buildings', sight: 7.5, projectile: 8, radius: 0.6, mass: 10,
  visual: vis('mech', 1.25, 'rouille', { eyes: 2, spikes: 0, horns: 0, limbs: 4 }) });
unit('vierge_mille_yeux', 'La Vierge aux Mille Yeux', { hp: 950, damage: 50, hitSpeed: 0.4, range: 5.5, speed: 1.0, targets: 'both', projectile: 40,
  abilities: [{ type: 'rampUp', stages: [1, 2.5, 6], stageTime: 2 }],
  visual: vis('priest', 1.2, 'abysse', { c1: '#3d2a55', c3: '#ffe36b', eyes: 14, tentacles: 2 }) });
unit('harponneur_noye', 'Harponneur Noyé', { hp: 550, damage: 120, hitSpeed: 1.3, range: 6, speed: 1.0, targets: 'ground', projectile: 14,
  abilities: [{ type: 'slowOnHit', amount: 0.2, duration: 1.5 }],
  visual: vis('biped', 0.95, 'abysse', { c1: '#2b5d63', eyes: 4, tentacles: 2 }) });

// ---------------------------------------------------------------- Volants & déplacements spéciaux (8)
unit('mouche_os', 'Mouche-Os', { hp: 105, damage: 60, hitSpeed: 1.0, range: 0.6, speed: 1.67, targets: 'both', flying: true, radius: 0.28, mass: 1,
  visual: vis('fly', 0.45, 'chitine', { c1: '#c4b994', eyes: 2 }) });
unit('oeil_aile', 'Œil Ailé', { hp: 500, damage: 110, hitSpeed: 1.2, range: 4.5, speed: 1.33, targets: 'both', flying: true, projectile: 10,
  visual: vis('eye', 0.9, 'abysse', { eyes: 1, limbs: 2 }) });
unit('vouivre_rouillee', 'Vouivre Rouillée', { hp: 1100, damage: 150, hitSpeed: 1.6, range: 3.5, speed: 1.33, targets: 'both', flying: true, projectile: 8, splash: 1.3, radius: 0.6, mass: 7,
  visual: vis('winged', 1.15, 'rouille', { eyes: 2, horns: 2, spikes: 4 }) });
unit('sac_spores', 'Sac de Spores', { hp: 1500, damage: 560, hitSpeed: 3.0, range: 0.5, speed: 1.0, targets: 'buildings', sight: 8, flying: true, splash: 1.5, radius: 0.7, mass: 8,
  abilities: [{ type: 'deathBlast', damage: 200, radius: 2 }],
  visual: vis('jelly', 1.2, 'chair', { c1: '#8c6a2e', c3: '#c6ff4a', eyes: 0, tentacles: 6 }) });
unit('sauteur_marais', 'Sauteur des Marais', { hp: 900, damage: 150, hitSpeed: 1.3, range: 0.7, speed: 1.33, targets: 'ground',
  abilities: [{ type: 'riverLeap' }],
  visual: vis('quadruped', 0.95, 'abysse', { c1: '#3a5d3a', eyes: 2, limbs: 4, spikes: 3 }) });
unit('wyrm_cendres', 'Wyrm des Cendres', { hp: 2000, damage: 110, hitSpeed: 1.5, range: 2.5, speed: 1.0, targets: 'both', flying: true, projectile: 10, splash: 2, radius: 0.85, mass: 16,
  abilities: [{ type: 'burnTrail', every: 3, dps: 90, radius: 2, duration: 4 }],
  visual: vis('winged', 1.7, 'ossuaire', { c1: '#4a4040', c3: '#ff7b2a', eyes: 4, horns: 6, spikes: 10 }) });
unit('phalene_spectrale', 'Phalène Spectrale', { hp: 350, damage: 140, hitSpeed: 1.0, range: 0.7, speed: 1.67, targets: 'ground', flying: true, radius: 0.4, mass: 2,
  abilities: [{ type: 'slowOnHit', amount: 0.3, duration: 1.5 }],
  visual: vis('fly', 0.85, 'ossuaire', { c1: '#e8e3f5', c3: '#c6a6ff', eyes: 2 }) });
unit('meduse_celeste', 'Méduse Céleste', { hp: 1000, damage: 90, hitSpeed: 1.2, range: 1.5, speed: 1.0, targets: 'both', flying: true, radius: 0.6, mass: 6,
  abilities: [{ type: 'deathBlast', damage: 150, radius: 2.5, stun: 1 }],
  visual: vis('jelly', 1.1, 'abysse', { c3: '#ff8af6', tentacles: 8, eyes: 0 }) });

// ---------------------------------------------------------------- Soutien, invocateurs, contrôle (8)
unit('pretresse_sutures', 'Prêtresse des Sutures', { hp: 900, damage: 70, hitSpeed: 1.2, range: 4, speed: 1.0, targets: 'both', projectile: 10,
  abilities: [{ type: 'aura', effect: 'heal', value: 70, radius: 3 }],
  visual: vis('priest', 1.05, 'chair', { c2: '#e8d5c0', eyes: 1, spikes: 2 }) });
unit('reine_ruche', 'Reine de la Ruche', { hp: 2400, damage: 150, hitSpeed: 1.3, range: 0.8, speed: 0.75, targets: 'ground', radius: 0.8, mass: 16,
  abilities: [{ type: 'spawner', unit: 'drone_ruche', count: 2, interval: 6 }],
  visual: vis('insect', 1.6, 'chitine', { c1: '#7a6a1e', c3: '#f2ff7a', limbs: 6, eyes: 6, horns: 3, spikes: 4 }) });
unit('tambour_ossements', "Tambour d'Ossements", { hp: 1300, damage: 80, hitSpeed: 1.0, range: 0.7, speed: 1.0, targets: 'ground', radius: 0.55, mass: 7,
  abilities: [{ type: 'aura', effect: 'haste', value: 1.45, radius: 3.5 }],
  visual: vis('brute', 1.1, 'ossuaire', { c3: '#ffd36b', eyes: 2, spikes: 3, horns: 1 }) });
unit('nourrice_larves', 'Nourrice à Larves', { hp: 1400, damage: 80, hitSpeed: 1.3, range: 0.7, speed: 0.75, targets: 'ground', radius: 0.65, mass: 10,
  abilities: [{ type: 'spawner', unit: 'larve', count: 2, interval: 5 }],
  visual: vis('blob', 1.3, 'chair', { c2: '#f0c0a8', eyes: 4, tentacles: 4 }) });
unit('gardien_coquille', 'Gardien-Coquille', { hp: 1500, damage: 100, hitSpeed: 1.3, range: 0.7, speed: 0.9, targets: 'ground', radius: 0.65, mass: 10,
  abilities: [{ type: 'shieldPulse', amount: 200, radius: 3, interval: 6 }],
  visual: vis('crab', 1.2, 'abysse', { c1: '#3e6a74', eyes: 2, limbs: 4, spikes: 8 }) });
unit('pecheur_ames', "Pêcheur d'Âmes", { hp: 950, damage: 90, hitSpeed: 1.3, range: 4, speed: 1.0, targets: 'ground', projectile: 12,
  abilities: [{ type: 'hook', range: 6, cooldown: 7 }],
  visual: vis('biped', 1.1, 'abysse', { c1: '#2e3a4a', eyes: 1, tentacles: 3, horns: 0 }) });
unit('semeur_spores', 'Semeur de Spores', { hp: 850, damage: 70, hitSpeed: 1.2, range: 0.7, speed: 1.0, targets: 'ground',
  abilities: [{ type: 'aura', effect: 'poison', value: 35, radius: 2.2 }],
  visual: vis('insect', 1.0, 'chitine', { c1: '#4c5a2a', c3: '#e2ff6b', limbs: 4, eyes: 2, spikes: 8 }) });
unit('liche_archiviste', 'Liche Archiviste', { hp: 1000, damage: 100, hitSpeed: 1.4, range: 5, speed: 1.0, targets: 'both', projectile: 9,
  abilities: [{ type: 'raiseDead', radius: 4, unit: 'osselet', cooldown: 1.5 }],
  visual: vis('priest', 1.15, 'ossuaire', { c1: '#a59ab8', eyes: 2, horns: 2 }) });

// ---------------------------------------------------------------- Bâtiments & pièges (5)
unit('tour_dards', 'Tour à Dards', { hp: 900, damage: 90, hitSpeed: 0.8, range: 6, speed: 0, targets: 'both', building: true, projectile: 14, lifetime: 30, radius: 0.9, mass: 999,
  visual: vis('tower', 1.3, 'chitine', { spikes: 6, eyes: 1 }) });
unit('nid_larves', 'Nid de Larves', { hp: 1000, damage: 0, hitSpeed: 1, range: 0, speed: 0, targets: 'ground', building: true, lifetime: 40, radius: 0.9, mass: 999,
  abilities: [{ type: 'spawner', unit: 'larve', count: 2, interval: 6 }],
  visual: vis('nest', 1.3, 'chair', { eyes: 3 }) });
unit('brasier_ossements', "Brasier d'Ossements", { hp: 1200, damage: 140, hitSpeed: 1.6, range: 5, speed: 0, targets: 'ground', building: true, projectile: 9, splash: 1.5, lifetime: 35, radius: 0.9, mass: 999,
  visual: vis('brazier', 1.3, 'ossuaire', { c3: '#ff8a2a', spikes: 6 }) });
unit('piege_machoires', 'Piège à Mâchoires', { hp: 400, damage: 0, hitSpeed: 1, range: 0, speed: 0, targets: 'ground', building: true, lifetime: 40, radius: 0.6, mass: 999,
  abilities: [{ type: 'trap', trigger: 1.6, damage: 600, radius: 1.9, root: 2.5 }],
  visual: vis('trap', 1.0, 'rouille', { spikes: 10 }) });
unit('puits_essence', "Puits d'Essence", { hp: 900, damage: 0, hitSpeed: 1, range: 0, speed: 0, targets: 'ground', building: true, lifetime: 60, radius: 0.9, mass: 999,
  abilities: [{ type: 'essencePump', amount: 1, interval: 8.5 }],
  visual: vis('pump', 1.3, 'abysse', { eyes: 1, tentacles: 3 }) });

export const UNITS: Record<string, UnitDef> = Object.fromEntries(UNITS_LIST.map((u) => [u.id, u]));

// ================================================================= CARTES
type C = Omit<CardDef, 'id'>;
const CARD_LIST: CardDef[] = [];
function card(id: string, d: C): void { CARD_LIST.push({ id, ...d }); }
const one = (unitId: string, count = 1) => [{ unit: unitId, count }];

// --- Mêlée & tanks (30)
card('larve_rongeuse', { name: 'Larves Rongeuses', rarity: 'commun', faction: 'chair', cost: 2, kind: 'unit', category: 'melee', role: 'Essaim de mêlée',
  description: 'Quatre larves voraces qui submergent les cibles isolées.', spawns: one('larve_rongeuse', 4),
  strengths: 'Excellent contre les unités lentes à cible unique.', weaknesses: 'Fondent sous les dégâts de zone.', counters: ['salve_epines', 'pluie_bile', 'crabe_siege'] });
card('charognard', { name: 'Charognard', rarity: 'commun', faction: 'ossuaire', cost: 3, kind: 'unit', category: 'melee', role: 'Combattant polyvalent',
  description: 'Mangeur de cadavres robuste, fiable en attaque comme en défense.', spawns: one('charognard'),
  strengths: 'Bon rapport points de vie / coût.', weaknesses: 'Aucune portée, cible au sol uniquement.', counters: ['larve_rongeuse', 'sangsue_geante'] });
card('mante_corne', { name: 'Mante-Corne', rarity: 'commun', faction: 'chitine', cost: 3, kind: 'unit', category: 'melee', role: 'Frappe lourde',
  description: 'Ses faux de chitine tranchent les unités moyennes en deux coups.', spawns: one('mante_corne'),
  strengths: 'Gros dégâts par coup.', weaknesses: 'Lente entre deux frappes, fragile face aux essaims.', counters: ['larve_rongeuse', 'osselets_rampants'] });
card('goule_jumelle', { name: 'Goules Jumelles', rarity: 'commun', faction: 'ossuaire', cost: 2, kind: 'unit', category: 'melee', role: 'Duo rapide',
  description: 'Deux goules affamées pour distraire ou finir une tour.', spawns: one('goule_jumelle', 2),
  strengths: 'Rapides et bon marché.', weaknesses: 'Peu de points de vie.', counters: ['salve_epines', 'moissonneur_vertebres'] });
card('colosse_chair', { name: 'Colosse de Chair', rarity: 'epique', faction: 'chair', cost: 7, kind: 'unit', category: 'melee', role: 'Tank de siège',
  description: 'Montagne de chair qui marche sur les tours et éclate en deux fragments.', spawns: one('colosse_chair'),
  strengths: 'Énorme réserve de vie, n\'attaque que les bâtiments.', weaknesses: 'Très lent et ignore les unités.', counters: ['sangsue_geante', 'vierge_mille_yeux', 'larve_rongeuse'] });
card('belier_ossueux', { name: "Bélier d'Os", rarity: 'rare', faction: 'ossuaire', cost: 4, kind: 'unit', category: 'melee', role: 'Charge sur bâtiment',
  description: 'Charge après une courte course et double ses dégâts à l\'impact.', spawns: one('belier_ossueux'),
  strengths: 'Pression rapide sur les tours.', weaknesses: 'Détourné par les bâtiments.', counters: ['tour_dards', 'piege_machoires', 'brasier_ossements'] });
card('scarabee_cuirasse', { name: 'Scarabée Cuirassé', rarity: 'rare', faction: 'chitine', cost: 5, kind: 'unit', category: 'melee', role: 'Tank blindé',
  description: 'Une carapace de 600 PV de bouclier absorbe les premiers coups.', spawns: one('scarabee_cuirasse'),
  strengths: 'Encaisse les tirs en tête de poussée.', weaknesses: 'Dégâts modestes, lent.', counters: ['sangsue_geante', 'larve_rongeuse', 'ecorcheur_nocturne'] });
card('rodeur_epines', { name: 'Rôdeur à Épines', rarity: 'rare', faction: 'chitine', cost: 4, kind: 'unit', category: 'melee', role: 'Riposte',
  description: 'Renvoie 30 % des dégâts de mêlée subis à l\'attaquant.', spawns: one('rodeur_epines'),
  strengths: 'Punit les essaims et les frappeurs de mêlée.', weaknesses: 'Vulnérable aux tirs à distance.', counters: ['cracheur_acide', 'fusilier_rivets'] });
card('boucher_rouille', { name: 'Boucher Rouillé', rarity: 'rare', faction: 'rouille', cost: 4, kind: 'unit', category: 'melee', role: 'Frappeur enragé',
  description: 'Sous 50 % de vie, il frappe et avance bien plus vite.', spawns: one('boucher_rouille'),
  strengths: 'Dangereux quand on le laisse blessé.', weaknesses: 'Contrôles et ralentissements.', counters: ['brume_terreur', 'larve_rongeuse'] });
card('meute_crocs', { name: 'Meute de Crocs', rarity: 'commun', faction: 'chair', cost: 3, kind: 'unit', category: 'melee', role: 'Meute rapide',
  description: 'Trois chiens écorchés qui encerclent leur proie.', spawns: one('meute_crocs', 3),
  strengths: 'Très rapides, bons pour contre-attaquer.', weaknesses: 'Dégâts de zone.', counters: ['crabe_siege', 'pluie_bile'] });
card('osselets_rampants', { name: 'Osselets Rampants', rarity: 'commun', faction: 'ossuaire', cost: 1, kind: 'unit', category: 'melee', role: 'Leurre',
  description: 'Trois amas d\'os animés, parfaits pour détourner un tank.', spawns: one('osselets_rampants', 3),
  strengths: 'Coût minimal, distraction efficace.', weaknesses: 'Meurent au moindre souffle.', counters: ['salve_epines', 'essaim_mouches'] });
card('abomination_suturee', { name: 'Abomination Suturée', rarity: 'epique', faction: 'chair', cost: 6, kind: 'unit', category: 'melee', role: 'Tank agressif',
  description: 'Masse de chairs cousues qui libère quatre larves en mourant.', spawns: one('abomination_suturee'),
  strengths: 'Dégâts élevés et valeur à la mort.', weaknesses: 'Lente et coûteuse.', counters: ['sangsue_geante', 'vierge_mille_yeux'] });
card('sentinelle_rouillee', { name: 'Sentinelle Rouillée', rarity: 'commun', faction: 'rouille', cost: 3, kind: 'unit', category: 'melee', role: 'Défenseur',
  description: 'Automate de fer piqué, solide et constant.', spawns: one('sentinelle_rouillee'),
  strengths: 'Fiable en défense.', weaknesses: 'Pas d\'attaque aérienne.', counters: ['essaim_mouches', 'oeil_aile'] });
card('hurleur_profondeurs', { name: 'Hurleur des Profondeurs', rarity: 'epique', faction: 'abysse', cost: 5, kind: 'unit', category: 'melee', role: 'Terreur',
  description: 'Son cri ralentit de 35 % les ennemis proches (attaque et mouvement).', spawns: one('hurleur_profondeurs'),
  strengths: 'Affaiblit toute une poussée.', weaknesses: 'Dégâts moyens.', counters: ['sangsue_geante', 'fusilier_rivets'] });
card('devoreur_tombes', { name: 'Dévoreur de Tombes', rarity: 'mythique', faction: 'ossuaire', cost: 5, kind: 'unit', category: 'melee', role: 'Vampire',
  description: 'Récupère 45 % des dégâts infligés en points de vie.', spawns: one('devoreur_tombes'),
  strengths: 'Tient longtemps dans les mêlées.', weaknesses: 'Les dégâts burst le submergent.', counters: ['comete_rouille', 'sangsue_geante'] });
card('bourreau_chitineux', { name: 'Bourreau Chitineux', rarity: 'epique', faction: 'chitine', cost: 4, kind: 'unit', category: 'melee', role: 'Assassin',
  description: 'Bondit sur une cible entre 3 et 6 cases (recharge 4 s).', spawns: one('bourreau_chitineux'),
  strengths: 'Élimine les tireurs en retrait.', weaknesses: 'Fragile une fois engagé.', counters: ['sentinelle_rouillee', 'piege_machoires'] });
card('golem_rivets', { name: 'Golem à Rivets', rarity: 'rare', faction: 'rouille', cost: 5, kind: 'unit', category: 'melee', role: 'Tank de siège',
  description: 'Cible les bâtiments et explose à sa destruction.', spawns: one('golem_rivets'),
  strengths: 'Tank abordable, punit les essaims à la mort.', weaknesses: 'Ignore les unités.', counters: ['sangsue_geante', 'vierge_mille_yeux'] });
card('rampant_bile', { name: 'Rampant de Bile', rarity: 'commun', faction: 'chair', cost: 2, kind: 'unit', category: 'melee', role: 'Kamikaze',
  description: 'Fonce et explose au contact : 360 dégâts de zone.', spawns: one('rampant_bile'),
  strengths: 'Échange très rentable contre les groupes.', weaknesses: 'Abattu à distance.', counters: ['arbaletrier_os', 'tour_dards'] });
card('sangsue_geante', { name: 'Sangsue Géante', rarity: 'rare', faction: 'abysse', cost: 3, kind: 'unit', category: 'melee', role: 'Anti-tank',
  description: 'S\'agrippe et draine : ses dégâts augmentent par paliers sur la même cible.', spawns: one('sangsue_geante'),
  strengths: 'Fait fondre les tanks.', weaknesses: 'Se fait distraire par les essaims.', counters: ['larve_rongeuse', 'osselets_rampants'] });
card('berserker_greffe', { name: 'Berserker Greffé', rarity: 'epique', faction: 'chair', cost: 4, kind: 'unit', category: 'melee', role: 'Saut de rivière',
  description: 'Bondit par-dessus la rivière au lieu d\'emprunter les passages.', spawns: one('berserker_greffe'),
  strengths: 'Pression imprévisible.', weaknesses: 'Points de vie moyens.', counters: ['mante_corne', 'piege_machoires'] });
card('titan_ossuaire', { name: 'Titan Ossuaire', rarity: 'legendaire', faction: 'ossuaire', cost: 8, kind: 'unit', category: 'melee', role: 'Tank légendaire',
  description: 'Colosse d\'os qui se relève une fois puis s\'effondre en six osselets.', spawns: one('titan_ossuaire'),
  signature: 'Reliquaire : à sa première mort, se reconstitue avec 30 % de vie. À la seconde, libère 6 osselets.',
  strengths: 'Résistance hors norme.', weaknesses: 'Coûte 8 : une contre-poussée adverse est redoutable.', counters: ['sangsue_geante', 'vierge_mille_yeux', 'brume_terreur'] });
card('bouche_sans_fin', { name: 'La Bouche-sans-Fin', rarity: 'legendaire', faction: 'abysse', cost: 6, kind: 'unit', category: 'melee', role: 'Dévoreuse',
  description: 'Gueule abyssale qui engloutit d\'un coup une unité terrestre affaiblie.', spawns: one('bouche_sans_fin'),
  signature: 'Engloutir : toutes les 10 s, avale une unité terrestre proche ayant 700 PV ou moins (pas les bâtiments).',
  strengths: 'Supprime les menaces moyennes instantanément.', weaknesses: 'Lente ; volants et tirs l\'usent.', counters: ['oeil_aile', 'vouivre_rouillee', 'sangsue_geante'] });
card('ecorcheur_nocturne', { name: 'Écorcheur Nocturne', rarity: 'mythique', faction: 'chair', cost: 4, kind: 'unit', category: 'melee', role: 'Furtif',
  description: 'Invisible et inciblable tant qu\'il n\'attaque pas.', spawns: one('ecorcheur_nocturne'),
  strengths: 'Arrive intact au contact.', weaknesses: 'Les dégâts de zone le touchent quand même.', counters: ['pluie_bile', 'piege_machoires'] });
card('crabe_siege', { name: 'Crabe de Siège', rarity: 'rare', faction: 'abysse', cost: 4, kind: 'unit', category: 'melee', role: 'Balayeur',
  description: 'Ses pinces balayent une zone de 1,2 case.', spawns: one('crabe_siege'),
  strengths: 'Contre les essaims au sol.', weaknesses: 'Lent, sans défense anti-aérienne.', counters: ['essaim_mouches', 'sangsue_geante'] });
card('moissonneur_vertebres', { name: 'Moissonneur de Vertèbres', rarity: 'epique', faction: 'ossuaire', cost: 5, kind: 'unit', category: 'melee', role: 'Faucheur de zone',
  description: 'Grande faux d\'os : dégâts de zone de 1,5 case.', spawns: one('moissonneur_vertebres'),
  strengths: 'Nettoie les groupes au sol.', weaknesses: 'Volants.', counters: ['essaim_mouches', 'oeil_aile'] });
card('homoncule_vapeur', { name: 'Homoncules à Vapeur', rarity: 'commun', faction: 'rouille', cost: 3, kind: 'unit', category: 'melee', role: 'Trio explosif',
  description: 'Trois petits automates qui crachent leur vapeur en mourant.', spawns: one('homoncule_vapeur', 3),
  strengths: 'Valeur répartie, petite explosion à la mort.', weaknesses: 'Zones de dégâts.', counters: ['pluie_bile', 'moissonneur_vertebres'] });
card('chimere_suturee', { name: 'Chimère Suturée', rarity: 'mythique', faction: 'chair', cost: 5, kind: 'unit', category: 'melee', role: 'Trois têtes',
  description: 'Chaque morsure rebondit sur deux ennemis proches.', spawns: one('chimere_suturee'),
  strengths: 'Bonne contre les petits groupes.', weaknesses: 'Tanks et anti-tank.', counters: ['sangsue_geante', 'colosse_chair'] });
card('fouisseuse_chitineuse', { name: 'Fouisseuse Chitineuse', rarity: 'rare', faction: 'chitine', cost: 3, kind: 'unit', category: 'melee', role: 'Infiltration',
  description: 'Creuse sous la terre : se déploie n\'importe où, hors zone du roi adverse.', spawns: one('fouisseuse_chitineuse'), deployAnywhere: true,
  strengths: 'Attaque les tireurs à l\'arrière.', weaknesses: 'Stats modestes pour le coût.', counters: ['sentinelle_rouillee', 'mante_corne'] });
card('l_innommable', { name: "L'Innommable", rarity: 'abyssal', faction: 'abysse', cost: 8, kind: 'unit', category: 'melee', role: 'Horreur abyssale',
  description: 'Une chose sans forme qui attire et paralyse tout ce qui l\'approche.', spawns: one('l_innommable'),
  signature: 'Marée noire : toutes les 10 s, attire les ennemis à 4,5 cases, inflige 120 dégâts et les étourdit 0,6 s. Aura de peur permanente.',
  strengths: 'Contrôle de zone écrasant.', weaknesses: 'Coût de 8 et lenteur extrême ; les volants l\'ignorent.', counters: ['vouivre_rouillee', 'sangsue_geante', 'oeil_aile'] });
card('chevaucheur_scolopendre', { name: 'Chevaucheur de Scolopendre', rarity: 'mythique', faction: 'chitine', cost: 5, kind: 'unit', category: 'melee', role: 'Cavalier',
  description: 'Charge à pleine vitesse et double les dégâts du premier coup.', spawns: one('chevaucheur_scolopendre'),
  strengths: 'Percée rapide.', weaknesses: 'La charge est stoppée par l\'étourdissement.', counters: ['brume_terreur', 'osselets_rampants'] });

// --- Distance (12)
card('cracheur_acide', { name: "Cracheur d'Acide", rarity: 'commun', faction: 'chair', cost: 3, kind: 'unit', category: 'distance', role: 'Tireur corrosif',
  description: 'Projette de l\'acide qui empoisonne 2 s.', spawns: one('cracheur_acide'),
  strengths: 'Cible air et sol.', weaknesses: 'Fragile.', counters: ['salve_epines', 'bourreau_chitineux'] });
card('arbaletrier_os', { name: "Arbalétriers d'Os", rarity: 'commun', faction: 'ossuaire', cost: 3, kind: 'unit', category: 'distance', role: 'Duo de tir',
  description: 'Deux squelettes armés de carreaux en os.', spawns: one('arbaletrier_os', 2),
  strengths: 'Portée 5,5, air et sol.', weaknesses: 'Faible résistance.', counters: ['salve_epines', 'pluie_bile'] });
card('lanceuse_epines', { name: "Lanceuse d'Épines", rarity: 'rare', faction: 'chitine', cost: 4, kind: 'unit', category: 'distance', role: 'Tir perforant',
  description: 'Ses épines traversent tout sur une ligne de 7 cases.', spawns: one('lanceuse_epines'),
  strengths: 'Touche plusieurs cibles alignées.', weaknesses: 'Lente à recharger.', counters: ['bourreau_chitineux', 'meute_crocs'] });
card('bombardier_gonfle', { name: 'Bombardier Gonflé', rarity: 'rare', faction: 'chair', cost: 4, kind: 'unit', category: 'distance', role: 'Artillerie',
  description: 'Crache des sacs de bile explosifs à longue portée.', spawns: one('bombardier_gonfle'),
  strengths: 'Zone au sol à 6,5 cases.', weaknesses: 'Ne touche pas les volants.', counters: ['essaim_mouches', 'phalene_spectrale'] });
card('sorciere_vase', { name: 'Sorcière de Vase', rarity: 'epique', faction: 'abysse', cost: 5, kind: 'unit', category: 'distance', role: 'Ralentissement',
  description: 'Sa vase ralentit de 35 % les cibles touchées et leurs voisines.', spawns: one('sorciere_vase'),
  strengths: 'Contrôle de poussée.', weaknesses: 'Dégâts modestes.', counters: ['bourreau_chitineux', 'comete_rouille'] });
card('tourmenteur_electrique', { name: 'Tourmenteur Électrique', rarity: 'epique', faction: 'rouille', cost: 4, kind: 'unit', category: 'distance', role: 'Arc chaîné',
  description: 'Un arc électrique qui saute sur trois cibles supplémentaires.', spawns: one('tourmenteur_electrique'),
  strengths: 'Excellent contre les essaims.', weaknesses: 'Peu de dégâts sur une cible unique.', counters: ['charognard', 'golem_rivets'] });
card('fusilier_rivets', { name: 'Fusilier à Rivets', rarity: 'commun', faction: 'rouille', cost: 4, kind: 'unit', category: 'distance', role: 'Tireur longue portée',
  description: 'Tire des rivets brûlants à 6,5 cases.', spawns: one('fusilier_rivets'),
  strengths: 'Bonne portée et cadence.', weaknesses: 'Fragile.', counters: ['bourreau_chitineux', 'pluie_bile'] });
card('lance_cranes', { name: 'Lance-Crânes', rarity: 'rare', faction: 'ossuaire', cost: 5, kind: 'unit', category: 'distance', role: 'Zone + valeur',
  description: 'Lance des crânes explosifs et libère deux osselets en mourant.', spawns: one('lance_cranes'),
  strengths: 'Dégâts de zone fiables.', weaknesses: 'Pas d\'anti-aérien.', counters: ['oeil_aile', 'vouivre_rouillee'] });
card('chantre_noye', { name: 'Chantre Noyé', rarity: 'mythique', faction: 'abysse', cost: 4, kind: 'unit', category: 'distance', role: 'Étourdisseur',
  description: 'Chaque note étourdit sa cible 0,5 s et interrompt les charges.', spawns: one('chantre_noye'),
  strengths: 'Annule les montées en puissance.', weaknesses: 'Cadence lente.', counters: ['meute_crocs', 'bourreau_chitineux'] });
card('canonnier_vapeur', { name: 'Canonnier à Vapeur', rarity: 'epique', faction: 'rouille', cost: 6, kind: 'unit', category: 'distance', role: 'Siège à distance',
  description: 'Bombarde les bâtiments à 7 cases.', spawns: one('canonnier_vapeur'),
  strengths: 'Détruit les tours sans entrer à portée de mêlée.', weaknesses: 'Ignore les unités.', counters: ['bourreau_chitineux', 'meute_crocs'] });
card('vierge_mille_yeux', { name: 'La Vierge aux Mille Yeux', rarity: 'legendaire', faction: 'abysse', cost: 5, kind: 'unit', category: 'distance', role: 'Regard destructeur',
  description: 'Un rayon dont l\'intensité augmente tant que la cible reste fixée.', spawns: one('vierge_mille_yeux'),
  signature: 'Regard fixe : rayon ×1 → ×2,5 → ×6 après 2 s puis 4 s sur la même cible. Changer de cible réinitialise.',
  strengths: 'Annihile les tanks.', weaknesses: 'Essaims et étourdissements réinitialisent le regard.', counters: ['larve_rongeuse', 'chantre_noye', 'brume_terreur'] });
card('harponneur_noye', { name: 'Harponneur Noyé', rarity: 'commun', faction: 'abysse', cost: 3, kind: 'unit', category: 'distance', role: 'Harpon',
  description: 'Harponne les unités au sol à 6 cases et les ralentit.', spawns: one('harponneur_noye'),
  strengths: 'Longue portée, ralentit.', weaknesses: 'Pas d\'anti-aérien.', counters: ['essaim_mouches', 'oeil_aile'] });

// --- Volants & déplacement spécial (8)
card('essaim_mouches', { name: 'Essaim de Mouches-Os', rarity: 'commun', faction: 'chitine', cost: 3, kind: 'unit', category: 'aerien', role: 'Essaim volant',
  description: 'Cinq mouches à carapace d\'os qui piquent tout.', spawns: one('mouche_os', 5),
  strengths: 'Volantes, nombreuses.', weaknesses: 'Une salve suffit.', counters: ['salve_epines', 'tourmenteur_electrique'] });
card('oeil_aile', { name: 'Œil Ailé', rarity: 'rare', faction: 'abysse', cost: 3, kind: 'unit', category: 'aerien', role: 'Tireur volant',
  description: 'Un œil membraneux qui crache des éclats de rétine.', spawns: one('oeil_aile'),
  strengths: 'Hors de portée de la mêlée.', weaknesses: 'Peu de vie.', counters: ['arbaletrier_os', 'cracheur_acide'] });
card('vouivre_rouillee', { name: 'Vouivre Rouillée', rarity: 'epique', faction: 'rouille', cost: 5, kind: 'unit', category: 'aerien', role: 'Dragon de zone',
  description: 'Crache des scories en fusion sur une zone.', spawns: one('vouivre_rouillee'),
  strengths: 'Zone aérienne, solide.', weaknesses: 'Tirs anti-aériens concentrés.', counters: ['fusilier_rivets', 'tour_dards'] });
card('sac_spores', { name: 'Sac de Spores', rarity: 'epique', faction: 'chair', cost: 5, kind: 'unit', category: 'aerien', role: 'Bombardier aérien',
  description: 'Dérive vers les bâtiments et lâche des sacs explosifs (560 dégâts).', spawns: one('sac_spores'),
  strengths: 'Dévastateur s\'il atteint une tour.', weaknesses: 'Lent, sans défense.', counters: ['essaim_mouches', 'arbaletrier_os'] });
card('sauteur_marais', { name: 'Sauteur des Marais', rarity: 'rare', faction: 'abysse', cost: 3, kind: 'unit', category: 'aerien', role: 'Saut de rivière',
  description: 'Batracien difforme qui franchit la rivière d\'un bond.', spawns: one('sauteur_marais'),
  strengths: 'Ne dépend pas des passages.', weaknesses: 'Stats moyennes.', counters: ['mante_corne', 'sentinelle_rouillee'] });
card('wyrm_cendres', { name: 'Wyrm des Cendres', rarity: 'legendaire', faction: 'ossuaire', cost: 7, kind: 'unit', category: 'aerien', role: 'Dragon légendaire',
  description: 'Squelette ailé dont le souffle laisse des cendres brûlantes.', spawns: one('wyrm_cendres'),
  signature: 'Souffle de cendres : chaque 3e attaque laisse au sol une zone brûlante (90 dégâts/s pendant 4 s).',
  strengths: 'Tank volant à zone.', weaknesses: 'Coûteux, sensible aux anti-aériens concentrés.', counters: ['fusilier_rivets', 'vierge_mille_yeux', 'tour_dards'] });
card('phalene_spectrale', { name: 'Phalène Spectrale', rarity: 'mythique', faction: 'ossuaire', cost: 2, kind: 'unit', category: 'aerien', role: 'Harceleur volant',
  description: 'Rapide et volante, ses ailes poudreuses ralentissent les unités au sol.', spawns: one('phalene_spectrale'),
  strengths: 'Inatteignable pour la mêlée.', weaknesses: 'Peu de vie.', counters: ['arbaletrier_os', 'essaim_mouches'] });
card('meduse_celeste', { name: 'Méduse Céleste', rarity: 'epique', faction: 'abysse', cost: 4, kind: 'unit', category: 'aerien', role: 'Bombe flottante',
  description: 'À sa mort, éclate et étourdit 1 s tout ce qui l\'entoure.', spawns: one('meduse_celeste'),
  strengths: 'Punit les défenses groupées.', weaknesses: 'Dégâts faibles de son vivant.', counters: ['harponneur_noye', 'fusilier_rivets'] });

// --- Soutien / invocateurs / contrôle (8)
card('pretresse_sutures', { name: 'Prêtresse des Sutures', rarity: 'rare', faction: 'chair', cost: 4, kind: 'unit', category: 'support', role: 'Soigneuse',
  description: 'Recoud ses alliés : 70 PV/s dans un rayon de 3 cases.', spawns: one('pretresse_sutures'),
  strengths: 'Prolonge les poussées.', weaknesses: 'Cible prioritaire des assassins.', counters: ['bourreau_chitineux', 'comete_rouille'] });
card('reine_ruche', { name: 'Reine de la Ruche', rarity: 'legendaire', faction: 'chitine', cost: 6, kind: 'unit', category: 'support', role: 'Invocatrice légendaire',
  description: 'Pond deux drones volants toutes les 6 s en avançant.', spawns: one('reine_ruche'),
  signature: 'Ponte incessante : génère 2 drones volants toutes les 6 s tant qu\'elle vit.',
  strengths: 'Valeur croissante si ignorée.', weaknesses: 'Lente, cible au sol.', counters: ['sangsue_geante', 'tourmenteur_electrique', 'vierge_mille_yeux'] });
card('tambour_ossements', { name: "Tambour d'Ossements", rarity: 'epique', faction: 'ossuaire', cost: 4, kind: 'unit', category: 'support', role: 'Galvanisant',
  description: 'Son rythme accélère de 45 % les alliés proches (vitesse et attaque).', spawns: one('tambour_ossements'),
  strengths: 'Démultiplie une poussée.', weaknesses: 'Faibles dégâts propres.', counters: ['mante_corne', 'fusilier_rivets'] });
card('nourrice_larves', { name: 'Nourrice à Larves', rarity: 'rare', faction: 'chair', cost: 5, kind: 'unit', category: 'support', role: 'Invocatrice',
  description: 'Expulse deux larves toutes les 5 s.', spawns: one('nourrice_larves'),
  strengths: 'Flot continu d\'unités.', weaknesses: 'Zones de dégâts.', counters: ['tourmenteur_electrique', 'crabe_siege'] });
card('gardien_coquille', { name: 'Gardien-Coquille', rarity: 'epique', faction: 'abysse', cost: 5, kind: 'unit', category: 'support', role: 'Protecteur',
  description: 'Toutes les 6 s, accorde 200 PV de bouclier aux alliés proches.', spawns: one('gardien_coquille'),
  strengths: 'Protège les essaims des sorts légers.', weaknesses: 'Dégâts faibles.', counters: ['sangsue_geante', 'marais_putride'] });
card('pecheur_ames', { name: "Pêcheur d'Âmes", rarity: 'mythique', faction: 'abysse', cost: 4, kind: 'unit', category: 'support', role: 'Contrôle (crochet)',
  description: 'Lance un crochet qui ramène un ennemi au sol jusqu\'à lui (recharge 7 s).', spawns: one('pecheur_ames'),
  strengths: 'Arrache les menaces de leur voie.', weaknesses: 'Fragile au contact.', counters: ['bourreau_chitineux', 'meute_crocs'] });
card('semeur_spores', { name: 'Semeur de Spores', rarity: 'commun', faction: 'chitine', cost: 3, kind: 'unit', category: 'support', role: 'Aura toxique',
  description: 'Diffuse un nuage toxique : 35 dégâts/s aux ennemis à 2,2 cases.', spawns: one('semeur_spores'),
  strengths: 'Use les essaims en continu.', weaknesses: 'Tireurs à distance.', counters: ['fusilier_rivets', 'harponneur_noye'] });
card('liche_archiviste', { name: 'Liche Archiviste', rarity: 'mythique', faction: 'ossuaire', cost: 5, kind: 'unit', category: 'support', role: 'Nécromancienne',
  description: 'Relève un osselet à chaque mort d\'unité proche (une fois toutes les 1,5 s).', spawns: one('liche_archiviste'),
  strengths: 'Transforme les combats en armée.', weaknesses: 'Dégâts burst.', counters: ['comete_rouille', 'bourreau_chitineux'] });

// --- Sorts (7)
card('pluie_bile', { name: 'Pluie de Bile', rarity: 'commun', faction: 'chair', cost: 3, kind: 'spell', category: 'sort', role: 'Dégâts de zone',
  description: 'Averse corrosive : 260 dégâts sur 3 cases (35 % aux tours).',
  spell: { radius: 3, delay: 0.9, damage: 260, towerPct: 0.35 },
  strengths: 'Nettoie essaims et tireurs.', weaknesses: 'Délai d\'impact.', counters: ['gardien_coquille'] });
card('salve_epines', { name: "Salve d'Épines", rarity: 'commun', faction: 'chitine', cost: 2, kind: 'spell', category: 'sort', role: 'Sort rapide',
  description: 'Pluie instantanée d\'épines : 160 dégâts, repousse légèrement.',
  spell: { radius: 2.5, delay: 0.25, damage: 160, towerPct: 0.3, knockback: 1 },
  strengths: 'Réponse immédiate aux essaims.', weaknesses: 'Dégâts faibles.', counters: ['gardien_coquille'] });
card('brume_terreur', { name: 'Brume de Terreur', rarity: 'rare', faction: 'abysse', cost: 3, kind: 'spell', category: 'sort', role: 'Peur (étourdissement)',
  description: 'Paralyse de peur toutes les unités ennemies dans la zone pendant 2,5 s.',
  spell: { radius: 3, delay: 0.2, damage: 60, towerPct: 0.3, stun: 2.5 },
  strengths: 'Interrompt charges, regards et rayons.', weaknesses: 'Peu de dégâts.', counters: [] });
card('marais_putride', { name: 'Marais Putride', rarity: 'epique', faction: 'chair', cost: 4, kind: 'spell', category: 'sort', role: 'Poison',
  description: 'Zone empoisonnée 6 s : 75 dégâts/s et ralentissement de 15 %.',
  spell: { radius: 3.5, delay: 0.2, duration: 6, dps: 75, slow: 0.15, towerPct: 0.35 },
  strengths: 'Dégâts totaux élevés, contrôle de zone.', weaknesses: 'Lent à agir.', counters: ['pretresse_sutures'] });
card('sceau_os', { name: "Sceau d'Os", rarity: 'rare', faction: 'ossuaire', cost: 3, kind: 'spell', category: 'sort', role: 'Bouclier & soin',
  description: 'Bénit les alliés de la zone : 150 PV soignés et 400 PV de bouclier.',
  spell: { radius: 3.5, delay: 0.1, heal: 150, shield: 400, affects: 'allies' },
  strengths: 'Sauve une poussée.', weaknesses: 'Aucun dégât.', counters: [] });
card('fosse_vorace', { name: 'Fosse Vorace', rarity: 'epique', faction: 'abysse', cost: 4, kind: 'spell', category: 'sort', role: 'Vortex',
  description: 'Ouvre une fosse qui aspire les ennemis 3 s puis se referme (250 dégâts).',
  spell: { radius: 4, delay: 0.2, duration: 3, pull: 2.2, dps: 40, damage: 250, towerPct: 0.3 },
  strengths: 'Regroupe pour vos dégâts de zone.', weaknesses: 'N\'affecte pas les bâtiments.', counters: [] });
card('comete_rouille', { name: 'Comète de Rouille', rarity: 'legendaire', faction: 'rouille', cost: 6, kind: 'spell', category: 'sort', role: 'Frappe orbitale',
  description: 'Une comète de fer rouillé s\'écrase après 1,8 s : 640 dégâts et cratère brûlant.',
  signature: 'Cratère : laisse une zone brûlante 4 s (60 dégâts/s).',
  spell: { radius: 2.8, delay: 1.8, damage: 640, towerPct: 0.25, crater: { dps: 60, duration: 4 } },
  strengths: 'Achève tours et unités coûteuses.', weaknesses: 'Très coûteux, délai lisible.', counters: [] });

// --- Bâtiments & pièges (5)
card('tour_dards', { name: 'Tour à Dards', rarity: 'commun', faction: 'chitine', cost: 3, kind: 'building', category: 'batiment', role: 'Défense',
  description: 'Tourelle organique qui tire des dards (30 s).', spawns: one('tour_dards'),
  strengths: 'Attire les tanks de siège.', weaknesses: 'Se décompose avec le temps.', counters: ['canonnier_vapeur', 'comete_rouille'] });
card('nid_larves', { name: 'Nid de Larves', rarity: 'rare', faction: 'chair', cost: 5, kind: 'building', category: 'batiment', role: 'Générateur',
  description: 'Cocon pulsant qui libère 2 larves toutes les 6 s (40 s).', spawns: one('nid_larves'),
  strengths: 'Pression et défense continues.', weaknesses: 'Zones et sièges.', counters: ['canonnier_vapeur', 'tourmenteur_electrique'] });
card('brasier_ossements', { name: "Brasier d'Ossements", rarity: 'epique', faction: 'ossuaire', cost: 5, kind: 'building', category: 'batiment', role: 'Défense de zone',
  description: 'Bûcher d\'os qui projette des braises sur une zone (35 s).', spawns: one('brasier_ossements'),
  strengths: 'Nettoie les essaims au sol.', weaknesses: 'Pas d\'anti-aérien.', counters: ['essaim_mouches', 'sac_spores'] });
card('piege_machoires', { name: 'Piège à Mâchoires', rarity: 'rare', faction: 'rouille', cost: 2, kind: 'building', category: 'batiment', role: 'Piège caché',
  description: 'Invisible : se referme sur le premier ennemi au sol (600 dégâts, immobilise 2,5 s).', spawns: one('piege_machoires'),
  strengths: 'Surprend les charges et assassins.', weaknesses: 'Ignore les volants.', counters: ['essaim_mouches', 'phalene_spectrale'] });
card('puits_essence', { name: "Puits d'Essence", rarity: 'epique', faction: 'abysse', cost: 6, kind: 'building', category: 'batiment', role: 'Économie',
  description: 'Pompe l\'essence des abysses : +1 essence toutes les 8,5 s (60 s).', spawns: one('puits_essence'),
  strengths: 'Rentabilisé après 51 s.', weaknesses: 'Investissement risqué.', counters: ['canonnier_vapeur', 'comete_rouille'] });

export const CARDS: CardDef[] = CARD_LIST;
export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((c) => [c.id, c]));

export function getCard(id: string): CardDef {
  const c = CARD_MAP[id];
  if (!c) throw new Error(`Carte inconnue : ${id}`);
  return c;
}
export function getUnit(id: string): UnitDef {
  const u = UNITS[id];
  if (!u) throw new Error(`Unité inconnue : ${id}`);
  return u;
}

/** Unité « vitrine » d'une carte (pour l'illustration). */
export function cardPrimaryUnit(c: CardDef): UnitDef | null {
  return c.spawns && c.spawns.length ? getUnit(c.spawns[0].unit) : null;
}
