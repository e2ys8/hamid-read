// Werk bearbeiten: alle Felder, Bild, Maltechnik, Stellen im Bild, Lernfragen, Bilddetails, Verwandte, Schlagworte.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, neueId, aktiveWerke } from '../db'
import { speichereBild, useBild } from '../bild'
import { normalisiere } from '../daten/austausch'
import { neuerK } from './prompts'
import { geh } from '../router'
import type { Werk, Kuenstler, Quelle } from '../types'

type KDraft = Pick<Kuenstler, 'bio' | 'bioSource' | 'paintTech' | 'dates'>

function Feld({ l, v, s, lang, ph }: { l: string; v?: string; s: (x: string) => void; lang?: boolean; ph?: string }) {
  return <div><label>{l}</label>{lang ? <textarea value={v ?? ''} placeholder={ph} onChange={(e) => s(e.target.value)} /> : <input value={v ?? ''} placeholder={ph} onChange={(e) => s(e.target.value)} />}</div>
}

function QuellenListe({ titel, l, set, hilfe }: { titel: string; l: Quelle[]; set: (l: Quelle[]) => void; hilfe?: string }) {
  return (
    <div>
      <h3>{titel}</h3>
      {hilfe && <p className="gedimmt klein">{hilfe}</p>}
      {l.map((e, i) => (
        <div className="eintrag" key={i}>
          <button className="leise x" onClick={() => set(l.filter((_, j) => j !== i))} aria-label="Entfernen">✕</button>
          <textarea value={e.text} onChange={(x) => set(l.map((y, j) => (j === i ? { ...y, text: x.target.value } : y)))} />
          <input placeholder="Quelle" value={e.src ?? ''} onChange={(x) => set(l.map((y, j) => (j === i ? { ...y, src: x.target.value } : y)))} />
        </div>
      ))}
      <button className="knopf klein" onClick={() => set([...l, { text: '', src: '' }])}>+ Eintrag</button>
    </div>
  )
}

const LEER = (): Werk => normalisiere({ id: neueId(), title: '', artist: '' })

export function WerkEditor({ id }: { id?: string }) {
  const [w, setW] = useState<Werk | null>(id ? null : LEER())
  const [k, setK] = useState<KDraft>({ paintTech: [] })
  const [ziehen, setZiehen] = useState(false)
  const [laden, setLaden] = useState(false)
  const alle = useLiveQuery(aktiveWerke) ?? []
  const bildUrl = useBild(w?.image)

  useEffect(() => {
    if (!id) return
    db.werke.get(id).then(async (x) => {
      if (!x) return
      setW(normalisiere(x))
      const ku = x.artistId ? await db.kuenstler.get(x.artistId) : undefined
      setK({ bio: ku?.bio ?? x.bio, bioSource: ku?.bioSource ?? x.bioSource, paintTech: ku?.paintTech ?? [], dates: ku?.dates })
    })
  }, [id])
  if (!w) return null
  const set = <K extends keyof Werk>(f: K, v: Werk[K]) => setW({ ...w, [f]: v })

  const bild = async (f?: File) => {
    if (!f || !f.type.startsWith('image/')) return
    setLaden(true)
    try { set('image', await speichereBild(f)) } finally { setLaden(false) }
  }
  const tippeInsBild = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10
    set('hotspots', [...w.hotspots, { k: neuerK(w.hotspots), x, y, q: '', a: '' }])
  }

  const speichern = async () => {
    if (!w.title.trim()) { alert('Bitte einen Titel eingeben.'); return }
    const name = w.artist.trim()
    let artistId = w.artistId
    if (name) {
      let ku = artistId ? await db.kuenstler.get(artistId) : undefined
      if (!ku || ku.name !== name) ku = (await db.kuenstler.where('name').equals(name).toArray()).find((x) => !x.deleted)
      // Künstler gewechselt und Profil existiert schon → dessen Biografie nicht überschreiben
      const gewechselt = !!ku && !!w.artistId && ku.id !== w.artistId
      ku ??= { id: neueId(), name, paintTech: [], updatedAt: 0 }
      if (gewechselt) { await db.kuenstler.put({ ...ku, updatedAt: Date.now() }); artistId = ku.id }
      else ku = { ...ku, ...Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined)), dates: k.dates || w.artistDates || ku.dates, paintTech: k.paintTech.filter((e) => e.text.trim()), updatedAt: Date.now() }
      if (!gewechselt) { await db.kuenstler.put(ku); artistId = ku.id }
    }
    const { bio, bioSource, ...rest } = w
    const neu: Werk = {
      ...rest, artist: name, artistId, updatedAt: Date.now(),
      paintTech: w.paintTech.filter((e) => e.text.trim()), notes: w.notes.filter((e) => e.text.trim()),
      facts: w.facts.filter((f) => f.q.trim() || f.a.trim()),
    }
    // Verwandte Werke beidseitig pflegen
    const alt = await db.werke.get(w.id)
    const vorher = new Set(alt?.related ?? []), nachher = new Set(neu.related)
    await db.transaction('rw', db.werke, async () => {
      await db.werke.put(neu)
      for (const r of new Set([...vorher, ...nachher])) {
        const z = await db.werke.get(r); if (!z) continue
        const hat = z.related.includes(w.id)
        if (nachher.has(r) && !hat) await db.werke.put({ ...z, related: [...z.related, w.id], updatedAt: Date.now() })
        if (!nachher.has(r) && hat) await db.werke.put({ ...z, related: z.related.filter((x) => x !== w.id), updatedAt: Date.now() })
      }
    })
    geh(`/kunst/werk/${w.id}`)
  }

  return (
    <div className="seite schmal">
      <a className="zurueck" href={id ? `#/kunst/werk/${id}` : '#/kunst'}>← Zurück</a>
      <div className="kopf"><h1>{id ? 'Bearbeiten' : 'Neues Werk'}</h1><button className="knopf haupt" onClick={speichern}>Speichern</button></div>

      <div className={'ablage' + (ziehen ? ' drueber' : '')}
        onDragOver={(e) => { e.preventDefault(); setZiehen(true) }} onDragLeave={() => setZiehen(false)}
        onDrop={(e) => { e.preventDefault(); setZiehen(false); bild(e.dataTransfer.files[0]) }}>
        {bildUrl ? <>
          <p className="klein">Ins Bild tippen setzt eine nummerierte Markierung („Stelle im Bild“).</p>
          <div className="hotspot-bild" onClick={tippeInsBild}>
            <img src={bildUrl} alt="" draggable={false} />
            {w.hotspots.map((h, i) => <div key={h.k} className="marke" style={{ left: `${h.x}%`, top: `${h.y}%` }}>{i + 1}</div>)}
          </div>
        </> : <p>{laden ? 'Bild wird verkleinert …' : 'Bild hierher ziehen oder wählen'}</p>}
        <div className="zeile" style={{ justifyContent: 'center', marginTop: 12 }}>
          <label className="knopf klein" style={{ margin: 0, color: 'inherit', fontSize: '.85rem' }}>
            {bildUrl ? 'Anderes Bild' : 'Bild wählen'}
            <input type="file" accept="image/*" hidden onChange={(e) => bild(e.target.files?.[0])} />
          </label>
          {bildUrl && <button className="leise klein" onClick={() => set('image', null)}>Bild entfernen</button>}
        </div>
        <p className="klein gedimmt" style={{ marginBottom: 0 }}>Bilder der Pinakotheken: <a href="https://www.sammlung.pinakothek.de" target="_blank" rel="noreferrer">sammlung.pinakothek.de</a> → „Download“</p>
      </div>

      {w.hotspots.length > 0 && <div className="block"><h2>Stellen im Bild</h2>
        {w.hotspots.map((h, i) => (
          <div className="eintrag" key={h.k}>
            <button className="leise x" onClick={() => set('hotspots', w.hotspots.filter((x) => x.k !== h.k))}>✕</button>
            <div><span className="nr">{i + 1}</span></div>
            <input placeholder="Frage (leer = „Was ist an dieser Stelle zu sehen?“)" value={h.q ?? ''} onChange={(e) => set('hotspots', w.hotspots.map((x) => (x.k === h.k ? { ...x, q: e.target.value } : x)))} />
            <textarea placeholder="Antwort" value={h.a} onChange={(e) => set('hotspots', w.hotspots.map((x) => (x.k === h.k ? { ...x, a: e.target.value } : x)))} />
          </div>
        ))}</div>}

      <div className="block">
        <h2>Werk</h2>
        <Feld l="Titel" v={w.title} s={(v) => set('title', v)} />
        <div className="zwei">
          <Feld l="Künstler" v={w.artist} s={(v) => set('artist', v)} />
          <Feld l="Lebensdaten" v={w.artistDates} s={(v) => set('artistDates', v)} ph="1471–1528" />
          <Feld l="Datierung" v={w.year} s={(v) => set('year', v)} />
          <Feld l="Technik" v={w.technique} s={(v) => set('technique', v)} ph="Öl auf Leinwand" />
          <Feld l="Maße" v={w.dimensions} s={(v) => set('dimensions', v)} />
          <Feld l="Inventarnummer" v={w.inventory} s={(v) => set('inventory', v)} />
          <Feld l="Standort" v={w.location} s={(v) => set('location', v)} ph="Alte Pinakothek, Saal …" />
          <Feld l="Quelle (Link)" v={w.sourceUrl} s={(v) => set('sourceUrl', v)} />
        </div>
      </div>

      <div className="block">
        <h2>Künstler</h2>
        <p className="gedimmt klein">Gilt für alle Werke von {w.artist || 'diesem Künstler'}.</p>
        <Feld l="Biografie (kurzer Absatz: Lebensdaten, Stellung, eine Anekdote)" v={k.bio} s={(v) => setK({ ...k, bio: v })} lang />
        <Feld l="Quelle der Biografie" v={k.bioSource} s={(v) => setK({ ...k, bioSource: v })} />
        <QuellenListe titel="Typische Maltechnik des Künstlers" l={k.paintTech} set={(l) => setK({ ...k, paintTech: l })} />
      </div>

      <div className="block">
        <QuellenListe titel="Maltechnik dieses Werks" l={w.paintTech} set={(l) => set('paintTech', l)}
          hilfe="Nur echte Besonderheiten: Bildträger, Grundierung, Untermalung, Pigmente, Lasuren, Pinselführung, Firnis …" />
      </div>

      <div className="block"><QuellenListe titel="Bilddetails" l={w.notes} set={(l) => set('notes', l)} /></div>

      <div className="block">
        <h3>Lernfragen</h3>
        {w.facts.map((f) => (
          <div className="eintrag" key={f.k}>
            <button className="leise x" onClick={() => set('facts', w.facts.filter((x) => x.k !== f.k))}>✕</button>
            <input placeholder="Frage" value={f.q} onChange={(e) => set('facts', w.facts.map((x) => (x.k === f.k ? { ...x, q: e.target.value } : x)))} />
            <textarea placeholder="Antwort" value={f.a} onChange={(e) => set('facts', w.facts.map((x) => (x.k === f.k ? { ...x, a: e.target.value } : x)))} />
            <input placeholder="Quelle" value={f.src ?? ''} onChange={(e) => set('facts', w.facts.map((x) => (x.k === f.k ? { ...x, src: e.target.value } : x)))} />
          </div>
        ))}
        <button className="knopf klein" onClick={() => set('facts', [...w.facts, { k: neuerK(w.facts), q: '', a: '', src: '' }])}>+ Lernfrage</button>
      </div>

      <div className="block">
        <h3>Verwandte Werke</h3>
        <div className="chips" style={{ marginBottom: 10 }}>
          {w.related.map((r) => { const z = alle.find((x) => x.id === r); return z && <span className="chip" key={r}>{z.title} <button className="leise" onClick={() => set('related', w.related.filter((x) => x !== r))}>✕</button></span> })}
        </div>
        <select value="" onChange={(e) => e.target.value && set('related', [...w.related, e.target.value])}>
          <option value="">+ Werk verknüpfen …</option>
          {alle.filter((x) => x.id !== w.id && !w.related.includes(x.id)).sort((a, b) => a.artist.localeCompare(b.artist, 'de'))
            .map((x) => <option key={x.id} value={x.id}>{x.artist} – {x.title}</option>)}
        </select>
      </div>

      <div className="block">
        <h3>Schlagworte</h3>
        <input placeholder="durch Komma getrennt" value={w.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trimStart()))}
          onBlur={() => set('tags', w.tags.map((t) => t.trim()).filter(Boolean))} />
      </div>

      <div className="zeile" style={{ marginTop: 32 }}><button className="knopf haupt" onClick={speichern}>Speichern</button></div>
    </div>
  )
}
