// Horloge locale, clés de jour/semaine et saisons — fonctionne entièrement hors ligne.

export interface Clock { now(): number }
export const systemClock: Clock = { now: () => Date.now() };

/** Clé de jour calendaire locale (gère les changements d'heure : on compare des dates, pas des durées). */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Clé de semaine ISO locale (lundi = début). */
export function weekKey(ms: number): string {
  const d = new Date(ms);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return `S-${dayKey(monday.getTime())}`;
}

/** Prochaine minuit locale (pour le compte à rebours de la boutique). */
export function nextLocalMidnight(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

export const SEASON_DAYS = 28;
/** Origine des saisons (lundi 5 janvier 2026, heure locale). */
export function seasonEpoch(): number { return new Date(2026, 0, 5).getTime(); }

export const SEASON_NAMES = [
  'Marée de Chitine', 'Nuit des Sutures', 'Le Grand Ossuaire', 'Rouille Écarlate', 'Les Yeux du Gouffre', 'Pluie de Bile',
];

export interface SeasonInfo { index: number; id: string; name: string; start: number; end: number }

export function seasonAt(ms: number): SeasonInfo {
  const epoch = seasonEpoch();
  const idx = Math.max(0, Math.floor((ms - epoch) / (SEASON_DAYS * 86400000)));
  const startD = new Date(epoch); startD.setDate(startD.getDate() + idx * SEASON_DAYS);
  const endD = new Date(epoch); endD.setDate(endD.getDate() + (idx + 1) * SEASON_DAYS);
  return { index: idx, id: `S${idx + 1}`, name: SEASON_NAMES[idx % SEASON_NAMES.length], start: startD.getTime(), end: endD.getTime() };
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return 'prêt';
  const s = Math.ceil(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d} j ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${sec} s`;
  return `${sec} s`;
}
