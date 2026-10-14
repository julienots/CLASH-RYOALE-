// Sauvegarde locale robuste : somme de contrôle, copie de secours, réparation et migration.
import { CARD_MAP, CARDS } from '../core/cards';
import { hashString } from '../core/rng';
import { newSave, SAVE_VERSION, STARTER_DECK, type SaveData } from './state';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
  removeItem(k: string) { this.data.delete(k); }
}

export const SAVE_KEY = 'superessence.save';
export const BACKUP_KEY = 'superessence.save.backup';

interface Envelope { v: number; sum: number; data: string }

function wrap(data: SaveData): string {
  const json = JSON.stringify(data);
  const env: Envelope = { v: SAVE_VERSION, sum: hashString(json), data: json };
  return JSON.stringify(env);
}

function unwrap(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const env = JSON.parse(raw) as Envelope;
    if (typeof env.data !== 'string' || hashString(env.data) !== env.sum) return null;
    return JSON.parse(env.data) as SaveData;
  } catch {
    return null;
  }
}

const num = (v: unknown, def: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;

/** Répare / complète une sauvegarde (nouvelles cartes, valeurs invalides, decks illégaux). */
export function sanitize(s: SaveData, now: number): SaveData {
  const base = newSave(now);
  const out: SaveData = { ...base, ...s };
  out.version = SAVE_VERSION;
  out.profile = { ...base.profile, ...s.profile };
  out.profile.level = num(out.profile.level, 1, 1, 50);
  out.profile.xp = num(out.profile.xp, 0);
  out.profile.trophies = num(out.profile.trophies, 0);
  out.gold = Math.floor(num(s.gold, base.gold));
  out.crystals = Math.floor(num(s.crystals, base.crystals));
  out.collection = { ...base.collection };
  for (const c of CARDS) {
    const o = s.collection?.[c.id];
    if (o) out.collection[c.id] = { owned: !!o.owned, level: Math.floor(num(o.level, 1, 1, 14)), fragments: Math.floor(num(o.fragments, 0)) };
  }
  for (const id of STARTER_DECK) out.collection[id].owned = true;
  out.decks = [0, 1, 2].map((i) => {
    const d = s.decks?.[i];
    const valid = Array.isArray(d) && d.length === 8 && new Set(d).size === 8 && d.every((id) => CARD_MAP[id] && out.collection[id].owned);
    return valid ? d.slice() : STARTER_DECK.slice();
  });
  out.activeDeck = Math.floor(num(s.activeDeck, 0, 0, 2));
  out.chests = { ...base.chests, ...s.chests };
  if (!Array.isArray(out.chests.slots) || out.chests.slots.length !== 4) out.chests.slots = base.chests.slots;
  out.shop = { ...base.shop, ...s.shop };
  out.pass = { ...base.pass, ...s.pass };
  out.missions = { ...base.missions, ...s.missions };
  out.events = { ...base.events, ...s.events };
  out.cosmetics = { ...base.cosmetics, ...s.cosmetics };
  out.stats = { ...base.stats, ...s.stats };
  out.settings = { ...base.settings, ...s.settings };
  out.achievements = { ...(s.achievements ?? {}) };
  out.rewardedBattles = Array.isArray(s.rewardedBattles) ? s.rewardedBattles.slice(-50) : [];
  out.maxSeen = Math.max(num(s.maxSeen, now), 0);
  return out;
}

export class SaveManager {
  constructor(private store: KeyValueStore) {}

  load(now: number): { data: SaveData; recovered: 'main' | 'backup' | 'new' } {
    const main = unwrap(this.store.getItem(SAVE_KEY));
    if (main) return { data: sanitize(main, now), recovered: 'main' };
    const backup = unwrap(this.store.getItem(BACKUP_KEY));
    if (backup) return { data: sanitize(backup, now), recovered: 'backup' };
    return { data: newSave(now), recovered: 'new' };
  }

  /** Écriture : la sauvegarde principale valide devient la copie de secours avant d'être remplacée. */
  save(data: SaveData): void {
    const payload = wrap(data);
    const current = this.store.getItem(SAVE_KEY);
    if (current && unwrap(current)) this.store.setItem(BACKUP_KEY, current);
    this.store.setItem(SAVE_KEY, payload);
    // Vérification immédiate de la relecture.
    if (!unwrap(this.store.getItem(SAVE_KEY))) throw new Error('Échec de vérification de la sauvegarde');
  }

  reset(): void {
    this.store.removeItem(SAVE_KEY);
    this.store.removeItem(BACKUP_KEY);
  }
}
