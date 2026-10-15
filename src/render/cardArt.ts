// Illustrations de cartes générées à partir du MÊME modèle procédural que l'unité en combat.
import { CARD_MAP, FACTION_PALETTE, cardPrimaryUnit } from '../core/cards';
import { RARITY_INFO } from '../core/progression';
import { Rng } from '../core/rng';
import type { CardDef } from '../core/types';
import { alpha, isFlyingPlan, shade } from './sprites';
import { buildCreature } from './anatomy';
import { renderSculpt } from './sculpt';

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
      for (let i = 0; i < 26; i++) {
        const x = rng.range(0.1, 0.9) * w, y = rng.range(0.1, 0.8) * h, a = Math.PI / 2 + rng.range(-0.3, 0.3);
        ctx.fillStyle = shade(pal.c2, rng.range(-0.2, 0.2));
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(-w * 0.012, -h * 0.07); ctx.lineTo(w * 0.012, -h * 0.07); ctx.lineTo(0, h * 0.05); ctx.fill(); ctx.restore();
      }
      break;
    case 'brume_terreur': {
      for (let i = 0; i < 30; i++) {
        const x = rng.range(0, 1) * w, y = rng.range(0.3, 1) * h, r = rng.range(0.1, 0.3) * w;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, alpha('#9fe8ff', 0.18)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      // visage hurlant dans la brume
      ctx.fillStyle = alpha('#d8f6ff', 0.55);
      ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.08, w * 0.2, h * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#04080c';
      ctx.beginPath(); ctx.ellipse(cx - w * 0.08, cy - h * 0.14, w * 0.045, h * 0.06, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + w * 0.08, cy - h * 0.14, w * 0.045, h * 0.06, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.04, w * 0.06, h * 0.11, 0, 0, Math.PI * 2); ctx.fill();
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
      // main noyée
      ctx.fillStyle = '#b8a888'; ctx.beginPath(); ctx.moveTo(cx - w * 0.05, h * 0.72); ctx.lineTo(cx - w * 0.06, h * 0.5); ctx.lineTo(cx + w * 0.04, h * 0.48); ctx.lineTo(cx + w * 0.05, h * 0.72); ctx.fill();
      for (let k = 0; k < 4; k++) { ctx.fillRect(cx - w * 0.06 + k * w * 0.028, h * (0.38 + (k % 2) * 0.02), w * 0.018, h * 0.1); }
      break;
    case 'sceau_os':
      ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = w * 0.025;
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.28, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.28, cy + Math.sin(a) * w * 0.28); ctx.lineTo(cx + Math.cos(a + Math.PI * 0.66) * w * 0.28, cy + Math.sin(a + Math.PI * 0.66) * w * 0.28); ctx.stroke();
      }
      ctx.save(); ctx.shadowColor = pal.c3; ctx.shadowBlur = w * 0.15; ctx.fillStyle = alpha(pal.c3, 0.8);
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      break;
    case 'fosse_vorace':
      for (let r = 10; r > 0; r--) {
        ctx.fillStyle = r % 2 ? shade(pal.c2, -0.3 - r * 0.04) : shade(pal.c1, -0.2 - r * 0.05);
        ctx.beginPath(); ctx.ellipse(cx + Math.sin(r) * w * 0.01, cy, w * 0.045 * r, h * 0.025 * r, r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#efe6cf';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * w * 0.42, cy + Math.sin(a) * h * 0.24); ctx.lineTo(cx + Math.cos(a + 0.1) * w * 0.32, cy + Math.sin(a + 0.1) * h * 0.18); ctx.lineTo(cx + Math.cos(a + 0.2) * w * 0.42, cy + Math.sin(a + 0.2) * h * 0.24); ctx.fill(); }
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
  } else spellArt(ctx, card, w, h, rng);
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
