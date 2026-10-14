// Boutique hors ligne : offres du jour, coffres, ressources, offres spéciales, cosmétiques.
import { CARD_MAP } from '../../core/cards';
import { RARITY_INFO } from '../../core/progression';
import { CHESTS, COSMETICS } from '../../meta/catalog';
import { buyCosmetic, equipCosmetic } from '../../meta/economy';
import { buyDailyOffer, buyPermanentOffer, offerLabel, PERMANENT_OFFERS, type PurchaseResult } from '../../meta/shop';
import { formatDuration, nextLocalMidnight } from '../../meta/time';
import { type App, registerScreen } from '../app';
import { cardTile, chestIcon, confirmDialog, fmt, h, priceTag, toast } from '../dom';
import { oddsTable, showChestOpening } from './chests';
import { audio } from '../../audio/audio';

async function afterPurchase(app: App, res: PurchaseResult): Promise<void> {
  audio.play('reward');
  if (res.chests?.length) await showChestOpening(app, res.chests);
  else if (res.cards?.length) toast(`+${res.cards[0].amount} ${CARD_MAP[res.cards[0].cardId].name}${res.cards[0].isNew ? ' — nouvelle carte !' : ''}`);
  else if (res.gold) toast(`+${fmt(res.gold)} or`);
}

/** Confirmation obligatoire au-delà d'un seuil, avec contenu et prix rappelés. */
async function confirmSpend(label: string, price: number, currency: 'gold' | 'crystals' | 'free', details?: HTMLElement): Promise<boolean> {
  if (currency === 'free') return true;
  const big = currency === 'crystals' ? price >= 100 : price >= 1000;
  if (!big) return true;
  return confirmDialog('Confirmer l’achat', h('div', { class: 'col' }, h('p', null, `${label} pour `, h('b', null, `${fmt(price)} ${currency === 'gold' ? 'or' : 'cristaux'}`), ' ?'), details ?? null, h('p', { class: 'small muted' }, 'Monnaie virtuelle gagnée en jeu uniquement. Aucun paiement réel.')), 'Acheter', currency === 'gold' ? 'gold' : 'crys');
}

registerScreen('shop', (app, root) => {
  const render = () => {
    const g = app.game, s = g.data, now = g.now();
    root.innerHTML = '';
    const daily = s.shop.offers.map((o) => {
      const bought = s.shop.purchases[o.id] ?? 0;
      const left = o.limit - bought;
      const visual = o.kind === 'card' ? cardTile(o.cardId!, s.collection[o.cardId!]) : o.kind === 'chest' ? h('div', { style: 'display:grid;place-items:center;height:64px' }, chestIcon(o.chest!, 1.2)) : h('div', { style: 'font-size:40px;height:64px;display:grid;place-items:center' }, '🎁');
      return h('div', { class: 'offer' },
        visual,
        h('div', { class: 'small' }, h('b', null, offerLabel(o))),
        o.kind === 'card' ? h('div', { class: 'small', style: `color:${RARITY_INFO[CARD_MAP[o.cardId!].rarity].glow}` }, RARITY_INFO[CARD_MAP[o.cardId!].rarity].label) : null,
        h('div', { class: 'small muted' }, left > 0 ? `Limite : ${left}/${o.limit}` : 'Épuisé'),
        h('button', { class: `btn small ${o.currency === 'crystals' ? 'crys' : o.currency === 'free' ? 'ok' : 'gold'}`, disabled: left <= 0, onclick: async () => {
          if (!(await confirmSpend(offerLabel(o), o.price, o.currency, o.chest ? oddsTable(o.chest) : undefined))) return;
          const r = g.transact((st, t) => buyDailyOffer(st, o.id, t, g.rng('shop')));
          if (!r.ok) return toast(r.reason!, true);
          await afterPurchase(app, r.value!); render();
        } }, priceTag(o.price, o.currency)),
      );
    });
    const perm = (section: 'coffres' | 'ressources' | 'speciales') => h('div', { class: 'offers' }, PERMANENT_OFFERS.filter((o) => o.section === section).map((o) => {
      const bought = s.shop.weeklyPurchases[o.id] ?? 0;
      const soldOut = o.weeklyLimit > 0 && bought >= o.weeklyLimit;
      return h('div', { class: 'offer' },
        o.chest ? h('div', { style: 'display:grid;place-items:center;height:56px' }, chestIcon(o.chest, 1.2)) : h('div', { style: 'height:56px;display:grid;place-items:center' }, h('i', { class: 'ico gold', style: 'width:38px;height:38px' })),
        h('b', { class: 'small' }, o.name), h('div', { class: 'small muted' }, o.description),
        o.weeklyLimit ? h('div', { class: 'small muted' }, soldOut ? 'Revient lundi' : `Limite : ${o.weeklyLimit - bought}/${o.weeklyLimit} cette semaine`) : null,
        h('button', { class: `btn small ${o.currency === 'crystals' ? 'crys' : 'gold'}`, disabled: soldOut, onclick: async () => {
          if (!(await confirmSpend(o.name, o.price, o.currency, o.chest ? oddsTable(o.chest) : undefined))) return;
          const r = g.transact((st, t) => buyPermanentOffer(st, o.id, t, g.rng('perm')));
          if (!r.ok) return toast(r.reason!, true);
          await afterPurchase(app, r.value!); render();
        } }, priceTag(o.price, o.currency)),
      );
    }));
    root.append(
      h('div', { class: 'section-title' }, h('h2', null, 'Offres du jour'), h('span', { class: 'small muted' }, `Renouvellement dans ${formatDuration(nextLocalMidnight(now) - now)}`)),
      h('div', { class: 'offers' }, daily),
      h('div', { class: 'section-title' }, h('h2', null, 'Coffres'), h('span', { class: 'small muted' }, 'Probabilités affichées avant achat')),
      perm('coffres'),
      h('div', { class: 'section-title' }, h('h2', null, 'Offres spéciales')),
      perm('speciales'),
      h('div', { class: 'section-title' }, h('h2', null, 'Ressources')),
      perm('ressources'),
      h('div', { class: 'section-title' }, h('h2', null, 'Cosmétiques')),
      h('div', { class: 'offers' }, COSMETICS.map((c) => {
        const owned = s.cosmetics.owned.includes(c.id);
        const equipped = [s.cosmetics.banner, s.cosmetics.emote, s.cosmetics.summonFx].includes(c.id);
        return h('div', { class: 'offer' },
          h('div', { style: `height:46px;border-radius:10px;background:linear-gradient(135deg,${c.colors.join(',')}${c.colors.length === 1 ? ',#120a10' : ''})` }),
          h('b', { class: 'small' }, c.name), h('div', { class: 'small muted' }, `${c.kind === 'banniere' ? 'Bannière' : c.kind === 'emote' ? 'Émote' : 'Effet d’invocation'} · ${c.description}`),
          owned ? h('button', { class: 'btn small', disabled: equipped, onclick: () => { g.transact((st) => equipCosmetic(st, c.id)); render(); } }, equipped ? 'Équipé' : 'Équiper')
            : c.price ? h('button', { class: `btn small ${c.price.crystals ? 'crys' : 'gold'}`, onclick: async () => {
              const price = c.price!.crystals ?? c.price!.gold ?? 0, cur = c.price!.crystals ? 'crystals' : 'gold';
              if (!(await confirmSpend(c.name, price, cur))) return;
              const r = g.transact((st) => buyCosmetic(st, c.id));
              if (!r.ok) return toast(r.reason!, true);
              audio.play('reward'); toast(`${c.name} débloqué !`); render();
            } }, priceTag(c.price.crystals ?? c.price.gold ?? 0, c.price.crystals ? 'crystals' : 'gold'))
            : h('span', { class: 'small muted' }, 'SUPER PASS / événements'),
        );
      })),
      h('div', { class: 'disclaimer' },
        h('b', null, 'Boutique hors ligne. '),
        'Tous les prix sont en monnaies virtuelles gagnées en jouant (or, cristaux). Aucun achat en argent réel n’existe dans cette version ; aucun bouton ne débite de moyen de paiement. ',
        `Les offres du jour se renouvellent à minuit (heure locale). ${Object.keys(CHESTS).length} types de coffres disposent de probabilités publiques.`),
    );
  };
  render();
  const timer = window.setInterval(() => { if (!document.querySelector('.modal-bg')) render(); }, 30000);
  return () => clearInterval(timer);
});
