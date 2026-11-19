// Flip-Karte: vorne das Werk randlos, hinten die Papier-Rückseite.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useBild } from '../bild'
import { db } from '../db'
import type { Werk, Kuenstler, Quelle } from '../types'

const PRUEF = /claude|ki, bitte|prüfen/i
export function Src({ s }: { s?: string }) {
  if (!s) return null
  const link = /^https?:\/\//.test(s)
  return <span className={'src' + (PRUEF.test(s) ? ' pruefen' : '')}> — {link ? <a href={s} target="_blank" rel="noreferrer">Quelle</a> : s}</span>
}

function useFenster() {
  const [f, setF] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => { const r = () => setF({ w: innerWidth, h: innerHeight }); addEventListener('resize', r); return () => removeEventListener('resize', r) }, [])
  return f
}

export function Karte({ werk, kuenstler, umgedreht, onKlick, rahmen = { w: 0.92, h: 0.9 } }: {
  werk: Werk; kuenstler?: Kuenstler; umgedreht: boolean; onKlick?: () => void; rahmen?: { w: number; h: number }
}) {
  const url = useBild(werk.image)
  const [ratio, setRatio] = useState<number>()
  const f = useFenster()
  useEffect(() => setRatio(undefined), [werk.image])
  const maxW = f.w * rahmen.w, maxH = f.h * rahmen.h
  let vorne = { w: Math.min(maxW, 640), h: Math.min(maxH, 520) }
  if (ratio) vorne = ratio > maxW / maxH ? { w: maxW, h: maxW / ratio } : { w: maxH * ratio, h: maxH }
  const hinten = { w: Math.min(maxW, 680), h: maxH }
  const g = umgedreht ? hinten : vorne
  return (
    <div className={'karte' + (umgedreht ? ' umgedreht' : '')} style={{ width: g.w, height: g.h }} onClick={onKlick}>
      <div className="karte-innen">
        <div className="seite-v" aria-hidden={umgedreht}>
          {url ? <img src={url} alt={werk.title} draggable={false} onLoad={(e) => setRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} />
            : <div className="ohne-bild"><h1>{werk.title || 'Ohne Titel'}</h1><div className="gedimmt">{werk.artist}</div>
                <p className="gedimmt klein" style={{ marginTop: 24 }}>Noch kein Bild – unter „Bearbeiten“ hinzufügen.</p></div>}
        </div>
        <div className="seite-r" aria-hidden={!umgedreht} onClick={(e) => { if ((e.target as HTMLElement).closest('a,summary,details,button')) e.stopPropagation() }}>
          <Rueckseite werk={werk} kuenstler={kuenstler} />
        </div>
      </div>
    </div>
  )
}

const Liste = ({ l }: { l: Quelle[] }) => <>{l.map((e, i) => <p key={i}>{e.text}<Src s={e.src} /></p>)}</>

export function Rueckseite({ werk: w, kuenstler: k }: { werk: Werk; kuenstler?: Kuenstler }) {
  const verwandt = useLiveQuery(() => db.werke.bulkGet(w.related), [w.related.join()]) ?? []
  const bio = k?.bio ?? w.bio, bioSrc = k?.bioSource ?? w.bioSource
  const kTech = k?.paintTech ?? []
  const quellen = [...new Set([w.sourceUrl, bioSrc, ...w.paintTech.map((e) => e.src), ...kTech.map((e) => e.src), ...w.notes.map((e) => e.src), ...w.facts.map((e) => e.src)].filter(Boolean))] as string[]
  return (
    <div className="rueck">
      <h1>{w.title}</h1>
      <div className="wer">{w.artist}{w.year && <> · {w.year}</>}</div>
      <div className="daten">
        {[w.technique, w.dimensions].filter(Boolean).join(' · ')}
        {w.location && <><br />{w.location}{w.inventory && ` · Inv. ${w.inventory}`}</>}
      </div>
      {bio && <><p>{bio}<Src s={bioSrc} /></p></>}
      {(w.paintTech.length > 0 || kTech.length > 0) && <>
        <h3>Maltechnik</h3>
        <Liste l={w.paintTech} />
        {kTech.length > 0 && <><p className="src" style={{ marginTop: '.8em' }}>Typisch für {w.artist}:</p><Liste l={kTech} /></>}
      </>}
      {(w.notes.length > 0 || w.hotspots.length > 0) && <>
        <h3>Im Bild</h3>
        <ul>
          {w.notes.map((n, i) => <li key={i}>{n.text}<Src s={n.src} /></li>)}
          {w.hotspots.map((h, i) => <li key={h.k}><span className="nr">{i + 1}</span>{h.a}</li>)}
        </ul>
      </>}
      {w.facts.length > 0 && <details><summary>Lernfragen</summary><ul>{w.facts.map((f) => <li key={f.k}><b>{f.q}</b><br />{f.a}<Src s={f.src} /></li>)}</ul></details>}
      {verwandt.filter(Boolean).length > 0 && <details><summary>Verwandte Werke</summary><ul>
        {verwandt.filter((v) => v && !v.deleted).map((v) => <li key={v!.id}><a href={`#/kunst/werk/${v!.id}`}>{v!.title}</a> – {v!.artist}</li>)}</ul></details>}
      {quellen.length > 0 && <details><summary>Quellen</summary><ul>{quellen.map((q) => <li key={q} className={'src' + (PRUEF.test(q) ? ' pruefen' : '')}>{/^https?:/.test(q) ? <a href={q} target="_blank" rel="noreferrer">{q}</a> : q}</li>)}</ul></details>}
    </div>
  )
}
