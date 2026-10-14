// Économie locale : monnaies, cartes, améliorations, coffres, decks, cosmétiques, niveau du compte.
import { CARDS, CARD_MAP } from '../core/cards';
import { fragmentsToUpgrade, goldToUpgrade, RARITY_INFO, xpForLevel } from '../core/progression';
import { Rng } from '../core/rng';
import type { Rarity } from '../core/types';
import { CHESTS, COSMETIC_MAP, RARITY_STACK_FACTOR } from './catalog';
import type { ChestInstance, ChestType, SaveData } from './state';

export interface Result<T = undefined> { ok: boolean; reason?: string; value?: T }
const fail = <T>(reason: string): Result<T> => ({ ok: false, reason });

export interface Reward { gold?: number; crystals?: number; xp?: number; passXp?: number; cards?: { cardId: string; amount: number }[]; chest?: ChestType; cosmetic?: string }

/** Horloge effective : ne recule jamais (protection contre les retours d'horloge). */
export function effectiveNow(s: SaveData, now: number): number {
  if (now > s.maxSeen) s.maxSeen = now;
  return s.maxSeen;
}

// ------------------------------------------------------------------ niveau du compte
export interface LevelUp { level: number; gold: number; crystals: number }
export function addXp(s: SaveData, amount: number): LevelUp[] {
  const ups: LevelUp[] = [];
  s.profile.xp += Math.max(0, Math.floor(amount));
  while (s.profile.level < 50 && s.profile.xp >= xpForLevel(s.profile.level)) {
    s.profile.xp -= xpForLevel(s.profile.level);
    s.profile.level++;
    const gold = 100 * s.profile.level, crystals = 10 + 2 * s.profile.level;
    s.gold += gold; s.crystals += crystals;
    ups.push({ level: s.profile.level, gold, crystals });
  }
  return ups;
}

// ------------------------------------------------------------------ cartes
export function grantCards(s: SaveData, cardId: string, amount: number): { isNew: boolean } {
  const o = s.collection[cardId];
  if (!o) throw new Error(`Carte inconnue ${cardId}`);
  const isNew = !o.owned;
  if (isNew) { o.owned = true; o.level = 1; o.fragments += Math.max(0, amount - 1); }
  else o.fragments += amount;
  return { isNew };
}

export function upgradeInfo(s: SaveData, cardId: string) {
  const c = CARD_MAP[cardId];
  const o = s.collection[cardId];
  const frag = fragmentsToUpgrade(c.rarity, o.level);
  const gold = goldToUpgrade(c.rarity, o.level);
  const maxed = frag === null;
  return { maxed, fragmentsNeeded: frag ?? 0, goldNeeded: gold ?? 0, canUpgrade: o.owned && !maxed && o.fragments >= (frag ?? Infinity) && s.gold >= (gold ?? Infinity) };
}

export function upgradeCard(s: SaveData, cardId: string): Result<LevelUp[]> {
  const o = s.collection[cardId];
  if (!o || !o.owned) return fail('Carte non possédée');
  const info = upgradeInfo(s, cardId);
  if (info.maxed) return fail('Niveau maximal atteint');
  if (o.fragments < info.fragmentsNeeded) return fail('Fragments insuffisants');
  if (s.gold < info.goldNeeded) return fail('Or insuffisant');
  o.fragments -= info.fragmentsNeeded;
  s.gold -= info.goldNeeded;
  o.level++;
  s.stats.upgrades++;
  const ups = addXp(s, 4 + o.level * 3);
  return { ok: true, value: ups };
}

export function ownedCount(s: SaveData): number { return CARDS.filter((c) => s.collection[c.id].owned).length; }

// ------------------------------------------------------------------ decks
export function deckProblems(s: SaveData, deck: string[]): string[] {
  const p: string[] = [];
  if (deck.length !== 8) p.push('Le deck doit contenir 8 cartes.');
  if (new Set(deck).size !== deck.length) p.push('Une carte ne peut figurer qu’une fois.');
  for (const id of deck) {
    if (!CARD_MAP[id]) p.push(`Carte inconnue : ${id}`);
    else if (!s.collection[id].owned) p.push(`${CARD_MAP[id].name} n’est pas débloquée.`);
  }
  return p;
}

/** Place `cardId` dans l'emplacement `slot` ; si la carte est déjà dans le deck, échange les places. */
export function setDeckCard(s: SaveData, deckIdx: number, slot: number, cardId: string): Result {
  const deck = s.decks[deckIdx];
  if (!deck || slot < 0 || slot > 7) return fail('Emplacement invalide');
  if (!s.collection[cardId]?.owned) return fail('Carte non débloquée');
  const existing = deck.indexOf(cardId);
  if (existing === slot) return { ok: true };
  if (existing >= 0) { deck[existing] = deck[slot]; deck[slot] = cardId; }
  else deck[slot] = cardId;
  return { ok: true };
}

export function averageCost(deck: string[]): number {
  return deck.reduce((sum, id) => sum + (CARD_MAP[id]?.cost ?? 0), 0) / Math.max(1, deck.length);
}

// ------------------------------------------------------------------ coffres
export interface ChestContents { type: ChestType; gold: number; crystals: number; cards: { cardId: string; amount: number; isNew: boolean; rarity: Rarity }[] }

export function rollChest(type: ChestType, rng: Rng): Omit<ChestContents, 'cards'> & { cards: { cardId: string; amount: number; rarity: Rarity }[] } {
  const def = CHESTS[type];
  const rarities = Object.keys(def.weights) as Rarity[];
  const picks: Rarity[] = [...(def.guaranteed ?? [])];
  while (picks.length < def.stacks) picks.push(rng.weighted(rarities.map((r) => ({ item: r, weight: def.weights[r] }))));
  const used = new Set<string>();
  const commonBase = def.totalFragments / Math.max(1, picks.reduce((s, r) => s + Math.max(RARITY_STACK_FACTOR[r], 0.02), 0));
  const cards = picks.map((r) => {
    const pool = CARDS.filter((c) => c.rarity === r && !used.has(c.id));
    const c = rng.pick(pool.length ? pool : CARDS.filter((x) => x.rarity === r));
    used.add(c.id);
    const amount = Math.max(1, Math.round(commonBase * RARITY_STACK_FACTOR[r] * rng.range(0.85, 1.15)));
    return { cardId: c.id, amount: r === 'legendaire' || r === 'abyssal' ? 1 : amount, rarity: r };
  });
  return { type, gold: rng.int(def.gold[0], def.gold[1]), crystals: rng.int(def.crystals[0], def.crystals[1]), cards };
}

export function openChestContents(s: SaveData, type: ChestType, rng: Rng): ChestContents {
  const roll = rollChest(type, rng);
  s.gold += roll.gold;
  s.crystals += roll.crystals;
  s.stats.chestsOpened++;
  const cards = roll.cards.map((c) => ({ ...c, isNew: grantCards(s, c.cardId, c.amount).isNew }));
  return { ...roll, cards };
}

export function addChestToSlot(s: SaveData, type: ChestType, now: number): ChestInstance | null {
  const idx = s.chests.slots.findIndex((x) => x === null);
  if (idx < 0) return null;
  const inst: ChestInstance = { id: `${type}-${now}-${idx}-${s.stats.chestsOpened}`, type, unlockAt: null, obtainedAt: now };
  s.chests.slots[idx] = inst;
  return inst;
}

export function startUnlock(s: SaveData, slot: number, now: number): Result {
  const c = s.chests.slots[slot];
  if (!c) return fail('Emplacement vide');
  if (c.unlockAt !== null) return fail('Déjà en cours');
  if (s.chests.slots.some((x) => x && x.unlockAt !== null && x.unlockAt > now)) return fail('Un autre coffre est déjà en cours d’ouverture');
  c.unlockAt = now + CHESTS[c.type].unlockSeconds * 1000;
  return { ok: true };
}

export function skipCost(s: SaveData, slot: number, now: number): number {
  const c = s.chests.slots[slot];
  if (!c) return 0;
  const remaining = c.unlockAt === null ? CHESTS[c.type].unlockSeconds : Math.max(0, (c.unlockAt - now) / 1000);
  return Math.ceil((remaining / 3600) * CHESTS[c.type].crystalSkipPerHour) + (remaining > 0 ? 1 : 0);
}

export function openSlot(s: SaveData, slot: number, now: number, rng: Rng, useCrystals = false): Result<ChestContents> {
  const c = s.chests.slots[slot];
  if (!c) return fail('Emplacement vide');
  const ready = c.unlockAt !== null && c.unlockAt <= now;
  if (!ready) {
    if (!useCrystals) return fail('Coffre verrouillé');
    const cost = skipCost(s, slot, now);
    if (s.crystals < cost) return fail('Cristaux insuffisants');
    s.crystals -= cost;
  }
  s.chests.slots[slot] = null; // retiré AVANT l'ouverture : aucune duplication possible
  return { ok: true, value: openChestContents(s, c.type, rng) };
}

export const FREE_CHEST_HOURS = 4;
export function openFreeChest(s: SaveData, now: number, rng: Rng): Result<ChestContents> {
  if (now < s.chests.freeAt) return fail('Offrande pas encore prête');
  s.chests.freeAt = now + FREE_CHEST_HOURS * 3600000;
  return { ok: true, value: openChestContents(s, 'coffre_gratuit', rng) };
}

export const CROWNS_FOR_CHEST = 10;
export function openCrownChest(s: SaveData, rng: Rng, today: string): Result<ChestContents> {
  if (s.chests.crownDay === today) return fail('Déjà ouvert aujourd’hui');
  if (s.chests.crowns < CROWNS_FOR_CHEST) return fail('Couronnes insuffisantes');
  s.chests.crowns = 0;
  s.chests.crownDay = today;
  return { ok: true, value: openChestContents(s, 'coffre_couronnes', rng) };
}

// ------------------------------------------------------------------ récompenses génériques
export function applyReward(s: SaveData, r: Reward, rng: Rng, now: number): { chest?: ChestContents; levelUps: LevelUp[] } {
  if (r.gold) s.gold += r.gold;
  if (r.crystals) s.crystals += r.crystals;
  for (const c of r.cards ?? []) grantCards(s, c.cardId, c.amount);
  if (r.passXp) s.pass.xp += r.passXp;
  if (r.cosmetic && !s.cosmetics.owned.includes(r.cosmetic)) s.cosmetics.owned.push(r.cosmetic);
  const levelUps = r.xp ? addXp(s, r.xp) : [];
  let chest: ChestContents | undefined;
  if (r.chest) chest = openChestContents(s, r.chest, rng);
  void now;
  return { chest, levelUps };
}

// ------------------------------------------------------------------ cosmétiques
export function buyCosmetic(s: SaveData, id: string): Result {
  const c = COSMETIC_MAP[id];
  if (!c || !c.price) return fail('Non disponible à l’achat');
  if (s.cosmetics.owned.includes(id)) return fail('Déjà possédé');
  if ((c.price.gold ?? 0) > s.gold) return fail('Or insuffisant');
  if ((c.price.crystals ?? 0) > s.crystals) return fail('Cristaux insuffisants');
  s.gold -= c.price.gold ?? 0;
  s.crystals -= c.price.crystals ?? 0;
  s.cosmetics.owned.push(id);
  return { ok: true };
}

export function equipCosmetic(s: SaveData, id: string): Result {
  const c = COSMETIC_MAP[id];
  if (!c || !s.cosmetics.owned.includes(id)) return fail('Cosmétique non possédé');
  if (c.kind === 'banniere') s.cosmetics.banner = id;
  else if (c.kind === 'emote') s.cosmetics.emote = id;
  else s.cosmetics.summonFx = id;
  return { ok: true };
}

export function rarityLabel(r: Rarity): string { return RARITY_INFO[r].label; }
