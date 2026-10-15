// Outil de développement : aperçu de toutes les illustrations et poses d'unités.
import { CARDS, cardPrimaryUnit } from '../src/core/cards';
import { cardArtUrl } from '../src/render/cardArt';
import { drawCachedMonster } from '../src/render/spriteCache';

const g = document.getElementById('g')!;
const only = new URLSearchParams(location.search).get('mode');
if (only === 'one') {
  const id = new URLSearchParams(location.search).get('id') ?? 'colosse_chair';
  const d = document.createElement('div');
  d.innerHTML = `<img style="width:720px;height:900px" src="${cardArtUrl(id, 720, 900)}">`;
  g.appendChild(d);
} else if (only === 'big') {
  for (const id of ['charognard', 'titan_ossuaire', 'colosse_chair', 'l_innommable', 'mante_corne', 'golem_rivets', 'wyrm_cendres', 'reine_ruche']) {
    const d = document.createElement('div');
    d.innerHTML = `<img style="width:300px;height:375px" src="${cardArtUrl(id, 360, 450)}">`;
    g.appendChild(d);
  }
} else if (only !== 'sprites') {
  for (const c of CARDS) {
    const d = document.createElement('div'); d.className = 'c';
    d.innerHTML = `<img src="${cardArtUrl(c.id, 240, 300)}"><div>${c.name}</div>`;
    g.appendChild(d);
  }
}
if (only === 'sprites') {
  const cv = document.createElement('canvas'); cv.width = 1200; cv.height = 900;
  document.getElementById('sprites')!.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  let i = 0;
  for (const c of CARDS) {
    const u = cardPrimaryUnit(c); if (!u) continue;
    const x = 60 + (i % 12) * 95, y = 110 + Math.floor(i / 12) * 150;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(x, y, 25 * u.visual.scale, 8 * u.visual.scale, 0, 0, 7); ctx.fill();
    drawCachedMonster(ctx, u.visual, x, y, 40, 1 + i, true, i % 3 === 0 ? 0.5 : 0, false);
    ctx.fillStyle = '#ccc'; ctx.font = '10px sans-serif'; ctx.fillText(u.name.slice(0, 16), x - 40, y + 30);
    i++;
  }
}
