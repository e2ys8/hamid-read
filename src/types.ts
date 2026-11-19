// Datenmodell – siehe CLAUDE.md. Alle Datensätze: updatedAt + deleted (weiches Löschen).
export type Basis = { updatedAt: number; deleted?: boolean }
export type Quelle = { text: string; src?: string }

export type Werk = Basis & {
  id: string; kind: 'werk'
  title: string; artist: string; artistDates?: string; year?: string
  technique?: string; dimensions?: string; inventory?: string; location?: string; sourceUrl?: string
  image?: string | null            // "bild:<id>" (Blob in IndexedDB) oder URL
  bio?: string; bioSource?: string // nur Altbestand → wird in Kuenstler überführt
  artistId?: string
  paintTech: Quelle[]
  facts: { k: string; q: string; a: string; src?: string }[]   // k bleibt stabil!
  notes: Quelle[]
  hotspots: { k: string; x: number; y: number; q?: string; a: string }[]
  related: string[]; tags: string[]
}
export type Kuenstler = Basis & {
  id: string; name: string; dates?: string; bio?: string; bioSource?: string; paintTech: Quelle[]
}
export type AbcListe = Basis & {
  id: string; bezug: { art: 'werk' | 'buch'; id: string }
  lists: { d: number; e: Record<string, string> }[]
}
export type Probe = Basis & {
  id: string; werkId: string; d: number; dauerMin: number; transkript?: string; genannt: string[]
}
export type Lernstand = Basis & {
  key: string; ease: number; ivl: number; reps: number; lapses: number; due: number; last: number
}
export type Bild = { id: string; blob: Blob; updatedAt: number }
export type Einstellungen = {
  startModus: 'zufall' | 'tag'
  neueProEinheit: number
}
