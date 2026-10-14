// Façade de jeu : charge la sauvegarde, rafraîchit les systèmes temporels et persiste chaque transaction.
import { hashString, Rng } from '../core/rng';
import { effectiveNow } from './economy';
import { refreshEvents } from './events';
import { refreshMissions } from './missions';
import { ensurePassSeason } from './pass';
import { type KeyValueStore, SaveManager } from './save';
import { refreshShop } from './shop';
import type { SaveData } from './state';
import { type Clock, systemClock } from './time';

export class Game {
  data: SaveData;
  readonly saves: SaveManager;
  recovered: 'main' | 'backup' | 'new';
  private listeners = new Set<() => void>();
  private rngCounter = 0;

  constructor(store: KeyValueStore, readonly clock: Clock = systemClock) {
    this.saves = new SaveManager(store);
    const loaded = this.saves.load(clock.now());
    this.data = loaded.data;
    this.recovered = loaded.recovered;
    this.refresh();
    this.persist();
  }

  /** Temps effectif (jamais en arrière, même si l'horloge système recule). */
  now(): number { return effectiveNow(this.data, this.clock.now()); }

  /** Met à jour boutique, missions, événements et saison selon l'horloge. */
  refresh(): boolean {
    const now = this.now();
    const a = refreshShop(this.data, now);
    const b = refreshMissions(this.data, now);
    const c = refreshEvents(this.data, now);
    const d = ensurePassSeason(this.data, now);
    return a || b || c || d;
  }

  rng(tag: string): Rng {
    return new Rng(hashString(`${tag}:${this.now()}:${this.rngCounter++}:${this.data.stats.chestsOpened}`));
  }

  /** Exécute une transaction : si elle échoue, l'état est restauré ; sinon il est sauvegardé. */
  transact<T extends { ok: boolean }>(fn: (s: SaveData, now: number) => T): T {
    const snapshot = JSON.stringify(this.data);
    let res: T;
    try {
      res = fn(this.data, this.now());
    } catch (e) {
      this.data = JSON.parse(snapshot);
      throw e;
    }
    if (!res.ok) this.data = JSON.parse(snapshot);
    else this.persist();
    this.emit();
    return res;
  }

  persist(): void { this.saves.save(this.data); }

  onChange(fn: () => void): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(): void { for (const l of this.listeners) l(); }

  resetAll(): void {
    this.saves.reset();
    const loaded = this.saves.load(this.clock.now());
    this.data = loaded.data;
    this.refresh();
    this.persist();
    this.emit();
  }
}
