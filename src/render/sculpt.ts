// Moteur de « sculpture » 2.5D : les créatures sont modélisées en volumes 3D (ellipsoïdes,
// super-ellipsoïdes, capsules effilées) fusionnés en douceur, puis rendues pixel par pixel :
// carte de profondeur → normales, détail de surface par matériau (rides, plaques, pores, rouille),
// éclairage diffus enveloppant, diffusion sous-cutanée, reflets spéculaires, contre-jour,
// occlusion des creux, yeux émissifs et membranes translucides.
import { boxBlur } from './material';

export type Mat = 'flesh' | 'chitin' | 'bone' | 'abyss' | 'rust' | 'metal' | 'stone' | 'cloth' | 'tooth' | 'dark' | 'glow' | 'wood';
export type V3 = [number, number, number];

interface PrimBase { col: string; col2?: string; mat: Mat; hard?: boolean; k?: number }
interface Ell extends PrimBase { t: 'e'; c: V3; r: V3; rot: number; p?: number }
interface Cap extends PrimBase { t: 'c'; a: V3; b: V3; r1: number; r2: number }
type Prim = Ell | Cap;

export interface EyeDef { c: V3; r: number; glow: string; slit: boolean; look: number; blink: number }
export interface Membrane { pts: V3[]; col: string; alpha: number; front: boolean; veins?: V3[][] }
export interface Overlay { draw: (g: CanvasRenderingContext2D, toScreen: (p: V3) => [number, number], S: number) => void; front: boolean }

const MAT: Record<Mat, { spec: number; shin: number; sss: number; bump: number; amb: number; metal?: boolean }> = {
  flesh: { spec: 0.38, shin: 22, sss: 0.55, bump: 1, amb: 0.36 },
  chitin: { spec: 0.85, shin: 55, sss: 0.12, bump: 0.8, amb: 0.3 },
  bone: { spec: 0.16, shin: 14, sss: 0.2, bump: 1, amb: 0.42 },
  abyss: { spec: 0.9, shin: 60, sss: 0.35, bump: 0.6, amb: 0.3 },
  rust: { spec: 0.45, shin: 30, sss: 0, bump: 1.3, amb: 0.34, metal: true },
  metal: { spec: 1.1, shin: 70, sss: 0, bump: 0.5, amb: 0.3, metal: true },
  stone: { spec: 0.06, shin: 8, sss: 0, bump: 1.5, amb: 0.4 },
  cloth: { spec: 0.05, shin: 6, sss: 0.1, bump: 0.7, amb: 0.4 },
  tooth: { spec: 0.6, shin: 40, sss: 0.3, bump: 0.2, amb: 0.5 },
  dark: { spec: 0.02, shin: 8, sss: 0, bump: 0, amb: 0.15 },
  glow: { spec: 0, shin: 1, sss: 0, bump: 0, amb: 1 },
  wood: { spec: 0.08, shin: 10, sss: 0, bump: 1.2, amb: 0.38 },
};
const MAT_IDS: Mat[] = Object.keys(MAT) as Mat[];

// ---------------------------------------------------------------- textures précalculées
// Chaque matériau possède une tuile répétable (1 unité de corps = TILE pixels de texture) :
// relief de détail + modulation d'albédo. Calculée une fois, puis simple lecture de tableau.
const TILE = 256;
function phash(x: number, y: number, p: number, seed: number): number {
  x = ((x % p) + p) % p; y = ((y % p) + p) % p;
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
/** Bruit de valeur périodique (période p cellules). */
function pnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = phash(xi, yi, p, seed), b = phash(xi + 1, yi, p, seed), c = phash(xi, yi + 1, p, seed), d = phash(xi + 1, yi + 1, p, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fbm périodique : fréquence de base `f` cellules par tuile (entier). */
function pfbm(tx: number, ty: number, f: number, seed: number, oct = 3): number {
  let s = 0, amp = 0.5, norm = 0, ff = f;
  for (let o = 0; o < oct; o++) { s += pnoise(tx * ff, ty * ff, ff, seed + o * 101) * amp; norm += amp; amp *= 0.5; ff *= 2; }
  return s / norm;
}
function pcell(tx: number, ty: number, f: number, seed: number): number {
  const x = tx * f, y = ty * f, xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i + phash(xi + i, yi + j, f, seed), cy = yi + j + phash(xi + i, yi + j, f, seed + 1);
    const d = Math.hypot(x - cx, y - cy);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}
const ridge = (n: number) => 1 - Math.abs(n * 2 - 1);

interface Tex { d: Float32Array; alb: Float32Array; vein: Float32Array }
const TEX = new Map<Mat, Tex>();
function texFor(m: Mat): Tex {
  let t = TEX.get(m);
  if (t) return t;
  const N = TILE * TILE;
  const d = new Float32Array(N), alb = new Float32Array(N).fill(1), vein = new Float32Array(N);
  const seed = MAT_IDS.indexOf(m) * 7919 + 13;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const i = y * TILE + x;
    const tx = x / TILE, ty = y / TILE; // coordonnées de tuile [0,1)
    let h = 0, a = 1, vv = 0;
    switch (m) {
      case 'flesh':
        h = -Math.pow(ridge(pfbm(tx, ty, 6, seed)), 3) * 0.028 - Math.pow(ridge(pfbm(tx, ty, 16, seed + 7, 2)), 4) * 0.01
          + (pfbm(tx, ty, 3, seed + 5, 2) - 0.5) * 0.03 + pnoise(tx * 128, ty * 128, 128, seed + 3) * 0.004;
        a = 0.7 + pfbm(tx, ty, 4, seed + 33) * 0.6;
        vv = Math.pow(ridge(pfbm(tx, ty, 2, seed + 40)), 18);
        break;
      case 'chitin': {
        const e = pcell(tx, ty, 12, seed);
        h = -Math.max(0, 0.18 - e) * 0.07 + Math.min(e, 0.5) * 0.012 + (pfbm(tx, ty, 16, seed, 2) - 0.5) * 0.004;
        a = 0.75 + pfbm(tx, ty, 4, seed + 33) * 0.5;
        break;
      }
      case 'bone':
        h = (pfbm(tx, ty, 16, seed) - 0.5) * 0.01 - Math.max(0, pnoise(tx * 64, ty * 64, 64, seed + 9) - 0.72) * 0.025;
        a = 0.8 + pfbm(tx, ty, 4, seed + 33) * 0.4;
        break;
      case 'abyss':
        h = (pfbm(tx, ty, 8, seed) - 0.5) * 0.012 - Math.max(0, 0.12 - pcell(tx, ty, 16, seed + 4)) * 0.05;
        a = 0.7 + pfbm(tx, ty, 4, seed + 33) * 0.6;
        break;
      case 'rust':
        h = (pfbm(tx, ty, 16, seed, 4) - 0.5) * 0.018 - Math.max(0, pnoise(tx * 48, ty * 48, 48, seed + 1) - 0.8) * 0.04;
        vv = pfbm(tx, ty, 6, seed + 7);
        break;
      case 'metal': h = (pnoise(tx * 128, ty * 4, 128, seed) - 0.5) * 0.004; break;
      case 'stone':
        h = (pfbm(tx, ty, 8, seed, 4) - 0.5) * 0.06 - Math.pow(ridge(pfbm(tx, ty, 4, seed + 5)), 12) * 0.06;
        a = 0.8 + pfbm(tx, ty, 6, seed + 33) * 0.4;
        break;
      case 'cloth': h = Math.sin(tx * TAU2 * 64) * Math.sin(ty * TAU2 * 64) * 0.0015 + (pfbm(tx, ty, 4, seed, 3) - 0.5) * 0.05; a = 0.85 + pfbm(tx, ty, 8, seed + 3) * 0.3; break;
      case 'wood': h = (pfbm(tx, ty, 2, seed, 3) - 0.5) * 0.01 + Math.sin((ty + pfbm(tx, ty, 4, seed) * 0.3) * TAU2 * 24) * 0.006; break;
      default: break;
    }
    d[i] = h; alb[i] = a; vein[i] = vv;
  }
  t = { d, alb, vein };
  TEX.set(m, t);
  return t;
}
const TAU2 = Math.PI * 2;

function rgb(c: string): V3 {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const m = c.match(/\d+(\.\d+)?/g);
  return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [128, 128, 128];
}

/** Constructeur de modèle : on y empile des volumes en coordonnées « corps » (unité = taille de la créature). */
export class Sculpt {
  prims: Prim[] = [];
  eyes: EyeDef[] = [];
  membranes: Membrane[] = [];
  overlays: Overlay[] = [];
  /** Lacet (rotation autour de la verticale) et tangage de la vue. */
  yaw = 0.42;
  pitch = 0.42;

  ell(c: V3, r: V3, col: string, mat: Mat, opts: { rot?: number; p?: number; col2?: string; hard?: boolean; k?: number } = {}): this {
    this.prims.push({ t: 'e', c, r, rot: opts.rot ?? 0, p: opts.p, col, col2: opts.col2, mat, hard: opts.hard, k: opts.k });
    return this;
  }
  cap(a: V3, b: V3, r1: number, r2: number, col: string, mat: Mat, opts: { col2?: string; hard?: boolean; k?: number } = {}): this {
    this.prims.push({ t: 'c', a, b, r1, r2, col, col2: opts.col2, mat, hard: opts.hard, k: opts.k });
    return this;
  }
  /** Chaîne de capsules passant par des points, rayons interpolés. */
  chain(pts: V3[], radii: number[], col: string, mat: Mat, opts: { col2?: string; hard?: boolean; k?: number } = {}): this {
    for (let i = 0; i < pts.length - 1; i++) {
      const c2 = opts.col2 ? mix(col, opts.col2, (i + 1) / (pts.length - 1)) : undefined;
      const c1 = opts.col2 ? mix(col, opts.col2, i / (pts.length - 1)) : col;
      this.cap(pts[i], pts[i + 1], radii[i], radii[i + 1], c1, mat, { ...opts, col2: c2 });
    }
    return this;
  }
  /** Pointe conique (épine, corne, griffe). */
  spike(base: V3, dir: V3, len: number, r: number, col: string, mat: Mat = 'tooth'): this {
    const l = Math.hypot(...dir) || 1;
    return this.cap(base, [base[0] + (dir[0] / l) * len, base[1] + (dir[1] / l) * len, base[2] + (dir[2] / l) * len], r, r * 0.08, col, mat, { hard: true });
  }
  /** Corne recourbée. */
  horn(base: V3, dir: V3, curl: number, len: number, r: number, col: string): this {
    const pts: V3[] = [base];
    let [x, y, z] = base;
    let [dx, dy, dz] = dir;
    const n = 4;
    for (let i = 0; i < n; i++) {
      x += (dx * len) / n; y += (dy * len) / n; z += (dz * len) / n;
      const ndx = dx * Math.cos(curl) - dy * Math.sin(curl), ndy = dx * Math.sin(curl) + dy * Math.cos(curl);
      dx = ndx; dy = ndy;
      pts.push([x, y, z]);
      void dz;
    }
    return this.chain(pts, [r, r * 0.75, r * 0.5, r * 0.28, r * 0.06], col, 'bone', { hard: true, col2: '#2a2018' });
  }
  eye(c: V3, r: number, glow: string, opts: Partial<EyeDef> = {}): this {
    this.eyes.push({ c, r, glow, slit: true, look: 0, blink: 1, ...opts });
    return this;
  }
  membrane(pts: V3[], col: string, alpha: number, front: boolean, veins?: V3[][]): this {
    this.membranes.push({ pts, col, alpha, front, veins });
    return this;
  }
  overlay(front: boolean, draw: Overlay['draw']): this { this.overlays.push({ front, draw }); return this; }
}

export function mix(a: string, b: string, t: number): string {
  const x = rgb(a), y = rgb(b);
  return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)},${Math.round(x[1] + (y[1] - x[1]) * t)},${Math.round(x[2] + (y[2] - x[2]) * t)})`;
}

/**
 * Rend un modèle dans un canvas. `S` = pixels par unité ; (ox, oy) = position écran de l'origine (sol).
 * `flip` : miroir horizontal (créature tournée vers la gauche).
 */
export function renderSculpt(sc: Sculpt, w: number, h: number, S: number, ox: number, oy: number, seed: number, detail = 1): HTMLCanvasElement {
  const cy = Math.cos(sc.yaw), sy = Math.sin(sc.yaw), cp = Math.cos(sc.pitch), sp = Math.sin(sc.pitch);
  // corps → vue : x écran, y écran (vers le haut), profondeur vers la caméra
  const view = (p: V3): V3 => {
    const x1 = p[0] * cy - p[2] * sy;
    const z1 = p[0] * sy + p[2] * cy;
    return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp];
  };
  const toScreen = (p: V3): [number, number] => { const v = view(p); return [ox + v[0] * S, oy - v[1] * S]; };
  const n = w * h;
  const Z = new Float32Array(n).fill(-1e9);
  const A = new Float32Array(n);
  const CR = new Float32Array(n), CG = new Float32Array(n), CB = new Float32Array(n);
  const M = new Uint8Array(n);
  const HARD = new Uint8Array(n);

  const plot = (i: number, z: number, cov: number, col: V3, mat: number, hard: boolean, k: number) => {
    const zc = Z[i];
    if (zc < -1e8) {
      Z[i] = z; CR[i] = col[0]; CG[i] = col[1]; CB[i] = col[2]; M[i] = mat; A[i] = cov; HARD[i] = hard ? 1 : 0;
      return;
    }
    let wgt: number;
    if (hard) {
      if (z <= zc) { if (cov > A[i] && z > zc - 0.02) A[i] = Math.max(A[i], cov * 0.5); return; }
      Z[i] = z; wgt = 1; HARD[i] = 1;
    } else {
      const hh = Math.max(k - Math.abs(zc - z), 0) / k;
      Z[i] = Math.max(zc, z) + hh * hh * k * 0.25;
      wgt = Math.min(1, Math.max(0, 0.5 + (z - zc) / (2 * k)));
      if (wgt > 0.5) HARD[i] = 0;
    }
    CR[i] += (col[0] - CR[i]) * wgt; CG[i] += (col[1] - CG[i]) * wgt; CB[i] += (col[2] - CB[i]) * wgt;
    if (wgt > 0.5) M[i] = mat;
    A[i] = Math.max(A[i], cov);
  };

  for (const pr of sc.prims) {
    const mat = MAT_IDS.indexOf(pr.mat);
    const c1 = rgb(pr.col), c2 = pr.col2 ? rgb(pr.col2) : c1;
    const k = pr.k ?? 0.07;
    if (pr.t === 'e') {
      const c = view(pr.c);
      const R = Math.max(pr.r[0], pr.r[1]) * S + 2;
      const cx = ox + c[0] * S, cyy = oy - c[1] * S;
      const x0 = Math.max(0, Math.floor(cx - R)), x1 = Math.min(w - 1, Math.ceil(cx + R));
      const y0 = Math.max(0, Math.floor(cyy - R)), y1 = Math.min(h - 1, Math.ceil(cyy + R));
      const cr = Math.cos(-pr.rot), srr = Math.sin(-pr.rot);
      const pw = pr.p ?? 2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / S, dy = (cyy - y - 0.5) / S;
        const lx = dx * cr - dy * srr, ly = dx * srr + dy * cr;
        const u = lx / pr.r[0], v = ly / pr.r[1];
        const q = pw === 2 ? 1 - u * u - v * v : 1 - Math.pow(Math.abs(u), pw) - Math.pow(Math.abs(v), pw);
        if (q <= 0) continue;
        const z = c[2] + pr.r[2] * (pw === 2 ? Math.sqrt(q) : Math.pow(q, 1 / pw));
        const cov = Math.min(1, q * Math.min(pr.r[0], pr.r[1]) * S * 0.5);
        const tcol: V3 = pr.col2 ? [c1[0] + (c2[0] - c1[0]) * (0.5 - v * 0.5), c1[1] + (c2[1] - c1[1]) * (0.5 - v * 0.5), c1[2] + (c2[2] - c1[2]) * (0.5 - v * 0.5)] : c1;
        plot(y * w + x, z, cov, tcol, mat, !!pr.hard, k);
      }
    } else {
      const a = view(pr.a), b = view(pr.b);
      const ax = ox + a[0] * S, ay = oy - a[1] * S, bx = ox + b[0] * S, by = oy - b[1] * S;
      const R = Math.max(pr.r1, pr.r2) * S + 2;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - R)), x1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) + R));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by) - R)), y1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) + R));
      const abx = bx - ax, aby = by - ay, l2 = abx * abx + aby * aby || 1e-6;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const t = Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / l2));
        const qx = ax + abx * t, qy = ay + aby * t;
        const r = (pr.r1 + (pr.r2 - pr.r1) * t) * S;
        const d = Math.hypot(px - qx, py - qy);
        if (d >= r) continue;
        const z = a[2] + (b[2] - a[2]) * t + Math.sqrt(r * r - d * d) / S;
        const cov = Math.min(1, r - d);
        const tcol: V3 = [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
        plot(y * w + x, z, cov, tcol, mat, !!pr.hard, k);
      }
    }
  }

  // ---- détail de surface par matériau (en unités de profondeur), lu dans les tuiles précalculées
  const D = new Float32Array(n);
  const ALB = new Float32Array(n).fill(1);
  const VEIN = new Float32Array(n);
  const texScale = TILE / (S / detail); // pixels de tuile par pixel écran (1 unité = TILE)
  const off = (seed % 997) * 3.7;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (A[i] <= 0) continue;
    const tex = texFor(MAT_IDS[M[i]]);
    const tx = ((Math.floor((x + off) * texScale) % TILE) + TILE) % TILE;
    const ty = ((Math.floor((y + off) * texScale) % TILE) + TILE) % TILE;
    const k = ty * TILE + tx;
    D[i] = tex.d[k]; ALB[i] = tex.alb[k]; VEIN[i] = tex.vein[k];
  }
  const Zs = new Float32Array(n);
  let zmin = 1e9;
  for (let i = 0; i < n; i++) if (A[i] > 0) zmin = Math.min(zmin, Z[i]);
  for (let i = 0; i < n; i++) Zs[i] = A[i] > 0 ? Z[i] + D[i] : zmin - 0.3;
  // creux : profondeur moyenne autour > profondeur locale
  const br = Math.max(2, Math.round(S * 0.06));
  const Zb = boxBlur(Zs, w, h, br, 2);

  // ---- éclairage
  let lx = -0.5, ly = 0.72, lz = 0.55;
  const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
  const out = new ImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (A[i] <= 0) continue;
      const m = MAT_IDS[M[i]];
      const P = MAT[m];
      const xm = x > 0 && A[i - 1] > 0 ? i - 1 : i, xp = x < w - 1 && A[i + 1] > 0 ? i + 1 : i;
      const ym = y > 0 && A[i - w] > 0 ? i - w : i, yp = y < h - 1 && A[i + w] > 0 ? i + w : i;
      const dzdx = (Zs[xp] - Zs[xm]) * S / Math.max(1, (xp - xm));
      const dzdy = (Zs[ym] - Zs[yp]) * S / Math.max(1, (yp - ym) / w);
      let nx = -dzdx, ny = -dzdy, nz = 1;
      // silhouette : normale tournée vers l'extérieur
      if (xm === i || xp === i || ym === i || yp === i) { nz = 0.35; }
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      let R = CR[i], G = CG[i], B = CB[i];
      if (m === 'glow') { o[i * 4] = R; o[i * 4 + 1] = G; o[i * 4 + 2] = B; o[i * 4 + 3] = Math.round(A[i] * 255); continue; }
      const ndl = nx * lx + ny * ly + nz * lz;
      const wrap = Math.max(0, (ndl + 0.35) / 1.35);
      const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
      const cav = Math.max(0, Zb[i] - Zs[i]);
      const ao = Math.max(0.35, 1 - cav * 9) * (1 - 0.3 * Math.pow(Math.min(1, Math.max(0, (y - (oy - S * 0.25)) / (S * 0.3))), 2));
      const groundShade = 1 - Math.max(0, 0.18 - (oy - y) / S) * 1.5;
      // variations de teinte (veines, taches, rouille) lues dans les tuiles
      if (m === 'flesh') { const vein = VEIN[i]; R *= 1 - vein * 0.35; G *= 1 - vein * 0.5; B *= 1 - vein * 0.15; }
      else if (m === 'rust') { const r2 = VEIN[i]; if (r2 > 0.55) { const t2 = Math.min(1, (r2 - 0.55) * 4); R += (170 - R) * t2; G += (70 - G) * t2; B += (25 - B) * t2; } }
      else if (m === 'bone') { const st = cav * 30; R -= st * 30; G -= st * 38; B -= st * 55; }
      const tint = ALB[i];
      R *= tint; G *= tint; B *= tint;
      const lit = (P.amb * 0.85 + Math.pow(wrap, 1.25) * (1 - P.amb) * 1.3) * ao * groundShade;
      // diffusion sous-cutanée : ombres teintées de rouge sang
      const sss = P.sss * (1 - wrap) * ao;
      let oR = R * lit + sss * R * 0.55 + sss * 40;
      let oG = G * lit + sss * G * 0.12;
      let oB = B * lit + sss * B * 0.15;
      const specMod = m === 'flesh' ? 0.4 + (ALB[i] - 0.7) * 1.6 : 1;
      const spec = Math.pow(ndh, P.shin) * P.spec * 255 * specMod * ao;
      if (P.metal) { oR += spec * (R / 255 + 0.3); oG += spec * (G / 255 + 0.3); oB += spec * (B / 255 + 0.3); }
      else { oR += spec; oG += spec; oB += spec * 0.97; }
      // contre-jour froid sur les bords
      const rim = Math.pow(1 - Math.max(0, nz), 2.2) * Math.max(0, -(nx * lx + ny * ly)) * 0.9;
      oR += rim * 70; oG += rim * 80; oB += rim * 105;
      // tonalité douce
      o[i * 4] = Math.min(255, oR * 1.05);
      o[i * 4 + 1] = Math.min(255, oG * 1.02);
      o[i * 4 + 2] = Math.min(255, oB);
      o[i * 4 + 3] = Math.round(Math.min(1, A[i]) * 255);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d')!;
  // membranes et décors arrière
  const drawMembranes = (front: boolean) => {
    for (const mb of sc.membranes.filter((m) => m.front === front)) {
      const pts = mb.pts.map(toScreen);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const grad = g.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      const c = rgb(mb.col);
      grad.addColorStop(0, `rgba(${c[0] * 1.2 | 0},${c[1] * 1.1 | 0},${c[2] | 0},${mb.alpha})`);
      grad.addColorStop(1, `rgba(${c[0] * 0.5 | 0},${c[1] * 0.45 | 0},${c[2] * 0.45 | 0},${mb.alpha * 0.85})`);
      g.fillStyle = grad;
      g.beginPath();
      pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
      g.closePath(); g.fill();
      g.strokeStyle = `rgba(20,10,10,${mb.alpha * 0.6})`; g.lineWidth = Math.max(1, S * 0.008);
      for (const vn of mb.veins ?? []) {
        const vp = vn.map(toScreen);
        g.beginPath(); vp.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      }
    }
  };
  drawMembranes(false);
  for (const ov of sc.overlays.filter((x) => !x.front)) ov.draw(g, toScreen, S);
  const body = document.createElement('canvas');
  body.width = w; body.height = h;
  body.getContext('2d')!.putImageData(out, 0, 0);
  g.drawImage(body, 0, 0);
  drawMembranes(true);
  // yeux : visibles seulement s'ils ne sont pas masqués par le corps
  for (const e of sc.eyes) {
    const v = view(e.c);
    const sx = ox + v[0] * S, syy = oy - v[1] * S;
    const ix = Math.round(sx), iy = Math.round(syy);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
    const zi = Z[iy * w + ix];
    if (zi > v[2] + Math.max(e.r * 1.4, 0.3)) continue;
    const r = e.r * S;
    if (r < 0.6) continue;
    g.save();
    // orbite creusée
    g.fillStyle = 'rgba(8,2,4,0.85)';
    g.beginPath(); g.ellipse(sx, syy, r * 1.35, r * 1.2 * e.blink + 0.5, 0, 0, Math.PI * 2); g.fill();
    g.shadowColor = e.glow; g.shadowBlur = r * 2.5;
    const gr = g.createRadialGradient(sx - r * 0.3, syy - r * 0.3, r * 0.1, sx, syy, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, e.glow); gr.addColorStop(1, mix(e.glow, '#000000', 0.6));
    g.fillStyle = gr;
    g.beginPath(); g.ellipse(sx, syy, r, r * e.blink, 0, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#050203';
    g.beginPath();
    if (e.slit) g.ellipse(sx + e.look * r * 0.3, syy, r * 0.22, r * 0.78 * e.blink, 0, 0, Math.PI * 2);
    else g.arc(sx + e.look * r * 0.3, syy, r * 0.42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath(); g.arc(sx - r * 0.35, syy - r * 0.35, Math.max(0.6, r * 0.18), 0, Math.PI * 2); g.fill();
    g.restore();
  }
  for (const ov of sc.overlays.filter((x) => x.front)) ov.draw(g, toScreen, S);
  return canvas;
}
