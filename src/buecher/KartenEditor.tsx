// Karte aus einer Markierung erstellen (ohne KI): Vorlage je nach Farbe, alles änderbar.
import { useEffect, useState } from 'react'
import { db, neueId } from '../db'
import { FARBEN, TYP_NAMEN, REFLEXION } from './farben'
import { woerter } from '../lernen/buchPrompts'
import type { Buch, BuchKarte, Markierung } from '../types'

type Typ = BuchKarte['typ']

function vorlage(typ: Typ, m: Markierung, b: Buch, zitatArt: 'luecke' | 'wer'): Pick<BuchKarte, 'q' | 'a'> {
  const zitat = `„${m.text}“`
  if (typ === 'reflexion') return { q: `${REFLEXION}\n\n${zitat}`, a: m.eigeneNotiz ?? '' }
  if (typ === 'zitat') return zitatArt === 'wer' ? { q: `${zitat}\n\nWer hat das gesagt?`, a: [b.author, b.title].filter(Boolean).join(' – ') } : { q: '', a: m.text }
  if (typ === 'erklaeren') return { q: '', a: m.text }
  return { q: '', a: m.text }
}

export function KartenEditor({ m, buch, karte, onFertig }: { m?: Markierung; buch: Buch; karte?: BuchKarte; onFertig: () => void }) {
  const [typ, setTyp] = useState<Typ>(karte?.typ ?? (m ? FARBEN[m.farbe].typ : 'wissen'))
  const [zitatArt, setZitatArt] = useState<'luecke' | 'wer'>(karte && karte.typ === 'zitat' && !karte.luecken?.length ? 'wer' : 'luecke')
  const [q, setQ] = useState(karte?.q ?? '')
  const [a, setA] = useState(karte?.a ?? '')
  const [luecken, setLuecken] = useState<number[]>(karte?.luecken ?? [])
  const [vorher, setVorher] = useState<number | null>(null)

  useEffect(() => {
    if (karte && typ === karte.typ) return
    if (!m) return
    const v = vorlage(typ, m, buch, zitatArt); setQ(v.q); setA(v.a); setLuecken([])
  }, [typ, zitatArt]) // eslint-disable-line

  const luecke = typ === 'zitat' && zitatArt === 'luecke'
  const ok = luecke ? luecken.length > 0 : q.trim() && a.trim()
  const speichern = async () => {
    const now = Date.now()
    const k: BuchKarte = {
      ...(karte ?? { id: neueId(), buchId: buch.id, markierungId: m?.id, status: 'aktiv', herkunft: 'eigen' as const }),
      typ, q: luecke ? '' : q.trim(), a: a.trim(), luecken: luecke ? [...luecken].sort((x, y) => x - y) : undefined,
      status: 'aktiv', updatedAt: now,
    }
    await db.buchkarten.put(k)
    onFertig()
  }
  // Wörter für den Lückentext antippen (mit Umschalt: Bereich)
  const tippe = (i: number, shift: boolean) => {
    if (shift && vorher != null) {
      const [x, y] = [Math.min(vorher, i), Math.max(vorher, i)]
      setLuecken([...new Set([...luecken, ...Array.from({ length: y - x + 1 }, (_, j) => x + j)])])
    } else setLuecken(luecken.includes(i) ? luecken.filter((x) => x !== i) : [...luecken, i])
    setVorher(i)
  }

  return (
    <div className="modal-hg" onClick={onFertig}>
      <div className="modal" onClick={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <div className="kopf" style={{ paddingRight: 0, marginBottom: 12 }}><h2 style={{ margin: 0, flex: 1 }}>{karte ? 'Karte bearbeiten' : 'Karte erstellen'}</h2>
          <button className="leise" onClick={onFertig}>✕</button></div>
        {m && <blockquote className="zitat-block" style={{ borderColor: FARBEN[m.farbe].css }}>{m.text}
          <div className="gedimmt klein">{[m.seite && `S. ${m.seite}`, m.kapitel].filter(Boolean).join(' · ')}</div></blockquote>}
        <div className="zeile" style={{ gap: 6 }}>{(Object.keys(TYP_NAMEN) as Typ[]).map((t) => (
          <button key={t} className={'knopf klein' + (t === typ ? ' haupt' : '')} onClick={() => setTyp(t)}>{TYP_NAMEN[t]}</button>))}
        </div>
        {typ === 'zitat' && <div className="zeile" style={{ marginTop: 10 }}>
          <label style={{ margin: 0 }}><input type="radio" style={{ width: 'auto' }} checked={zitatArt === 'luecke'} onChange={() => setZitatArt('luecke')} /> Lückentext</label>
          <label style={{ margin: 0 }}><input type="radio" style={{ width: 'auto' }} checked={zitatArt === 'wer'} onChange={() => setZitatArt('wer')} /> Wer hat das gesagt?</label>
        </div>}
        {luecke ? <>
          <label>Wörter antippen, die zur Lücke werden (Umschalt-Klick: Bereich)</label>
          <div className="woerter">{woerter(a).map((w, i) => <span key={i} className={'wort' + (luecken.includes(i) ? ' luecke' : '')} onClick={(e) => tippe(i, e.shiftKey)}>{w}</span>)}</div>
        </> : <>
          <label>{typ === 'erklaeren' ? 'Begriff oder These' : typ === 'reflexion' ? 'Frage' : 'Frage'}</label>
          <textarea value={q} autoFocus={!q} onChange={(e) => setQ(e.target.value)} placeholder={typ === 'erklaeren' ? 'z. B. „Aura“ bei Benjamin' : 'Was willst du dich fragen?'} />
          <label>{typ === 'reflexion' ? 'Deine Gedanken' : typ === 'erklaeren' ? 'Original (zum Vergleich)' : 'Antwort – knapp halten'}</label>
          <textarea value={a} onChange={(e) => setA(e.target.value)} />
        </>}
        <div className="zeile" style={{ marginTop: 18 }}>
          <button className="knopf haupt" disabled={!ok} onClick={speichern}>Speichern</button>
          {karte && <button className="leise gefahr" onClick={async () => { await db.buchkarten.put({ ...karte, deleted: true, updatedAt: Date.now() }); onFertig() }}>Karte löschen</button>}
        </div>
      </div>
    </div>
  )
}
