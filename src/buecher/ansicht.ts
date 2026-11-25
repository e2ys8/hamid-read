// Gemeinsame Schnittstelle für PDF- und EPUB-Ansicht.
import type { Buch, Markierung } from '../types'
import type { MenueZustand } from './MarkierungsMenue'

export type TocEintrag = { titel: string; ziel: string; ebene: number }
export type AnsichtProps = {
  buch: Buch; blob: Blob; dunkel: boolean; schrift: number
  markierungen: Markierung[]
  ziel: { pos: string; n: number } | null
  onPosition: (pos: string, progress?: number) => void
  onToc: (t: TocEintrag[]) => void
  onMenue: (z: MenueZustand | null) => void
}
