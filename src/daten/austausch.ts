// Import / Export / Komplett-Backup und Migration aus dem Prototyp.
import { db, neueId } from '../db'
import { dataUrlZuBlob, blobZuDataUrl, verkleinere } from '../bild'
import type { Werk, Kuenstler, Quelle } from '../types'

const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])

/** Macht aus beliebigen Eingaben (Prototyp-Export) ein vollständiges Werk. */
export function normalisiere(x: any): Werk {
  return {
    ...x,
    id: String(x.id ?? neueId()), kind: 'werk',
    title: x.title ?? '', artist: x.artist ?? '',
    paintTech: arr<Quelle>(x.paintTech), facts: arr(x.facts), notes: arr(x.notes),
    hotspots: arr(x.hotspots), related: arr(x.related), tags: arr(x.tags),
    updatedAt: x.updatedAt ?? Date.now(),
  }
}

const voll = (v: unknown) => v !== undefined && v !== null && v !== ''
function vereine<T>(alt: T[], neu: T[], schluessel: (e: T) => string): T[] {
  const m = new Map(alt.map((e) => [schluessel(e), e]))
  neu.forEach((e) => m.set(schluessel(e), { ...m.get(schluessel(e)), ...e }))
  return [...m.values()]
}
/** Ergänzt ein vorhandenes Werk, statt es zu ersetzen. */
export function ergaenze(alt: Werk, neu: Werk): Werk {
  const out: any = { ...alt }
  for (const [k, v] of Object.entries(neu)) if (voll(v) && !Array.isArray(v)) out[k] = v
  out.paintTech = vereine(alt.paintTech, neu.paintTech, (e) => e.text)
  out.notes = vereine(alt.notes, neu.notes, (e) => e.text)
  out.facts = vereine(alt.facts, neu.facts, (e) => e.k)
  out.hotspots = vereine(alt.hotspots, neu.hotspots, (e) => e.k)
  out.related = [...new Set([...alt.related, ...neu.related])]
  out.tags = [...new Set([...alt.tags, ...neu.tags])]
  out.deleted = false
  return out
}

/** Bio am Werk → Künstlerprofil (vorhandenes mit gleichem Namen wird ergänzt). */
async function migriereKuenstler(w: Werk, zeit: number): Promise<Werk> {
  if (!w.artist) return w
  const name = w.artist.trim()
  let k = w.artistId ? await db.kuenstler.get(w.artistId) : undefined
  k ??= (await db.kuenstler.where('name').equals(name).toArray()).find((x) => !x.deleted)
  if (!k) k = { id: neueId(), name, dates: w.artistDates, paintTech: [], updatedAt: zeit }
  let geaendert = !w.artistId
  if (w.bio && !k.bio) { k = { ...k, bio: w.bio, bioSource: w.bioSource }; geaendert = true }
  if (geaendert) await db.kuenstler.put({ ...k, updatedAt: zeit })
  const { bio, bioSource, ...rest } = w
  return { ...rest, artistId: k.id }
}

async function bildUebernehmen(w: Werk, zeit: number): Promise<Werk> {
  if (typeof w.image === 'string' && w.image.startsWith('data:')) {
    const blob = await verkleinere(await dataUrlZuBlob(w.image))
    const id = neueId()
    await db.bilder.put({ id, blob, updatedAt: zeit })
    return { ...w, image: 'bild:' + id }
  }
  return w
}

/** Importiert Werke (Array, {werke}, {works} oder Komplett-Backup). Gibt Zahlen zurück.
 *  `zeit` = updatedAt der importierten Datensätze (Startdaten: 1, damit Daten vom Server immer gewinnen). */
export async function importiere(daten: any, zeit = Date.now()): Promise<{ neu: number; ergaenzt: number }> {
  if (daten?.format === 'hamid-read-backup') return stelleBackupHer(daten)
  const liste: any[] = Array.isArray(daten) ? daten : daten?.werke ?? daten?.works ?? daten?.items ?? []
  let neu = 0, ergaenzt = 0
  for (const roh of liste) {
    if (!roh || (roh.kind && roh.kind !== 'werk')) continue
    let w = await bildUebernehmen(normalisiere(roh), zeit)
    const alt = await db.werke.get(w.id)
    if (alt) { w = ergaenze(alt, w); ergaenzt++ } else neu++
    w = await migriereKuenstler(w, zeit)
    await db.werke.put({ ...w, updatedAt: zeit })
  }
  await verknuepfeBeidseitig(zeit)
  return { neu, ergaenzt }
}

/** Verwandte Werke immer beidseitig. */
export async function verknuepfeBeidseitig(zeit = Date.now()) {
  const ws = await db.werke.toArray()
  const m = new Map(ws.map((w) => [w.id, w]))
  const geaendert = new Set<string>()
  for (const w of ws) for (const r of w.related) {
    const z = m.get(r)
    if (z && !z.related.includes(w.id)) { z.related = [...z.related, w.id]; geaendert.add(z.id) }
  }
  await db.werke.bulkPut([...geaendert].map((id) => ({ ...m.get(id)!, updatedAt: Math.max(zeit, m.get(id)!.updatedAt) })))
}

/** Export wie im Prototyp: ohne Lernstand und ohne Bilder. */
export async function exportWerke() {
  const [ws, ks] = await Promise.all([db.werke.toArray(), db.kuenstler.toArray()])
  const km = new Map(ks.map((k) => [k.id, k]))
  return ws.filter((w) => !w.deleted).map(({ updatedAt, deleted, image, _srv, ...w }: any) => {
    const k = w.artistId ? km.get(w.artistId) : undefined
    return { ...w, image: image && !image.startsWith('bild:') ? image : null, bio: k?.bio, bioSource: k?.bioSource, kuenstlerTechnik: k?.paintTech }
  })
}

export async function komplettBackup() {
  const bilder: Record<string, string> = {}
  for (const b of await db.bilder.toArray()) bilder[b.id] = await blobZuDataUrl(b.blob)
  const dateien: Record<string, { name: string; daten: string; updatedAt: number }> = {}
  for (const d of await db.dateien.toArray()) if (!d.deleted) dateien[d.id] = { name: d.name, daten: await blobZuDataUrl(d.blob), updatedAt: d.updatedAt }
  return {
    format: 'hamid-read-backup', version: 2, erstellt: new Date().toISOString(),
    werke: await db.werke.toArray(), kuenstler: await db.kuenstler.toArray(),
    abc: await db.abc.toArray(), proben: await db.proben.toArray(), lernstand: await db.lernstand.toArray(),
    buecher: await db.buecher.toArray(), markierungen: await db.markierungen.toArray(), buchkarten: await db.buchkarten.toArray(),
    bilder, dateien,
  }
}

/** Backup zurückspielen: pro Datensatz gewinnt der neuere updatedAt. */
async function stelleBackupHer(b: any) {
  let neu = 0, ergaenzt = 0
  const tabellen: [any, any[], string][] = [
    [db.werke, b.werke, 'id'], [db.kuenstler, b.kuenstler, 'id'], [db.abc, b.abc, 'id'],
    [db.proben, b.proben, 'id'], [db.lernstand, b.lernstand, 'key'],
    [db.buecher, b.buecher, 'id'], [db.markierungen, b.markierungen, 'id'], [db.buchkarten, b.buchkarten, 'id'],
  ]
  for (const [t, liste, pk] of tabellen) for (const { _srv, ...e } of arr<any>(liste)) {
    const alt = await t.get(e[pk])
    if (!alt) { await t.put(e); if (t === db.werke) neu++ }
    else if ((e.updatedAt ?? 0) > (alt.updatedAt ?? 0)) { await t.put(e); if (t === db.werke) ergaenzt++ }
  }
  for (const [id, url] of Object.entries(b.bilder ?? {}))
    if (!(await db.bilder.get(id))) await db.bilder.put({ id, blob: await dataUrlZuBlob(url as string), updatedAt: Date.now() })
  for (const [id, d] of Object.entries<any>(b.dateien ?? {}))
    if (!(await db.dateien.get(id))) await db.dateien.put({ id, name: d.name, blob: await dataUrlZuBlob(d.daten), updatedAt: d.updatedAt ?? Date.now() })
  return { neu, ergaenzt }
}

export function ladeHerunter(name: string, daten: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Erster Start: daten/werke-start.json importieren (falls vorhanden), sonst Beispieldaten. */
export async function ersterStart() {
  if (await db.meta.get('initialisiert')) return
  const start = import.meta.glob('../../daten/werke-start.json', { eager: true, import: 'default' })
  const daten = Object.values(start)[0]
  // Sehr alter Zeitstempel: Daten, die schon auf dem Server liegen, haben immer Vorrang.
  if (daten) await importiere(daten, 1)
  else await importiere((await import('./beispiel')).BEISPIEL, 1)
  await db.meta.put({ key: 'initialisiert', value: Date.now() })
}

export type { Kuenstler }
