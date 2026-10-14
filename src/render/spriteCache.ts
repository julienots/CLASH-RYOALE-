// Cache d'images d'animation : chaque créature est rendue une fois par image clé et par taille,
// puis simplement recopiée (drawImage) à chaque frame. Indispensable sur mobile modeste.
import type { Visual } from '../core/types';
import { drawMonster } from './sprites';

export type AnimKind = 'idle' | 'walk' | 'attack';
export type SpriteVariant = 'normal' | 'flash' | 'ghost';

const FRAMES: Record<AnimKind, number> = { idle: 8, walk: 8, attack: 5 };
const PERIOD: Record<AnimKind, number> = { idle: 2.4, walk: 0.7, attack: 1 };
const MAX_ENTRIES = 900;

const cache = new Map<string, HTMLCanvasElement>();
export let cacheMisses = 0;

function render(v: Visual, kind: AnimKind, frame: number, px: number, variant: SpriteVariant): HTMLCanvasElement {
  const s = px * v.scale;
  const w = Math.ceil(s * 2.6) + 4, h = Math.ceil(s * 2.6) + 4;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.translate(w / 2, s * 2.3);
  const t = kind === 'attack' ? 0.3 : (frame / FRAMES[kind]) * PERIOD[kind];
  const attack = kind === 'attack' ? (frame + 0.5) / FRAMES.attack : 0;
  drawMonster(g, v, { t, moving: kind === 'walk', attack }, px);
  if (variant !== 'normal') {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = variant === 'flash' ? 'rgba(255,255,255,0.65)' : 'rgba(20,16,24,0.55)';
    g.fillRect(0, 0, w, h);
  }
  return c;
}

/**
 * Dessine une créature depuis le cache. (x, y) = point de contact au sol, en pixels du contexte cible.
 * `t` = temps de l'entité ; `attack` = progression de l'attaque (0 = aucune).
 */
export function drawCachedMonster(ctx: CanvasRenderingContext2D, v: Visual, x: number, y: number, px: number, t: number, moving: boolean, attack: number, flip: boolean, variant: SpriteVariant = 'normal'): void {
  const kind: AnimKind = attack > 0 ? 'attack' : moving ? 'walk' : 'idle';
  const frame = kind === 'attack'
    ? Math.min(FRAMES.attack - 1, Math.floor(attack * FRAMES.attack))
    : Math.floor(((t % PERIOD[kind]) / PERIOD[kind]) * FRAMES[kind]) % FRAMES[kind];
  const pxr = Math.max(4, Math.round(px));
  const key = `${v.seed}|${kind}|${frame}|${pxr}|${variant}`;
  let img = cache.get(key);
  if (!img) {
    if (cache.size >= MAX_ENTRIES) cache.clear();
    img = render(v, kind, frame, pxr, variant);
    cache.set(key, img);
    cacheMisses++;
  }
  const s = pxr * v.scale;
  if (flip) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, -s * 2.3);
    ctx.restore();
  } else ctx.drawImage(img, x - img.width / 2, y - s * 2.3);
}

export function clearSpriteCache(): void { cache.clear(); }
export function spriteCacheSize(): number { return cache.size; }
