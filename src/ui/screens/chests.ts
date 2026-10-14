// Écran des coffres + animation d'ouverture réutilisée par la boutique, le pass et les événements.
import { audio } from '../../audio/audio';
import { CARD_MAP } from '../../core/cards';
import { RARITY_INFO } from '../../core/progression';
import { chestOdds, CHESTS } from '../../meta/catalog';
import { CROWNS_FOR_CHEST, type ChestContents, openCrownChest, openFreeChest, openSlot, skipCost, startUnlock } from '../../meta/economy';
import type { ChestType } from '../../meta/state';
import { dayKey, formatDuration } from '../../meta/time';
import { type App, registerScreen } from '../app';
import { cardTile, chestIcon, confirmDialog, fmt, h, modal, toast } from '../dom';

/** Animation d'ouverture : le coffre tremble, puis chaque récompense est révélée au toucher. */
export function showChestOpening(app: App, contents: ChestContents[], title?: string): Promise<void> {
  return new Promise((resolve) => {
    const queue: HTMLElement[] = [];
    let gold = 0, crystals = 0;
    for (const c of contents) {
      gold += c.gold; crystals += c.crystals;
      for (const card of c.cards) {
        const def = CARD_MAP[card.cardId];
        const r = RARITY_INFO[def.rarity];
        queue.push(h('div', { class: 'col reveal', style: 'align-items:center' },
          h('div', { style: 'width:150px' }, cardTile(card.cardId, app.game.data.collection[card.cardId])),
          h('h2', { style: `color:${r.glow}` }, `${def.name} ×${card.amount}`),
          h('div', { class: 'row' }, h('span', { class: 'tag', style: `border-color:${r.color}` }, r.label), card.isNew ? h('span', { class: 'tag', style: 'border-color:#6fe08a;color:#6fe08a' }, 'NOUVELLE !') : null),
        ));
      }
    }
    queue.push(h('div', { class: 'col reveal', style: 'align-items:center' },
      h('h2', null, 'Butin total'),
      h('div', { class: 'row' }, h('i', { class: 'ico gold' }), `+${fmt(gold)} or`),
      crystals ? h('div', { class: 'row' }, h('i', { class: 'ico crys' }), `+${fmt(crystals)} cristaux`) : null,
      h('div', { class: 'cards', style: 'grid-template-columns:repeat(5,1fr);width:100%' }, contents.flatMap((c) => c.cards.map((k) => cardTile(k.cardId)))),
    ));
    const type = contents[0]?.type ?? 'coffre_os';
    const stage = h('div', { class: 'chest-open' },
      h('h2', null, title ?? CHESTS[type].name),
      h('div', { class: 'big', style: `background:linear-gradient(${CHESTS[type].color},#1a1014);--glow:${CHESTS[type].color}` }),
      h('div', { class: 'muted small' }, 'Touchez pour ouvrir'),
    );
    const wrap = h('div', null, stage);
    let i = -1;
    const next = () => {
      i++;
      if (i >= queue.length) { close(); app.refreshTop(); resolve(); return; }
      audio.play(i === 0 ? 'chest' : 'reward');
      const legendary = i < queue.length - 1 && /Légendaire|Abyssale/.test(queue[i].textContent ?? '');
      if (legendary) audio.play('deployLegend');
      wrap.innerHTML = '';
      wrap.appendChild(queue[i]);
      wrap.appendChild(h('div', { class: 'muted small center', style: 'margin-top:12px' }, i === queue.length - 1 ? 'Touchez pour fermer' : `Touchez pour continuer (${i + 1}/${queue.length - 1})`));
    };
    wrap.addEventListener('click', next);
    const close = modal(wrap, { dismissable: false });
  });
}

export function oddsTable(type: ChestType): HTMLElement {
  const d = CHESTS[type];
  return h('div', { class: 'col' },
    h('div', { class: 'small muted' }, `${d.stacks} piles de cartes · ${d.totalFragments} fragments environ · ${d.gold[0]}–${d.gold[1]} or${d.crystals[1] ? ` · ${d.crystals[0]}–${d.crystals[1]} cristaux` : ''}`),
    h('div', { class: 'odds' }, chestOdds(type).flatMap((o) => [h('span', { style: `color:${RARITY_INFO[o.rarity].glow}` }, `${RARITY_INFO[o.rarity].label} (par pile)`), h('span', null, `${o.pct.toFixed(o.pct < 1 ? 2 : 1)} %`)])),
    d.guaranteed?.length ? h('div', { class: 'small' }, `Garanti : ${d.guaranteed.map((r) => RARITY_INFO[r].label).join(', ')}`) : null,
  );
}

export function chestSlotsView(app: App, onChange: () => void): HTMLElement {
  const g = app.game, s = g.data, now = g.now();
  return h('div', { class: 'chest-slots' }, s.chests.slots.map((c, i) => {
    if (!c) return h('div', { class: 'slot muted' }, 'Emplacement libre', h('span', { class: 'small' }, 'Gagnez un combat'));
    const d = CHESTS[c.type];
    const ready = c.unlockAt !== null && c.unlockAt <= now;
    const running = c.unlockAt !== null && !ready;
    const label = ready ? 'OUVRIR !' : running ? formatDuration(c.unlockAt! - now) : formatDuration(d.unlockSeconds * 1000);
    return h('button', { class: `slot full${ready ? ' ready' : ''}`, onclick: () => slotAction(app, i, onChange) },
      chestIcon(c.type, 0.85), h('b', { class: 'small' }, d.name), h('span', { class: 'small', style: ready ? 'color:var(--gold)' : '' }, label));
  }));
}

async function slotAction(app: App, i: number, onChange: () => void): Promise<void> {
  const g = app.game;
  const c = g.data.chests.slots[i];
  if (!c) return;
  const now = g.now();
  const ready = c.unlockAt !== null && c.unlockAt <= now;
  if (ready) {
    const r = g.transact((s, t) => openSlot(s, i, t, g.rng('slot')));
    if (r.ok) await showChestOpening(app, [r.value!]);
    onChange();
    return;
  }
  const d = CHESTS[c.type];
  const cost = skipCost(g.data, i, now);
  const running = c.unlockAt !== null;
  const otherRunning = g.data.chests.slots.some((x, j) => j !== i && x && x.unlockAt !== null && x.unlockAt > now);
  const close = modal(h('div', { class: 'col' },
    h('div', { class: 'row' }, chestIcon(c.type), h('h2', null, d.name)),
    oddsTable(c.type),
    h('div', { class: 'small muted' }, running ? `Ouverture en cours : ${formatDuration(c.unlockAt! - now)} restantes.` : `Temps d'ouverture : ${formatDuration(d.unlockSeconds * 1000)}.`),
    h('div', { class: 'row', style: 'justify-content:flex-end;flex-wrap:wrap' },
      !running ? h('button', { class: 'btn ok', disabled: otherRunning, onclick: () => {
        const r = g.transact((s, t) => startUnlock(s, i, t));
        if (!r.ok) toast(r.reason!, true);
        close(); onChange();
      } }, otherRunning ? 'Un autre coffre s’ouvre' : 'Lancer l’ouverture') : null,
      h('button', { class: 'btn crys', onclick: async () => {
        close();
        if (cost >= 20 && !(await confirmDialog('Ouvrir maintenant ?', `Dépenser ${cost} cristaux pour ouvrir immédiatement ${d.name} ?`, 'Dépenser', 'crys'))) return;
        const r = g.transact((s, t) => openSlot(s, i, t, g.rng('skip'), true));
        if (!r.ok) { toast(r.reason!, true); return; }
        await showChestOpening(app, [r.value!]);
        onChange();
      } }, h('i', { class: 'ico crys' }), ` Ouvrir maintenant (${cost})`),
    ),
  ));
}

registerScreen('chests', (app, root) => {
  const render = () => {
    const g = app.game, s = g.data, now = g.now();
    root.innerHTML = '';
    const freeReady = now >= s.chests.freeAt;
    root.append(
      h('div', { class: 'section-title' }, h('h2', null, 'Coffres'), h('button', { class: 'btn small', onclick: () => app.back() }, 'Retour')),
      chestSlotsView(app, render),
      h('div', { class: 'panel', style: 'margin-top:12px' },
        h('div', { class: 'row' }, chestIcon('coffre_gratuit'), h('div', { class: 'grow' }, h('h3', null, 'Offrande gratuite'), h('div', { class: 'small muted' }, 'Toutes les 4 heures.')),
          h('button', { class: 'btn ok small', disabled: !freeReady, onclick: async () => {
            const r = g.transact((st, t) => openFreeChest(st, t, g.rng('free')));
            if (!r.ok) return toast(r.reason!, true);
            await showChestOpening(app, [r.value!]); render();
          } }, freeReady ? 'Ouvrir' : formatDuration(s.chests.freeAt - now))),
      ),
      h('div', { class: 'panel' },
        h('div', { class: 'row' }, chestIcon('coffre_couronnes'), h('div', { class: 'grow' }, h('h3', null, 'Coffre des Couronnes'), h('div', { class: 'small muted' }, `${s.chests.crowns}/${CROWNS_FOR_CHEST} couronnes · 1 par jour`)),
          h('button', { class: 'btn gold small', disabled: s.chests.crowns < CROWNS_FOR_CHEST || s.chests.crownDay === dayKey(now), onclick: async () => {
            const r = g.transact((st, t) => openCrownChest(st, g.rng('crown'), dayKey(t)));
            if (!r.ok) return toast(r.reason!, true);
            await showChestOpening(app, [r.value!]); render();
          } }, s.chests.crownDay === dayKey(now) ? 'Demain' : 'Ouvrir')),
        h('div', { class: 'prog gold', style: 'margin-top:8px' }, h('i', { style: `width:${(s.chests.crowns / CROWNS_FOR_CHEST) * 100}%` })),
      ),
      h('div', { class: 'section-title' }, h('h3', null, 'Probabilités des coffres')),
      ...(['coffre_os', 'coffre_chair', 'coffre_chitine', 'coffre_abysse', 'coffre_legendaire'] as ChestType[]).map((t) =>
        h('div', { class: 'panel' }, h('div', { class: 'row' }, chestIcon(t, 0.7), h('h3', null, CHESTS[t].name)), oddsTable(t))),
    );
  };
  render();
  const timer = window.setInterval(render, 1000);
  return () => clearInterval(timer);
});
