// Passe de « matériau » réaliste appliquée pixel par pixel sur une image déjà dessinée :
// relief (carte de hauteur → normales), éclairage directionnel, reflets spéculaires humides,
// lumière de contour, occlusion ambiante, texture organique (bruit fractal), parties émissives préservées.
// Exécutée une seule fois par image mise en cache : aucun coût par frame.

export interface MaterialOpts {
  /** Direction de la lumière (vers la source). */
  light?: [number, number, number];
  ambient?: number;
  diffuse?: number;
  specular?: number;
  shininess?: number;
  /** Intensité et couleur de la lumière de contour (contre-jour). */
  rim?: number;
  rimColor?: [number, number, number];
  /** Relief : force des normales. */
  bump?: number;
  /** Amplitude et échelle (px) de la texture organique. */
  texture?: number;
  textureScale?: number;
  /** Occlusion verticale : bas de la silhouette plus sombre. */
  groundAO?: number;
  /** Désaturation « réaliste » (0..1). */
  grit?: number;
  /** Rayon du flou de la carte de hauteur (px) ; par défaut ~4 % de la taille. */
  blur?: number;
  seed?: number;
}

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Bruit de valeur lissé. */
export function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed), c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Bruit fractal (fbm) dans [0, 1]. */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < octaves; o++) { s += valueNoise(x * f, y * f, seed + o * 101) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
  return s / norm;
}

/** Flou boîte séparable (2 passes ≈ gaussien). */
export function boxBlur(src: Float32Array, w: number, h: number, r: number, passes = 2): Float32Array {
  let a = new Float32Array(src), b = new Float32Array(src.length); // copie : la source reste intacte
  const d = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0;
      const row = y * w;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / d;
        acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    [a, b] = [b, a];
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += a[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        b[y * w + x] = acc / d;
        acc += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x];
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

export function applyMaterial(canvas: HTMLCanvasElement, opts: MaterialOpts = {}): void {
  const w = canvas.width, h = canvas.height;
  if (w < 4 || h < 4) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const n = w * h;
  const size = Math.min(w, h);
  const L = opts.light ?? [-0.55, -0.7, 0.55];
  const ll = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  // vecteur à mi-chemin lumière / vue (vue = 0,0,1)
  let hx = lx, hy = ly, hz = lz + 1;
  const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
  const ambient = opts.ambient ?? 0.42, kd = opts.diffuse ?? 0.85, ks = opts.specular ?? 0.35, shin = opts.shininess ?? 22;
  const rim = opts.rim ?? 0.45, rc = opts.rimColor ?? [255, 214, 170];
  const bump = opts.bump ?? 1, tex = opts.texture ?? 0.22, texScale = opts.textureScale ?? Math.max(2, size / 40);
  const ao = opts.groundAO ?? 0.25, grit = opts.grit ?? 0.15, seed = opts.seed ?? 7;
  const r = Math.max(1, Math.round(opts.blur ?? size * 0.035));

  // 1. Carte de hauteur : silhouette floutée (volume) + luminance (détails peints) + bruit (pores)
  const alpha = new Float32Array(n), lum = new Float32Array(n), noise = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    alpha[i] = px[i * 4 + 3] / 255;
    lum[i] = (px[i * 4] * 0.3 + px[i * 4 + 1] * 0.59 + px[i * 4 + 2] * 0.11) / 255;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (alpha[i] > 0.01) noise[i] = fbm(x / texScale, y / texScale, seed, 3);
  }
  const vol = boxBlur(alpha, w, h, r);
  const volBig = boxBlur(alpha, w, h, r * 3, 1);
  const lumB = boxBlur(lum, w, h, 1, 1);
  const H = new Float32Array(n);
  for (let i = 0; i < n; i++) H[i] = Math.sqrt(vol[i]) * 1.0 + lumB[i] * 0.22 * bump + noise[i] * 0.07 * bump;

  const k = (bump * size) / 26;
  for (let y = 0; y < h; y++) {
    const yf = y / h;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const a = px[i * 4 + 3];
      if (a === 0) continue;
      const xm = x > 0 ? i - 1 : i, xp = x < w - 1 ? i + 1 : i, ym = y > 0 ? i - w : i, yp = y < h - 1 ? i + w : i;
      let nx = -(H[xp] - H[xm]) * k, ny = -(H[yp] - H[ym]) * k, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
      const ndh = Math.max(0, nx * hx + ny * hy + nz * hz);
      const t = noise[i];
      const spec = Math.pow(ndh, shin) * ks * (0.45 + t) * 255;
      // contre-jour : bords orientés à l'opposé de la lumière
      const edge = 1 - nz;
      const back = Math.max(0, -(nx * lx + ny * ly)) / Math.max(0.001, Math.hypot(nx, ny));
      const rimF = Math.pow(edge, 1.6) * back * rim;
      // occlusion : creux (peu de matière autour) et bas de la silhouette
      const occ = (0.65 + 0.35 * Math.min(1, volBig[i] * 1.6)) * (1 - ao * yf * yf);
      const texMul = 1 - tex + tex * 2 * t;
      let R = px[i * 4], G = px[i * 4 + 1], B = px[i * 4 + 2];
      // parties émissives (yeux, lueurs) : très lumineuses et saturées → conservées
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const emissive = Math.min(1, Math.max(0, (mx / 255 - 0.62) * 4) * Math.max(0, (sat - 0.45) * 2.5));
      const g = grit * (1 - emissive);
      const l = R * 0.3 + G * 0.59 + B * 0.11;
      R += (l - R) * g; G += (l - G) * g; B += (l - B) * g;
      const shadeF = (ambient + diff * kd) * occ * texMul;
      const sR = R * shadeF + spec + rimF * rc[0];
      const sG = G * shadeF + spec + rimF * rc[1];
      const sB = B * shadeF + spec * 0.95 + rimF * rc[2];
      px[i * 4] = Math.min(255, sR + (R * 1.05 - sR) * emissive);
      px[i * 4 + 1] = Math.min(255, sG + (G * 1.05 - sG) * emissive);
      px[i * 4 + 2] = Math.min(255, sB + (B * 1.05 - sB) * emissive);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Préréglages de matériaux selon le type de créature / structure. */
export const MATERIALS: Record<string, MaterialOpts> = {
  flesh: { specular: 0.45, shininess: 18, texture: 0.2, rim: 0.5, rimColor: [255, 170, 150], grit: 0.12 },
  chitin: { specular: 0.6, shininess: 34, texture: 0.16, rim: 0.4, rimColor: [220, 255, 170], grit: 0.1, bump: 1.2 },
  bone: { specular: 0.18, shininess: 12, texture: 0.28, rim: 0.35, rimColor: [230, 210, 255], grit: 0.2, bump: 1.1 },
  abyss: { specular: 0.7, shininess: 40, texture: 0.14, rim: 0.6, rimColor: [140, 255, 245], grit: 0.08 },
  rust: { specular: 0.35, shininess: 26, texture: 0.34, rim: 0.35, rimColor: [255, 190, 120], grit: 0.18, bump: 1.25 },
  stone: { specular: 0.08, shininess: 10, texture: 0.3, rim: 0.2, rimColor: [200, 190, 180], grit: 0.25, bump: 1.4, groundAO: 0.35 },
};

/** Bruit cellulaire (Voronoï) : distance au bord de cellule (F2 − F1), pour écailles et plaques. */
export function cellEdge(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i + hash(xi + i, yi + j, seed), cy = yi + j + hash(xi + i, yi + j, seed + 1);
    const d = Math.hypot(x - cx, y - cy);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}
