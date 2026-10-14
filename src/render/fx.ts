// Système de particules avec pool (pas d'allocation en combat) et plafond selon la qualité.

export interface Particle {
  active: boolean;
  x: number; y: number; vx: number; vy: number; g: number;
  life: number; max: number; size: number; grow: number;
  color: string; kind: 'dot' | 'ring' | 'spark' | 'smoke' | 'text' | 'line' | 'shard';
  text?: string; x2?: number; y2?: number; rot?: number;
}

export class FxPool {
  private pool: Particle[] = [];
  cap: number;
  constructor(cap = 600) {
    this.cap = cap;
    for (let i = 0; i < cap; i++) this.pool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 0, max: 1, size: 1, grow: 0, color: '#fff', kind: 'dot' });
  }
  setCap(n: number): void { this.cap = Math.min(n, this.pool.length); }
  spawn(p: Partial<Particle> & { x: number; y: number }): Particle | null {
    let used = 0;
    for (const q of this.pool) if (q.active) used++;
    if (used >= this.cap && p.kind !== 'text') return null;
    const q = this.pool.find((x) => !x.active);
    if (!q) return null;
    Object.assign(q, { vx: 0, vy: 0, g: 0, size: 3, grow: 0, color: '#fff', kind: 'dot', text: undefined, rot: 0 }, p, { active: true, life: p.max ?? 1, max: p.max ?? 1 });
    return q;
  }
  burst(x: number, y: number, n: number, color: string, speed: number, opts: Partial<Particle> = {}): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.3, g: speed * 1.5, max: 0.4 + Math.random() * 0.5, size: 2 + Math.random() * 3, color, ...opts });
    }
  }
  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size += p.grow * dt;
    }
  }
  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      switch (p.kind) {
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, 4 * a);
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        case 'smoke':
          ctx.fillStyle = p.color; ctx.globalAlpha = a * 0.35;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
          break;
        case 'spark':
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke();
          break;
        case 'line':
          ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2!, p.y2!); ctx.stroke();
          break;
        case 'shard':
          ctx.fillStyle = p.color;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot ?? 0) + p.life * 8);
          ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); ctx.restore();
          break;
        case 'text':
          ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3;
          ctx.font = `800 ${Math.round(p.size)}px system-ui, sans-serif`; ctx.textAlign = 'center';
          ctx.strokeText(p.text!, p.x, p.y); ctx.fillText(p.text!, p.x, p.y);
          break;
        default:
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
  clear(): void { for (const p of this.pool) p.active = false; }
  get count(): number { return this.pool.filter((p) => p.active).length; }
}
