// Lernfragen eines Werks entstehen automatisch aus seinen Feldern.
import type { Werk, Kuenstler } from '../types'

export type Prompt = {
  key: string            // `${werkId}~${art}` – nie ändern, sonst geht der Lernstand verloren
  werkId: string
  art: string
  frage: string
  antwort: string
  quelle?: string
  zeigeBild: boolean
  hotspot?: { x: number; y: number }
  laut?: boolean         // erst laut erzählen, dann aufdecken
}

const txt = (l: { text: string }[]) => l.map((e) => e.text).filter(Boolean).join('\n\n')

export function promptsFor(w: Werk, k?: Kuenstler): Prompt[] {
  const p: Prompt[] = []
  const add = (art: string, x: Omit<Prompt, 'key' | 'werkId' | 'art'>) => p.push({ key: `${w.id}~${art}`, werkId: w.id, art, ...x })
  const hatBild = !!w.image
  if (w.artist && hatBild) add('kuenstler', { frage: 'Wer hat dieses Bild gemalt?', antwort: w.artist + (w.artistDates ? ` (${w.artistDates})` : ''), zeigeBild: true })
  if (w.title && hatBild) add('titel', { frage: 'Wie heißt dieses Werk?', antwort: w.title, zeigeBild: true })
  if (w.year) add('datierung', { frage: `Wann entstand „${w.title}“ von ${w.artist}?`, antwort: w.year, zeigeBild: hatBild })
  if (w.technique || w.dimensions)
    add('material', { frage: `Technik und Maße von „${w.title}“?`, antwort: [w.technique, w.dimensions].filter(Boolean).join(', '), zeigeBild: hatBild })
  const bio = k?.bio ?? w.bio
  if (bio) add('bio', { frage: `Erzähle laut: Wer war ${w.artist}?`, antwort: bio, quelle: k?.bioSource ?? w.bioSource, zeigeBild: false, laut: true })
  if (w.paintTech.length)
    add('technik', { frage: `Was ist besonders an der Maltechnik von „${w.title}“?`, antwort: txt(w.paintTech), quelle: w.paintTech.map((e) => e.src).filter(Boolean).join('; '), zeigeBild: hatBild, laut: true })
  if (k?.paintTech.length)
    add('ktechnik', { frage: `Wie malte ${w.artist} typischerweise?`, antwort: txt(k.paintTech), quelle: k.paintTech.map((e) => e.src).filter(Boolean).join('; '), zeigeBild: false, laut: true })
  for (const f of w.facts) if (f.q && f.a) add('f' + f.k, { frage: f.q, antwort: f.a, quelle: f.src, zeigeBild: false })
  for (const h of w.hotspots)
    if (h.a) add('h' + h.k, { frage: h.q || 'Was ist an dieser Stelle zu sehen?', antwort: h.a, zeigeBild: true, hotspot: { x: h.x, y: h.y } })
  return p
}

/** Nächster freier, stabiler Schlüssel für facts/hotspots. */
export function neuerK(liste: { k: string }[]): string {
  const n = liste.map((e) => parseInt(e.k, 36)).filter((x) => !isNaN(x))
  return ((n.length ? Math.max(...n) : 0) + 1).toString(36)
}
