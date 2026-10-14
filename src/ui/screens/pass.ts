// SUPER PASS : parcours gratuit / premium, paliers et réclamations.
import { CARD_MAP } from '../../core/cards';
import { CHESTS, COSMETIC_MAP } from '../../meta/catalog';
import type { Reward } from '../../meta/economy';
import { claimTier, passTier, passTiers, PASS_TIERS, PREMIUM_CRYSTALS, unlockPremium, XP_PER_TIER } from '../../meta/pass';
import { formatDuration, seasonAt } from '../../meta/time';
import { registerScreen } from '../app';
import { confirmDialog, fmt, h, toast } from '../dom';
import { showChestOpening } from './chests';
import { audio } from '../../audio/audio';

export function rewardLabel(r: Reward): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`${fmt(r.gold)} or`);
  if (r.crystals) parts.push(`${r.crystals} cristaux`);
  if (r.chest) parts.push(CHESTS[r.chest].name);
  if (r.cards) for (const c of r.cards) parts.push(`${CARD_MAP[c.cardId].name} ×${c.amount}`);
  if (r.cosmetic) parts.push(COSMETIC_MAP[r.cosmetic].name);
  if (r.passXp) parts.push(`${r.passXp} XP pass`);
  return parts.join(' + ');
}

registerScreen('pass', (app, root) => {
  const render = () => {
    const g = app.game, s = g.data, now = g.now();
    const season = seasonAt(now);
    const tier = passTier(s);
    const tiers = passTiers(s.pass.seasonId);
    const inTier = s.pass.xp - tier * XP_PER_TIER;
    root.innerHTML = '';
    const claim = async (t: number, track: 'free' | 'premium') => {
      const r = g.transact((st, n) => claimTier(st, t, track, n));
      if (!r.ok) return toast(r.reason!, true);
      audio.play('reward');
      if (r.value!.chest) await showChestOpening(app, [r.value!.chest]);
      else toast(`Réclamé : ${rewardLabel(r.value!.reward)}`);
      render();
    };
    root.append(
      h('div', { class: 'panel', style: 'background:linear-gradient(135deg,#3a1030,#120a10 60%,#2a2008)' },
        h('div', { class: 'small muted' }, `Saison ${season.index + 1} · démonstration hors ligne`),
        h('h1', { style: 'font-size:24px;color:var(--gold)' }, `SUPER PASS — ${season.name}`),
        h('div', { class: 'small' }, `Se termine dans ${formatDuration(season.end - now)} (saisons de 28 jours, calculées sur l’horloge locale).`),
        h('div', { class: 'row', style: 'margin-top:10px' }, h('b', null, `Palier ${tier}/${PASS_TIERS}`), h('div', { class: 'prog grow' }, h('i', { style: `width:${tier >= PASS_TIERS ? 100 : (inTier / XP_PER_TIER) * 100}%` })), h('span', { class: 'small' }, tier >= PASS_TIERS ? 'MAX' : `${inTier}/${XP_PER_TIER} XP`)),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, 'XP de pass : combats (victoire 40+, défaite 15) et missions. Les récompenses non réclamées sont perdues à la fin de la saison.'),
        s.pass.premium ? h('div', { class: 'tag', style: 'border-color:var(--gold);color:var(--gold);margin-top:8px' }, '★ Parcours premium actif')
          : h('div', { style: 'margin-top:10px' },
            h('button', { class: 'btn crys block', onclick: async () => {
              if (!(await confirmDialog('Débloquer le parcours premium ?', `Coût : ${PREMIUM_CRYSTALS} cristaux gagnés en jeu. Mode test local : aucun paiement réel, aucun achat en argent n’est possible dans cette version.`, 'Débloquer', 'crys'))) return;
              const r = g.transact((st) => unlockPremium(st));
              if (!r.ok) return toast(r.reason!, true);
              audio.play('deployLegend'); render();
            } }, h('span', { class: 'row', style: 'justify-content:center;gap:6px' }, 'Débloquer le premium ', h('i', { class: 'ico crys' }), String(PREMIUM_CRYSTALS))),
            h('div', { class: 'small muted', style: 'margin-top:4px' }, 'Maquette locale : le premium se débloque uniquement avec des cristaux virtuels gagnés en jouant.')),
      ),
      h('div', { class: 'pass-row', style: 'margin:12px 0 6px' }, h('span'), h('b', { class: 'center small' }, 'GRATUIT'), h('b', { class: 'center small', style: 'color:var(--gold)' }, '★ PREMIUM')),
      ...tiers.map((t) => {
        const reached = tier >= t.tier;
        const fc = s.pass.claimedFree.includes(t.tier), pc = s.pass.claimedPremium.includes(t.tier);
        return h('div', { class: 'pass-row' },
          h('div', { class: `tier${reached ? ' reached' : ''}` }, t.tier),
          h('div', { class: `pr free${fc ? ' claimed' : ''}` }, h('span', null, rewardLabel(t.free)),
            reached && !fc ? h('button', { class: 'btn ok small', onclick: () => claim(t.tier, 'free') }, 'Réclamer') : h('span', { class: 'small muted' }, fc ? '✔ Réclamé' : 'Verrouillé')),
          h('div', { class: `pr prem${pc ? ' claimed' : ''}` }, h('span', null, rewardLabel(t.premium)),
            reached && !pc && s.pass.premium ? h('button', { class: 'btn gold small', onclick: () => claim(t.tier, 'premium') }, 'Réclamer') : h('span', { class: 'small muted' }, pc ? '✔ Réclamé' : !s.pass.premium ? '🔒 Premium' : 'Verrouillé')),
        );
      }),
    );
  };
  render();
});
