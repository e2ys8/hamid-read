// App-Hülle: Hash-Routing zu Wand, Kunst, Bücher, Wissensnetz, Lernen, Einstellungen.
import { useEffect, useState } from 'react'
import { useRoute } from './router'
import { ersterStart } from './daten/austausch'
import { Wand } from './komponenten/Wand'
import { NavEcke } from './komponenten/NavEcke'
import { Sammlung } from './kunst/Sammlung'
import { WerkAnsicht } from './kunst/WerkAnsicht'
import { WerkEditor } from './kunst/WerkEditor'
import { ErzaehlProbe } from './kunst/ErzaehlProbe'
import { ImportExport } from './kunst/ImportExport'
import { LernAnsicht } from './lernen/LernAnsicht'
import { AbcListe } from './komponenten/AbcListe'
import { Einstellungen } from './komponenten/Einstellungen'
import { useWerk } from './komponenten/hooks'

function Platzhalter({ titel, text }: { titel: string; text: string }) {
  return <div className="seite schmal" style={{ paddingTop: '20vh', textAlign: 'center' }}><h1>{titel}</h1><p className="gedimmt">{text}</p></div>
}
function WerkAbc({ id }: { id: string }) {
  const d = useWerk(id)
  return d ? <AbcListe bezug={{ art: 'werk', id }} titel={`${d.werk.title} – ${d.werk.artist}`} zurueck={`#/kunst/werk/${id}`} /> : null
}

export default function App() {
  const [bereit, setBereit] = useState(false)
  const { teile: t, query } = useRoute()
  useEffect(() => { ersterStart().finally(() => setBereit(true)) }, [])
  if (!bereit) return null

  let seite: React.ReactNode
  const [a, b, c, d] = t
  if (!a) seite = <Wand />
  else if (a === 'kunst' && !b) seite = <Sammlung />
  else if (a === 'kunst' && b === 'neu') seite = <WerkEditor />
  else if (a === 'kunst' && b === 'import') seite = <ImportExport />
  else if (a === 'kunst' && b === 'probe') seite = <ErzaehlProbe key={query.toString()} query={query} />
  else if (a === 'kunst' && b === 'werk' && c && d === 'bearbeiten') seite = <WerkEditor key={c} id={c} />
  else if (a === 'kunst' && b === 'werk' && c && d === 'abc') seite = <WerkAbc id={c} />
  else if (a === 'kunst' && b === 'werk' && c) seite = <WerkAnsicht key={c} id={c} />
  else if (a === 'lernen') seite = <LernAnsicht key={query.toString()} query={query} />
  else if (a === 'buecher') seite = <Platzhalter titel="Bücher" text="Bibliothek, Reader und Markieren folgen in Phase 3." />
  else if (a === 'netz') seite = <Platzhalter titel="Wissensnetz" text="Das Netz aus Künstlern, Autoren, Begriffen und Epochen folgt in Phase 5." />
  else if (a === 'einstellungen') seite = <Einstellungen />
  else seite = <Platzhalter titel="Nicht gefunden" text="Diese Seite gibt es nicht." />

  return <>{seite}<NavEcke immer={!!a && a !== 'lernen'} /></>
}
