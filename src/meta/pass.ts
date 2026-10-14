// SUPER PASS : parcours gratuit et premium, paliers, XP de pass, saisons locales.
// Le parcours premium se débloque uniquement avec des cristaux gagnés en jeu (aucun paiement réel).
import { CARDS } from '../core/cards';
import { hashString, Rng } from '../core/rng';
import { applyReward, type ChestContents, type Result, type Reward } from './economy';
import type { SaveData } from './state';
import { seasonAt } from './time';

export const PASS_TIERS = 30;
export const XP_PER_TIER = 100;
export const PREMIUM_CRYSTALS = 450;

export interface PassTier { tier: number; free: Reward; premium: Reward }

function cardOf(seasonId: string, rarity: string, salt: number): string {
  const pool = CARDS.filter((c) => c.rarity === rarity);
  return pool[hashString(`${seasonId}:${rarity}:${salt}`) % pool.length].id;
}

export function passTiers(seasonId: string): PassTier[] {
  const tiers: PassTier[] = [];
  for (let t = 1; t <= PASS_TIERS; t++) {
    let free: Reward;
    if (t === 10) free = { cosmetic: 'emote_larmes', gold: 200 };
    else if (t === 20) free = { cosmetic: 'banniere_os', gold: 300 };
    else if (t === 30) free = { chest: 'coffre_abysse' };
    else if (t % 5 === 0) free = { chest: t >= 15 ? 'coffre_chitine' : 'coffre_chair' };
    else if (t % 3 === 0) free = { crystals: 10 };
    else free = { gold: 80 + t * 10 };
    let premium: Reward;
    if (t === 30) premium = { chest: 'coffre_legendaire', cosmetic: 'banniere_gouffre' };
    else if (t === 15) premium = { cosmetic: 'fx_abysse', crystals: 30 };
    else if (t === 25) premium = { cards: [{ cardId: cardOf(seasonId, 'legendaire', t), amount: 1 }] };
    else if (t % 5 === 0) premium = { chest: 'coffre_abysse' };
    else if (t % 4 === 0) premium = { cards: [{ cardId: cardOf(seasonId, 'epique', t), amount: 3 }] };
    else if (t % 3 === 0) premium = { cards: [{ cardId: cardOf(seasonId, 'mythique', t), amount: 2 }] };
    else if (t % 2 === 0) premium = { crystals: 15 };
    else premium = { gold: 250 + t * 20 };
    tiers.push({ tier: t, free, premium });
  }
  return tiers;
}

export function ensurePassSeason(s: SaveData, now: number): boolean {
  const season = seasonAt(now);
  if (s.pass.seasonId === season.id) return false;
  s.pass = { seasonId: season.id, xp: 0, premium: false, claimedFree: [], claimedPremium: [] };
  return true;
}

export function passTier(s: SaveData): number { return Math.min(PASS_TIERS, Math.floor(s.pass.xp / XP_PER_TIER)); }

export function unlockPremium(s: SaveData): Result {
  if (s.pass.premium) return { ok: false, reason: 'Déjà débloqué' };
  if (s.crystals < PREMIUM_CRYSTALS) return { ok: false, reason: 'Cristaux insuffisants' };
  s.crystals -= PREMIUM_CRYSTALS;
  s.pass.premium = true;
  return { ok: true };
}

export function claimTier(s: SaveData, tier: number, track: 'free' | 'premium', now: number): Result<{ reward: Reward; chest?: ChestContents }> {
  if (tier < 1 || tier > PASS_TIERS) return { ok: false, reason: 'Palier invalide' };
  if (passTier(s) < tier) return { ok: false, reason: 'Palier non atteint' };
  if (track === 'premium' && !s.pass.premium) return { ok: false, reason: 'Parcours premium verrouillé' };
  const claimed = track === 'free' ? s.pass.claimedFree : s.pass.claimedPremium;
  if (claimed.includes(tier)) return { ok: false, reason: 'Déjà réclamé' };
  claimed.push(tier); // marqué avant l'application : pas de double réclamation
  const reward = passTiers(s.pass.seasonId)[tier - 1][track];
  const rng = new Rng(hashString(`${s.pass.seasonId}:${tier}:${track}:${s.createdAt}`));
  const r = applyReward(s, reward, rng, now);
  return { ok: true, value: { reward, chest: r.chest } };
}
