// PDF-Ansicht: eine Seite, Breite angepasst, mit Textebene zum Markieren (PDF.js).
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { ladePdf, pdfjs } from './pdf'
import { FARBEN } from './farben'
import { aufWortgrenzen } from './markieren'
import type { AnsichtProps, TocEintrag } from './ansicht'

type R = [number, number, number, number] // x, y, w, h – Anteile der Seite (0..1)
const rund = (n: number) => Math.round(n * 10000) / 10000

/** Rechtecke einer Auswahl zu Zeilen zusammenfassen. */
function zuZeilen(rs: R[]): R[] {
  const s = [...rs].sort((a, b) => a[1] - b[1] || a[0] - b[0])
  const out: R[] = []
  for (const r of s) {
    const z = out.find((m) => Math.abs(m[1] - r[1]) < m[3] * 0.5 && Math.abs(m[3] - r[3]) < m[3] * 0.7)
    if (z && r[0] <= z[0] + z[2] + 0.03) {
      const x = Math.min(z[0], r[0]), y = Math.min(z[1], r[1])
      z[2] = Math.max(z[0] + z[2], r[0] + r[2]) - x; z[3] = Math.max(z[1] + z[3], r[1] + r[3]) - y; z[0] = x; z[1] = y
    } else out.push([...r])
  }
  return out.map((r) => r.map(rund) as R)
}
export const pdfSeite = (pos?: string) => {
  if (!pos) return undefined
  const m = pos.match(/^seite:(\d+)/); if (m) return +m[1]
  try { return JSON.parse(pos).seite as number } catch { return undefined }
}

export function PdfAnsicht(p: AnsichtProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>()
  const [seite, setSeite] = useState(() => pdfSeite(p.buch.lastPosition) ?? 1)
  const [breite, setBreite] = useState(0)
  const [masse, setMasse] = useState<{ w: number; h: number }>()
  const huelle = useRef<HTMLDivElement>(null)
  const seiteEl = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const text = useRef<HTMLDivElement>(null)
  const kapitel = useRef<{ seite: number; titel: string }[]>([])
  const props = useRef(p); props.current = p

  useEffect(() => {
    let aus = false, doc: PDFDocumentProxy | undefined
    ladePdf(p.blob).then(async (d) => {
      if (aus) { d.loadingTask.destroy(); return }
      doc = d; setPdf(d)
      // Inhaltsverzeichnis mit Seitenzahlen
      const toc: TocEintrag[] = []
      const flach = async (items: any[], ebene: number) => {
        for (const it of items ?? []) {
          let s: number | undefined
          try {
            const dest = typeof it.dest === 'string' ? await d.getDestination(it.dest) : it.dest
            if (dest?.[0]) s = typeof dest[0] === 'number' ? dest[0] + 1 : (await d.getPageIndex(dest[0])) + 1
          } catch { /* ohne Ziel */ }
          if (s) toc.push({ titel: it.title, ziel: 'seite:' + s, ebene })
          await flach(it.items, ebene + 1)
        }
      }
      await flach((await d.getOutline().catch(() => [])) ?? [], 0)
      kapitel.current = toc.map((t) => ({ seite: pdfSeite(t.ziel)!, titel: t.titel })).sort((a, b) => a.seite - b.seite)
      props.current.onToc(toc)
    })
    return () => { aus = true; doc?.loadingTask.destroy() }
  }, [p.blob])

  useEffect(() => {
    const r = () => setBreite(huelle.current?.clientWidth ?? 0)
    r(); addEventListener('resize', r); return () => removeEventListener('resize', r)
  }, [])

  // Seite rendern
  useEffect(() => {
    if (!pdf || !breite) return
    let task: RenderTask | undefined, tl: InstanceType<typeof pdfjs.TextLayer> | undefined, aus = false
    const s = Math.min(Math.max(1, seite), pdf.numPages)
    pdf.getPage(s).then(async (page) => {
      if (aus) return
      const basis = page.getViewport({ scale: 1 })
      const scale = Math.min(breite - 24, 980) / basis.width
      const vp = page.getViewport({ scale })
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const c = canvas.current!
      c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr)
      setMasse({ w: vp.width, h: vp.height })
      task = page.render({ canvas: c, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
      await task.promise.catch(() => {})
      if (aus || !text.current) return
      text.current.replaceChildren()
      text.current.style.setProperty('--total-scale-factor', String(scale))
      text.current.style.setProperty('--scale-factor', String(scale))
      tl = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: text.current, viewport: vp })
      await tl.render().catch(() => {})
      const end = document.createElement('div'); end.className = 'endOfContent'; text.current.append(end)
    })
    props.current.onPosition(`seite:${s}`, s / pdf.numPages)
    return () => { aus = true; task?.cancel(); tl?.cancel() }
  }, [pdf, seite, breite])

  const blaettern = (d: number) => { if (pdf) { setSeite((s) => Math.min(pdf.numPages, Math.max(1, s + d))); props.current.onMenue(null); huelle.current?.scrollTo(0, 0) } }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') blaettern(1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') blaettern(-1)
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })
  useEffect(() => { const s = pdfSeite(p.ziel?.pos); if (s) setSeite(s) }, [p.ziel])

  // Textauswahl → Farbleiste
  useEffect(() => {
    let t: number | undefined
    const pruefe = () => {
      const sel = getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount || !text.current || !seiteEl.current) return
      if (!text.current.contains(sel.getRangeAt(0).commonAncestorContainer)) return
      const range = aufWortgrenzen(sel.getRangeAt(0))
      const txt = range.toString().replace(/\s+/g, ' ').trim()
      if (!txt) return
      const pr = seiteEl.current.getBoundingClientRect()
      const rects = zuZeilen([...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1)
        .map((r) => [(r.left - pr.left) / pr.width, (r.top - pr.top) / pr.height, r.width / pr.width, r.height / pr.height] as R))
      if (!rects.length) return
      const b = range.getBoundingClientRect()
      const kap = [...kapitel.current].reverse().find((k) => k.seite <= seite)?.titel
      props.current.onMenue({ x: b.left + b.width / 2, y: b.top, unten: b.bottom, auswahl: { text: txt, position: JSON.stringify({ seite, rects }), seite, kapitel: kap } })
    }
    const sc = () => { clearTimeout(t); t = window.setTimeout(pruefe, 350) }
    document.addEventListener('selectionchange', sc)
    return () => { document.removeEventListener('selectionchange', sc); clearTimeout(t) }
  }, [seite])

  // Tippen auf eine vorhandene Markierung
  const tippen = (e: React.PointerEvent) => {
    const sel = getSelection()
    if (sel && !sel.isCollapsed) return
    const pr = seiteEl.current!.getBoundingClientRect()
    const x = (e.clientX - pr.left) / pr.width, y = (e.clientY - pr.top) / pr.height
    const treffer = hier.find((m) => m.rects.some(([rx, ry, rw, rh]) => x >= rx && x <= rx + rw && y >= ry - 0.004 && y <= ry + rh + 0.004))
    props.current.onMenue(treffer ? { x: e.clientX, y: e.clientY - 8, unten: e.clientY + 8, markierungId: treffer.m.id } : null)
  }

  const hier = p.markierungen.flatMap((m) => {
    try { const pos = JSON.parse(m.position); return pos.seite === seite ? [{ m, rects: pos.rects as R[] }] : [] } catch { return [] }
  })

  return (
    <div className="pdf-huelle" ref={huelle}>
      {p.buch.ohneText && <div className="hinweis" style={{ maxWidth: 700, margin: '0 auto 12px' }}>Dieses PDF ist offenbar gescannt und hat keine Textebene – Markieren geht hier nicht. Texterkennung kann später ergänzt werden.</div>}
      <div className={'pdf-seite' + (p.dunkel ? ' dunkel' : '')} ref={seiteEl} style={masse ? { width: masse.w, height: masse.h } : undefined} onPointerUp={tippen}>
        <canvas ref={canvas} style={masse ? { width: masse.w, height: masse.h } : undefined} />
        <div className="markierungen-ebene">
          {hier.flatMap(({ m, rects }) => rects.map((r, i) => (
            <div key={m.id + i} className="pdf-hl" style={{ left: `${r[0] * 100}%`, top: `${r[1] * 100}%`, width: `${r[2] * 100}%`, height: `${r[3] * 100}%`, background: FARBEN[m.farbe].css }} />)))}
        </div>
        <div className="textLayer" ref={text} />
      </div>
      {pdf && <div className="blaettern">
        <button className="leise" onClick={() => blaettern(-1)} disabled={seite <= 1}>‹</button>
        <span className="gedimmt klein">{seite} / {pdf.numPages}</span>
        <button className="leise" onClick={() => blaettern(1)} disabled={seite >= pdf.numPages}>›</button>
      </div>}
    </div>
  )
}
