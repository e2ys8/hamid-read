// Anmeldung (Code per E-Mail) und Sync-Status für die Einstellungen.
import { useEffect, useState } from 'react'
import { sendeCode, pruefeCode, abmelden } from './supabase'
import { useSync, synchronisiere, onlineSpeicher, type Status } from './sync'

export const STATUS_TEXT: Record<Status, string> = {
  aus: 'nur lokal', abgemeldet: 'nicht angemeldet', laeuft: 'synchronisiert …',
  synchron: 'synchron', offline: 'offline', fehler: 'Fehler',
}
const GRENZE = 1024 ** 3 // 1 GB im kostenlosen Tarif

export function SyncBereich() {
  const s = useSync()
  const [email, setEmail] = useState(() => localStorage.getItem('hr-email') ?? '')
  const [code, setCode] = useState('')
  const [schritt, setSchritt] = useState<'email' | 'code'>('email')
  const [meldung, setMeldung] = useState('')
  const [belegt, setBelegt] = useState<number | null>(null)
  useEffect(() => { if (s.status === 'synchron') onlineSpeicher().then(setBelegt) }, [s.status])

  if (s.status === 'aus') return <p className="gedimmt">Sync ist noch nicht eingerichtet – die App arbeitet nur auf diesem Gerät.</p>

  if (!s.email) return (
    <div>
      <p className="gedimmt">Melde dich an, damit Mac und iPad dieselben Daten haben.</p>
      {schritt === 'email' ? <form onSubmit={async (e) => {
        e.preventDefault(); setMeldung('')
        try { localStorage.setItem('hr-email', email); await sendeCode(email); setSchritt('code') } catch (x: any) { setMeldung(x.message) }
      }}>
        <label>E-Mail</label>
        <div className="zeile"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1 }} /><button className="knopf haupt">Code schicken</button></div>
      </form> : <form onSubmit={async (e) => {
        e.preventDefault(); setMeldung('')
        try { await pruefeCode(email, code) } catch (x: any) { setMeldung(x.message) }
      }}>
        <label>Code aus der E-Mail an {email}</label>
        <div className="zeile">
          <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: 1, letterSpacing: '.3em' }} />
          <button className="knopf haupt">Anmelden</button>
          <button type="button" className="leise" onClick={() => setSchritt('email')}>zurück</button>
        </div>
        <p className="gedimmt klein">Du kannst auch auf den Link in der E-Mail tippen – in der installierten iPad-App geht aber nur der Code.</p>
      </form>}
      {meldung && <div className="hinweis">{meldung}</div>}
    </div>
  )

  const anteil = belegt != null ? belegt / GRENZE : 0
  return (
    <div>
      <p>Angemeldet als {s.email}<br />
        <span className="gedimmt">Status: {STATUS_TEXT[s.status]}{s.zuletzt && ` · zuletzt ${new Date(s.zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}</span></p>
      {s.status === 'fehler' && <div className="hinweis">{s.fehler}</div>}
      {belegt != null && <>
        <p className="gedimmt">Online-Speicher: {(belegt / 1048576).toFixed(1)} MB von 1 GB</p>
        <div className="balken" style={{ maxWidth: 360 }}><div style={{ width: `${Math.min(100, anteil * 100)}%`, background: anteil > 0.8 ? 'var(--rot)' : undefined }} /></div>
        {anteil > 0.8 && <div className="hinweis">Der Online-Speicher ist zu über 80 % voll. Bald brauchen wir eine Lösung (größerer Tarif oder Dateien aufräumen).</div>}
      </>}
      <div className="zeile" style={{ marginTop: 14 }}>
        <button className="knopf" onClick={() => synchronisiere()} disabled={s.status === 'laeuft'}>Jetzt synchronisieren</button>
        <button className="leise" onClick={() => abmelden()}>Abmelden</button>
      </div>
    </div>
  )
}
