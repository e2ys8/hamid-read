// Bilder: im Browser auf max. 2400 px lange Kante und JPEG ~85 % verkleinern, als Blob speichern.
import { useEffect, useState } from 'react'
import { db, neueId } from './db'

export async function verkleinere(datei: Blob, max = 2400, q = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(datei)
  const f = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close?.()
  return new Promise((ok, err) => c.toBlob((b) => (b ? ok(b) : err(new Error('Bild konnte nicht umgewandelt werden'))), 'image/jpeg', q))
}

/** Speichert ein Bild und gibt die Referenz "bild:<id>" zurück. */
export async function speichereBild(datei: Blob): Promise<string> {
  const blob = await verkleinere(datei)
  const id = neueId()
  await db.bilder.put({ id, blob, updatedAt: Date.now() })
  return 'bild:' + id
}

export async function dataUrlZuBlob(u: string): Promise<Blob> { return (await fetch(u)).blob() }
export const blobZuDataUrl = (b: Blob) =>
  new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(b) })

/** React-Hook: liefert eine anzeigbare URL zu einer Bildreferenz. */
export function useBild(ref?: string | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!ref) { setUrl(undefined); return }
    if (!ref.startsWith('bild:')) { setUrl(ref); return }
    let u: string | undefined, aktiv = true
    db.bilder.get(ref.slice(5)).then((b) => {
      if (b && aktiv) { u = URL.createObjectURL(b.blob); setUrl(u) }
    })
    return () => { aktiv = false; if (u) URL.revokeObjectURL(u) }
  }, [ref])
  return url
}
