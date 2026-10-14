// Petits utilitaires DOM : création d'éléments, modales, confirmations, toasts, composants de cartes.
import { CARD_MAP } from '../core/cards';
import { RARITY_INFO } from '../core/progression';
import { audio } from '../audio/audio';
import { cardArtUrl } from '../render/cardArt';
import type { CardOwnership } from '../meta/state';
import { fragmentsToUpgrade } from '../core/progression';
import { CHESTS } from '../meta/catalog';
import type { ChestType } from '../meta/state';

type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; style?: string; onclick?: (e: MouseEvent) => void };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') {
        const handler = v as (e: Event) => void;
        el.addEventListener(k.slice(2), (e) => { if (k === 'onclick') audio.play('click'); handler(e); });
      } else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k === 'html') el.innerHTML = String(v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmt(n: number): string { return Math.round(n).toLocaleString('fr-FR'); }

let toastTimer: number | undefined;
export function toast(msg: string, err = false): void {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = h('div', { class: `toast${err ? ' err' : ''}` }, msg);
  document.body.appendChild(t);
  if (err) audio.play('error');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 2400);
}

export function modal(content: HTMLElement, opts: { dismissable?: boolean; onClose?: () => void } = {}): () => void {
  const bg = h('div', { class: 'modal-bg' }, h('div', { class: 'modal' }, content));
  const close = () => { bg.remove(); opts.onClose?.(); };
  if (opts.dismissable !== false) bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  return close;
}

export function confirmDialog(title: string, body: string | HTMLElement, okLabel = 'Confirmer', okClass = 'primary'): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: boolean) => { if (!done) { done = true; close(); resolve(v); } };
    const close = modal(h('div', { class: 'col' },
      h('h2', null, title),
      typeof body === 'string' ? h('p', { class: 'muted' }, body) : body,
      h('div', { class: 'row', style: 'justify-content:flex-end;margin-top:8px' },
        h('button', { class: 'btn', onclick: () => finish(false) }, 'Annuler'),
        h('button', { class: `btn ${okClass}`, onclick: () => finish(true) }, okLabel)),
    ), { onClose: () => { if (!done) { done = true; resolve(false); } } });
  });
}

export function priceTag(price: number, currency: 'gold' | 'crystals' | 'free'): HTMLElement {
  if (currency === 'free') return h('span', null, 'GRATUIT');
  return h('span', { class: 'row', style: 'justify-content:center;gap:4px' }, h('i', { class: `ico ${currency === 'gold' ? 'gold' : 'crys'}` }), fmt(price));
}

export function cardTile(cardId: string, own?: CardOwnership, opts: { showLevel?: boolean; onclick?: () => void; extraClass?: string; showProgress?: boolean } = {}): HTMLElement {
  const c = CARD_MAP[cardId];
  const r = RARITY_INFO[c.rarity];
  const locked = own && !own.owned;
  const needed = own ? fragmentsToUpgrade(c.rarity, own.level) : null;
  const canUp = own?.owned && needed !== null && own.fragments >= needed;
  const legend = c.rarity === 'legendaire' || c.rarity === 'abyssal';
  const el = h('div', { class: `card${locked ? ' locked' : ''}${legend ? ' legend' : ''} ${opts.extraClass ?? ''}`, style: `--rc:${r.color}`, 'data-card': cardId, onclick: opts.onclick },
    h('div', { class: 'art', style: `background-image:url(${cardArtUrl(cardId)})` }),
    h('div', { class: 'cost' }, c.cost),
    opts.showLevel && own?.owned ? h('div', { class: 'lv' }, `Niv. ${own.level}`) : null,
    canUp ? h('div', { class: 'up' }, '▲') : null,
    opts.showProgress && own?.owned && needed !== null ? h('div', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (own.fragments / needed) * 100)}%` })) : null,
    h('div', { class: 'nm' }, c.name),
  );
  return el;
}

export function chestIcon(type: ChestType, size = 1): HTMLElement {
  const d = CHESTS[type];
  return h('div', { class: 'chest-ico', style: `background:linear-gradient(${d.color}, #1a1014);transform:scale(${size})` });
}

export function rarityChip(rarity: keyof typeof RARITY_INFO): HTMLElement {
  const r = RARITY_INFO[rarity];
  return h('span', { class: 'tag', style: `border-color:${r.color};color:${r.glow}` }, r.label);
}

/** Ajoute des enfants en ignorant les valeurs nulles. */
export function add(root: HTMLElement, ...children: (Node | string | null | undefined | false)[]): void {
  for (const c of children) if (c !== null && c !== undefined && c !== false) root.append(c);
}
