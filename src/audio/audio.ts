// Audio 100 % synthétisé (WebAudio) : effets et musique sombre générative, volumes séparés.

type SfxName =
  | 'click' | 'deploy' | 'deployLegend' | 'melee' | 'shoot' | 'hit' | 'death' | 'bigDeath' | 'spell' | 'impact'
  | 'towerDown' | 'victory' | 'defeat' | 'chest' | 'reward' | 'error' | 'essence' | 'special' | 'heartbeat';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private lastPlay = new Map<string, number>();
  mode: 'menu' | 'battle' | 'off' = 'off';

  /** Doit être appelé après une interaction utilisateur (politique des navigateurs). */
  unlock(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.music = this.ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music; this.sfxVol = sfx;
    if (this.music) this.music.gain.value = music * 0.5;
    if (this.sfx) this.sfx.gain.value = sfx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: AudioNode): void {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfx!);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, delay = 0, type: BiquadFilterType = 'lowpass', dest?: AudioNode): void {
    const c = this.ctx; if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest ?? this.sfx!);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  play(name: SfxName, intensity = 1): void {
    if (!this.ctx || this.sfxVol <= 0) return;
    // limitation : pas plus d'un même son toutes les 40 ms
    const now = performance.now();
    if ((this.lastPlay.get(name) ?? 0) > now - 40) return;
    this.lastPlay.set(name, now);
    const v = Math.min(1, intensity);
    switch (name) {
      case 'click': this.tone(520, 0.06, 'triangle', 0.15 * v, 0.6); break;
      case 'error': this.tone(140, 0.18, 'square', 0.12, 0.7); break;
      case 'deploy': this.noise(0.25, 0.25, 600, 2, 0, 'bandpass'); this.tone(90, 0.3, 'sine', 0.35, 0.5); break;
      case 'deployLegend':
        this.tone(55, 1.4, 'sawtooth', 0.25, 0.5); this.tone(82, 1.2, 'sine', 0.3, 1.5, 0.05);
        this.noise(1.2, 0.3, 300, 1, 0); this.tone(660, 0.8, 'sine', 0.08, 0.5, 0.3);
        break;
      case 'melee': this.noise(0.08, 0.25 * v, 1800, 1, 0, 'highpass'); this.tone(160, 0.08, 'square', 0.08 * v, 0.5); break;
      case 'shoot': this.noise(0.1, 0.12 * v, 3000, 3, 0, 'bandpass'); break;
      case 'hit': this.noise(0.06, 0.15 * v, 900, 1); break;
      case 'death': this.tone(220, 0.35, 'sawtooth', 0.12, 0.3); this.noise(0.3, 0.18, 500, 1); break;
      case 'bigDeath': this.tone(110, 0.9, 'sawtooth', 0.2, 0.25); this.noise(0.8, 0.3, 300, 1); break;
      case 'spell': this.noise(0.6, 0.18, 1200, 4, 0, 'bandpass'); this.tone(300, 0.6, 'sine', 0.1, 2); break;
      case 'impact': this.noise(0.5, 0.45, 250, 1); this.tone(60, 0.5, 'sine', 0.4, 0.4); break;
      case 'towerDown':
        this.noise(1.6, 0.5, 200, 1); this.tone(45, 1.5, 'sawtooth', 0.35, 0.5); this.tone(70, 1.2, 'sine', 0.3, 0.4, 0.1);
        break;
      case 'victory': [0, 3, 7, 12].forEach((s, i) => this.tone(220 * Math.pow(2, s / 12), 0.9, 'triangle', 0.18, 1, i * 0.18)); break;
      case 'defeat': [12, 8, 5, 0].forEach((s, i) => this.tone(110 * Math.pow(2, s / 12), 1.1, 'sawtooth', 0.12, 0.98, i * 0.25)); break;
      case 'chest': this.noise(0.4, 0.3, 400, 1); this.tone(330, 0.5, 'triangle', 0.15, 2, 0.2); this.tone(495, 0.6, 'triangle', 0.12, 1, 0.35); break;
      case 'reward': this.tone(660, 0.25, 'triangle', 0.12, 1.5); this.tone(990, 0.3, 'sine', 0.08, 1, 0.08); break;
      case 'essence': this.tone(880, 0.2, 'sine', 0.08, 1.5); break;
      case 'special': this.tone(200, 0.4, 'square', 0.08, 2); this.noise(0.3, 0.15, 2000, 6, 0, 'bandpass'); break;
      case 'heartbeat': this.tone(55, 0.15, 'sine', 0.4, 0.6); this.tone(50, 0.15, 'sine', 0.3, 0.6, 0.22); break;
    }
  }

  /** Musique générative : bourdon grave filtré, cloches mineures, battement de cœur en combat. */
  startMusic(mode: 'menu' | 'battle'): void {
    if (!this.ctx || !this.music) return;
    if (this.mode === mode && this.musicTimer !== null) return;
    this.stopMusic();
    this.mode = mode;
    const c = this.ctx, out = this.music;
    const scale = [0, 1, 3, 5, 7, 8, 10];
    const root = mode === 'battle' ? 73.4 : 61.7;
    let step = 0;
    const tick = () => {
      if (!this.ctx) return;
      const t = c.currentTime;
      // bourdon
      if (step % 16 === 0) {
        for (const mul of [1, 1.498, 2.01]) {
          const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = root * mul;
          f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(500, t + 4); f.frequency.linearRampToValueAtTime(180, t + 8);
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 2); g.gain.linearRampToValueAtTime(0.0001, t + 8.5);
          o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + 9);
        }
      }
      // cloches
      if (Math.random() < (mode === 'battle' ? 0.45 : 0.3)) {
        const n = scale[Math.floor(Math.random() * scale.length)] + 12 * (2 + Math.floor(Math.random() * 2));
        this.tone(root * Math.pow(2, n / 12), 2.5, 'sine', 0.05, 1, 0, out);
        this.tone(root * Math.pow(2, n / 12) * 2.76, 1.2, 'sine', 0.015, 1, 0, out);
      }
      if (mode === 'battle' && step % 4 === 0) { this.tone(52, 0.18, 'sine', 0.22, 0.6, 0, out); this.tone(48, 0.16, 'sine', 0.16, 0.6, 0.2, out); }
      if (step % 8 === 4) this.noise(1.5, 0.03, 800, 0.5, 0, 'bandpass', out);
      step++;
    };
    tick();
    this.musicTimer = window.setInterval(tick, mode === 'battle' ? 500 : 650);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
    this.mode = 'off';
  }

  suspend(): void { void this.ctx?.suspend(); }
  resume(): void { void this.ctx?.resume(); }
}

export const audio = new AudioEngine();
