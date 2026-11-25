// Buchdatei einlesen: Format erkennen, Kopierschutz prüfen, Metadaten und Cover lesen.
import JSZip from 'jszip'
import ePub from 'epubjs'
import { db, neueId } from '../db'
import { verkleinere } from '../bild'
import { ladePdf } from './pdf'
import type { Buch } from '../types'

export class KopierschutzFehler extends Error {}

const DRM_HINWEIS = 'Diese Datei ist kopiergeschützt (DRM, z. B. aus Apple Books oder Kindle) und kann nicht geöffnet werden. Nur Dateien ohne Kopierschutz funktionieren.'
// Schriften-Verschleierung ist kein Kopierschutz – alles andere in encryption.xml schon.
const SCHRIFT_ALGOS = ['http://www.idpf.org/2008/embedding', 'http://ns.adobe.com/pdf/enc#RC']

async function epubKopierschutz(blob: Blob): Promise<boolean> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  if (zip.file('META-INF/sinf.xml') || zip.file('META-INF/rights.xml')) return true
  const enc = zip.file('META-INF/encryption.xml')
  if (!enc) return false
  const xml = await enc.async('string')
  const algos = [...xml.matchAll(/Algorithm="([^"]+)"/g)].map((m) => m[1])
  const daten = algos.filter((a) => !a.includes('xmldsig') && !a.includes('rsa'))
  return daten.some((a) => !SCHRIFT_ALGOS.includes(a))
}

async function coverSpeichern(b: Blob | null | undefined): Promise<string | null> {
  if (!b) return null
  try {
    const id = neueId()
    await db.bilder.put({ id, blob: await verkleinere(b, 600, 0.85), updatedAt: Date.now() })
    return 'bild:' + id
  } catch { return null }
}

async function pdfEinlesen(blob: Blob) {
  let pdf
  try { pdf = await ladePdf(blob) } catch (e: any) {
    if (e?.name === 'PasswordException') throw new KopierschutzFehler('Dieses PDF ist mit einem Passwort geschützt und kann nicht geöffnet werden.')
    throw new Error('Das PDF konnte nicht gelesen werden: ' + (e?.message ?? e))
  }
  const meta: any = (await pdf.getMetadata().catch(() => null))?.info ?? {}
  // Cover = Seite 1 klein gerendert
  const seite = await pdf.getPage(1)
  const vp = seite.getViewport({ scale: 600 / seite.getViewport({ scale: 1 }).width })
  const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height
  await seite.render({ canvas: c, viewport: vp }).promise
  const cover = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/jpeg', 0.85))
  // Gescannt? Prüfe die ersten Seiten auf Text.
  let zeichen = 0
  for (let i = 1; i <= Math.min(6, pdf.numPages); i++) {
    const t = await (await pdf.getPage(i)).getTextContent()
    zeichen += t.items.reduce((s: number, x: any) => s + (x.str?.trim().length ?? 0), 0)
  }
  const jahr = String(meta.CreationDate ?? '').match(/D:(\d{4})/)?.[1]
  await pdf.loadingTask.destroy()
  return { title: meta.Title?.trim() || '', author: meta.Author?.trim() || '', year: jahr, language: meta.Language, cover, ohneText: zeichen < 80 }
}

async function epubEinlesen(blob: Blob) {
  if (await epubKopierschutz(blob)) throw new KopierschutzFehler(DRM_HINWEIS)
  const book = ePub(await blob.arrayBuffer() as any)
  const m: any = await book.loaded.metadata
  let cover: Blob | null = null
  try { const u = await book.coverUrl(); if (u) cover = await (await fetch(u)).blob() } catch { /* ohne Cover */ }
  book.destroy()
  return { title: m.title || '', author: m.creator || '', year: String(m.pubdate ?? '').match(/\d{4}/)?.[0], language: m.language, cover, ohneText: false }
}

/** Legt ein Buch aus einer Datei an und gibt die id zurück. */
export async function buchAnlegen(datei: File): Promise<string> {
  const name = datei.name.toLowerCase()
  if (/\.(azw3?|mobi|kfx|ibooks|acsm)$/.test(name)) throw new KopierschutzFehler(DRM_HINWEIS)
  const format = name.endsWith('.pdf') || datei.type === 'application/pdf' ? 'pdf'
    : name.endsWith('.epub') || datei.type === 'application/epub+zip' ? 'epub' : null
  if (!format) throw new Error('Bitte eine PDF- oder EPUB-Datei wählen.')
  const info = format === 'pdf' ? await pdfEinlesen(datei) : await epubEinlesen(datei)
  const dateiId = neueId(), id = neueId(), now = Date.now()
  await db.dateien.put({ id: dateiId, blob: datei, name: datei.name, updatedAt: now })
  const buch: Buch = {
    id, kind: 'buch', format, file: 'datei:' + dateiId,
    title: info.title || datei.name.replace(/\.(pdf|epub)$/i, ''), author: info.author, year: info.year,
    language: info.language?.slice(0, 2), cover: await coverSpeichern(info.cover), ohneText: info.ohneText,
    progress: 0, tags: [], updatedAt: now,
  }
  await db.buecher.put(buch)
  return id
}

export async function ladeBuchDatei(b: Buch): Promise<Blob | undefined> {
  return (await db.dateien.get(b.file.replace(/^datei:/, '')))?.blob
}
