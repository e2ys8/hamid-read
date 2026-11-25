// Lokale Datenbank (IndexedDB über Dexie). Die App läuft komplett offline darauf.
import Dexie, { type Table } from 'dexie'
import type { Werk, Kuenstler, AbcListe, Probe, Lernstand, Bild, Einstellungen, Buch, Markierung, BuchKarte, Datei } from './types'

class HamidDB extends Dexie {
  werke!: Table<Werk, string>
  kuenstler!: Table<Kuenstler, string>
  abc!: Table<AbcListe, string>
  proben!: Table<Probe, string>
  lernstand!: Table<Lernstand, string>
  bilder!: Table<Bild, string>
  meta!: Table<{ key: string; value: unknown }, string>
  buecher!: Table<Buch, string>
  markierungen!: Table<Markierung, string>
  buchkarten!: Table<BuchKarte, string>
  dateien!: Table<Datei, string>
  constructor() {
    super('hamid-read')
    this.version(1).stores({
      werke: 'id, artist, updatedAt',
      kuenstler: 'id, name, updatedAt',
      abc: 'id, bezug.id, updatedAt',
      proben: 'id, werkId, updatedAt',
      lernstand: 'key, due, updatedAt',
      bilder: 'id',
      meta: 'key',
    })
    this.version(2).stores({ bilder: 'id, updatedAt' })
    this.version(3).stores({
      buecher: 'id, updatedAt',
      markierungen: 'id, buchId, updatedAt',
      buchkarten: 'id, buchId, markierungId, updatedAt',
      dateien: 'id, updatedAt',
    })
  }
}
export const db = new HamidDB()

export const neueId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

export const STANDARD: Einstellungen = { startModus: 'zufall', neueProEinheit: 10, neueProTag: 20, readerDunkel: false, epubSchrift: 110 }

export async function ladeEinstellungen(): Promise<Einstellungen> {
  const m = await db.meta.get('einstellungen')
  return { ...STANDARD, ...((m?.value as Partial<Einstellungen>) ?? {}) }
}
export async function speichereEinstellungen(e: Partial<Einstellungen>) {
  const alt = await ladeEinstellungen()
  await db.meta.put({ key: 'einstellungen', value: { ...alt, ...e } })
}

/** Speichert einen Werk-Datensatz mit neuem updatedAt. */
export const speichereWerk = (w: Werk) => db.werke.put({ ...w, updatedAt: Date.now() })
export const speichereKuenstler = (k: Kuenstler) => db.kuenstler.put({ ...k, updatedAt: Date.now() })

export const aktiveWerke = async () => (await db.werke.toArray()).filter((w) => !w.deleted)
export const aktiveBuecher = async () => (await db.buecher.toArray()).filter((b) => !b.deleted)
