// Anatomie 3D des créatures : chaque plan corporel est construit en volumes (Sculpt) et animé
// (repos, marche, attaque). Repère : X vers l'avant (la créature regarde à droite), Y vers le haut,
// Z vers le spectateur. Unité = taille de référence de la créature (≈ hauteur d'épaule humaine).
import { Rng } from '../core/rng';
import type { Visual } from '../core/types';
import { mix, type Mat, Sculpt, type V3 } from './sculpt';
import type { Pose } from './sprites';

const TAU = Math.PI * 2;
type Ctx = { sc: Sculpt; v: Visual; p: Pose; rng: Rng; mat: Mat; dark: string; light: string; bone: string };

function matOf(v: Visual): Mat {
  return (({ flesh: 'flesh', chitin: 'chitin', bone: 'bone', abyss: 'abyss', rust: 'rust' } as Record<string, Mat>)[v.mat ?? 'flesh']) ?? 'flesh';
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Jambe articulée : hanche → genou → cheville → pied, cycle de marche. */
function leg(c: Ctx, hip: V3, len: number, r: number, phase: number, opts: { col?: string; knee?: number; digitigrade?: boolean; mat?: Mat } = {}): void {
  const { p } = c;
  const sw = p.moving ? Math.sin(p.t * 9 + phase) : 0;
  const lift = p.moving ? Math.max(0, Math.cos(p.t * 9 + phase)) * 0.08 : 0;
  const kneeF = opts.knee ?? 1;
  const knee: V3 = [hip[0] + 0.1 * kneeF + sw * 0.12, hip[1] - len * 0.5 + lift, hip[2]];
  const ankle: V3 = opts.digitigrade
    ? [knee[0] - 0.12 + sw * 0.1, len * 0.18 + lift, hip[2]]
    : [hip[0] + sw * 0.2, 0.06 + lift, hip[2]];
  const foot: V3 = [ankle[0] + 0.12, 0.02 + lift * 0.5, hip[2]];
  const col = opts.col ?? c.dark;
  const m = opts.mat ?? c.mat;
  c.sc.cap(hip, knee, r, r * 0.75, col, m).cap(knee, ankle, r * 0.72, r * 0.5, col, m).cap(ankle, foot, r * 0.5, r * 0.32, col, m);
  c.sc.spike(foot, [1, -0.2, 0], 0.07, r * 0.2, c.bone);
}

/** Patte d'arthropode : segments fins, genou haut. */
function insectLeg(c: Ctx, base: V3, side: number, reach: number, phase: number, r: number, col: string): void {
  const sw = c.p.moving ? Math.sin(c.p.t * 14 + phase) * 0.1 : Math.sin(c.p.t + phase) * 0.01;
  const lift = c.p.moving ? Math.max(0, Math.cos(c.p.t * 14 + phase)) * 0.06 : 0;
  const knee: V3 = [base[0] + sw, base[1] + 0.18, base[2] + side * reach * 0.6];
  const foot: V3 = [base[0] + sw * 1.5 + 0.05, lift, base[2] + side * reach];
  c.sc.cap(base, knee, r, r * 0.8, col, 'chitin').cap(knee, foot, r * 0.8, r * 0.25, col, 'chitin');
}

function tentacle(c: Ctx, base: V3, dir: V3, len: number, r: number, phase: number, col: string, mat: Mat = c.mat): void {
  const pts: V3[] = [base];
  let [x, y, z] = base;
  let ang = Math.atan2(dir[1], dir[0]);
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    ang += Math.sin(c.p.t * 2.4 + phase + i * 0.8) * 0.3;
    x += Math.cos(ang) * (len / segs); y += Math.sin(ang) * (len / segs); z += dir[2] * (len / segs);
    pts.push([x, Math.max(0.02, y), z]);
  }
  c.sc.chain(pts, pts.map((_, i) => r * (1 - i / pts.length) + 0.008), col, mat, { col2: mix(col, '#1a0508', 0.5) });
}

function eyes(c: Ctx, n: number, center: V3, spread: number, r: number): void {
  const { rng, v, p } = c;
  if (n <= 0) return;
  const blink = Math.sin(p.t * 1.3 + v.seed) > 0.97 ? 0.15 : 1;
  const look = Math.sin(p.t * 0.7 + v.seed) * 0.8;
  if (n === 1) { c.sc.eye(add(center, [0, 0, 0.02]), r * 1.4, v.c3, { blink, look }); return; }
  if (n === 2) {
    for (const s of [-1, 1]) c.sc.eye(add(center, [0, 0, s * spread * 0.5]), r, v.c3, { blink, look });
    return;
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rng.range(-0.3, 0.3);
    const d = spread * rng.range(0.25, 1);
    c.sc.eye(add(center, [rng.range(-0.02, 0.03), Math.sin(a) * d * 0.6, Math.cos(a) * d]), r * rng.range(0.55, 1.05), v.c3, { blink, look });
  }
}

/** Gueule : cavité sombre + rangées de crocs. */
function maw(c: Ctx, center: V3, w: number, open: number, teethN: number, facing: V3 = [1, 0, 0]): void {
  const o = 0.25 + open * 0.75;
  c.sc.ell(center, [w * 0.35 * Math.abs(facing[0]) + 0.01, w * 0.2 * o, w * 0.5], '#200608', 'dark', { k: 0.02 });
  for (let i = 0; i < teethN; i++) {
    const z = center[2] - w * 0.42 + (w * 0.84 * (i + 0.5)) / teethN;
    const x = center[0] + w * 0.12;
    c.sc.spike([x, center[1] + w * 0.17 * o, z], [0.15, -1, 0], w * (0.18 + (i % 2) * 0.08), w * 0.05, '#efe3c8', 'tooth');
    c.sc.spike([x, center[1] - w * 0.17 * o, z], [0.15, 1, 0], w * 0.15, w * 0.045, '#e6d8b8', 'tooth');
  }
}

function spikesOn(c: Ctx, n: number, center: V3, r: V3, len: number, from = 0.15, to = 0.85): void {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (from + ((to - from) * (i + 0.5)) / n) + c.rng.range(-0.08, 0.08);
    const zz = c.rng.range(-0.6, 0.6) * r[2];
    const base: V3 = [center[0] + Math.cos(a) * r[0] * 0.92, center[1] + Math.sin(a) * r[1] * 0.92, center[2] + zz];
    c.sc.spike(base, [Math.cos(a), Math.sin(a), zz * 0.5], len * c.rng.range(0.7, 1.3), len * 0.18, c.bone);
  }
}

function hornsOn(c: Ctx, n: number, head: V3, r: number): void {
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const k = Math.floor(i / 2);
    c.sc.horn(add(head, [-r * 0.2 - k * r * 0.25, r * 0.6, side * r * 0.5]), [-0.3, 1, side * 0.5], -0.35 - k * 0.1, r * (1.3 - k * 0.25), r * 0.22, c.bone);
  }
}

// ======================================================================== plans

function biped(c: Ctx, hunch = 0.3): void {
  const { sc, v, p, rng } = c;
  const atk = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const bob = p.moving ? Math.abs(Math.sin(p.t * 9)) * 0.03 : Math.sin(p.t * 2) * 0.01;
  const pelvis: V3 = [0, 0.62 + bob, 0];
  leg(c, add(pelvis, [0, 0, -0.12]), 0.62, 0.075, 0);
  leg(c, add(pelvis, [0, 0, 0.12]), 0.62, 0.075, Math.PI);
  const chest: V3 = [0.12 + hunch * 0.15, 1.0 + bob, 0];
  sc.ell(pelvis, [0.16, 0.12, 0.17], c.dark, c.mat);
  sc.chain([pelvis, [0.05 + hunch * 0.08, 0.82 + bob, 0], chest], [0.13, 0.15, 0.2], v.c1, c.mat);
  sc.ell(chest, [0.24, 0.26, 0.22], v.c1, c.mat, { rot: -hunch * 0.6 });
  // côtes saillantes
  for (let i = 0; i < 4; i++) sc.cap([chest[0] + 0.14, chest[1] + 0.12 - i * 0.08, -0.17], [chest[0] + 0.2, chest[1] + 0.1 - i * 0.08, 0.17], 0.025, 0.025, mix(v.c2, '#ffffff', 0.15), 'bone');
  for (let i = 0; i < v.spikes; i++) sc.spike([chest[0] - 0.18 + i * 0.02, chest[1] + 0.18 - i * 0.05, rng.range(-0.1, 0.1)], [-0.6, 1, 0], 0.18, 0.04, c.bone);
  for (let i = 0; i < v.tentacles; i++) tentacle(c, [chest[0] - 0.2, chest[1] + 0.05, -0.1 + i * 0.1], [-0.6, 0.8, 0], 0.5, 0.05, i, v.c1);
  // bras
  const shoulder = (s: number): V3 => [chest[0] - 0.02, chest[1] + 0.14, s * 0.24];
  const reach = (s: number) => (s > 0 ? atk : 0);
  for (const s of [-1, 1]) {
    const a = reach(s);
    const sh = shoulder(s);
    const sw = p.moving ? Math.sin(p.t * 9 + (s > 0 ? 0 : Math.PI)) * 0.1 : 0;
    const elbow: V3 = [sh[0] + 0.08 + a * 0.2 + sw, sh[1] - 0.25 + a * 0.15, sh[2] + s * 0.04];
    const hand: V3 = [elbow[0] + 0.1 + a * 0.35, elbow[1] - 0.25 + a * 0.2, sh[2]];
    sc.cap(sh, elbow, 0.07, 0.055, v.c1, c.mat).cap(elbow, hand, 0.055, 0.045, v.c1, c.mat);
    for (let k = 0; k < 3; k++) sc.spike(hand, [0.6 + a * 0.4, -0.8 + k * 0.15, (k - 1) * 0.3], 0.1, 0.02, c.bone);
  }
  if (v.limbs > 2) { const sh: V3 = [chest[0] + 0.05, chest[1] - 0.05, 0.2]; sc.chain([sh, [sh[0] + 0.2, sh[1] - 0.15, 0.25], [sh[0] + 0.25, sh[1] - 0.38, 0.22]], [0.04, 0.035, 0.02], c.light, 'bone'); }
  if (v.limbs > 3) { const sh: V3 = [chest[0] + 0.05, chest[1] - 0.05, -0.2]; sc.chain([sh, [sh[0] + 0.2, sh[1] - 0.15, -0.25], [sh[0] + 0.25, sh[1] - 0.38, -0.22]], [0.04, 0.035, 0.02], c.light, 'bone'); }
  // tête
  const head: V3 = [chest[0] + 0.18 + hunch * 0.12, chest[1] + 0.32, 0];
  sc.cap(add(chest, [0.1, 0.18, 0]), head, 0.08, 0.07, v.c1, c.mat);
  sc.ell(head, [0.16, 0.15, 0.14], v.c2, c.mat, { rot: -0.2 });
  sc.ell(add(head, [0.11, -0.07, 0]), [0.1, 0.06 + atk * 0.03, 0.11], v.c2, c.mat);
  maw(c, add(head, [0.14, -0.06, 0]), 0.16, p.attack, 5);
  hornsOn(c, v.horns, head, 0.14);
  if (v.eyes === 0) {
    for (let i = 0; i < 4; i++) sc.cap(add(head, [0.12, 0.05, -0.08 + i * 0.05]), add(head, [0.13, 0.02, -0.07 + i * 0.05]), 0.012, 0.012, '#1a0808', 'dark', { hard: true });
  } else eyes(c, v.eyes, add(head, [0.13, 0.04, 0]), 0.1, 0.03);
}

function brute(c: Ctx): void {
  const { sc, v, p } = c;
  const atk = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const bob = p.moving ? Math.abs(Math.sin(p.t * 6)) * 0.04 : Math.sin(p.t * 1.6) * 0.015;
  const pelvis: V3 = [0, 0.5 + bob, 0];
  leg(c, add(pelvis, [0, 0, -0.2]), 0.5, 0.13, 0, { knee: 0.6 });
  leg(c, add(pelvis, [0, 0, 0.2]), 0.5, 0.13, Math.PI, { knee: 0.6 });
  const torso: V3 = [0.05, 0.95 + bob, 0];
  sc.ell(pelvis, [0.24, 0.16, 0.26], c.dark, c.mat);
  sc.ell(torso, [0.42, 0.4, 0.38], v.c1, c.mat, { rot: -0.25 });
  sc.ell(add(torso, [0.18, -0.12, 0]), [0.3, 0.26, 0.3], mix(v.c1, v.c2, 0.25), c.mat);
  sc.ell(add(torso, [-0.15, 0.25, 0]), [0.32, 0.22, 0.34], v.c1, c.mat);
  spikesOn(c, v.spikes, add(torso, [-0.05, 0.05, 0]), [0.4, 0.4, 0.35], 0.22, 0.35, 0.95);
  for (let i = 0; i < v.tentacles; i++) tentacle(c, add(torso, [0.1, -0.3, -0.25 + i * 0.15]), [0.2, -1, 0.1], 0.45, 0.06, i * 1.3, v.c1);
  for (const s of [-1, 1]) {
    const a = s > 0 ? atk : 0;
    const sh: V3 = [torso[0] + 0.05, torso[1] + 0.22, s * 0.4];
    const el: V3 = [sh[0] + 0.15 + a * 0.15, sh[1] - 0.35 + a * 0.45, sh[2] + s * 0.08];
    const fist: V3 = [el[0] + 0.12 + a * 0.3, Math.max(0.12, el[1] - 0.38 + a * 0.2), sh[2]];
    sc.cap(sh, el, 0.15, 0.13, v.c1, c.mat).cap(el, fist, 0.13, 0.12, v.c1, c.mat);
    sc.ell(fist, [0.14, 0.13, 0.14], mix(v.c2, v.c1, 0.4), c.mat);
    for (let k = 0; k < 3; k++) sc.spike(add(fist, [0.1, 0.02, (k - 1) * 0.07]), [1, 0.1, 0], 0.08, 0.03, c.bone);
  }
  const head: V3 = [torso[0] + 0.32, torso[1] + 0.2, 0];
  sc.ell(head, [0.15, 0.14, 0.15], v.c2, c.mat);
  maw(c, add(head, [0.12, -0.06, 0]), 0.17, p.attack, 6);
  hornsOn(c, v.horns, head, 0.15);
  eyes(c, v.eyes, add(head, [0.12, 0.04, 0]), 0.11, 0.032);
}

function quadruped(c: Ctx): void {
  const { sc, v, p } = c;
  const atk = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const bob = p.moving ? Math.abs(Math.sin(p.t * 10)) * 0.03 : Math.sin(p.t * 2) * 0.01;
  const by = 0.52 + bob;
  const legs = Math.max(4, v.limbs);
  for (let i = 0; i < legs; i++) {
    const fx = 0.32 - (Math.floor(i / 2) / Math.max(1, legs / 2 - 1)) * 0.62;
    const side = i % 2 ? 1 : -1;
    leg(c, [fx, by - 0.05, side * 0.16], 0.48, 0.065, i * 1.7, { digitigrade: true, knee: -0.3 });
  }
  sc.ell([0, by, 0], [0.48, 0.2, 0.2], v.c1, c.mat, { rot: 0.04 });
  sc.ell([0.22, by + 0.05, 0], [0.22, 0.2, 0.21], v.c1, c.mat);
  sc.ell([-0.25, by + 0.02, 0], [0.22, 0.17, 0.19], v.c1, c.mat);
  // vertèbres saillantes
  for (let i = 0; i < 7; i++) sc.ell([-0.38 + i * 0.12, by + 0.19 - Math.abs(i - 3) * 0.008, 0], [0.04, 0.035, 0.05], v.c2, 'bone', { hard: true });
  for (let i = 0; i < v.spikes; i++) sc.spike([-0.4 + (i / Math.max(1, v.spikes)) * 0.8, by + 0.17, (i % 2 ? 1 : -1) * 0.06], [-0.3, 1, (i % 2 ? 1 : -1) * 0.3], 0.15, 0.03, c.bone);
  for (let i = 0; i < v.tentacles; i++) tentacle(c, [-0.45, by + 0.05, -0.05 + i * 0.1], [-1, 0.4, 0], 0.4, 0.05, i, v.c1);
  // queue
  sc.chain([[-0.45, by + 0.05, 0], [-0.62, by + 0.1 + Math.sin(p.t * 3) * 0.04, 0], [-0.78, by + 0.02, 0]], [0.06, 0.04, 0.015], v.c1, c.mat);
  const neck: V3 = [0.38, by + 0.12, 0];
  const head: V3 = [0.62 + atk * 0.15, by + 0.12 - atk * 0.05, 0];
  sc.cap(neck, head, 0.13, 0.11, v.c1, c.mat);
  sc.ell(head, [0.17, 0.12, 0.13], v.c2, c.mat, { rot: -0.15 });
  sc.ell(add(head, [0.14, -0.04, 0]), [0.12, 0.07 + p.attack * 0.03, 0.09], v.c2, c.mat);
  maw(c, add(head, [0.18, -0.05, 0]), 0.15, p.attack, 6);
  hornsOn(c, v.horns, head, 0.13);
  eyes(c, v.eyes, add(head, [0.1, 0.05, 0]), 0.1, 0.028);
}

function insect(c: Ctx): void {
  const { sc, v, p } = c;
  const atk = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const by = 0.4 + (p.moving ? Math.sin(p.t * 14) * 0.01 : 0);
  const legs = Math.max(4, v.limbs);
  for (let i = 0; i < legs; i++) insectLeg(c, [0.12 - Math.floor(i / 2) * 0.15, by - 0.02, (i % 2 ? 1 : -1) * 0.08], i % 2 ? 1 : -1, 0.36, i * 1.4, 0.03, mix(v.c1, '#000000', 0.35));
  sc.ell([-0.32, by + 0.05, 0], [0.36, 0.26, 0.28], v.c1, 'chitin', { rot: 0.15, col2: mix(v.c1, v.c2, 0.4) });
  // segments d'abdomen
  for (let i = 0; i < 4; i++) sc.ell([-0.15 - i * 0.14, by + 0.2 - i * 0.02, 0], [0.06, 0.1, 0.26 - i * 0.02], mix(v.c1, '#000000', 0.15 * (i % 2)), 'chitin');
  sc.ell([0.1, by + 0.05, 0], [0.18, 0.16, 0.17], mix(v.c1, v.c2, 0.2), 'chitin');
  for (let i = 0; i < v.spikes; i++) sc.spike([-0.45 + i * 0.07, by + 0.25, (i % 2 ? 1 : -1) * 0.12], [-0.2, 1, (i % 2 ? 1 : -1) * 0.4], 0.14, 0.025, c.bone);
  const head: V3 = [0.32 + atk * 0.08, by + 0.03, 0];
  sc.ell(head, [0.13, 0.12, 0.13], v.c2, 'chitin');
  hornsOn(c, v.horns, head, 0.12);
  const open = 0.3 + p.attack * 0.7;
  for (const s of [-1, 1]) sc.chain([add(head, [0.08, -0.04, s * 0.06]), add(head, [0.22, -0.05, s * (0.08 + open * 0.07)]), add(head, [0.28, -0.06, s * 0.02])], [0.03, 0.022, 0.006], mix(v.c2, '#000000', 0.4), 'chitin', { hard: true });
  // antennes
  for (const s of [-1, 1]) sc.chain([add(head, [0.06, 0.08, s * 0.05]), add(head, [0.18, 0.28, s * 0.12]), add(head, [0.32, 0.36 + Math.sin(p.t * 3 + s) * 0.03, s * 0.18])], [0.012, 0.009, 0.004], mix(v.c2, '#000000', 0.5), 'chitin', { hard: true });
  eyes(c, v.eyes, add(head, [0.09, 0.03, 0]), 0.09, 0.024);
}

function mantis(c: Ctx): void {
  const { sc, v, p } = c;
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  for (let i = 0; i < 4; i++) insectLeg(c, [-0.05 - Math.floor(i / 2) * 0.15, 0.42, (i % 2 ? 1 : -1) * 0.06], i % 2 ? 1 : -1, 0.3, i * 1.6, 0.025, mix(v.c1, '#000000', 0.3));
  sc.ell([-0.35, 0.45, 0], [0.32, 0.1, 0.11], v.c1, 'chitin', { rot: 0.1 });
  for (let i = 0; i < 5; i++) sc.ell([-0.15 - i * 0.12, 0.46, 0], [0.025, 0.1, 0.11], mix(v.c1, '#000000', 0.25), 'chitin');
  const neckTop: V3 = [0.15, 1.05, 0];
  sc.chain([[0, 0.45, 0], [0.08, 0.75, 0], neckTop], [0.07, 0.06, 0.05], mix(v.c1, v.c2, 0.15), 'chitin');
  // faux raptoriales
  const scythe = (s: number, off: number) => {
    const sh: V3 = [0.1, 0.95, s * 0.08];
    const el: V3 = [0.32 + a * 0.3, 1.05 - a * 0.2 + off, s * 0.12];
    const tip: V3 = [el[0] + 0.05 + a * 0.15, el[1] - 0.4 + a * 0.15, s * 0.1];
    sc.cap(sh, el, 0.035, 0.03, v.c1, 'chitin').cap(el, tip, 0.04, 0.012, v.c2, 'chitin', { hard: true });
    for (let k = 0; k < 4; k++) sc.spike([el[0] + 0.02 * k, el[1] - 0.08 * k, s * 0.1], [-1, -0.3, 0], 0.05, 0.01, c.bone);
  };
  scythe(-1, 0);
  if (v.limbs > 4) scythe(1, -0.08);
  const head: V3 = [0.2, 1.17, 0];
  sc.ell(head, [0.08, 0.07, 0.15], v.c2, 'chitin', { rot: -0.3 });
  sc.ell(add(head, [0.06, -0.08, 0]), [0.05, 0.06, 0.05], mix(v.c2, '#000000', 0.2), 'chitin');
  hornsOn(c, v.horns, head, 0.08);
  for (const s of [-1, 1]) c.sc.eye(add(head, [0.03, 0.03, s * 0.13]), 0.026, v.c3, { slit: false });
  if (v.eyes > 2) c.sc.eye(add(head, [0.07, 0.04, 0]), 0.016, v.c3);
}

function spider(c: Ctx): void {
  const { sc, v, p } = c;
  const by = 0.42;
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1, k = i % 4;
    const base: V3 = [0.1 - k * 0.07, by, side * 0.08];
    const sw = p.moving ? Math.sin(p.t * 14 + i * 1.1) * 0.1 : 0;
    const knee: V3 = [base[0] + (k - 1.5) * 0.12 + sw, by + 0.3, side * 0.35];
    const foot: V3 = [base[0] + (k - 1.5) * 0.22 + sw, 0, side * 0.6];
    sc.cap(base, knee, 0.035, 0.03, mix(v.c1, '#000000', 0.4), 'chitin').cap(knee, foot, 0.03, 0.01, mix(v.c1, '#000000', 0.5), 'chitin');
  }
  sc.ell([-0.25, by + 0.08, 0], [0.32, 0.27, 0.28], v.c1, 'chitin', { col2: mix(v.c1, '#000000', 0.4) });
  sc.ell([-0.2, by + 0.3, 0], [0.12, 0.05, 0.1], v.c3, 'glow');
  sc.ell([0.12, by + 0.04, 0], [0.17, 0.14, 0.15], v.c2, 'chitin');
  for (const s of [-1, 1]) sc.spike([0.25, by - 0.02, s * 0.05], [0.4, -1, 0], 0.13 + p.attack * 0.05, 0.03, '#1a0e0a', 'chitin');
  eyes(c, v.eyes, [0.26, by + 0.08, 0], 0.08, 0.02);
}

function crab(c: Ctx): void {
  const { sc, v, p } = c;
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const by = 0.38;
  for (let i = 0; i < Math.max(4, v.limbs); i++) {
    const side = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    insectLeg(c, [0.05 - k * 0.15, by - 0.05, side * 0.25], side, 0.32, i, 0.04, mix(v.c1, '#000000', 0.3));
  }
  sc.ell([0, by, 0], [0.42, 0.18, 0.4], v.c1, 'chitin', { p: 2.4, col2: mix(v.c1, '#ffffff', 0.15) });
  for (let i = 0; i < 3; i++) sc.ell([-0.05, by + 0.12, 0], [0.32 - i * 0.08, 0.04, 0.3 - i * 0.07], mix(v.c1, v.c2, 0.15 * i), 'chitin');
  spikesOn(c, v.spikes, [0, by, 0], [0.4, 0.17, 0.35], 0.12);
  for (const s of [-1, 1]) {
    const sh: V3 = [0.25, by + 0.02, s * 0.3];
    const el: V3 = [0.5 + a * 0.1, by + 0.15 + a * 0.12, s * 0.42];
    const claw: V3 = [0.68 + a * 0.15, by + 0.18 + a * 0.15, s * 0.38];
    sc.cap(sh, el, 0.07, 0.06, v.c1, 'chitin').ell(claw, [0.14, 0.09, 0.08], v.c2, 'chitin', { rot: 0.3 });
    sc.cap(add(claw, [0.08, 0.04, 0]), add(claw, [0.22, 0.02 + a * 0.06, 0]), 0.035, 0.008, mix(v.c2, '#000000', 0.3), 'chitin', { hard: true });
    sc.cap(add(claw, [0.08, -0.03, 0]), add(claw, [0.2, -0.04 - a * 0.04, 0]), 0.03, 0.008, mix(v.c2, '#000000', 0.3), 'chitin', { hard: true });
  }
  for (const s of [-1, 1]) { sc.cap([0.3, by + 0.12, s * 0.08], [0.36, by + 0.3, s * 0.1], 0.018, 0.015, v.c1, 'chitin'); c.sc.eye([0.36, by + 0.33, s * 0.1], 0.035, v.c3); }
  if (v.eyes > 2) eyes(c, v.eyes - 2, [0.38, by + 0.1, 0], 0.08, 0.018);
}

function serpent(c: Ctx): void {
  const { sc, v, p } = c;
  const wave = p.moving ? p.t * 9 : p.t;
  const pts: V3[] = [];
  for (let i = 0; i < 9; i++) pts.push([-0.7 + i * 0.16, 0.16 + Math.max(0, Math.sin(wave + i * 0.8)) * 0.03, Math.sin(wave + i * 0.8) * 0.06]);
  pts.forEach((pt, i) => {
    for (const s of [-1, 1]) insectLeg(c, pt, s, 0.18, i * 1.3 + (s > 0 ? 1 : 0), 0.015, mix(v.c1, '#000000', 0.4));
    sc.ell(pt, [0.1, 0.09, 0.12], i % 2 ? v.c1 : mix(v.c1, '#000000', 0.15), 'chitin');
    sc.ell(add(pt, [0, 0.07, 0]), [0.07, 0.025, 0.1], v.c2, 'chitin');
  });
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * 0.12 : 0;
  const head: V3 = add(pts[8], [0.14 + lunge, 0.03, 0]);
  sc.ell(head, [0.14, 0.1, 0.13], v.c2, 'chitin');
  for (const s of [-1, 1]) sc.chain([add(head, [0.08, -0.03, s * 0.06]), add(head, [0.2, -0.05, s * (0.1 + p.attack * 0.05)]), add(head, [0.24, -0.07, s * 0.02])], [0.025, 0.018, 0.005], '#1a0e0a', 'chitin', { hard: true });
  hornsOn(c, v.horns, head, 0.1);
  eyes(c, v.eyes, add(head, [0.08, 0.04, 0]), 0.08, 0.022);
  // cavalier greffé
  const seat: V3 = [-0.15, 0.32, 0];
  sc.ell(add(seat, [0, 0.12, 0]), [0.09, 0.15, 0.1], mix(v.c2, '#000000', 0.2), 'flesh');
  sc.ell(add(seat, [0.02, 0.33, 0]), [0.07, 0.07, 0.07], mix(v.c2, '#000000', 0.3), 'bone');
  c.sc.eye(add(seat, [0.07, 0.34, 0]), 0.018, v.c3);
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  sc.cap(add(seat, [0, 0.2, 0.08]), add(seat, [0.5 + a * 0.2, 0.25 - a * 0.1, 0.1]), 0.012, 0.01, '#b8b0a0', 'metal', { hard: true });
  sc.spike(add(seat, [0.5 + a * 0.2, 0.25 - a * 0.1, 0.1]), [1, -0.1, 0], 0.08, 0.02, '#d8d0c0', 'metal');
}

function fly(c: Ctx): void {
  const { sc, v, p } = c;
  const hy = 0.95 + Math.sin(p.t * 6) * 0.05;
  const flap = Math.sin(p.t * 40);
  for (const s of [-1, 1]) {
    const tip: V3 = [-0.15, hy + 0.25 + flap * 0.08, s * 0.45];
    sc.membrane([[0.02, hy + 0.05, s * 0.05], [-0.05, hy + 0.2 + flap * 0.1, s * 0.25], tip, [-0.3, hy + 0.05, s * 0.3]], '#d8e4f0', 0.32, s > 0,
      [[[0.02, hy + 0.05, s * 0.05], tip]]);
  }
  sc.ell([0, hy, 0], [0.13, 0.11, 0.11], v.c1, c.mat);
  sc.ell([-0.2, hy - 0.02, 0], [0.16, 0.1, 0.1], mix(v.c1, '#000000', 0.2), c.mat, { rot: 0.2 });
  for (let i = 0; i < 3; i++) sc.ell([-0.15 - i * 0.07, hy - 0.02, 0], [0.02, 0.1, 0.1], mix(v.c1, v.c2, 0.4), c.mat);
  const head: V3 = [0.15, hy + 0.01, 0];
  sc.ell(head, [0.08, 0.08, 0.09], v.c2, c.mat);
  for (const s of [-1, 1]) c.sc.eye(add(head, [0.03, 0.02, s * 0.06]), 0.045, v.c3, { slit: false });
  sc.cap(add(head, [0.06, -0.04, 0]), add(head, [0.18 + p.attack * 0.1, -0.12, 0]), 0.012, 0.004, '#2a1a10', 'chitin', { hard: true });
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) sc.chain([[-0.02 - i * 0.05, hy - 0.08, s * 0.04], [-0.04 - i * 0.05, hy - 0.2, s * 0.1], [-0.02 - i * 0.05, hy - 0.3, s * 0.12]], [0.01, 0.008, 0.004], '#1a1210', 'chitin', { hard: true });
}

function eyeCreature(c: Ctx): void {
  const { sc, v, p } = c;
  const hy = 1.0 + Math.sin(p.t * 3) * 0.06;
  const flap = Math.sin(p.t * 9);
  for (const s of [-1, 1]) {
    const tip: V3 = [-0.1, hy + 0.35 + flap * 0.15, s * 0.65];
    sc.membrane([[0, hy + 0.05, s * 0.2], tip, [-0.25, hy + 0.05 + flap * 0.1, s * 0.6], [-0.15, hy - 0.05, s * 0.3]], mix(v.c1, '#5a2020', 0.3), 0.85, s > 0,
      [[[0, hy + 0.05, s * 0.2], tip], [[0, hy + 0.05, s * 0.2], [-0.25, hy + 0.05 + flap * 0.1, s * 0.6]]]);
    sc.chain([[0, hy + 0.05, s * 0.2], tip], [0.02, 0.008], mix(v.c1, '#000000', 0.4), c.mat);
  }
  for (let i = 0; i < 4; i++) tentacle(c, [-0.05 + (i % 2) * 0.05, hy - 0.2, -0.1 + i * 0.07], [0.1, -1, 0], 0.4, 0.035, i, mix(v.c1, '#3a0a10', 0.4), 'flesh');
  // globe oculaire veiné
  sc.ell([0, hy, 0], [0.28, 0.28, 0.28], '#e8d8cc', 'flesh', { col2: '#a05050' });
  c.sc.eye([0.22, hy + 0.01, 0.05], 0.15, v.c3, { slit: true, blink: 1 - p.attack * 0.4, look: Math.sin(p.t * 0.9) });
}

function winged(c: Ctx): void {
  const { sc, v, p } = c;
  const hy = 1.0 + Math.sin(p.t * 3) * 0.05;
  const flap = Math.sin(p.t * 5);
  const lunge = p.attack > 0 ? Math.sin(p.attack * Math.PI) * 0.1 : 0;
  for (const s of [-1, 1]) {
    const sh: V3 = [0.05, hy + 0.12, s * 0.15];
    const el: V3 = [-0.05, hy + 0.3 + flap * 0.2, s * 0.45];
    const tip: V3 = [-0.3, hy + 0.32 + flap * 0.28, s * 0.85];
    const f2: V3 = [-0.48, hy + 0.08 + flap * 0.15, s * 0.7];
    const f3: V3 = [-0.45, hy - 0.05 + flap * 0.1, s * 0.5];
    sc.membrane([sh, el, tip, f2, [-0.35, hy + 0.05, s * 0.6], f3, [-0.2, hy, s * 0.2]], mix(v.c1, '#200a0a', 0.35), 0.88, s > 0, [[el, f2], [el, f3]]);
    sc.chain([sh, el, tip], [0.05, 0.035, 0.01], v.c2, 'bone');
    sc.cap(el, f2, 0.025, 0.008, v.c2, 'bone').cap(el, f3, 0.025, 0.008, v.c2, 'bone');
  }
  // queue
  const tail: V3[] = [[-0.25, hy - 0.05, 0]];
  for (let i = 1; i < 6; i++) tail.push([-0.25 - i * 0.13, hy - 0.05 - i * 0.04 + Math.sin(p.t * 3 + i) * 0.04, Math.sin(p.t * 2 + i) * 0.05]);
  sc.chain(tail, [0.1, 0.08, 0.06, 0.045, 0.03, 0.012], v.c1, c.mat);
  sc.ell([0, hy, 0], [0.3, 0.18, 0.18], v.c1, c.mat, { rot: 0.1 });
  for (let i = 0; i < 4; i++) sc.cap([0.12 - i * 0.08, hy + 0.05, -0.17], [0.12 - i * 0.08, hy - 0.1, 0.17], 0.018, 0.018, '#d8cfb8', 'bone');
  for (let i = 0; i < v.spikes; i++) sc.spike([0.2 - i * 0.07, hy + 0.15, 0], [-0.3, 1, 0], 0.12, 0.025, c.bone);
  for (const s of [-1, 1]) leg(c, [-0.05, hy - 0.1, s * 0.12], 0.35, 0.05, s, { col: mix(v.c1, '#000000', 0.3) });
  const neck: V3[] = [[0.25, hy + 0.08, 0], [0.38, hy + 0.25, 0], [0.45 + lunge, hy + 0.32, 0]];
  sc.chain(neck, [0.09, 0.07, 0.06], v.c1, c.mat);
  const head: V3 = [0.55 + lunge, hy + 0.33, 0];
  sc.ell(head, [0.15, 0.08, 0.08], v.c2, c.mat, { rot: -0.15 });
  sc.ell(add(head, [0.1, -0.05, 0]), [0.1, 0.04 + p.attack * 0.03, 0.06], v.c2, c.mat);
  maw(c, add(head, [0.12, -0.04, 0]), 0.1, p.attack, 5);
  hornsOn(c, v.horns, head, 0.1);
  eyes(c, v.eyes, add(head, [0.04, 0.04, 0]), 0.06, 0.02);
  if (p.attack > 0.2) sc.ell(add(head, [0.3, -0.05, 0]), [0.08, 0.08, 0.08], v.c3, 'glow');
}

function blob(c: Ctx): void {
  const { sc, v, p, rng } = c;
  const sq = 1 + Math.sin(p.t * (p.moving ? 8 : 2.5)) * 0.06 + p.attack * 0.12;
  const r = 0.45;
  for (let i = 0; i < v.tentacles; i++) tentacle(c, [-0.2 + (i / Math.max(1, v.tentacles - 1)) * 0.4, 0.15, -0.25 + (i % 3) * 0.25], [rng.range(-0.5, 0.5), -0.3, 0.3], 0.4, 0.06, i * 0.9, mix(v.c1, '#000000', 0.2));
  sc.ell([0, r / sq * 0.95, 0], [r * sq, r / sq, r * sq], v.c1, c.mat, { col2: mix(v.c1, '#000000', 0.35) });
  // excroissances
  for (let i = 0; i < 6; i++) {
    const a = rng.range(0, TAU);
    sc.ell([Math.cos(a) * r * 0.6, r * (0.7 + Math.sin(a) * 0.4), rng.range(-0.3, 0.3)], [r * 0.35, r * 0.3, r * 0.35], mix(v.c1, v.c2, rng.range(0, 0.3)), c.mat);
  }
  // pustules luisantes
  for (let i = 0; i < 5; i++) sc.ell([rng.range(-0.3, 0.3), rng.range(0.4, 0.8), rng.range(0.1, 0.4)], [0.035, 0.035, 0.03], v.c3, 'abyss', { hard: true });
  spikesOn(c, v.spikes, [0, r, 0], [r * sq, r / sq, r], 0.15, 0, 1);
  maw(c, [r * 0.85, r * 0.6, 0], 0.35, p.attack, 7);
  eyes(c, v.eyes, [r * 0.8, r * 1.05, 0], r * 0.5, 0.035);
}

function skeletal(c: Ctx): void {
  const { sc, v, p } = c;
  const bone = v.c1;
  const many = v.limbs > 4;
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  if (many) {
    // amas rampant : crâne sur une grappe d'os et de pattes
    for (let i = 0; i < v.limbs; i++) {
      const s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const sw = p.moving ? Math.sin(p.t * 12 + i) * 0.06 : 0;
      sc.chain([[0.05 - k * 0.08, 0.3, s * 0.06], [0.1 - k * 0.08 + sw, 0.32, s * 0.2], [0.12 - k * 0.08 + sw, 0, s * 0.3]], [0.025, 0.02, 0.012], bone, 'bone');
    }
    sc.ell([0, 0.3, 0], [0.15, 0.08, 0.1], bone, 'bone');
    const head: V3 = [0.12, 0.42, 0];
    sc.ell(head, [0.13, 0.12, 0.12], bone, 'bone');
    sc.ell(add(head, [0.06, -0.1, 0]), [0.07, 0.04 + p.attack * 0.03, 0.07], bone, 'bone');
    for (const s of [-1, 1]) c.sc.eye(add(head, [0.09, 0.02, s * 0.05]), 0.025, v.c3, { slit: false });
    return;
  }
  const pelvis: V3 = [0, 0.6, 0];
  for (const s of [-1, 1]) leg(c, add(pelvis, [0, 0, s * 0.1]), 0.6, 0.035, s > 0 ? Math.PI : 0, { col: bone, mat: 'bone' });
  sc.ell(pelvis, [0.12, 0.07, 0.15], bone, 'bone');
  // colonne
  const spine: V3[] = [pelvis, [0.03, 0.8, 0], [0.06, 1.0, 0], [0.08, 1.15, 0]];
  sc.chain(spine, [0.03, 0.03, 0.028, 0.025], bone, 'bone');
  for (let i = 0; i < 5; i++) {
    const y = 1.08 - i * 0.07, w = 0.17 - Math.abs(i - 1.5) * 0.02;
    for (const s of [-1, 1]) sc.chain([[0.06, y, 0], [0.13, y - 0.03, s * w * 0.8], [0.2, y - 0.07, s * w * 0.3]], [0.016, 0.014, 0.012], bone, 'bone', { hard: true });
  }
  sc.ell([0.12, 0.95, 0], [0.1, 0.16, 0.12], mix(v.c3, '#000000', 0.7), 'glow');
  for (let i = 0; i < v.spikes; i++) sc.spike([0.02, 0.85 + i * 0.03, 0], [-1, 0.4, (i % 2 ? 1 : -1) * 0.5], 0.12, 0.02, bone);
  // bras + arme
  const sh = (s: number): V3 => [0.08, 1.12, s * 0.16];
  const elL: V3 = [0.12, 0.9, -0.2], hdL: V3 = [0.22, 0.75, -0.18];
  sc.cap(sh(-1), elL, 0.022, 0.02, bone, 'bone').cap(elL, hdL, 0.02, 0.016, bone, 'bone');
  const elR: V3 = [0.22 + a * 0.1, 1.0 + a * 0.15, 0.2], hdR: V3 = [0.35 + a * 0.25, 0.92 + a * 0.2, 0.18];
  sc.cap(sh(1), elR, 0.022, 0.02, bone, 'bone').cap(elR, hdR, 0.02, 0.016, bone, 'bone');
  sc.cap(add(hdR, [0, -0.35, 0]), add(hdR, [0, 0.4, 0]), 0.018, 0.016, '#4a3a2a', 'wood');
  sc.ell(add(hdR, [0.15, 0.38, 0]), [0.2, 0.05, 0.015], '#c8c0b0', 'metal', { rot: -0.4, hard: true });
  const head: V3 = [0.12, 1.3, 0];
  sc.ell(head, [0.13, 0.13, 0.12], bone, 'bone');
  sc.ell(add(head, [0.07, -0.11, 0]), [0.08, 0.05 + p.attack * 0.03, 0.08], bone, 'bone');
  for (const s of [-1, 1]) sc.ell(add(head, [0.1, 0.01, s * 0.05]), [0.03, 0.04, 0.035], '#0a0406', 'dark', { hard: true });
  hornsOn(c, v.horns, head, 0.13);
  for (const s of [-1, 1]) c.sc.eye(add(head, [0.12, 0.01, s * 0.05]), 0.02, v.c3, { slit: false });
  if (v.eyes > 2) c.sc.eye(add(head, [0.12, 0.09, 0]), 0.018, v.c3);
}

function hulk(c: Ctx): void {
  const { sc, v, p, rng } = c;
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const sway = Math.sin(p.t * (p.moving ? 4 : 1.5)) * 0.03;
  for (let i = 0; i < v.tentacles; i++) {
    const ang = (i / Math.max(1, v.tentacles)) * TAU;
    tentacle(c, [Math.cos(ang) * 0.3, 0.3, Math.sin(ang) * 0.3], [Math.cos(ang), -0.4, Math.sin(ang)], 0.55, 0.09, i * 1.7, mix(v.c1, '#000000', 0.2));
  }
  for (const s of [-1, 1]) sc.ell([sway, 0.14, s * 0.3], [0.18, 0.15, 0.16], mix(v.c1, '#000000', 0.35), c.mat);
  const body: V3 = [sway, 0.6, 0];
  sc.ell(body, [0.55, 0.5, 0.5], v.c1, c.mat, { col2: mix(v.c1, '#000000', 0.35) });
  for (let i = 0; i < 9; i++) {
    const ang = rng.range(0, TAU), el = rng.range(-0.6, 0.9);
    sc.ell([body[0] + Math.cos(ang) * 0.38 * Math.cos(el), body[1] + Math.sin(el) * 0.4, Math.sin(ang) * 0.38], [0.2, 0.17, 0.2], mix(v.c1, v.c2, rng.range(0, 0.35)), c.mat);
  }
  spikesOn(c, v.spikes, body, [0.52, 0.48, 0.45], 0.24, 0.2, 0.9);
  maw(c, add(body, [0.5, -0.05, 0]), 0.6, p.attack, 10);
  hornsOn(c, v.horns, add(body, [0.3, 0.35, 0]), 0.2);
  eyes(c, v.eyes, add(body, [0.45, 0.25, 0]), 0.3, 0.045);
  // bras écrasant
  const sh: V3 = add(body, [-0.05, 0.2, -0.42]);
  const el: V3 = [sh[0] + 0.35 + a * 0.1, sh[1] + 0.05 + a * 0.3, -0.62];
  const fist: V3 = [el[0] + 0.25 + a * 0.15, Math.max(0.15, el[1] - 0.45 + a * 0.1), -0.55];
  sc.cap(sh, el, 0.18, 0.15, v.c1, c.mat).cap(el, fist, 0.15, 0.17, v.c1, c.mat);
  for (let k = 0; k < 3; k++) sc.spike(add(fist, [0.12, 0, (k - 1) * 0.08]), [1, -0.3, 0], 0.12, 0.04, c.bone);
}

function priest(c: Ctx): void {
  const { sc, v, p } = c;
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const sway = Math.sin(p.t * 2) * 0.015;
  for (let i = 0; i < v.tentacles; i++) tentacle(c, [-0.1 + (i % 3) * 0.1, 0.08, -0.15 + (i % 4) * 0.1], [0.3, -0.3, 0.5], 0.3, 0.04, i, mix(v.c1, '#000000', 0.3));
  // robe en strates
  for (let i = 0; i < 6; i++) {
    const y = 0.12 + i * 0.16, r = 0.36 - i * 0.045;
    sc.ell([sway * i, y, 0], [r, 0.14, r * 0.95], mix(v.c1, '#000000', 0.4 - i * 0.06), 'cloth');
  }
  for (let i = 0; i < 7; i++) sc.cap([0.3 * Math.cos(i), 0.05, 0.3 * Math.sin(i)], [0.18 * Math.cos(i), 0.6, 0.18 * Math.sin(i)], 0.02, 0.015, mix(v.c1, '#000000', 0.5), 'cloth');
  for (let i = 0; i < v.spikes; i++) sc.spike([0, 0.95, -0.1 + i * 0.1], [-0.4, 1, 0], 0.12, 0.02, c.bone);
  // bâton + orbe
  const hand: V3 = [0.25 + a * 0.08, 0.75, 0.25];
  sc.cap([0.2, 0.75, 0.15], hand, 0.05, 0.04, v.c1, 'cloth');
  sc.cap([0.28 + a * 0.05, 0.02, 0.26], [0.32 + a * 0.08, 1.35 + a * 0.08, 0.26], 0.022, 0.018, '#3a2a1e', 'wood');
  sc.ell([0.33 + a * 0.08, 1.42 + a * 0.08, 0.26], [0.06 + a * 0.03, 0.06 + a * 0.03, 0.06], v.c3, 'glow');
  sc.overlay(true, (g, toS, S) => {
    const [x, y] = toS([0.33 + a * 0.08, 1.42 + a * 0.08, 0.26]);
    const gr = g.createRadialGradient(x, y, 0, x, y, S * (0.25 + a * 0.2));
    gr.addColorStop(0, mix(v.c3, '#ffffff', 0.5).replace('rgb', 'rgba').replace(')', ',0.6)'));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - S, y - S, S * 2, S * 2);
  });
  // capuche et visage dans l'ombre
  const head: V3 = [0.05 + sway * 6, 1.08, 0];
  sc.ell(head, [0.17, 0.2, 0.17], v.c1, 'cloth');
  sc.ell(add(head, [0.03, 0.15, 0]), [0.1, 0.12, 0.12], v.c1, 'cloth', { rot: 0.4 });
  sc.ell(add(head, [0.11, -0.02, 0]), [0.08, 0.13, 0.11], '#08040a', 'dark', { k: 0.02 });
  hornsOn(c, v.horns, head, 0.15);
  if (v.eyes === 0) {
    for (let i = 0; i < 5; i++) sc.cap(add(head, [0.18, -0.05, -0.06 + i * 0.03]), add(head, [0.18, -0.14, -0.06 + i * 0.03]), 0.008, 0.004, v.c3, 'glow');
  } else eyes(c, Math.min(v.eyes, 6), add(head, [0.16, 0, 0]), v.eyes > 4 ? 0.08 : 0.06, v.eyes > 4 ? 0.018 : 0.025);
  if (v.eyes > 6) for (let i = 0; i < 7; i++) c.sc.eye([0.3 - (i % 3) * 0.06, 0.25 + i * 0.09, -0.15 + (i % 4) * 0.1 + 0.25], 0.02, v.c3);
}

function leech(c: Ctx): void {
  const { sc, v, p } = c;
  const wave = p.t * (p.moving ? 6 : 2);
  for (let i = 0; i < 7; i++) {
    const x = -0.5 + i * 0.15;
    const y = 0.16 + Math.max(0, Math.sin(wave - i * 0.6)) * 0.1 + (i === 6 ? p.attack * 0.1 : 0);
    const r = 0.12 + Math.sin((i / 6) * Math.PI) * 0.08;
    sc.ell([x, y, 0], [0.1, r, r], i % 2 ? v.c1 : mix(v.c1, '#000000', 0.15), 'abyss');
    sc.ell([x, y + r * 0.7, 0], [0.05, 0.02, r * 0.5], v.c3, 'abyss');
  }
  const mouth: V3 = [0.48, 0.18 + p.attack * 0.1, 0];
  sc.ell(mouth, [0.04, 0.12, 0.12], '#250608', 'dark');
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; sc.spike(add(mouth, [0.02, Math.sin(a) * 0.1, Math.cos(a) * 0.1]), [0.3, -Math.sin(a), -Math.cos(a)], 0.06, 0.012, '#efe3c8', 'tooth'); }
}

function mech(c: Ctx): void {
  const { sc, v, p } = c;
  const variant = v.variant ?? 0;
  const chassis = variant % 3, weapon = Math.floor(variant / 3);
  const iron = v.c2, rust = v.c1;
  const a = p.attack > 0 ? Math.sin(p.attack * Math.PI) : 0;
  const bob = p.moving ? Math.abs(Math.sin(p.t * 7)) * 0.03 : 0;
  const legs = v.limbs >= 4 ? 4 : 2;
  for (let i = 0; i < legs; i++) {
    const s = i % 2 ? 1 : -1, off = legs === 4 ? (i < 2 ? -0.15 : 0.15) : 0;
    leg(c, [off, 0.5 + bob, s * 0.15], 0.5, 0.06, i * Math.PI * 0.9, { col: iron, mat: 'metal', knee: -0.5 });
  }
  const body: V3 = [0, 0.82 + bob, 0];
  if (chassis === 0) sc.ell(body, [0.3, 0.28, 0.26], rust, 'rust', { p: 5 });
  else if (chassis === 1) { sc.ell(body, [0.28, 0.3, 0.26], rust, 'rust'); for (const s of [-1, 1]) sc.ell(add(body, [0, 0.2, s * 0.28]), [0.14, 0.1, 0.12], iron, 'metal'); }
  else { sc.ell(body, [0.22, 0.3, 0.22], rust, 'rust', { p: 3 }); for (let i = 0; i < 3; i++) sc.ell(add(body, [0, -0.18 + i * 0.18, 0]), [0.235, 0.025, 0.235], iron, 'metal', { hard: true }); }
  for (let i = 0; i < 6; i++) sc.ell(add(body, [0.2, -0.15 + Math.floor(i / 2) * 0.15, (i % 2 ? 1 : -1) * 0.12]), [0.022, 0.022, 0.022], '#c8c0b0', 'metal', { hard: true });
  // chair à vif visible sous les plaques
  sc.ell(add(body, [0.18, -0.02, 0]), [0.1, 0.07, 0.1], '#8e2a2e', 'flesh');
  // tuyaux et vapeur
  sc.chain([add(body, [-0.2, 0.15, -0.1]), add(body, [-0.35, 0.35, -0.1]), add(body, [-0.15, 0.48, -0.08])], [0.035, 0.035, 0.03], iron, 'metal');
  sc.overlay(false, (g, toS, S) => {
    for (let k = 0; k < 3; k++) {
      const [x, y] = toS(add(body, [-0.15 - k * 0.05, 0.55 + ((p.t * 0.4 + k * 0.3) % 0.6), -0.08]));
      g.fillStyle = `rgba(210,210,220,${0.18 - k * 0.04})`;
      g.beginPath(); g.arc(x, y, S * (0.06 + k * 0.03), 0, TAU); g.fill();
    }
  });
  spikesOn(c, v.spikes, body, [0.3, 0.28, 0.26], 0.14);
  const sh: V3 = add(body, [0.05, 0.12, 0.3]);
  const hand: V3 = [0.45 + a * 0.12, body[1] - 0.02, 0.32];
  sc.cap(sh, hand, 0.06, 0.05, iron, 'metal');
  if (weapon === 0) sc.ell(add(hand, [0.12, 0, 0]), [0.16, 0.07, 0.07], iron, 'metal', { p: 4 });
  else if (weapon === 1) sc.ell(add(hand, [0.12, 0.2 - a * 0.15, 0]), [0.03, 0.3, 0.012], '#cfc8bc', 'metal', { rot: -0.3 + a, hard: true });
  else if (weapon === 2) sc.cap(hand, add(hand, [0.5, 0.02, 0]), 0.035, 0.03, '#2a2a2e', 'metal');
  else if (weapon === 3) { for (let k = 0; k < 4; k++) sc.ell(add(hand, [0.05, 0.08 + k * 0.07, 0]), [0.07, 0.02, 0.07], k % 2 ? v.c3 : '#b07a3a', k % 2 ? 'glow' : 'metal', { hard: true }); }
  else sc.ell(add(hand, [0.08, 0, 0]), [0.13, 0.13, 0.13], iron, 'metal', { p: 3 });
  if (a > 0.3 && weapon !== 1 && weapon !== 4) sc.ell(add(hand, [weapon === 2 ? 0.55 : 0.3, 0, 0]), [0.06, 0.06, 0.06], v.c3, 'glow');
  sc.cap(add(body, [0.05, 0.12, -0.3]), [0.15, body[1] - 0.25, -0.32], 0.055, 0.05, iron, 'metal');
  const head: V3 = add(body, [0.06, 0.4, 0]);
  sc.ell(head, [0.15, 0.13, 0.14], iron, 'metal', { p: 3 });
  hornsOn(c, v.horns, head, 0.12);
  eyes(c, v.eyes, add(head, [0.14, 0, 0]), 0.08, 0.035);
}

function jelly(c: Ctx): void {
  const { sc, v, p } = c;
  const hy = 1.05 + Math.sin(p.t * 1.5) * 0.06;
  const pulse = 1 + Math.sin(p.t * 3) * 0.08;
  for (let i = 0; i < v.tentacles; i++) {
    const ang = (i / v.tentacles) * TAU;
    tentacle(c, [Math.cos(ang) * 0.25, hy - 0.1, Math.sin(ang) * 0.25], [0.05, -1, 0], 0.65, 0.025, i * 0.8, v.c3, 'abyss');
  }
  sc.ell([0, hy, 0], [0.42 * pulse, 0.3, 0.42 * pulse], mix(v.c1, v.c3, 0.3), 'abyss', { col2: mix(v.c2, '#000000', 0.3) });
  sc.ell([0, hy + 0.05, 0], [0.18, 0.12, 0.18], mix(v.c3, '#ffffff', 0.3), 'glow');
  for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU; sc.ell([Math.cos(ang) * 0.4 * pulse, hy - 0.18, Math.sin(ang) * 0.4 * pulse], [0.06, 0.04, 0.06], mix(v.c1, v.c3, 0.5), 'abyss'); }
  if (v.eyes > 0) eyes(c, v.eyes, [0.3, hy, 0], 0.15, 0.03);
}

// ----------------------------------------------------------------- structures
function towerB(c: Ctx): void {
  const { sc, v, p } = c;
  sc.ell([0, 0.06, 0], [0.48, 0.1, 0.48], '#2a2224', 'stone');
  sc.chain([[0, 0.05, 0], [0, 0.45, 0], [0.02, 0.85, 0], [0, 1.15, 0]], [0.3, 0.24, 0.2, 0.17], v.c1, 'chitin', { col2: mix(v.c1, '#000000', 0.4) });
  for (let i = 0; i < 4; i++) sc.ell([0, 0.25 + i * 0.22, 0], [0.3 - i * 0.03, 0.04, 0.3 - i * 0.03], v.c2, 'chitin');
  for (let i = 0; i < v.spikes; i++) { const ang = (i / v.spikes) * TAU; sc.spike([Math.cos(ang) * 0.15, 1.15, Math.sin(ang) * 0.15], [Math.cos(ang), 1.2, Math.sin(ang)], 0.3, 0.05, c.bone); }
  c.sc.eye([0.18, 0.75, 0.05], 0.08, v.c3, { look: Math.sin(p.t) });
  if (p.attack > 0) sc.ell([0, 1.25, 0], [0.07, 0.07, 0.07], v.c3, 'glow');
}

function nest(c: Ctx): void {
  const { sc, v, p, rng } = c;
  const pulse = 1 + Math.sin(p.t * 2.5) * 0.05;
  sc.ell([0, 0.05, 0], [0.55, 0.08, 0.5], mix(v.c1, '#000000', 0.5), 'flesh');
  sc.ell([0, 0.42, 0], [0.45 * pulse, 0.42 / pulse, 0.42 * pulse], v.c1, 'flesh', { col2: mix(v.c1, '#000000', 0.4) });
  for (let i = 0; i < 7; i++) { const ang = rng.range(0, TAU); sc.ell([Math.cos(ang) * 0.3, rng.range(0.2, 0.65), Math.sin(ang) * 0.3], [0.18, 0.16, 0.18], mix(v.c1, v.c2, rng.range(0, 0.4)), 'flesh'); }
  for (let i = 0; i < 3; i++) {
    const pos: V3 = [0.35, 0.3 + i * 0.15, -0.2 + i * 0.2];
    sc.ell(pos, [0.04, 0.07, 0.07], '#1a0507', 'dark', { k: 0.02 });
    sc.ell(add(pos, [0.01, 0, 0]), [0.02, 0.035, 0.035], v.c3, 'glow');
  }
}

function trap(c: Ctx): void {
  const { sc, v, p } = c;
  const open = 1 - p.attack;
  sc.ell([0, 0.04, 0], [0.42, 0.05, 0.42], '#2a2420', 'stone');
  for (const s of [-1, 1]) {
    const ang = s * (0.15 + open * 1.1);
    const cy = Math.cos(ang), sz = Math.sin(ang);
    sc.ell([0, 0.06 + Math.abs(sz) * 0.05, sz * 0.18], [0.4, 0.04 + cy * 0.04, 0.2], v.c1, 'rust', { p: 3 });
    for (let k = 0; k < v.spikes / 2; k++) sc.spike([-0.32 + k * 0.13, 0.1, sz * 0.36], [0, cy, -s * 0.6], 0.12, 0.025, '#d8d0c0', 'metal');
  }
  sc.ell([0, 0.08, 0], [0.08, 0.04, 0.08], v.c2, 'metal');
}

function pump(c: Ctx): void {
  const { sc, v, p } = c;
  const pm = Math.sin(p.t * 3);
  sc.ell([0, 0.06, 0], [0.5, 0.1, 0.5], mix(v.c2, '#000000', 0.3), 'stone');
  for (let i = 0; i < v.tentacles; i++) tentacle(c, [Math.cos(i * 2.1) * 0.3, 0.1, Math.sin(i * 2.1) * 0.3], [Math.cos(i * 2.1), -0.2, Math.sin(i * 2.1)], 0.35, 0.07, i, v.c1, 'abyss');
  sc.ell([0, 0.45, 0], [0.3, 0.45, 0.3], v.c1, 'abyss', { p: 3 });
  for (let i = 0; i < 3; i++) sc.ell([0, 0.25 + i * 0.2, 0], [0.32, 0.03, 0.32], v.c2, 'metal', { hard: true });
  sc.ell([0, 0.62, 0.05], [0.18 + pm * 0.02, 0.18 + pm * 0.02, 0.18], mix(v.c3, '#ffffff', 0.4), 'glow');
  sc.overlay(true, (g, toS, S) => {
    const [x, y] = toS([0, 0.62, 0.05]);
    const gr = g.createRadialGradient(x, y, 0, x, y, S * 0.45);
    gr.addColorStop(0, 'rgba(160,255,250,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - S, y - S, S * 2, S * 2);
  });
  c.sc.eye([0.05, 1.0, 0.1], 0.06, v.c3);
}

function brazier(c: Ctx): void {
  const { sc, v, p, rng } = c;
  sc.ell([0, 0.06, 0], [0.45, 0.08, 0.45], '#2a2220', 'stone');
  for (let i = 0; i < 14; i++) {
    const y = rng.range(0.08, 0.5), w = 0.4 * (1 - y);
    const a: V3 = [rng.range(-w, w), y, rng.range(-w, w)];
    const ang = rng.range(0, TAU);
    sc.cap(add(a, [Math.cos(ang) * -0.15, 0, Math.sin(ang) * -0.15]), add(a, [Math.cos(ang) * 0.15, rng.range(-0.05, 0.05), Math.sin(ang) * 0.15]), 0.03, 0.03, v.c1, 'bone');
  }
  for (let i = 0; i < 3; i++) {
    const sk: V3 = [(i - 1) * 0.16, 0.45 + (i % 2) * 0.08, 0.1];
    sc.ell(sk, [0.08, 0.075, 0.08], v.c1, 'bone');
    for (const s of [-1, 1]) sc.ell(add(sk, [0.05, 0, s * 0.03]), [0.02, 0.025, 0.02], '#0a0406', 'dark', { hard: true });
  }
  sc.overlay(true, (g, toS, S) => {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      const [x, y] = toS([(k - 2.5) * 0.08, 0.55, 0.05]);
      const hgt = S * (0.4 + 0.15 * Math.sin(p.t * 9 + k * 2) + p.attack * 0.3);
      const gr = g.createLinearGradient(x, y, x, y - hgt);
      gr.addColorStop(0, 'rgba(255,170,60,0.85)'); gr.addColorStop(0.5, 'rgba(255,90,20,0.55)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(x - S * 0.07, y); g.quadraticCurveTo(x + Math.sin(p.t * 7 + k) * S * 0.08, y - hgt * 0.6, x, y - hgt); g.quadraticCurveTo(x + S * 0.04, y - hgt * 0.4, x + S * 0.07, y); g.fill();
    }
    g.restore();
  });
}

const PLANS: Record<string, (c: Ctx) => void> = {
  worm: (c) => serpentWorm(c), biped: (c) => biped(c), brute, quadruped, insect, mantis, spider, crab, serpent,
  fly, eye: eyeCreature, floater: eyeCreature, winged, blob, skeletal, hulk, priest, leech, mech, jelly,
  tower: towerB, nest, trap, pump, brazier,
};

/** Ver segmenté (larves) : version 3D. */
function serpentWorm(c: Ctx): void {
  const { sc, v, p } = c;
  const wave = p.moving ? p.t * 8 : p.t * 2;
  for (let i = 0; i < 6; i++) {
    const x = -0.45 + i * 0.16;
    const y = 0.17 + Math.abs(Math.sin(wave * 0.5 + i)) * 0.05 + (i === 5 ? p.attack * 0.12 : 0);
    const r = 0.17 - Math.abs(i - 3) * 0.015;
    sc.ell([x, y, Math.sin(wave + i * 0.9) * 0.05], [0.11, r, r], i % 2 ? v.c1 : mix(v.c1, '#000000', 0.18), c.mat);
  }
  for (let i = 0; i < v.spikes; i++) sc.spike([-0.3 + i * 0.15, 0.3, 0], [0, 1, 0.3], 0.1, 0.02, c.bone);
  const mouth: V3 = [0.42, 0.2 + p.attack * 0.12, 0];
  sc.ell(mouth, [0.05, 0.11, 0.11], '#2a0508', 'dark');
  for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; sc.spike(add(mouth, [0.03, Math.sin(a) * 0.08, Math.cos(a) * 0.08]), [0.4, -Math.sin(a), -Math.cos(a)], 0.06, 0.014, '#efe3c8', 'tooth'); }
}

export function buildCreature(v: Visual, pose: Pose): Sculpt {
  const sc = new Sculpt();
  const ctx: Ctx = {
    sc, v, p: pose, rng: new Rng(v.seed), mat: matOf(v),
    dark: mix(v.c1, '#000000', 0.35), light: mix(v.c2, '#ffffff', 0.1), bone: '#ddd2bb',
  };
  (PLANS[v.plan] ?? blob)(ctx);
  // les créatures volumineuses sont vues un peu plus de profil
  if (['tower', 'nest', 'trap', 'pump', 'brazier'].includes(v.plan)) { sc.yaw = 0.3; sc.pitch = 0.5; }
  return sc;
}

/** Hauteur maximale approximative (en unités) pour dimensionner les canevas. */
export function planHeight(v: Visual): number {
  return ['winged', 'eye', 'floater', 'jelly', 'fly'].includes(v.plan) ? 1.75 : v.plan === 'mantis' || v.plan === 'skeletal' || v.plan === 'priest' ? 1.6 : 1.45;
}
