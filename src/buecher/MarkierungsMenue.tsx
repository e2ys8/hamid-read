// Kleine Farbleiste über einer Textauswahl. Tippen auf eine Farbe speichert sofort.
// Bei einer vorhandenen Markierung: Farbe ändern, Notiz, Karte erstellen, löschen.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { FARBEN, FARB_LISTE } from './farben'
import { markiere, aendereMarkierung, loescheMarkierung, type Auswahl } from './markieren'
import type { Farbe, Markierung } from '../types'

export type MenueZustand = { x: number; y: number; unten: number } & ({ auswahl: Auswahl } | { markierungId: string })

export function MarkierungsMenue({ buchId, z, onSchliessen, onKarte, onMarkiert }: {
  buchId: string; z: MenueZustand; onSchliessen: () => void
  onKarte: (m: Markierung) => void; onMarkiert?: () => void
}) {
  const [mid, setMid] = useState<string | undefined>('markierungId' in z ? z.markierungId : undefined)
  const m = useLiveQuery(() => (mid ? db.markierungen.get(mid) : undefined), [mid])
  const [notiz, setNotiz] = useState<string>()
  const [zeigeNotiz, setZeigeNotiz] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: z.x, top: z.y })

  useEffect(() => { setMid('markierungId' in z ? z.markierungId : undefined); setZeigeNotiz(false); setNotiz(undefined) }, [z])
  useEffect(() => { if (m && notiz === undefined) setNotiz(m.eigeneNotiz ?? '') }, [m, notiz])
  // Innerhalb des Fensters halten; oberhalb der Auswahl, sonst darunter
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight
    let top = z.y - h - 12
    if (top < 8) top = z.unten + 12
    setPos({ left: Math.max(8, Math.min(innerWidth - w - 8, z.x - w / 2)), top: Math.min(top, innerHeight - h - 8) })
  }, [z, m, zeigeNotiz])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onSchliessen() }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [onSchliessen])

  const farbe = async (f: Farbe) => {
    if (m) { await aendereMarkierung(m, { farbe: f }); return }
    if ('auswahl' in z) { const neu = await markiere(buchId, z.auswahl, f); setMid(neu.id); onMarkiert?.() }
  }
  const notizSpeichern = () => { if (m && notiz !== undefined && notiz !== (m.eigeneNotiz ?? '')) aendereMarkierung(m, { eigeneNotiz: notiz }) }

  return (
    <div ref={ref} className="markier-menue" style={pos} onPointerDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
      <div className="zeile" style={{ gap: 6, flexWrap: 'nowrap' }}>
        {FARB_LISTE.map((f) => (
          <button key={f} className={'farbknopf' + (m?.farbe === f ? ' aktiv' : '')} style={{ background: FARBEN[f].css }}
            title={`${FARBEN[f].name}: ${FARBEN[f].bedeutung}`} aria-label={FARBEN[f].bedeutung} onClick={() => farbe(f)} />
        ))}
        {m && <>
          <span className="trenner" />
          <button className="leise klein" onClick={() => setZeigeNotiz(!zeigeNotiz)}>Notiz</button>
          <button className="leise klein" onClick={() => onKarte(m)}>Karte</button>
          <button className="leise klein gefahr" onClick={async () => { await loescheMarkierung(m); onSchliessen() }} aria-label="Löschen">✕</button>
        </>}
      </div>
      {m && <div className="gedimmt" style={{ fontSize: '.72rem', marginTop: 4 }}>{FARBEN[m.farbe].bedeutung}</div>}
      {m && zeigeNotiz && <textarea autoFocus value={notiz ?? ''} placeholder="Eigene Notiz …" onChange={(e) => setNotiz(e.target.value)} onBlur={notizSpeichern}
        style={{ marginTop: 8, minWidth: 260, fontSize: '.9rem' }} />}
    </div>
  )
}
