// Markierungen anlegen, ändern, löschen.
import { db, neueId } from '../db'
import type { Farbe, Markierung } from '../types'

export type Auswahl = { text: string; position: string; seite?: number; kapitel?: string }

export async function markiere(buchId: string, a: Auswahl, farbe: Farbe): Promise<Markierung> {
  const now = Date.now()
  const m: Markierung = { id: neueId(), buchId, farbe, text: a.text.trim(), position: a.position, seite: a.seite, kapitel: a.kapitel, createdAt: now, updatedAt: now }
  await db.markierungen.put(m)
  await db.buecher.update(buchId, { updatedAt: now })
  return m
}
export const aendereMarkierung = (m: Markierung, x: Partial<Markierung>) => db.markierungen.put({ ...m, ...x, updatedAt: Date.now() })
export const loescheMarkierung = (m: Markierung) => aendereMarkierung(m, { deleted: true })

/** Auswahl, die mitten in einem Wort beginnt oder endet, auf ganze Wörter erweitern. */
export function aufWortgrenzen(r: Range): Range {
  const x = r.cloneRange()
  const w = (c?: string) => !!c && /[\p{L}\p{N}'’-]/u.test(c)
  const s = x.startContainer
  if (s.nodeType === Node.TEXT_NODE) {
    const t = s.textContent ?? ''; let o = x.startOffset
    if (w(t[o])) while (o > 0 && w(t[o - 1])) o--
    x.setStart(s, o)
  }
  const e = x.endContainer
  if (e.nodeType === Node.TEXT_NODE) {
    const t = e.textContent ?? ''; let o = x.endOffset
    if (w(t[o - 1])) while (o < t.length && w(t[o])) o++
    x.setEnd(e, o)
  }
  return x
}
