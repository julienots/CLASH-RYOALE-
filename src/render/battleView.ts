// Rendu 2.5D du combat : arène, tours, unités, projectiles, sorts, effets et aperçu de déploiement.
import { CARD_MAP, getCard, getUnit } from '../core/cards';
import { RARITY_INFO } from '../core/progression';
import { Rng } from '../core/rng';
import type { CardDef, PlayerId } from '../core/types';
import { ARENA_H, ARENA_W, Battle, BRIDGE_HALF, BRIDGES, type BattleEvent, type Entity, RIVER_HALF, RIVER_Y } from '../sim/battle';
import { FxPool } from './fx';
import { alpha, setLowDetail, shade } from './sprites';
import { clearSpriteCache, drawCachedMonster } from './spriteCache';

export interface ViewOptions { quality: 'basse' | 'moyenne' | 'haute'; damageNumbers: boolean; showGrid: boolean; ground: string; accent: string; summonFx: string }

export interface DeployPreview { card: CardDef; x: number; y: number; legal: boolean }

const TEAM = ['#5aa9ff', '#ff4d5a'];
/** Taille d'affichage des unités (en cases) : plus grande que l'empreinte physique pour la lisibilité. */
const UNIT_PX = 1.4;

export class BattleView {
  readonly ctx: CanvasRenderingContext2D;
  tile = 20; ox = 0; oy = 0;
  private dpr = 1;
  private ground: HTMLCanvasElement | null = null;
  readonly fx: FxPool;
  private shake = 0;
  private time = 0;
  preview: DeployPreview | null = null;
  /** Mise en évidence de la zone légale pendant un glisser. */
  dragging: CardDef | null = null;
  private deathGhosts: { x: number; y: number; unitId: string; owner: PlayerId; t: number; flying: boolean }[] = [];
  private summons: { x: number; y: number; t: number; color: string; legend: boolean }[] = [];
  private banners: { text: string; t: number; color: string }[] = [];

  constructor(readonly canvas: HTMLCanvasElement, readonly battle: Battle, public opts: ViewOptions) {
    this.ctx = canvas.getContext('2d')!;
    this.fx = new FxPool(opts.quality === 'basse' ? 150 : opts.quality === 'moyenne' ? 350 : 600);
    setLowDetail(opts.quality === 'basse');
    this.resize();
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.quality === 'haute' ? 2.5 : 1.5);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    const w = this.canvas.width, h = this.canvas.height;
    // marge en haut pour le Cœur-Roi adverse qui dépasse de l'arène
    this.tile = Math.min(w / ARENA_W, h / (ARENA_H + 1.4));
    this.ox = (w - this.tile * ARENA_W) / 2;
    this.oy = (h - this.tile * ARENA_H) / 2 + this.tile * 0.6;
    this.ground = null;
    clearSpriteCache();
  }

  /** Convertit des coordonnées écran (CSS) en coordonnées d'arène. */
  toArena(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const px = (clientX - r.left) * this.dpr, py = (clientY - r.top) * this.dpr;
    return { x: (px - this.ox) / this.tile, y: (py - this.oy) / this.tile };
  }
  sx(x: number): number { return this.ox + x * this.tile; }
  sy(y: number): number { return this.oy + y * this.tile; }

  // ------------------------------------------------------------------ sol pré-rendu
  private buildGround(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.canvas.width; c.height = this.canvas.height;
    const g = c.getContext('2d')!;
    const T = this.tile;
    const rng = new Rng(1337);
    g.fillStyle = '#060406'; g.fillRect(0, 0, c.width, c.height);
    const base = this.opts.ground;
    const grad = g.createLinearGradient(0, this.oy, 0, this.oy + ARENA_H * T);
    grad.addColorStop(0, shade(base, -0.15)); grad.addColorStop(0.5, shade(base, 0.12)); grad.addColorStop(1, shade(base, -0.15));
    g.fillStyle = grad; g.fillRect(this.ox, this.oy, ARENA_W * T, ARENA_H * T);
    // dalles irrégulières / terre
    for (let i = 0; i < 900; i++) {
      const x = this.ox + rng.range(0, ARENA_W) * T, y = this.oy + rng.range(0, ARENA_H) * T;
      g.fillStyle = alpha(rng.next() < 0.5 ? '#000000' : '#ffffff', rng.range(0.02, 0.06));
      g.beginPath(); g.ellipse(x, y, rng.range(0.2, 1.2) * T, rng.range(0.1, 0.6) * T, rng.range(0, 3), 0, Math.PI * 2); g.fill();
    }
    // chemins des voies
    for (const bx of BRIDGES) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.roundRect(this.sx(bx - 1.1), this.sy(5), 2.2 * T, 22 * T, T); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.15)';
    g.fillRect(this.sx(3.5), this.sy(4.5), 11 * T, 1.6 * T); g.fillRect(this.sx(3.5), this.sy(25.9), 11 * T, 1.6 * T);
    // fissures luminescentes
    g.strokeStyle = alpha(this.opts.accent, 0.12); g.lineWidth = Math.max(1, T * 0.06);
    for (let i = 0; i < 26; i++) {
      let x = this.ox + rng.range(0, ARENA_W) * T, y = this.oy + rng.range(0, ARENA_H) * T;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += rng.range(-0.8, 0.8) * T; y += rng.range(-0.8, 0.8) * T; g.lineTo(x, y); }
      g.stroke();
    }
    // os et crânes épars
    for (let i = 0; i < 40; i++) {
      const x = this.ox + rng.range(0.3, ARENA_W - 0.3) * T, y = this.oy + rng.range(0.3, ARENA_H - 0.3) * T;
      if (Math.abs((y - this.oy) / T - RIVER_Y) < 2) continue;
      g.save(); g.translate(x, y); g.rotate(rng.range(0, 3.14));
      g.fillStyle = alpha('#d8cfb8', rng.range(0.15, 0.35));
      if (rng.next() < 0.3) { g.beginPath(); g.arc(0, 0, T * 0.18, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(-T * 0.08, -T * 0.03, T * 0.05, T * 0.05); g.fillRect(T * 0.03, -T * 0.03, T * 0.05, T * 0.05); }
      else { g.fillRect(-T * 0.3, -T * 0.035, T * 0.6, T * 0.07); g.beginPath(); g.arc(-T * 0.3, 0, T * 0.06, 0, 7); g.arc(T * 0.3, 0, T * 0.06, 0, 7); g.fill(); }
      g.restore();
    }
    // bordures : murs d'os et de chair
    g.strokeStyle = '#140c10'; g.lineWidth = T * 0.5;
    g.strokeRect(this.ox, this.oy, ARENA_W * T, ARENA_H * T);
    g.fillStyle = '#2a2024';
    for (let i = 0; i < ARENA_H * 2; i++) {
      for (const side of [0, ARENA_W]) {
        const x = this.sx(side), y = this.sy(i * 0.5);
        g.beginPath(); g.moveTo(x - T * 0.2, y); g.lineTo(x + (side ? -1 : 1) * T * 0.45, y + T * 0.25); g.lineTo(x - T * 0.2, y + T * 0.5); g.fill();
      }
    }
    // grille de déploiement (optionnelle, discrète)
    if (this.opts.showGrid) {
      g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 1;
      for (let x = 1; x < ARENA_W; x++) { g.beginPath(); g.moveTo(this.sx(x), this.sy(0)); g.lineTo(this.sx(x), this.sy(ARENA_H)); g.stroke(); }
      for (let y = 1; y < ARENA_H; y++) { g.beginPath(); g.moveTo(this.sx(0), this.sy(y)); g.lineTo(this.sx(ARENA_W), this.sy(y)); g.stroke(); }
    }
    return c;
  }

  private drawRiver(): void {
    const g = this.ctx, T = this.tile;
    const y0 = this.sy(RIVER_Y - RIVER_HALF), h = RIVER_HALF * 2 * T;
    const grad = g.createLinearGradient(0, y0, 0, y0 + h);
    grad.addColorStop(0, '#1a0608'); grad.addColorStop(0.5, '#4a0f16'); grad.addColorStop(1, '#1a0608');
    g.fillStyle = grad; g.fillRect(this.sx(0), y0, ARENA_W * T, h);
    // courant de sang / bile
    g.strokeStyle = 'rgba(255,90,90,0.18)'; g.lineWidth = Math.max(1, T * 0.05);
    for (let i = 0; i < 9; i++) {
      const yy = y0 + h * ((i + 0.5) / 9);
      const off = ((this.time * 0.9 * T + i * 37) % (T * 3));
      g.beginPath();
      for (let x = -3; x < ARENA_W + 3; x += 3) { g.moveTo(this.sx(x) + off, yy); g.lineTo(this.sx(x) + off + T * 1.2, yy + Math.sin(this.time + i) * 2); }
      g.stroke();
    }
    // passages : ponts de côtes
    for (const bx of BRIDGES) {
      const x = this.sx(bx - BRIDGE_HALF), w = BRIDGE_HALF * 2 * T;
      g.fillStyle = '#3a2c26'; g.fillRect(x, y0 - T * 0.2, w, h + T * 0.4);
      g.fillStyle = '#d8cfb8';
      for (let k = 0; k < 5; k++) {
        const yy = y0 + (h + T * 0.2) * (k / 4) - T * 0.1;
        g.beginPath(); g.ellipse(x + w / 2, yy, w * 0.55, T * 0.12, 0, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#9b8f78'; g.fillRect(x - T * 0.1, y0 - T * 0.2, T * 0.2, h + T * 0.4); g.fillRect(x + w - T * 0.1, y0 - T * 0.2, T * 0.2, h + T * 0.4);
    }
  }

  // ------------------------------------------------------------------ événements → effets
  onEvents(events: BattleEvent[], me: PlayerId): void {
    const T = this.tile;
    for (const e of events) {
      switch (e.t) {
        case 'deploy': {
          const c = CARD_MAP[e.cardId];
          const legend = c.rarity === 'legendaire' || c.rarity === 'abyssal';
          const fxCol = this.opts.summonFx === 'fx_sang' ? '#ff2a2a' : this.opts.summonFx === 'fx_abysse' ? '#4dfff0' : this.opts.summonFx === 'fx_os' ? '#e8e3d0' : RARITY_INFO[c.rarity].glow;
          if (c.kind !== 'spell') {
            this.summons.push({ x: e.x, y: e.y, t: 0, color: e.owner === me ? fxCol : '#ff6b6b', legend });
            this.fx.burst(this.sx(e.x), this.sy(e.y), legend ? 40 : 14, fxCol, T * 3, { kind: this.opts.summonFx === 'fx_os' ? 'shard' : 'dot' });
            if (legend) this.banners.push({ text: c.name.toUpperCase(), t: 0, color: RARITY_INFO[c.rarity].color });
          }
          break;
        }
        case 'hit':
          if (this.opts.damageNumbers && e.amount >= 1) {
            this.fx.spawn({ kind: 'text', x: this.sx(e.x) + (Math.random() - 0.5) * T * 0.6, y: this.sy(e.y) - T * 1.2, vy: -T * 1.5, max: 0.7, size: T * (e.tower ? 0.55 : 0.45), text: String(e.amount), color: e.tower ? '#ffd23d' : '#ffffff' });
          }
          this.fx.burst(this.sx(e.x), this.sy(e.y) - T * 0.4, 3, '#a01020', T * 2.5, { size: T * 0.07 });
          break;
        case 'death': {
          const u = getUnit(e.unitId);
          this.deathGhosts.push({ x: e.x, y: e.y, unitId: e.unitId, owner: e.owner, t: 0, flying: !!u.flying });
          this.fx.burst(this.sx(e.x), this.sy(e.y) - T * 0.3, 10 + Math.round(e.size * 20), u.visual.c1, T * 3, { size: T * 0.09 });
          this.fx.burst(this.sx(e.x), this.sy(e.y) - T * 0.3, 6, '#5a0a10', T * 2, { kind: 'smoke', grow: T * 1.5, size: T * 0.2 });
          break;
        }
        case 'blast':
          this.fx.spawn({ kind: 'ring', x: this.sx(e.x), y: this.sy(e.y), size: T * 0.2, grow: e.radius * T * 3.5, max: 0.3, color: e.color });
          this.fx.burst(this.sx(e.x), this.sy(e.y), Math.round(8 + e.radius * 6), e.color, T * e.radius * 2.2, { kind: 'spark', g: 0 });
          if (e.radius > 2) this.shake = Math.max(this.shake, 0.15);
          break;
        case 'spellImpact': {
          const c = getCard(e.cardId);
          const col = c.faction === 'chair' ? '#b5ff3a' : c.faction === 'abysse' ? '#4dfff0' : c.faction === 'ossuaire' ? '#e8dcc0' : c.faction === 'rouille' ? '#ff9a3a' : '#c6ff4a';
          this.fx.spawn({ kind: 'ring', x: this.sx(e.x), y: this.sy(e.y), size: T * 0.5, grow: e.radius * T * 2.5, max: 0.45, color: col });
          this.fx.burst(this.sx(e.x), this.sy(e.y), 30, col, T * e.radius * 1.8, { kind: 'spark' });
          if (c.id === 'comete_rouille') { this.shake = 0.5; this.fx.burst(this.sx(e.x), this.sy(e.y), 25, '#4a2a1a', T * 4, { kind: 'smoke', grow: T * 2, size: T * 0.4 }); }
          break;
        }
        case 'chain':
          for (let i = 1; i < e.pts.length; i++) {
            this.fx.spawn({ kind: 'line', x: this.sx(e.pts[i - 1].x), y: this.sy(e.pts[i - 1].y) - T * 0.5, x2: this.sx(e.pts[i].x), y2: this.sy(e.pts[i].y) - T * 0.5, size: T * 0.08, max: 0.22, color: e.color });
          }
          break;
        case 'towerDown':
          this.shake = 0.7;
          this.fx.burst(this.sx(e.x), this.sy(e.y), 60, '#d8cfb8', T * 5, { kind: 'shard', size: T * 0.15 });
          this.fx.burst(this.sx(e.x), this.sy(e.y), 30, '#3a2a2a', T * 3, { kind: 'smoke', grow: T * 3, size: T * 0.6 });
          this.banners.push({ text: e.owner === me ? 'TOUR PERDUE' : 'TOUR DÉTRUITE !', t: 0, color: e.owner === me ? '#ff4d5a' : '#ffd23d' });
          break;
        case 'heal':
          this.fx.spawn({ kind: 'text', x: this.sx(e.x), y: this.sy(e.y) - T, vy: -T, max: 0.6, size: T * 0.5, text: '+', color: '#7dff8a' });
          break;
        case 'special':
          if (e.kind === 'overtime') this.banners.push({ text: 'MORT SUBITE', t: 0, color: '#ff3d6e' });
          else if (e.kind === 'dash' || e.kind === 'hook' || e.kind === 'devour' || e.kind === 'raise') {
            this.fx.spawn({ kind: 'line', x: this.sx(e.x), y: this.sy(e.y) - T * 0.4, x2: this.sx(e.x2 ?? e.x), y2: this.sy(e.y2 ?? e.y) - T * 0.4, size: T * 0.1, max: 0.35, color: e.kind === 'devour' ? '#ff5af0' : e.kind === 'raise' ? '#b98cff' : '#ffffff' });
          } else if (e.kind === 'revive') {
            this.fx.spawn({ kind: 'ring', x: this.sx(e.x), y: this.sy(e.y), size: T * 0.3, grow: T * 6, max: 0.6, color: '#b98cff' });
            this.banners.push({ text: 'RELIQUAIRE !', t: 0, color: '#b98cff' });
          } else if (e.kind === 'shield') this.fx.spawn({ kind: 'ring', x: this.sx(e.x), y: this.sy(e.y), size: T * 0.3, grow: T * 5, max: 0.4, color: '#4dfff0' });
          else if (e.kind === 'trap') this.fx.burst(this.sx(e.x), this.sy(e.y), 20, '#ffb347', T * 3, { kind: 'shard' });
          break;
        case 'essence':
          if (e.owner === me) this.fx.spawn({ kind: 'text', x: this.sx(9), y: this.sy(28), vy: -T, max: 1, size: T * 0.6, text: '+1 essence', color: '#d39bff' });
          break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------------ dessin principal
  render(dt: number, me: PlayerId): void {
    this.time += dt;
    const g = this.ctx, T = this.tile;
    if (!this.ground) this.ground = this.buildGround();
    g.save();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      g.translate((Math.random() - 0.5) * this.shake * T * 0.8, (Math.random() - 0.5) * this.shake * T * 0.8);
    }
    g.drawImage(this.ground, 0, 0);
    this.drawRiver();
    if (this.dragging) this.drawDeployZones(me);
    this.drawZones();
    this.drawPending(me);
    this.drawSummons(dt);

    // entités triées par profondeur (y), volants au-dessus
    const ents = this.battle.entities.slice().sort((a, b) => (a.flying === b.flying ? a.y - b.y : a.flying ? 1 : -1));
    for (const e of ents) this.drawShadow(e);
    this.drawGhosts(dt);
    for (const e of ents) {
      if (e.kind === 'tower') this.drawTower(e, me);
      else this.drawEntity(e, me);
    }
    this.drawProjectiles();
    this.fx.update(dt);
    this.fx.draw(g);
    for (const e of ents) if (e.kind !== 'tower') this.drawBars(e, me);
    this.drawPreview(me);
    this.drawBanners(dt);
    g.restore();
  }

  private drawShadow(e: Entity): void {
    if (!e.alive && e.kind !== 'tower') return;
    if (e.kind === 'tower' && !e.alive) return;
    const g = this.ctx, T = this.tile;
    if (e.hidden && e.owner !== 0 && e.kind !== 'tower') return;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.ellipse(this.sx(e.x), this.sy(e.y), e.radius * T * 1.1, e.radius * T * 0.45, 0, 0, Math.PI * 2); g.fill();
  }

  private drawEntity(e: Entity, me: PlayerId): void {
    if (!e.alive || !e.def) return;
    const g = this.ctx, T = this.tile;
    const x = this.sx(e.x), y = this.sy(e.y);
    const enemyHidden = e.hidden && e.owner !== me;
    // anneau d'équipe
    g.strokeStyle = alpha(TEAM[e.owner === me ? 0 : 1], enemyHidden ? 0.08 : 0.55); g.lineWidth = Math.max(1.5, T * 0.07);
    g.beginPath(); g.ellipse(x, y, e.radius * T * 0.95, e.radius * T * 0.42, 0, 0, Math.PI * 2); g.stroke();
    const sinceAtk = this.battle.time - e.lastAttack;
    const atkDur = Math.min(0.45, e.hitSpeed * 0.6);
    const attack = sinceAtk < atkDur ? sinceAtk / atkDur : 0;
    const moving = e.speed > 0 && e.deploy <= 0 && sinceAtk > e.hitSpeed + 0.1 && this.battle.time >= e.stunUntil;
    const flip = Math.cos(e.facing) < -0.1;
    let dy = 0, a = 1;
    if (e.deploy > 0) {
      const k = Math.max(0, Math.min(1, 1 - e.deploy));
      a = 0.35 + 0.65 * k;
      dy = (1 - k) * T * 0.3;
    }
    if (enemyHidden) a = 0.07 + 0.05 * Math.sin(this.time * 6);
    else if (e.hidden) a *= 0.45;
    const flash = this.battle.time - e.lastHit < 0.09 && this.opts.quality !== 'basse';
    g.globalAlpha = a;
    drawCachedMonster(g, e.def.visual, x, y + dy, T * UNIT_PX, e.age + e.id * 0.37, moving, attack, flip, flash ? 'flash' : 'normal');
    g.globalAlpha = 1;
    // statuts
    if (this.battle.time < e.stunUntil) {
      for (let k = 0; k < 3; k++) {
        const a = this.time * 4 + (k * Math.PI * 2) / 3;
        g.fillStyle = '#c6a6ff';
        g.beginPath(); g.arc(x + Math.cos(a) * T * 0.4, y - T * (1.6 * e.def.visual.scale) + Math.sin(a) * T * 0.12, T * 0.08, 0, Math.PI * 2); g.fill();
      }
    }
    if (this.battle.time < e.slowUntil) { g.fillStyle = 'rgba(80,200,255,0.25)'; g.beginPath(); g.ellipse(x, y, e.radius * T, e.radius * T * 0.45, 0, 0, Math.PI * 2); g.fill(); }
    if (this.battle.time < e.rootUntil) { g.strokeStyle = '#ffb347'; g.lineWidth = T * 0.06; g.beginPath(); g.ellipse(x, y, e.radius * T * 1.2, e.radius * T * 0.5, 0, 0, Math.PI * 2); g.stroke(); }
    if (e.poisons.length) this.fx.spawn({ kind: 'dot', x: x + (Math.random() - 0.5) * T * 0.5, y: y - T * 0.5, vy: -T, max: 0.4, size: T * 0.05, color: '#b5ff3a' });
    if (e.shield > 0) {
      g.strokeStyle = 'rgba(77,255,240,0.5)'; g.lineWidth = T * 0.05;
      g.beginPath(); g.arc(x, y - T * 0.7 * e.def.visual.scale, T * 0.85 * Math.max(0.8, e.def.visual.scale), 0, Math.PI * 2); g.stroke();
    }
    if (e.haste > 1) this.fx.spawn({ kind: 'spark', x, y: y - T * 0.2, vx: (Math.random() - 0.5) * T, vy: -T * 2, max: 0.25, size: T * 0.06, color: '#ffd36b' });
  }

  private drawBars(e: Entity, me: PlayerId): void {
    if (!e.alive || !e.def || (e.hidden && e.owner !== me)) return;
    if (e.hp >= e.maxHp && e.shield <= 0 && e.kind !== 'building') return;
    const g = this.ctx, T = this.tile;
    const w = Math.max(0.8, e.radius * 2) * T, h = Math.max(3, T * 0.13);
    const x = this.sx(e.x) - w / 2, y = this.sy(e.y) - T * (e.flying ? 2.5 : 1.75) * Math.max(0.75, e.def.visual.scale);
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = e.owner === me ? '#4da3ff' : '#ff4d5a';
    g.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), h);
    if (e.shield > 0) { g.fillStyle = '#4dfff0'; g.fillRect(x, y - h * 0.7, w * Math.min(1, e.shield / e.maxHp), h * 0.5); }
  }

  private drawTower(e: Entity, me: PlayerId): void {
    const g = this.ctx, T = this.tile;
    const x = this.sx(e.x), y = this.sy(e.y);
    const mine = e.owner === me;
    const team = TEAM[mine ? 0 : 1];
    const r = e.radius * T;
    if (!e.alive) {
      g.fillStyle = '#2a2220';
      for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(x + Math.cos(k * 2.3) * r * 0.6, y + Math.sin(k * 2.3) * r * 0.3, r * 0.25, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = '#d8cfb8'; g.fillRect(x - r * 0.5, y - r * 0.1, r, r * 0.12);
      return;
    }
    const king = e.towerType === 'king';
    const pulse = Math.sin(this.time * (king ? 2 : 3) + e.id) * 0.04;
    // base de pierre et d'os
    g.fillStyle = '#1b1416';
    g.beginPath(); g.ellipse(x, y + r * 0.15, r * 1.05, r * 0.55, 0, 0, Math.PI * 2); g.fill();
    const grad = g.createLinearGradient(x - r, 0, x + r, 0);
    grad.addColorStop(0, '#2e2428'); grad.addColorStop(0.45, '#6b5a58'); grad.addColorStop(1, '#221a1c');
    g.fillStyle = grad;
    const top = y - r * (king ? 1.9 : 1.7);
    g.beginPath();
    g.moveTo(x - r * 0.95, y + r * 0.1);
    g.lineTo(x - r * 0.7, top + r * 0.4);
    g.lineTo(x + r * 0.7, top + r * 0.4);
    g.lineTo(x + r * 0.95, y + r * 0.1);
    g.closePath(); g.fill();
    // côtes de soutien
    g.strokeStyle = '#cfc4ad'; g.lineWidth = r * 0.08;
    for (let k = 0; k < 4; k++) {
      const yy = y - r * 0.1 - k * r * 0.35;
      g.beginPath(); g.moveTo(x - r * (0.9 - k * 0.05), yy); g.quadraticCurveTo(x, yy - r * 0.25, x + r * (0.9 - k * 0.05), yy); g.stroke();
    }
    // bannière d'équipe
    g.fillStyle = team;
    g.beginPath(); g.moveTo(x - r * 0.25, top + r * 0.5); g.lineTo(x + r * 0.25, top + r * 0.5); g.lineTo(x + r * 0.25, top + r * 1.3); g.lineTo(x, top + r * 1.1); g.lineTo(x - r * 0.25, top + r * 1.3); g.fill();
    // sommet : cœur battant (roi) ou œil (sentinelle)
    if (king) {
      const hr = r * (0.45 + pulse);
      const hg = g.createRadialGradient(x - hr * 0.3, top - hr * 0.3, hr * 0.1, x, top, hr * 1.2);
      hg.addColorStop(0, '#ff8a8a'); hg.addColorStop(0.5, '#a3142a'); hg.addColorStop(1, '#3a0610');
      g.fillStyle = hg;
      g.beginPath(); g.ellipse(x, top, hr, hr * 0.9, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a0a14'; g.lineWidth = r * 0.05;
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(x - hr * 0.6 + k * hr * 0.4, top - hr * 0.8); g.quadraticCurveTo(x - hr * 0.3 + k * hr * 0.3, top, x - hr * 0.5 + k * hr * 0.35, top + hr * 0.8); g.stroke(); }
      g.fillStyle = '#e8dcc0';
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k / 6) * Math.PI;
        g.beginPath(); g.moveTo(x + Math.cos(a) * hr * 0.8, top + Math.sin(a) * hr * 0.7);
        g.lineTo(x + Math.cos(a) * hr * 1.5, top + Math.sin(a) * hr * 1.5 - r * 0.1);
        g.lineTo(x + Math.cos(a + 0.15) * hr * 0.8, top + Math.sin(a + 0.15) * hr * 0.7); g.fill();
      }
      if (!e.active) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, top, hr, hr * 0.9, 0, 0, Math.PI * 2); g.fill(); }
    } else {
      g.fillStyle = '#3a2e30'; g.beginPath(); g.ellipse(x, top + r * 0.3, r * 0.75, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#cfc4ad';
      for (let k = 0; k < 5; k++) { const xx = x - r * 0.6 + k * r * 0.3; g.beginPath(); g.moveTo(xx - r * 0.08, top + r * 0.3); g.lineTo(xx, top - r * 0.25); g.lineTo(xx + r * 0.08, top + r * 0.3); g.fill(); }
      const er = r * 0.28;
      g.save(); if (this.opts.quality !== 'basse') { g.shadowColor = team; g.shadowBlur = r * 0.5; }
      g.fillStyle = '#f0e6d8'; g.beginPath(); g.ellipse(x, top + r * 0.05, er * 1.3, er, 0, 0, Math.PI * 2); g.fill(); g.restore();
      const t = this.battle.byId(e.targetId);
      const lx = t ? Math.max(-1, Math.min(1, (t.x - e.x) / 4)) * er * 0.5 : Math.sin(this.time) * er * 0.3;
      g.fillStyle = team; g.beginPath(); g.arc(x + lx, top + r * 0.05, er * 0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#050304'; g.beginPath(); g.ellipse(x + lx, top + r * 0.05, er * 0.18, er * 0.5, 0, 0, Math.PI * 2); g.fill();
    }
    // barre de vie + valeur
    const w = r * 2.1, h = Math.max(5, T * 0.28);
    const bx = x - w / 2, by = top - r * (king ? 1.1 : 0.8);
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.beginPath(); g.roundRect(bx - 2, by - 2, w + 4, h + 4, 4); g.fill();
    g.fillStyle = mine ? '#4da3ff' : '#ff4d5a';
    g.beginPath(); g.roundRect(bx, by, w * Math.max(0, e.hp / e.maxHp), h, 3); g.fill();
    g.fillStyle = '#fff'; g.font = `800 ${Math.round(h * 0.85)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(Math.ceil(e.hp)), x, by + h / 2 + 1);
    g.textBaseline = 'alphabetic';
  }

  private drawProjectiles(): void {
    const g = this.ctx, T = this.tile;
    for (const p of this.battle.projectiles) {
      const x = this.sx(p.x), y = this.sy(p.y) - T * 0.6;
      const col = p.fromTower ? (p.owner === 0 ? '#9fd0ff' : '#ff9fa8') : getUnitColor(p.style);
      const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
      g.save(); g.translate(x, y); g.rotate(ang);
      if (this.opts.quality !== 'basse') { g.shadowColor = col; g.shadowBlur = T * 0.4; }
      g.fillStyle = col;
      if (p.fromTower || p.pierce) {
        g.fillRect(-T * 0.35, -T * 0.04, T * 0.6, T * 0.08);
        g.beginPath(); g.moveTo(T * 0.3, -T * 0.1); g.lineTo(T * 0.45, 0); g.lineTo(T * 0.3, T * 0.1); g.fill();
      } else {
        g.beginPath(); g.arc(0, 0, T * (p.splash > 0 ? 0.2 : 0.12), 0, Math.PI * 2); g.fill();
        g.globalAlpha = 0.4; g.beginPath(); g.ellipse(-T * 0.2, 0, T * 0.25, T * 0.08, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }
  }

  private drawZones(): void {
    const g = this.ctx, T = this.tile;
    for (const z of this.battle.zones) {
      const x = this.sx(z.x), y = this.sy(z.y), r = z.radius * T;
      const left = Math.max(0, z.until - this.battle.time);
      const col = z.style === 'marais_putride' ? '#7bc22a' : z.style === 'fosse_vorace' ? '#1a4a5a' : z.style === 'crater' ? '#ff6a1a' : z.style === 'ash' ? '#ff7b2a' : '#b5ff3a';
      const grad = g.createRadialGradient(x, y, r * 0.1, x, y, r);
      grad.addColorStop(0, alpha(col, 0.45)); grad.addColorStop(1, alpha(col, 0.08));
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); g.fill();
      if (z.pull) {
        g.strokeStyle = alpha('#4dfff0', 0.5); g.lineWidth = T * 0.06;
        for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x, y, r * (0.3 + k * 0.25), r * 0.75 * (0.3 + k * 0.25), this.time * (2 + k), 0, Math.PI * 1.4); g.stroke(); }
      }
      if (Math.random() < 0.5) this.fx.spawn({ kind: z.style === 'crater' || z.style === 'ash' ? 'spark' : 'smoke', x: x + (Math.random() - 0.5) * r * 1.6, y: y + (Math.random() - 0.5) * r, vy: -T * 1.2, vx: 0, max: 0.6, size: T * 0.2, grow: T * 0.3, color: col });
      void left;
    }
  }

  private drawPending(me: PlayerId): void {
    const g = this.ctx, T = this.tile;
    for (const s of this.battle.pending) {
      const x = this.sx(s.x), y = this.sy(s.y), r = (s.card.spell?.radius ?? 2) * T;
      const total = Math.max(0.01, s.at - s.cast), k = 1 - Math.max(0, s.at - this.battle.time) / total;
      g.strokeStyle = alpha(s.owner === me ? '#9fd0ff' : '#ff6b6b', 0.7); g.lineWidth = T * 0.06;
      g.setLineDash([T * 0.3, T * 0.2]);
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
      g.fillStyle = alpha(s.owner === me ? '#9fd0ff' : '#ff6b6b', 0.12 + 0.15 * k);
      g.beginPath(); g.ellipse(x, y, r * k, r * 0.75 * k, 0, 0, Math.PI * 2); g.fill();
      if (s.card.id === 'comete_rouille') {
        const cx = x + (1 - k) * T * 8, cy = y - (1 - k) * T * 14;
        g.save(); g.shadowColor = '#ffb347'; g.shadowBlur = T; g.fillStyle = '#ff8a3a';
        g.beginPath(); g.arc(cx, cy, T * 0.6, 0, Math.PI * 2); g.fill(); g.restore();
        this.fx.spawn({ kind: 'smoke', x: cx, y: cy, max: 0.5, size: T * 0.4, grow: T, color: '#ff6a1a' });
      } else if (s.card.id === 'pluie_bile') {
        for (let i = 0; i < 4; i++) this.fx.spawn({ kind: 'spark', x: x + (Math.random() - 0.5) * r * 2, y: y - T * 6 * Math.random() - T * 2, vy: T * 14, max: 0.25, size: T * 0.07, color: '#c8ff3a' });
      }
    }
  }

  private drawSummons(dt: number): void {
    const g = this.ctx, T = this.tile;
    for (const s of this.summons) {
      s.t += dt;
      const k = s.t / (s.legend ? 1.4 : 0.8);
      const x = this.sx(s.x), y = this.sy(s.y);
      g.save(); g.globalAlpha = Math.max(0, 1 - k);
      g.strokeStyle = s.color; g.lineWidth = T * 0.07;
      const r = T * (s.legend ? 2.2 : 1.2) * (0.5 + k * 0.5);
      g.beginPath(); g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2); g.stroke();
      g.translate(x, y); g.scale(1, 0.45); g.rotate(s.t * 3);
      for (let i = 0; i < 6; i++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(r * 0.5, 0); g.lineTo(r * 0.9, 0); g.stroke(); }
      g.restore();
      if (s.legend && s.t < 0.8) {
        const lg = g.createLinearGradient(x, y - T * 8, x, y);
        lg.addColorStop(0, alpha(s.color, 0)); lg.addColorStop(1, alpha(s.color, 0.5 * (1 - k)));
        g.fillStyle = lg; g.fillRect(x - T * 0.6, y - T * 8, T * 1.2, T * 8);
      }
    }
    this.summons = this.summons.filter((s) => s.t < (s.legend ? 1.4 : 0.8));
  }

  private drawGhosts(dt: number): void {
    const g = this.ctx, T = this.tile;
    for (const d of this.deathGhosts) {
      d.t += dt;
      const u = getUnit(d.unitId);
      g.save();
      g.globalAlpha = Math.max(0, 0.8 - d.t * 1.6);
      g.translate(this.sx(d.x), this.sy(d.y) + (d.flying ? d.t * T * 3 : 0));
      g.scale(1 + d.t * 0.3, Math.max(0.1, 1 - d.t * 1.4));
      drawCachedMonster(g, u.visual, 0, 0, T * UNIT_PX, 0, false, 0, false, 'ghost');
      g.restore();
    }
    this.deathGhosts = this.deathGhosts.filter((d) => d.t < 0.55);
  }

  private drawDeployZones(me: PlayerId): void {
    const g = this.ctx, T = this.tile;
    const card = this.dragging!;
    if (card.kind === 'spell') return;
    g.fillStyle = 'rgba(255,40,60,0.16)';
    // On teste la légalité par case pour refléter exactement la règle de la simulation.
    for (let y = 0; y < ARENA_H; y++) {
      for (let x = 0; x < ARENA_W; x++) {
        if (!this.battle.canDeployAt(me, card, x + 0.5, y + 0.5)) g.fillRect(this.sx(x), this.sy(y), T + 0.5, T + 0.5);
      }
    }
  }

  private drawPreview(me: PlayerId): void {
    const p = this.preview;
    if (!p) return;
    const g = this.ctx, T = this.tile;
    const x = this.sx(p.x), y = this.sy(p.y);
    const col = p.legal ? '#ffffff' : '#ff4d5a';
    if (p.card.kind === 'spell') {
      const r = p.card.spell!.radius * T;
      g.strokeStyle = col; g.lineWidth = T * 0.07; g.fillStyle = alpha(p.legal ? '#9fd0ff' : '#ff4d5a', 0.18);
      g.beginPath(); g.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      return;
    }
    for (const s of p.card.spawns ?? []) {
      const u = getUnit(s.unit);
      g.globalAlpha = 0.55;
      drawCachedMonster(g, u.visual, x, y, T * UNIT_PX, this.time, false, 0, false);
      g.globalAlpha = 1;
      // portée d'attaque
      if (u.range >= 2) {
        g.strokeStyle = alpha(col, 0.35); g.lineWidth = 1.5; g.setLineDash([4, 4]);
        g.beginPath(); g.ellipse(x, y, (u.range + u.radius) * T, (u.range + u.radius) * T * 0.75, 0, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      }
    }
    g.strokeStyle = col; g.lineWidth = T * 0.06;
    g.beginPath(); g.ellipse(x, y, T * 0.7, T * 0.32, 0, 0, Math.PI * 2); g.stroke();
    void me;
  }

  private drawBanners(dt: number): void {
    if (!this.banners.length) return;
    const g = this.ctx, T = this.tile;
    const b = this.banners[0];
    b.t += dt;
    const a = b.t < 0.2 ? b.t / 0.2 : b.t > 1.6 ? Math.max(0, 1 - (b.t - 1.6) / 0.4) : 1;
    g.save(); g.globalAlpha = a;
    const y = this.sy(13);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, y - T * 1.1, this.canvas.width, T * 1.8);
    g.fillStyle = b.color; g.font = `900 ${Math.round(T * 1.1)}px Georgia, serif`; g.textAlign = 'center';
    g.fillText(b.text, this.canvas.width / 2, y + T * 0.3);
    g.restore();
    if (b.t > 2) this.banners.shift();
  }
}

const colorCache = new Map<string, string>();
function getUnitColor(id: string): string {
  let c = colorCache.get(id);
  if (!c) {
    try { c = getUnit(id).visual.c3; } catch { c = '#ffffff'; }
    colorCache.set(id, c);
  }
  return c;
}
