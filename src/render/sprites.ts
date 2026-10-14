// Rendu procédural des monstres (assets 100 % originaux générés par code).
// Chaque plan corporel produit une silhouette distincte ; les paramètres visuels
// (couleurs, yeux, épines, membres, tentacules, cornes, graine) la personnalisent.
import { Rng } from '../core/rng';
import type { Visual } from '../core/types';

export interface Pose {
  /** Temps d'animation (s). */
  t: number;
  /** En mouvement ? */
  moving: boolean;
  /** Progression de l'attaque 0..1 (0 = repos). */
  attack: number;
}

type Ctx = CanvasRenderingContext2D;
let LOW_DETAIL = false;
/** Qualité basse : supprime les halos lumineux coûteux. */
export function setLowDetail(v: boolean): void { LOW_DETAIL = v; }
const TAU = Math.PI * 2;

function parseColor(c: string): [number, number, number] {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/\d+(\.\d+)?/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}

function shade(color: string, amt: number): string {
  let [r, g, b] = parseColor(color);
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export { shade };

function alpha(color: string, a: number): string {
  const [r, g, b] = parseColor(color);
  return `rgba(${r},${g},${b},${a})`;
}
export { alpha, parseColor };

/** Forme organique irrégulière (asymétrique grâce à la graine). */
function organic(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rng: Rng, wob: number, t: number, pts = 14): void {
  const offs = Array.from({ length: pts }, () => rng.range(-0.18, 0.18));
  ctx.beginPath();
  for (let i = 0; i <= pts + 1; i++) {
    const k = i % pts;
    const a = (k / pts) * TAU;
    const w = 1 + offs[k] + Math.sin(t * 3 + k * 1.7) * wob;
    const x = cx + Math.cos(a) * rx * w, y = cy + Math.sin(a) * ry * w;
    if (i === 0) ctx.moveTo(x, y);
    else {
      const pa = ((k - 0.5) / pts) * TAU;
      ctx.quadraticCurveTo(cx + Math.cos(pa) * rx * (1 + offs[(k + pts - 1) % pts]) * 1.04, cy + Math.sin(pa) * ry * 1.04 * (1 + offs[(k + pts - 1) % pts]), x, y);
    }
  }
  ctx.closePath();
}

function fleshFill(ctx: Ctx, cx: number, cy: number, r: number, base: string): CanvasGradient {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.2);
  g.addColorStop(0, shade(base, 0.35));
  g.addColorStop(0.55, base);
  g.addColorStop(1, shade(base, -0.6));
  return g;
}

function eye(ctx: Ctx, x: number, y: number, r: number, glow: string, t: number, seed: number): void {
  const blink = Math.sin(t * 1.3 + seed) > 0.97 ? 0.15 : 1;
  ctx.save();
  if (!LOW_DETAIL) { ctx.shadowColor = glow; ctx.shadowBlur = r * 3; }
  ctx.fillStyle = '#120a0a';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 1.25 * blink, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(x, y, r, r * blink, 0, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#050203';
  ctx.beginPath(); ctx.ellipse(x + Math.sin(t * 0.7 + seed) * r * 0.25, y, r * 0.28, r * 0.75 * blink, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

function eyeCluster(ctx: Ctx, n: number, cx: number, cy: number, spread: number, r: number, glow: string, rng: Rng, t: number): void {
  if (n <= 0) return;
  if (n === 1) { eye(ctx, cx, cy, r * 1.3, glow, t, rng.next() * 10); return; }
  for (let i = 0; i < n; i++) {
    const a = n <= 2 ? (i === 0 ? Math.PI : 0) : (i / n) * TAU + rng.range(-0.3, 0.3);
    const d = n <= 2 ? spread * 0.55 : spread * rng.range(0.25, 1);
    eye(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, r * rng.range(0.6, 1.1), glow, t, i * 3.1 + rng.next());
  }
}

function spikesAround(ctx: Ctx, n: number, cx: number, cy: number, rx: number, ry: number, len: number, col: string, rng: Rng, from = Math.PI, to = TAU): void {
  if (n <= 0) return;
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const a = from + ((i + 0.5) / n) * (to - from) + rng.range(-0.1, 0.1);
    const bx = cx + Math.cos(a) * rx, by = cy + Math.sin(a) * ry;
    const l = len * rng.range(0.6, 1.3);
    const w = len * 0.22;
    ctx.beginPath();
    ctx.moveTo(bx + Math.cos(a + Math.PI / 2) * w, by + Math.sin(a + Math.PI / 2) * w);
    ctx.quadraticCurveTo(bx + Math.cos(a) * l * 0.6 + Math.cos(a + 1.2) * w, by + Math.sin(a) * l * 0.6, bx + Math.cos(a + 0.15) * l, by + Math.sin(a + 0.15) * l);
    ctx.lineTo(bx + Math.cos(a - Math.PI / 2) * w, by + Math.sin(a - Math.PI / 2) * w);
    ctx.closePath(); ctx.fill();
  }
}

function teeth(ctx: Ctx, x: number, y: number, w: number, h: number, n: number, open: number, col = '#efe6cf'): void {
  ctx.fillStyle = '#1a0507';
  ctx.beginPath(); ctx.ellipse(x, y, w / 2, h * (0.25 + open * 0.75) / 2 + 0.5, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = col;
  const oh = h * (0.25 + open * 0.75) / 2;
  for (let i = 0; i < n; i++) {
    const tx = x - w / 2 + (w * (i + 0.5)) / n;
    const tw = w / n * 0.45;
    ctx.beginPath(); ctx.moveTo(tx - tw, y - oh); ctx.lineTo(tx + tw, y - oh); ctx.lineTo(tx, y - oh + h * 0.35); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - tw, y + oh); ctx.lineTo(tx + tw, y + oh); ctx.lineTo(tx + tw * 0.3, y + oh - h * 0.32); ctx.closePath(); ctx.fill();
  }
}

function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, w: number, col: string): void {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
}

function tentacle(ctx: Ctx, x: number, y: number, len: number, w: number, ang: number, t: number, phase: number, col: string): void {
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  let px = x, py = y, a = ang;
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    a += Math.sin(t * 2.2 + phase + i * 0.7) * 0.28;
    const nx = px + Math.cos(a) * (len / segs), ny = py + Math.sin(a) * (len / segs);
    ctx.lineWidth = w * (1 - i / segs) + 0.5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
    px = nx; py = ny;
  }
}

function horns(ctx: Ctx, n: number, cx: number, cy: number, r: number, col: string, rng: Rng): void {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const k = Math.floor(i / 2);
    const bx = cx + side * r * (0.35 + k * 0.25), by = cy - r * (0.55 - k * 0.12);
    const l = r * rng.range(0.7, 1.2) * (1 - k * 0.2);
    ctx.beginPath();
    ctx.moveTo(bx - side * r * 0.12, by + r * 0.05);
    ctx.quadraticCurveTo(bx + side * l * 0.8, by - l * 0.2, bx + side * l * 0.6, by - l);
    ctx.quadraticCurveTo(bx + side * l * 0.3, by - l * 0.3, bx + side * r * 0.12, by);
    ctx.closePath(); ctx.fill();
  }
}

function ribs(ctx: Ctx, cx: number, cy: number, w: number, h: number, n: number, col: string): void {
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, w * 0.07);
  for (let i = 0; i < n; i++) {
    const y = cy - h / 2 + (h * (i + 0.5)) / n;
    const ww = w * (1 - Math.abs(i - n / 2) / n) * 0.5;
    ctx.beginPath(); ctx.moveTo(cx - ww, y + ww * 0.25); ctx.quadraticCurveTo(cx, y - ww * 0.35, cx + ww, y + ww * 0.25); ctx.stroke();
  }
}

function stitches(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, n: number, s: number): void {
  ctx.strokeStyle = 'rgba(27,12,12,0.75)'; ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  n = Math.max(2, Math.ceil(n / 2));
  for (let i = 1; i < n; i++) {
    const x = x1 + (dx * i) / n, y = y1 + (dy * i) / n;
    ctx.beginPath(); ctx.moveTo(x - nx * s * 0.12, y - ny * s * 0.12); ctx.lineTo(x + nx * s * 0.12, y + ny * s * 0.12); ctx.stroke();
  }
}

// ============================================================ plans corporels
// Convention : (0,0) = contact au sol, le corps s'élève vers y négatif. `s` = taille en px.

function drawWorm(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const segs = 6;
  const wave = p.moving ? p.t * 8 : p.t * 2;
  for (let i = segs - 1; i >= 0; i--) {
    const x = -s * 0.5 + i * s * 0.18 + Math.sin(wave + i * 0.9) * s * 0.05;
    const y = -s * 0.22 - Math.abs(Math.sin(wave * 0.5 + i)) * s * 0.06 - (i === segs - 1 ? p.attack * s * 0.15 : 0);
    const r = s * (0.2 - Math.abs(i - 3) * 0.015);
    ctx.fillStyle = fleshFill(ctx, x, y, r, i % 2 ? v.c1 : shade(v.c1, -0.15));
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.85, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(v.c1, -0.5); ctx.lineWidth = s * 0.02; ctx.stroke();
  }
  const hx = -s * 0.5 + (segs - 1) * s * 0.18 + s * 0.12, hy = -s * 0.26 - p.attack * s * 0.15;
  ctx.fillStyle = shade(v.c2, -0.2);
  ctx.beginPath(); ctx.arc(hx, hy, s * 0.16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a0508'; ctx.beginPath(); ctx.arc(hx + s * 0.04, hy, s * 0.1 + p.attack * s * 0.04, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f1e7d0';
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; ctx.beginPath(); ctx.arc(hx + s * 0.04 + Math.cos(a) * s * 0.08, hy + Math.sin(a) * s * 0.08, s * 0.022, 0, TAU); ctx.fill(); }
  spikesAround(ctx, v.spikes, -s * 0.15, -s * 0.3, s * 0.35, s * 0.15, s * 0.12, v.c2, rng);
  void v.eyes;
}

function drawBiped(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng, hunch = 0.25): void {
  const step = p.moving ? Math.sin(p.t * 9) : 0;
  const atk = p.attack;
  // jambes
  const legCol = shade(v.c1, -0.35);
  limb(ctx, -s * 0.12, -s * 0.55, -s * 0.18 - step * s * 0.12, -s * 0.28, -s * 0.14 - step * s * 0.18, 0, s * 0.12, legCol);
  limb(ctx, s * 0.12, -s * 0.55, s * 0.2 + step * s * 0.12, -s * 0.28, s * 0.16 + step * s * 0.18, 0, s * 0.12, legCol);
  // torse voûté
  const tx = s * hunch * 0.3, ty = -s * 0.8;
  ctx.fillStyle = fleshFill(ctx, tx, ty, s * 0.35, v.c1);
  organic(ctx, tx, ty, s * 0.3, s * 0.34, rng, 0.02, p.t);
  ctx.fill();
  ribs(ctx, tx, ty + s * 0.05, s * 0.4, s * 0.38, 4, alpha(v.c2, 0.55));
  spikesAround(ctx, v.spikes, tx, ty, s * 0.26, s * 0.3, s * 0.2, shade(v.c2, -0.1), rng, Math.PI * 1.1, Math.PI * 1.9);
  // bras (le bras avant frappe)
  const armCol = shade(v.c1, -0.15);
  const reach = atk > 0 ? Math.sin(atk * Math.PI) : 0;
  limb(ctx, tx - s * 0.22, ty - s * 0.1, tx - s * 0.38, ty + s * 0.2, tx - s * 0.32, ty + s * 0.45, s * 0.09, armCol);
  limb(ctx, tx + s * 0.22, ty - s * 0.1, tx + s * 0.42 + reach * s * 0.25, ty + s * 0.08 - reach * s * 0.2, tx + s * 0.5 + reach * s * 0.4, ty + s * 0.3 - reach * s * 0.25, s * 0.1, armCol);
  // griffes
  ctx.fillStyle = v.c2;
  for (let k = 0; k < 3; k++) {
    const cx = tx + s * 0.5 + reach * s * 0.4, cy = ty + s * 0.3 - reach * s * 0.25;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.1, cy + s * (0.02 + k * 0.05)); ctx.lineTo(cx + s * 0.02, cy + s * 0.03 * k); ctx.fill();
  }
  if (v.limbs > 2) limb(ctx, tx + s * 0.1, ty + s * 0.1, tx + s * 0.35, ty + s * 0.25, tx + s * 0.3, ty + s * 0.5, s * 0.06, shade(v.c2, -0.3));
  if (v.limbs > 3) limb(ctx, tx - s * 0.1, ty + s * 0.1, tx - s * 0.32, ty + s * 0.3, tx - s * 0.42, ty + s * 0.5, s * 0.06, shade(v.c2, -0.3));
  // tentacules dorsales
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, tx - s * 0.1, ty - s * 0.2, s * 0.5, s * 0.07, -Math.PI / 2 - 0.6 - k * 0.5, p.t, k, shade(v.c1, -0.25));
  // tête
  const hx = tx + s * hunch * 0.6, hy = ty - s * 0.38;
  ctx.fillStyle = fleshFill(ctx, hx, hy, s * 0.18, v.c2);
  organic(ctx, hx, hy, s * 0.17, s * 0.19, rng, 0.01, p.t, 10); ctx.fill();
  horns(ctx, v.horns, hx, hy, s * 0.2, shade(v.c2, -0.3), rng);
  if (v.eyes === 0) {
    ctx.strokeStyle = '#140708'; ctx.lineWidth = s * 0.03;
    stitches(ctx, hx - s * 0.12, hy - s * 0.03, hx + s * 0.12, hy - s * 0.02, 5, s);
  } else eyeCluster(ctx, v.eyes, hx, hy - s * 0.04, s * 0.12, s * 0.035, v.c3, rng, p.t);
  teeth(ctx, hx + s * 0.02, hy + s * 0.09, s * 0.17, s * 0.08, 5, atk);
}

function drawBrute(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? Math.sin(p.t * 6) : 0;
  const legCol = shade(v.c1, -0.4);
  limb(ctx, -s * 0.2, -s * 0.45, -s * 0.28 - step * s * 0.08, -s * 0.22, -s * 0.24 - step * s * 0.12, 0, s * 0.2, legCol);
  limb(ctx, s * 0.2, -s * 0.45, s * 0.28 + step * s * 0.08, -s * 0.22, s * 0.26 + step * s * 0.12, 0, s * 0.2, legCol);
  const ty = -s * 0.85 - Math.abs(step) * s * 0.03;
  ctx.fillStyle = fleshFill(ctx, 0, ty, s * 0.5, v.c1);
  organic(ctx, 0, ty, s * 0.48, s * 0.42, rng, 0.015, p.t, 16); ctx.fill();
  ctx.strokeStyle = shade(v.c1, -0.55); ctx.lineWidth = s * 0.025; ctx.stroke();
  stitches(ctx, -s * 0.2, ty - s * 0.25, s * 0.15, ty + s * 0.2, 6, s);
  spikesAround(ctx, v.spikes, 0, ty, s * 0.44, s * 0.38, s * 0.22, shade(v.c2, -0.1), rng, Math.PI * 1.05, Math.PI * 1.95);
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, -s * 0.3 + k * s * 0.2, ty + s * 0.3, s * 0.45, s * 0.09, Math.PI / 2 + (k - v.tentacles / 2) * 0.35, p.t, k * 1.3, shade(v.c1, -0.2));
  const atk = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const armCol = shade(v.c1, -0.1);
  limb(ctx, -s * 0.42, ty - s * 0.15, -s * 0.65, ty + s * 0.2, -s * 0.55, ty + s * 0.6, s * 0.2, armCol);
  limb(ctx, s * 0.42, ty - s * 0.15, s * 0.68 + atk * s * 0.2, ty + s * 0.05 - atk * s * 0.4, s * 0.62 + atk * s * 0.35, ty + s * 0.5 - atk * s * 0.6, s * 0.22, armCol);
  ctx.fillStyle = shade(v.c2, -0.2);
  ctx.beginPath(); ctx.arc(s * 0.62 + atk * s * 0.35, ty + s * 0.52 - atk * s * 0.6, s * 0.14, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(-s * 0.55, ty + s * 0.62, s * 0.13, 0, TAU); ctx.fill();
  const hy = ty - s * 0.42;
  ctx.fillStyle = fleshFill(ctx, s * 0.05, hy, s * 0.17, v.c2);
  organic(ctx, s * 0.05, hy, s * 0.16, s * 0.15, rng, 0.01, p.t, 10); ctx.fill();
  horns(ctx, v.horns, s * 0.05, hy, s * 0.2, shade(v.c2, -0.35), rng);
  eyeCluster(ctx, v.eyes, s * 0.05, hy - s * 0.03, s * 0.12, s * 0.035, v.c3, rng, p.t);
  teeth(ctx, s * 0.06, hy + s * 0.08, s * 0.16, s * 0.08, 5, p.attack);
}

function drawQuadruped(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? p.t * 10 : 0;
  const by = -s * 0.5;
  const legCol = shade(v.c1, -0.4);
  const legs = Math.max(4, v.limbs);
  for (let i = 0; i < legs; i++) {
    const lx = -s * 0.35 + (i / (legs - 1)) * s * 0.7;
    const ph = Math.sin(step + i * Math.PI * 0.9);
    limb(ctx, lx, by + s * 0.05, lx + ph * s * 0.08 - s * 0.05, by + s * 0.28, lx + ph * s * 0.14, 0, s * 0.08, i % 2 ? legCol : shade(legCol, -0.2));
  }
  ctx.fillStyle = fleshFill(ctx, 0, by, s * 0.45, v.c1);
  organic(ctx, 0, by, s * 0.48, s * 0.24, rng, 0.02, p.t, 14); ctx.fill();
  ctx.strokeStyle = shade(v.c1, -0.55); ctx.lineWidth = s * 0.02; ctx.stroke();
  // vertèbres saillantes
  ctx.fillStyle = shade(v.c2, -0.05);
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(-s * 0.35 + k * s * 0.13, by - s * 0.2, s * 0.04, s * 0.03, 0, 0, TAU); ctx.fill(); }
  spikesAround(ctx, v.spikes, 0, by, s * 0.45, s * 0.22, s * 0.18, shade(v.c2, -0.15), rng, Math.PI * 1.1, Math.PI * 1.9);
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, -s * 0.45, by - s * 0.05, s * 0.4, s * 0.06, Math.PI + 0.4 * k - 0.3, p.t, k, shade(v.c1, -0.2));
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * s * 0.15 : 0;
  const hx = s * 0.52 + lunge, hy = by - s * 0.08;
  ctx.fillStyle = fleshFill(ctx, hx, hy, s * 0.2, v.c2);
  organic(ctx, hx, hy, s * 0.22, s * 0.16, rng, 0.01, p.t, 10); ctx.fill();
  horns(ctx, v.horns, hx, hy, s * 0.2, shade(v.c2, -0.4), rng);
  eyeCluster(ctx, v.eyes, hx - s * 0.02, hy - s * 0.05, s * 0.1, s * 0.03, v.c3, rng, p.t);
  teeth(ctx, hx + s * 0.1, hy + s * 0.06, s * 0.18, s * 0.09, 6, p.attack);
}

function drawInsect(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? p.t * 14 : p.t;
  const by = -s * 0.42;
  const legs = Math.max(4, v.limbs);
  ctx.strokeStyle = shade(v.c1, -0.5);
  for (let i = 0; i < legs; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const lx = -s * 0.15 + k * s * 0.18;
    const ph = Math.sin(step + i * 1.4) * s * 0.06;
    limb(ctx, lx, by, lx + side * s * 0.12 + ph, by - s * 0.12, lx + side * s * 0.28 + ph, 0, s * 0.045, shade(v.c1, -0.45));
  }
  // abdomen
  ctx.fillStyle = fleshFill(ctx, -s * 0.3, by, s * 0.35, v.c1);
  organic(ctx, -s * 0.28, by - s * 0.05, s * 0.34, s * 0.26, rng, 0.015, p.t, 12); ctx.fill();
  ctx.strokeStyle = shade(v.c2, -0.2); ctx.lineWidth = s * 0.025;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(-s * 0.28, by - s * 0.05, s * (0.08 + k * 0.07), Math.PI * 1.2, Math.PI * 1.8); ctx.stroke(); }
  // thorax
  ctx.fillStyle = fleshFill(ctx, s * 0.1, by - s * 0.1, s * 0.2, shade(v.c1, 0.05));
  organic(ctx, s * 0.1, by - s * 0.1, s * 0.2, s * 0.18, rng, 0.01, p.t, 10); ctx.fill();
  spikesAround(ctx, v.spikes, -s * 0.15, by - s * 0.05, s * 0.4, s * 0.25, s * 0.16, shade(v.c2, 0.1), rng, Math.PI, TAU);
  const hx = s * 0.33 + (p.attack > 0 ? Math.sin(p.attack * Math.PI) * s * 0.1 : 0), hy = by - s * 0.15;
  ctx.fillStyle = fleshFill(ctx, hx, hy, s * 0.14, v.c2);
  ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.14, s * 0.12, 0, 0, TAU); ctx.fill();
  horns(ctx, v.horns, hx, hy, s * 0.18, shade(v.c2, -0.3), rng);
  // mandibules
  const open = 0.3 + p.attack * 0.6;
  ctx.fillStyle = shade(v.c2, -0.35);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(hx + s * 0.1, hy + side * s * 0.03);
    ctx.quadraticCurveTo(hx + s * 0.3, hy + side * s * (0.06 + open * 0.1), hx + s * 0.28, hy + side * s * 0.01);
    ctx.lineTo(hx + s * 0.12, hy); ctx.fill();
  }
  eyeCluster(ctx, v.eyes, hx + s * 0.02, hy - s * 0.03, s * 0.08, s * 0.025, v.c3, rng, p.t);
}

function drawMantis(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? Math.sin(p.t * 10) : 0;
  const legCol = shade(v.c1, -0.4);
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1;
    limb(ctx, side * s * 0.05, -s * 0.5, side * s * 0.25 + step * s * 0.05 * side, -s * 0.35, side * s * 0.3 + step * s * 0.08, 0, s * 0.04, legCol);
  }
  ctx.fillStyle = fleshFill(ctx, -s * 0.15, -s * 0.45, s * 0.25, v.c1);
  organic(ctx, -s * 0.18, -s * 0.45, s * 0.28, s * 0.12, rng, 0.02, p.t, 10); ctx.fill();
  // thorax dressé
  ctx.strokeStyle = shade(v.c1, 0.1); ctx.lineWidth = s * 0.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s * 0.05, -s * 0.5); ctx.quadraticCurveTo(s * 0.15, -s * 0.85, s * 0.1, -s * 1.15); ctx.stroke();
  // faux raptoriales
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const scy = (side: number, extra: number) => {
    const bx = s * 0.12, by = -s * 0.95;
    const ex = bx + s * (0.25 + a * 0.35) + side * s * 0.05, ey = by + s * (0.15 - a * 0.3);
    limb(ctx, bx, by, ex, ey, ex - s * 0.05, ey + s * (0.35 - a * 0.25) + extra, s * 0.06, shade(v.c2, -0.1));
    ctx.fillStyle = v.c2;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.quadraticCurveTo(ex + s * 0.25, ey + s * 0.1, ex + s * 0.1, ey + s * 0.4 + extra); ctx.lineTo(ex - s * 0.02, ey + s * 0.1); ctx.fill();
  };
  scy(-1, 0);
  if (v.limbs > 4) scy(1, s * 0.12);
  // tête triangulaire
  const hx = s * 0.12, hy = -s * 1.25;
  ctx.fillStyle = fleshFill(ctx, hx, hy, s * 0.14, v.c2);
  ctx.beginPath(); ctx.moveTo(hx - s * 0.16, hy - s * 0.08); ctx.lineTo(hx + s * 0.16, hy - s * 0.08); ctx.lineTo(hx + s * 0.02, hy + s * 0.14); ctx.closePath(); ctx.fill();
  horns(ctx, v.horns, hx, hy, s * 0.18, shade(v.c2, -0.3), rng);
  eye(ctx, hx - s * 0.1, hy - s * 0.05, s * 0.045, v.c3, p.t, 1);
  eye(ctx, hx + s * 0.1, hy - s * 0.05, s * 0.045, v.c3, p.t, 2);
  if (v.eyes > 2) eye(ctx, hx, hy + s * 0.01, s * 0.025, v.c3, p.t, 3);
}

function drawSpider(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? p.t * 14 : p.t * 0.5;
  const by = -s * 0.45;
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const ph = Math.sin(step + i * 1.1) * s * 0.06;
    const bx = side * s * 0.1, ang = (k - 1.5) * 0.35;
    limb(ctx, bx, by, bx + side * s * (0.35 + Math.cos(ang) * 0.05) + ph, by - s * (0.3 - k * 0.04), bx + side * s * (0.55 - k * 0.05) + ph, -s * 0.0, s * 0.05, shade(v.c1, -0.45));
  }
  ctx.fillStyle = fleshFill(ctx, -s * 0.15, by, s * 0.3, v.c1);
  organic(ctx, -s * 0.18, by - s * 0.05, s * 0.3, s * 0.26, rng, 0.02, p.t, 12); ctx.fill();
  ctx.fillStyle = alpha(v.c3, 0.4);
  ctx.beginPath(); ctx.moveTo(-s * 0.18, by - s * 0.2); ctx.lineTo(-s * 0.08, by - s * 0.05); ctx.lineTo(-s * 0.18, by + s * 0.1); ctx.lineTo(-s * 0.28, by - s * 0.05); ctx.fill();
  ctx.fillStyle = fleshFill(ctx, s * 0.15, by, s * 0.18, v.c2);
  organic(ctx, s * 0.16, by + s * 0.02, s * 0.17, s * 0.15, rng, 0.01, p.t, 10); ctx.fill();
  eyeCluster(ctx, v.eyes, s * 0.2, by - s * 0.02, s * 0.1, s * 0.025, v.c3, rng, p.t);
  teeth(ctx, s * 0.27, by + s * 0.09, s * 0.12, s * 0.07, 4, p.attack);
}

function drawCrab(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? p.t * 10 : 0;
  const by = -s * 0.4;
  for (let i = 0; i < Math.max(4, v.limbs); i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const ph = Math.sin(step + i) * s * 0.05;
    limb(ctx, side * s * (0.2 + k * 0.08), by + s * 0.05, side * s * (0.45 + k * 0.05), by - s * 0.05 + ph, side * s * (0.5 + k * 0.04), 0, s * 0.05, shade(v.c1, -0.45));
  }
  ctx.fillStyle = fleshFill(ctx, 0, by, s * 0.5, v.c1);
  organic(ctx, 0, by, s * 0.48, s * 0.28, rng, 0.01, p.t, 16); ctx.fill();
  ctx.strokeStyle = shade(v.c2, 0.2); ctx.lineWidth = s * 0.02;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(0, by + s * 0.1, s * (0.15 + k * 0.1), Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  spikesAround(ctx, v.spikes, 0, by, s * 0.46, s * 0.26, s * 0.14, shade(v.c2, 0.1), rng, Math.PI, TAU);
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  for (const side of [-1, 1]) {
    const cx = side * s * (0.6 + a * 0.1), cy = by - s * 0.15 - a * s * 0.1;
    limb(ctx, side * s * 0.35, by - s * 0.05, side * s * 0.5, by - s * 0.2, cx, cy, s * 0.08, shade(v.c1, -0.1));
    ctx.fillStyle = shade(v.c2, -0.1);
    ctx.beginPath(); ctx.ellipse(cx + side * s * 0.08, cy, s * 0.15, s * 0.1, side * 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1a0c0c';
    ctx.beginPath(); ctx.moveTo(cx + side * s * 0.05, cy); ctx.lineTo(cx + side * s * 0.25, cy - s * (0.03 + a * 0.06)); ctx.lineTo(cx + side * s * 0.22, cy + s * 0.03); ctx.fill();
  }
  eye(ctx, -s * 0.08, by - s * 0.3, s * 0.045, v.c3, p.t, 1);
  eye(ctx, s * 0.08, by - s * 0.3, s * 0.045, v.c3, p.t, 2);
  if (v.eyes > 2) eyeCluster(ctx, v.eyes - 2, 0, by - s * 0.15, s * 0.1, s * 0.025, v.c3, rng, p.t);
}

function drawSerpent(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const wave = p.moving ? p.t * 9 : p.t;
  const segs = 8;
  const pts: [number, number][] = [];
  for (let i = 0; i < segs; i++) pts.push([-s * 0.6 + i * s * 0.17, -s * 0.22 + Math.sin(wave + i * 0.8) * s * 0.05]);
  for (let i = 0; i < segs; i++) {
    const [x, y] = pts[i];
    ctx.strokeStyle = shade(v.c1, -0.5); ctx.lineWidth = s * 0.03;
    for (const side of [-1, 1]) {
      const ph = Math.sin(wave * 1.5 + i * 1.3 + (side > 0 ? 1 : 0)) * s * 0.05;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ph, y + side * s * 0.08 + s * 0.12); ctx.stroke();
    }
  }
  for (let i = 0; i < segs; i++) {
    const [x, y] = pts[i];
    ctx.fillStyle = fleshFill(ctx, x, y, s * 0.12, i % 2 ? v.c1 : shade(v.c1, -0.15));
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.11, s * 0.1, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(v.c2, -0.2); ctx.beginPath(); ctx.ellipse(x, y - s * 0.06, s * 0.08, s * 0.03, 0, 0, TAU); ctx.fill();
  }
  const [hx, hy] = pts[segs - 1];
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * s * 0.12 : 0;
  ctx.fillStyle = fleshFill(ctx, hx + s * 0.12, hy, s * 0.14, v.c2);
  ctx.beginPath(); ctx.ellipse(hx + s * 0.14 + lunge, hy - s * 0.02, s * 0.14, s * 0.11, 0, 0, TAU); ctx.fill();
  horns(ctx, v.horns, hx + s * 0.14 + lunge, hy - s * 0.02, s * 0.14, shade(v.c2, -0.3), rng);
  eyeCluster(ctx, v.eyes, hx + s * 0.16 + lunge, hy - s * 0.05, s * 0.07, s * 0.025, v.c3, rng, p.t);
  // cavalier greffé
  const rx = -s * 0.15, ry = -s * 0.42;
  ctx.fillStyle = fleshFill(ctx, rx, ry, s * 0.15, shade(v.c2, -0.1));
  organic(ctx, rx, ry, s * 0.11, s * 0.16, rng, 0.02, p.t, 8); ctx.fill();
  ctx.fillStyle = shade(v.c2, -0.3); ctx.beginPath(); ctx.arc(rx + s * 0.02, ry - s * 0.2, s * 0.07, 0, TAU); ctx.fill();
  eye(ctx, rx + s * 0.04, ry - s * 0.2, s * 0.02, v.c3, p.t, 9);
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  ctx.strokeStyle = '#d6d0c0'; ctx.lineWidth = s * 0.025;
  ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + s * (0.45 + a * 0.2), ry - s * (0.1 - a * 0.15)); ctx.stroke();
}

function drawFly(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const hover = -s * 0.9 + Math.sin(p.t * 6) * s * 0.06;
  const flap = Math.sin(p.t * 40);
  ctx.fillStyle = alpha('#e8f0ff', 0.28);
  ctx.strokeStyle = alpha(v.c3, 0.45); ctx.lineWidth = s * 0.015;
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * s * 0.22, hover - s * 0.15 - flap * s * 0.05, s * 0.28, s * 0.1 + Math.abs(flap) * s * 0.06, side * (0.5 + flap * 0.3), 0, TAU); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = fleshFill(ctx, 0, hover, s * 0.2, v.c1);
  organic(ctx, -s * 0.05, hover, s * 0.22, s * 0.16, rng, 0.02, p.t, 10); ctx.fill();
  ctx.strokeStyle = shade(v.c1, -0.5); ctx.lineWidth = s * 0.02;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.15 + k * s * 0.08, hover - s * 0.14); ctx.lineTo(-s * 0.17 + k * s * 0.08, hover + s * 0.14); ctx.stroke(); }
  ctx.fillStyle = shade(v.c2, -0.2); ctx.beginPath(); ctx.arc(s * 0.18, hover, s * 0.1, 0, TAU); ctx.fill();
  eye(ctx, s * 0.2, hover - s * 0.04, s * 0.05, v.c3, p.t, 1);
  if (v.eyes > 1) eye(ctx, s * 0.14, hover + s * 0.03, s * 0.035, v.c3, p.t, 2);
  ctx.strokeStyle = shade(v.c2, -0.4); ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.moveTo(s * 0.26, hover + s * 0.03); ctx.lineTo(s * 0.4 + p.attack * s * 0.12, hover + s * 0.12); ctx.stroke();
  for (let k = 0; k < 3; k++) limb(ctx, -s * 0.05 + k * s * 0.07, hover + s * 0.12, -s * 0.08 + k * s * 0.07, hover + s * 0.25, -s * 0.02 + k * s * 0.07, hover + s * 0.32, s * 0.015, shade(v.c1, -0.4));
}

function drawEye(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const hover = -s * 1.0 + Math.sin(p.t * 3) * s * 0.07;
  const flap = Math.sin(p.t * 9);
  for (const side of [-1, 1]) {
    ctx.fillStyle = shade(v.c1, -0.25);
    ctx.beginPath();
    ctx.moveTo(side * s * 0.2, hover);
    ctx.quadraticCurveTo(side * s * 0.55, hover - s * (0.35 + flap * 0.15), side * s * 0.7, hover - s * (0.05 + flap * 0.2));
    ctx.quadraticCurveTo(side * s * 0.5, hover + s * 0.0, side * s * 0.55, hover + s * 0.12);
    ctx.quadraticCurveTo(side * s * 0.35, hover + s * 0.05, side * s * 0.2, hover + s * 0.1);
    ctx.fill();
    ctx.strokeStyle = shade(v.c1, -0.6); ctx.lineWidth = s * 0.015;
    ctx.beginPath(); ctx.moveTo(side * s * 0.2, hover); ctx.lineTo(side * s * 0.62, hover - s * (0.1 + flap * 0.18)); ctx.stroke();
  }
  for (let k = 0; k < 4; k++) tentacle(ctx, -s * 0.1 + k * s * 0.07, hover + s * 0.2, s * 0.35, s * 0.04, Math.PI / 2 + (k - 1.5) * 0.25, p.t, k, shade(v.c1, -0.3));
  const g = ctx.createRadialGradient(-s * 0.06, hover - s * 0.08, s * 0.02, 0, hover, s * 0.3);
  g.addColorStop(0, '#fff6ea'); g.addColorStop(0.7, '#e6c9b8'); g.addColorStop(1, '#8a4b4b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, hover, s * 0.28, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(160,20,30,0.7)'; ctx.lineWidth = s * 0.012;
  for (let k = 0; k < 7; k++) {
    const a = rng.range(0, TAU);
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * 0.27, hover + Math.sin(a) * s * 0.27);
    ctx.quadraticCurveTo(Math.cos(a + 0.3) * s * 0.18, hover + Math.sin(a + 0.3) * s * 0.18, Math.cos(a) * s * 0.12, hover + Math.sin(a) * s * 0.12); ctx.stroke();
  }
  const look = Math.sin(p.t * 0.9) * s * 0.05;
  ctx.save(); ctx.shadowColor = v.c3; ctx.shadowBlur = s * 0.2;
  ctx.fillStyle = v.c3; ctx.beginPath(); ctx.arc(look + s * 0.05, hover, s * 0.13, 0, TAU); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#050304'; ctx.beginPath(); ctx.ellipse(look + s * 0.06, hover, s * 0.035, s * (0.1 - p.attack * 0.05), 0, 0, TAU); ctx.fill();
}

function drawWinged(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const hover = -s * 1.0 + Math.sin(p.t * 3) * s * 0.06;
  const flap = Math.sin(p.t * 5);
  for (const side of [-1, 1]) {
    const wy = hover - s * 0.1;
    ctx.fillStyle = shade(v.c1, -0.35);
    ctx.beginPath();
    ctx.moveTo(side * s * 0.1, wy);
    ctx.lineTo(side * s * 0.45, wy - s * (0.5 + flap * 0.3));
    ctx.lineTo(side * s * 0.95, wy - s * (0.3 + flap * 0.35));
    ctx.quadraticCurveTo(side * s * 0.75, wy - s * 0.05, side * s * 0.8, wy + s * 0.1 - flap * s * 0.1);
    ctx.quadraticCurveTo(side * s * 0.55, wy, side * s * 0.5, wy + s * 0.18);
    ctx.quadraticCurveTo(side * s * 0.3, wy + s * 0.05, side * s * 0.1, wy + s * 0.15);
    ctx.fill();
    ctx.strokeStyle = shade(v.c2, -0.1); ctx.lineWidth = s * 0.025;
    ctx.beginPath(); ctx.moveTo(side * s * 0.1, wy); ctx.lineTo(side * s * 0.45, wy - s * (0.5 + flap * 0.3)); ctx.lineTo(side * s * 0.95, wy - s * (0.3 + flap * 0.35)); ctx.stroke();
    ctx.lineWidth = s * 0.012;
    ctx.beginPath(); ctx.moveTo(side * s * 0.45, wy - s * (0.5 + flap * 0.3)); ctx.lineTo(side * s * 0.5, wy + s * 0.18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(side * s * 0.45, wy - s * (0.5 + flap * 0.3)); ctx.lineTo(side * s * 0.8, wy + s * 0.1 - flap * s * 0.1); ctx.stroke();
  }
  // queue
  ctx.strokeStyle = shade(v.c1, -0.1); ctx.lineCap = 'round';
  tentacle(ctx, -s * 0.15, hover + s * 0.1, s * 0.6, s * 0.1, Math.PI * 0.8, p.t, 0, shade(v.c1, -0.1));
  ctx.fillStyle = fleshFill(ctx, 0, hover, s * 0.3, v.c1);
  organic(ctx, 0, hover, s * 0.3, s * 0.2, rng, 0.02, p.t, 12); ctx.fill();
  ribs(ctx, 0, hover, s * 0.4, s * 0.25, 4, alpha('#e8e0d0', 0.5));
  spikesAround(ctx, v.spikes, 0, hover, s * 0.28, s * 0.18, s * 0.14, shade(v.c2, 0.1), rng, Math.PI, TAU);
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * s * 0.1 : 0;
  ctx.strokeStyle = shade(v.c1, 0.05); ctx.lineWidth = s * 0.12;
  ctx.beginPath(); ctx.moveTo(s * 0.2, hover - s * 0.05); ctx.quadraticCurveTo(s * 0.4, hover - s * 0.35, s * 0.45 + lunge, hover - s * 0.35); ctx.stroke();
  const hx = s * 0.5 + lunge, hy = hover - s * 0.38;
  ctx.fillStyle = fleshFill(ctx, hx, hy, s * 0.15, v.c2);
  ctx.beginPath(); ctx.ellipse(hx + s * 0.05, hy, s * 0.17, s * 0.1, 0.15, 0, TAU); ctx.fill();
  horns(ctx, v.horns, hx, hy, s * 0.16, shade(v.c2, -0.35), rng);
  eyeCluster(ctx, v.eyes, hx, hy - s * 0.03, s * 0.07, s * 0.025, v.c3, rng, p.t);
  teeth(ctx, hx + s * 0.14, hy + s * 0.04, s * 0.12, s * 0.07, 4, p.attack);
  if (p.attack > 0.2) {
    ctx.save(); ctx.globalAlpha = Math.sin(p.attack * Math.PI) * 0.8; ctx.fillStyle = v.c3; ctx.shadowColor = v.c3; ctx.shadowBlur = s * 0.3;
    ctx.beginPath(); ctx.arc(hx + s * 0.25, hy + s * 0.05, s * 0.07, 0, TAU); ctx.fill(); ctx.restore();
  }
}

function drawBlob(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const squash = 1 + Math.sin(p.t * (p.moving ? 8 : 2.5)) * 0.06 + p.attack * 0.15;
  const r = s * 0.45;
  const cy = -r / squash;
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, -r * 0.6 + (k / Math.max(1, v.tentacles - 1)) * r * 1.2, cy + r * 0.4, s * 0.4, s * 0.08, Math.PI / 2 + (k - v.tentacles / 2) * 0.3, p.t, k * 0.9, shade(v.c1, -0.25));
  ctx.fillStyle = fleshFill(ctx, 0, cy, r, v.c1);
  ctx.save(); ctx.translate(0, cy); ctx.scale(squash, 1 / squash);
  organic(ctx, 0, 0, r, r * 0.92, rng, 0.04, p.t, 16); ctx.fill();
  ctx.strokeStyle = shade(v.c1, -0.55); ctx.lineWidth = s * 0.02; ctx.stroke();
  // pustules
  for (let k = 0; k < 5; k++) {
    const a = rng.range(0, TAU), d = rng.range(0.3, 0.8) * r;
    ctx.fillStyle = alpha(v.c3, 0.55);
    ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.9, s * rng.range(0.025, 0.05), 0, TAU); ctx.fill();
  }
  ctx.restore();
  spikesAround(ctx, v.spikes, 0, cy, r * squash, r * 0.9 / squash, s * 0.15, shade(v.c2, -0.1), rng, 0, TAU);
  eyeCluster(ctx, v.eyes, 0, cy - r * 0.25, r * 0.6, s * 0.04, v.c3, rng, p.t);
  teeth(ctx, 0, cy + r * 0.3, r * 0.9, r * 0.3, 7, p.attack);
}

function drawSkeletal(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? Math.sin(p.t * 9) : 0;
  const bone = v.c1;
  const dark = shade(v.c2, -0.2);
  const many = v.limbs > 4;
  if (many) {
    for (let i = 0; i < v.limbs; i++) {
      const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const ph = Math.sin(p.t * 12 + i) * s * 0.04;
      limb(ctx, side * s * 0.05 + k * s * 0.05, -s * 0.35, side * s * 0.25, -s * 0.3 + ph, side * s * 0.3 + ph, 0, s * 0.035, bone);
    }
  } else {
    limb(ctx, -s * 0.08, -s * 0.55, -s * 0.12 - step * s * 0.1, -s * 0.28, -s * 0.1 - step * s * 0.15, 0, s * 0.05, bone);
    limb(ctx, s * 0.08, -s * 0.55, s * 0.12 + step * s * 0.1, -s * 0.28, s * 0.12 + step * s * 0.15, 0, s * 0.05, bone);
  }
  const top = many ? -s * 0.5 : -s * 1.15;
  // bassin + colonne
  ctx.fillStyle = bone; ctx.beginPath(); ctx.ellipse(0, many ? -s * 0.35 : -s * 0.57, s * 0.14, s * 0.06, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = bone; ctx.lineWidth = s * 0.05;
  ctx.beginPath(); ctx.moveTo(0, many ? -s * 0.35 : -s * 0.57); ctx.lineTo(s * 0.02, top + s * 0.1); ctx.stroke();
  if (!many) {
    ctx.fillStyle = alpha(v.c3, 0.15);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.82, s * 0.2, s * 0.22, 0, 0, TAU); ctx.fill();
    ribs(ctx, s * 0.02, -s * 0.82, s * 0.5, s * 0.4, 5, bone);
    spikesAround(ctx, v.spikes, 0, -s * 0.85, s * 0.22, s * 0.25, s * 0.18, shade(bone, -0.15), rng, Math.PI * 1.05, Math.PI * 1.95);
    const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
    limb(ctx, -s * 0.18, -s * 1.0, -s * 0.3, -s * 0.75, -s * 0.25, -s * 0.5, s * 0.045, bone);
    limb(ctx, s * 0.18, -s * 1.0, s * 0.35 + a * s * 0.15, -s * 0.85 - a * s * 0.2, s * 0.45 + a * s * 0.3, -s * 0.65 - a * s * 0.3, s * 0.045, bone);
    // arme d'os (faux / arbalète)
    ctx.strokeStyle = shade(bone, -0.25); ctx.lineWidth = s * 0.035;
    const wx = s * 0.45 + a * s * 0.3, wy = -s * 0.65 - a * s * 0.3;
    ctx.beginPath(); ctx.moveTo(wx, wy + s * 0.35); ctx.lineTo(wx, wy - s * 0.35); ctx.stroke();
    ctx.fillStyle = shade(bone, -0.1);
    ctx.beginPath(); ctx.moveTo(wx, wy - s * 0.35); ctx.quadraticCurveTo(wx + s * 0.35, wy - s * 0.3, wx + s * 0.3, wy - s * 0.05); ctx.quadraticCurveTo(wx + s * 0.2, wy - s * 0.22, wx, wy - s * 0.25); ctx.fill();
  }
  // crâne
  const hx = s * 0.03, hy = top - s * 0.04;
  ctx.fillStyle = fleshFill(ctx, hx, hy, s * 0.16, bone);
  ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.15, s * 0.14, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + s * 0.02, hy + s * 0.12, s * 0.09, s * 0.06, 0, 0, TAU); ctx.fill();
  horns(ctx, v.horns, hx, hy, s * 0.18, shade(bone, -0.2), rng);
  ctx.fillStyle = dark;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + side * s * 0.06, hy, s * 0.045, s * 0.055, 0, 0, TAU); ctx.fill(); }
  eyeCluster(ctx, Math.min(v.eyes, 2), hx, hy, s * 0.11, s * 0.025, v.c3, rng, p.t);
  if (v.eyes > 2) eye(ctx, hx, hy - s * 0.08, s * 0.025, v.c3, p.t, 5);
  teeth(ctx, hx + s * 0.02, hy + s * 0.13, s * 0.12, s * 0.05, 5, p.attack, '#f4efe0');
}

function drawHulk(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const sway = Math.sin(p.t * (p.moving ? 4 : 1.5));
  const cy = -s * 0.6;
  for (let k = 0; k < v.tentacles; k++) {
    const a = Math.PI / 2 + ((k / Math.max(1, v.tentacles - 1)) - 0.5) * 2.4;
    tentacle(ctx, Math.cos(a) * s * 0.35, cy + s * 0.25, s * 0.55, s * 0.12, a, p.t, k * 1.7, shade(v.c1, -0.25));
  }
  // pattes trapues
  for (const side of [-1, 1]) {
    const st = p.moving ? Math.sin(p.t * 4 + (side > 0 ? Math.PI : 0)) * s * 0.06 : 0;
    ctx.fillStyle = shade(v.c1, -0.4);
    ctx.beginPath(); ctx.ellipse(side * s * 0.3 + st, -s * 0.12, s * 0.16, s * 0.14, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = fleshFill(ctx, 0, cy, s * 0.6, v.c1);
  ctx.save(); ctx.translate(sway * s * 0.02, 0);
  organic(ctx, 0, cy, s * 0.55, s * 0.5, rng, 0.025, p.t, 18); ctx.fill();
  ctx.strokeStyle = shade(v.c1, -0.6); ctx.lineWidth = s * 0.025; ctx.stroke();
  // plis et sutures
  stitches(ctx, -s * 0.35, cy - s * 0.1, -s * 0.05, cy + s * 0.3, 7, s);
  stitches(ctx, s * 0.1, cy - s * 0.35, s * 0.4, cy - s * 0.05, 6, s);
  ctx.fillStyle = alpha(v.c2, 0.5);
  for (let k = 0; k < 6; k++) { const a = rng.range(0, TAU), d = rng.range(0.2, 0.42) * s; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, s * 0.06, s * 0.04, a, 0, TAU); ctx.fill(); }
  spikesAround(ctx, v.spikes, 0, cy, s * 0.52, s * 0.46, s * 0.22, shade(v.c2, -0.1), rng, Math.PI, TAU);
  horns(ctx, v.horns, 0, cy - s * 0.25, s * 0.35, shade(v.c2, -0.3), rng);
  eyeCluster(ctx, v.eyes, 0, cy - s * 0.15, s * 0.35, s * 0.045, v.c3, rng, p.t);
  teeth(ctx, 0, cy + s * 0.2, s * 0.45, s * 0.2, 9, p.attack);
  ctx.restore();
  // bras écrasant
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  limb(ctx, s * 0.45, cy - s * 0.1, s * 0.75, cy - s * 0.1 - a * s * 0.4, s * 0.7 + a * s * 0.2, cy + s * 0.45 - a * s * 0.75, s * 0.2, shade(v.c1, -0.1));
  limb(ctx, -s * 0.45, cy - s * 0.1, -s * 0.72, cy + s * 0.1, -s * 0.65, cy + s * 0.5, s * 0.18, shade(v.c1, -0.15));
}

function drawPriest(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const sway = Math.sin(p.t * 2) * s * 0.02;
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, -s * 0.2 + k * (s * 0.4 / Math.max(1, v.tentacles - 1)), -s * 0.08, s * 0.25, s * 0.05, Math.PI / 2 + (k - v.tentacles / 2) * 0.4, p.t * 1.5, k, shade(v.c1, -0.3));
  // robe
  const g = ctx.createLinearGradient(0, -s * 1.2, 0, 0);
  g.addColorStop(0, shade(v.c1, 0.1)); g.addColorStop(1, shade(v.c1, -0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.12 + sway, -s * 1.05);
  ctx.quadraticCurveTo(-s * 0.4, -s * 0.5, -s * 0.38, -s * 0.02);
  for (let k = 0; k < 6; k++) ctx.lineTo(-s * 0.38 + (k + 0.5) * s * 0.127, -s * (0.02 + (k % 2) * 0.08 + Math.sin(p.t * 3 + k) * 0.02));
  ctx.lineTo(s * 0.38, -s * 0.02);
  ctx.quadraticCurveTo(s * 0.4, -s * 0.5, s * 0.12 + sway, -s * 1.05);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = alpha(v.c3, 0.35); ctx.lineWidth = s * 0.02;
  ctx.beginPath(); ctx.moveTo(sway, -s * 0.95); ctx.lineTo(0, -s * 0.1); ctx.stroke();
  spikesAround(ctx, v.spikes, sway, -s * 0.85, s * 0.2, s * 0.15, s * 0.15, v.c2, rng, Math.PI * 1.1, Math.PI * 1.9);
  // bâton
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  ctx.strokeStyle = shade(v.c2, -0.3); ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.05); ctx.lineTo(s * 0.36 + a * s * 0.08, -s * 1.25 - a * s * 0.1); ctx.stroke();
  ctx.save(); ctx.shadowColor = v.c3; ctx.shadowBlur = s * (0.25 + a * 0.4);
  ctx.fillStyle = v.c3; ctx.beginPath(); ctx.arc(s * 0.36 + a * s * 0.08, -s * 1.3 - a * s * 0.1, s * (0.06 + a * 0.04), 0, TAU); ctx.fill(); ctx.restore();
  // capuche + visage
  const hx = sway, hy = -s * 1.08;
  ctx.fillStyle = shade(v.c1, -0.1);
  ctx.beginPath(); ctx.moveTo(hx - s * 0.2, hy + s * 0.12); ctx.quadraticCurveTo(hx - s * 0.2, hy - s * 0.25, hx + s * 0.02, hy - s * 0.28); ctx.quadraticCurveTo(hx + s * 0.22, hy - s * 0.2, hx + s * 0.18, hy + s * 0.12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#07040a'; ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.12, s * 0.14, 0, 0, TAU); ctx.fill();
  horns(ctx, v.horns, hx, hy - s * 0.05, s * 0.22, shade(v.c2, -0.2), rng);
  if (v.eyes === 0) {
    ctx.fillStyle = alpha(v.c3, 0.8);
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(hx - s * 0.06 + k * s * 0.03, hy + s * 0.04, s * 0.008, s * 0.04, 0, 0, TAU); ctx.fill(); }
  } else eyeCluster(ctx, v.eyes, hx, hy, s * (v.eyes > 4 ? 0.1 : 0.06), s * (v.eyes > 4 ? 0.018 : 0.03), v.c3, rng, p.t);
  if (v.eyes > 6) {
    // yeux disséminés sur la robe
    for (let k = 0; k < 6; k++) eye(ctx, -s * 0.22 + rng.range(0, s * 0.44), -s * rng.range(0.2, 0.8), s * 0.022, v.c3, p.t, k + 10);
  }
}

function drawLeech(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const wave = p.t * (p.moving ? 6 : 2);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = -s * 0.5 + i * s * 0.15;
    const y = -s * 0.2 - Math.max(0, Math.sin(wave - i * 0.6)) * s * 0.12 - (i === n - 1 ? p.attack * s * 0.1 : 0);
    const r = s * (0.13 + Math.sin((i / (n - 1)) * Math.PI) * 0.08);
    ctx.fillStyle = fleshFill(ctx, x, y, r, i % 2 ? v.c1 : shade(v.c1, -0.12));
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.05, r, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(v.c3, 0.35); ctx.beginPath(); ctx.ellipse(x, y - r * 0.5, r * 0.4, r * 0.12, 0, 0, TAU); ctx.fill();
  }
  const hx = -s * 0.5 + (n - 1) * s * 0.15 + s * 0.1, hy = -s * 0.22 - p.attack * s * 0.1;
  ctx.fillStyle = '#250608'; ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.08, s * 0.13, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f0e6d0'; ctx.lineWidth = s * 0.015;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * s * 0.07, hy + Math.sin(a) * s * 0.11); ctx.lineTo(hx + Math.cos(a) * s * 0.03, hy + Math.sin(a) * s * 0.05); ctx.stroke(); }
  void rng;
}

function drawMech(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const step = p.moving ? Math.sin(p.t * 7) : 0;
  const iron = v.c2, rust = v.c1;
  const legs = v.limbs >= 4 ? 4 : 2;
  for (let i = 0; i < legs; i++) {
    const side = i % 2 ? 1 : -1;
    const off = legs === 4 ? (i < 2 ? -0.12 : 0.12) : 0;
    const ph = (i % 2 ? step : -step) * s * 0.1;
    limb(ctx, side * s * 0.15 + off * s, -s * 0.5, side * s * 0.22 + ph + off * s, -s * 0.25, side * s * 0.18 + ph + off * s, 0, s * 0.08, shade(iron, -0.1));
    ctx.fillStyle = shade(rust, -0.2); ctx.beginPath(); ctx.arc(side * s * 0.22 + ph + off * s, -s * 0.25, s * 0.05, 0, TAU); ctx.fill();
  }
  const ty = -s * 0.78;
  const variant = v.variant ?? 0;
  const chassis = variant % 3, weapon = Math.floor(variant / 3);
  const g = ctx.createLinearGradient(-s * 0.3, ty - s * 0.3, s * 0.3, ty + s * 0.3);
  g.addColorStop(0, shade(rust, 0.25)); g.addColorStop(0.5, rust); g.addColorStop(1, shade(rust, -0.55));
  ctx.fillStyle = g;
  ctx.beginPath();
  if (chassis === 0) {
    ctx.moveTo(-s * 0.3, ty - s * 0.25); ctx.lineTo(s * 0.28, ty - s * 0.3); ctx.lineTo(s * 0.34, ty + s * 0.2); ctx.lineTo(-s * 0.26, ty + s * 0.28);
  } else if (chassis === 1) {
    // plastron bombé, épaulières
    ctx.ellipse(0, ty, s * 0.3, s * 0.3, 0, 0, TAU);
  } else {
    // chaudière cylindrique
    ctx.moveTo(-s * 0.2, ty - s * 0.32); ctx.lineTo(s * 0.2, ty - s * 0.32); ctx.quadraticCurveTo(s * 0.32, ty, s * 0.2, ty + s * 0.3); ctx.lineTo(-s * 0.2, ty + s * 0.3); ctx.quadraticCurveTo(-s * 0.32, ty, -s * 0.2, ty - s * 0.32);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(iron, -0.4); ctx.lineWidth = s * 0.025; ctx.stroke();
  if (chassis === 1) {
    ctx.fillStyle = shade(iron, 0.15);
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * s * 0.3, ty - s * 0.2, s * 0.14, s * 0.09, sd * 0.3, 0, TAU); ctx.fill(); }
  }
  if (chassis === 2) {
    ctx.strokeStyle = shade(iron, 0.25); ctx.lineWidth = s * 0.03;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.24, ty - s * 0.2 + k * s * 0.2); ctx.lineTo(s * 0.24, ty - s * 0.2 + k * s * 0.2); ctx.stroke(); }
  }
  ctx.fillStyle = shade(iron, 0.3);
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(-s * 0.22 + (k % 3) * s * 0.22, ty - s * 0.18 + Math.floor(k / 3) * s * 0.38, s * 0.025, 0, TAU); ctx.fill(); }
  // chair visible sous le métal
  ctx.fillStyle = alpha('#8e2a2e', 0.8);
  organic(ctx, s * 0.02, ty + s * 0.02, s * 0.12, s * 0.08, rng, 0.05, p.t, 8); ctx.fill();
  // tuyaux
  ctx.strokeStyle = shade(iron, 0.1); ctx.lineWidth = s * 0.04;
  ctx.beginPath(); ctx.moveTo(-s * 0.25, ty - s * 0.2); ctx.quadraticCurveTo(-s * 0.45, ty - s * 0.45, -s * 0.2, ty - s * 0.55); ctx.stroke();
  // vapeur
  ctx.fillStyle = alpha('#d8d8e0', 0.25 + 0.15 * Math.sin(p.t * 4));
  ctx.beginPath(); ctx.arc(-s * 0.2, ty - s * 0.65 - (p.t * 0.3 % 0.2) * s, s * 0.08, 0, TAU); ctx.fill();
  spikesAround(ctx, v.spikes, 0, ty, s * 0.3, s * 0.28, s * 0.15, shade(iron, 0.2), rng, Math.PI, TAU);
  // bras armé selon la variante : 0 canon, 1 lame, 2 fusil long, 3 bobine, 4 poing-marteau
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const hx0 = s * 0.6 + a * s * 0.15, hy0 = ty - s * 0.05;
  limb(ctx, s * 0.28, ty - s * 0.1, s * 0.45 + a * s * 0.1, ty + s * 0.05, hx0, hy0, s * 0.09, shade(iron, 0.05));
  ctx.fillStyle = shade(iron, -0.2);
  if (weapon === 0) ctx.fillRect(hx0 - s * 0.05, hy0 - s * 0.08, s * 0.24, s * 0.14);
  else if (weapon === 1) {
    ctx.fillStyle = '#c9c4bc';
    ctx.beginPath(); ctx.moveTo(hx0, hy0 - s * 0.03); ctx.lineTo(hx0 + s * 0.12, hy0 - s * (0.55 - a * 0.3)); ctx.lineTo(hx0 + s * 0.06, hy0 + s * 0.02); ctx.fill();
  } else if (weapon === 2) ctx.fillRect(hx0 - s * 0.05, hy0 - s * 0.04, s * 0.45, s * 0.06);
  else if (weapon === 3) {
    ctx.strokeStyle = v.c3; ctx.lineWidth = s * 0.02;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(hx0 + s * 0.05, hy0 - s * 0.1 - k * s * 0.06, s * 0.06, 0, TAU); ctx.stroke(); }
  } else { ctx.fillStyle = shade(iron, 0.1); ctx.beginPath(); ctx.arc(hx0 + s * 0.05, hy0, s * 0.14, 0, TAU); ctx.fill(); }
  if (a > 0.3 && weapon !== 1 && weapon !== 4) { ctx.save(); ctx.shadowColor = v.c3; ctx.shadowBlur = s * 0.3; ctx.fillStyle = v.c3; ctx.beginPath(); ctx.arc(hx0 + s * (weapon === 2 ? 0.42 : 0.2), hy0, s * 0.06, 0, TAU); ctx.fill(); ctx.restore(); }
  limb(ctx, -s * 0.28, ty - s * 0.1, -s * 0.42, ty + s * 0.12, -s * 0.38, ty + s * 0.32, s * 0.08, shade(iron, -0.05));
  // tête / lentille
  const hx = s * 0.02, hy = ty - s * 0.42;
  ctx.fillStyle = shade(iron, -0.1); ctx.beginPath(); ctx.ellipse(hx, hy, s * 0.15, s * 0.13, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(rust, 0.1); ctx.lineWidth = s * 0.02; ctx.stroke();
  horns(ctx, v.horns, hx, hy, s * 0.18, shade(iron, 0.2), rng);
  eyeCluster(ctx, v.eyes, hx + s * 0.02, hy, s * 0.08, s * 0.04, v.c3, rng, p.t);
}

function drawJelly(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const pulse = 1 + Math.sin(p.t * 3) * 0.08;
  const hover = -s * 1.05 + Math.sin(p.t * 1.5) * s * 0.06;
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, -s * 0.3 + (k / Math.max(1, v.tentacles - 1)) * s * 0.6, hover + s * 0.1, s * 0.6, s * 0.05, Math.PI / 2 + (k - v.tentacles / 2) * 0.08, p.t, k * 0.8, alpha(v.c3, 0.55));
  const g = ctx.createRadialGradient(0, hover - s * 0.15, s * 0.05, 0, hover, s * 0.45);
  g.addColorStop(0, alpha(v.c3, 0.85)); g.addColorStop(0.6, alpha(v.c1, 0.75)); g.addColorStop(1, alpha(v.c2, 0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.42 * pulse, hover + s * 0.12);
  ctx.bezierCurveTo(-s * 0.45 * pulse, hover - s * 0.45, s * 0.45 * pulse, hover - s * 0.45, s * 0.42 * pulse, hover + s * 0.12);
  for (let k = 0; k < 7; k++) ctx.quadraticCurveTo(s * 0.42 * pulse - (k + 0.5) * s * 0.12 * pulse, hover + s * 0.22, s * 0.42 * pulse - (k + 1) * s * 0.12 * pulse, hover + s * 0.12);
  ctx.fill();
  ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = shade(v.c3, 0.4);
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(rng.range(-0.2, 0.2) * s, hover - rng.range(0.05, 0.25) * s, s * 0.04, 0, TAU); ctx.fill(); }
  ctx.restore();
  if (v.eyes > 0) eyeCluster(ctx, v.eyes, 0, hover - s * 0.1, s * 0.2, s * 0.035, v.c3, rng, p.t);
  else {
    // organes visibles
    ctx.fillStyle = alpha('#2a0a10', 0.6); ctx.beginPath(); ctx.ellipse(0, hover - s * 0.08, s * 0.12, s * 0.08, 0, 0, TAU); ctx.fill();
  }
}

// ----------------------------------------------------------------- structures
function drawTower(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  ctx.fillStyle = shade(v.c1, -0.45);
  ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.45, s * 0.15, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(-s * 0.3, 0, s * 0.3, 0);
  g.addColorStop(0, shade(v.c1, -0.5)); g.addColorStop(0.45, shade(v.c1, 0.15)); g.addColorStop(1, shade(v.c1, -0.6));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.05); ctx.quadraticCurveTo(-s * 0.18, -s * 0.6, -s * 0.16, -s * 1.1); ctx.lineTo(s * 0.16, -s * 1.1); ctx.quadraticCurveTo(s * 0.18, -s * 0.6, s * 0.32, -s * 0.05); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(v.c2, -0.1); ctx.lineWidth = s * 0.02;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, -s * (0.25 + k * 0.22), s * (0.28 - k * 0.03), Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  spikesAround(ctx, v.spikes, 0, -s * 1.1, s * 0.22, s * 0.12, s * 0.25, v.c2, rng, Math.PI, TAU);
  ctx.fillStyle = shade(v.c1, -0.2); ctx.beginPath(); ctx.ellipse(0, -s * 1.12, s * 0.22, s * 0.1, 0, 0, TAU); ctx.fill();
  eye(ctx, 0, -s * 0.75, s * 0.08, v.c3, p.t, 3);
  if (p.attack > 0) { ctx.save(); ctx.globalAlpha = Math.sin(p.attack * Math.PI); ctx.fillStyle = v.c3; ctx.shadowColor = v.c3; ctx.shadowBlur = s * 0.3; ctx.beginPath(); ctx.arc(0, -s * 1.2, s * 0.08, 0, TAU); ctx.fill(); ctx.restore(); }
}

function drawNest(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const pulse = 1 + Math.sin(p.t * 2.5) * 0.05;
  ctx.fillStyle = shade(v.c1, -0.5); ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.55, s * 0.18, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = fleshFill(ctx, 0, -s * 0.45, s * 0.5, v.c1);
  ctx.save(); ctx.translate(0, -s * 0.42); ctx.scale(pulse, 1 / pulse);
  organic(ctx, 0, 0, s * 0.45, s * 0.42, rng, 0.03, p.t, 14); ctx.fill();
  ctx.strokeStyle = shade(v.c1, -0.6); ctx.lineWidth = s * 0.025; ctx.stroke();
  ctx.strokeStyle = alpha(v.c2, 0.6); ctx.lineWidth = s * 0.015;
  for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(rng.range(-0.4, 0.4) * s, s * 0.35); ctx.quadraticCurveTo(rng.range(-0.3, 0.3) * s, 0, rng.range(-0.2, 0.2) * s, -s * 0.35); ctx.stroke(); }
  ctx.restore();
  // orifices
  for (let k = 0; k < 3; k++) {
    const x = (k - 1) * s * 0.22, y = -s * (0.4 + (k % 2) * 0.15);
    ctx.fillStyle = '#1a0507'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.07, s * 0.05, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = alpha(v.c3, 0.5 + 0.3 * Math.sin(p.t * 4 + k)); ctx.beginPath(); ctx.ellipse(x, y, s * 0.035, s * 0.02, 0, 0, TAU); ctx.fill();
  }
}

function drawTrap(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const open = 1 - p.attack;
  ctx.fillStyle = shade(v.c2, -0.3); ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.4, s * 0.16, 0, 0, TAU); ctx.fill();
  for (const side of [-1, 1]) {
    ctx.save(); ctx.translate(0, -s * 0.06); ctx.scale(1, side * (0.3 + open * 0.7));
    ctx.fillStyle = shade(v.c1, 0.05);
    ctx.beginPath(); ctx.arc(0, 0, s * 0.38, Math.PI, TAU); ctx.lineTo(s * 0.38, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d8d0c0';
    for (let k = 0; k < v.spikes / 2; k++) { const x = -s * 0.32 + k * s * 0.13; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + s * 0.05, -s * 0.14); ctx.lineTo(x + s * 0.1, 0); ctx.fill(); }
    ctx.restore();
  }
  void rng;
}

function drawPump(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  const pump = Math.sin(p.t * 3);
  ctx.fillStyle = shade(v.c2, -0.3); ctx.beginPath(); ctx.ellipse(0, -s * 0.06, s * 0.5, s * 0.17, 0, 0, TAU); ctx.fill();
  for (let k = 0; k < v.tentacles; k++) tentacle(ctx, (k - 1) * s * 0.3, -s * 0.15, s * 0.3, s * 0.08, Math.PI / 2 + (k - 1) * 0.9, p.t, k, shade(v.c1, -0.3));
  ctx.fillStyle = shade(v.c1, -0.2);
  ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.1); ctx.lineTo(-s * 0.22, -s * 0.9); ctx.lineTo(s * 0.22, -s * 0.9); ctx.lineTo(s * 0.32, -s * 0.1); ctx.closePath(); ctx.fill();
  const bulb = s * (0.2 + pump * 0.03);
  const g = ctx.createRadialGradient(0, -s * 0.6, s * 0.02, 0, -s * 0.6, bulb);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, v.c3); g.addColorStop(1, alpha(v.c1, 0.4));
  ctx.save(); ctx.shadowColor = v.c3; ctx.shadowBlur = s * 0.4; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, -s * 0.6, bulb, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = shade(v.c2, 0.2); ctx.lineWidth = s * 0.03;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * (0.3 + k * 0.2)); ctx.lineTo(s * 0.25, -s * (0.3 + k * 0.2)); ctx.stroke(); }
  eye(ctx, 0, -s * 1.0, s * 0.06, v.c3, p.t, 2);
  void rng;
}

function drawBrazier(ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng): void {
  ctx.fillStyle = shade(v.c2, -0.2); ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.45, s * 0.15, 0, 0, TAU); ctx.fill();
  // pile d'os
  ctx.strokeStyle = v.c1; ctx.lineCap = 'round';
  for (let k = 0; k < 12; k++) {
    const a = rng.range(-0.6, 0.6), y = -s * rng.range(0.1, 0.55), x = rng.range(-0.3, 0.3) * s * (1 - (-y / s));
    ctx.lineWidth = s * 0.05;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * s * 0.18, y - Math.sin(a) * s * 0.18); ctx.lineTo(x + Math.cos(a) * s * 0.18, y + Math.sin(a) * s * 0.18); ctx.stroke();
  }
  for (let k = 0; k < 3; k++) { ctx.fillStyle = v.c1; ctx.beginPath(); ctx.arc((k - 1) * s * 0.18, -s * 0.5 - (k % 2) * s * 0.08, s * 0.08, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc((k - 1) * s * 0.18 - s * 0.025, -s * 0.5 - (k % 2) * s * 0.08, s * 0.018, 0, TAU); ctx.arc((k - 1) * s * 0.18 + s * 0.025, -s * 0.5 - (k % 2) * s * 0.08, s * 0.018, 0, TAU); ctx.fill(); }
  // flammes
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 5; k++) {
    const fx = (k - 2) * s * 0.1, h = s * (0.4 + 0.15 * Math.sin(p.t * 9 + k * 2) + p.attack * 0.3);
    const g = ctx.createLinearGradient(0, -s * 0.55, 0, -s * 0.55 - h);
    g.addColorStop(0, alpha(v.c3, 0.9)); g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(fx - s * 0.1, -s * 0.55); ctx.quadraticCurveTo(fx + Math.sin(p.t * 7 + k) * s * 0.08, -s * 0.55 - h * 0.6, fx, -s * 0.55 - h); ctx.quadraticCurveTo(fx + s * 0.05, -s * 0.55 - h * 0.4, fx + s * 0.1, -s * 0.55); ctx.fill();
  }
  ctx.restore();
}

const PLANS: Record<string, (ctx: Ctx, v: Visual, p: Pose, s: number, rng: Rng) => void> = {
  worm: drawWorm, biped: (c, v, p, s, r) => drawBiped(c, v, p, s, r), brute: drawBrute, quadruped: drawQuadruped,
  insect: drawInsect, mantis: drawMantis, spider: drawSpider, crab: drawCrab, serpent: drawSerpent,
  fly: drawFly, eye: drawEye, floater: drawEye, winged: drawWinged, blob: drawBlob, skeletal: drawSkeletal,
  hulk: drawHulk, priest: drawPriest, leech: drawLeech, mech: drawMech, jelly: drawJelly,
  tower: drawTower, nest: drawNest, trap: drawTrap, pump: drawPump, brazier: drawBrazier,
};

/**
 * Dessine un monstre. (0,0) = point de contact au sol. `px` = taille de référence en pixels.
 * `flip` retourne horizontalement (orientation gauche/droite).
 */
export function drawMonster(ctx: Ctx, v: Visual, pose: Pose, px: number, flip = false): void {
  const fn = PLANS[v.plan] ?? drawBlob;
  const s = px * v.scale;
  ctx.save();
  if (flip) ctx.scale(-1, 1);
  fn(ctx, v, pose, s, new Rng(v.seed));
  ctx.restore();
}

export function isFlyingPlan(v: Visual): boolean {
  return ['fly', 'eye', 'floater', 'winged', 'jelly'].includes(v.plan);
}
