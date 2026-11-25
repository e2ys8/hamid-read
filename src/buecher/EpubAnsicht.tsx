// EPUB-Ansicht mit epub.js: Seiten blättern, Positionen als CFI, Markierungen als Hervorhebungen.
import { useEffect, useRef, useState } from 'react'
import ePub from 'epubjs'
import { db } from '../db'
import { FARBEN } from './farben'
import type { AnsichtProps, TocEintrag } from './ansicht'
import { aufWortgrenzen } from './markieren'

const THEMEN = {
  hell: { body: { color: '#2a2620 !important', background: '#f4efe4 !important' }, a: { color: '#7d5e2c !important' } },
  dunkel: { body: { color: '#e9e3d6 !important', background: '#13211b !important' }, a: { color: '#d6b57f !important' } },
}

export function EpubAnsicht(p: AnsichtProps) {
  const el = useRef<HTMLDivElement>(null)
  const rend = useRef<any>(null)
  const buchRef = useRef<any>(null)
  const [bereit, setBereit] = useState(false)
  const angelegt = useRef(new Map<string, { cfi: string; farbe: string }>())
  const props = useRef(p); props.current = p
  const toc = useRef<TocEintrag[]>([])
  const kapitel = useRef<string | undefined>(undefined)

  useEffect(() => {
    let aus = false
    ;(async () => {
      const book = ePub((await p.blob.arrayBuffer()) as any)
      if (aus) return
      buchRef.current = book
      const r = book.renderTo(el.current!, { width: '100%', height: '100%', flow: 'paginated', spread: 'none', allowScriptedContent: false } as any)
      rend.current = r
      r.themes.register('hell', THEMEN.hell); r.themes.register('dunkel', THEMEN.dunkel)
      r.themes.default({ p: { 'line-height': '1.6' }, '::selection': { background: 'rgba(184,147,90,.4)' }, body: { 'font-family': "'Iowan Old Style', Georgia, serif" } })
      r.themes.select(p.dunkel ? 'dunkel' : 'hell')
      r.themes.fontSize(`${p.schrift}%`)
      book.loaded.navigation.then((nav: any) => {
        const out: TocEintrag[] = []
        const f = (items: any[], ebene: number) => items?.forEach((it) => { out.push({ titel: it.label.trim(), ziel: it.href, ebene }); f(it.subitems, ebene + 1) })
        f(nav.toc, 0); toc.current = out; props.current.onToc(out)
      })
      r.on('relocated', (loc: any) => {
        const cfi = loc.start.cfi
        const href = String(loc.start.href).split('#')[0]
        kapitel.current = [...toc.current].reverse().find((t) => t.ziel.split('#')[0].endsWith(href) || href.endsWith(t.ziel.split('#')[0]))?.titel ?? kapitel.current
        const pct = book.locations.length() ? book.locations.percentageFromCfi(cfi) : undefined
        props.current.onPosition(cfi, pct)
      })
      r.on('selected', (cfiRoh: string, contents: any) => {
        const roh = r.getRange(cfiRoh); if (!roh) return
        const range = aufWortgrenzen(roh)
        const cfiRange: string = contents.cfiFromRange(range)
        const txt = range.toString().replace(/\s+/g, ' ').trim()
        if (!txt) return
        const b = range.getBoundingClientRect()
        const f = contents.document.defaultView.frameElement.getBoundingClientRect()
        props.current.onMenue({ x: f.left + b.left + b.width / 2, y: f.top + b.top, unten: f.top + b.bottom, auswahl: { text: txt, position: cfiRange, kapitel: kapitel.current } })
      })
      r.on('click', (e: MouseEvent) => {
        const sel = (e.view as Window | null)?.getSelection()
        if (!sel || sel.isCollapsed) props.current.onMenue(null)
      })
      r.on('keyup', (e: KeyboardEvent) => { if (e.key === 'ArrowRight') r.next(); if (e.key === 'ArrowLeft') r.prev() })
      await r.display(p.buch.lastPosition || undefined)
      if (aus) return
      setBereit(true)
      // Fortschritt in Prozent: Positionen einmal berechnen und zwischenspeichern
      const ck = 'epub-loc:' + p.buch.id
      const cache = (await db.meta.get(ck))?.value as string | undefined
      if (cache) book.locations.load(cache)
      else book.ready.then(() => book.locations.generate(1600)).then(() => db.meta.put({ key: ck, value: book.locations.save() }))
    })()
    return () => { aus = true; angelegt.current.clear(); try { buchRef.current?.destroy() } catch { /* schon zu */ } buchRef.current = null; rend.current = null }
  }, [p.blob])

  useEffect(() => { rend.current?.themes.select(p.dunkel ? 'dunkel' : 'hell') }, [p.dunkel])
  useEffect(() => { rend.current?.themes.fontSize(`${p.schrift}%`) }, [p.schrift])
  useEffect(() => { if (p.ziel && rend.current) rend.current.display(p.ziel.pos) }, [p.ziel])

  // Markierungen abgleichen
  useEffect(() => {
    const r = rend.current; if (!r || !bereit) return
    const jetzt = new Map(p.markierungen.map((m) => [m.id, m]))
    for (const [id, a] of angelegt.current) {
      const m = jetzt.get(id)
      if (!m || m.farbe !== a.farbe) { r.annotations.remove(a.cfi, 'highlight'); angelegt.current.delete(id) }
    }
    for (const m of p.markierungen) {
      if (angelegt.current.has(m.id)) continue
      r.annotations.highlight(m.position, { id: m.id }, (e: MouseEvent) => {
        props.current.onMenue({ x: e.clientX, y: e.clientY - 8, unten: e.clientY + 8, markierungId: m.id })
      }, 'hr-hl', { fill: FARBEN[m.farbe].css, 'fill-opacity': '0.45', 'mix-blend-mode': 'multiply' })
      angelegt.current.set(m.id, { cfi: m.position, farbe: m.farbe })
    }
  }, [p.markierungen, bereit])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return
      if (e.key === 'ArrowRight') rend.current?.next()
      if (e.key === 'ArrowLeft') rend.current?.prev()
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])

  const blaettern = (d: number) => { props.current.onMenue(null); d > 0 ? rend.current?.next() : rend.current?.prev() }
  return (
    <div className="epub-huelle">
      <button className="epub-rand links" onClick={() => blaettern(-1)} aria-label="Zurück">‹</button>
      <div className="epub-flaeche" ref={el} />
      <button className="epub-rand rechts" onClick={() => blaettern(1)} aria-label="Weiter">›</button>
    </div>
  )
}
