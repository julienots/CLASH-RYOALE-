// Collection (filtres), construction de deck et fiche détaillée de carte.
import { CARDS, CARD_MAP, FACTION_PALETTE, getUnit } from '../../core/cards';
import { powerLevel, RARITIES, RARITY_INFO, statMultiplier } from '../../core/progression';
import type { Ability, CardDef, Category, Faction, Rarity, UnitDef } from '../../core/types';
import { averageCost, deckProblems, setDeckCard, upgradeCard, upgradeInfo } from '../../meta/economy';
import { drawCachedMonster } from '../../render/spriteCache';
import { cardArtUrl } from '../../render/cardArt';
import { registerScreen } from '../app';
import { add, cardTile, confirmDialog, fmt, h, rarityChip, toast } from '../dom';
import { audio } from '../../audio/audio';

const CATEGORY_LABEL: Record<Category, string> = { melee: 'Mêlée / tank', distance: 'Distance', aerien: 'Aérien / spécial', support: 'Soutien / contrôle', sort: 'Sort', batiment: 'Bâtiment / piège' };
const TARGET_LABEL = { ground: 'Sol', air: 'Air', both: 'Air et sol', buildings: 'Bâtiments' };

let filters = { rarity: 'all', cost: 'all', category: 'all', faction: 'all', owned: 'all', sort: 'cost' };

export function abilityText(a: Ability): string {
  switch (a.type) {
    case 'charge': return `Charge : après ${a.distance} cases, vitesse ×${a.speedMult} et coup ×${a.mult}.`;
    case 'deathSpawn': return `À la mort : invoque ${a.count} × ${getUnit(a.unit).name}.`;
    case 'deathBlast': return `À la mort : explosion de ${a.damage} dégâts (rayon ${a.radius})${a.stun ? `, étourdit ${a.stun} s` : ''}.`;
    case 'spawner': return `Invoque ${a.count} × ${getUnit(a.unit).name} toutes les ${a.interval} s.`;
    case 'aura': return a.effect === 'heal' ? `Aura de soin : ${a.value} PV/s (rayon ${a.radius}).` : a.effect === 'haste' ? `Aura de frénésie : alliés +${Math.round((a.value - 1) * 100)} % de vitesse (rayon ${a.radius}).` : a.effect === 'fear' ? `Aura de peur : ennemis −${Math.round(a.value * 100)} % de vitesse et cadence (rayon ${a.radius}).` : `Aura toxique : ${a.value} dégâts/s (rayon ${a.radius}).`;
    case 'shieldPulse': return `Toutes les ${a.interval} s : bouclier de ${a.amount} PV aux alliés (rayon ${a.radius}).`;
    case 'rampUp': return `Montée en puissance : dégâts ×${a.stages.join(' → ×')} (palier toutes les ${a.stageTime} s sur la même cible).`;
    case 'slowOnHit': return `Ralentit de ${Math.round(a.amount * 100)} % pendant ${a.duration} s.`;
    case 'stunOnHit': return `Étourdit ${a.duration} s à chaque coup.`;
    case 'poisonOnHit': return `Empoisonne : ${a.dps} dégâts/s pendant ${a.duration} s.`;
    case 'chain': return `Chaîne : rebondit sur ${a.jumps} cibles (rayon ${a.radius}, 80 % des dégâts).`;
    case 'lifesteal': return `Vol de vie : ${Math.round(a.pct * 100)} % des dégâts.`;
    case 'riverLeap': return 'Bondit par-dessus la rivière.';
    case 'burrow': return 'Se déploie sous terre.';
    case 'stealth': return 'Invisible et inciblable hors attaque (les sorts de zone le touchent).';
    case 'enrage': return `Rage sous ${Math.round(a.threshold * 100)} % de PV : cadence et vitesse accrues.`;
    case 'pierce': return `Projectile perforant sur ${a.length} cases.`;
    case 'thorns': return `Épines : renvoie ${Math.round(a.pct * 100)} % des dégâts de mêlée.`;
    case 'reviveOnce': return `Se relève une fois avec ${Math.round(a.hpPct * 100)} % de PV.`;
    case 'dash': return `Bond sur une cible entre ${a.min} et ${a.max} cases (recharge ${a.cooldown} s).`;
    case 'kamikaze': return 'Explose au contact (meurt en attaquant).';
    case 'devour': return `Engloutit une unité terrestre ≤ ${a.maxHp} PV toutes les ${a.interval} s.`;
    case 'hook': return `Crochet : attire un ennemi au sol jusqu’à ${a.range} cases (recharge ${a.cooldown} s).`;
    case 'raiseDead': return `Relève un ${getUnit(a.unit).name} à chaque mort proche (recharge ${a.cooldown} s).`;
    case 'tidePull': return `Toutes les ${a.interval} s : attire les ennemis (rayon ${a.radius}), ${a.damage} dégâts, étourdit ${a.stun} s.`;
    case 'burnTrail': return `Toutes les ${a.every} attaques : zone brûlante ${a.dps} dégâts/s pendant ${a.duration} s.`;
    case 'essencePump': return `+${a.amount} essence toutes les ${a.interval} s.`;
    case 'trap': return `Piège : ${a.damage} dégâts (rayon ${a.radius}) et immobilise ${a.root} s.`;
  }
}

function obtainText(c: CardDef): string {
  if (c.rarity === 'legendaire' || c.rarity === 'abyssal') return 'Coffre Légendaire (boutique, SUPER PASS premium, Marée Abyssale), rare dans les coffres de combat.';
  if (c.rarity === 'mythique') return 'Coffres de Chair, de Chitine et des Abysses ; offres quotidiennes ; SUPER PASS.';
  if (c.rarity === 'epique') return 'Reliquaire de Chitine (garantie), Coffre des Abysses ; offres quotidiennes.';
  return 'Tous les coffres, offrande gratuite et offres quotidiennes de la boutique.';
}

/** Lignes de statistiques avec comparaison avant/après amélioration. */
function statRows(card: CardDef, power: number, nextPower: number | null): HTMLElement[] {
  const m = statMultiplier(power), n = nextPower ? statMultiplier(nextPower) : null;
  const rows: [string, number | string, number | null][] = [];
  const num = (label: string, v: number) => rows.push([label, Math.round(v * m), n ? Math.round(v * n) : null]);
  const txt = (label: string, v: string) => rows.push([label, v, null]);
  if (card.spell) {
    const s = card.spell;
    if (s.damage) num('Dégâts', s.damage);
    if (s.dps) num('Dégâts / s', s.dps);
    if (s.heal) num('Soin', s.heal);
    if (s.shield) num('Bouclier', s.shield);
    txt('Rayon', `${s.radius} cases`);
    if (s.duration) txt('Durée', `${s.duration} s`);
    if (s.stun) txt('Étourdissement', `${s.stun} s`);
    if (s.towerPct) txt('Dégâts aux tours', `${Math.round(s.towerPct * 100)} %`);
    txt('Délai d’impact', `${s.delay} s`);
  } else {
    const u = getUnit(card.spawns![0].unit);
    num('Points de vie', u.hp);
    if (u.shield) num('Bouclier', u.shield);
    if (u.damage) num('Dégâts', u.damage);
    if (u.damage) num('Dégâts / s', u.damage / u.hitSpeed);
    txt('Vitesse d’attaque', `${u.hitSpeed} s`);
    txt('Portée', u.range < 1.2 ? 'Mêlée' : `${u.range} cases`);
    if (u.speed) txt('Vitesse', u.speed >= 1.6 ? 'Très rapide' : u.speed >= 1.3 ? 'Rapide' : u.speed >= 1 ? 'Moyenne' : 'Lente');
    txt('Acquisition', `${u.sight} cases`);
    txt('Cibles', TARGET_LABEL[u.targets]);
    if (u.splash) txt('Zone', `${u.splash} cases`);
    if (u.flying) txt('Déplacement', 'Volant');
    if (u.lifetime) txt('Durée de vie', `${u.lifetime} s`);
    txt('Nombre', `×${card.spawns![0].count}`);
  }
  return rows.flatMap(([l, v, nx]) => [h('span', null, l), h('b', null, typeof v === 'number' ? fmt(v) : v), h('span', { class: 'up' }, nx !== null && typeof v === 'number' ? `+${fmt(nx - v)}` : '')]);
}

/** Aperçu animé de l'unité (repos → marche → attaque). */
function animatedPreview(u: UnitDef): HTMLCanvasElement {
  const c = h('canvas', { style: 'width:100%;height:150px;border-radius:12px;background:radial-gradient(#2a1a22,#0c070a)' });
  let raf = 0; const t0 = performance.now();
  const draw = (now: number) => {
    if (!c.isConnected && now - t0 > 500) { cancelAnimationFrame(raf); return; }
    const t = (now - t0) / 1000;
    const r = c.getBoundingClientRect();
    if (r.width && c.width !== Math.round(r.width * 2)) { c.width = Math.round(r.width * 2); c.height = 300; }
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    const phase = Math.floor(t / 2.5) % 3;
    const moving = phase === 1;
    const attack = phase === 2 ? ((t % 1.2) / 1.2 < 0.5 ? ((t % 1.2) / 1.2) * 2 : 0) : 0;
    const x = moving ? c.width / 2 + Math.sin(t * 1.5) * c.width * 0.15 : c.width / 2;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x, 250, 70 * u.visual.scale, 18, 0, 0, Math.PI * 2); g.fill();
    drawCachedMonster(g, u.visual, x, 250, Math.min(110, 150 / Math.max(1, u.visual.scale * (u.flying ? 1.3 : 1))), t, moving, attack, moving && Math.cos(t * 1.5) < 0);
    g.fillStyle = '#9a8d8f'; g.font = '22px system-ui'; g.fillText(['Repos', 'Déplacement', 'Attaque'][phase], 16, 32);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return c;
}

registerScreen('card', (app, root, params) => {
  const id = params.id as string;
  const card = CARD_MAP[id];
  const render = () => {
    const s = app.game.data;
    const own = s.collection[id];
    const r = RARITY_INFO[card.rarity];
    const info = upgradeInfo(s, id);
    const power = powerLevel(card.rarity, own.level);
    const nextPower = info.maxed ? null : powerLevel(card.rarity, own.level + 1);
    const u = card.spawns ? getUnit(card.spawns[0].unit) : null;
    const pal = FACTION_PALETTE[card.faction];
    root.innerHTML = '';
    add(root, 
      h('div', { class: 'section-title' }, h('button', { class: 'btn small', onclick: () => app.back() }, '← Retour'), h('span')),
      h('div', { class: 'row', style: 'align-items:flex-start;gap:12px' },
        h('div', { style: 'width:42%' }, h('div', { class: 'detail-art', style: `--rc:${r.color};background-image:url(${cardArtUrl(id, 360, 450)})` })),
        h('div', { class: 'col grow' },
          h('h2', { style: `color:${r.glow}` }, card.name),
          h('div', null, rarityChip(card.rarity), h('span', { class: 'tag', style: `border-color:${pal.c3}` }, pal.label), h('span', { class: 'tag' }, CATEGORY_LABEL[card.category]), h('span', { class: 'tag' }, card.role)),
          h('div', { class: 'row' }, h('i', { class: 'ico ess' }), h('b', null, `${card.cost} essence`)),
          own.owned ? h('div', null, h('b', null, `Niveau ${own.level}`), h('span', { class: 'muted small' }, ` / ${r.maxLevel} · puissance ${power}`)) : h('div', { class: 'tag', style: 'border-color:#c43c41' }, '🔒 Non débloquée'),
          own.owned && !info.maxed ? h('div', { class: 'small' }, `Fragments : ${own.fragments} / ${info.fragmentsNeeded}`, h('div', { class: 'prog ok', style: 'margin-top:3px' }, h('i', { style: `width:${Math.min(100, (own.fragments / info.fragmentsNeeded) * 100)}%` }))) : null,
        )),
      h('p', null, card.description),
      card.signature ? h('div', { class: 'sig' }, h('b', { style: 'color:var(--gold)' }, 'Capacité signature — '), card.signature) : null,
      u?.abilities?.length ? h('div', { class: 'panel', style: 'margin-top:10px' }, h('h3', null, 'Capacités'), h('ul', { style: 'margin:6px 0 0;padding-left:18px' }, u.abilities.map((a) => h('li', { class: 'small' }, abilityText(a))))) : null,
      card.deployAnywhere ? h('div', { class: 'small', style: 'margin-top:6px' }, '⛏ Déploiement : n’importe où sauf près du Cœur-Roi adverse.') : h('div', { class: 'small muted', style: 'margin-top:6px' }, card.kind === 'spell' ? 'Déploiement : n’importe où dans l’arène.' : 'Déploiement : dans votre camp (et dans la poche avancée après la chute d’une tour adverse).'),
      u ? h('div', { style: 'margin-top:10px' }, animatedPreview(u)) : null,
      h('div', { class: 'panel', style: 'margin-top:10px' },
        h('div', { class: 'row' }, h('h3', { class: 'grow' }, 'Statistiques'), !info.maxed ? h('span', { class: 'small up', style: 'color:var(--ok)' }, `Niveau ${own.level + 1}`) : h('span', { class: 'small muted' }, 'Niveau max')),
        h('div', { class: 'stats', style: 'margin-top:6px' }, statRows(card, power, own.owned ? nextPower : null))),
      h('div', { class: 'panel' },
        h('div', { class: 'small' }, h('b', null, 'Forces : '), card.strengths),
        h('div', { class: 'small', style: 'margin-top:4px' }, h('b', null, 'Faiblesses : '), card.weaknesses),
        card.counters.length ? h('div', { style: 'margin-top:8px' }, h('div', { class: 'small muted' }, 'Contres efficaces :'),
          h('div', { class: 'cards', style: 'grid-template-columns:repeat(5,1fr);margin-top:4px' }, card.counters.map((k) => cardTile(k, s.collection[k], { onclick: () => app.go('card', { id: k }) })))) : null,
        h('div', { class: 'small', style: 'margin-top:8px' }, h('b', null, 'Obtention : '), obtainText(card)),
      ),
      own.owned ? h('div', { class: 'row', style: 'margin-top:12px' },
        h('button', { class: 'btn grow', onclick: () => app.go('deck', { pick: id }) }, 'Ajouter au deck'),
        h('button', { class: 'btn gold grow', disabled: !info.canUpgrade, onclick: async () => {
          if (info.goldNeeded >= 1000 && !(await confirmDialog('Améliorer ?', `Dépenser ${fmt(info.goldNeeded)} or et ${info.fragmentsNeeded} fragments pour passer ${card.name} au niveau ${own.level + 1} ?`, 'Améliorer', 'gold'))) return;
          const res = app.game.transact((st) => upgradeCard(st, id));
          if (!res.ok) return toast(res.reason!, true);
          audio.play('reward');
          toast(`${card.name} passe au niveau ${app.game.data.collection[id].level} !`);
          for (const l of res.value ?? []) toast(`Niveau de compte ${l.level} !`);
          render();
        } }, info.maxed ? 'Niveau maximal' : h('span', { class: 'row', style: 'justify-content:center;gap:4px' }, 'Améliorer ', h('i', { class: 'ico gold' }), fmt(info.goldNeeded))),
      ) : null,
    );
  };
  render();
});

registerScreen('collection', (app, root) => {
  const render = () => {
    const s = app.game.data;
    const sel = (key: keyof typeof filters, opts: [string, string][]) => {
      const el = h('select', null, opts.map(([v, l]) => h('option', { value: v, selected: filters[key] === v }, l)));
      el.addEventListener('change', () => { filters = { ...filters, [key]: el.value }; render(); });
      return el;
    };
    let list = CARDS.filter((c) =>
      (filters.rarity === 'all' || c.rarity === filters.rarity) &&
      (filters.cost === 'all' || (filters.cost === '6+' ? c.cost >= 6 : c.cost === Number(filters.cost))) &&
      (filters.category === 'all' || c.category === filters.category) &&
      (filters.faction === 'all' || c.faction === filters.faction) &&
      (filters.owned === 'all' || (filters.owned === 'owned' ? s.collection[c.id].owned : filters.owned === 'locked' ? !s.collection[c.id].owned : upgradeInfo(s, c.id).canUpgrade)));
    list = list.slice().sort((a, b) => filters.sort === 'rarity' ? RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity) || a.cost - b.cost : filters.sort === 'name' ? a.name.localeCompare(b.name) : a.cost - b.cost || RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity));
    const owned = CARDS.filter((c) => s.collection[c.id].owned).length;
    root.innerHTML = '';
    add(root, 
      h('div', { class: 'tabs' }, h('button', { class: 'on' }, `Collection ${owned}/${CARDS.length}`), h('button', { onclick: () => app.go('deck') }, 'Decks')),
      h('div', { class: 'filters' },
        sel('rarity', [['all', 'Toutes raretés'], ...RARITIES.map((r) => [r, RARITY_INFO[r as Rarity].label] as [string, string])]),
        sel('cost', [['all', 'Tous coûts'], ...['1', '2', '3', '4', '5'].map((c) => [c, `${c} essence`] as [string, string]), ['6+', '6+ essence']]),
        sel('category', [['all', 'Tous rôles'], ...(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => [c, CATEGORY_LABEL[c]] as [string, string])]),
        sel('faction', [['all', 'Toutes factions'], ...(Object.keys(FACTION_PALETTE) as Faction[]).map((f) => [f, FACTION_PALETTE[f].label] as [string, string])]),
        sel('owned', [['all', 'Toutes'], ['owned', 'Possédées'], ['locked', 'À débloquer'], ['upgrade', 'Améliorables']]),
        sel('sort', [['cost', 'Tri : coût'], ['rarity', 'Tri : rareté'], ['name', 'Tri : nom']]),
      ),
      list.length ? h('div', { class: 'cards' }, list.map((c) => cardTile(c.id, s.collection[c.id], { showLevel: true, showProgress: true, onclick: () => app.go('card', { id: c.id }) })))
        : h('div', { class: 'panel center muted' }, 'Aucune carte ne correspond à ces filtres.'),
    );
  };
  render();
});

registerScreen('deck', (app, root, params) => {
  let slot = -1;
  let pick = (params.pick as string | undefined) ?? null;
  const render = () => {
    const s = app.game.data;
    const deck = s.decks[s.activeDeck];
    const probs = deckProblems(s, deck);
    root.innerHTML = '';
    add(root, 
      h('div', { class: 'tabs' }, h('button', { onclick: () => app.go('collection') }, 'Collection'), h('button', { class: 'on' }, 'Decks')),
      h('div', { class: 'tabs' }, [0, 1, 2].map((i) => h('button', { class: s.activeDeck === i ? 'on' : '', onclick: () => { app.game.transact((st) => { st.activeDeck = i; return { ok: true }; }); slot = -1; render(); } }, `Deck ${i + 1}`))),
      pick ? h('div', { class: 'panel', style: 'border-color:var(--gold)' }, h('b', null, `Choisissez l’emplacement pour ${CARD_MAP[pick].name}`), h('button', { class: 'btn small', style: 'float:right', onclick: () => { pick = null; render(); } }, 'Annuler')) : null,
      h('div', { class: 'row', style: 'margin:8px 0' }, h('span', { class: 'grow' }, `Coût moyen : `, h('b', null, averageCost(deck).toFixed(1))), probs.length ? h('span', { style: 'color:var(--blood)' }, probs[0]) : h('span', { style: 'color:var(--ok)' }, '✔ Deck valide')),
      h('div', { class: 'deck-slots' }, deck.map((id, i) => cardTile(id, s.collection[id], { showLevel: true, extraClass: slot === i ? 'sel' : '', onclick: () => {
        if (pick) {
          const r = app.game.transact((st) => setDeckCard(st, st.activeDeck, i, pick!));
          if (!r.ok) toast(r.reason!, true);
          pick = null; slot = -1; render(); return;
        }
        slot = slot === i ? -1 : i; render();
      } }))),
      h('p', { class: 'small muted' }, slot >= 0 ? `Touchez une carte ci-dessous pour remplacer ${CARD_MAP[deck[slot]].name}.` : 'Touchez un emplacement puis une carte pour la remplacer. Touchez une carte du deck deux fois pour voir sa fiche.'),
      slot >= 0 ? h('button', { class: 'btn small', onclick: () => app.go('card', { id: deck[slot] }) }, `Voir la fiche de ${CARD_MAP[deck[slot]].name}`) : null,
      h('div', { class: 'section-title' }, h('h3', null, 'Cartes disponibles')),
      h('div', { class: 'cards' }, CARDS.filter((c) => s.collection[c.id].owned && !deck.includes(c.id)).sort((a, b) => a.cost - b.cost).map((c) =>
        cardTile(c.id, s.collection[c.id], { showLevel: true, onclick: () => {
          if (slot < 0) { pick = c.id; render(); return; }
          const r = app.game.transact((st) => setDeckCard(st, st.activeDeck, slot, c.id));
          if (!r.ok) toast(r.reason!, true);
          slot = -1; render();
        } }))),
      h('div', { class: 'section-title' }, h('h3', null, 'À débloquer')),
      h('div', { class: 'cards' }, CARDS.filter((c) => !s.collection[c.id].owned).map((c) => cardTile(c.id, s.collection[c.id], { onclick: () => app.go('card', { id: c.id }) }))),
    );
  };
  render();
});
