// Erzähl-Probe: Werk und Dauer wählen, Bild groß mit Timer, laut erzählen, danach abhaken.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, neueId, aktiveWerke } from '../db'
import { useBild } from '../bild'
import { useWerk } from '../komponenten/hooks'
import { promptsFor } from './prompts'
import { neuerStand } from '../lernen/scheduler'

const DAUERN = [2, 5, 10, 30]
const mmss = (s: number) => `${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`

export function ErzaehlProbe({ query }: { query: URLSearchParams }) {
  const [werkId, setWerkId] = useState(query.get('werk') ?? '')
  const [dauer, setDauer] = useState(5)
  const [phase, setPhase] = useState<'wahl' | 'laeuft' | 'pruefen' | 'fertig'>('wahl')
  const [rest, setRest] = useState(0)
  const [genannt, setGenannt] = useState<Set<string>>(new Set())
  const alle = useLiveQuery(aktiveWerke) ?? []
  const d = useWerk(werkId || undefined)
  const url = useBild(d?.werk.image)
  const punkte = d ? promptsFor(d.werk, d.kuenstler) : []
  const proben = useLiveQuery(() => (werkId ? db.proben.where('werkId').equals(werkId).toArray() : []), [werkId]) ?? []

  useEffect(() => {
    if (phase !== 'laeuft') return
    const t = setInterval(() => setRest((r) => r - 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  const abschliessen = async () => {
    const now = Date.now()
    // Nicht genannte Punkte werden heute fällig
    for (const p of punkte) if (!genannt.has(p.key)) {
      const s = (await db.lernstand.get(p.key)) ?? neuerStand(p.key)
      await db.lernstand.put({ ...s, due: now, last: s.last || now, updatedAt: now })
    }
    await db.proben.put({ id: neueId(), werkId, d: now, dauerMin: dauer, genannt: [...genannt], updatedAt: now })
    setPhase('fertig')
  }

  if (phase === 'laeuft' && d) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 }}>
      {url ? <img className="probe-bild" src={url} alt="" /> : <h1>{d.werk.title}</h1>}
      <div className="zeile">
        <span className="uhr" style={{ color: rest < 0 ? 'var(--rot)' : undefined }}>{rest < 0 && '+'}{mmss(rest)}</span>
        <button className="knopf haupt" onClick={() => setPhase('pruefen')}>Fertig erzählt</button>
      </div>
    </div>
  )
  return (
    <div className="seite schmal">
      <a className="zurueck" href={werkId ? `#/kunst/werk/${werkId}` : '#/kunst'}>← Zurück</a>
      <div className="kopf"><h1>Erzähl-Probe</h1></div>
      {phase === 'wahl' && <>
        <label>Werk</label>
        <select value={werkId} onChange={(e) => setWerkId(e.target.value)}>
          <option value="">Werk wählen …</option>
          {alle.sort((a, b) => a.artist.localeCompare(b.artist, 'de')).map((w) => <option key={w.id} value={w.id}>{w.artist} – {w.title}</option>)}
        </select>
        <label>Dauer</label>
        <div className="zeile">{DAUERN.map((m) => <button key={m} className={'knopf' + (dauer === m ? ' haupt' : '')} onClick={() => setDauer(m)}>{m} Min</button>)}</div>
        <p className="gedimmt" style={{ marginTop: 24 }}>Erzähl laut, als stündest du mit einer Gruppe vor dem Bild. Danach hakst du ab, was du genannt hast.</p>
        <button className="knopf haupt" disabled={!d} onClick={() => { setRest(dauer * 60); setGenannt(new Set()); setPhase('laeuft') }}>Starten</button>
        {proben.length > 0 && <p className="gedimmt klein" style={{ marginTop: 24 }}>Frühere Proben: {proben.sort((a, b) => a.d - b.d).map((p) => `${new Date(p.d).toLocaleDateString('de-DE')} (${p.genannt.length}/${punkte.length})`).join(' · ')}</p>}
      </>}
      {phase === 'pruefen' && <>
        <p>Was hast du genannt? Nicht Genanntes wird heute zum Lernen fällig.</p>
        {punkte.map((p) => (
          <label key={p.key} className="check" style={{ color: 'inherit', fontSize: '1rem', margin: 0 }}>
            <input type="checkbox" checked={genannt.has(p.key)} onChange={() => { const n = new Set(genannt); n.has(p.key) ? n.delete(p.key) : n.add(p.key); setGenannt(n) }} />
            <span><b>{p.frage}</b><br /><span className="gedimmt">{p.antwort.length > 220 ? p.antwort.slice(0, 220) + ' …' : p.antwort}</span></span>
          </label>))}
        <div className="zeile" style={{ marginTop: 20 }}><button className="knopf haupt" onClick={abschliessen}>Abschließen ({genannt.size}/{punkte.length})</button></div>
      </>}
      {phase === 'fertig' && <>
        <h2>{genannt.size} von {punkte.length} Punkten genannt.</h2>
        <p className="gedimmt">{punkte.length - genannt.size} Punkte sind jetzt heute fällig.</p>
        <div className="zeile"><a className="knopf haupt" href={`#/lernen?werk=${werkId}`}>Jetzt lernen</a><button className="knopf" onClick={() => setPhase('wahl')}>Neue Probe</button></div>
      </>}
    </div>
  )
}
