// ABC-Liste nach Birkenbihl: A–Z Assoziationen, mit Datum gespeichert, Inventur über die Zeit.
// Gleiche Komponente für Werke und (ab Phase 3) Bücher.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, neueId } from '../db'
import type { AbcListe as Abc } from '../types'

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const zahl = (e: Record<string, string>) => Object.values(e).flatMap((v) => v.split(/[,;]/)).filter((v) => v.trim()).length
const datum = (d: number) => new Date(d).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })

export function AbcListe({ bezug, titel, zurueck }: { bezug: Abc['bezug']; titel: string; zurueck: string }) {
  const eintrag = useLiveQuery(async () => (await db.abc.where('bezug.id').equals(bezug.id).toArray()).find((a) => !a.deleted) ?? null, [bezug.id])
  const [e, setE] = useState<Record<string, string>>({})
  const [zeige, setZeige] = useState<number | null>(null)
  if (eintrag === undefined) return null
  const listen = eintrag?.lists ?? []
  const speichern = async () => {
    if (!zahl(e)) return
    const neu: Abc = eintrag ? { ...eintrag, lists: [...listen, { d: Date.now(), e }], updatedAt: Date.now() }
      : { id: neueId(), bezug, lists: [{ d: Date.now(), e }], updatedAt: Date.now() }
    await db.abc.put(neu); setE({})
  }
  return (
    <div className="seite">
      <a className="zurueck" href={zurueck}>← Zurück</a>
      <div className="kopf"><h1>ABC-Liste</h1></div>
      <p className="gedimmt">{titel} – schreib zu jedem Buchstaben, was dir einfällt. Lücken sind erlaubt.</p>
      {listen.length > 0 && <p className="inventur">Inventur: {listen.map((l) => zahl(l.e)).join(' → ')}{zahl(e) > 0 && <span className="gedimmt"> → {zahl(e)}</span>}</p>}
      <div className="abc">{ABC.map((b) => (
        <div className="abc-zeile" key={b}><b>{b}</b><input value={e[b] ?? ''} onChange={(x) => setE({ ...e, [b]: x.target.value })} /></div>))}
      </div>
      <div className="zeile" style={{ marginTop: 20 }}><button className="knopf haupt" onClick={speichern} disabled={!zahl(e)}>Liste speichern ({zahl(e)} Begriffe)</button></div>
      {listen.length > 0 && <div className="block">
        <h2>Frühere Listen</h2>
        {[...listen].reverse().map((l, j) => { const idx = listen.length - 1 - j; return (
          <div key={l.d} style={{ marginBottom: 10 }}>
            <button className="leise" onClick={() => setZeige(zeige === idx ? null : idx)}>{datum(l.d)} · {zahl(l.e)} Begriffe {zeige === idx ? '▴' : '▾'}</button>
            {zeige === idx && <div className="abc" style={{ marginTop: 8 }}>{ABC.filter((b) => l.e[b]?.trim()).map((b) => <div key={b} className="abc-zeile"><b>{b}</b><span>{l.e[b]}</span></div>)}</div>}
          </div>) })}
      </div>}
    </div>
  )
}
