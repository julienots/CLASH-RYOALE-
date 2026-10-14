import { CARDS } from '../src/core/cards';
import { Rng } from '../src/core/rng';
import { Bot } from '../src/sim/ai';
import { Battle, STEP } from '../src/sim/battle';
import { chestOdds, CHESTS } from '../src/meta/catalog';
import {
  addChestToSlot, buyCosmetic, equipCosmetic, grantCards, openCrownChest, openFreeChest, openSlot, setDeckCard, skipCost,
  startUnlock, upgradeCard, upgradeInfo, deckProblems,
} from '../src/meta/economy';
import { claimEventMilestone, EVENTS, eventProgress } from '../src/meta/events';
import { Game } from '../src/meta/game';
import { applyMatchResult, generateBotDeck, setupMatch, summarize } from '../src/meta/match';
import { ACHIEVEMENTS, claimAchievement, claimMission, recordMissionProgress, type BattleSummary } from '../src/meta/missions';
import { claimTier, passTier, passTiers, PREMIUM_CRYSTALS, unlockPremium, XP_PER_TIER } from '../src/meta/pass';
import { BACKUP_KEY, MemoryStore, SAVE_KEY } from '../src/meta/save';
import { buyDailyOffer, buyPermanentOffer, PERMANENT_OFFERS } from '../src/meta/shop';
import { newSave, STARTER_DECK } from '../src/meta/state';
import { dayKey, seasonAt, weekKey } from '../src/meta/time';

const T0 = new Date(2026, 9, 14, 10, 0, 0).getTime();
const clockAt = (t: { v: number }) => ({ now: () => t.v });

describe('Sauvegarde', () => {
  it('persiste et restaure après redémarrage', () => {
    const store = new MemoryStore();
    const g = new Game(store, { now: () => T0 });
    g.transact((s) => { s.gold = 4321; return { ok: true }; });
    const g2 = new Game(store, { now: () => T0 + 1000 });
    expect(g2.data.gold).toBe(4321);
    expect(g2.recovered).toBe('main');
  });
  it('récupère la copie de secours si la principale est corrompue', () => {
    const store = new MemoryStore();
    const g = new Game(store, { now: () => T0 });
    g.transact((s) => { s.gold = 1111; return { ok: true }; });
    g.transact((s) => { s.gold = 2222; return { ok: true }; });
    store.setItem(SAVE_KEY, store.getItem(SAVE_KEY)!.replace('2222', '9999')); // falsification
    const g2 = new Game(store, { now: () => T0 });
    expect(g2.recovered).toBe('backup');
    expect(g2.data.gold).toBe(1111);
  });
  it('repart d’une sauvegarde neuve si tout est illisible', () => {
    const store = new MemoryStore();
    store.setItem(SAVE_KEY, '{oops');
    store.setItem(BACKUP_KEY, 'nope');
    const g = new Game(store, { now: () => T0 });
    expect(g.recovered).toBe('new');
    expect(g.data.decks[0]).toEqual(STARTER_DECK);
  });
  it('une transaction échouée ne modifie rien', () => {
    const g = new Game(new MemoryStore(), { now: () => T0 });
    const before = g.data.gold;
    g.transact((s) => { s.gold = 0; return { ok: false }; });
    expect(g.data.gold).toBe(before);
  });
  it('répare un deck illégal', () => {
    const store = new MemoryStore();
    const g = new Game(store, { now: () => T0 });
    g.transact((s) => { s.decks[0] = ['l_innommable', ...STARTER_DECK.slice(1)]; return { ok: true }; });
    const g2 = new Game(store, { now: () => T0 });
    expect(g2.data.decks[0]).toEqual(STARTER_DECK);
  });
});

describe('Collection, decks et améliorations', () => {
  it('nouvelle carte débloquée puis fragments cumulés', () => {
    const s = newSave(T0);
    expect(grantCards(s, 'vierge_mille_yeux', 1).isNew).toBe(true);
    expect(s.collection.vierge_mille_yeux.owned).toBe(true);
    expect(grantCards(s, 'vierge_mille_yeux', 2).isNew).toBe(false);
    expect(s.collection.vierge_mille_yeux.fragments).toBe(2);
  });
  it('amélioration : consomme fragments et or, augmente le niveau', () => {
    const s = newSave(T0);
    s.collection.charognard.fragments = 10; s.gold = 1000;
    const info = upgradeInfo(s, 'charognard');
    expect(info.canUpgrade).toBe(true);
    expect(upgradeCard(s, 'charognard').ok).toBe(true);
    expect(s.collection.charognard.level).toBe(2);
    expect(s.collection.charognard.fragments).toBe(10 - info.fragmentsNeeded);
    expect(s.gold).toBe(1000 - info.goldNeeded);
  });
  it('amélioration refusée sans ressources ou au maximum', () => {
    const s = newSave(T0);
    expect(upgradeCard(s, 'charognard').reason).toBe('Fragments insuffisants');
    expect(upgradeCard(s, 'titan_ossuaire').reason).toBe('Carte non possédée');
    s.collection.charognard.level = 14;
    expect(upgradeCard(s, 'charognard').reason).toBe('Niveau maximal atteint');
  });
  it('deck : remplacement, échange et validation', () => {
    const s = newSave(T0);
    expect(setDeckCard(s, 0, 0, 'l_innommable').ok).toBe(false);
    expect(setDeckCard(s, 0, 0, 'salve_epines').ok).toBe(true);
    expect(s.decks[0][0]).toBe('salve_epines');
    const second = s.decks[0][1];
    expect(setDeckCard(s, 0, 0, second).ok).toBe(true); // échange
    expect(s.decks[0][1]).toBe('salve_epines');
    expect(deckProblems(s, s.decks[0])).toEqual([]);
    expect(deckProblems(s, ['charognard'])).not.toEqual([]);
  });
  it('les 70 cartes peuvent former un deck légal une fois débloquées', () => {
    const s = newSave(T0);
    for (const c of CARDS) s.collection[c.id].owned = true;
    for (let i = 0; i < CARDS.length; i += 8) {
      const ids = CARDS.slice(i, i + 8).map((c) => c.id);
      while (ids.length < 8) ids.push(CARDS[ids.length].id);
      expect(deckProblems(s, ids)).toEqual([]);
    }
  });
});

describe('Coffres', () => {
  it('probabilités affichées = 100 %', () => {
    for (const t of Object.keys(CHESTS) as (keyof typeof CHESTS)[]) {
      const sum = chestOdds(t).reduce((a, b) => a + b.pct, 0);
      expect(sum).toBeCloseTo(100, 5);
    }
  });
  it('déverrouillage temporisé, un seul à la fois, puis ouverture', () => {
    const s = newSave(T0);
    addChestToSlot(s, 'coffre_chair', T0);
    expect(startUnlock(s, 0, T0).ok).toBe(true);
    expect(startUnlock(s, 1, T0).reason).toContain('autre coffre');
    expect(openSlot(s, 0, T0 + 1000, new Rng(1)).ok).toBe(false);
    const gold = s.gold;
    const r = openSlot(s, 0, T0 + 16 * 60 * 1000, new Rng(1));
    expect(r.ok).toBe(true);
    expect(s.chests.slots[0]).toBeNull();
    expect(s.gold).toBeGreaterThan(gold);
    expect(r.value!.cards.length).toBe(CHESTS.coffre_os.stacks);
    expect(openSlot(s, 0, T0 + 99999999, new Rng(1)).ok).toBe(false); // pas de duplication
  });
  it('ouverture immédiate contre cristaux', () => {
    const s = newSave(T0);
    addChestToSlot(s, 'coffre_abysse', T0);
    const cost = skipCost(s, 1, T0);
    expect(cost).toBeGreaterThan(0);
    s.crystals = cost;
    expect(openSlot(s, 1, T0, new Rng(3), true).ok).toBe(true);
    // Après paiement il ne reste que les cristaux contenus dans le coffre.
    expect(s.crystals).toBeLessThanOrEqual(CHESTS.coffre_abysse.crystals[1]);
    expect(s.crystals).toBeGreaterThanOrEqual(CHESTS.coffre_abysse.crystals[0]);
  });
  it('raretés garanties respectées', () => {
    for (let i = 0; i < 20; i++) {
      const s = newSave(T0);
      addChestToSlot(s, 'coffre_abysse', T0);
      s.crystals = 999;
      const r = openSlot(s, 1, T0, new Rng(i), true).value!;
      const rar = r.cards.map((c) => c.rarity);
      expect(rar).toContain('epique');
      expect(rar).toContain('mythique');
    }
  });
  it('offrande gratuite toutes les 4 h et coffre des couronnes', () => {
    const s = newSave(T0);
    expect(openFreeChest(s, T0, new Rng(1)).ok).toBe(true);
    expect(openFreeChest(s, T0 + 3600000, new Rng(1)).ok).toBe(false);
    expect(openFreeChest(s, T0 + 4 * 3600000, new Rng(1)).ok).toBe(true);
    s.chests.crowns = 10;
    expect(openCrownChest(s, new Rng(1), dayKey(T0)).ok).toBe(true);
    s.chests.crowns = 10;
    expect(openCrownChest(s, new Rng(1), dayKey(T0)).ok).toBe(false);
  });
});

describe('Boutique', () => {
  it('offres quotidiennes stables dans la journée, renouvelées le lendemain', () => {
    const t = { v: T0 };
    const g = new Game(new MemoryStore(), clockAt(t));
    const ids = g.data.shop.offers.map((o) => o.id);
    t.v = T0 + 3600000; g.refresh();
    expect(g.data.shop.offers.map((o) => o.id)).toEqual(ids);
    t.v = T0 + 86400000; g.refresh();
    expect(g.data.shop.offers.map((o) => o.id)).not.toEqual(ids);
  });
  it('un retour d’horloge ne régénère pas les offres (anti-abus)', () => {
    const t = { v: T0 + 86400000 };
    const g = new Game(new MemoryStore(), clockAt(t));
    const day = g.data.shop.day;
    t.v = T0; g.refresh();
    expect(g.data.shop.day).toBe(day);
  });
  it('limites d’achat et paiement', () => {
    const g = new Game(new MemoryStore(), { now: () => T0 });
    const gift = g.data.shop.offers.find((o) => o.kind === 'gift')!;
    expect(g.transact((s, now) => buyDailyOffer(s, gift.id, now, new Rng(1))).ok).toBe(true);
    expect(g.transact((s, now) => buyDailyOffer(s, gift.id, now, new Rng(1))).reason).toBe('Limite d’achat atteinte');
    const card = g.data.shop.offers.find((o) => o.kind === 'card')!;
    g.data.gold = 0;
    expect(g.transact((s, now) => buyDailyOffer(s, card.id, now, new Rng(1))).reason).toBe('Or insuffisant');
    g.data.gold = 100000;
    const frag = g.data.collection[card.cardId!].fragments;
    expect(g.transact((s, now) => buyDailyOffer(s, card.id, now, new Rng(1))).ok).toBe(true);
    const o = g.data.collection[card.cardId!];
    expect(o.fragments + (o.owned ? 1 : 0)).toBeGreaterThanOrEqual(frag + card.amount - 1);
  });
  it('offres permanentes avec limite hebdomadaire', () => {
    const g = new Game(new MemoryStore(), { now: () => T0 });
    g.data.crystals = 5000;
    const leg = PERMANENT_OFFERS.find((o) => o.id === 'p_legendaire')!;
    const r = g.transact((s, now) => buyPermanentOffer(s, leg.id, now, new Rng(2)));
    expect(r.ok).toBe(true);
    const rarity = r.value!.chests![0].cards[0].rarity;
    expect(['legendaire', 'abyssal']).toContain(rarity);
    expect(g.transact((s, now) => buyPermanentOffer(s, leg.id, now, new Rng(2))).reason).toBe('Limite hebdomadaire atteinte');
  });
  it('cosmétiques : achat et équipement', () => {
    const s = newSave(T0);
    s.gold = 5000;
    expect(buyCosmetic(s, 'banniere_sang').ok).toBe(true);
    expect(buyCosmetic(s, 'banniere_sang').ok).toBe(false);
    expect(equipCosmetic(s, 'banniere_sang').ok).toBe(true);
    expect(s.cosmetics.banner).toBe('banniere_sang');
    expect(equipCosmetic(s, 'fx_sang').ok).toBe(false);
  });
});

describe('SUPER PASS', () => {
  it('30 paliers gratuits et premium', () => {
    const tiers = passTiers('S1');
    expect(tiers.length).toBe(30);
    for (const t of tiers) { expect(Object.keys(t.free).length).toBeGreaterThan(0); expect(Object.keys(t.premium).length).toBeGreaterThan(0); }
  });
  it('réclamation : progression requise, pas de double, premium verrouillé', () => {
    const g = new Game(new MemoryStore(), { now: () => T0 });
    expect(g.transact((s, now) => claimTier(s, 1, 'free', now)).reason).toBe('Palier non atteint');
    g.data.pass.xp = XP_PER_TIER * 2;
    expect(passTier(g.data)).toBe(2);
    expect(g.transact((s, now) => claimTier(s, 1, 'free', now)).ok).toBe(true);
    expect(g.transact((s, now) => claimTier(s, 1, 'free', now)).reason).toBe('Déjà réclamé');
    expect(g.transact((s, now) => claimTier(s, 1, 'premium', now)).reason).toBe('Parcours premium verrouillé');
    g.data.crystals = PREMIUM_CRYSTALS;
    expect(g.transact((s) => unlockPremium(s)).ok).toBe(true);
    expect(g.data.crystals).toBe(0);
    expect(g.transact((s, now) => claimTier(s, 1, 'premium', now)).ok).toBe(true);
  });
  it('nouvelle saison : remise à zéro', () => {
    const t = { v: T0 };
    const g = new Game(new MemoryStore(), clockAt(t));
    g.data.pass.xp = 500;
    const sid = g.data.pass.seasonId;
    t.v = seasonAt(T0).end + 1000; g.refresh();
    expect(g.data.pass.seasonId).not.toBe(sid);
    expect(g.data.pass.xp).toBe(0);
  });
});

const summary = (over: Partial<BattleSummary> = {}): BattleSummary => ({
  battleId: 'x', won: true, draw: false, crowns: 3, crownsLost: 0, cardsPlayed: 40, spellsCast: 8, unitsDeployed: 30, unitsKilled: 50,
  played: {}, factionsPlayed: { chair: 20, chitine: 20, ossuaire: 20, abysse: 20, rouille: 20 }, difficulty: 3, ranked: true, ...over,
});

describe('Missions et succès', () => {
  it('missions quotidiennes et hebdomadaires générées et réclamables', () => {
    const g = new Game(new MemoryStore(), { now: () => T0 });
    expect(g.data.missions.daily.length).toBe(3);
    expect(g.data.missions.weekly.length).toBe(3);
    const m = g.data.missions.daily[0];
    expect(g.transact((s) => claimMission(s, m.id)).reason).toBe('Mission incomplète');
    for (let i = 0; i < 5; i++) recordMissionProgress(g.data, summary());
    const gold = g.data.gold;
    expect(g.transact((s) => claimMission(s, m.id)).ok).toBe(true);
    expect(g.data.gold).toBeGreaterThan(gold);
    expect(g.transact((s) => claimMission(s, m.id)).reason).toBe('Déjà réclamée');
  });
  it('succès réclamable une seule fois', () => {
    const s = newSave(T0);
    expect(claimAchievement(s, 'premier_sang').ok).toBe(false);
    s.stats.wins = 1;
    expect(claimAchievement(s, 'premier_sang').ok).toBe(true);
    expect(claimAchievement(s, 'premier_sang').ok).toBe(false);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(10);
  });
  it('clés de semaine : lundi', () => {
    const sun = new Date(2026, 9, 18).getTime();
    const mon = new Date(2026, 9, 19).getTime();
    expect(weekKey(sun)).not.toBe(weekKey(mon));
    expect(weekKey(new Date(2026, 9, 13).getTime())).toBe(weekKey(sun));
  });
});

describe('Combat → récompenses', () => {
  it('un vrai combat contre un bot applique récompenses, coffres, trophées une seule fois', () => {
    const g = new Game(new MemoryStore(), { now: () => T0 });
    g.data.chests.slots = [null, null, null, null];
    const setup = setupMatch(g.data, 'classe', T0, { difficulty: 'initie' });
    const b = new Battle(setup.config);
    const me = new Bot(b, 0, 'abyssal', 1), foe = new Bot(b, 1, 'initie', 2);
    while (!b.result) { me.update(STEP); foe.update(STEP); b.step(); }
    const sum = summarize(setup, b.result, b.players[0], b.players[1]);
    const r = applyMatchResult(g.data, setup, sum, T0);
    expect(r.duplicate).toBe(false);
    expect(g.data.stats.battles).toBe(1);
    if (sum.won) { expect(r.trophies).toBeGreaterThan(0); expect(r.chest).not.toBeNull(); }
    const again = applyMatchResult(g.data, setup, sum, T0);
    expect(again.duplicate).toBe(true);
    expect(g.data.stats.battles).toBe(1);
  });
  it('événement : progression et paliers', () => {
    const s = newSave(T0);
    const ev = EVENTS[0];
    const setup = setupMatch(s, 'evenement', T0, { eventId: ev.id });
    expect(setup.config.essenceMult).toEqual([2, 2]);
    applyMatchResult(s, setup, summary({ battleId: 'e1' }), T0);
    expect(eventProgress(s, ev.id).wins).toBe(1);
    expect(claimEventMilestone(s, ev.id, 0, T0).ok).toBe(true);
    expect(claimEventMilestone(s, ev.id, 0, T0).ok).toBe(false);
    expect(claimEventMilestone(s, ev.id, 1, T0).ok).toBe(false);
  });
  it('événement miroir : decks imposés', () => {
    const s = newSave(T0);
    const ev = EVENTS.find((e) => e.playerDeck)!;
    const setup = setupMatch(s, 'evenement', T0, { eventId: ev.id });
    expect(setup.config.decks[0].map((d) => d.cardId)).toEqual(ev.playerDeck);
    expect(setup.config.decks[1].map((d) => d.cardId)).toEqual(ev.botDeck);
  });
  it('decks de bots valides', () => {
    for (let i = 0; i < 50; i++) {
      const d = generateBotDeck(new Rng(i));
      expect(d.length).toBe(8);
      expect(new Set(d).size).toBe(8);
    }
  });
});
