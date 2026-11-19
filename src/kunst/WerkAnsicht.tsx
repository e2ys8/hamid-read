// Einzelnes Werk: Flip-Karte und Aktionen.
import { useState } from 'react'
import { useWerk } from '../komponenten/hooks'
import { Karte } from '../komponenten/Karte'
import { speichereWerk } from '../db'
import { geh } from '../router'

export function WerkAnsicht({ id }: { id: string }) {
  const d = useWerk(id)
  const [um, setUm] = useState(false)
  if (d === undefined) return null
  if (d === null) return <div className="seite"><a className="zurueck" href="#/kunst">← Sammlung</a><p>Werk nicht gefunden.</p></div>
  const loeschen = async () => {
    if (!confirm(`„${d.werk.title}“ löschen? (Es wird als gelöscht markiert.)`)) return
    await speichereWerk({ ...d.werk, deleted: true }); geh('/kunst')
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px' }}>
      <div style={{ alignSelf: 'stretch' }} className="zeile">
        <a className="zurueck" href="#/kunst" style={{ margin: 0, flex: 1 }}>← Sammlung</a>
      </div>
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', margin: '16px 0' }}>
        <Karte werk={d.werk} kuenstler={d.kuenstler} umgedreht={um} onKlick={() => setUm(!um)} rahmen={{ w: 0.92, h: 0.74 }} />
      </div>
      <div className="zeile" style={{ justifyContent: 'center' }}>
        <button className="leise" onClick={() => setUm(!um)}>{um ? 'Bild' : 'Rückseite'}</button>
        <a className="knopf" href={`#/kunst/werk/${id}/bearbeiten`}>Bearbeiten</a>
        <a className="knopf" href={`#/lernen?werk=${id}`}>Dieses Werk lernen</a>
        <a className="knopf" href={`#/kunst/probe?werk=${id}`}>Erzähl-Probe</a>
        <a className="knopf" href={`#/kunst/werk/${id}/abc`}>ABC-Liste</a>
        <button className="leise gefahr" onClick={loeschen}>Löschen</button>
      </div>
    </div>
  )
}
