import { CARDS, CARD_MAP, UNITS, getUnit } from '../src/core/cards';
import { RARITY_INFO, fragmentsToUpgrade, goldToUpgrade, powerLevel, statMultiplier } from '../src/core/progression';
import { ARENA_H } from '../src/sim/battle';
import { deckWith, makeBattle, run, unitsOf } from './helpers';

describe('Catalogue de cartes', () => {
  it('contient au moins 70 cartes aux identifiants uniques', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(70);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });

  it('respecte la répartition par catégorie', () => {
    const count = (cat: string) => CARDS.filter((c) => c.category === cat).length;
    expect(count('melee')).toBe(30);
    expect(count('distance')).toBe(12);
    expect(count('aerien')).toBe(8);
    expect(count('support')).toBe(8);
    expect(count('sort')).toBe(7);
    expect(count('batiment')).toBe(5);
  });

  it('possède des données complètes et cohérentes pour chaque carte', () => {
    for (const c of CARDS) {
      expect(c.name.length, c.id).toBeGreaterThan(2);
      expect(c.description.length, c.id).toBeGreaterThan(10);
      expect(c.cost, c.id).toBeGreaterThanOrEqual(1);
      expect(c.cost, c.id).toBeLessThanOrEqual(9);
      expect(RARITY_INFO[c.rarity], c.id).toBeDefined();
      expect(c.strengths && c.weaknesses, c.id).toBeTruthy();
      for (const k of c.counters) expect(CARD_MAP[k], `${c.id} -> contre ${k}`).toBeDefined();
      if (c.kind === 'spell') expect(c.spell, c.id).toBeDefined();
      else {
        expect(c.spawns?.length, c.id).toBeGreaterThan(0);
        for (const s of c.spawns!) expect(UNITS[s.unit], `${c.id} -> ${s.unit}`).toBeDefined();
      }
      if (c.kind === 'building') expect(getUnit(c.spawns![0].unit).building, c.id).toBe(true);
      if (c.rarity === 'legendaire' || c.rarity === 'abyssal') expect(c.signature, c.id).toBeTruthy();
    }
  });

  it('chaque unité a des stats valides et des références de capacités existantes', () => {
    for (const u of Object.values(UNITS)) {
      expect(u.hp, u.id).toBeGreaterThan(0);
      expect(u.hitSpeed, u.id).toBeGreaterThan(0);
      expect(u.radius, u.id).toBeGreaterThan(0);
      if (!u.building) expect(u.speed, u.id).toBeGreaterThan(0);
      if (u.building) expect(u.lifetime, u.id).toBeGreaterThan(0);
      for (const a of u.abilities ?? []) {
        if ('unit' in a) expect(UNITS[a.unit], `${u.id}:${a.type}`).toBeDefined();
      }
    }
  });

  it('chaque carte a une identité visuelle distincte', () => {
    const sigs = new Set<string>();
    for (const c of CARDS) {
      if (!c.spawns) continue;
      const v = getUnit(c.spawns[0].unit).visual;
      const sig = `${v.plan}|${v.c1}|${v.c3}|${v.scale}|${v.eyes}|${v.limbs}|${v.spikes}`;
      expect(sigs.has(sig), `${c.id} duplique ${sig}`).toBe(false);
      sigs.add(sig);
    }
  });

  it('progression : coûts croissants et multiplicateur cohérent', () => {
    expect(statMultiplier(9)).toBeCloseTo(1);
    expect(statMultiplier(10)).toBeCloseTo(1.08);
    for (const c of CARDS) {
      const max = RARITY_INFO[c.rarity].maxLevel;
      expect(powerLevel(c.rarity, max)).toBeLessThanOrEqual(14);
      let prev = 0;
      for (let l = 1; l < max; l++) {
        const f = fragmentsToUpgrade(c.rarity, l)!;
        const g = goldToUpgrade(c.rarity, l)!;
        expect(f, `${c.id} niv ${l}`).toBeGreaterThan(0);
        expect(g).toBeGreaterThan(prev);
        prev = g;
      }
      expect(fragmentsToUpgrade(c.rarity, max)).toBeNull();
    }
  });
});

describe('Chaque carte est réellement jouable', () => {
  for (const c of CARDS) {
    it(`${c.id} : se joue et produit son effet réel`, () => {
      const b = makeBattle(deckWith(c.id));
      b.players[0].essence = 10;
      expect(b.players[0].hand[0]?.cardId).toBe(c.id);
      const enemyTower = b.entities.find((e) => e.kind === 'tower' && e.owner === 1 && e.towerType === 'princess' && e.x < 9)!;
      if (c.kind === 'spell') {
        const sp = c.spell!;
        if (sp.affects === 'allies') {
          const ally = b.spawnUnit(0, 'charognard', 4, 22, 9, null, 0);
          ally.hp = ally.maxHp * 0.5;
          const hp0 = ally.hp;
          expect(b.playCard(0, 0, 4, 22).ok).toBe(true);
          run(b, sp.delay + 0.2);
          expect(ally.shield + ally.hp).toBeGreaterThan(hp0);
        } else {
          const dummy = b.spawnUnit(1, 'charognard', enemyTower.x, enemyTower.y + 3, 9, null, 0);
          dummy.speed = 0;
          const hp0 = dummy.hp;
          const tHp = enemyTower.hp;
          expect(b.playCard(0, 0, dummy.x, dummy.y - 0.5).ok).toBe(true);
          expect(b.players[0].essence).toBeCloseTo(10 - c.cost, 1);
          run(b, sp.delay + (sp.duration ?? 0) + 0.3);
          const affected = !dummy.alive || dummy.hp < hp0 || b.time < dummy.stunUntil || enemyTower.hp < tHp;
          expect(affected).toBe(true);
          if (sp.stun) expect(dummy.stunUntil).toBeGreaterThan(sp.delay);
        }
        return;
      }
      const x = c.deployAnywhere ? 3.5 : 3.5;
      const y = c.deployAnywhere ? 12 : 20;
      expect(b.playCard(0, 0, x, y).ok).toBe(true);
      const expected = c.spawns!.reduce((s, sp) => s + sp.count, 0);
      const spawned = b.entities.filter((e) => e.cardId === c.id && e.owner === 0);
      expect(spawned.length).toBe(expected);
      for (const e of spawned) expect(e.def!.id).toBe(c.spawns![0].unit);
      run(b, 1.2);
      for (const e of b.entities) {
        expect(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp), `${c.id}: valeur invalide`).toBe(true);
      }
    });
  }
});

describe('Chaque unité engage réellement le combat', () => {
  for (const c of CARDS.filter((x) => x.kind !== 'spell')) {
    it(`${c.id} : interagit avec l'ennemi`, () => {
      const b = makeBattle(deckWith(c.id));
      const u = getUnit(c.spawns![0].unit);
      const towers1 = b.towers(1);
      const tower0 = towers1.reduce((s, t) => s + t.hp, 0);
      b.players[0].essence = 10;
      const ab = u.abilities ?? [];
      if (ab.some((a) => a.type === 'essencePump')) {
        b.playCard(0, 0, 9, 22);
        b.players[0].essence = 0;
        run(b, 10);
        expect(b.events.some((e) => e.t === 'essence') || b.players[0].essence > 10 / 2.8).toBe(true);
        return;
      }
      if (ab.some((a) => a.type === 'trap')) {
        b.playCard(0, 0, 3.5, 21);
        const victim = b.spawnUnit(1, 'charognard', 3.5, 18, 9, null, 0);
        run(b, 6);
        expect(victim.hp < victim.maxHp || !victim.alive).toBe(true);
        expect(b.events.some((e) => e.t === 'special' && e.kind === 'trap')).toBe(true);
        return;
      }
      if (ab.some((a) => a.type === 'spawner') && u.building) {
        b.playCard(0, 0, 9, 22);
        run(b, 8);
        expect(unitsOf(b, 0, 'larve').length).toBeGreaterThan(0);
        return;
      }
      if (u.building) {
        b.playCard(0, 0, 9, 21);
        const foe = b.spawnUnit(1, u.targets === 'ground' ? 'charognard' : 'oeil_aile', 9, 17.5, 9, null, 0);
        foe.speed = 0;
        run(b, 6);
        expect(foe.hp).toBeLessThan(foe.maxHp);
        return;
      }
      // Unité mobile : on la place directement devant la tour adverse de gauche.
      for (const s of c.spawns!) for (let i = 0; i < s.count; i++) b.spawnUnit(0, s.unit, 3.5 + i * 0.4, 13, 9, c.id, 0);
      const dummy = u.targets === 'buildings' ? null : b.spawnUnit(1, u.targets === 'air' ? 'oeil_aile' : 'charognard', 3.5, 11, 9, null, 0);
      if (dummy) dummy.speed = 0;
      run(b, 25);
      const towerNow = b.entities.filter((e) => e.kind === 'tower' && e.owner === 1).reduce((s, t) => s + Math.max(0, t.hp), 0);
      const interacted = (dummy && (dummy.hp < dummy.maxHp || !dummy.alive)) || towerNow < tower0;
      expect(interacted, `${c.id} n'a infligé aucun dégât`).toBe(true);
    });
  }
});

describe('Déploiement', () => {
  it('refuse le camp adverse sauf cartes fouisseuses', () => {
    const b = makeBattle(deckWith('charognard'));
    b.players[0].essence = 10;
    expect(b.playCard(0, 0, 4, 8).ok).toBe(false);
    const b2 = makeBattle(deckWith('fouisseuse_chitineuse'));
    b2.players[0].essence = 10;
    expect(b2.playCard(0, 0, 6, 9).ok).toBe(true);
    const b3 = makeBattle(deckWith('fouisseuse_chitineuse'));
    b3.players[0].essence = 10;
    expect(b3.playCard(0, 0, 9, ARENA_H - 29.5 + 1).ok).toBe(false); // trop près du roi adverse
  });
});
