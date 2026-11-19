// Gemeinsames Lernmodul für Kunst und Bücher.
// Feste Schnittstelle: schedule(state, rating) und due(...). Intern vereinfachtes SM-2;
// später kann hier FSRS (ts-fsrs) eingesetzt werden, ohne dass sich die App ändert.
import type { Lernstand } from '../types'

export type Rating = 1 | 2 | 3 | 4 // Nochmal, Schwer, Gut, Leicht
export const RATING_NAMEN: Record<Rating, string> = { 1: 'Nochmal', 2: 'Schwer', 3: 'Gut', 4: 'Leicht' }

const TAG = 86_400_000
const MIN = 60_000

export function neuerStand(key: string): Lernstand {
  return { key, ease: 2.5, ivl: 0, reps: 0, lapses: 0, due: 0, last: 0, updatedAt: 0 }
}

/** Neuer Lernstand nach einer Bewertung. ivl in Tagen (0 = gleich nochmal). */
export function schedule(s: Lernstand, r: Rating, now = Date.now()): Lernstand {
  let { ease, ivl, reps, lapses } = s
  if (r === 1) {
    lapses += s.reps > 0 ? 1 : 0
    reps = 0
    ivl = 0
    ease = Math.max(1.3, ease - 0.2)
  } else if (r === 2) {
    ivl = reps === 0 ? 1 : Math.max(1, Math.round(ivl * 1.2))
    ease = Math.max(1.3, ease - 0.15)
    reps += 1
  } else if (r === 3) {
    ivl = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(ivl + 1, Math.round(ivl * ease))
    reps += 1
  } else {
    ivl = reps === 0 ? 4 : Math.max(ivl + 2, Math.round(ivl * ease * 1.3))
    ease += 0.15
    reps += 1
  }
  const due = ivl === 0 ? now + 10 * MIN : now + ivl * TAG
  return { ...s, ease, ivl, reps, lapses, due, last: now, updatedAt: now }
}

/** Ist eine Karte fällig? Neue Karten (reps 0, nie gesehen) zählen nicht als fällig. */
export function due(s: Lernstand | undefined, now = Date.now()): boolean {
  return !!s && s.last > 0 && s.due <= now
}
export const istNeu = (s: Lernstand | undefined) => !s || s.last === 0

/** Lesbarer Abstand für die Vorschau auf den Knöpfen. */
export function abstandText(s: Lernstand, r: Rating, now = Date.now()): string {
  const n = schedule(s, r, now)
  const ms = n.due - now
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)} Min`
  const t = Math.round(ms / TAG)
  if (t < 31) return `${t} T`
  if (t < 365) return `${Math.round(t / 30)} Mon`
  return `${(t / 365).toFixed(1)} J`
}

/** Lernstand 0..1 (für Balken): 21 Tage Abstand gelten als „sitzt“. */
export const festigkeit = (s?: Lernstand) => (s && s.last ? Math.min(1, s.ivl / 21) : 0)
