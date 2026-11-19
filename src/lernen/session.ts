// Stellt eine Lerneinheit zusammen: fällige Karten zuerst, dann begrenzt neue.
import { db, aktiveWerke } from '../db'
import { promptsFor, type Prompt } from '../kunst/prompts'
import { due, istNeu } from './scheduler'
import type { Lernstand } from '../types'

export type Bereich = 'alles' | 'kunst' | 'buecher'

export async function allePrompts(): Promise<Prompt[]> {
  const [werke, ks] = await Promise.all([aktiveWerke(), db.kuenstler.toArray()])
  const km = new Map(ks.map((k) => [k.id, k]))
  return werke.flatMap((w) => promptsFor(w, w.artistId ? km.get(w.artistId) : undefined))
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

export async function startSession(opt: { bereich: Bereich; werkId?: string; neue: number }): Promise<Prompt[]> {
  if (opt.bereich === 'buecher') return [] // Bücherkarten folgen in Phase 3
  let ps = await allePrompts()
  if (opt.werkId) ps = ps.filter((p) => p.werkId === opt.werkId)
  const st = await staendeMap()
  const now = Date.now()
  const faellig = ps.filter((p) => due(st.get(p.key), now)).sort((a, b) => st.get(a.key)!.due - st.get(b.key)!.due)
  // Neue Karten werkweise in Reihenfolge (erst Künstler, dann Titel …), Werke gemischt
  const neu = ps.filter((p) => istNeu(st.get(p.key)))
  const nachWerk = new Map<string, Prompt[]>()
  neu.forEach((p) => nachWerk.set(p.werkId, [...(nachWerk.get(p.werkId) ?? []), p]))
  const neuSortiert = mische([...nachWerk.values()]).flat()
  const limit = opt.werkId ? Infinity : opt.neue
  return [...faellig, ...neuSortiert.slice(0, limit)]
}
