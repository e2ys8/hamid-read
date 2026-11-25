// Import (ergänzt Werke mit gleicher id) / Export ohne Lernstand und Bilder / Komplett-Backup.
import { useState } from 'react'
import { importiere, exportWerke, komplettBackup, ladeHerunter } from '../daten/austausch'

const heute = () => new Date().toISOString().slice(0, 10)

export function ImportExport() {
  const [meldung, setMeldung] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const lies = async (f?: File) => {
    if (!f) return
    setLaeuft(true); setMeldung('')
    try {
      const r = await importiere(JSON.parse(await f.text()))
      setMeldung(`Fertig: ${r.neu} neue Werke, ${r.ergaenzt} ergänzt.`)
    } catch (e) { setMeldung('Die Datei konnte nicht gelesen werden: ' + (e as Error).message) }
    finally { setLaeuft(false) }
  }
  return (
    <div className="seite schmal">
      <a className="zurueck" href="#/kunst">← Sammlung</a>
      <div className="kopf"><h1>Import / Export</h1></div>
      <h3>Importieren</h3>
      <p className="gedimmt">JSON aus dem Prototyp oder ein Komplett-Backup. Werke mit gleicher ID werden ergänzt, nicht ersetzt.</p>
      <label className="knopf" style={{ display: 'inline-block', color: 'inherit', fontSize: '1rem' }}>
        {laeuft ? 'Importiere …' : 'Datei wählen'}<input type="file" accept="application/json,.json" hidden onChange={(e) => lies(e.target.files?.[0])} />
      </label>
      {meldung && <div className="hinweis">{meldung}</div>}
      <div className="block">
        <h3>Exportieren</h3>
        <p className="gedimmt">Werke als JSON (wie im Prototyp) – ohne Lernstand und ohne Bilder.</p>
        <button className="knopf" onClick={async () => ladeHerunter(`werke-${heute()}.json`, await exportWerke())}>Werke exportieren</button>
      </div>
      <div className="block">
        <h3>Komplett-Backup</h3>
        <p className="gedimmt">Alles: Werke, Künstler, Lernstand, ABC-Listen, Proben, Bilder, Bücher (mit Dateien), Markierungen und Karten. Mit vielen Büchern wird die Datei groß.</p>
        <button className="knopf" onClick={async () => { setLaeuft(true); ladeHerunter(`hamid-read-backup-${heute()}.json`, await komplettBackup()); setLaeuft(false) }}>Backup herunterladen</button>
      </div>
    </div>
  )
}
