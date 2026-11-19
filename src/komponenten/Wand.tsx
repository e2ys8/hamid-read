// Startbildschirm: immer nur ein Kunstwerk, randlos auf der dunklen Wand.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, aktiveWerke, ladeEinstellungen } from '../db'
import { allePrompts, staendeMap } from '../lernen/session'
import { due } from '../lernen/scheduler'
import { Karte } from './Karte'
import { useWerk } from './hooks'

const mische = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
const tagesZahl = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate() }

async function reihenfolge(): Promise<string[]> {
  const [ws, e, ps, st] = await Promise.all([aktiveWerke(), ladeEinstellungen(), allePrompts(), staendeMap()])
  const ids = ws.map((w) => w.id).sort()
  if (!ids.length) return []
  if (e.startModus === 'tag') { const s = tagesZahl() % ids.length; return [...ids.slice(s), ...ids.slice(0, s)] }
  const now = Date.now()
  const mitFaellig = new Set(ps.filter((p) => due(st.get(p.key), now)).map((p) => p.werkId))
  return [...mische(ids.filter((i) => mitFaellig.has(i))), ...mische(ids.filter((i) => !mitFaellig.has(i)))]
}

export function Wand() {
  const [ids, setIds] = useState<string[] | null>(null)
  const [i, setI] = useState(0)
  const [um, setUm] = useState(false)
  const anzahl = useLiveQuery(() => db.werke.count())
  useEffect(() => { reihenfolge().then(setIds) }, [anzahl])
  const daten = useWerk(ids?.[i])
  const geh = (d: number) => { if (!ids?.length) return; setUm(false); setI((x) => (x + d + ids.length) % ids.length) }

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') geh(1)
      else if (e.key === 'ArrowLeft') geh(-1)
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setUm((u) => !u) }
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })

  // Wischen links/rechts; kurzes Tippen dreht um.
  const start = useRef<{ x: number; y: number } | null>(null)
  const gewischt = useRef(false)
  const unten = (e: React.PointerEvent) => { gewischt.current = false; start.current = { x: e.clientX, y: e.clientY } }
  const oben = (e: React.PointerEvent) => {
    const s = start.current; start.current = null
    if (!s) return
    const dx = e.clientX - s.x, dy = e.clientY - s.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { gewischt.current = true; geh(dx < 0 ? 1 : -1) }
  }

  if (ids && !ids.length) return <div className="wand leer"><div><h1>Noch keine Werke</h1><a className="knopf" href="#/kunst/neu">Erstes Werk anlegen</a></div></div>
  return (
    <div className="wand" onPointerDown={unten} onPointerUp={oben}>
      {daten && <Karte key={daten.werk.id} werk={daten.werk} kuenstler={daten.kuenstler} umgedreht={um}
        onKlick={() => { if (!um && !gewischt.current) setUm(true) }} />}
      {um && <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={() => setUm(false)} />}
    </div>
  )
}
