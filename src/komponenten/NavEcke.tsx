// Dezentes Symbol in der Ecke: erscheint erst bei Mausbewegung bzw. Antippen.
import { useEffect, useRef, useState } from 'react'
import { useFaellig } from './hooks'

export function NavEcke({ immer = false }: { immer?: boolean }) {
  const [sichtbar, setSichtbar] = useState(immer)
  const [offen, setOffen] = useState(false)
  const t = useRef<number>(undefined)
  const faellig = useFaellig()
  useEffect(() => {
    if (immer) return
    const zeig = () => { setSichtbar(true); clearTimeout(t.current); t.current = window.setTimeout(() => setSichtbar(false), 2600) }
    addEventListener('mousemove', zeig); addEventListener('touchstart', zeig, { passive: true })
    return () => { removeEventListener('mousemove', zeig); removeEventListener('touchstart', zeig); clearTimeout(t.current) }
  }, [immer])
  useEffect(() => { const z = () => setOffen(false); addEventListener('hashchange', z); return () => removeEventListener('hashchange', z) }, [])
  return (
    <div className={'ecke' + (immer || sichtbar || offen ? '' : ' weg')} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <button className="ecke-knopf" aria-label="Menü" onClick={() => setOffen(!offen)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="5.5" height="5.5"/><rect x="11.5" y="3" width="5.5" height="5.5"/><rect x="3" y="11.5" width="5.5" height="5.5"/><rect x="11.5" y="11.5" width="5.5" height="5.5"/></svg>
        {faellig > 0 && <span className="ecke-zahl">{faellig}</span>}
      </button>
      {offen && <nav className="ecke-menue">
        <a href="#/">Wand</a>
        <a href="#/kunst">Kunst</a>
        <a href="#/buecher">Bücher</a>
        <a href="#/netz">Wissensnetz</a>
        <hr />
        <a href="#/lernen">Lernen {faellig > 0 && <span className="gedimmt">{faellig} fällig</span>}</a>
        <a href="#/einstellungen">Einstellungen</a>
      </nav>}
    </div>
  )
}
