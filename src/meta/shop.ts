// Boutique hors ligne : offres quotidiennes déterministes, sections permanentes, limites d'achat.
// Aucune transaction en argent réel : seules les monnaies virtuelles gagnées en jeu sont utilisées.
import { CARDS, CARD_MAP } from '../core/cards';
import { hashString, Rng } from '../core/rng';
import type { Rarity } from '../core/types';
import { CHESTS } from './catalog';
import { type ChestContents, grantCards, openChestContents, type Result } from './economy';
import type { ChestType, SaveData, ShopOfferState } from './state';
import { dayKey, weekKey } from './time';

export const FRAGMENT_PRICE: Record<Rarity, { price: number; amount: number }> = {
  commun: { price: 8, amount: 10 },
  rare: { price: 40, amount: 5 },
  epique: { price: 300, amount: 2 },
  mythique: { price: 700, amount: 1 },
  legendaire: { price: 40000, amount: 1 },
  abyssal: { price: 60000, amount: 1 },
};

export interface PermanentOffer {
  id: string; section: 'coffres' | 'ressources' | 'speciales';
  name: string; description: string;
  price: number; currency: 'gold' | 'crystals';
  chest?: ChestType; gold?: number; extraChest?: ChestType;
  /** Limite par semaine (0 = illimité). */
  weeklyLimit: number;
}

export const PERMANENT_OFFERS: PermanentOffer[] = [
  { id: 'p_chair', section: 'coffres', name: CHESTS.coffre_chair.name, description: 'Ouverture immédiate.', price: 40, currency: 'crystals', chest: 'coffre_chair', weeklyLimit: 0 },
  { id: 'p_chitine', section: 'coffres', name: CHESTS.coffre_chitine.name, description: 'Ouverture immédiate. 1 épique garantie.', price: 120, currency: 'crystals', chest: 'coffre_chitine', weeklyLimit: 0 },
  { id: 'p_abysse', section: 'coffres', name: CHESTS.coffre_abysse.name, description: 'Ouverture immédiate. Épique + mythique garanties.', price: 300, currency: 'crystals', chest: 'coffre_abysse', weeklyLimit: 0 },
  { id: 'p_legendaire', section: 'coffres', name: CHESTS.coffre_legendaire.name, description: '1 carte légendaire (92 %) ou abyssale (8 %).', price: 500, currency: 'crystals', chest: 'coffre_legendaire', weeklyLimit: 1 },
  { id: 'p_or_1', section: 'ressources', name: 'Bourse de dents d’or', description: '+1 000 or.', price: 60, currency: 'crystals', gold: 1000, weeklyLimit: 0 },
  { id: 'p_or_2', section: 'ressources', name: 'Coffret de dents d’or', description: '+5 000 or.', price: 250, currency: 'crystals', gold: 5000, weeklyLimit: 0 },
  { id: 'p_nuit_sanglante', section: 'speciales', name: 'Pack Nuit Sanglante', description: 'Coffre des Abysses + 2 000 or. 1 par semaine.', price: 350, currency: 'crystals', chest: 'coffre_abysse', gold: 2000, weeklyLimit: 1 },
  { id: 'p_reliques', section: 'speciales', name: 'Reliques du Gouffre', description: 'Coffre de Chair + Reliquaire de Chitine pour de l’or. 1 par semaine.', price: 4000, currency: 'gold', chest: 'coffre_chair', extraChest: 'coffre_chitine', weeklyLimit: 1 },
];

/** Génère (ou conserve) les offres du jour. Idempotent pour un même jour. */
export function refreshShop(s: SaveData, now: number): boolean {
  const day = dayKey(now);
  let changed = false;
  if (s.shop.day !== day) {
    s.shop.day = day;
    s.shop.offers = generateDailyOffers(s, day);
    s.shop.purchases = {};
    changed = true;
  }
  const wk = weekKey(now);
  if (s.shop.weekly !== wk) { s.shop.weekly = wk; s.shop.weeklyPurchases = {}; changed = true; }
  return changed;
}

export function generateDailyOffers(s: SaveData, day: string): ShopOfferState[] {
  const rng = new Rng(hashString(`shop:${day}:${s.createdAt}`));
  const offers: ShopOfferState[] = [];
  const ownedOf = (r: Rarity) => CARDS.filter((c) => c.rarity === r && s.collection[c.id].owned);
  const anyOf = (r: Rarity) => CARDS.filter((c) => c.rarity === r);
  offers.push({ id: `${day}-gift`, kind: 'gift', amount: 40 + rng.int(0, 4) * 10, price: 0, currency: 'free', limit: 1 });
  const used = new Set<string>();
  for (const r of ['commun', 'commun', 'rare', rng.next() < 0.5 ? 'epique' : 'mythique'] as Rarity[]) {
    const pool = (ownedOf(r).length >= 2 ? ownedOf(r) : anyOf(r)).filter((c) => !used.has(c.id));
    const c = rng.pick(pool.length ? pool : anyOf(r));
    used.add(c.id);
    const fp = FRAGMENT_PRICE[r];
    offers.push({ id: `${day}-card-${c.id}`, kind: 'card', cardId: c.id, amount: fp.amount, price: fp.price * fp.amount, currency: 'gold', limit: r === 'commun' ? 3 : r === 'rare' ? 2 : 1 });
  }
  const chest = rng.pick(['coffre_chair', 'coffre_chitine'] as ChestType[]);
  offers.push({ id: `${day}-chest`, kind: 'chest', chest, amount: 1, price: chest === 'coffre_chair' ? 25 : 90, currency: 'crystals', limit: 1 });
  return offers;
}

export interface PurchaseResult { gold?: number; cards?: { cardId: string; amount: number; isNew: boolean }[]; chests?: ChestContents[] }

function pay(s: SaveData, price: number, currency: 'gold' | 'crystals' | 'free'): Result {
  if (currency === 'free') return { ok: true };
  const have = currency === 'gold' ? s.gold : s.crystals;
  if (have < price) return { ok: false, reason: currency === 'gold' ? 'Or insuffisant' : 'Cristaux insuffisants' };
  if (currency === 'gold') s.gold -= price; else s.crystals -= price;
  return { ok: true };
}

export function buyDailyOffer(s: SaveData, offerId: string, now: number, rng: Rng): Result<PurchaseResult> {
  refreshShop(s, now);
  const o = s.shop.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, reason: 'Offre expirée' };
  const bought = s.shop.purchases[o.id] ?? 0;
  if (bought >= o.limit) return { ok: false, reason: 'Limite d’achat atteinte' };
  const p = pay(s, o.price, o.currency);
  if (!p.ok) return { ok: false, reason: p.reason };
  s.shop.purchases[o.id] = bought + 1;
  if (o.kind === 'gift') { s.gold += o.amount; return { ok: true, value: { gold: o.amount } }; }
  if (o.kind === 'card') { const r = grantCards(s, o.cardId!, o.amount); return { ok: true, value: { cards: [{ cardId: o.cardId!, amount: o.amount, isNew: r.isNew }] } }; }
  return { ok: true, value: { chests: [openChestContents(s, o.chest!, rng)] } };
}

export function buyPermanentOffer(s: SaveData, offerId: string, now: number, rng: Rng): Result<PurchaseResult> {
  refreshShop(s, now);
  const o = PERMANENT_OFFERS.find((x) => x.id === offerId);
  if (!o) return { ok: false, reason: 'Offre inconnue' };
  const bought = s.shop.weeklyPurchases[o.id] ?? 0;
  if (o.weeklyLimit > 0 && bought >= o.weeklyLimit) return { ok: false, reason: 'Limite hebdomadaire atteinte' };
  const p = pay(s, o.price, o.currency);
  if (!p.ok) return { ok: false, reason: p.reason };
  s.shop.weeklyPurchases[o.id] = bought + 1;
  const res: PurchaseResult = { chests: [] };
  if (o.gold) { s.gold += o.gold; res.gold = o.gold; }
  if (o.chest) res.chests!.push(openChestContents(s, o.chest, rng));
  if (o.extraChest) res.chests!.push(openChestContents(s, o.extraChest, rng));
  return { ok: true, value: res };
}

export function offerLabel(o: ShopOfferState): string {
  if (o.kind === 'gift') return `Offrande quotidienne : ${o.amount} or`;
  if (o.kind === 'card') return `${CARD_MAP[o.cardId!].name} ×${o.amount}`;
  return CHESTS[o.chest!].name;
}
