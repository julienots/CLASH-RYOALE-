// Écran de combat : arène temps réel, main de 4 cartes, essence, déploiement tactile, IA, pause, fin.
import { audio } from '../../audio/audio';
import { CARD_MAP, getCard } from '../../core/cards';
import type { CardDef } from '../../core/types';
import { Bot, DIFFICULTIES, type Difficulty } from '../../sim/ai';
import { Battle, type BattleEvent } from '../../sim/battle';
import { ARENAS, COSMETIC_MAP } from '../../meta/catalog';
import { applyMatchResult, type MatchMode, setupMatch, summarize } from '../../meta/match';
import { EVENTS } from '../../meta/events';
import { BattleView, UNIT_PX } from '../../render/battleView';
import { prewarm } from '../../render/spriteCache';
import { getUnit } from '../../core/cards';
import type { Visual } from '../../core/types';
import { cardArtUrl } from '../../render/cardArt';
import { type App, registerScreen } from '../app';
import { cardTile, confirmDialog, fmt, h, modal, toast } from '../dom';

function vibrate(app: App, ms: number): void {
  if (app.game.data.settings.vibration && 'vibrate' in navigator) { try { navigator.vibrate(ms); } catch { /* non supporté */ } }
}

function playSounds(events: BattleEvent[], battle: Battle): void {
  for (const e of events) {
    switch (e.t) {
      case 'deploy': { const c = CARD_MAP[e.cardId]; audio.play(c.kind === 'spell' ? 'spell' : c.rarity === 'legendaire' || c.rarity === 'abyssal' ? 'deployLegend' : 'deploy'); break; }
      case 'attack': audio.play(e.melee ? 'melee' : 'shoot', 0.6); break;
      case 'death': audio.play(e.size > 0.7 ? 'bigDeath' : 'death', 0.8); break;
      case 'spellImpact': audio.play('impact'); break;
      case 'blast': audio.play('impact', 0.5); break;
      case 'towerDown': audio.play('towerDown'); break;
      case 'essence': audio.play('essence'); break;
      case 'special': audio.play('special', 0.6); break;
      default: break;
    }
  }
  void battle;
}

registerScreen('battle', (app, root, params) => {
  const g = app.game;
  const mode = (params.mode as MatchMode) ?? 'classe';
  const setup = setupMatch(g.data, mode, g.now(), { difficulty: params.difficulty as Difficulty | undefined, eventId: params.eventId as string | undefined });
  const battle = new Battle(setup.config);
  const bot = new Bot(battle, 1, setup.difficulty, setup.config.seed);
  const arena = ARENAS.find((a) => a.id === setup.arenaId) ?? ARENAS[0];
  (window as unknown as { __battle?: Battle }).__battle = battle; // accès pour les tests de bout en bout
  const ev = setup.eventId ? EVENTS.find((e) => e.id === setup.eventId) : undefined;
  const settings = g.data.settings;
  audio.startMusic('battle');

  // ------------------------------------------------------------ structure
  const timer = h('div', { class: 'timer' }, '3:00');
  const myCrowns = h('div', { class: 'crowns' });
  const foeCrowns = h('div', { class: 'crowns' });
  const pauseBtn = h('button', { class: 'pause-btn', 'aria-label': 'Pause' }, '❚❚');
  const emote = COSMETIC_MAP[g.data.cosmetics.emote];
  let emoteCd = 0;
  const emoteBtn = h('button', { class: 'pause-btn', 'aria-label': 'Émote', onclick: () => {
    if (emoteCd > performance.now()) return;
    emoteCd = performance.now() + 4000;
    const k = view.tile;
    view.fx.spawn({ kind: 'text', x: view.sx(9), y: view.sy(27.5), vy: -k * 0.4, max: 2.2, size: k * 0.9, text: `« ${emote.name} »`, color: emote.colors[0] });
  } }, '💬');
  const top = h('div', { class: 'battle-top' },
    pauseBtn, emoteBtn,
    h('div', { class: 'col', style: 'gap:0;flex:1' }, h('b', { class: 'small', style: 'color:#ff8a94' }, setup.botName), h('span', { class: 'small muted' }, `${DIFFICULTIES[setup.difficulty].label}${ev ? ' · ' + ev.name : mode === 'entrainement' ? ' · entraînement' : ''}`)),
    foeCrowns, timer, myCrowns,
  );
  const canvas = h('canvas');
  const wrap = h('div', { class: 'arena-wrap' }, canvas);
  const handBox = h('div', { class: 'hand' });
  const essNum = h('div', { class: 'num' }, '5');
  const essFill = h('i');
  const essX2 = h('span', { class: 'x2 hidden' }, '×2');
  const hud = h('div', { class: 'hud' }, handBox, h('div', { class: 'essence' }, essNum, h('div', { class: 'bar' }, essFill, h('div', { class: 'ticks' })), essX2));
  root.append(top, wrap, hud);

  const view = new BattleView(canvas, battle, {
    quality: settings.quality, damageNumbers: settings.damageNumbers, showGrid: settings.showGrid,
    ground: arena.ground, accent: arena.accent, summonFx: g.data.cosmetics.summonFx,
  });
  // Pré-calcul des créatures des deux decks (rendu volumétrique) avant le début du combat.
  let ready = false;
  const veilBar = h('i', { style: 'width:0%' });
  const veil = h('div', { class: 'loading-veil' }, h('div', null, h('div', { style: 'font-size:20px;color:var(--crystal)' }, 'Invocation des créatures…'), h('div', { class: 'prog' }, veilBar)));
  wrap.append(veil);
  const visuals: Visual[] = [];
  const addUnit = (id: string) => {
    const u = getUnit(id);
    visuals.push(u.visual);
    for (const a of u.abilities ?? []) if ('unit' in a) visuals.push(getUnit(a.unit).visual);
  };
  for (const d of setup.config.decks) for (const e of d) for (const sp of CARD_MAP[e.cardId].spawns ?? []) addUnit(sp.unit);
  void prewarm(visuals, view.tile * UNIT_PX, (k) => { veilBar.style.width = `${Math.round(k * 100)}%`; }).then(() => { ready = true; veil.remove(); last = performance.now(); });
  const onResize = () => view.resize();
  window.addEventListener('resize', onResize);

  // ------------------------------------------------------------ main / déploiement
  let selected = -1;
  let drag: { idx: number; card: CardDef; ghost: HTMLElement; startX: number; startY: number; moved: boolean } | null = null;
  let handKey = '';

  const renderHand = () => {
    const p = battle.players[0];
    const key = p.hand.map((x) => x?.cardId).join() + '|' + p.queue[0]?.cardId + '|' + selected;
    if (key === handKey) { updateAffordance(); return; }
    handKey = key;
    handBox.innerHTML = '';
    const next = p.queue[0];
    handBox.append(h('div', null, h('div', { class: 'next-l' }, 'Suivante'), next ? cardTile(next.cardId, undefined, { extraClass: 'next' }) : null));
    p.hand.forEach((entry, idx) => {
      if (!entry) { handBox.append(h('div')); return; }
      const tile = cardTile(entry.cardId, { owned: true, level: entry.level, fragments: 0 }, { extraClass: idx === selected ? 'sel' : '' });
      tile.dataset.idx = String(idx);
      tile.addEventListener('pointerdown', (e) => startDrag(e, idx));
      handBox.append(tile);
    });
    updateAffordance();
  };
  const updateAffordance = () => {
    const ess = battle.players[0].essence;
    handBox.querySelectorAll<HTMLElement>('.card[data-idx]').forEach((el) => {
      const c = CARD_MAP[el.dataset.card!];
      el.classList.toggle('poor', c.cost > ess + 1e-6);
    });
  };

  const arenaPoint = (cx: number, cy: number) => {
    const p = view.toArena(cx, cy);
    return { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2, inside: p.x >= 0 && p.x <= 18 && p.y >= 0 && p.y <= 32 };
  };

  const tryPlay = (idx: number, cx: number, cy: number): boolean => {
    const entry = battle.players[0].hand[idx];
    if (!entry) return false;
    const pt = arenaPoint(cx, cy);
    if (!pt.inside) return false;
    const r = battle.playCard(0, idx, pt.x, pt.y);
    if (!r.ok) { toast(r.reason!, true); return false; }
    vibrate(app, 15);
    selected = -1;
    renderHand();
    return true;
  };

  const startDrag = (e: PointerEvent, idx: number) => {
    if (!ready || battle.result || battle.paused) return;
    e.preventDefault();
    const entry = battle.players[0].hand[idx];
    if (!entry) return;
    const card = getCard(entry.cardId);
    const ghost = h('img', { class: 'drag-ghost hidden', src: cardArtUrl(card.id) });
    document.body.appendChild(ghost);
    drag = { idx, card, ghost, startX: e.clientX, startY: e.clientY, moved: false };
    (e.target as HTMLElement).closest('.card')?.classList.add('drag');
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) {
      if (selected >= 0 && e.pointerType === 'mouse') {
        const entry = battle.players[0].hand[selected];
        if (!entry) return;
        const card = getCard(entry.cardId);
        const pt = arenaPoint(e.clientX, e.clientY);
        view.preview = pt.inside ? { card, x: pt.x, y: pt.y, legal: battle.canDeployAt(0, card, pt.x, pt.y) } : null;
      }
      return;
    }
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 10) drag.moved = true;
    if (!drag.moved || settings.deployMode === 'toucher') return;
    const pt = arenaPoint(e.clientX, e.clientY);
    const overArena = pt.inside && e.clientY < hud.getBoundingClientRect().top;
    drag.ghost.classList.toggle('hidden', overArena);
    drag.ghost.style.left = `${e.clientX}px`; drag.ghost.style.top = `${e.clientY}px`;
    view.dragging = drag.card;
    view.preview = overArena ? { card: drag.card, x: pt.x, y: pt.y, legal: battle.canDeployAt(0, drag.card, pt.x, pt.y) } : null;
  };
  const endDrag = (e: PointerEvent) => {
    if (!drag) return;
    const d = drag; drag = null;
    d.ghost.remove();
    view.dragging = null; view.preview = null;
    handBox.querySelectorAll('.drag').forEach((x) => x.classList.remove('drag'));
    if (!d.moved || settings.deployMode === 'toucher') {
      selected = selected === d.idx ? -1 : d.idx;
      handKey = '';
      renderHand();
      if (selected >= 0) view.dragging = d.card;
      return;
    }
    const overArena = e.clientY < hud.getBoundingClientRect().top;
    if (overArena) tryPlay(d.idx, e.clientX, e.clientY);
  };
  const onCanvasDown = (e: PointerEvent) => {
    if (drag || selected < 0 || battle.result || battle.paused) return;
    if (tryPlay(selected, e.clientX, e.clientY)) view.dragging = null;
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerdown', onCanvasDown);

  // ------------------------------------------------------------ pause
  let pauseClose: (() => void) | null = null;
  const pause = () => {
    if (battle.result || battle.paused) return;
    battle.paused = true;
    audio.suspend();
    pauseClose = modal(h('div', { class: 'col' },
      h('h2', null, 'Pause'),
      h('p', { class: 'muted small' }, 'Le combat est suspendu. Votre progression est en sécurité.'),
      h('button', { class: 'btn ok block', onclick: () => resume() }, 'Reprendre'),
      h('button', { class: 'btn block', onclick: async () => {
        if (await confirmDialog('Abandonner ?', 'Le combat sera compté comme une défaite.', 'Abandonner')) { pauseClose?.(); pauseClose = null; battle.paused = false; audio.resume(); battle.forfeit(0); }
      } }, 'Abandonner'),
    ), { dismissable: false });
  };
  const resume = () => { pauseClose?.(); pauseClose = null; battle.paused = false; audio.resume(); last = performance.now(); };
  pauseBtn.addEventListener('click', pause);
  const onVis = () => { if (document.hidden) pause(); };
  document.addEventListener('visibilitychange', onVis);

  // ------------------------------------------------------------ boucle
  let raf = 0;
  let last = performance.now();
  let endAt = 0;
  let finished = false;
  let lastSec = -1;
  const crownsHtml = (n: number) => [0, 1, 2].map((i) => h('span', { class: i < n ? 'on' : '' }, '♛'));

  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (ready && !battle.paused && !battle.result) {
      bot.update(dt);
      battle.update(dt);
    }
    const events = battle.drainEvents();
    if (events.length) {
      view.onEvents(events, 0);
      playSounds(events, battle);
      if (events.some((e) => e.t === 'towerDown')) vibrate(app, 120);
    }
    view.render(battle.paused ? 0 : dt, 0);
    // HUD
    const p = battle.players[0];
    essNum.textContent = String(Math.floor(p.essence));
    essFill.style.width = `${(p.essence / 10) * 100}%`;
    essX2.classList.toggle('hidden', !battle.doubleEssence);
    const tl = Math.max(0, Math.ceil(battle.timeLeft));
    if (tl !== lastSec) {
      lastSec = tl;
      timer.textContent = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
      timer.classList.toggle('ot', battle.overtime);
      if (tl <= 10 && tl > 0) audio.play('heartbeat');
    }
    myCrowns.replaceChildren(...crownsHtml(battle.players[0].crowns));
    foeCrowns.replaceChildren(...crownsHtml(battle.players[1].crowns));
    renderHand();
    if (battle.result && !finished) {
      finished = true;
      endAt = now;
      const win = battle.result.winner === 0;
      audio.play(win ? 'victory' : battle.result.winner === null ? 'reward' : 'defeat');
      wrap.append(h('div', { style: 'position:absolute;inset:0;display:grid;place-items:center;pointer-events:none' },
        h('div', { class: `result-title ${win ? 'win' : 'lose'} reveal` }, win ? 'VICTOIRE' : battle.result.winner === null ? 'ÉGALITÉ' : 'DÉFAITE')));
    }
    if (finished && now - endAt > 2600) { finish(); return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const finish = () => {
    const result = battle.result!;
    const summary = summarize(setup, result, battle.players[0], battle.players[1]);
    let rewards = null as ReturnType<typeof applyMatchResult> | null;
    g.transact((s, now) => { rewards = applyMatchResult(s, setup, summary, now); return { ok: true }; });
    app.go('results', { rewards, summary, result, botName: setup.botName, mode, eventId: setup.eventId, difficulty: setup.difficulty, stats: battle.players[0].stats });
  };

  return () => {
    delete (window as unknown as { __battle?: Battle }).__battle;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    document.removeEventListener('visibilitychange', onVis);
    pauseClose?.();
    document.querySelectorAll('.drag-ghost').forEach((x) => x.remove());
    audio.resume();
  };
});

registerScreen('results', (app, root, params) => {
  const r = params.rewards as ReturnType<typeof applyMatchResult>;
  const summary = params.summary as ReturnType<typeof summarize>;
  const stats = params.stats as Battle['players'][0]['stats'];
  if (!r) { app.go('home'); return; }
  const win = r.outcome === 'victoire';
  const row = (icon: HTMLElement | string, text: string) => h('div', { class: 'reward' }, typeof icon === 'string' ? h('span', null, icon) : icon, h('span', { class: 'grow' }, text));
  root.append(
    h('div', { class: `result-title ${win ? 'win' : r.outcome === 'egalite' ? '' : 'lose'}` }, win ? 'VICTOIRE' : r.outcome === 'egalite' ? 'ÉGALITÉ' : 'DÉFAITE'),
    h('div', { class: 'center muted' }, `contre ${params.botName as string} · ${summary.crowns} – ${summary.crownsLost} couronnes`),
    h('div', { class: 'panel', style: 'margin-top:14px' },
      h('h3', { style: 'margin-bottom:8px' }, 'Récompenses'),
      r.duplicate ? h('div', { class: 'muted' }, 'Ce combat a déjà été récompensé.') : null,
      row(h('i', { class: 'ico gold' }), `+${fmt(r.gold)} or`),
      row('✦', `+${r.xp} XP de compte · +${r.passXp} XP de SUPER PASS`),
      params.mode === 'classe' ? row(h('i', { class: 'ico troph' }), `${r.trophies >= 0 ? '+' : ''}${r.trophies} trophées`) : null,
      r.crowns ? row('♛', `+${r.crowns} couronne(s) pour le Coffre des Couronnes`) : null,
      r.chest ? row('🎁', `Coffre gagné : placé dans un emplacement libre`) : null,
      r.chestSlotsFull ? row('⚠', 'Emplacements de coffres pleins : aucun coffre obtenu. Ouvrez vos coffres !') : null,
      ...r.levelUps.map((l) => row('⬆', `Niveau ${l.level} atteint ! +${fmt(l.gold)} or, +${l.crystals} cristaux, tours renforcées`)),
      params.eventId ? row('☠', 'Progression d’événement enregistrée') : null,
    ),
    h('div', { class: 'panel' },
      h('h3', { style: 'margin-bottom:6px' }, 'Statistiques du combat'),
      h('div', { class: 'stats' },
        h('span', null, 'Cartes jouées'), h('b', null, stats.cardsPlayed), h('span'),
        h('span', null, 'Unités ennemies éliminées'), h('b', null, stats.unitsKilled), h('span'),
        h('span', null, 'Dégâts aux tours'), h('b', null, fmt(stats.damageToTowers)), h('span'),
        h('span', null, 'Essence dépensée'), h('b', null, fmt(stats.essenceSpent)), h('span'),
        h('span', null, 'Essence gaspillée (barre pleine)'), h('b', null, stats.essenceWasted.toFixed(1)), h('span'),
      ),
    ),
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn grow', onclick: () => app.go('home') }, 'Menu'),
      h('button', { class: 'btn primary grow', onclick: () => app.go('battle', { mode: params.mode, difficulty: params.mode === 'entrainement' ? params.difficulty : undefined, eventId: params.eventId }) }, 'Rejouer'),
    ),
  );
  return undefined;
});
