// Missions quotidiennes/hebdomadaires, succès et événements spéciaux.
import { claimEventMilestone, EVENTS, eventProgress } from '../../meta/events';
import { ACHIEVEMENTS, claimAchievement, claimMission } from '../../meta/missions';
import type { Mission } from '../../meta/state';
import { formatDuration, nextLocalMidnight } from '../../meta/time';
import { DIFFICULTIES } from '../../sim/ai';
import { CARD_MAP } from '../../core/cards';
import { registerScreen } from '../app';
import { cardTile, fmt, h, toast } from '../dom';
import { showChestOpening } from './chests';
import { startMatchFlow } from './home';
import { rewardLabel } from './pass';
import { audio } from '../../audio/audio';

let tab: 'missions' | 'evenements' | 'succes' = 'missions';

registerScreen('events', (app, root) => {
  const render = () => {
    const g = app.game, s = g.data, now = g.now();
    root.innerHTML = '';
    const tabs = h('div', { class: 'tabs' },
      h('button', { class: tab === 'missions' ? 'on' : '', onclick: () => { tab = 'missions'; render(); } }, 'Missions'),
      h('button', { class: tab === 'evenements' ? 'on' : '', onclick: () => { tab = 'evenements'; render(); } }, 'Événements'),
      h('button', { class: tab === 'succes' ? 'on' : '', onclick: () => { tab = 'succes'; render(); } }, 'Succès'));
    root.append(tabs);
    const missionRow = (m: Mission) => h('div', { class: 'panel' },
      h('div', { class: 'row' }, h('b', { class: 'grow' }, m.label),
        m.claimed ? h('span', { class: 'small muted' }, '✔') : h('button', { class: 'btn ok small', disabled: m.progress < m.target, onclick: () => {
          const r = g.transact((st) => claimMission(st, m.id));
          if (!r.ok) return toast(r.reason!, true);
          audio.play('reward'); toast(`+${fmt(m.reward.gold ?? 0)} or · +${m.reward.passXp} XP pass${m.reward.crystals ? ` · +${m.reward.crystals} cristaux` : ''}`); render();
        } }, 'Réclamer')),
      h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'prog ok grow' }, h('i', { style: `width:${(m.progress / m.target) * 100}%` })), h('span', { class: 'small' }, `${m.progress}/${m.target}`)),
      h('div', { class: 'small muted', style: 'margin-top:4px' }, `Récompense : ${fmt(m.reward.gold ?? 0)} or · ${m.reward.passXp} XP de pass${m.reward.crystals ? ` · ${m.reward.crystals} cristaux` : ''}`));
    if (tab === 'missions') {
      const monday = new Date(now); monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7)); monday.setHours(0, 0, 0, 0);
      root.append(
        h('div', { class: 'section-title' }, h('h2', null, 'Quotidiennes'), h('span', { class: 'small muted' }, `Nouvelles dans ${formatDuration(nextLocalMidnight(now) - now)}`)),
        ...s.missions.daily.map(missionRow),
        h('div', { class: 'section-title' }, h('h2', null, 'Hebdomadaires'), h('span', { class: 'small muted' }, `Renouvellement dans ${formatDuration(monday.getTime() - now)}`)),
        ...s.missions.weekly.map(missionRow),
      );
    } else if (tab === 'evenements') {
      root.append(h('p', { class: 'small muted' }, 'Défis hors ligne contre des bots. Les paliers de victoires se réinitialisent chaque lundi.'));
      for (const ev of EVENTS) {
        const p = eventProgress(s, ev.id);
        root.append(h('div', { class: 'panel', style: `border-color:${ev.color}` },
          h('div', { class: 'row' }, h('h2', { class: 'grow', style: `color:${ev.color}` }, ev.name), h('span', { class: 'tag' }, DIFFICULTIES[ev.difficulty].label)),
          h('div', { class: 'small', style: 'font-style:italic;margin:4px 0' }, ev.tagline),
          h('ul', { class: 'small', style: 'margin:4px 0;padding-left:18px' }, ev.rules.map((r) => h('li', null, r))),
          ev.botDeck ? h('div', null, h('div', { class: 'small muted' }, ev.playerDeck ? 'Deck imposé (les deux camps) :' : 'Deck du bot :'),
            h('div', { class: 'cards', style: 'grid-template-columns:repeat(8,1fr);gap:3px;margin-top:4px' }, ev.botDeck.map((id) => cardTile(id, undefined, { onclick: () => app.go('card', { id }) })))) : null,
          h('div', { class: 'small', style: 'margin-top:8px' }, `Victoires cette semaine : ${p.wins} (combats : ${p.played})`),
          ...ev.milestones.map((m, i) => h('div', { class: 'row', style: 'margin-top:6px' },
            h('span', { class: 'grow small' }, `${m.wins} victoire${m.wins > 1 ? 's' : ''} : ${m.label}`),
            p.claimed.includes(i) ? h('span', { class: 'small muted' }, '✔') : h('button', { class: 'btn ok small', disabled: p.wins < m.wins, onclick: async () => {
              const r = g.transact((st, n) => claimEventMilestone(st, ev.id, i, n));
              if (!r.ok) return toast(r.reason!, true);
              audio.play('reward');
              if (r.value!.chest) await showChestOpening(app, [r.value!.chest]); else toast(`Réclamé : ${rewardLabel(r.value!.reward)}`);
              render();
            } }, 'Réclamer'))),
          h('button', { class: 'btn primary block', style: 'margin-top:10px', onclick: () => startMatchFlow(app, 'evenement', { eventId: ev.id }) }, 'Jouer l’événement'),
        ));
      }
      void CARD_MAP;
    } else {
      for (const a of ACHIEVEMENTS) {
        const v = Math.min(a.target, Math.max(0, a.check(s)));
        const done = s.achievements[a.id];
        root.append(h('div', { class: 'panel' },
          h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', null, a.name), h('div', { class: 'small muted' }, a.description)),
            done ? h('span', { class: 'small muted' }, '✔ Obtenu') : h('button', { class: 'btn crys small', disabled: v < a.target, onclick: () => {
              const r = g.transact((st) => claimAchievement(st, a.id));
              if (!r.ok) return toast(r.reason!, true);
              audio.play('reward'); toast(`+${a.crystals} cristaux`); render();
            } }, `+${a.crystals}`)),
          h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'prog grow' }, h('i', { style: `width:${(v / a.target) * 100}%` })), h('span', { class: 'small' }, `${v}/${a.target}`))));
      }
    }
  };
  render();
});
