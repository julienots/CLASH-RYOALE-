import { dayKey, nextLocalMidnight, seasonAt, weekKey } from '../src/meta/time';
import { Game } from '../src/meta/game';
import { MemoryStore } from '../src/meta/save';

describe('Horloge locale et changements d’heure', () => {
  const prevTz = process.env.TZ;
  beforeAll(() => { process.env.TZ = 'Europe/Paris'; });
  afterAll(() => { process.env.TZ = prevTz; });

  it('jour de passage à l’heure d’hiver (25 h) : une seule clé de jour, minuit suivant correct', () => {
    const morning = new Date(2026, 9, 25, 0, 30).getTime(); // 25 octobre 2026, jour de 25 h
    const evening = new Date(2026, 9, 25, 23, 30).getTime();
    expect(evening - morning).toBe(24 * 3600000); // 23 h d'horloge = 24 h réelles ce jour-là
    expect(dayKey(morning)).toBe('2026-10-25');
    expect(dayKey(evening)).toBe('2026-10-25');
    expect(dayKey(nextLocalMidnight(morning))).toBe('2026-10-26');
  });

  it('jour de passage à l’heure d’été (23 h) : pas de jour sauté ni dupliqué', () => {
    const d = new Date(2026, 2, 29, 12).getTime();
    expect(dayKey(d)).toBe('2026-03-29');
    expect(dayKey(nextLocalMidnight(d))).toBe('2026-03-30');
    expect(dayKey(nextLocalMidnight(d) - 1)).toBe('2026-03-29');
  });

  it('les offres ne sont régénérées qu’une fois par jour malgré le changement d’heure', () => {
    const t = { v: new Date(2026, 9, 25, 0, 30).getTime() };
    const g = new Game(new MemoryStore(), { now: () => t.v });
    const ids = g.data.shop.offers.map((o) => o.id).join();
    t.v = new Date(2026, 9, 25, 23, 59).getTime(); g.refresh();
    expect(g.data.shop.offers.map((o) => o.id).join()).toBe(ids);
    t.v = new Date(2026, 9, 26, 0, 1).getTime(); g.refresh();
    expect(g.data.shop.offers.map((o) => o.id).join()).not.toBe(ids);
  });

  it('semaines et saisons cohérentes', () => {
    expect(weekKey(new Date(2026, 9, 25, 23).getTime())).toBe(weekKey(new Date(2026, 9, 19, 1).getTime()));
    const s = seasonAt(new Date(2026, 9, 14).getTime());
    expect(s.end).toBeGreaterThan(s.start);
    expect(seasonAt(s.end).index).toBe(s.index + 1);
  });
});
