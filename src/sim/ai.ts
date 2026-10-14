// IA adverse : gère son essence, défend contre les menaces, contre-attaque et pousse.
import { getCard, getUnit } from '../core/cards';
import { Rng } from '../core/rng';
import type { CardDef, PlayerId } from '../core/types';
import { ARENA_H, Battle, BRIDGES, type Entity, RIVER_Y } from './battle';

export type Difficulty = 'initie' | 'chasseur' | 'cauchemar' | 'abyssal';

export const DIFFICULTIES: Record<Difficulty, {
  label: string; reaction: number; mistake: number; attackAt: number; levelOffset: number; smartSpells: boolean;
  /** Laisse la menace franchir la rivière pour qu'elle subisse les tirs des tours avant de défendre. */
  patientDefense: boolean;
  description: string;
}> = {
  initie: { label: 'Initié', reaction: 1.6, mistake: 0.4, attackAt: 6.5, levelOffset: -1, smartSpells: false, patientDefense: false, description: 'Joue ses cartes au hasard trop souvent, défend mal.' },
  chasseur: { label: 'Chasseur', reaction: 0.9, mistake: 0.15, attackAt: 8.5, levelOffset: 0, smartSpells: true, patientDefense: true, description: 'Défend correctement et contre-attaque.' },
  cauchemar: { label: 'Cauchemar', reaction: 0.6, mistake: 0.05, attackAt: 8.5, levelOffset: 1, smartSpells: true, patientDefense: true, description: 'Gère son essence, punit les erreurs.' },
  abyssal: { label: 'Abyssal', reaction: 0.4, mistake: 0, attackAt: 9, levelOffset: 2, smartSpells: true, patientDefense: true, description: 'Réactions rapides, contres précis, cartes renforcées.' },
};

interface CardProfile { card: CardDef; air: boolean; splash: boolean; swarm: boolean; tank: boolean; ranged: boolean; dps: number; hp: number; buildingsOnly: boolean }

function profile(card: CardDef): CardProfile {
  let air = false, splash = false, tank = false, ranged = false, dps = 0, hp = 0, buildingsOnly = false, count = 0;
  if (card.kind === 'spell') {
    const s = card.spell!;
    return { card, air: true, splash: !!(s.damage || s.dps), swarm: false, tank: false, ranged: true, dps: (s.damage ?? 0) + (s.dps ?? 0) * (s.duration ?? 0), hp: 0, buildingsOnly: false };
  }
  for (const s of card.spawns ?? []) {
    const u = getUnit(s.unit);
    count += s.count;
    air ||= u.targets === 'both' || u.targets === 'air';
    splash ||= (u.splash ?? 0) > 0 || !!u.abilities?.some((a) => a.type === 'chain' || a.type === 'pierce' || (a.type === 'aura' && a.effect === 'poison'));
    tank ||= u.hp >= 2000;
    ranged ||= u.range >= 3;
    buildingsOnly ||= u.targets === 'buildings';
    dps += (u.damage / u.hitSpeed) * s.count;
    hp += u.hp * s.count;
  }
  return { card, air, splash, swarm: count >= 3, tank, ranged, dps, hp, buildingsOnly };
}

export class Bot {
  readonly me: PlayerId;
  readonly foe: PlayerId;
  readonly diff: (typeof DIFFICULTIES)[Difficulty];
  private cd = 1.5;
  private rng: Rng;

  constructor(private battle: Battle, me: PlayerId, difficulty: Difficulty, seed = 1) {
    this.me = me; this.foe = me === 0 ? 1 : 0;
    this.diff = DIFFICULTIES[difficulty];
    this.rng = new Rng(seed ^ 0x5bd1e995);
  }

  /** Convertit une coordonnée y « vue du bot » (camp en bas) en coordonnée réelle. */
  private Y(y: number): number { return this.me === 0 ? y : ARENA_H - y; }
  /** Profondeur dans le camp du bot : >0 = chez moi. */
  private depth(y: number): number { return this.me === 0 ? y - RIVER_Y : RIVER_Y - y; }

  update(dt: number): void {
    const b = this.battle;
    if (b.result || b.paused) return;
    this.cd -= dt;
    if (this.cd > 0) return;
    this.cd = this.diff.reaction * this.rng.range(0.7, 1.3);
    this.decide();
  }

  private hand(): { idx: number; prof: CardProfile }[] {
    const p = this.battle.players[this.me];
    return p.hand.map((h, idx) => (h ? { idx, prof: profile(getCard(h.cardId)) } : null)).filter((x): x is { idx: number; prof: CardProfile } => !!x);
  }

  private play(idx: number, x: number, y: number): boolean {
    const card = getCard(this.battle.players[this.me].hand[idx]!.cardId);
    const tries: [number, number][] = [[x, y], [x + 1, y], [x - 1, y], [x, y + (this.me === 0 ? 1 : -1)], [9, this.Y(26)]];
    for (const [tx, ty] of tries) {
      if (this.battle.canDeployAt(this.me, card, tx, ty)) return this.battle.playCard(this.me, idx, tx, ty).ok;
    }
    return false;
  }

  private decide(): void {
    const b = this.battle;
    const ess = b.players[this.me].essence;
    const hand = this.hand();
    const affordable = hand.filter((h) => h.prof.card.cost <= ess);
    if (!affordable.length) return;
    const enemies = b.entities.filter((e) => e.alive && e.owner === this.foe && e.kind === 'unit' && e.deploy <= 0.5);
    const threshold = this.diff.patientDefense ? 0.5 : -4;
    const threats = enemies.filter((e) => this.depth(e.y) > threshold).sort((a, c) => this.depth(c.y) - this.depth(a.y));

    // Erreur : carte au hasard, placée au hasard dans son camp.
    if (this.rng.next() < this.diff.mistake * 0.35) {
      const h = this.rng.pick(affordable);
      if (h.prof.card.kind === 'spell') return;
      this.play(h.idx, this.rng.range(2, 16), this.Y(this.rng.range(19, 29)));
      return;
    }

    // 1. Sort opportuniste : achever une tour ou punir un groupe.
    if (this.diff.smartSpells && this.trySpell(affordable, enemies)) return;

    // 2. Défense proportionnée à la menace.
    if (threats.length) {
      const threatValue = threats.reduce((s, e) => s + (e.cardId ? getCard(e.cardId).cost / Math.max(1, getCard(e.cardId).spawns?.[0]?.count ?? 1) : 1), 0);
      if (threatValue >= 2 || this.depth(threats[0].y) > 6) {
        if (this.defend(affordable, threats, threatValue)) return;
      }
    }

    // 3. Attaque / soutien de poussée.
    const leak = ess >= 9.6;
    if (ess >= this.diff.attackAt || leak) this.attack(affordable, leak);
  }

  private trySpell(affordable: { idx: number; prof: CardProfile }[], enemies: Entity[]): boolean {
    const b = this.battle;
    // Sort de soutien : protéger un groupe allié engagé au combat.
    for (const s of affordable.filter((h) => h.prof.card.kind === 'spell' && h.prof.card.spell!.affects === 'allies')) {
      const r = s.prof.card.spell!.radius;
      const mine = b.entities.filter((e) => e.alive && e.owner === this.me && e.kind === 'unit' && b.time - e.lastHit < 1);
      for (const c of mine) {
        const group = mine.filter((e) => Math.hypot(e.x - c.x, e.y - c.y) <= r);
        if (group.reduce((sum, e) => sum + e.maxHp, 0) > 2500) return this.play(s.idx, c.x, c.y);
      }
    }
    const spells = affordable.filter((h) => h.prof.card.kind === 'spell' && h.prof.card.spell!.affects !== 'allies');
    for (const s of spells) {
      const sp = s.prof.card.spell!;
      const dmg = (sp.damage ?? 0) + (sp.dps ?? 0) * (sp.duration ?? 0);
      // Achever une tour.
      for (const t of b.towers(this.foe)) {
        if (dmg > 0 && t.hp < dmg * (sp.towerPct ?? 0.3) * 0.9) return this.play(s.idx, t.x, t.y);
      }
      // Groupe d'ennemis.
      let best = 0, bx = 0, by = 0;
      for (const c of enemies) {
        let val = 0;
        for (const e of enemies) if (Math.hypot(e.x - c.x, e.y - c.y) <= sp.radius) val += e.cardId ? getCard(e.cardId).cost / (getCard(e.cardId).spawns?.[0]?.count ?? 1) : 0.5;
        if (val > best) { best = val; bx = c.x; by = c.y; }
      }
      const need = sp.stun ? s.prof.card.cost + 2 : s.prof.card.cost + 0.5;
      if (best >= need) {
        const lead = this.me === 0 ? 0.8 : -0.8;
        return this.play(s.idx, bx, by + (sp.delay > 0.5 ? lead : 0));
      }
    }
    return false;
  }

  private defend(affordable: { idx: number; prof: CardProfile }[], threats: Entity[], threatValue: number): boolean {
    const main = threats[0];
    const air = threats.some((t) => t.flying);
    const swarm = threats.filter((t) => t.maxHp < 400).length >= 3;
    const big = threats.some((t) => t.maxHp > 2000);
    const siege = threats.some((t) => t.targets === 'buildings');
    const candidates = affordable.filter((h) => h.prof.card.kind !== 'spell' || h.prof.card.spell!.affects !== 'allies');
    let best: { idx: number; prof: CardProfile } | null = null; let bs = -Infinity;
    for (const h of candidates) {
      const p = h.prof;
      let s = 0;
      if (p.card.kind === 'spell') s -= 3; // les sorts sont gérés à part
      if (air) s += p.air ? 4 : -8;
      if (swarm) s += p.splash ? 4 : p.swarm ? -2 : 0;
      if (big) s += p.dps > 300 || p.swarm ? 3 : 0;
      if (siege && p.card.kind === 'building') s += 4;
      if (p.buildingsOnly) s -= 10;
      s -= p.card.cost * 0.4 + Math.max(0, p.card.cost - threatValue - 1) * 1.2; // ne pas surpayer la défense
      s += this.rng.range(0, 1 + this.diff.mistake * 8);
      if (s > bs) { bs = s; best = h; }
    }
    if (!best || bs < -6) return false;
    const p = best.prof;
    // Placement : entre la menace et la tour, en retrait pour les tireurs.
    const lane = main.x < 9 ? BRIDGES[0] : BRIDGES[1];
    if (p.card.kind === 'building') {
      // Les pièges se posent sur le chemin de la menace ; les autres bâtiments au centre pour attirer.
      if (p.card.id === 'piege_machoires') return this.play(best.idx, main.x, main.y + (this.me === 0 ? 2 : -2));
      return this.play(best.idx, 9, this.Y(22));
    }
    let x = Math.max(1, Math.min(17, (main.x + lane) / 2));
    let y: number;
    const md = this.depth(main.y);
    if (p.ranged) { y = this.Y(RIVER_Y + Math.min(11, Math.max(md + 4, 8))); x = main.x < 9 ? 5 : 13; }
    else y = this.Y(RIVER_Y + Math.max(2, Math.min(12, md + 2.5)));
    return this.play(best.idx, x, y);
  }

  private attack(affordable: { idx: number; prof: CardProfile }[], leak: boolean): void {
    const b = this.battle;
    const foeTowers = b.towers(this.foe).filter((t) => t.towerType === 'princess');
    const laneX = foeTowers.length ? foeTowers.reduce((a, c) => (c.hp < a.hp ? c : a)).x : this.rng.pick(BRIDGES);
    const mine = b.entities.filter((e) => e.alive && e.owner === this.me && e.kind === 'unit');
    const pushing = mine.filter((e) => Math.abs(e.x - laneX) < 6);
    const units = affordable.filter((h) => h.prof.card.kind === 'unit');
    if (!units.length) {
      if (leak) {
        const bld = affordable.find((h) => h.prof.card.kind === 'building');
        if (bld) this.play(bld.idx, 9, this.Y(23));
      }
      return;
    }
    let choice: { idx: number; prof: CardProfile };
    if (pushing.length && pushing.some((e) => e.maxHp > 1500)) {
      // Soutenir le tank déjà engagé.
      choice = units.filter((h) => !h.prof.tank).sort((a, c) => c.prof.dps - a.prof.dps)[0] ?? units[0];
      const lead = pushing.reduce((a, c) => (this.depth(c.y) < this.depth(a.y) ? c : a));
      this.play(choice.idx, lead.x, lead.y + (this.me === 0 ? 1.5 : -1.5));
      return;
    }
    const tanks = units.filter((h) => h.prof.tank);
    choice = tanks[0] ?? units.sort((a, c) => c.prof.hp - a.prof.hp)[0];
    if (choice.prof.card.deployAnywhere) {
      const t = foeTowers[0] ?? b.king(this.foe);
      if (t) { this.play(choice.idx, t.x, t.y + (this.me === 0 ? 2.5 : -2.5)); return; }
    }
    const back = choice.prof.tank || choice.prof.card.cost >= 5;
    const x = laneX < 9 ? (back ? 6 : 3.5) : back ? 12 : 14.5;
    this.play(choice.idx, x, this.Y(back ? 29 : RIVER_Y + 1.8));
  }
}
