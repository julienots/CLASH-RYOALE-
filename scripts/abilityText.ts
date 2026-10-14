// Version texte des capacités (sans dépendance au DOM) pour la documentation générée.
import { getUnit } from '../src/core/cards';
import type { Ability } from '../src/core/types';
export function abilityTextPlain(a: Ability): string {
  const u = (id: string) => getUnit(id).name;
  switch (a.type) {
    case 'charge': return `Charge après ${a.distance} cases : vitesse ×${a.speedMult}, coup ×${a.mult}`;
    case 'deathSpawn': return `À la mort : ${a.count} × ${u(a.unit)}`;
    case 'deathBlast': return `À la mort : explosion ${a.damage} (rayon ${a.radius})${a.stun ? `, étourdit ${a.stun} s` : ''}`;
    case 'spawner': return `Génère ${a.count} × ${u(a.unit)} toutes les ${a.interval} s`;
    case 'aura': return `Aura ${a.effect} ${a.value} (rayon ${a.radius})`;
    case 'shieldPulse': return `Bouclier ${a.amount} aux alliés toutes les ${a.interval} s (rayon ${a.radius})`;
    case 'rampUp': return `Montée en puissance ×${a.stages.join('/×')} (paliers de ${a.stageTime} s)`;
    case 'slowOnHit': return `Ralentit ${a.amount * 100} % pendant ${a.duration} s`;
    case 'stunOnHit': return `Étourdit ${a.duration} s`;
    case 'poisonOnHit': return `Poison ${a.dps}/s pendant ${a.duration} s`;
    case 'chain': return `Chaîne ${a.jumps} rebonds (rayon ${a.radius})`;
    case 'lifesteal': return `Vol de vie ${a.pct * 100} %`;
    case 'riverLeap': return 'Saute la rivière';
    case 'burrow': return 'Fouisseur';
    case 'stealth': return 'Furtif hors attaque';
    case 'enrage': return `Rage sous ${a.threshold * 100} % PV`;
    case 'pierce': return `Perforant (${a.length} cases)`;
    case 'thorns': return `Épines ${a.pct * 100} %`;
    case 'reviveOnce': return `Résurrection unique à ${a.hpPct * 100} %`;
    case 'dash': return `Bond ${a.min}–${a.max} cases (recharge ${a.cooldown} s)`;
    case 'kamikaze': return 'Explose au contact';
    case 'devour': return `Engloutit ≤ ${a.maxHp} PV toutes les ${a.interval} s`;
    case 'hook': return `Crochet ${a.range} cases (recharge ${a.cooldown} s)`;
    case 'raiseDead': return `Relève ${u(a.unit)} (recharge ${a.cooldown} s, rayon ${a.radius})`;
    case 'tidePull': return `Marée : attraction rayon ${a.radius}, ${a.damage} dégâts, étourdit ${a.stun} s, toutes les ${a.interval} s`;
    case 'burnTrail': return `Zone brûlante ${a.dps}/s toutes les ${a.every} attaques`;
    case 'essencePump': return `+${a.amount} essence / ${a.interval} s`;
    case 'trap': return `Piège : ${a.damage} dégâts, immobilise ${a.root} s`;
  }
}
