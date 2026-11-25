// Stellt eine Lerneinheit zusammen: fällige Karten zuerst, dann begrenzt neue.
import { db, aktiveWerke, aktiveBuecher } from '../db'
import { promptsFor, type Prompt } from '../kunst/prompts'
import { due, istNeu } from './scheduler'
import type { Lernstand } from '../types'
import { promptFuerKarte } from './buchPrompts'

export type Bereich = 'alles' | 'kunst' | 'buecher'

export async function kunstPrompts(): Promise<Prompt[]> {
  const [werke, ks] = await Promise.all([aktiveWerke(), db.kuenstler.toArray()])
  const km = new Map(ks.map((k) => [k.id, k]))
  return werke.flatMap((w) => promptsFor(w, w.artistId ? km.get(w.artistId) : undefined))
}
export async function buchPrompts(buchId?: string): Promise<Prompt[]> {
  const [buecher, karten, ms] = await Promise.all([aktiveBuecher(), db.buchkarten.toArray(), db.markierungen.toArray()])
  const bm = new Map(buecher.map((b) => [b.id, b])), mm = new Map(ms.map((m) => [m.id, m]))
  return karten.filter((k) => !k.deleted && k.status === 'aktiv' && bm.has(k.buchId) && (!buchId || k.buchId === buchId))
    .filter((k) => !k.markierungId || !mm.get(k.markierungId)?.deleted)
    .map((k) => promptFuerKarte(k, bm.get(k.buchId), k.markierungId ? mm.get(k.markierungId) : undefined))
}
export async function allePrompts(): Promise<Prompt[]> {
  return [...(await kunstPrompts()), ...(await buchPrompts())]
}

/** Wie viele neue Karten heute schon gelernt wurden (Tagesgrenze). */
const heute = () => new Date().toDateString()
export async function neueHeute(): Promise<number> {
  const m = (await db.meta.get('neu-heute'))?.value as { tag: string; n: number } | undefined
  return m?.tag === heute() ? m.n : 0
}
export async function zaehleNeu() {
  await db.meta.put({ key: 'neu-heute', value: { tag: heute(), n: (await neueHeute()) + 1 } })
}

export async function staendeMap(): Promise<Map<string, Lernstand>> {
  return new Map((await db.lernstand.toArray()).map((s) => [s.key, s]))
}

export async function zaehleFaellig(): Promise<number> {
  const [ps, st] = await Promise.all([allePrompts(), staendeMap()])
  const now = Date.now()
  return ps.filter((p) => due(st.get(p.key), now)).length
}

const mische = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}

export async function startSession(opt: { bereich: Bereich; werkId?: string; buchId?: string; neue: number; neueProTag: number }): Promise<Prompt[]> {
  let ps: Prompt[]
  if (opt.werkId) ps = (await kunstPrompts()).filter((p) => p.werkId === opt.werkId)
  else if (opt.buchId) ps = await buchPrompts(opt.buchId)
  else if (opt.bereich === 'kunst') ps = await kunstPrompts()
  else if (opt.bereich === 'buecher') ps = await buchPrompts()
  else ps = await allePrompts()
  const st = await staendeMap()
  const now = Date.now()
  const faellig = ps.filter((p) => due(st.get(p.key), now)).sort((a, b) => st.get(a.key)!.due - st.get(b.key)!.due)
  // Neue Karten werkweise in Reihenfolge (erst Künstler, dann Titel …), Werke gemischt
  const neu = ps.filter((p) => istNeu(st.get(p.key)))
  const nachWerk = new Map<string, Prompt[]>()
  neu.forEach((p) => { const g = p.werkId ?? 'b' + p.key; nachWerk.set(g, [...(nachWerk.get(g) ?? []), p]) })
  // Grün markierte Stellen („wusste ich noch nicht“) kommen bevorzugt dran
  const neuSortiert = mische([...nachWerk.values()]).flat().sort((a, b) => +(b.farbe === 'gruen') - +(a.farbe === 'gruen'))
  const rest = Math.max(0, opt.neueProTag - (await neueHeute()))
  const limit = opt.werkId || opt.buchId ? Infinity : Math.min(opt.neue, rest)
  return [...faellig, ...neuSortiert.slice(0, limit)]
}
