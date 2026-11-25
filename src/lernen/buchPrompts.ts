// Lernfragen aus Bücherkarten (nur Karten mit Status „aktiv“).
import type { Buch, BuchKarte, Markierung } from '../types'
import type { Prompt } from '../kunst/prompts'
import { TYP_NAMEN } from '../buecher/farben'

export const woerter = (t: string) => t.split(/\s+/).filter(Boolean)
export function lueckentext(a: string, luecken: number[]) {
  return woerter(a).map((w, i) => (luecken.includes(i) ? '_'.repeat(Math.max(4, Math.min(12, w.length))) : w)).join(' ')
}

export function promptFuerKarte(k: BuchKarte, b?: Buch, m?: Markierung): Prompt {
  const stelle = [b?.title, m?.seite ? `S. ${m.seite}` : m?.kapitel].filter(Boolean).join(', ')
  const frage = k.typ === 'zitat' && k.luecken?.length ? lueckentext(k.a, k.luecken) : k.q
  return {
    key: `buch~${k.id}`, buchId: k.buchId, markierungId: k.markierungId, farbe: m?.farbe,
    art: k.typ, frage: frage || TYP_NAMEN[k.typ], antwort: k.a, quelle: stelle || undefined,
    zeigeBild: false, laut: k.typ === 'erklaeren' || k.typ === 'reflexion',
  }
}
