// Coquille de l'application : barre du haut, navigation, routage entre écrans.
import { audio } from '../audio/audio';
import { CARDS } from '../core/cards';
import { Game } from '../meta/game';
import { passTier, PASS_TIERS } from '../meta/pass';
import { ACHIEVEMENTS } from '../meta/missions';
import { EVENTS, eventProgress } from '../meta/events';
import { fmt, h } from './dom';
import { upgradeInfo } from '../meta/economy';

export type ScreenName = 'home' | 'battle' | 'collection' | 'deck' | 'card' | 'shop' | 'chests' | 'pass' | 'events' | 'profile' | 'settings' | 'results';
export type ScreenFn = (app: App, root: HTMLElement, params: Record<string, unknown>) => void | (() => void);

const registry = new Map<ScreenName, ScreenFn>();
export function registerScreen(name: ScreenName, fn: ScreenFn): void { registry.set(name, fn); }

export class App {
  current: ScreenName = 'home';
  private cleanup: (() => void) | void = undefined;
  private root: HTMLElement;
  private top!: HTMLElement;
  private body!: HTMLElement;
  private nav!: HTMLElement;
  private history: { name: ScreenName; params: Record<string, unknown> }[] = [];

  constructor(readonly game: Game, mount: HTMLElement) {
    this.root = mount;
    this.root.innerHTML = '';
    game.onChange(() => this.refreshTop());
  }

  go(name: ScreenName, params: Record<string, unknown> = {}, push = true): void {
    if (typeof this.cleanup === 'function') this.cleanup();
    this.cleanup = undefined;
    if (push && this.current !== name && !['battle', 'results'].includes(this.current)) this.history.push({ name: this.current, params: {} });
    if (this.history.length > 20) this.history.shift();
    this.current = name;
    this.game.refresh();
    this.root.innerHTML = '';
    const fullscreen = name === 'battle';
    if (!fullscreen) {
      this.top = this.buildTop();
      this.root.appendChild(this.top);
    }
    this.body = h('div', { class: `screen${fullscreen ? ' full' : ''}` });
    this.root.appendChild(this.body);
    if (!fullscreen && name !== 'results') {
      this.nav = this.buildNav();
      this.root.appendChild(this.nav);
    }
    const fn = registry.get(name);
    if (fn) this.cleanup = fn(this, this.body, params);
    if (name !== 'battle') audio.startMusic('menu');
  }

  back(): void {
    const prev = this.history.pop();
    this.go(prev?.name ?? 'home', prev?.params ?? {}, false);
  }

  refreshTop(): void {
    if (!this.top || !this.top.isConnected) return;
    const fresh = this.buildTop();
    this.top.replaceWith(fresh);
    this.top = fresh;
    if (this.nav?.isConnected) { const n = this.buildNav(); this.nav.replaceWith(n); this.nav = n; }
  }

  private buildTop(): HTMLElement {
    const s = this.game.data;
    return h('div', { class: 'topbar' },
      h('button', { class: 'lvl', onclick: () => this.go('profile') }, h('b', null, s.profile.level), h('span', { class: 'small' }, s.profile.name)),
      h('div', { class: 'grow' }),
      h('div', { class: 'res', title: 'Or' }, h('i', { class: 'ico gold' }), fmt(s.gold)),
      h('div', { class: 'res', title: 'Cristaux' }, h('i', { class: 'ico crys' }), fmt(s.crystals)),
      h('button', { class: 'iconbtn', 'aria-label': 'Paramètres', onclick: () => this.go('settings') }, '⚙'),
    );
  }

  /** Indicateurs « quelque chose à réclamer ». */
  badges(): Record<string, boolean> {
    const s = this.game.data;
    const now = this.game.now();
    const tier = passTier(s);
    let passClaim = false;
    for (let t = 1; t <= Math.min(tier, PASS_TIERS); t++) {
      if (!s.pass.claimedFree.includes(t) || (s.pass.premium && !s.pass.claimedPremium.includes(t))) { passClaim = true; break; }
    }
    const missions = [...s.missions.daily, ...s.missions.weekly].some((m) => !m.claimed && m.progress >= m.target);
    const ach = ACHIEVEMENTS.some((a) => !s.achievements[a.id] && a.check(s) >= a.target);
    const ev = EVENTS.some((e) => { const p = eventProgress(s, e.id); return e.milestones.some((m, i) => p.wins >= m.wins && !p.claimed.includes(i)); });
    const chests = s.chests.slots.some((c) => c && c.unlockAt !== null && c.unlockAt <= now) || now >= s.chests.freeAt;
    const shop = s.shop.offers.some((o) => o.currency === 'free' && (s.shop.purchases[o.id] ?? 0) < o.limit);
    const upgrades = CARDS.some((c) => s.collection[c.id].owned && upgradeInfo(s, c.id).canUpgrade);
    return { pass: passClaim, events: missions || ach || ev, home: chests, shop, collection: upgrades };
  }

  private buildNav(): HTMLElement {
    const b = this.badges();
    const item = (name: ScreenName, glyph: string, label: string, badge = false) =>
      h('button', { class: this.current === name || (name === 'collection' && (this.current === 'deck' || this.current === 'card')) || (name === 'home' && this.current === 'chests') ? 'on' : '', onclick: () => this.go(name) },
        h('span', { class: 'g' }, glyph), label, badge ? h('i', { class: 'dot' }) : null);
    return h('nav', { class: 'nav' },
      item('shop', '🛒', 'Boutique', b.shop),
      item('collection', '🂠', 'Cartes', b.collection),
      item('home', '⚔', 'Combat', b.home),
      item('pass', '✦', 'Super Pass', b.pass),
      item('events', '☠', 'Missions', b.events),
    );
  }
}
