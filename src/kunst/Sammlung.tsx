// Raster aller Werke mit Suche und Sortierung.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { aktiveWerke, db } from '../db'
import { useBild } from '../bild'
import { promptsFor } from './prompts'
import { due, festigkeit } from '../lernen/scheduler'
import { staendeMap } from '../lernen/session'
import type { Werk } from '../types'

type Info = { werk: Werk; faellig: number; stand: number }
const jahr = (y?: string) => { const m = y?.match(/\d{3,4}/); return m ? +m[0] : 99999 }

function Kachel({ i }: { i: Info }) {
  const url = useBild(i.werk.image)
  return (
    <a className="kachel" href={`#/kunst/werk/${i.werk.id}`}>
      <div className="bildbox">{url ? <img src={url} alt="" loading="lazy" /> : <div className="platzhalter-titel">{i.werk.title}</div>}</div>
      <div className="t">{i.werk.title}</div>
      <div className="a">{i.werk.artist}{i.werk.year && ` · ${i.werk.year}`} {i.faellig > 0 && <span className="faellig-punkt">· {i.faellig} fällig</span>}</div>
      <div className="balken"><div style={{ width: `${Math.round(i.stand * 100)}%` }} /></div>
    </a>
  )
}

export function Sammlung() {
  const [suche, setSuche] = useState('')
  const [sort, setSort] = useState<'kuenstler' | 'datierung' | 'faellig' | 'stand'>('kuenstler')
  const infos = useLiveQuery(async () => {
    const [ws, ks, st] = await Promise.all([aktiveWerke(), db.kuenstler.toArray(), staendeMap()])
    const km = new Map(ks.map((k) => [k.id, k])), now = Date.now()
    return ws.map((w): Info => {
      const ps = promptsFor(w, w.artistId ? km.get(w.artistId) : undefined)
      return { werk: w, faellig: ps.filter((p) => due(st.get(p.key), now)).length,
        stand: ps.length ? ps.reduce((s, p) => s + festigkeit(st.get(p.key)), 0) / ps.length : 0 }
    })
  })
  const liste = useMemo(() => {
    const q = suche.toLowerCase().trim()
    const l = (infos ?? []).filter((i) => !q || [i.werk.title, i.werk.artist, i.werk.year, i.werk.location, ...i.werk.tags].join(' ').toLowerCase().includes(q))
    const s = {
      kuenstler: (a: Info, b: Info) => a.werk.artist.localeCompare(b.werk.artist, 'de') || jahr(a.werk.year) - jahr(b.werk.year),
      datierung: (a: Info, b: Info) => jahr(a.werk.year) - jahr(b.werk.year),
      faellig: (a: Info, b: Info) => b.faellig - a.faellig,
      stand: (a: Info, b: Info) => a.stand - b.stand,
    }[sort]
    return l.sort(s)
  }, [infos, suche, sort])
  return (
    <div className="seite">
      <div className="kopf">
        <h1>Kunst</h1>
        <a className="knopf" href="#/lernen?bereich=kunst">Lernen</a>
        <a className="knopf" href="#/kunst/probe">Erzähl-Probe</a>
        <a className="knopf" href="#/kunst/neu">Neues Werk</a>
        <a className="leise" href="#/kunst/import">Import / Export</a>
      </div>
      <div className="zeile" style={{ marginBottom: 28 }}>
        <input style={{ flex: 1, minWidth: 200 }} placeholder="Suchen: Titel, Künstler, Schlagwort …" value={suche} onChange={(e) => setSuche(e.target.value)} />
        <select style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="kuenstler">Künstler</option><option value="datierung">Datierung</option>
          <option value="faellig">Fällig</option><option value="stand">Lernstand</option>
        </select>
      </div>
      <p className="gedimmt klein">{liste.length} Werke</p>
      <div className="raster">{liste.map((i) => <Kachel key={i.werk.id} i={i} />)}</div>
    </div>
  )
}
