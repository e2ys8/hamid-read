// Vier Markierfarben mit Bedeutung – und welcher Kartentyp daraus entsteht.
import type { Farbe, BuchKarte } from '../types'

export const FARBEN: Record<Farbe, { name: string; bedeutung: string; css: string; typ: BuchKarte['typ'] }> = {
  gelb: { name: 'Gelb', bedeutung: 'interessant', css: '#f2d25c', typ: 'wissen' },
  gruen: { name: 'Grün', bedeutung: 'wusste ich noch nicht', css: '#8fcf7e', typ: 'wissen' },
  rot: { name: 'Rot', bedeutung: 'persönlich sehr wichtig', css: '#ec8a7a', typ: 'reflexion' },
  hellblau: { name: 'Hellblau', bedeutung: 'gutes Zitat', css: '#8fc9ec', typ: 'zitat' },
}
export const FARB_LISTE = Object.keys(FARBEN) as Farbe[]
export const TYP_NAMEN: Record<BuchKarte['typ'], string> = {
  wissen: 'Wissenskarte', reflexion: 'Reflexionskarte', zitat: 'Zitatkarte', erklaeren: 'Mit eigenen Worten erklären',
}
export const REFLEXION = 'Was bedeutet das für mich – für mein Malen?'
