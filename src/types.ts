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
  neueProTag: number          // Obergrenze neuer Karten pro Tag (Kunst + Bücher)
  readerDunkel: boolean
  epubSchrift: number         // Prozent
}

// --- Bücher ---
export type Buch = Basis & {
  id: string; kind: 'buch'
  title: string; author: string; year?: string; language?: string
  format: 'pdf' | 'epub'; file: string          // "datei:<id>" (Blob in IndexedDB)
  cover?: string | null                          // "bild:<id>"
  notiz?: string; notizSource?: 'ki' | 'eigen'   // Bezug zu Gemälden, Künstlern, Epochen
  progress?: number; lastPosition?: string       // EPUB-CFI oder "seite:12"
  ohneText?: boolean                             // gescanntes PDF ohne Textebene
  tags: string[]
}
export type Farbe = 'gelb' | 'gruen' | 'rot' | 'hellblau'
export type Markierung = Basis & {
  id: string; buchId: string; farbe: Farbe
  text: string; position: string   // EPUB: CFI-Bereich; PDF: JSON {seite, rects:[[x,y,w,h]…]} (0..1)
  seite?: number; kapitel?: string; eigeneNotiz?: string; createdAt: number
}
export type BuchKarte = Basis & {
  id: string; buchId: string; markierungId?: string
  typ: 'wissen' | 'reflexion' | 'zitat' | 'erklaeren'
  q: string; a: string; luecken?: number[]     // Wortindizes für Lückentext
  status: 'vorschlag' | 'aktiv' | 'verworfen'; herkunft: 'ki' | 'eigen'
}
export type Datei = { id: string; blob: Blob; name: string; updatedAt: number; deleted?: boolean }
