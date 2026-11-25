// Buchseite: Angaben, Buchnotiz, Markierungen (nach Farbe filterbar), Karten, ABC-Liste.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useBild } from '../bild'
import { FARBEN, FARB_LISTE, TYP_NAMEN } from './farben'
import { KartenEditor } from './KartenEditor'
import { lueckentext } from '../lernen/buchPrompts'
import { geh } from '../router'
import type { Buch, BuchKarte, Farbe, Markierung } from '../types'

export function BuchSeite({ id, query }: { id: string; query: URLSearchParams }) {
  const buch = useLiveQuery(() => db.buecher.get(id), [id])
  const ms = useLiveQuery(async () => (await db.markierungen.where('buchId').equals(id).toArray()).filter((m) => !m.deleted), [id]) ?? []
  const ks = useLiveQuery(async () => (await db.buchkarten.where('buchId').equals(id).toArray()).filter((k) => !k.deleted && k.status === 'aktiv'), [id]) ?? []
  const abc = useLiveQuery(async () => (await db.abc.where('bezug.id').equals(id).toArray()).find((a) => !a.deleted), [id])
  const cover = useBild(buch?.cover)
  const [entwurf, setEntwurf] = useState<Buch>()
  const [filter, setFilter] = useState<Farbe | null>(null)
  const [editor, setEditor] = useState<{ m?: Markierung; k?: BuchKarte } | null>(null)
  useEffect(() => { if (buch && !entwurf) setEntwurf(buch) }, [buch, entwurf])
  if (buch === undefined) return null
  if (!buch || buch.deleted || !entwurf) return <div className="seite"><a className="zurueck" href="#/buecher">← Bibliothek</a><p>Buch nicht gefunden.</p></div>

  const set = (x: Partial<Buch>) => setEntwurf({ ...entwurf, ...x })
  const geaendert = (['title', 'author', 'year', 'language', 'notiz'] as const).some((f) => (entwurf[f] ?? '') !== (buch[f] ?? '')) || entwurf.tags.join() !== buch.tags.join()
  const speichern = () => db.buecher.put({ ...buch, title: entwurf.title, author: entwurf.author, year: entwurf.year, language: entwurf.language,
    notiz: entwurf.notiz, notizSource: entwurf.notiz !== buch.notiz ? 'eigen' : buch.notizSource, tags: entwurf.tags.map((t) => t.trim()).filter(Boolean), updatedAt: Date.now() })
  const loeschen = async () => {
    if (!confirm(`„${buch.title}“ löschen? Markierungen und Karten werden mit ausgeblendet.`)) return
    await db.buecher.put({ ...buch, deleted: true, updatedAt: Date.now() }); geh('/buecher')
  }
  const liste = ms.filter((m) => !filter || m.farbe === filter).sort((a, b) => (a.seite ?? 0) - (b.seite ?? 0) || a.createdAt - b.createdAt)
  const kartenZu = (m: Markierung) => ks.filter((k) => k.markierungId === m.id)

  return (
    <div className="seite schmal">
      <a className="zurueck" href="#/buecher">← Bibliothek</a>
      {query.get('neu') && !abc && <div className="hinweis">
        <b>Vor dem Lesen:</b> Willst du eine ABC-Liste zum Thema machen? Nach dem Lesen machst du sie noch einmal und siehst, was dazugekommen ist (Birkenbihl-Inventur).
        <div className="zeile" style={{ marginTop: 10 }}><a className="knopf haupt" href={`#/buecher/${id}/abc`}>ABC-Liste anlegen</a><a className="leise" href={`#/buecher/${id}/lesen`}>Gleich lesen</a></div>
      </div>}
      <div className="buch-kopf">
        <div className="buch-cover" style={{ width: 120 }}>{cover ? <img src={cover} alt="" /> : <div className="platzhalter-titel">{buch.title}</div>}</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: 4 }}>{buch.title}</h1>
          <div className="gedimmt">{buch.author}{buch.year && ` · ${buch.year}`} · {buch.format.toUpperCase()}</div>
          <div className="balken" style={{ maxWidth: 260, margin: '10px 0' }}><div style={{ width: `${Math.round((buch.progress ?? 0) * 100)}%` }} /></div>
          <div className="zeile">
            <a className="knopf haupt" href={`#/buecher/${id}/lesen`}>{buch.progress ? 'Weiterlesen' : 'Lesen'}</a>
            {ks.length > 0 && <a className="knopf" href={`#/lernen?buch=${id}`}>Lernen</a>}
            <a className="knopf" href={`#/buecher/${id}/abc`}>ABC-Liste{abc ? ` (${abc.lists.length})` : ''}</a>
          </div>
        </div>
      </div>
      {buch.ohneText && <div className="hinweis">Gescanntes PDF ohne Textebene: Lesen geht, Markieren nicht. Texterkennung kann später ergänzt werden.</div>}

      <div className="block">
        <h2>Buchnotiz</h2>
        <p className="gedimmt klein">Bezieht sich das Buch auf Gemälde, Künstler oder Epochen? Kurz festhalten. (Vorschläge der KI kommen später.)</p>
        <textarea value={entwurf.notiz ?? ''} onChange={(e) => set({ notiz: e.target.value })} placeholder="z. B. Bezieht sich auf Manet, Impressionismus, Paris um 1870" />
        {buch.notizSource === 'ki' && <p className="pruefen klein">KI, bitte prüfen</p>}
      </div>

      <div className="block">
        <h2>Markierungen <span className="gedimmt" style={{ fontSize: '1rem' }}>{ms.length}</span></h2>
        <div className="zeile" style={{ gap: 8, marginBottom: 12 }}>
          <button className={'knopf klein' + (!filter ? ' haupt' : '')} onClick={() => setFilter(null)}>Alle</button>
          {FARB_LISTE.map((f) => <button key={f} className={'knopf klein' + (filter === f ? ' haupt' : '')} onClick={() => setFilter(filter === f ? null : f)}>
            <span className="farbpunkt" style={{ background: FARBEN[f].css, marginRight: 6 }} />{FARBEN[f].bedeutung} ({ms.filter((m) => m.farbe === f).length})</button>)}
        </div>
        {!liste.length && <p className="gedimmt">Noch keine Markierungen. Im Reader Text auswählen und eine Farbe tippen.</p>}
        {liste.map((m) => (
          <div key={m.id} className="markierung-karte" style={{ borderColor: FARBEN[m.farbe].css }}>
            <div className="mt">{m.text}</div>
            {m.eigeneNotiz && <div className="klein" style={{ fontStyle: 'italic', marginTop: 4 }}>{m.eigeneNotiz}</div>}
            <div className="zeile klein gedimmt" style={{ marginTop: 6 }}>
              <span style={{ flex: 1 }}>{[m.seite && `S. ${m.seite}`, m.kapitel].filter(Boolean).join(' · ')}</span>
              <a className="leise" href={`#/buecher/${id}/lesen?m=${m.id}`}>Zur Stelle</a>
              {kartenZu(m).length ? <span>{kartenZu(m).length} Karte{kartenZu(m).length > 1 && 'n'}</span> : null}
              <button className="leise" onClick={() => setEditor({ m })}>+ Karte</button>
            </div>
          </div>))}
      </div>

      <div className="block">
        <h2>Karten <span className="gedimmt" style={{ fontSize: '1rem' }}>{ks.length}</span></h2>
        <button className="knopf klein" style={{ marginBottom: 12 }} onClick={() => setEditor({})}>+ Karte ohne Markierung</button>
        {ks.map((k) => {
          const m = ms.find((x) => x.id === k.markierungId)
          return (
            <div key={k.id} className="eintrag" style={{ cursor: 'pointer' }} onClick={() => setEditor({ k, m })}>
              <div className="gedimmt klein">{m && <span className="farbpunkt" style={{ background: FARBEN[m.farbe].css, marginRight: 6 }} />}{TYP_NAMEN[k.typ]}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}><b>{k.typ === 'zitat' && k.luecken?.length ? lueckentext(k.a, k.luecken) : k.q}</b></div>
              {!(k.typ === 'zitat' && k.luecken?.length) && <div className="gedimmt" style={{ whiteSpace: 'pre-wrap' }}>{k.a}</div>}
            </div>)
        })}
      </div>

      <div className="block">
        <h2>Angaben</h2>
        <label>Titel</label><input value={entwurf.title} onChange={(e) => set({ title: e.target.value })} />
        <div className="zwei">
          <div><label>Autor</label><input value={entwurf.author} onChange={(e) => set({ author: e.target.value })} /></div>
          <div><label>Jahr</label><input value={entwurf.year ?? ''} onChange={(e) => set({ year: e.target.value })} /></div>
          <div><label>Sprache</label><select value={entwurf.language ?? ''} onChange={(e) => set({ language: e.target.value })}><option value="">–</option><option value="de">Deutsch</option><option value="en">Englisch</option><option value="fr">Französisch</option></select></div>
          <div><label>Schlagworte</label><input value={entwurf.tags.join(', ')} onChange={(e) => set({ tags: e.target.value.split(',') })} /></div>
        </div>
      </div>
      <div className="zeile" style={{ marginTop: 24 }}>
        <button className="knopf haupt" disabled={!geaendert} onClick={speichern}>Speichern</button>
        <button className="leise gefahr" onClick={loeschen}>Buch löschen</button>
      </div>
      {editor && <KartenEditor m={editor.m} karte={editor.k} buch={buch} onFertig={() => setEditor(null)} />}
    </div>
  )
}
