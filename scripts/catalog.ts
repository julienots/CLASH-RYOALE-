// Génère docs/CARTES.md : fiche complète des 70 cartes à partir des données du jeu.
import { writeFileSync } from 'node:fs';
import { CARDS, FACTION_PALETTE, getUnit } from '../src/core/cards';
import { RARITY_INFO, fragmentsToUpgrade, goldToUpgrade } from '../src/core/progression';
import { abilityTextPlain } from './abilityText';

const CAT: Record<string, string> = { melee: 'Mêlée / tank', distance: 'Distance', aerien: 'Aérien / spécial', support: 'Soutien / contrôle', sort: 'Sort', batiment: 'Bâtiment / piège' };
const TGT: Record<string, string> = { ground: 'sol', air: 'air', both: 'air + sol', buildings: 'bâtiments' };
let md = `# Catalogue des cartes SUPERESSENCE\n\nDocument généré automatiquement par \`npx vite-node scripts/catalog.ts\` à partir de \`src/core/cards.ts\`.\nStatistiques au **niveau de puissance de référence 9** ; chaque niveau supplémentaire multiplie PV et dégâts par 1,08.\n\n`;
const counts: Record<string, number> = {};
for (const c of CARDS) counts[c.category] = (counts[c.category] ?? 0) + 1;
md += `**${CARDS.length} cartes** — ${Object.entries(counts).map(([k, v]) => `${CAT[k]} : ${v}`).join(' · ')}\n\n`;
md += `| # | ID | Nom | Rareté | Faction | Coût | Catégorie | Rôle |\n|---|---|---|---|---|---|---|---|\n`;
CARDS.forEach((c, i) => { md += `| ${i + 1} | \`${c.id}\` | ${c.name} | ${RARITY_INFO[c.rarity].label} | ${FACTION_PALETTE[c.faction].label} | ${c.cost} | ${CAT[c.category]} | ${c.role} |\n`; });
md += '\n';
for (const c of CARDS) {
  md += `## ${c.name} (\`${c.id}\`)\n\n`;
  md += `- **Rareté** : ${RARITY_INFO[c.rarity].label} · **Faction** : ${FACTION_PALETTE[c.faction].label} · **Coût** : ${c.cost} essence · **Catégorie** : ${CAT[c.category]} · **Rôle** : ${c.role}\n`;
  md += `- **Description** : ${c.description}\n`;
  if (c.signature) md += `- **Capacité signature** : ${c.signature}\n`;
  if (c.spell) {
    const s = c.spell;
    md += `- **Effet** : rayon ${s.radius}, délai ${s.delay} s${s.damage ? `, ${s.damage} dégâts` : ''}${s.dps ? `, ${s.dps} dégâts/s` : ''}${s.duration ? ` pendant ${s.duration} s` : ''}${s.stun ? `, étourdit ${s.stun} s` : ''}${s.slow ? `, ralentit ${s.slow * 100} %` : ''}${s.pull ? ', attraction' : ''}${s.heal ? `, soin ${s.heal}` : ''}${s.shield ? `, bouclier ${s.shield}` : ''}${s.towerPct ? `, ${Math.round(s.towerPct * 100)} % aux tours` : ''}${s.crater ? `, cratère ${s.crater.dps}/s ${s.crater.duration} s` : ''}\n`;
    md += `- **Déploiement** : n’importe où dans l’arène\n`;
  } else {
    for (const sp of c.spawns!) {
      const u = getUnit(sp.unit);
      md += `- **Invoque** : ${sp.count} × ${u.name} — PV ${u.hp}${u.shield ? ` (+${u.shield} bouclier)` : ''}, dégâts ${u.damage}, cadence ${u.hitSpeed} s, portée ${u.range}, vitesse ${u.speed}, acquisition ${u.sight}, cible : ${TGT[u.targets]}${u.splash ? `, zone ${u.splash}` : ''}${u.flying ? ', volant' : ''}${u.lifetime ? `, durée de vie ${u.lifetime} s` : ''}\n`;
      for (const a of u.abilities ?? []) md += `  - ${abilityTextPlain(a)}\n`;
      md += `- **Visuel** : plan « ${u.visual.plan} », échelle ${u.visual.scale}, ${u.visual.eyes} yeux, ${u.visual.limbs} membres, ${u.visual.spikes} épines, ${u.visual.tentacles} tentacules, ${u.visual.horns} cornes (illustration et unité générées par le même modèle)\n`;
    }
    md += `- **Déploiement** : ${c.deployAnywhere ? 'n’importe où sauf à moins de 4,5 cases du Cœur-Roi adverse' : 'propre camp (+ poche avancée après chute d’une tour adverse)'}\n`;
  }
  md += `- **Forces** : ${c.strengths}\n- **Faiblesses** : ${c.weaknesses}\n`;
  if (c.counters.length) md += `- **Contres** : ${c.counters.map((k) => CARDS.find((x) => x.id === k)!.name).join(', ')}\n`;
  const max = RARITY_INFO[c.rarity].maxLevel;
  const ups = [];
  for (let l = 1; l < max; l++) ups.push(`${l}→${l + 1} : ${fragmentsToUpgrade(c.rarity, l)} fr. + ${goldToUpgrade(c.rarity, l)} or`);
  md += `- **Progression** : niveaux 1 à ${max} (puissance ${RARITY_INFO[c.rarity].startPower} à ${RARITY_INFO[c.rarity].startPower + max - 1}). ${ups.join(' · ')}\n\n`;
}
writeFileSync('docs/CARTES.md', md);
console.log('docs/CARTES.md écrit,', CARDS.length, 'cartes');
