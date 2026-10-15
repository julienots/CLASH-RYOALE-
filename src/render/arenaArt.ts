// Décor réaliste de l'arène : sol éclairé pixel par pixel (terre, dalles, sang, fissures),
// rivière de sang avec berges, ponts d'os, rochers et ossements sculptés, tours sculptées.
// Tout est calculé une seule fois (au démarrage du combat / redimensionnement).
import { ARENA_H, ARENA_W, BRIDGE_HALF, BRIDGES, RIVER_HALF, RIVER_Y } from '../sim/battle';
import { mix, renderSculpt, Sculpt, type V3 } from './sculpt';

// ------------------------------------------------------------ bruit périodique (tuiles)
function phash(x: number, y: number, p: number, seed: number): number {
  x = ((x % p) + p) % p; y = ((y % p) + p) % p;
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function pnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = phash(xi, yi, p, seed), b = phash(xi + 1, yi, p, seed), c = phash(xi, yi + 1, p, seed), d = phash(xi + 1, yi + 1, p, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function pfbm(tx: number, ty: number, f: number, seed: number, oct = 4): number {
  let s = 0, amp = 0.5, norm = 0, ff = f;
  for (let o = 0; o < oct; o++) { s += pnoise(tx * ff, ty * ff, ff, seed + o * 101) * amp; norm += amp; amp *= 0.5; ff *= 2; }
  return s / norm;
}

/** Tuiles précalculées couvrant PERIOD × PERIOD cases d'arène. */
const RES = 512, PERIOD = 8;
let tiles: { dirt: Float32Array; fine: Float32Array; edge: Float32Array; cellId: Float32Array; blood: Float32Array; crack: Float32Array } | null = null;
function getTiles() {
  if (tiles) return tiles;
  const N = RES * RES;
  const dirt = new Float32Array(N), fine = new Float32Array(N), edge = new Float32Array(N), cellId = new Float32Array(N), blood = new Float32Array(N), crack = new Float32Array(N);
  const CELLS = 14; // dalles par période
  for (let y = 0; y < RES; y++) for (let x = 0; x < RES; x++) {
    const i = y * RES + x, tx = x / RES, ty = y / RES;
    dirt[i] = pfbm(tx, ty, 4, 11);
    fine[i] = pfbm(tx, ty, 48, 23, 2);
    blood[i] = pfbm(tx, ty, 3, 37, 3);
    crack[i] = 1 - Math.abs(pfbm(tx, ty, 5, 51, 3) * 2 - 1);
    // dalles (Voronoï périodique, déformé)
    const wx = tx * CELLS + (pfbm(tx, ty, 6, 61, 2) - 0.5) * 0.8, wy = ty * CELLS + (pfbm(tx, ty, 6, 62, 2) - 0.5) * 0.8;
    const xi = Math.floor(wx), yi = Math.floor(wy);
    let f1 = 9, f2 = 9, id = 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const cx = xi + k + phash(xi + k, yi + j, CELLS, 71), cy = yi + j + phash(xi + k, yi + j, CELLS, 72);
      const d = Math.hypot(wx - cx, wy - cy);
      if (d < f1) { f2 = f1; f1 = d; id = phash(xi + k, yi + j, CELLS, 73); } else if (d < f2) f2 = d;
    }
    edge[i] = f2 - f1; cellId[i] = id;
  }
  tiles = { dirt, fine, edge, cellId, blood, crack };
  return tiles;
}

function hexRgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Masque des chemins dallés (voies, abords des tours). */
function pathMask(ax: number, ay: number): number {
  let m = 0;
  for (const bx of BRIDGES) {
    const d = Math.abs(ax - bx);
    if (ay > 3.5 && ay < ARENA_H - 3.5) m = Math.max(m, 1 - Math.min(1, Math.max(0, (d - 1.0) / 0.5)));
  }
  for (const ty of [4.8, ARENA_H - 4.8]) {
    const d = Math.abs(ay - ty);
    if (ax > 3 && ax < 15) m = Math.max(m, 1 - Math.min(1, Math.max(0, (d - 0.8) / 0.5)));
  }
  for (const [tx, ty] of [[9, 2.5], [9, 29.5], [3.5, 6.5], [14.5, 6.5], [3.5, 25.5], [14.5, 25.5]]) {
    const d = Math.hypot(ax - tx, ay - ty);
    m = Math.max(m, 1 - Math.min(1, Math.max(0, (d - 2.6) / 0.6)));
  }
  return m;
}

export function buildRealGround(w: number, h: number, ox: number, oy: number, T: number, groundHex: string, accentHex: string, showGrid: boolean): HTMLCanvasElement {
  const t = getTiles();
  const H = new Float32Array(w * h);
  const COL = new Float32Array(w * h * 3);
  const WET = new Float32Array(w * h);
  const GLOW = new Float32Array(w * h);
  const base = hexRgb(groundHex), acc = hexRgb(accentHex);
  const sample = (arr: Float32Array, ax: number, ay: number) => {
    const x = Math.floor(((ax / PERIOD) % 1 + 1) % 1 * RES), y = Math.floor(((ay / PERIOD) % 1 + 1) % 1 * RES);
    return arr[y * RES + x];
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const ax = (x + 0.5 - ox) / T, ay = (y + 0.5 - oy) / T;
    const inside = ax >= 0 && ax <= ARENA_W && ay >= 0 && ay <= ARENA_H;
    const dirt = sample(t.dirt, ax, ay), fine = sample(t.fine, ax, ay);
    let hgt = dirt * 0.25 + fine * 0.04;
    let r = base[0] * (0.9 + dirt * 0.8) + fine * 14, g = base[1] * (0.9 + dirt * 0.75) + fine * 12, b = base[2] * (0.9 + dirt * 0.7) + fine * 10;
    // terre plus sombre et humide par endroits
    if (!inside) { r *= 0.35; g *= 0.33; b *= 0.35; hgt += 0.2; }
    const pm = inside ? pathMask(ax, ay) : 0;
    if (pm > 0) {
      const e = sample(t.edge, ax, ay), id = sample(t.cellId, ax, ay);
      const stone = Math.min(1, Math.max(0, (e - 0.04) / 0.1));
      const sh = stone * (0.07 + id * 0.03) + fine * 0.03;
      const sc = 62 + id * 30 + fine * 20;
      const sr = sc * 1.04 * (0.72 + stone * 0.28), sg = sc * 0.96 * (0.72 + stone * 0.28), sb = sc * 0.9 * (0.72 + stone * 0.28);
      hgt = hgt * (1 - pm) + (sh + 0.1) * pm;
      r = r * (1 - pm) + sr * pm; g = g * (1 - pm) + sg * pm; b = b * (1 - pm) + sb * pm;
    }
    // sang séché / flaques
    const bl = sample(t.blood, ax, ay);
    if (inside && bl > 0.7) {
      const k = Math.min(1, (bl - 0.7) * 5) * 0.75;
      r = r * (1 - k) + 58 * k; g = g * (1 - k) + 14 * k; b = b * (1 - k) + 14 * k;
      WET[i] = k; hgt -= k * 0.03;
    }
    // fissures luminescentes
    const cr = sample(t.crack, ax, ay);
    if (inside && cr > 0.988 && pm < 0.3 && dirt > 0.45) { const k = (cr - 0.988) / 0.012; hgt -= k * 0.06; GLOW[i] = k * 0.55; }
    // rivière de sang
    const dr = Math.abs(ay - RIVER_Y);
    if (inside && dr < RIVER_HALF + 0.45) {
      const bank = Math.min(1, Math.max(0, (RIVER_HALF + 0.45 - dr) / 0.45));
      const water = Math.min(1, Math.max(0, (RIVER_HALF - dr) / 0.25));
      hgt -= bank * 0.12;
      r = r * (1 - bank) + 45 * bank; g = g * (1 - bank) + 22 * bank; b = b * (1 - bank) + 20 * bank;
      if (water > 0) {
        const depth = 1 - dr / RIVER_HALF;
        hgt = -0.4 + fine * 0.005;
        r = 95 - depth * 55; g = 6 + (1 - depth) * 8; b = 14 + (1 - depth) * 6;
        WET[i] = 1;
      }
    }
    H[i] = hgt;
    COL[i * 3] = r; COL[i * 3 + 1] = g; COL[i * 3 + 2] = b;
  }
  // éclairage
  const img = new ImageData(w, h);
  const o = img.data;
  let lx = -0.5, ly = -0.6, lz = 0.62; // lumière venant du haut-gauche (y écran vers le bas)
  const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
  const k = T * 1.2;
  const cxA = ox + (ARENA_W * T) / 2, cyA = oy + (ARENA_H * T) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const xm = x > 0 ? i - 1 : i, xp = x < w - 1 ? i + 1 : i, ym = y > 0 ? i - w : i, yp = y < h - 1 ? i + w : i;
    let nx = -(H[xp] - H[xm]) * k / 2, ny = -(H[yp] - H[ym]) * k / 2, nz = 1;
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
    const hz = nz + lz, hx2 = nx + lx, hy2 = ny + ly;
    const spec = WET[i] * Math.pow(Math.max(0, (nx * hx2 + ny * hy2 + nz * hz) / Math.hypot(hx2, hy2, hz)), 40) * 160;
    // vignette et halo central
    const dv = Math.hypot((x - cxA) / (ARENA_W * T * 0.62), (y - cyA) / (ARENA_H * T * 0.62));
    const vig = Math.max(0.35, 1 - Math.max(0, dv - 0.55) * 0.9);
    const lit = (0.38 + diff * 0.85) * vig;
    const gl = GLOW[i];
    o[i * 4] = Math.min(255, COL[i * 3] * lit + spec + gl * acc[0] * 0.8);
    o[i * 4 + 1] = Math.min(255, COL[i * 3 + 1] * lit + spec * 0.9 + gl * acc[1] * 0.8);
    o[i * 4 + 2] = Math.min(255, COL[i * 3 + 2] * lit + spec * 0.9 + gl * acc[2] * 0.8);
    o[i * 4 + 3] = 255;
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.putImageData(img, 0, 0);
  const sx = (ax: number) => ox + ax * T, sy = (ay: number) => oy + ay * T;

  // ponts de côtes et vertèbres
  for (const bx of BRIDGES) {
    const sc = new Sculpt(); sc.yaw = 0; sc.pitch = 1.1;
    const half = BRIDGE_HALF;
    for (const s of [-1, 1]) sc.cap([-RIVER_HALF - 0.4, 0.15, s * half], [RIVER_HALF + 0.4, 0.15, s * half], 0.14, 0.14, '#cfc4a8', 'bone');
    for (let kx = 0; kx < 6; kx++) {
      const xx = -RIVER_HALF - 0.2 + kx * ((RIVER_HALF * 2 + 0.4) / 5);
      sc.cap([xx, 0.12, -half], [xx, 0.18, half], 0.1, 0.1, '#ddd2b8', 'bone');
    }
    // le pont traverse verticalement : on dessine puis on tourne de 90°
    const S = T, size = Math.ceil((half * 2 + 1) * T), len = Math.ceil((RIVER_HALF * 2 + 1.4) * T);
    const img2 = renderSculpt(sc, len, size, S, len / 2, size / 2, 99, 1);
    g.save(); g.translate(sx(bx), sy(RIVER_Y)); g.rotate(Math.PI / 2);
    g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = T * 0.4; g.shadowOffsetY = T * 0.15;
    g.drawImage(img2, -len / 2, -size / 2); g.restore();
  }
  // rochers le long des bordures
  const rock = (seed: number, r: number) => {
    const sc = new Sculpt();
    for (let i = 0; i < 3; i++) sc.ell([((seed * 7 + i * 3) % 5) * 0.08 - 0.15, r * (0.5 + i * 0.12), (i - 1) * 0.15], [r * (0.9 - i * 0.2), r * (0.7 - i * 0.15), r * 0.8], mix('#4a4038', '#2a2420', i / 3), 'stone', { p: 2.6 });
    const sz = Math.ceil(r * 3.2 * T);
    return renderSculpt(sc, sz, sz, T, sz / 2, sz * 0.85, seed, 1);
  };
  const rocks = [rock(1, 0.55), rock(2, 0.45), rock(3, 0.6)];
  let rs = 7;
  const rnd = () => ((rs = (rs * 16807) % 2147483647) / 2147483647);
  for (let yy = 0.3; yy < ARENA_H; yy += 0.75 + rnd() * 0.4) {
    if (Math.abs(yy - RIVER_Y) < RIVER_HALF + 0.2) continue;
    for (const side of [0, ARENA_W]) {
      const im = rocks[Math.floor(rnd() * 3)];
      const s2 = 0.8 + rnd() * 0.5;
      g.drawImage(im, sx(side) - (im.width * s2) / 2 + (side ? T * 0.25 : -T * 0.25), sy(yy) - im.height * s2 * 0.8, im.width * s2, im.height * s2);
    }
  }
  // ossements et crânes épars
  const boneImg = (() => {
    const sc = new Sculpt(); sc.pitch = 1.0;
    sc.cap([-0.28, 0.05, 0], [0.28, 0.05, 0], 0.045, 0.045, '#d6cbb0', 'bone');
    for (const s of [-1, 1]) for (const z of [-0.05, 0.05]) sc.ell([s * 0.3, 0.05, z], [0.06, 0.06, 0.06], '#d6cbb0', 'bone');
    const sz = Math.ceil(0.8 * T); return renderSculpt(sc, sz, sz, T, sz / 2, sz / 2, 5, 1);
  })();
  const skullImg = (() => {
    const sc = new Sculpt(); sc.pitch = 0.7; sc.yaw = 0.6;
    sc.ell([0, 0.16, 0], [0.17, 0.15, 0.15], '#d8cdb2', 'bone');
    sc.ell([0.1, 0.07, 0], [0.09, 0.06, 0.1], '#d0c4a8', 'bone');
    for (const s of [-1, 1]) sc.ell([0.13, 0.17, s * 0.06], [0.04, 0.045, 0.04], '#100808', 'dark', { hard: true });
    const sz = Math.ceil(0.7 * T); return renderSculpt(sc, sz, sz, T, sz / 2, sz * 0.8, 6, 1);
  })();
  rs = 1337;
  for (let n = 0; n < 46; n++) {
    const ax = 0.6 + rnd() * (ARENA_W - 1.2), ay = 0.6 + rnd() * (ARENA_H - 1.2);
    if (Math.abs(ay - RIVER_Y) < 2 || pathMask(ax, ay) > 0.6) continue;
    const im = rnd() < 0.3 ? skullImg : boneImg;
    g.save(); g.translate(sx(ax), sy(ay)); g.rotate(rnd() * Math.PI * 2);
    g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = T * 0.15; g.shadowOffsetY = T * 0.05;
    g.globalAlpha = 0.85;
    g.drawImage(im, -im.width / 2, -im.height / 2); g.restore();
  }
  // brume au sol
  for (let n = 0; n < 18; n++) {
    const x = sx(rnd() * ARENA_W), y = sy(rnd() * ARENA_H), r = T * (2 + rnd() * 3);
    const fg = g.createRadialGradient(x, y, 0, x, y, r);
    fg.addColorStop(0, 'rgba(180,170,190,0.06)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (showGrid) {
    g.strokeStyle = 'rgba(255,255,255,0.03)'; g.lineWidth = 1;
    for (let gx = 1; gx < ARENA_W; gx++) { g.beginPath(); g.moveTo(sx(gx), sy(0)); g.lineTo(sx(gx), sy(ARENA_H)); g.stroke(); }
    for (let gy = 1; gy < ARENA_H; gy++) { g.beginPath(); g.moveTo(sx(0), sy(gy)); g.lineTo(sx(ARENA_W), sy(gy)); g.stroke(); }
  }
  return c;
}

/** Tour sculptée (sans la barre de vie ni l'œil/le cœur animés). Unité = 1 case. */
export function buildTowerSprite(type: 'king' | 'princess', team: string, T: number, destroyed: boolean): { img: HTMLCanvasElement; ax: number; ay: number } {
  const sc = new Sculpt();
  sc.yaw = 0.25; sc.pitch = 0.5;
  const R = type === 'king' ? 2.0 : 1.5;
  const stone = '#5a4e48', dark = '#2e2624';
  if (destroyed) {
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, d = (i % 3) * 0.35 * R;
      sc.ell([Math.cos(a) * d, 0.18 + (i % 2) * 0.12, Math.sin(a) * d], [0.35 * R * 0.6, 0.22, 0.3 * R * 0.6], mix(stone, dark, (i % 3) / 3), 'stone', { p: 3 });
    }
    for (let i = 0; i < 4; i++) sc.cap([-0.6 + i * 0.4, 0.3, -0.4], [-0.3 + i * 0.4, 0.35, 0.5], 0.06, 0.06, '#d6cbb0', 'bone');
  } else {
    sc.ell([0, 0.12, 0], [R * 0.95, 0.16, R * 0.95], dark, 'stone', { p: 4 });
    const tiers = type === 'king' ? 4 : 3;
    for (let i = 0; i < tiers; i++) {
      const rr = R * (0.82 - i * 0.1);
      sc.ell([0, 0.45 + i * 0.6, 0], [rr, 0.34, rr], mix(stone, '#6e625a', i / tiers), 'stone', { p: 5 });
      sc.ell([0, 0.78 + i * 0.6, 0], [rr * 1.03, 0.05, rr * 1.03], '#3a302c', 'stone', { p: 3 });
    }
    // côtes d'os qui enserrent la tour
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const pts: V3[] = [];
      for (let j = 0; j <= 4; j++) {
        const y = 0.2 + j * (0.6 * tiers) / 4;
        const rr = R * (0.92 - j * 0.1) * (1 + Math.sin(j) * 0.04);
        pts.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
      }
      sc.chain(pts, [0.09, 0.08, 0.07, 0.06, 0.05], '#d8ccb0', 'bone');
    }
    const top = 0.45 + tiers * 0.6 - 0.2;
    // couronne d'épines
    const cr = R * (0.8 - tiers * 0.1);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      sc.spike([Math.cos(a) * cr, top - 0.05, Math.sin(a) * cr], [Math.cos(a) * 0.4, 1, Math.sin(a) * 0.4], type === 'king' ? 0.9 : 0.6, 0.1, '#e2d6bc', 'bone');
    }
    // bannière d'équipe
    sc.ell([0.15, top - 0.6, R * 0.62], [0.32, 0.5, 0.05], team, 'cloth', { col2: mix(team, '#000000', 0.5) });
    // socle du cœur / de l'œil
    if (type === 'king') sc.ell([0, top + 0.05, 0], [cr * 0.95, 0.14, cr * 0.95], dark, 'stone', { p: 3 });
    else sc.ell([0.12, top - 0.05, 0.1], [0.55, 0.42, 0.45], '#1a1012', 'dark');
  }
  const S = T;
  const w = Math.ceil(R * 2.6 * T), hgt = Math.ceil((R + 4) * T);
  const ax = w / 2, ay = hgt - R * 0.75 * T;
  return { img: renderSculpt(sc, w, hgt, S, ax, ay, type === 'king' ? 3 : 4, 1), ax, ay };
}
