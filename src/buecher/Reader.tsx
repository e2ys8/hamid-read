// Reader-Hülle: Kopfleiste, Inhaltsverzeichnis, Markierungsliste, Hell/Dunkel, Schriftgröße.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, ladeEinstellungen, speichereEinstellungen } from '../db'
import { ladeBuchDatei } from './datei'
import { PdfAnsicht } from './PdfAnsicht'
import { EpubAnsicht } from './EpubAnsicht'
import { MarkierungsMenue, type MenueZustand } from './MarkierungsMenue'
import { KartenEditor } from './KartenEditor'
import { FARBEN, FARB_LISTE } from './farben'
import type { TocEintrag } from './ansicht'
import type { Farbe, Markierung } from '../types'

export function Reader({ id, query }: { id: string; query: URLSearchParams }) {
  const buch = useLiveQuery(() => db.buecher.get(id), [id])
  const [blob, setBlob] = useState<Blob | null>()
  const [dunkel, setDunkel] = useState(false)
  const [schrift, setSchrift] = useState(110)
  const markierungen = useLiveQuery(async () => (await db.markierungen.where('buchId').equals(id).toArray()).filter((m) => !m.deleted), [id]) ?? []
  const [toc, setToc] = useState<TocEintrag[]>([])
  const [panel, setPanel] = useState<null | 'inhalt' | 'markierungen'>(null)
  const [filter, setFilter] = useState<Farbe | null>(null)
  const [menue, setMenue] = useState<MenueZustand | null>(null)
  const [karteFuer, setKarteFuer] = useState<Markierung | null>(null)
  const [ziel, setZiel] = useState<{ pos: string; n: number } | null>(null)
  const speichern = useRef<number>(undefined)
  const sprungErledigt = useRef(false)

  useEffect(() => { ladeEinstellungen().then((e) => { setDunkel(e.readerDunkel); setSchrift(e.epubSchrift) }) }, [])
  const dateiRef = buch?.file
  useEffect(() => {
    if (!buch) return
    let aus = false
    ladeBuchDatei(buch).then((b) => { if (!aus) setBlob(b ?? null) })
    return () => { aus = true }
  }, [dateiRef]) // eslint-disable-line
  // Sprung zu einer Markierung (?m=…)
  useEffect(() => {
    const m = query.get('m'); if (!m || sprungErledigt.current || !blob) return
    db.markierungen.get(m).then((x) => { if (x) { sprungErledigt.current = true; setTimeout(() => setZiel({ pos: x.position, n: Date.now() }), 400) } })
  }, [query, blob])

  const onPosition = useCallback((pos: string, progress?: number) => {
    clearTimeout(speichern.current)
    speichern.current = window.setTimeout(() => {
      db.buecher.get(id).then((b) => { if (b && b.lastPosition !== pos) db.buecher.put({ ...b, lastPosition: pos, progress: progress ?? b.progress, updatedAt: Date.now() }) })
    }, 1200)
  }, [id])
  const onMenue = useCallback((z: MenueZustand | null) => setMenue(z), [])

  if (buch === undefined || blob === undefined) return <div className="reader" />
  if (!buch || buch.deleted) return <div className="seite"><a className="zurueck" href="#/buecher">← Bibliothek</a><p>Buch nicht gefunden.</p></div>
  if (!blob) return <div className="seite"><a className="zurueck" href="#/buecher">← Bibliothek</a><p>Die Buchdatei ist auf diesem Gerät nicht vorhanden.</p></div>

  const props = { buch, blob, dunkel, schrift, markierungen, ziel, onPosition, onToc: setToc, onMenue }
  const springe = (pos: string) => { setZiel({ pos, n: Date.now() }); setPanel(null) }
  const liste = markierungen.filter((m) => !filter || m.farbe === filter).sort((a, b) => (a.seite ?? 0) - (b.seite ?? 0) || a.createdAt - b.createdAt)

  return (
    <div className={'reader ' + (dunkel ? 'dunkel' : 'hell')}>
      <header className="reader-kopf">
        <a href={`#/buecher/${id}`} className="leise" title="Zum Buch">←</a>
        <div className="reader-titel">{buch.title}</div>
        <button className="leise" onClick={() => setPanel(panel === 'inhalt' ? null : 'inhalt')}>Inhalt</button>
        <button className="leise" onClick={() => setPanel(panel === 'markierungen' ? null : 'markierungen')}>Markierungen {markierungen.length > 0 && `(${markierungen.length})`}</button>
        {buch.format === 'epub' && <>
          <button className="leise" onClick={() => { const s = Math.max(70, schrift - 10); setSchrift(s); speichereEinstellungen({ epubSchrift: s }) }} aria-label="Kleinere Schrift">A−</button>
          <button className="leise" onClick={() => { const s = Math.min(200, schrift + 10); setSchrift(s); speichereEinstellungen({ epubSchrift: s }) }} aria-label="Größere Schrift">A+</button>
        </>}
        <button className="leise" onClick={() => { setDunkel(!dunkel); speichereEinstellungen({ readerDunkel: !dunkel }) }}>{dunkel ? 'Hell' : 'Dunkel'}</button>
      </header>

      {buch.format === 'pdf' ? <PdfAnsicht {...props} /> : <EpubAnsicht {...props} />}

      {panel && <aside className="reader-panel">
        {panel === 'inhalt' && <>
          <h3>Inhalt</h3>
          {!toc.length && <p className="gedimmt klein">Kein Inhaltsverzeichnis in dieser Datei.</p>}
          {toc.map((t, i) => <button key={i} className="toc-eintrag" style={{ paddingLeft: 8 + t.ebene * 16 }} onClick={() => springe(t.ziel)}>{t.titel}</button>)}
        </>}
        {panel === 'markierungen' && <>
          <h3>Markierungen</h3>
          <div className="zeile" style={{ gap: 6, marginBottom: 10 }}>
            <button className={'knopf klein' + (!filter ? ' haupt' : '')} onClick={() => setFilter(null)}>Alle</button>
            {FARB_LISTE.map((f) => <button key={f} className={'farbknopf' + (filter === f ? ' aktiv' : '')} style={{ background: FARBEN[f].css, width: 24, height: 24 }} title={FARBEN[f].bedeutung} onClick={() => setFilter(filter === f ? null : f)} />)}
          </div>
          {!liste.length && <p className="gedimmt klein">Text auswählen und eine Farbe tippen.</p>}
          {liste.map((m) => (
            <button key={m.id} className="markierung-eintrag" onClick={() => springe(m.position)}>
              <span className="farbstrich" style={{ background: FARBEN[m.farbe].css }} />
              <span><span className="mt">{m.text.length > 180 ? m.text.slice(0, 180) + ' …' : m.text}</span>
                <span className="gedimmt klein">{[m.seite && `S. ${m.seite}`, m.kapitel].filter(Boolean).join(' · ')}</span>
                {m.eigeneNotiz && <span className="klein" style={{ fontStyle: 'italic' }}>{m.eigeneNotiz}</span>}</span>
            </button>))}
        </>}
      </aside>}

      {menue && <MarkierungsMenue buchId={id} z={menue} onSchliessen={() => setMenue(null)}
        onMarkiert={() => setTimeout(() => getSelection()?.removeAllRanges(), 50)}
        onKarte={(m) => { setMenue(null); setKarteFuer(m) }} />}
      {karteFuer && <KartenEditor m={karteFuer} buch={buch} onFertig={() => setKarteFuer(null)} />}
    </div>
  )
}
