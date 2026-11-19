// Lernansicht: Frage → Aufdecken (Leertaste) → Bewerten (1–4) mit Vorschau des Abstands.
import { useEffect, useState } from 'react'
import { db, ladeEinstellungen } from '../db'
import { useBild } from '../bild'
import { startSession, type Bereich } from './session'
import { schedule, neuerStand, abstandText, RATING_NAMEN, type Rating } from './scheduler'
import type { Prompt } from '../kunst/prompts'
import type { Lernstand } from '../types'
import { Src } from '../komponenten/Karte'

function PromptBild({ werkId, hotspot }: { werkId: string; hotspot?: { x: number; y: number } }) {
  const [ref, setRef] = useState<string | null>()
  useEffect(() => { db.werke.get(werkId).then((w) => setRef(w?.image)) }, [werkId])
  const url = useBild(ref)
  if (!url) return null
  return <div className="lern-bild"><img src={url} alt="" />{hotspot && <div className="marke puls" style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }} />}</div>
}

export function LernAnsicht({ query }: { query: URLSearchParams }) {
  const werkId = query.get('werk') ?? undefined
  const [bereich, setBereich] = useState<Bereich>((query.get('bereich') as Bereich) ?? 'alles')
  const [liste, setListe] = useState<Prompt[] | null>(null)
  const [i, setI] = useState(0)
  const [auf, setAuf] = useState(false)
  const [stand, setStand] = useState<Lernstand>()
  const [fertig, setFertig] = useState(0)

  useEffect(() => {
    ladeEinstellungen().then((e) => startSession({ bereich, werkId, neue: e.neueProEinheit })).then((l) => { setListe(l); setI(0); setFertig(0) })
  }, [bereich, werkId])
  const p = liste?.[i]
  useEffect(() => { setAuf(false); if (p) db.lernstand.get(p.key).then((s) => setStand(s ?? neuerStand(p.key))) }, [p])

  const bewerte = async (r: Rating) => {
    if (!p || !stand || !auf) return
    const neu = schedule(stand, r)
    await db.lernstand.put(neu)
    // „Nochmal“: Karte kommt in dieser Einheit noch einmal dran
    if (r === 1) setListe((l) => [...l!, p]); else setFertig((f) => f + 1)
    setI((x) => x + 1)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'SELECT') return
      if (e.key === ' ') { e.preventDefault(); setAuf(true) }
      else if (['1', '2', '3', '4'].includes(e.key)) bewerte(+e.key as Rating)
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })

  const kopf = (
    <div className="zeile fortschritt">
      <a className="zurueck" style={{ margin: 0, flex: 1 }} href={werkId ? `#/kunst/werk/${werkId}` : '#/'}>← Zurück</a>
      {!werkId && <select style={{ width: 'auto' }} value={bereich} onChange={(e) => setBereich(e.target.value as Bereich)}>
        <option value="alles">Alles</option><option value="kunst">Nur Kunst</option><option value="buecher">Nur Bücher</option>
      </select>}
      {liste && <span className="gedimmt klein">{Math.min(i + 1, liste.length)} / {liste.length}</span>}
    </div>
  )
  if (!liste) return <div className="lernen">{kopf}</div>
  if (!p) return (
    <div className="lernen">{kopf}
      <h1 style={{ marginTop: '20vh' }}>{fertig ? 'Geschafft.' : 'Nichts fällig.'}</h1>
      <p className="gedimmt">{fertig ? `${fertig} Karten wiederholt.` : bereich === 'buecher' ? 'Bücherkarten kommen in Phase 3.' : 'Alles sitzt – schau morgen wieder vorbei.'}</p>
      <a className="knopf" href="#/">Zur Wand</a>
    </div>
  )
  return (
    <div className="lernen" onClick={() => !auf && setAuf(true)}>
      {kopf}
      {p.zeigeBild && <PromptBild werkId={p.werkId} hotspot={p.hotspot} />}
      <div className="lern-frage">{p.frage}</div>
      {p.laut && !auf && <p className="gedimmt">Erst laut erzählen, dann aufdecken.</p>}
      {!auf ? <button className="knopf" style={{ marginTop: 18 }} onClick={() => setAuf(true)}>Aufdecken <span className="gedimmt klein">(Leertaste)</span></button> : <>
        <div className="lern-antwort">{p.antwort}{p.quelle && <div><Src s={p.quelle} /></div>}</div>
        {stand && <div className="bewerten">{([1, 2, 3, 4] as Rating[]).map((r) => (
          <button key={r} onClick={(e) => { e.stopPropagation(); bewerte(r) }}>{RATING_NAMEN[r]}<small>{abstandText(stand, r)} · {r}</small></button>))}
        </div>}
      </>}
    </div>
  )
}
