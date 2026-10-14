// Profil, statistiques, cosmétiques équipés + paramètres (audio, commandes, qualité, sauvegarde).
import { audio } from '../../audio/audio';
import { CARDS } from '../../core/cards';
import { towerPowerForAccount, xpForLevel } from '../../core/progression';
import { ARENAS, arenaFor, COSMETIC_MAP, COSMETICS } from '../../meta/catalog';
import { equipCosmetic, ownedCount } from '../../meta/economy';
import { DIFFICULTY_ORDER } from '../../meta/match';
import { DIFFICULTIES } from '../../sim/ai';
import type { Settings } from '../../meta/state';
import { registerScreen } from '../app';
import { confirmDialog, fmt, h, toast } from '../dom';

registerScreen('profile', (app, root) => {
  const render = () => {
    const g = app.game, s = g.data;
    const arena = arenaFor(s.profile.trophies);
    const banner = COSMETIC_MAP[s.cosmetics.banner];
    const st = s.stats;
    const stat = (l: string, v: string | number) => [h('span', null, l), h('b', null, typeof v === 'number' ? fmt(v) : v), h('span')];
    const nameInput = h('input', { value: s.profile.name, maxlength: 16, style: 'background:#0c070a;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:6px;font:inherit;width:100%' }) as HTMLInputElement;
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim().slice(0, 16);
      if (v.length < 2) return toast('Nom trop court', true);
      g.transact((x) => { x.profile.name = v; return { ok: true }; });
      toast('Nom enregistré');
    });
    root.innerHTML = '';
    root.append(
      h('div', { class: 'panel', style: `background:linear-gradient(135deg,${banner.colors[0]},${banner.colors[1] ?? '#120a10'} 140%)` },
        h('div', { class: 'row' }, h('div', { style: 'width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:900;background:radial-gradient(#b98cff,#4b2a7a)' }, s.profile.level),
          h('div', { class: 'grow' }, nameInput, h('div', { class: 'small', style: 'margin-top:4px' }, `${arena.name} · ${s.profile.trophies} trophées (record ${s.profile.bestTrophies})`))),
        h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'prog grow' }, h('i', { style: `width:${(s.profile.xp / xpForLevel(s.profile.level)) * 100}%` })), h('span', { class: 'small' }, `${s.profile.xp}/${xpForLevel(s.profile.level)} XP`)),
        h('div', { class: 'small', style: 'margin-top:4px' }, `Niveau des tours : ${towerPowerForAccount(s.profile.level)} · gagnez de l’XP en combattant et en améliorant des cartes.`),
      ),
      h('div', { class: 'panel' }, h('h3', null, 'Statistiques'), h('div', { class: 'stats', style: 'margin-top:6px' },
        stat('Combats', st.battles), stat('Victoires', st.wins), stat('Défaites', st.losses), stat('Égalités', st.draws),
        stat('Taux de victoire', st.battles ? `${Math.round((st.wins / st.battles) * 100)} %` : '—'), stat('Victoires 3 couronnes', st.threeCrowns),
        stat('Meilleure série', st.bestStreak), stat('Cartes jouées', st.cardsPlayed), stat('Sorts lancés', st.spellsCast), stat('Tours détruites', st.towersDestroyed),
        stat('Unités éliminées', st.unitsKilled), stat('Coffres ouverts', st.chestsOpened), stat('Améliorations', st.upgrades),
        stat('Collection', `${ownedCount(s)}/${CARDS.length}`), stat('Meilleur bot vaincu', st.bestDifficulty >= 0 ? DIFFICULTIES[DIFFICULTY_ORDER[st.bestDifficulty]].label : '—'))),
      h('div', { class: 'panel' }, h('h3', null, 'Cercles'), ...ARENAS.map((a) => h('div', { class: 'row small', style: `margin-top:4px;${s.profile.trophies >= a.minTrophies ? '' : 'opacity:.45'}` }, h('span', { style: `width:10px;height:10px;border-radius:50%;background:${a.accent}` }), h('span', { class: 'grow' }, a.name), h('span', null, `${a.minTrophies}+ · bot ${DIFFICULTIES[a.difficulty].label}`)))),
      h('div', { class: 'panel' }, h('h3', null, 'Cosmétiques'),
        ...(['banniere', 'emote', 'invocation'] as const).map((kind) => h('div', { style: 'margin-top:8px' },
          h('div', { class: 'small muted' }, kind === 'banniere' ? 'Bannière' : kind === 'emote' ? 'Émote' : 'Effet d’invocation (visible en combat)'),
          h('div', { class: 'row', style: 'flex-wrap:wrap;margin-top:4px' }, COSMETICS.filter((c) => c.kind === kind).map((c) => {
            const owned = s.cosmetics.owned.includes(c.id);
            const on = [s.cosmetics.banner, s.cosmetics.emote, s.cosmetics.summonFx].includes(c.id);
            return h('button', { class: `btn small${on ? ' ok' : ''}`, disabled: !owned, onclick: () => { g.transact((x) => equipCosmetic(x, c.id)); render(); } }, owned ? c.name : `🔒 ${c.name}`);
          })))),
      ),
    );
  };
  render();
});

registerScreen('settings', (app, root) => {
  const render = () => {
    const g = app.game, set = g.data.settings;
    const update = (patch: Partial<Settings>) => {
      g.transact((s) => { s.settings = { ...s.settings, ...patch }; return { ok: true }; });
      audio.setVolumes(g.data.settings.music, g.data.settings.sfx);
    };
    const slider = (label: string, key: 'music' | 'sfx') => {
      const el = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: set[key], class: 'slider' }) as HTMLInputElement;
      el.addEventListener('input', () => { update({ [key]: Number(el.value) }); if (key === 'sfx') audio.play('hit'); });
      return h('div', null, h('div', { class: 'row small' }, h('span', { class: 'grow' }, label), `${Math.round(set[key] * 100)} %`), el);
    };
    const choice = <K extends keyof Settings>(label: string, key: K, opts: [Settings[K], string][]) =>
      h('div', { style: 'margin-top:10px' }, h('div', { class: 'small muted' }, label), h('div', { class: 'tabs', style: 'margin:4px 0 0' }, opts.map(([v, l]) => h('button', { class: set[key] === v ? 'on' : '', onclick: () => { update({ [key]: v } as Partial<Settings>); render(); } }, l))));
    root.innerHTML = '';
    root.append(
      h('div', { class: 'section-title' }, h('h2', null, 'Paramètres'), h('button', { class: 'btn small', onclick: () => app.back() }, 'Retour')),
      h('div', { class: 'panel col' }, h('h3', null, 'Audio'), slider('Musique', 'music'), slider('Effets sonores', 'sfx')),
      h('div', { class: 'panel' }, h('h3', null, 'Commandes'),
        choice('Déploiement des cartes', 'deployMode', [['glisser', 'Glisser-déposer (+ toucher)'], ['toucher', 'Toucher la carte puis l’arène']]),
        choice('Grille de l’arène', 'showGrid', [[true, 'Visible'], [false, 'Masquée']]),
        choice('Chiffres de dégâts', 'damageNumbers', [[true, 'Affichés'], [false, 'Masqués']]),
        choice('Vibrations', 'vibration', [[true, 'Activées'], [false, 'Désactivées']])),
      h('div', { class: 'panel' }, h('h3', null, 'Qualité graphique'),
        choice('Préréglage', 'quality', [['basse', 'Basse (appareils modestes)'], ['moyenne', 'Moyenne'], ['haute', 'Haute']]),
        h('div', { class: 'small muted', style: 'margin-top:6px' }, 'Basse : moins de particules, sans halos ni flashs, résolution réduite.')),
      h('div', { class: 'panel' }, h('h3', null, 'Sauvegarde'),
        h('p', { class: 'small muted' }, `Sauvegarde locale avec copie de secours et somme de contrôle. État au chargement : ${g.recovered === 'main' ? 'principale valide' : g.recovered === 'backup' ? 'restaurée depuis la copie de secours' : 'nouvelle partie'}.`),
        h('button', { class: 'btn', onclick: async () => {
          if (!(await confirmDialog('Effacer la progression ?', 'Toutes les cartes, monnaies et statistiques seront perdues. Cette action est irréversible.', 'Continuer'))) return;
          if (!(await confirmDialog('Vraiment tout effacer ?', 'Dernière confirmation.', 'Tout effacer'))) return;
          g.resetAll(); toast('Progression réinitialisée'); app.go('home');
        } }, 'Réinitialiser la progression')),
      h('div', { class: 'panel small muted' },
        h('b', null, 'SUPERESSENCE : Abyss Arena'), ' — version 0.1.0 hors ligne. Créatures, illustrations, sons et musique générés procéduralement par le jeu (créations originales). ',
        'Aucune connexion Internet requise. Aucun achat réel. Le multijoueur en ligne n’existe pas encore.'),
    );
  };
  render();
});
