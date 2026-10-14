// Simulation de combat en temps réel, déterministe et indépendante du rendu.
// Repère : arène de 18 × 32 cases. Le joueur 0 est en bas (y grand), le joueur 1 en haut.
import { getCard, getUnit } from '../core/cards';
import { statMultiplier, powerLevel } from '../core/progression';
import { Rng } from '../core/rng';
import type { Ability, CardDef, PlayerId, TargetType, UnitDef } from '../core/types';

export const ARENA_W = 18;
export const ARENA_H = 32;
export const RIVER_Y = 16;
export const RIVER_HALF = 1;
export const BRIDGES = [3.5, 14.5];
export const BRIDGE_HALF = 1.1;
export const STEP = 1 / 30;
export const MAX_ESSENCE = 10;
export const ESSENCE_PER_SEC = 1 / 2.8;

export interface DeckEntry { cardId: string; level: number }

export interface BattleConfig {
  seed: number;
  decks: [DeckEntry[], DeckEntry[]];
  towerPower: [number, number];
  /** Durée réglementaire (s). */
  duration?: number;
  /** Prolongation en mort subite (s). 0 = aucune. */
  overtime?: number;
  /** Secondes restantes à partir desquelles l'essence est doublée. */
  doubleAt?: number;
  essenceMult?: [number, number];
  startEssence?: number;
  towerHpMult?: number;
  /** Mélange désactivé (tests) : la main suit l'ordre du deck. */
  noShuffle?: boolean;
}

export type EntityKind = 'unit' | 'building' | 'tower';

export interface Poison { dps: number; until: number; src: PlayerId }

export interface Entity {
  id: number;
  owner: PlayerId;
  kind: EntityKind;
  def: UnitDef | null;
  cardId: string | null;
  towerType?: 'king' | 'princess';
  name: string;
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHp: number; shield: number;
  radius: number; mass: number; flying: boolean;
  damage: number; hitSpeed: number; range: number; speed: number; sight: number;
  targets: TargetType; splash: number; projectile: number;
  mult: number;
  power: number;
  targetId: number | null;
  attackCd: number;
  retargetCd: number;
  deploy: number;
  age: number;
  lifetime: number;
  alive: boolean;
  active: boolean; // tour du roi
  stunUntil: number; slowUntil: number; slowAmt: number; rootUntil: number;
  poisons: Poison[];
  haste: number; fear: number;
  ab: Record<string, number>;
  lastAttack: number; lastHit: number;
  facing: number;
  hidden: boolean;
  /** Pour les tours : était-elle déjà détruite ? */
  crownCounted?: boolean;
}

export interface Projectile {
  id: number; owner: PlayerId; srcId: number;
  x: number; y: number; tx: number; ty: number; targetId: number | null;
  speed: number; damage: number; splash: number; targets: TargetType;
  style: string;
  pierce?: { dx: number; dy: number; left: number; width: number; hit: number[] };
  fromTower: boolean;
}

export interface Zone {
  id: number; owner: PlayerId; x: number; y: number; radius: number;
  until: number; dps: number; slow: number; pull: number; endDamage: number;
  towerPct: number; style: string; started: number;
}

export interface PendingSpell { owner: PlayerId; card: CardDef; mult: number; x: number; y: number; at: number; cast: number }

export type BattleEvent =
  | { t: 'deploy'; owner: PlayerId; cardId: string; x: number; y: number }
  | { t: 'spawn'; id: number }
  | { t: 'attack'; id: number; targetId: number; melee: boolean }
  | { t: 'hit'; x: number; y: number; amount: number; owner: PlayerId; tower: boolean }
  | { t: 'death'; id: number; x: number; y: number; owner: PlayerId; unitId: string; size: number; kind: EntityKind }
  | { t: 'blast'; x: number; y: number; radius: number; color: string }
  | { t: 'spellCast'; owner: PlayerId; cardId: string; x: number; y: number; radius: number; delay: number }
  | { t: 'spellImpact'; owner: PlayerId; cardId: string; x: number; y: number; radius: number }
  | { t: 'chain'; pts: { x: number; y: number }[]; color: string }
  | { t: 'towerDown'; owner: PlayerId; king: boolean; x: number; y: number }
  | { t: 'heal'; x: number; y: number }
  | { t: 'special'; kind: string; x: number; y: number; x2?: number; y2?: number }
  | { t: 'essence'; owner: PlayerId; amount: number };

export interface PlayerState {
  essence: number;
  deck: DeckEntry[];
  hand: (DeckEntry | null)[];
  queue: DeckEntry[];
  crowns: number;
  stats: {
    cardsPlayed: number; spellsCast: number; unitsDeployed: number;
    damageToTowers: number; unitsKilled: number; essenceSpent: number;
    essenceWasted: number; played: Record<string, number>;
  };
}

export interface BattleResult {
  winner: PlayerId | null;
  crowns: [number, number];
  time: number;
  overtime: boolean;
  reason: 'king' | 'time' | 'suddenDeath' | 'tiebreak' | 'draw' | 'forfeit';
}

const TOWER_STATS = {
  princess: { hp: 2000, damage: 80, hitSpeed: 0.8, range: 7.5, radius: 1.5 },
  king: { hp: 3200, damage: 90, hitSpeed: 1.0, range: 7, radius: 2.0 },
};

export function towerLayout(owner: PlayerId): { type: 'king' | 'princess'; x: number; y: number }[] {
  const m = (y: number) => (owner === 0 ? y : ARENA_H - y);
  return [
    { type: 'king', x: 9, y: m(29.5) },
    { type: 'princess', x: 3.5, y: m(25.5) },
    { type: 'princess', x: 14.5, y: m(25.5) },
  ];
}

function abil<T extends Ability['type']>(e: Entity, type: T): Extract<Ability, { type: T }> | undefined {
  return e.def?.abilities?.find((a) => a.type === type) as Extract<Ability, { type: T }> | undefined;
}

export class Battle {
  readonly cfg: Required<Omit<BattleConfig, 'noShuffle'>> & { noShuffle: boolean };
  readonly rng: Rng;
  time = 0;
  entities: Entity[] = [];
  projectiles: Projectile[] = [];
  zones: Zone[] = [];
  pending: PendingSpell[] = [];
  events: BattleEvent[] = [];
  players: [PlayerState, PlayerState];
  result: BattleResult | null = null;
  overtime = false;
  paused = false;
  private nextId = 1;
  private acc = 0;

  constructor(config: BattleConfig) {
    this.cfg = {
      duration: 180, overtime: 60, doubleAt: 60, essenceMult: [1, 1], startEssence: 5, towerHpMult: 1, noShuffle: false,
      ...config,
    };
    this.rng = new Rng(config.seed);
    this.players = [this.makePlayer(config.decks[0]), this.makePlayer(config.decks[1])];
    for (const owner of [0, 1] as PlayerId[]) {
      for (const t of towerLayout(owner)) this.addTower(owner, t.type, t.x, t.y);
    }
  }

  private makePlayer(deck: DeckEntry[]): PlayerState {
    if (deck.length !== 8) throw new Error('Un deck doit contenir exactement 8 cartes');
    const order = deck.map((d) => ({ ...d }));
    if (!this.cfg.noShuffle) this.rng.shuffle(order);
    return {
      essence: this.cfg.startEssence,
      deck: deck.map((d) => ({ ...d })),
      hand: order.slice(0, 4),
      queue: order.slice(4),
      crowns: 0,
      stats: { cardsPlayed: 0, spellsCast: 0, unitsDeployed: 0, damageToTowers: 0, unitsKilled: 0, essenceSpent: 0, essenceWasted: 0, played: {} },
    };
  }

  // ------------------------------------------------------------------ helpers
  get timeLeft(): number {
    return this.overtime ? this.cfg.duration + this.cfg.overtime - this.time : this.cfg.duration - this.time;
  }
  get doubleEssence(): boolean { return this.overtime || this.cfg.duration - this.time <= this.cfg.doubleAt; }
  byId(id: number | null): Entity | undefined {
    if (id == null) return undefined;
    for (const e of this.entities) if (e.id === id) return e;
    return undefined;
  }
  towers(owner: PlayerId): Entity[] { return this.entities.filter((e) => e.kind === 'tower' && e.owner === owner && e.alive); }
  king(owner: PlayerId): Entity | undefined { return this.entities.find((e) => e.kind === 'tower' && e.owner === owner && e.towerType === 'king'); }
  private emit(ev: BattleEvent): void {
    this.events.push(ev);
    if (this.events.length > 4000) this.events.splice(0, 1000);
  }
  drainEvents(): BattleEvent[] { const ev = this.events; this.events = []; return ev; }

  private baseEntity(owner: PlayerId, kind: EntityKind, x: number, y: number): Entity {
    return {
      id: this.nextId++, owner, kind, def: null, cardId: null, name: '', x, y, vx: 0, vy: 0,
      hp: 1, maxHp: 1, shield: 0, radius: 0.45, mass: 4, flying: false,
      damage: 0, hitSpeed: 1, range: 1, speed: 0, sight: 5.5, targets: 'ground', splash: 0, projectile: 0, mult: 1, power: 9,
      targetId: null, attackCd: 0, retargetCd: 0, deploy: 0, age: 0, lifetime: 0, alive: true, active: true,
      stunUntil: 0, slowUntil: 0, slowAmt: 0, rootUntil: 0, poisons: [], haste: 1, fear: 1, ab: {},
      lastAttack: -99, lastHit: -99, facing: owner === 0 ? -Math.PI / 2 : Math.PI / 2, hidden: false,
    };
  }

  private addTower(owner: PlayerId, type: 'king' | 'princess', x: number, y: number): Entity {
    const s = TOWER_STATS[type];
    const m = statMultiplier(this.cfg.towerPower[owner]);
    const e = this.baseEntity(owner, 'tower', x, y);
    Object.assign(e, {
      towerType: type, name: type === 'king' ? 'Cœur-Roi' : 'Tour-Sentinelle',
      hp: s.hp * m * this.cfg.towerHpMult, maxHp: s.hp * m * this.cfg.towerHpMult, damage: s.damage * m, hitSpeed: s.hitSpeed,
      range: s.range, sight: s.range, radius: s.radius, mass: 9999, mult: m, power: this.cfg.towerPower[owner], targets: 'both', projectile: 16, active: type !== 'king',
    });
    this.entities.push(e);
    return e;
  }

  spawnUnit(owner: PlayerId, unitId: string, x: number, y: number, power: number, cardId: string | null, deploy = 1): Entity {
    const d = getUnit(unitId);
    const m = statMultiplier(power);
    const e = this.baseEntity(owner, d.building ? 'building' : 'unit', x, y);
    Object.assign(e, {
      def: d, cardId, name: d.name, hp: d.hp * m, maxHp: d.hp * m, shield: (d.shield ?? 0) * m,
      radius: d.radius, mass: d.mass, flying: !!d.flying, damage: d.damage * m, hitSpeed: d.hitSpeed,
      range: d.range, speed: d.speed, sight: d.sight, targets: d.targets, splash: d.splash ?? 0, projectile: d.projectile ?? 0,
      mult: m, power, deploy, lifetime: d.lifetime ?? 0,
      hidden: !!d.abilities?.some((a) => a.type === 'stealth' || a.type === 'trap'),
    });
    const sp = abil(e, 'spawner');
    if (sp) e.ab.spawnT = d.building ? 1.5 : sp.interval;
    const pump = abil(e, 'essencePump');
    if (pump) e.ab.pumpT = pump.interval;
    const sh = abil(e, 'shieldPulse');
    if (sh) e.ab.shieldT = 0.5;
    const tide = abil(e, 'tidePull');
    if (tide) e.ab.tideT = 2;
    this.clampPos(e);
    this.entities.push(e);
    this.emit({ t: 'spawn', id: e.id });
    return e;
  }

  // ------------------------------------------------------------------ déploiement
  /** Zone légale de déploiement pour une carte. */
  canDeployAt(owner: PlayerId, card: CardDef, x: number, y: number): boolean {
    if (x < 0.5 || x > ARENA_W - 0.5 || y < 0.5 || y > ARENA_H - 0.5) return false;
    if (card.kind === 'spell') return true;
    if (Math.abs(y - RIVER_Y) < RIVER_HALF + 0.2) return false;
    for (const t of this.entities) {
      if (t.kind === 'tower' && t.alive && Math.hypot(t.x - x, t.y - y) < t.radius + 0.3) return false;
    }
    const enemy: PlayerId = owner === 0 ? 1 : 0;
    if (card.deployAnywhere) {
      const k = this.king(enemy);
      return !k || Math.hypot(k.x - x, k.y - y) > 4.5;
    }
    const ownHalf = owner === 0 ? y > RIVER_Y + RIVER_HALF : y < RIVER_Y - RIVER_HALF;
    if (ownHalf) return true;
    // Poche avancée si la tour adverse de cette voie est tombée.
    const lane = x < ARENA_W / 2 ? 0 : 1;
    const enemyPrincess = this.entities.find((t) => t.kind === 'tower' && t.owner === enemy && t.towerType === 'princess' && (lane === 0 ? t.x < 9 : t.x > 9));
    if (enemyPrincess && !enemyPrincess.alive) {
      return owner === 0 ? y >= 11 : y <= ARENA_H - 11;
    }
    return false;
  }

  playCard(owner: PlayerId, handIndex: number, x: number, y: number): { ok: boolean; reason?: string } {
    if (this.result) return { ok: false, reason: 'Combat terminé' };
    const p = this.players[owner];
    const entry = p.hand[handIndex];
    if (!entry) return { ok: false, reason: 'Carte absente' };
    const card = getCard(entry.cardId);
    if (p.essence + 1e-6 < card.cost) return { ok: false, reason: 'Essence insuffisante' };
    x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2;
    if (!this.canDeployAt(owner, card, x, y)) return { ok: false, reason: 'Zone de déploiement interdite' };
    p.essence -= card.cost;
    p.stats.essenceSpent += card.cost;
    p.stats.cardsPlayed++;
    p.stats.played[card.id] = (p.stats.played[card.id] ?? 0) + 1;
    // Cycle : la carte jouée part en fin de file, la suivante prend sa place.
    p.queue.push(entry);
    p.hand[handIndex] = p.queue.shift() ?? null;
    const power = powerLevel(card.rarity, entry.level);
    this.emit({ t: 'deploy', owner, cardId: card.id, x, y });
    if (card.kind === 'spell' && card.spell) {
      p.stats.spellsCast++;
      const mult = statMultiplier(power);
      this.pending.push({ owner, card, mult, x, y, at: this.time + card.spell.delay, cast: this.time });
      this.emit({ t: 'spellCast', owner, cardId: card.id, x, y, radius: card.spell.radius, delay: card.spell.delay });
    } else {
      p.stats.unitsDeployed++;
      for (const s of card.spawns ?? []) {
        for (let i = 0; i < s.count; i++) {
          const [ox, oy] = this.formation(i, s.count, getUnit(s.unit).radius);
          this.spawnUnit(owner, s.unit, x + ox, y + oy, power, card.id, 1);
        }
      }
    }
    return { ok: true };
  }

  private formation(i: number, n: number, r: number): [number, number] {
    if (n === 1) return [0, 0];
    const ang = (i / n) * Math.PI * 2 + Math.PI / 4;
    const d = Math.max(0.5, r * 2.2) * (n > 3 ? 1.1 : 0.9);
    return [Math.cos(ang) * d, Math.sin(ang) * d];
  }

  // ------------------------------------------------------------------ boucle
  /** Avance le temps réel en pas fixes. */
  update(realDt: number): void {
    if (this.paused || this.result) return;
    this.acc += Math.min(realDt, 0.25);
    while (this.acc >= STEP && !this.result) { this.step(STEP); this.acc -= STEP; }
  }

  step(dt: number = STEP): void {
    if (this.result) return;
    this.time += dt;
    this.regenEssence(dt);
    this.resolvePendingSpells();
    this.applyAuras(dt);
    for (const e of this.entities) if (e.alive) this.updateEntity(e, dt);
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.separate();
    this.cleanupDead();
    this.checkEnd();
  }

  private regenEssence(dt: number): void {
    for (const owner of [0, 1] as PlayerId[]) {
      const p = this.players[owner];
      const rate = ESSENCE_PER_SEC * this.cfg.essenceMult[owner] * (this.doubleEssence ? 2 : 1);
      const before = p.essence;
      p.essence = Math.min(MAX_ESSENCE, p.essence + rate * dt);
      if (before >= MAX_ESSENCE - 1e-9) p.stats.essenceWasted += rate * dt;
    }
  }

  // ------------------------------------------------------------------ sorts
  private resolvePendingSpells(): void {
    const ready = this.pending.filter((s) => s.at <= this.time);
    if (!ready.length) return;
    this.pending = this.pending.filter((s) => s.at > this.time);
    for (const s of ready) this.castSpell(s);
  }

  private castSpell(s: PendingSpell): void {
    const sp = s.card.spell!;
    const enemy: PlayerId = s.owner === 0 ? 1 : 0;
    this.emit({ t: 'spellImpact', owner: s.owner, cardId: s.card.id, x: s.x, y: s.y, radius: sp.radius });
    if (sp.affects === 'allies') {
      for (const e of this.entities) {
        if (!e.alive || e.owner !== s.owner || e.kind === 'tower') continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) > sp.radius + e.radius) continue;
        if (sp.heal) { e.hp = Math.min(e.maxHp, e.hp + sp.heal * s.mult); this.emit({ t: 'heal', x: e.x, y: e.y }); }
        if (sp.shield) e.shield = Math.max(e.shield, sp.shield * s.mult);
      }
      return;
    }
    if (sp.duration) {
      this.zones.push({
        id: this.nextId++, owner: s.owner, x: s.x, y: s.y, radius: sp.radius, until: this.time + sp.duration,
        dps: (sp.dps ?? 0) * s.mult, slow: sp.slow ?? 0, pull: sp.pull ?? 0, endDamage: (sp.pull ? sp.damage ?? 0 : 0) * s.mult,
        towerPct: sp.towerPct ?? 0.3, style: s.card.id, started: this.time,
      });
      if (sp.pull) return; // les dégâts de la fosse tombent à la fermeture
    }
    if (sp.damage || sp.stun || sp.knockback) {
      for (const e of this.entities) {
        if (!e.alive || e.owner !== enemy) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) > sp.radius + e.radius * 0.5) continue;
        if (sp.damage) {
          const amt = sp.damage * s.mult * (e.kind === 'tower' ? sp.towerPct ?? 0.3 : 1);
          this.dealDamage(null, s.owner, e, amt, { spell: true });
        }
        if (e.kind === 'unit') {
          if (sp.stun) this.stun(e, sp.stun);
          if (sp.knockback && e.mass < 15) {
            const d = Math.hypot(e.x - s.x, e.y - s.y) || 1;
            e.x += ((e.x - s.x) / d) * sp.knockback; e.y += ((e.y - s.y) / d) * sp.knockback;
            this.clampPos(e);
          }
        }
      }
    }
    if (sp.crater) {
      this.zones.push({
        id: this.nextId++, owner: s.owner, x: s.x, y: s.y, radius: sp.radius * 0.8, until: this.time + sp.crater.duration,
        dps: sp.crater.dps * s.mult, slow: 0, pull: 0, endDamage: 0, towerPct: 0.3, style: 'crater', started: this.time,
      });
    }
    if (sp.spawn) {
      for (let i = 0; i < sp.spawn.count; i++) {
        const [ox, oy] = this.formation(i, sp.spawn.count, 0.3);
        this.spawnUnit(s.owner, sp.spawn.unit, s.x + ox, s.y + oy, 9, s.card.id, 0.5);
      }
    }
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      const enemy: PlayerId = z.owner === 0 ? 1 : 0;
      for (const e of this.entities) {
        if (!e.alive || e.owner !== enemy) continue;
        const d = Math.hypot(e.x - z.x, e.y - z.y);
        if (d > z.radius + e.radius * 0.5) continue;
        if (z.dps) this.dealDamage(null, z.owner, e, z.dps * dt * (e.kind === 'tower' ? z.towerPct : 1), { spell: true, quiet: true });
        if (e.kind === 'unit') {
          if (z.slow) { e.slowAmt = Math.max(e.slowAmt, z.slow); e.slowUntil = Math.max(e.slowUntil, this.time + 0.2); }
          if (z.pull && d > 0.3 && e.mass < 20) {
            const k = Math.min(d, z.pull * dt);
            e.x -= ((e.x - z.x) / d) * k; e.y -= ((e.y - z.y) / d) * k;
          }
        }
      }
      if (this.time >= z.until && z.endDamage) {
        for (const e of this.entities) {
          if (!e.alive || e.owner !== enemy || e.kind === 'tower' || e.kind === 'building') continue;
          if (Math.hypot(e.x - z.x, e.y - z.y) <= z.radius + e.radius * 0.5) this.dealDamage(null, z.owner, e, z.endDamage, { spell: true });
        }
        this.emit({ t: 'blast', x: z.x, y: z.y, radius: z.radius, color: '#4dfff0' });
      }
    }
    this.zones = this.zones.filter((z) => this.time < z.until);
  }

  // ------------------------------------------------------------------ auras
  private applyAuras(dt: number): void {
    for (const e of this.entities) { e.haste = 1; e.fear = 1; }
    for (const src of this.entities) {
      if (!src.alive || src.deploy > 0 || !src.def?.abilities) continue;
      for (const a of src.def.abilities) {
        if (a.type !== 'aura') continue;
        for (const e of this.entities) {
          if (!e.alive || e === src || e.kind === 'tower') continue;
          if (Math.hypot(e.x - src.x, e.y - src.y) > a.radius + e.radius) continue;
          const ally = e.owner === src.owner;
          if (a.effect === 'heal' && ally && e.kind === 'unit' && e.hp < e.maxHp) {
            e.hp = Math.min(e.maxHp, e.hp + a.value * src.mult * dt);
            if (Math.floor(this.time * 1.5) !== Math.floor((this.time - dt) * 1.5)) this.emit({ t: 'heal', x: e.x, y: e.y });
          } else if (a.effect === 'haste' && ally) e.haste = Math.max(e.haste, a.value);
          else if (a.effect === 'fear' && !ally) e.fear = Math.min(e.fear, 1 - a.value);
          else if (a.effect === 'poison' && !ally) this.dealDamage(src, src.owner, e, a.value * src.mult * dt, { quiet: true, spell: true });
        }
      }
    }
  }

  // ------------------------------------------------------------------ entités
  private stun(e: Entity, dur: number): void {
    e.stunUntil = Math.max(e.stunUntil, this.time + dur);
    e.ab.chargeDist = 0; e.ab.rampTime = 0; e.attackCd = Math.max(e.attackCd, 0.2);
  }

  private moveMult(e: Entity): number {
    let m = e.haste * e.fear;
    if (this.time < e.slowUntil) m *= 1 - e.slowAmt;
    const en = abil(e, 'enrage');
    if (en && e.hp / e.maxHp < en.threshold) m *= en.speedMult;
    const ch = abil(e, 'charge');
    if (ch && (e.ab.chargeDist ?? 0) >= ch.distance) m *= ch.speedMult;
    return m;
  }
  private attackMult(e: Entity): number {
    let m = e.haste * e.fear;
    if (this.time < e.slowUntil) m *= 1 - e.slowAmt;
    const en = abil(e, 'enrage');
    if (en && e.hp / e.maxHp < en.threshold) m /= en.hitSpeedMult;
    return m;
  }

  canTarget(a: Entity, t: Entity): boolean {
    if (!t.alive || t.owner === a.owner) return false;
    if (t.hidden && t.kind !== 'tower') return false;
    switch (a.targets) {
      case 'buildings': return t.kind !== 'unit';
      case 'ground': return !t.flying;
      case 'air': return t.flying;
      default: return true;
    }
  }

  edgeDist(a: Entity, b: Entity): number {
    return Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
  }

  private findTarget(e: Entity, maxDist: number): Entity | undefined {
    let best: Entity | undefined; let bd = Infinity;
    for (const t of this.entities) {
      if (!this.canTarget(e, t)) continue;
      const d = this.edgeDist(e, t);
      if (d <= maxDist && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  /** Objectif par défaut : la tour de la voie, sinon le roi. */
  private laneObjective(e: Entity): Entity | undefined {
    const enemy: PlayerId = e.owner === 0 ? 1 : 0;
    const towers = this.towers(enemy);
    const left = e.x < ARENA_W / 2;
    const princess = towers.find((t) => t.towerType === 'princess' && (left ? t.x < 9 : t.x > 9));
    if (princess) return princess;
    let best: Entity | undefined; let bd = Infinity;
    for (const t of towers) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < bd) { bd = d; best = t; } }
    return best;
  }

  private updateEntity(e: Entity, dt: number): void {
    e.age += dt;
    // Poisons
    if (e.poisons.length) {
      for (const p of e.poisons) this.dealDamage(null, p.src, e, p.dps * dt, { quiet: true, spell: true });
      e.poisons = e.poisons.filter((p) => p.until > this.time);
    }
    if (!e.alive) return;
    if (e.kind === 'building' && e.lifetime > 0) {
      e.hp -= (e.maxHp / e.lifetime) * dt;
      if (e.hp <= 0) { e.hp = 0; e.alive = false; return; }
    }
    if (e.deploy > 0) { e.deploy -= dt; return; }
    if (e.kind === 'tower' && !e.active) return;
    const stunned = this.time < e.stunUntil;
    this.updateAbilities(e, dt, stunned);
    if (!e.alive || stunned) return;

    if (abil(e, 'trap') || (e.kind === 'building' && e.damage <= 0)) return;
    const stealth = abil(e, 'stealth');
    if (stealth) e.hidden = this.time - e.lastAttack > 1.2;

    e.attackCd -= dt * this.attackMult(e);
    e.retargetCd -= dt;
    let target = this.byId(e.targetId);
    if (target && !this.canTarget(e, target)) target = undefined;
    const inRange = target ? this.edgeDist(e, target) <= e.range : false;
    if (!target || (!inRange && e.retargetCd <= 0)) {
      const found = this.findTarget(e, e.kind === 'unit' ? e.sight : e.range);
      if (found && found !== target) {
        target = found;
        if (abil(e, 'rampUp')) e.ab.rampTime = 0;
      }
      e.retargetCd = 0.25;
    }
    if (e.kind === 'unit' && !target) target = this.laneObjective(e);
    e.targetId = target?.id ?? null;
    if (!target) return;

    const dist = this.edgeDist(e, target);
    const dash = abil(e, 'dash');
    if (dash && (e.ab.dashCd ?? 0) <= 0 && dist >= dash.min - 0.5 && dist <= dash.max && !target.flying && target.kind !== 'tower') {
      const ang = Math.atan2(target.y - e.y, target.x - e.x);
      const fx = e.x, fy = e.y;
      e.x = target.x - Math.cos(ang) * (target.radius + e.radius + 0.1);
      e.y = target.y - Math.sin(ang) * (target.radius + e.radius + 0.1);
      this.clampPos(e);
      e.ab.dashCd = dash.cooldown;
      e.attackCd = 0;
      this.emit({ t: 'special', kind: 'dash', x: fx, y: fy, x2: e.x, y2: e.y });
    }
    if (this.edgeDist(e, target) <= e.range) {
      e.facing = Math.atan2(target.y - e.y, target.x - e.x);
      if (e.attackCd <= 0 && (e.damage > 0 || abil(e, 'kamikaze'))) this.attack(e, target);
    } else if (e.speed > 0 && this.time >= e.rootUntil) {
      this.moveToward(e, target, dt);
    }
  }

  private updateAbilities(e: Entity, dt: number, stunned: boolean): void {
    const d = e.def;
    if (!d?.abilities) return;
    for (const a of d.abilities) {
      switch (a.type) {
        case 'spawner':
          e.ab.spawnT -= dt;
          if (e.ab.spawnT <= 0 && !stunned) {
            e.ab.spawnT = a.interval;
            for (let i = 0; i < a.count; i++) {
              const ang = this.rng.range(0, Math.PI * 2);
              const off = e.radius + 0.4;
              this.spawnUnit(e.owner, a.unit, e.x + Math.cos(ang) * off, e.y + Math.sin(ang) * off, e.power, e.cardId, 0.4);
            }
            this.emit({ t: 'special', kind: 'spawn', x: e.x, y: e.y });
          }
          break;
        case 'essencePump':
          e.ab.pumpT -= dt;
          if (e.ab.pumpT <= 0) {
            e.ab.pumpT = a.interval;
            const p = this.players[e.owner];
            p.essence = Math.min(MAX_ESSENCE, p.essence + a.amount);
            this.emit({ t: 'essence', owner: e.owner, amount: a.amount });
          }
          break;
        case 'shieldPulse':
          e.ab.shieldT -= dt;
          if (e.ab.shieldT <= 0 && !stunned) {
            e.ab.shieldT = a.interval;
            for (const o of this.entities) {
              if (o.alive && o.owner === e.owner && o.kind === 'unit' && Math.hypot(o.x - e.x, o.y - e.y) <= a.radius + o.radius) {
                o.shield = Math.max(o.shield, a.amount * e.mult);
              }
            }
            this.emit({ t: 'special', kind: 'shield', x: e.x, y: e.y });
          }
          break;
        case 'dash': e.ab.dashCd = (e.ab.dashCd ?? 0) - dt; break;
        case 'devour':
          e.ab.devourCd = (e.ab.devourCd ?? 2) - dt;
          if (e.ab.devourCd <= 0 && !stunned) {
            const victim = this.entities.find((o) => o.alive && o.owner !== e.owner && o.kind === 'unit' && !o.flying && !o.hidden
              && o.hp <= a.maxHp * e.mult && this.edgeDist(e, o) <= e.range + 1.2);
            if (victim) {
              e.ab.devourCd = a.interval;
              this.emit({ t: 'special', kind: 'devour', x: victim.x, y: victim.y, x2: e.x, y2: e.y });
              this.kill(victim, e.owner);
              e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
            }
          }
          break;
        case 'hook':
          e.ab.hookCd = (e.ab.hookCd ?? 1) - dt;
          if (e.ab.hookCd <= 0 && !stunned) {
            let best: Entity | undefined; let bd = Infinity;
            for (const o of this.entities) {
              if (!o.alive || o.owner === e.owner || o.kind !== 'unit' || o.flying || o.hidden || o.mass >= 20) continue;
              const dd = this.edgeDist(e, o);
              if (dd <= a.range && dd > 1.5 && dd < bd) { bd = dd; best = o; }
            }
            if (best) {
              e.ab.hookCd = a.cooldown;
              const ang = Math.atan2(best.y - e.y, best.x - e.x);
              const fx = best.x, fy = best.y;
              best.x = e.x + Math.cos(ang) * (e.radius + best.radius + 0.3);
              best.y = e.y + Math.sin(ang) * (e.radius + best.radius + 0.3);
              this.clampPos(best);
              this.stun(best, 0.5);
              this.emit({ t: 'special', kind: 'hook', x: e.x, y: e.y, x2: fx, y2: fy });
            }
          }
          break;
        case 'tidePull':
          e.ab.tideT -= dt;
          if (e.ab.tideT <= 0 && !stunned) {
            e.ab.tideT = a.interval;
            for (const o of this.entities) {
              if (!o.alive || o.owner === e.owner || o.kind !== 'unit' || o.flying) continue;
              const dd = Math.hypot(o.x - e.x, o.y - e.y);
              if (dd > a.radius) continue;
              if (dd > e.radius + o.radius + 0.5) {
                const k = dd - (e.radius + o.radius + 0.5);
                o.x -= ((o.x - e.x) / dd) * k; o.y -= ((o.y - e.y) / dd) * k;
                this.clampPos(o);
              }
              this.dealDamage(e, e.owner, o, a.damage * e.mult, { spell: true });
              this.stun(o, a.stun);
            }
            this.emit({ t: 'blast', x: e.x, y: e.y, radius: a.radius, color: '#8affff' });
            this.emit({ t: 'special', kind: 'tide', x: e.x, y: e.y });
          }
          break;
        case 'trap': {
          for (const o of this.entities) {
            if (!o.alive || o.owner === e.owner || o.kind !== 'unit' || o.flying) continue;
            if (Math.hypot(o.x - e.x, o.y - e.y) <= a.trigger + o.radius) {
              for (const v of this.entities) {
                if (!v.alive || v.owner === e.owner || v.flying || v.kind === 'tower') continue;
                if (Math.hypot(v.x - e.x, v.y - e.y) <= a.radius + v.radius) {
                  this.dealDamage(e, e.owner, v, a.damage * e.mult, { spell: true });
                  v.rootUntil = this.time + a.root;
                  v.ab.chargeDist = 0;
                }
              }
              this.emit({ t: 'blast', x: e.x, y: e.y, radius: a.radius, color: '#ffb347' });
              this.emit({ t: 'special', kind: 'trap', x: e.x, y: e.y });
              e.hp = 0; e.alive = false;
              break;
            }
          }
          break;
        }
        default: break;
      }
    }
  }

  private moveToward(e: Entity, target: Entity, dt: number): void {
    let tx = target.x, ty = target.y;
    const leaper = !!abil(e, 'riverLeap');
    if (!e.flying && !leaper) {
      const side = (y: number) => (y > RIVER_Y ? 1 : -1);
      const inRiver = Math.abs(e.y - RIVER_Y) < RIVER_HALF + 0.05;
      if (side(e.y) !== side(ty) || inRiver) {
        const bx = BRIDGES.reduce((b, c) => (Math.abs(c - e.x) + Math.abs(c - tx) < Math.abs(b - e.x) + Math.abs(b - tx) ? c : b));
        if (inRiver) {
          tx = bx; ty = side(target.y) > 0 ? RIVER_Y + RIVER_HALF + 0.6 : RIVER_Y - RIVER_HALF - 0.6;
        } else if (Math.abs(e.x - bx) > 0.5) {
          const edge = side(e.y) > 0 ? RIVER_Y + RIVER_HALF + 0.4 : RIVER_Y - RIVER_HALF - 0.4;
          tx = bx; ty = edge;
          if (Math.abs(e.y - edge) > 3) ty = e.y + (edge - e.y) * 0.9;
        } else {
          tx = bx; ty = side(e.y) > 0 ? RIVER_Y - RIVER_HALF - 0.6 : RIVER_Y + RIVER_HALF + 0.6;
        }
      }
    }
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-4) return;
    let sp = e.speed * this.moveMult(e);
    if (leaper && Math.abs(e.y - RIVER_Y) < RIVER_HALF + 0.3) sp *= 1.6;
    const step = Math.min(d, sp * dt);
    e.x += (dx / d) * step; e.y += (dy / d) * step;
    e.vx = dx / d; e.vy = dy / d;
    e.facing = Math.atan2(dy, dx);
    const ch = abil(e, 'charge');
    if (ch) e.ab.chargeDist = (e.ab.chargeDist ?? 0) + step;
    this.clampPos(e);
  }

  private attack(e: Entity, target: Entity): void {
    e.attackCd = e.hitSpeed;
    e.lastAttack = this.time;
    let dmg = e.damage;
    const ch = abil(e, 'charge');
    if (ch && (e.ab.chargeDist ?? 0) >= ch.distance) { dmg *= ch.mult; this.emit({ t: 'special', kind: 'chargeHit', x: target.x, y: target.y }); }
    if (ch) e.ab.chargeDist = 0;
    const ramp = abil(e, 'rampUp');
    if (ramp) {
      if (e.ab.rampTarget !== target.id) { e.ab.rampTarget = target.id; e.ab.rampTime = 0; }
      const stage = Math.min(ramp.stages.length - 1, Math.floor((e.ab.rampTime ?? 0) / ramp.stageTime));
      dmg *= ramp.stages[stage];
      e.ab.rampStage = stage;
      e.ab.rampTime = (e.ab.rampTime ?? 0) + e.hitSpeed / this.attackMult(e);
    }
    const melee = e.projectile <= 0;
    this.emit({ t: 'attack', id: e.id, targetId: target.id, melee });
    if (abil(e, 'kamikaze')) { e.hp = 0; e.alive = false; return; }
    const burn = abil(e, 'burnTrail');
    if (burn) {
      e.ab.attacks = (e.ab.attacks ?? 0) + 1;
      if (e.ab.attacks % burn.every === 0) {
        this.zones.push({ id: this.nextId++, owner: e.owner, x: target.x, y: target.y, radius: burn.radius, until: this.time + burn.duration,
          dps: burn.dps * e.mult, slow: 0, pull: 0, endDamage: 0, towerPct: 0.35, style: 'ash', started: this.time });
      }
    }
    if (melee) {
      this.hitTarget(e, target, dmg, true);
    } else {
      const pierce = abil(e, 'pierce');
      const p: Projectile = {
        id: this.nextId++, owner: e.owner, srcId: e.id, x: e.x, y: e.y, tx: target.x, ty: target.y,
        targetId: target.id, speed: e.projectile, damage: dmg, splash: e.splash, targets: e.targets,
        style: e.kind === 'tower' ? 'tower' : e.def?.id ?? 'bolt', fromTower: e.kind === 'tower',
      };
      if (pierce) {
        const d = Math.hypot(target.x - e.x, target.y - e.y) || 1;
        p.pierce = { dx: (target.x - e.x) / d, dy: (target.y - e.y) / d, left: pierce.length, width: pierce.width, hit: [] };
        p.targetId = null;
      }
      this.projectiles.push(p);
    }
  }

  /** Applique un coup (mêlée ou projectile arrivé). */
  private hitTarget(src: Entity | undefined, target: Entity, dmg: number, melee: boolean, owner?: PlayerId, splash?: number, x?: number, y?: number): void {
    const o = owner ?? src!.owner;
    const sp = splash ?? src?.splash ?? 0;
    const hx = x ?? target.x, hy = y ?? target.y;
    const victims: Entity[] = [];
    if (sp > 0) {
      for (const v of this.entities) {
        if (!v.alive || v.owner === o) continue;
        if (src && !this.canTargetType(src.targets, v)) continue;
        if (Math.hypot(v.x - hx, v.y - hy) <= sp + v.radius) victims.push(v);
      }
      if (!victims.includes(target) && target.alive) victims.push(target);
      this.emit({ t: 'blast', x: hx, y: hy, radius: sp, color: src?.def?.visual.c3 ?? '#ffffff' });
    } else if (target.alive) victims.push(target);
    for (const v of victims) {
      const dealt = this.dealDamage(src, o, v, dmg, { melee });
      if (src) this.onHitEffects(src, v, dealt);
    }
    const chain = src && abil(src, 'chain');
    if (chain && src) {
      const pts = [{ x: target.x, y: target.y }];
      const hit = new Set<number>([target.id]);
      let last = target;
      for (let j = 0; j < chain.jumps; j++) {
        let best: Entity | undefined; let bd = Infinity;
        for (const v of this.entities) {
          if (hit.has(v.id) || !this.canTarget(src, v)) continue;
          const d = Math.hypot(v.x - last.x, v.y - last.y);
          if (d <= chain.radius && d < bd) { bd = d; best = v; }
        }
        if (!best) break;
        hit.add(best.id);
        this.dealDamage(src, o, best, dmg * 0.8, {});
        this.onHitEffects(src, best, 0);
        pts.push({ x: best.x, y: best.y });
        last = best;
      }
      if (pts.length > 1) this.emit({ t: 'chain', pts, color: src.def?.visual.c3 ?? '#7fd8ff' });
    }
  }

  private canTargetType(t: TargetType, v: Entity): boolean {
    if (t === 'buildings') return v.kind !== 'unit';
    if (t === 'ground') return !v.flying;
    if (t === 'air') return v.flying;
    return true;
  }

  private onHitEffects(src: Entity, v: Entity, dealt: number): void {
    if (!src.def?.abilities) return;
    for (const a of src.def.abilities) {
      if (a.type === 'slowOnHit' && v.kind === 'unit') { v.slowAmt = Math.max(v.slowAmt * (this.time < v.slowUntil ? 1 : 0), a.amount); v.slowUntil = this.time + a.duration; }
      else if (a.type === 'stunOnHit' && v.kind !== 'tower') this.stun(v, a.duration);
      else if (a.type === 'poisonOnHit') v.poisons.push({ dps: a.dps * src.mult, until: this.time + a.duration, src: src.owner });
      else if (a.type === 'lifesteal' && dealt > 0 && src.alive) src.hp = Math.min(src.maxHp, src.hp + dealt * a.pct);
    }
  }

  /** Inflige des dégâts ; retourne les dégâts réellement appliqués aux PV. */
  dealDamage(src: Entity | null | undefined, owner: PlayerId, v: Entity, amount: number, opt: { melee?: boolean; spell?: boolean; quiet?: boolean }): number {
    if (!v.alive || amount <= 0) return 0;
    let a = amount;
    if (v.shield > 0) { const s = Math.min(v.shield, a); v.shield -= s; a -= s; }
    const dealt = Math.min(v.hp, a);
    v.hp -= a;
    v.lastHit = this.time;
    if (v.kind === 'tower') {
      this.players[owner].stats.damageToTowers += dealt;
      if (v.towerType === 'king' && !v.active) v.active = true;
    }
    if (!opt.quiet) this.emit({ t: 'hit', x: v.x, y: v.y, amount: Math.round(amount), owner, tower: v.kind === 'tower' });
    if (opt.melee && src && src.alive) {
      const th = abil(v, 'thorns');
      if (th) this.dealDamage(v, v.owner, src, amount * th.pct, { quiet: true });
    }
    if (v.hp <= 0) this.kill(v, owner);
    return dealt;
  }

  private kill(v: Entity, by: PlayerId): void {
    if (!v.alive) return;
    const rev = abil(v, 'reviveOnce');
    if (rev && !v.ab.revived) {
      v.ab.revived = 1;
      v.hp = v.maxHp * rev.hpPct;
      v.poisons = [];
      this.stun(v, 1.2);
      this.emit({ t: 'special', kind: 'revive', x: v.x, y: v.y });
      return;
    }
    v.hp = 0; v.alive = false;
    if (v.kind === 'unit' && v.owner !== by) this.players[by].stats.unitsKilled++;
  }

  private updateProjectiles(dt: number): void {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      const src = this.byId(p.srcId);
      if (p.pierce) {
        const step = p.speed * dt;
        p.x += p.pierce.dx * step; p.y += p.pierce.dy * step; p.pierce.left -= step;
        for (const v of this.entities) {
          if (!v.alive || v.owner === p.owner || p.pierce.hit.includes(v.id) || v.hidden) continue;
          if (!this.canTargetType(p.targets, v)) continue;
          if (Math.hypot(v.x - p.x, v.y - p.y) <= v.radius + p.pierce.width) {
            p.pierce.hit.push(v.id);
            this.dealDamage(src, p.owner, v, p.damage, {});
          }
        }
        if (p.pierce.left > 0 && p.x > -1 && p.x < ARENA_W + 1 && p.y > -1 && p.y < ARENA_H + 1) keep.push(p);
        continue;
      }
      const t = this.byId(p.targetId);
      if (t && t.alive) { p.tx = t.x; p.ty = t.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 0.05) {
        if (t && t.alive) this.hitTarget(src ?? undefined, t, p.damage, false, p.owner, p.splash, p.tx, p.ty);
        else if (p.splash > 0) {
          // La cible est morte en vol : la zone s'applique tout de même au point d'impact.
          for (const v of this.entities) {
            if (v.alive && v.owner !== p.owner && this.canTargetType(p.targets, v) && Math.hypot(v.x - p.tx, v.y - p.ty) <= p.splash + v.radius) {
              this.dealDamage(src, p.owner, v, p.damage, {});
            }
          }
          this.emit({ t: 'blast', x: p.tx, y: p.ty, radius: p.splash, color: '#ffffff' });
        }
        continue;
      }
      p.x += (dx / d) * step; p.y += (dy / d) * step;
      keep.push(p);
    }
    this.projectiles = keep;
  }

  // ------------------------------------------------------------------ collisions
  private clampPos(e: Entity): void {
    e.x = Math.max(0.3, Math.min(ARENA_W - 0.3, e.x));
    e.y = Math.max(0.3, Math.min(ARENA_H - 0.3, e.y));
  }

  private separate(): void {
    const movers = this.entities.filter((e) => e.alive && e.kind === 'unit');
    const statics = this.entities.filter((e) => e.alive && e.kind !== 'unit');
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i];
      for (let j = i + 1; j < movers.length; j++) {
        const b = movers[j];
        if (a.flying !== b.flying) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.9;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 0.01;
        const overlap = (min - d) * 0.5;
        const nx = d2 === 0 ? 1 : dx / d, ny = d2 === 0 ? 0 : dy / d;
        const wa = b.mass / (a.mass + b.mass), wb = a.mass / (a.mass + b.mass);
        a.x -= nx * overlap * wa * 2; a.y -= ny * overlap * wa * 2;
        b.x += nx * overlap * wb * 2; b.y += ny * overlap * wb * 2;
      }
      if (!a.flying) {
        for (const s of statics) {
          if (s.hidden) continue;
          const dx = a.x - s.x, dy = a.y - s.y;
          const min = a.radius + s.radius * 0.95;
          const d = Math.hypot(dx, dy);
          if (d < min && d > 0.001) { a.x = s.x + (dx / d) * min; a.y = s.y + (dy / d) * min; }
        }
        // Rivière : seuls les passages sont praticables (sauf sauteurs).
        if (Math.abs(a.y - RIVER_Y) < RIVER_HALF && !abil(a, 'riverLeap')) {
          const onBridge = BRIDGES.some((bx) => Math.abs(a.x - bx) <= BRIDGE_HALF);
          if (!onBridge) {
            const bx = BRIDGES.reduce((b, c) => (Math.abs(c - a.x) < Math.abs(b - a.x) ? c : b));
            a.x = bx + Math.sign(a.x - bx) * BRIDGE_HALF * 0.95;
          }
        }
      }
      this.clampPos(a);
    }
  }

  private cleanupDead(): void {
    const dead = this.entities.filter((e) => !e.alive && e.hp <= 0 && !e.crownCounted);
    if (!dead.length) return;
    for (const e of dead) {
      e.crownCounted = true;
      if (e.kind === 'tower') { this.onTowerDestroyed(e); continue; }
      this.emit({ t: 'death', id: e.id, x: e.x, y: e.y, owner: e.owner, unitId: e.def!.id, size: e.radius, kind: e.kind });
      const db = abil(e, 'deathBlast');
      if (db) {
        for (const v of this.entities) {
          if (!v.alive || v.owner === e.owner) continue;
          if (Math.hypot(v.x - e.x, v.y - e.y) > db.radius + v.radius) continue;
          this.dealDamage(e, e.owner, v, db.damage * e.mult, { spell: true });
          if (db.stun && v.kind !== 'tower') this.stun(v, db.stun);
        }
        this.emit({ t: 'blast', x: e.x, y: e.y, radius: db.radius, color: e.def!.visual.c3 });
      }
      const ds = abil(e, 'deathSpawn');
      if (ds) {
        for (let i = 0; i < ds.count; i++) {
          const [ox, oy] = this.formation(i, ds.count, 0.35);
          this.spawnUnit(e.owner, ds.unit, e.x + ox, e.y + oy, e.power, e.cardId, 0.3);
        }
      }
      // Nécromancie : les liches relèvent les morts proches.
      if (e.kind === 'unit') {
        for (const l of this.entities) {
          const rd = l.alive && l.deploy <= 0 ? abil(l, 'raiseDead') : undefined;
          if (!rd || (l.ab.raiseCd ?? 0) > this.time) continue;
          if (Math.hypot(l.x - e.x, l.y - e.y) > rd.radius) continue;
          l.ab.raiseCd = this.time + rd.cooldown;
          this.spawnUnit(l.owner, rd.unit, e.x, e.y, l.power, l.cardId, 0.5);
          this.emit({ t: 'special', kind: 'raise', x: e.x, y: e.y, x2: l.x, y2: l.y });
          break;
        }
      }
    }
    this.entities = this.entities.filter((e) => e.alive || e.kind === 'tower');
  }

  private onTowerDestroyed(t: Entity): void {
    const enemy: PlayerId = t.owner === 0 ? 1 : 0;
    const king = t.towerType === 'king';
    this.players[enemy].crowns = king ? 3 : Math.min(3, this.players[enemy].crowns + 1);
    this.emit({ t: 'towerDown', owner: t.owner, king, x: t.x, y: t.y });
    if (!king) { const k = this.king(t.owner); if (k) k.active = true; }
  }

  private checkEnd(): void {
    const [a, b] = [this.players[0].crowns, this.players[1].crowns];
    for (const owner of [0, 1] as PlayerId[]) {
      const k = this.king(owner);
      if (k && !k.alive) return this.finish(owner === 0 ? 1 : 0, 'king');
    }
    if (!this.overtime && this.time >= this.cfg.duration) {
      if (a !== b) return this.finish(a > b ? 0 : 1, 'time');
      if (this.cfg.overtime > 0) { this.overtime = true; this.emit({ t: 'special', kind: 'overtime', x: 9, y: 16 }); return; }
      return this.tiebreak();
    }
    if (this.overtime) {
      if (a !== b) return this.finish(a > b ? 0 : 1, 'suddenDeath');
      if (this.time >= this.cfg.duration + this.cfg.overtime) return this.tiebreak();
    }
  }

  private tiebreak(): void {
    const low = (o: PlayerId) => Math.min(...this.entities.filter((e) => e.kind === 'tower' && e.owner === o && e.alive).map((e) => e.hp / e.maxHp));
    const l0 = low(0), l1 = low(1);
    if (Math.abs(l0 - l1) < 1e-6) return this.finish(null, 'draw');
    this.finish(l0 > l1 ? 0 : 1, 'tiebreak');
  }

  private finish(winner: PlayerId | null, reason: BattleResult['reason']): void {
    this.result = { winner, crowns: [this.players[0].crowns, this.players[1].crowns], time: this.time, overtime: this.overtime, reason };
  }

  forfeit(loser: PlayerId): void {
    if (this.result) return;
    const winner: PlayerId = loser === 0 ? 1 : 0;
    this.players[winner].crowns = Math.max(this.players[winner].crowns, 3);
    this.finish(winner, 'forfeit');
  }
}
