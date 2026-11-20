import { useEffect, useState } from 'react'
import { ladeEinstellungen, speichereEinstellungen, STANDARD } from '../db'
import type { Einstellungen as E } from '../types'
import { SyncBereich } from '../sync/SyncBereich'

const mb = (b?: number) => (b ? (b / 1048576).toFixed(1) + ' MB' : '–')

export function Einstellungen() {
  const [e, setE] = useState<E>(STANDARD)
  const [platz, setPlatz] = useState<StorageEstimate>()
  useEffect(() => { ladeEinstellungen().then(setE); navigator.storage?.estimate?.().then(setPlatz) }, [])
  const set = (x: Partial<E>) => { setE({ ...e, ...x }); speichereEinstellungen(x) }
  return (
    <div className="seite schmal">
      <a className="zurueck" href="#/">← Wand</a>
      <div className="kopf"><h1>Einstellungen</h1></div>
      <label>Startbildschirm zeigt</label>
      <div className="zeile">
        <button className={'knopf' + (e.startModus === 'zufall' ? ' haupt' : '')} onClick={() => set({ startModus: 'zufall' })}>Zufälliges Werk (fällige zuerst)</button>
        <button className={'knopf' + (e.startModus === 'tag' ? ' haupt' : '')} onClick={() => set({ startModus: 'tag' })}>Werk des Tages</button>
      </div>
      <label>Neue Fragen pro Lerneinheit</label>
      <div className="zeile">{[5, 10, 15, 25].map((n) => <button key={n} className={'knopf' + (e.neueProEinheit === n ? ' haupt' : '')} onClick={() => set({ neueProEinheit: n })}>{n}</button>)}</div>
      <div className="block">
        <h3>Sync zwischen Mac und iPad</h3>
        <SyncBereich />
      </div>
      <div className="block">
        <h3>Speicher auf diesem Gerät</h3>
        <p className="gedimmt">Belegt: {mb(platz?.usage)}{platz?.quota ? ` von ca. ${mb(platz.quota)}` : ''}.</p>
        <a className="knopf" href="#/kunst/import">Import / Export / Backup</a>
      </div>
      <p className="gedimmt klein" style={{ marginTop: 40 }}>„Bewegung reduzieren“ in den Systemeinstellungen ersetzt das Umdrehen durch Überblenden.</p>
    </div>
  )
}
