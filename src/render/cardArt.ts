// Illustrations de cartes générées à partir du MÊME modèle procédural que l'unité en combat.
import { CARD_MAP, FACTION_PALETTE, cardPrimaryUnit } from '../core/cards';
import { RARITY_INFO } from '../core/progression';
import { Rng } from '../core/rng';
import type { CardDef } from '../core/types';
import { alpha, isFlyingPlan, shade } from './sprites';
import { buildCreature } from './anatomy';
import { mix, renderSculpt, Sculpt, type V3 } from './sculpt';

const cache = new Map<string, string>();

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function background(ctx: CanvasRenderingContext2D, card: CardDef, w: number, h: number, rng: Rng): void {
  const pal = FACTION_PALETTE[card.faction];
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.05, w * 0.5, h * 0.5, h * 0.8);
  g.addColorStop(0, shade(pal.c1, -0.2));
  g.addColorStop(0.5, shade(pal.c2, -0.6));
  g.addColorStop(1, '#050306');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // brume
  for (let i = 0; i < 14; i++) {
    const x = rng.range(-0.2, 1.2) * w, y = rng.range(0.2, 1) * h, r = rng.range(0.15, 0.45) * w;
    const fg = ctx.createRadialGradient(x, y, 0, x, y, r);
    fg.addColorStop(0, alpha(pal.c3, rng.range(0.03, 0.09)));
    fg.addColorStop(1, alpha(pal.c3, 0));
    ctx.fillStyle = fg; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // cercle rituel derrière la créature
  ctx.save();
  ctx.translate(w / 2, h * 0.5);
  ctx.strokeStyle = alpha(pal.c3, 0.22); ctx.lineWidth = Math.max(1, w * 0.006);
  ctx.beginPath(); ctx.arc(0, 0, w * 0.38, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, w * 0.31, 0, Math.PI * 2); ctx.stroke();
  const n = 5 + (rng.int(0, 3));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = ((i + 2) / n) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * w * 0.38, Math.sin(a) * w * 0.38); ctx.lineTo(Math.cos(b) * w * 0.38, Math.sin(b) * w * 0.38); ctx.stroke();
    ctx.fillStyle = alpha(pal.c3, 0.3);
    ctx.font = `${Math.round(w * 0.05)}px serif`;
    ctx.fillText('ᚱᛟᚦᛉᛞᚹᛜ'[i % 7], Math.cos(a + 0.3) * w * 0.345 - w * 0.015, Math.sin(a + 0.3) * w * 0.345 + w * 0.015);
  }
  ctx.restore();
  if (card.rarity === 'legendaire' || card.rarity === 'abyssal') {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const col = RARITY_INFO[card.rarity].color;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + rng.range(-0.9, 0.9);
      const rg = ctx.createLinearGradient(w / 2, h * 0.1, w / 2 + Math.cos(a) * h, h * 0.1 + Math.sin(a) * h);
      rg.addColorStop(0, alpha(col, 0.18)); rg.addColorStop(1, alpha(col, 0));
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(w / 2, -h * 0.1);
      ctx.lineTo(w / 2 + Math.cos(a + 0.06) * h * 1.4, -h * 0.1 - Math.sin(a + 0.06) * h * 1.4 * -1);
      ctx.lineTo(w / 2 + Math.cos(a - 0.06) * h * 1.4, -h * 0.1 - Math.sin(a - 0.06) * h * 1.4 * -1);
      ctx.fill();
    }
    ctx.restore();
  }
}

function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.65)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.save(); ctx.scale(1, 0.3); ctx.beginPath(); ctx.arc(x, y / 0.3, rx, 0, Math.PI * 2); ctx.restore(); ctx.fill();
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng): void {
  const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  // grain
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let i = 0; i < (w * h) / 180; i++) ctx.fillRect(rng.range(0, w), rng.range(0, h), 1, 1);
}

function spellArt(ctx: CanvasRenderingContext2D, card: CardDef, w: number, h: number, rng: Rng): void {
  const pal = FACTION_PALETTE[card.faction];
  const cx = w / 2, cy = h * 0.55;
  ctx.save();
  switch (card.id) {
    case 'pluie_bile':
      for (let i = 0; i < 60; i++) {
        const x = rng.range(0.05, 0.95) * w, y = rng.range(0, 0.85) * h, l = rng.range(0.04, 0.09) * h;
        ctx.strokeStyle = alpha('#c8ff3a', rng.range(0.4, 0.9)); ctx.lineWidth = w * 0.012;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * 0.2, y + l); ctx.stroke();
      }
      ctx.fillStyle = alpha('#9bd12a', 0.6); ctx.beginPath(); ctx.ellipse(cx, h * 0.88, w * 0.4, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b3a0a'; ctx.beginPath(); ctx.ellipse(cx, h * 0.12, w * 0.55, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'salve_epines':
      break;
    case 'brume_terreur': {
      for (let i = 0; i < 30; i++) {
        const x = rng.range(0, 1) * w, y = rng.range(0.3, 1) * h, r = rng.range(0.1, 0.3) * w;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, alpha('#9fe8ff', 0.18)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      break;
    }
    case 'marais_putride':
      ctx.fillStyle = alpha('#3d5a14', 0.9); ctx.beginPath(); ctx.ellipse(cx, h * 0.75, w * 0.48, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 18; i++) {
        const x = cx + rng.range(-0.4, 0.4) * w, y = h * 0.75 + rng.range(-0.12, 0.12) * h, r = rng.range(0.01, 0.04) * w;
        ctx.strokeStyle = alpha('#c6ff4a', 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const x = cx + rng.range(-0.35, 0.35) * w;
        const g = ctx.createLinearGradient(x, h * 0.75, x, h * 0.2);
        g.addColorStop(0, alpha('#a6d93a', 0.4)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - w * 0.05, h * 0.2, w * 0.1, h * 0.55);
      }
      break;
    case 'sceau_os':
      break;
    case 'fosse_vorace':
      break;
    case 'comete_rouille': {
      const g = ctx.createLinearGradient(w, 0, cx, cy);
      g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(1, 'rgba(255,170,60,0.9)');
      ctx.strokeStyle = g; ctx.lineWidth = w * 0.18; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(w * 1.1, -h * 0.1); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.save(); ctx.shadowColor = '#ffb347'; ctx.shadowBlur = w * 0.25;
      ctx.fillStyle = '#7a3b14'; ctx.beginPath(); ctx.arc(cx, cy, w * 0.13, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.arc(cx - w * 0.03, cy - w * 0.03, w * 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = alpha('#ff6a1a', 0.5); ctx.beginPath(); ctx.ellipse(cx, h * 0.9, w * 0.45, h * 0.06, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    default:
      ctx.fillStyle = pal.c3; ctx.beginPath(); ctx.arc(cx, cy, w * 0.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** Dessine l'illustration d'une carte dans un canvas. */
export function renderCardArt(card: CardDef, w: number, h: number, t = 0.4): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d')!;
  const rng = new Rng(card.id.length * 977 + card.cost * 31 + card.name.charCodeAt(0));
  background(ctx, card, w, h, rng);
  const u = cardPrimaryUnit(card);
  if (u) {
    const v = u.visual;
    const flying = isFlyingPlan(v);
    const groundY = flying ? h * 1.0 : h * 0.9;
    const wide = ['brute', 'hulk', 'winged', 'crab', 'quadruped', 'serpent', 'worm', 'leech', 'insect'].includes(v.plan);
    const s = Math.min(h * (flying ? 0.5 : 0.62), w * 0.62) * (wide ? 0.72 : 1);
    const px = s / Math.max(0.55, v.scale) * (v.scale < 0.7 ? 0.75 : 1);
    groundShadow(ctx, w / 2, h * 0.9, s * 0.6);
    const count = card.spawns![0].count;
    // La créature est sculptée en volumes puis éclairée pixel par pixel (même modèle que l'unité en combat).
    const S = px * v.scale;
    const pose = { t, moving: false, attack: card.rarity === 'legendaire' || card.rarity === 'abyssal' ? 0.45 : 0 };
    const layer = renderSculpt(buildCreature(v, pose), w, h, S * (count > 1 ? 0.72 : 1), w / 2, groundY, v.seed, 1.4);
    ctx.save();
    ctx.shadowColor = alpha(v.c3, 0.45); ctx.shadowBlur = w * 0.05;
    if (count > 1) {
      const n = Math.min(count, 4);
      for (let i = n - 1; i >= 0; i--) {
        const ox = (i - (n - 1) / 2) * w * 0.24, oy = (i % 2) * -h * 0.05;
        ctx.save(); ctx.translate(ox, oy);
        if (i % 2) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        ctx.drawImage(layer, 0, 0);
        ctx.restore();
      }
    } else ctx.drawImage(layer, 0, 0);
    ctx.restore();
  } else { spellArt(ctx, card, w, h, rng); spellSculpt(ctx, card, w, h); }
  vignette(ctx, w, h, rng);
  return c;
}

export function cardArtUrl(cardId: string, w = 240, h = 300): string {
  const key = `${cardId}:${w}x${h}`;
  let url = cache.get(key);
  if (!url) {
    url = renderCardArt(CARD_MAP[cardId], w, h).toDataURL('image/png');
    cache.set(key, url);
  }
  return url;
}

/** Version asynchrone : génère les illustrations une par une sans figer l'interface. */
const queue: { key: string; id: string; w: number; h: number; res: ((u: string) => void)[] }[] = [];
let pumping = false;
export function cardArtCached(cardId: string, w = 240, h = 300): string | undefined { return cache.get(`${cardId}:${w}x${h}`); }
export function cardArtAsync(cardId: string, w = 240, h = 300): Promise<string> {
  const key = `${cardId}:${w}x${h}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  return new Promise((res) => {
    const q = queue.find((x) => x.key === key);
    if (q) q.res.push(res); else queue.push({ key, id: cardId, w, h, res: [res] });
    if (!pumping) { pumping = true; setTimeout(pump, 0); }
  });
}
function pump(): void {
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < 30) {
    const j = queue.shift()!;
    const url = cardArtUrl(j.id, j.w, j.h);
    j.res.forEach((r) => r(url));
  }
  if (queue.length) setTimeout(pump, 0); else pumping = false;
}

/** Objets sculptés des sorts, composés par-dessus l'ambiance 2D. */
function spellSculpt(ctx: CanvasRenderingContext2D, card: CardDef, w: number, h: number): void {
  const sc = new Sculpt();
  const S = w * 0.42;
  let ox = w / 2, oy = h * 0.82;
  switch (card.id) {
    case 'comete_rouille': {
      sc.ell([0, 0.9, 0], [0.42, 0.4, 0.4], '#7a4422', 'rust', { col2: '#2a1810' });
      for (let i = 0; i < 6; i++) { const a = i * 1.1; sc.ell([Math.cos(a) * 0.32, 0.9 + Math.sin(a) * 0.3, 0.2], [0.14, 0.12, 0.12], mix('#8a4b22', '#3b3b3f', (i % 3) / 3), 'rust'); }
      sc.ell([-0.15, 0.75, 0.3], [0.12, 0.1, 0.1], '#ffb347', 'glow');
      sc.ell([0.18, 1.05, 0.28], [0.08, 0.06, 0.06], '#ffd27a', 'glow');
      break;
    }
    case 'sceau_os': {
      sc.pitch = 0.9;
      for (let i = 0; i < 16; i++) {
        const a0 = (i / 16) * Math.PI * 2, a1 = ((i + 1) / 16) * Math.PI * 2;
        sc.cap([Math.cos(a0) * 0.7, 0.1, Math.sin(a0) * 0.7], [Math.cos(a1) * 0.7, 0.1, Math.sin(a1) * 0.7], 0.07, 0.07, '#ddd2b8', 'bone');
      }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; sc.spike([Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7], [Math.cos(a), 0.6, Math.sin(a)], 0.28, 0.06, '#e8dcc2', 'bone'); }
      sc.ell([0, 0.25, 0], [0.2, 0.2, 0.2], '#c6a6ff', 'glow');
      oy = h * 0.66;
      break;
    }
    case 'fosse_vorace': {
      sc.pitch = 1.0;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        sc.ell([Math.cos(a) * 0.75, 0.05, Math.sin(a) * 0.75], [0.16, 0.08, 0.16], '#3a2a30', 'flesh');
        sc.spike([Math.cos(a) * 0.68, 0.1, Math.sin(a) * 0.68], [-Math.cos(a), 0.5, -Math.sin(a)], 0.25, 0.05, '#efe3c8', 'tooth');
      }
      sc.ell([0, -0.05, 0], [0.62, 0.02, 0.62], '#050304', 'dark');
      oy = h * 0.6;
      break;
    }
    case 'marais_putride': {
      // main décharnée émergeant du marais
      const base: V3 = [0, 0.05, 0];
      sc.cap(base, [0.02, 0.6, 0], 0.09, 0.07, '#9a8a70', 'bone');
      sc.ell([0.03, 0.72, 0], [0.12, 0.13, 0.06], '#a89878', 'bone');
      for (let k = 0; k < 4; k++) sc.chain([[-0.08 + k * 0.055, 0.82, 0], [-0.1 + k * 0.06, 1.0 + (k % 2) * 0.05, 0.02], [-0.12 + k * 0.065, 1.12 + (k % 2) * 0.06, 0.06]], [0.025, 0.02, 0.012], '#b0a080', 'bone');
      sc.chain([[0.1, 0.72, 0], [0.2, 0.82, 0.04], [0.25, 0.92, 0.08]], [0.025, 0.02, 0.012], '#b0a080', 'bone');
      oy = h * 0.8;
      break;
    }
    case 'brume_terreur': {
      sc.yaw = 1.5; sc.pitch = 0.2;
      sc.ell([0, 1.0, 0], [0.3, 0.46, 0.34], '#b8d0dc', 'bone');
      sc.ell([0.04, 0.5, 0], [0.2, 0.3, 0.24], '#a8c4d0', 'bone');
      for (const s2 of [-1, 1]) {
        sc.ell([0.27, 1.05, s2 * 0.14], [0.05, 0.16, 0.1], '#020406', 'dark', { hard: true, rot: s2 * 0.25 });
        sc.ell([0.22, 0.75, s2 * 0.2], [0.05, 0.1, 0.06], '#7890a0', 'bone');
      }
      sc.ell([0.24, 0.45, 0], [0.05, 0.3, 0.12], '#020406', 'dark', { hard: true });
      for (let k = 0; k < 5; k++) sc.spike([0.27, 0.72, -0.08 + k * 0.04], [0.1, -1, 0], 0.08, 0.015, '#d8d0c0', 'tooth');
      oy = h * 0.85;
      break;
    }
    case 'salve_epines': {
      for (let i = 0; i < 9; i++) sc.spike([-0.6 + (i % 3) * 0.6 + (i * 0.13) % 0.2, 1.6 - Math.floor(i / 3) * 0.45, (i % 2) * 0.2], [0.15, -1, 0], 0.45, 0.06, '#c9b26a', 'chitin');
      oy = h * 0.95;
      break;
    }
    case 'pluie_bile': {
      for (let i = 0; i < 12; i++) sc.ell([-0.7 + (i * 0.37) % 1.4, 0.4 + ((i * 0.53) % 1.2), (i % 3) * 0.1], [0.05, 0.09, 0.05], '#b5ff3a', 'abyss');
      sc.ell([0, 0.04, 0], [0.75, 0.04, 0.35], '#7aa020', 'abyss');
      oy = h * 0.9;
      break;
    }
    default: return;
  }
  const img = renderSculpt(sc, w, h, S, ox, oy, card.cost * 97, 1.3);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = w * 0.03;
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  if (card.id === 'brume_terreur') {
    // le visage se dissout dans la brume
    const fg = ctx.createLinearGradient(0, h * 0.45, 0, h * 0.95);
    fg.addColorStop(0, 'rgba(150,190,210,0)'); fg.addColorStop(1, 'rgba(120,160,180,0.85)');
    ctx.fillStyle = fg; ctx.fillRect(0, h * 0.45, w, h * 0.55);
  }
}
