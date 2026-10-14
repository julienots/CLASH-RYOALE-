// Menu principal : arène actuelle, bouton « Combattre », entraînement, coffres, deck actif.
import { DIFFICULTIES, type Difficulty } from '../../sim/ai';
import { ARENAS, arenaFor } from '../../meta/catalog';
import { averageCost, deckProblems } from '../../meta/economy';
import { DIFFICULTY_ORDER } from '../../meta/match';
import { drawMonster } from '../../render/sprites';
import { getUnit } from '../../core/cards';
import { type App, registerScreen } from '../app';
import { cardTile, h, modal, toast } from '../dom';
import { chestSlotsView } from './chests';
import { formatDuration } from '../../meta/time';

function heroCanvas(app: App): HTMLCanvasElement {
  const arena = arenaFor(app.game.data.profile.trophies);
  const c = h('canvas');
  let raf = 0, t = 0, last = performance.now();
  const monsters = ['titan_ossuaire', 'l_innommable', 'reine_ruche'].map(getUnit);
  const draw = (now: number) => {
    if (!c.isConnected) { cancelAnimationFrame(raf); return; }
    t += (now - last) / 1000; last = now;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
    const g = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const bg = g.createRadialGradient(W / 2, H * 0.8, 10, W / 2, H * 0.5, W * 0.8);
    bg.addColorStop(0, arena.accent + '55'); bg.addColorStop(0.5, arena.ground); bg.addColorStop(1, '#050307');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(W / 2, H * 0.86, W * 0.45, H * 0.08, 0, 0, Math.PI * 2); g.fill();
    monsters.forEach((m, i) => {
      g.save(); g.translate(W * (0.22 + i * 0.3), H * 0.86); g.globalAlpha = i === 1 ? 1 : 0.85;
      drawMonster(g, m.visual, { t: t + i, moving: false, attack: (Math.sin(t * 0.8 + i * 2) > 0.92) ? 0.5 : 0 }, H * (i === 1 ? 0.32 : 0.28), i === 2);
      g.restore();
    });
    // brume
    for (let k = 0; k < 6; k++) {
      const x = ((t * 12 * (k + 1)) % (W + 200)) - 100;
      const fg = g.createRadialGradient(x, H * 0.8, 0, x, H * 0.8, W * 0.25);
      fg.addColorStop(0, 'rgba(200,180,200,.07)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = fg; g.fillRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return c;
}

export function startMatchFlow(app: App, mode: 'classe' | 'entrainement' | 'evenement', opts: { difficulty?: Difficulty; eventId?: string } = {}): void {
  const s = app.game.data;
  const probs = deckProblems(s, s.decks[s.activeDeck]);
  if (probs.length && !opts.eventId) { toast(probs[0], true); app.go('deck'); return; }
  app.go('battle', { mode, ...opts });
}

function trainingModal(app: App): void {
  const close = modal(h('div', { class: 'col' },
    h('h2', null, 'Entraînement contre un bot'),
    h('p', { class: 'muted small' }, 'Aucun trophée en jeu. Récompenses réduites, progression des missions comptée.'),
    ...DIFFICULTY_ORDER.map((d) => h('button', { class: 'btn block', style: 'text-align:left', onclick: () => { close(); startMatchFlow(app, 'entrainement', { difficulty: d }); } },
      h('b', null, DIFFICULTIES[d].label), h('div', { class: 'small muted' }, DIFFICULTIES[d].description))),
  ));
}

registerScreen('home', (app, root) => {
  const slotsBox = h('div');
  const refreshSlots = () => { slotsBox.replaceChildren(chestSlotsView(app, refreshSlots)); app.refreshTop(); };
  const render = () => {
    const s = app.game.data;
    const arena = arenaFor(s.profile.trophies);
    const nextArena = ARENAS.find((a) => a.minTrophies > s.profile.trophies);
    const deck = s.decks[s.activeDeck];
    const now = app.game.now();
    root.innerHTML = '';
    slotsBox.replaceChildren(chestSlotsView(app, refreshSlots));
    root.append(
      h('div', { class: 'arena-hero' }, heroCanvas(app),
        h('div', { class: 'info' },
          h('div', { class: 'small muted' }, 'Cercle actuel'),
          h('h1', { style: `color:${arena.accent};font-size:26px;text-shadow:0 2px 8px #000` }, arena.name),
          h('div', { class: 'row small' }, h('i', { class: 'ico troph' }), `${s.profile.trophies} trophées`, nextArena ? h('span', { class: 'muted' }, ` · prochain cercle à ${nextArena.minTrophies}`) : null,
            h('span', { class: 'muted' }, ` · bot ${DIFFICULTIES[arena.difficulty].label}`)),
        )),
      h('div', { style: 'margin:14px 0 8px' }, h('button', { class: 'fight', onclick: () => startMatchFlow(app, 'classe') }, 'COMBATTRE')),
      h('div', { class: 'row' },
        h('button', { class: 'btn grow', onclick: () => trainingModal(app) }, '🗡 Entraînement'),
        h('button', { class: 'btn grow', onclick: () => app.go('events') }, '☠ Événements'),
        h('button', { class: 'btn grow', onclick: () => app.go('chests') }, '🎁 Coffres'),
      ),
      h('div', { class: 'section-title' }, h('h3', null, 'Coffres'), h('button', { class: 'btn small', onclick: () => app.go('chests') }, now >= s.chests.freeAt ? 'Offrande prête' : `Offrande : ${formatDuration(s.chests.freeAt - now)}`)),
      slotsBox,
      h('div', { class: 'section-title' },
        h('h3', null, `Deck ${s.activeDeck + 1} · coût moyen ${averageCost(deck).toFixed(1)}`),
        h('button', { class: 'btn small', onclick: () => app.go('deck') }, 'Modifier')),
      h('div', { class: 'deck-slots' }, deck.map((id) => cardTile(id, s.collection[id], { showLevel: true, onclick: () => app.go('card', { id }) }))),
      h('div', { class: 'disclaimer' }, 'Jeu hors ligne contre des bots. Progression sauvegardée sur cet appareil. Le multijoueur en ligne n’est pas encore disponible.'),
    );
  };
  render();
  const timer = window.setInterval(() => { if (!document.querySelector('.modal-bg')) refreshSlots(); }, 1000);
  return () => clearInterval(timer);
});
