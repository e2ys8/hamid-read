// Sync zwischen Geräten über Supabase.
// Lokal zuerst: Die App arbeitet immer mit IndexedDB. Der Sync schiebt lokale Änderungen hoch
// und holt neue Zeilen vom Server. Konflikt: neuester updatedAt gewinnt (auch auf dem Server per Trigger).
// Vom Server geholte Datensätze tragen `_srv` = ihr updatedAt; solange beide gleich sind,
// wird der Datensatz nicht zurückgeschickt.
import { useSyncExternalStore } from 'react'
import type { Table } from 'dexie'
import type { RealtimeChannel, Session } from '@supabase/supabase-js'
import { db } from '../db'
import { supabase } from './supabase'

export type Status = 'aus' | 'abgemeldet' | 'laeuft' | 'synchron' | 'offline' | 'fehler'
type Zustand = { status: Status; fehler?: string; zuletzt?: number; email?: string }

let zustand: Zustand = { status: supabase ? 'abgemeldet' : 'aus' }
const hoerer = new Set<() => void>()
const setze = (z: Partial<Zustand>) => { zustand = { ...zustand, ...z }; hoerer.forEach((h) => h()) }
export const useSync = () => useSyncExternalStore((h) => (hoerer.add(h), () => hoerer.delete(h)), () => zustand)

// datei: Storage-Bucket für den Blob der Zeile; endung: Dateiendung im Bucket
type Def = { name: string; table: Table<any, string>; pk: string; datei?: 'bilder' | 'buecher'; endung?: string }
const TABELLEN: Def[] = [
  { name: 'kuenstler', table: db.kuenstler, pk: 'id' },
  { name: 'werke', table: db.werke, pk: 'id' },
  { name: 'abc', table: db.abc, pk: 'id' },
  { name: 'proben', table: db.proben, pk: 'id' },
  { name: 'lernstand', table: db.lernstand, pk: 'key' },
  { name: 'bilder', table: db.bilder, pk: 'id', datei: 'bilder', endung: '.jpg' },
  { name: 'buecher', table: db.buecher, pk: 'id' },
  { name: 'markierungen', table: db.markierungen, pk: 'id' },
  { name: 'buchkarten', table: db.buchkarten, pk: 'id' },
  { name: 'dateien', table: db.dateien, pk: 'id', datei: 'buecher', endung: '' },
]

let session: Session | null = null
let ziehe = false
let laeuft: Promise<void> | null = null
let nochmal = false
let timer: number | undefined

const metaGet = async <T,>(k: string, d: T): Promise<T> => ((await db.meta.get(k))?.value as T) ?? d
const metaSet = (k: string, v: unknown) => db.meta.put({ key: k, value: v })

async function schiebe(d: Def, uid: string) {
  const ck = `sync-push:${d.name}`
  const seit = await metaGet<number>(ck, 0)
  const start = Date.now()
  const zeilen = (await d.table.where('updatedAt').above(seit).toArray()).filter((r) => r._srv !== r.updatedAt)
  for (let i = 0; i < zeilen.length; i += 200) {
    const teil = zeilen.slice(i, i + 200)
    const payload = []
    for (const r of teil) {
      const { _srv, blob, ...data } = r
      if (d.datei && blob) {
        const { error } = await supabase!.storage.from(d.datei).upload(`${uid}/${r.id}${d.endung}`, blob, { upsert: true, contentType: blob.type || 'application/octet-stream' })
        if (error) throw error
      }
      payload.push({ owner: uid, id: r[d.pk], data, updated_at: r.updatedAt ?? 0, deleted: !!r.deleted })
    }
    const { error } = await supabase!.from(d.name).upsert(payload, { onConflict: 'owner,id' })
    if (error) throw error
  }
  await metaSet(ck, start - 1)
}

async function hole(d: Def, uid: string) {
  const ck = `sync-pull:${d.name}`
  let cursor = await metaGet<string>(ck, '1970-01-01T00:00:00Z')
  for (;;) {
    const { data, error } = await supabase!.from(d.name).select('id,data,updated_at,server_ts')
      .gt('server_ts', cursor).order('server_ts').limit(500)
    if (error) throw error
    if (!data.length) break
    for (const z of data) {
      const lokal = await d.table.get(z.id)
      if (lokal && (lokal.updatedAt ?? 0) >= z.updated_at) continue
      let datensatz: any = { ...z.data, updatedAt: z.updated_at, _srv: z.updated_at }
      if (d.datei) {
        const { data: blob, error: e } = await supabase!.storage.from(d.datei).download(`${uid}/${z.id}${d.endung}`)
        if (e) { console.warn('Datei fehlt auf dem Server', z.id, e); continue }
        datensatz = { ...datensatz, blob }
      }
      ziehe = true
      try { await d.table.put(datensatz) } finally { ziehe = false }
    }
    cursor = data[data.length - 1].server_ts
    await metaSet(ck, cursor)
    if (data.length < 500) break
  }
}

async function lauf() {
  if (!supabase) return
  if (!session) { setze({ status: 'abgemeldet' }); return }
  if (!navigator.onLine) { setze({ status: 'offline' }); return }
  setze({ status: 'laeuft' })
  try {
    const uid = session.user.id
    for (const d of TABELLEN) await schiebe(d, uid)
    for (const d of TABELLEN) await hole(d, uid)
    setze({ status: 'synchron', fehler: undefined, zuletzt: Date.now() })
  } catch (e: any) {
    console.error('Sync-Fehler', e)
    setze({ status: navigator.onLine ? 'fehler' : 'offline', fehler: e?.message ?? String(e) })
  }
}

/** Sync jetzt starten (läuft schon einer, folgt direkt danach ein weiterer). */
export function synchronisiere(): Promise<void> {
  if (laeuft) { nochmal = true; return laeuft }
  laeuft = lauf().finally(() => { laeuft = null; if (nochmal) { nochmal = false; synchronisiere() } })
  return laeuft
}
export function spaeter(ms = 1500) { clearTimeout(timer); timer = window.setTimeout(synchronisiere, ms) }

let kanal: RealtimeChannel | null = null
function live(an: boolean) {
  if (kanal) { supabase!.removeChannel(kanal); kanal = null }
  if (!an) return
  kanal = supabase!.channel('hr-aenderungen')
  for (const d of TABELLEN) kanal.on('postgres_changes', { event: '*', schema: 'public', table: d.name }, () => spaeter(800))
  kanal.subscribe()
}

/** Einmal beim App-Start aufrufen. */
export function starteSync() {
  if (!supabase) return
  // Lokale Änderungen lösen kurz danach einen Sync aus.
  for (const d of TABELLEN) {
    d.table.hook('creating', () => { if (!ziehe) spaeter() })
    d.table.hook('updating', () => { if (!ziehe) spaeter() })
  }
  supabase.auth.onAuthStateChange((_e, s) => {
    const neu = s?.user.id !== session?.user.id
    session = s
    setze({ email: s?.user.email, status: s ? zustand.status : 'abgemeldet' })
    if (s && neu) { live(true); spaeter(100) }
    if (!s) live(false)
  })
  addEventListener('online', () => spaeter(300))
  addEventListener('offline', () => setze({ status: 'offline' }))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') spaeter(300) })
  setInterval(() => { if (document.visibilityState === 'visible') synchronisiere() }, 60_000)
  // Code aus einem Anmelde-Link (?code=…) nach dem Austausch aus der Adresse entfernen
  if (location.search.includes('code=')) setTimeout(() => history.replaceState(null, '', location.pathname + location.hash), 1500)
}

/** Belegter Online-Speicher in Bytes (Bilder + Bücher). */
export async function onlineSpeicher(): Promise<number | null> {
  if (!supabase || !session) return null
  const { data, error } = await supabase.rpc('hr_speicher')
  return error ? null : Number(data)
}
