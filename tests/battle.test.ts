import { getCard } from '../src/core/cards';
import { BRIDGES, BRIDGE_HALF, ESSENCE_PER_SEC, RIVER_HALF, RIVER_Y } from '../src/sim/battle';
import { deckWith, makeBattle, run, unitsOf } from './helpers';

const princess = (b: ReturnType<typeof makeBattle>, owner: 0 | 1, left = true) =>
  b.entities.find((e) => e.kind === 'tower' && e.owner === owner && e.towerType === 'princess' && (left ? e.x < 9 : e.x > 9))!;

describe('Essence', () => {
  it('se recharge au rythme prévu et plafonne à 10', () => {
    const b = makeBattle(deckWith('charognard'));
    expect(b.players[0].essence).toBe(5);
    run(b, 2.8);
    expect(b.players[0].essence).toBeCloseTo(6, 1);
    run(b, 30);
    expect(b.players[0].essence).toBe(10);
    expect(b.players[0].stats.essenceWasted).toBeGreaterThan(0);
  });
  it('double durant la dernière minute', () => {
    const b = makeBattle(deckWith('charognard'));
    run(b, 121);
    b.players[0].essence = 0;
    run(b, 2.8);
    expect(b.players[0].essence).toBeCloseTo(2.8 * ESSENCE_PER_SEC * 2, 1);
  });
  it('refuse une carte trop chère', () => {
    const b = makeBattle(deckWith('colosse_chair'));
    expect(b.playCard(0, 0, 4, 22)).toEqual({ ok: false, reason: 'Essence insuffisante' });
  });
});

describe('Main et pioche cyclique', () => {
  it('la carte jouée part en fin de file et la suivante entre en main', () => {
    const b = makeBattle(deckWith('charognard'));
    const hand0 = b.players[0].hand.map((h) => h!.cardId);
    const next = b.players[0].queue[0].cardId;
    b.players[0].essence = 10;
    expect(b.playCard(0, 0, 4, 22).ok).toBe(true);
    expect(b.players[0].hand[0]!.cardId).toBe(next);
    expect(b.players[0].queue[b.players[0].queue.length - 1].cardId).toBe(hand0[0]);
    expect(b.players[0].hand.length).toBe(4);
    expect(b.players[0].queue.length).toBe(4);
  });
  it('exige un deck de 8 cartes', () => {
    expect(() => makeBattle(['charognard'])).toThrow();
  });
});

describe('Déplacement et rivière', () => {
  it('une unité terrestre traverse par un passage', () => {
    const b = makeBattle(deckWith('charognard'));
    const u = b.spawnUnit(0, 'charognard', 9, 22, 9, null, 0);
    let crossedOk = true;
    for (let i = 0; i < 30 * 12; i++) {
      b.step();
      if (u.alive && Math.abs(u.y - RIVER_Y) < RIVER_HALF - 0.05) {
        if (!BRIDGES.some((bx) => Math.abs(u.x - bx) <= BRIDGE_HALF + 0.05)) crossedOk = false;
      }
    }
    expect(crossedOk).toBe(true);
    expect(u.y).toBeLessThan(RIVER_Y);
  });
  it('les sauteurs franchissent la rivière hors des passages', () => {
    const b = makeBattle(deckWith('charognard'));
    const u = b.spawnUnit(0, 'sauteur_marais', 9, 19, 9, null, 0);
    let inRiverOffBridge = false;
    for (let i = 0; i < 30 * 6; i++) {
      b.step();
      if (Math.abs(u.y - RIVER_Y) < RIVER_HALF && !BRIDGES.some((bx) => Math.abs(u.x - bx) <= BRIDGE_HALF)) inRiverOffBridge = true;
    }
    expect(inRiverOffBridge).toBe(true);
  });
  it('les volants survolent tout', () => {
    const b = makeBattle(deckWith('charognard'));
    const u = b.spawnUnit(0, 'oeil_aile', 9, 22, 9, null, 0);
    run(b, 4);
    expect(Math.abs(u.x - 9)).toBeLessThan(6);
    expect(u.y).toBeLessThan(18);
  });
});

describe('Ciblage', () => {
  it('une unité au sol uniquement ignore les volants', () => {
    const b = makeBattle(deckWith('charognard'));
    const melee = b.spawnUnit(0, 'charognard', 9, 22, 9, null, 0);
    const flyer = b.spawnUnit(1, 'oeil_aile', 9, 21, 9, null, 0);
    flyer.speed = 0; flyer.damage = 0;
    run(b, 3);
    const hits = b.events.filter((e) => e.t === 'attack' && e.id === melee.id && e.targetId === flyer.id);
    expect(hits.length).toBe(0);
    expect(melee.targetId).not.toBe(flyer.id);
  });
  it('les unités « bâtiments » ignorent les troupes', () => {
    const b = makeBattle(deckWith('charognard'));
    const golem = b.spawnUnit(0, 'golem_rivets', 3.5, 14, 9, null, 0);
    const blocker = b.spawnUnit(1, 'charognard', 3.5, 12, 9, null, 0);
    blocker.damage = 0; blocker.speed = 0;
    run(b, 3);
    expect(blocker.hp).toBe(blocker.maxHp);
    expect(b.byId(golem.targetId)?.kind).toBe('tower');
  });
  it('les furtifs ne sont pas ciblables avant d’attaquer', () => {
    const b = makeBattle(deckWith('charognard'));
    const st = b.spawnUnit(0, 'ecorcheur_nocturne', 9, 22, 9, null, 0);
    expect(st.hidden).toBe(true);
    const archer = b.spawnUnit(1, 'arbaletrier_os', 12, 22, 9, null, 0);
    archer.speed = 0;
    run(b, 0.5);
    expect(b.canTarget(archer, st)).toBe(false);
  });
});

describe('Tours, couronnes et victoire', () => {
  it('les tours tirent sur les unités à portée', () => {
    const b = makeBattle(deckWith('charognard'));
    const u = b.spawnUnit(0, 'charognard', 3.5, 11, 9, null, 0);
    u.speed = 0;
    run(b, 3);
    expect(u.hp).toBeLessThan(u.maxHp);
  });
  it('détruire une tour-sentinelle donne une couronne et éveille le roi', () => {
    const b = makeBattle(deckWith('charognard'));
    const t = princess(b, 1);
    const king = b.king(1)!;
    expect(king.active).toBe(false);
    b.dealDamage(null, 0, t, t.hp + 10, {});
    b.step();
    expect(b.players[0].crowns).toBe(1);
    expect(king.active).toBe(true);
    expect(b.events.some((e) => e.t === 'towerDown')).toBe(true);
  });
  it('détruire le roi termine la partie (3 couronnes)', () => {
    const b = makeBattle(deckWith('charognard'));
    const k = b.king(1)!;
    b.dealDamage(null, 0, k, k.hp + 1, {});
    b.step();
    expect(b.result?.winner).toBe(0);
    expect(b.result?.crowns[0]).toBe(3);
    expect(b.result?.reason).toBe('king');
  });
  it('la poche avancée s’ouvre après la chute d’une tour', () => {
    const b = makeBattle(deckWith('charognard'));
    b.players[0].essence = 10;
    const card = getCard('charognard');
    expect(b.canDeployAt(0, card, 4, 12)).toBe(false);
    const t = princess(b, 1);
    b.dealDamage(null, 0, t, t.hp + 1, {});
    b.step();
    expect(b.canDeployAt(0, card, 4, 12)).toBe(true);
    expect(b.canDeployAt(0, card, 14, 12)).toBe(false);
  });
  it('à égalité la prolongation (mort subite) se déclenche puis le départage', () => {
    const b = makeBattle(deckWith('charognard'), undefined, { duration: 5, overtime: 3 });
    run(b, 5.1);
    expect(b.overtime).toBe(true);
    expect(b.result).toBeNull();
    const t = princess(b, 0);
    t.hp -= 100; // le joueur 0 a la tour la plus abîmée
    run(b, 4);
    expect(b.result?.winner).toBe(1);
    expect(b.result?.reason).toBe('tiebreak');
  });
  it('en mort subite la première couronne gagne', () => {
    const b = makeBattle(deckWith('charognard'), undefined, { duration: 2, overtime: 30 });
    run(b, 2.1);
    const t = princess(b, 0);
    b.dealDamage(null, 1, t, t.hp + 1, {});
    b.step();
    expect(b.result?.winner).toBe(1);
    expect(b.result?.reason).toBe('suddenDeath');
  });
  it('un abandon donne la victoire à l’adversaire', () => {
    const b = makeBattle(deckWith('charognard'));
    b.forfeit(0);
    expect(b.result?.winner).toBe(1);
  });
});

describe('Sorts', () => {
  it('dégâts réduits sur les tours', () => {
    const b = makeBattle(deckWith('pluie_bile', 9));
    const t = princess(b, 1);
    const hp0 = t.hp;
    b.playCard(0, 0, t.x, t.y);
    run(b, 1.2);
    expect(hp0 - t.hp).toBeCloseTo(260 * 0.35, 0);
  });
  it('le délai d’impact est respecté', () => {
    const b = makeBattle(deckWith('pluie_bile'));
    const d = b.spawnUnit(1, 'charognard', 9, 10, 9, null, 0); d.speed = 0;
    b.playCard(0, 0, 9, 10);
    run(b, 0.5);
    expect(d.hp).toBe(d.maxHp);
    run(b, 0.6);
    expect(d.hp).toBeLessThan(d.maxHp);
  });
  it('le marais empoisonne dans la durée et ralentit', () => {
    const b = makeBattle(deckWith('marais_putride'));
    b.players[0].essence = 10;
    const d = b.spawnUnit(1, 'colosse_chair', 9, 8, 9, null, 0); d.speed = 0;
    b.playCard(0, 0, 9, 8);
    run(b, 3);
    const mid = d.hp;
    expect(mid).toBeLessThan(d.maxHp);
    expect(d.slowAmt).toBeGreaterThan(0);
    run(b, 3.5);
    expect(d.hp).toBeLessThan(mid);
  });
  it('la fosse aspire puis inflige ses dégâts à la fermeture', () => {
    const b = makeBattle(deckWith('fosse_vorace'));
    b.players[0].essence = 10;
    const d = b.spawnUnit(1, 'charognard', 11.5, 8, 9, null, 0); d.speed = 0;
    b.playCard(0, 0, 9, 8);
    run(b, 1.5);
    expect(d.x).toBeLessThan(11.5);
    run(b, 2.2);
    expect(d.maxHp - d.hp).toBeGreaterThan(250);
  });
  it('la brume de terreur étourdit', () => {
    const b = makeBattle(deckWith('brume_terreur'));
    const d = b.spawnUnit(1, 'charognard', 9, 8, 9, null, 0);
    b.playCard(0, 0, 9, 8);
    run(b, 0.3);
    const y0 = d.y;
    run(b, 1.5);
    expect(d.y).toBeCloseTo(y0, 3);
  });
  it('la comète laisse un cratère', () => {
    const b = makeBattle(deckWith('comete_rouille'));
    b.players[0].essence = 10;
    b.playCard(0, 0, 9, 8);
    run(b, 2);
    expect(b.zones.some((z) => z.style === 'crater')).toBe(true);
  });
});

describe('Capacités spéciales', () => {
  it('charge : double les dégâts du premier coup', () => {
    const b = makeBattle(deckWith('charognard'));
    const ram = b.spawnUnit(0, 'belier_ossueux', 3.5, 13, 9, null, 0);
    const t = princess(b, 1);
    const hp0 = t.hp;
    for (let i = 0; i < 30 * 8 && t.hp === hp0; i++) b.step();
    expect(hp0 - t.hp).toBeCloseTo(ram.damage * 2, 0);
  });
  it('vol de vie : soigne l’attaquant', () => {
    const b = makeBattle(deckWith('charognard'));
    const v = b.spawnUnit(0, 'devoreur_tombes', 9, 20, 9, null, 0);
    const foe = b.spawnUnit(1, 'colosse_chair', 9, 21.5, 9, null, 0); foe.speed = 0; foe.damage = 0;
    v.hp = v.maxHp * 0.5;
    run(b, 3);
    expect(v.hp).toBeGreaterThan(v.maxHp * 0.5);
  });
  it('résurrection unique puis invocation à la mort', () => {
    const b = makeBattle(deckWith('charognard'));
    const t = b.spawnUnit(0, 'titan_ossuaire', 9, 24, 9, null, 0);
    b.dealDamage(null, 1, t, t.maxHp * 2, {});
    expect(t.alive).toBe(true);
    expect(t.hp).toBeCloseTo(t.maxHp * 0.4, 0);
    b.dealDamage(null, 1, t, t.maxHp * 2, {});
    b.step();
    expect(t.alive).toBe(false);
    expect(unitsOf(b, 0, 'osselet').length).toBe(6);
  });
  it('explosion à la mort avec étourdissement', () => {
    const b = makeBattle(deckWith('charognard'));
    const m = b.spawnUnit(0, 'meduse_celeste', 9, 20, 9, null, 0);
    const foe = b.spawnUnit(1, 'charognard', 9, 21, 9, null, 0);
    b.dealDamage(null, 1, m, m.maxHp + 1, {});
    b.step();
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(foe.stunUntil).toBeGreaterThan(b.time);
  });
  it('kamikaze : meurt en explosant au contact', () => {
    const b = makeBattle(deckWith('charognard'));
    const k = b.spawnUnit(0, 'rampant_bile', 9, 20, 9, null, 0);
    const foe = b.spawnUnit(1, 'charognard', 9, 18.5, 9, null, 0); foe.speed = 0; foe.damage = 0;
    run(b, 3);
    expect(k.alive).toBe(false);
    expect(foe.maxHp - foe.hp).toBeGreaterThan(300);
  });
  it('montée en puissance : dégâts croissants sur la même cible', () => {
    const b = makeBattle(deckWith('charognard'));
    const s = b.spawnUnit(0, 'sangsue_geante', 9, 20, 9, null, 0);
    const foe = b.spawnUnit(1, 'titan_ossuaire', 9, 21.5, 9, null, 0); foe.speed = 0; foe.damage = 0;
    run(b, 1);
    const early = foe.maxHp - foe.hp;
    run(b, 5);
    const later = foe.maxHp - foe.hp;
    expect(s.ab.rampStage).toBe(2);
    expect(later - early).toBeGreaterThan(early * 4);
  });
  it('chaîne : touche plusieurs ennemis', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'tourmenteur_electrique', 9, 24, 9, null, 0).speed = 0;
    const foes = [0, 1, 2, 3].map((i) => { const f = b.spawnUnit(1, 'charognard', 7.5 + i, 20, 9, null, 0); f.speed = 0; f.damage = 0; return f; });
    run(b, 2.5);
    expect(foes.filter((f) => f.hp < f.maxHp).length).toBeGreaterThanOrEqual(3);
  });
  it('perforation : le projectile traverse une ligne', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'lanceuse_epines', 9, 24, 9, null, 0).speed = 0;
    const foes = [0, 1, 2].map((i) => { const f = b.spawnUnit(1, 'charognard', 9, 20 - i * 1.2, 9, null, 0); f.speed = 0; f.damage = 0; return f; });
    run(b, 2.5);
    expect(foes.every((f) => f.hp < f.maxHp)).toBe(true);
  });
  it('épines : renvoient une partie des dégâts de mêlée', () => {
    const b = makeBattle(deckWith('charognard'));
    const r = b.spawnUnit(0, 'rodeur_epines', 9, 20, 9, null, 0); r.damage = 0;
    const foe = b.spawnUnit(1, 'charognard', 9, 21.3, 9, null, 0); foe.speed = 0;
    run(b, 3);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });
  it('crochet : ramène une cible', () => {
    const b = makeBattle(deckWith('charognard'));
    const h = b.spawnUnit(0, 'pecheur_ames', 9, 24, 9, null, 0); h.speed = 0;
    const foe = b.spawnUnit(1, 'charognard', 9, 19, 9, null, 0); foe.speed = 0;
    run(b, 1.5);
    expect(Math.hypot(foe.x - h.x, foe.y - h.y)).toBeLessThan(2);
  });
  it('engloutir : dévore une unité affaiblie', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'bouche_sans_fin', 9, 22, 9, null, 0).speed = 0;
    const foe = b.spawnUnit(1, 'charognard', 9, 20.2, 9, null, 0); foe.speed = 0; foe.damage = 0;
    run(b, 3);
    expect(foe.alive).toBe(false);
    expect(b.events.some((e) => e.t === 'special' && e.kind === 'devour')).toBe(true);
  });
  it('nécromancie : relève un osselet à la mort d’une unité proche', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'liche_archiviste', 9, 24, 9, null, 0).speed = 0;
    const foe = b.spawnUnit(1, 'charognard', 9, 22, 9, null, 0);
    b.dealDamage(null, 0, foe, foe.maxHp + 1, {});
    b.step();
    expect(unitsOf(b, 0, 'osselet').length).toBe(1);
  });
  it('marée noire : attire et étourdit', () => {
    const b = makeBattle(deckWith('charognard'));
    const inn = b.spawnUnit(0, 'l_innommable', 9, 24, 9, null, 0); inn.speed = 0;
    const foe = b.spawnUnit(1, 'charognard', 12, 24, 9, null, 0); foe.speed = 0; foe.damage = 0;
    run(b, 2.2);
    expect(Math.hypot(foe.x - inn.x, foe.y - inn.y)).toBeLessThan(2.2);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });
  it('auras : peur ralentit les ennemis, tambour accélère les alliés', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'hurleur_profondeurs', 9, 24, 9, null, 0).speed = 0;
    b.spawnUnit(0, 'tambour_ossements', 4, 24, 9, null, 0).speed = 0;
    const foe = b.spawnUnit(1, 'charognard', 10, 24, 9, null, 0);
    const ally = b.spawnUnit(0, 'charognard', 5, 24, 9, null, 0);
    b.step();
    expect(foe.fear).toBeCloseTo(0.65);
    expect(ally.haste).toBeCloseTo(1.35);
  });
  it('bouclier collectif et soin', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'gardien_coquille', 9, 24, 9, null, 0).speed = 0;
    b.spawnUnit(0, 'pretresse_sutures', 8, 24, 9, null, 0).speed = 0;
    const ally = b.spawnUnit(0, 'charognard', 10, 24, 9, null, 0); ally.speed = 0;
    ally.hp = ally.maxHp / 2;
    run(b, 1);
    expect(ally.shield).toBeGreaterThan(0);
    expect(ally.hp).toBeGreaterThan(ally.maxHp / 2);
  });
  it('invocateur : la reine pond des drones volants', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'reine_ruche', 9, 26, 9, null, 0).speed = 0;
    run(b, 6.5);
    const drones = unitsOf(b, 0, 'drone_ruche');
    expect(drones.length).toBe(2);
    expect(drones[0].flying).toBe(true);
  });
  it('rage : le boucher accélère sous 50 % de vie', () => {
    const b = makeBattle(deckWith('charognard'));
    const u = b.spawnUnit(0, 'boucher_rouille', 9, 26, 9, null, 0);
    run(b, 1);
    const y0 = u.y; run(b, 1); const slowStep = y0 - u.y;
    u.hp = u.maxHp * 0.4;
    const y1 = u.y; run(b, 1); const fastStep = y1 - u.y;
    expect(fastStep).toBeGreaterThan(slowStep * 1.2);
  });
  it('bond : l’assassin franchit la distance', () => {
    const b = makeBattle(deckWith('charognard'));
    const a = b.spawnUnit(0, 'bourreau_chitineux', 9, 26, 9, null, 0);
    const foe = b.spawnUnit(1, 'arbaletrier_os', 9, 21, 9, null, 0); foe.speed = 0; foe.damage = 0;
    run(b, 0.3);
    expect(b.events.some((e) => e.t === 'special' && e.kind === 'dash')).toBe(true);
    expect(Math.hypot(a.x - foe.x, a.y - foe.y)).toBeLessThan(1.5);
  });
  it('souffle de cendres : zone brûlante toutes les 3 attaques', () => {
    const b = makeBattle(deckWith('charognard'));
    b.spawnUnit(0, 'wyrm_cendres', 9, 24, 9, null, 0).speed = 0;
    const foe = b.spawnUnit(1, 'colosse_chair', 9, 21.5, 9, null, 0); foe.speed = 0; foe.damage = 0;
    run(b, 5);
    expect(b.zones.some((z) => z.style === 'ash') || b.events.length > 0).toBe(true);
    expect(foe.hp).toBeLessThan(foe.maxHp);
  });
  it('bâtiments : se décomposent avec le temps', () => {
    const b = makeBattle(deckWith('tour_dards'));
    b.playCard(0, 0, 9, 22);
    const t = unitsOf(b, 0, 'tour_dards')[0];
    run(b, 10);
    expect(t.hp).toBeLessThan(t.maxHp * 0.75);
    run(b, 25);
    expect(t.alive).toBe(false);
  });
  it('déterminisme : même graine = même partie', () => {
    const play = () => {
      const b = makeBattle(deckWith('charognard'), undefined, { noShuffle: false, seed: 99 });
      b.spawnUnit(0, 'reine_ruche', 9, 24, 9, null, 0);
      b.spawnUnit(1, 'abomination_suturee', 9, 8, 9, null, 0);
      run(b, 40);
      return b.entities.map((e) => `${e.def?.id}:${e.x.toFixed(3)}:${e.hp.toFixed(2)}`).join('|');
    };
    expect(play()).toBe(play());
  });
});
