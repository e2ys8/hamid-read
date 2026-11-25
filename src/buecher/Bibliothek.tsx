// Bibliothek: alle Bücher mit Cover, Fortschritt, Markierungen, Karten und Buchnotiz. Hochladen per Wahl oder Hineinziehen.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, aktiveBuecher } from '../db'
import { useBild } from '../bild'
import { buchPrompts, staendeMap } from '../lernen/session'
import { due } from '../lernen/scheduler'
import { geh } from '../router'
import type { Buch } from '../types'

type Info = { buch: Buch; markierungen: number; karten: number; faellig: number }

function BuchKachel({ i }: { i: Info }) {
  const url = useBild(i.buch.cover)
  const b = i.buch
  return (
    <div className="buch-kachel">
      <a href={`#/buecher/${b.id}/lesen`} className="buch-cover">
        {url ? <img src={url} alt="" loading="lazy" /> : <div className="platzhalter-titel">{b.title}</div>}
      </a>
      <a href={`#/buecher/${b.id}`} className="kachel" style={{ marginTop: 8 }}>
        <div className="t">{b.title}</div>
        <div className="a">{b.author}{b.year && ` · ${b.year}`}</div>
      </a>
      <div className="balken"><div style={{ width: `${Math.round((b.progress ?? 0) * 100)}%` }} /></div>
      <div className="gedimmt klein" style={{ marginTop: 6 }}>
        {i.markierungen} Markierungen · {i.karten} Karten{i.faellig > 0 && <span className="faellig-punkt"> · {i.faellig} fällig</span>}
      </div>
      {b.notiz && <p className="buch-notiz">{b.notiz}{b.notizSource === 'ki' && <span className="pruefen"> (KI, bitte prüfen)</span>}</p>}
    </div>
  )
}

export function Bibliothek() {
  const [ziehen, setZiehen] = useState(false)
  const [meldung, setMeldung] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [ansicht, setAnsicht] = useState<'raster' | 'liste'>(() => (localStorage.getItem('hr-bib') as any) ?? 'raster')
  const infos = useLiveQuery(async () => {
    const [bs, ms, ks, ps, st] = await Promise.all([aktiveBuecher(), db.markierungen.toArray(), db.buchkarten.toArray(), buchPrompts(), staendeMap()])
    const now = Date.now()
    return bs.sort((a, b) => b.updatedAt - a.updatedAt).map((b): Info => ({
      buch: b,
      markierungen: ms.filter((m) => m.buchId === b.id && !m.deleted).length,
      karten: ks.filter((k) => k.buchId === b.id && !k.deleted && k.status === 'aktiv').length,
      faellig: ps.filter((p) => p.buchId === b.id && due(st.get(p.key), now)).length,
    }))
  })
  const hochladen = async (f?: File) => {
    if (!f) return
    setLaeuft(true); setMeldung('')
    const { buchAnlegen, KopierschutzFehler } = await import('./datei')
    try { const id = await buchAnlegen(f); geh(`/buecher/${id}?neu=1`) }
    catch (e: any) { setMeldung((e instanceof KopierschutzFehler ? '' : 'Fehler: ') + e.message) }
    finally { setLaeuft(false) }
  }
  const umschalten = (a: 'raster' | 'liste') => { setAnsicht(a); localStorage.setItem('hr-bib', a) }
  return (
    <div className="seite" onDragOver={(e) => { e.preventDefault(); setZiehen(true) }} onDragLeave={(e) => { if (e.currentTarget === e.target) setZiehen(false) }}
      onDrop={(e) => { e.preventDefault(); setZiehen(false); hochladen(e.dataTransfer.files[0]) }}>
      <div className="kopf">
        <h1>Bücher</h1>
        <a className="knopf" href="#/lernen?bereich=buecher">Lernen</a>
        <label className="knopf" style={{ margin: 0, color: 'inherit', fontSize: '1rem' }}>
          {laeuft ? 'Lese Datei …' : 'Buch hinzufügen'}
          <input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" hidden onChange={(e) => { hochladen(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <button className="leise" onClick={() => umschalten(ansicht === 'raster' ? 'liste' : 'raster')}>{ansicht === 'raster' ? 'Liste' : 'Raster'}</button>
      </div>
      {meldung && <div className="hinweis">{meldung}</div>}
      {ziehen && <div className="ablage drueber" style={{ marginBottom: 20 }}>PDF oder EPUB hier ablegen</div>}
      {infos && !infos.length && <div className="ablage" style={{ padding: 48 }}>
        <p>Noch keine Bücher.</p><p className="klein">PDF oder EPUB hierher ziehen oder „Buch hinzufügen“ wählen. Nur Dateien ohne Kopierschutz.</p>
      </div>}
      <div className={ansicht === 'raster' ? 'raster buecher-raster' : 'buecher-liste'}>{infos?.map((i) => <BuchKachel key={i.buch.id} i={i} />)}</div>
    </div>
  )
}
