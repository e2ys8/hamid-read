// Beispieldaten, solange daten/werke-start.json fehlt. Alle Angaben: Claude, bitte prüfen.
const P = 'Claude, bitte prüfen'
export const BEISPIEL = [
  {
    id: 'duerer-selbstbildnis-1500', kind: 'werk', title: 'Selbstbildnis im Pelzrock', artist: 'Albrecht Dürer', artistDates: '1471–1528',
    year: '1500', technique: 'Öl auf Lindenholz', dimensions: '67,1 × 48,9 cm', location: 'Alte Pinakothek, München',
    bio: 'Albrecht Dürer (1471–1528) aus Nürnberg gilt als bedeutendster Künstler der deutschen Renaissance. Er verband nordische Genauigkeit mit dem, was er auf zwei Italienreisen lernte, und machte die Druckgrafik zur eigenen Kunstform. Anekdote: Schon mit 13 Jahren zeichnete er sich selbst im Spiegel – das früheste erhaltene Selbstporträt eines europäischen Künstlers.',
    bioSource: P,
    paintTech: [{ text: 'Haare und Pelz mit feinsten Pinselstrichen Haar für Haar gemalt, über einer genauen Unterzeichnung.', src: P }],
    facts: [{ k: '1', q: 'Was ist ungewöhnlich an der Haltung in diesem Selbstbildnis?', a: 'Streng frontal und symmetrisch – eine Pose, die damals Christusbildern vorbehalten war.', src: P }],
    notes: [{ text: 'Inschrift rechts: lateinischer Text mit Namen und Alter (28 Jahre).', src: P }, { text: 'Monogramm „AD“ links neben dem Kopf.', src: P }],
    hotspots: [], related: [], tags: ['Renaissance', 'Selbstbildnis'],
  },
  {
    id: 'rubens-geissblattlaube', kind: 'werk', title: 'Die Geißblattlaube', artist: 'Peter Paul Rubens', artistDates: '1577–1640',
    year: 'um 1609/10', technique: 'Öl auf Leinwand', dimensions: '178 × 136,5 cm', location: 'Alte Pinakothek, München',
    bio: 'Peter Paul Rubens (1577–1640) war der führende Maler des flämischen Barock, Diplomat und Unternehmer mit großer Werkstatt in Antwerpen. Seine Bilder sind voller Bewegung, Licht und Fleisch. Anekdote: Er sprach mehrere Sprachen und verhandelte als Gesandter Frieden zwischen Spanien und England.',
    bioSource: P,
    paintTech: [{ text: 'Helle Grundierung und dünne, transparente Schatten; Lichter pastos aufgesetzt.', src: P }],
    facts: [{ k: '1', q: 'Wen zeigt das Bild?', a: 'Rubens selbst mit seiner ersten Frau Isabella Brant, kurz nach der Hochzeit 1609.', src: P }],
    notes: [{ text: 'Verschränkte rechte Hände – Zeichen der Ehe.', src: P }],
    hotspots: [], related: ['duerer-selbstbildnis-1500'], tags: ['Barock', 'Bildnis'],
  },
  {
    id: 'beckmann-versuchung', kind: 'werk', title: 'Versuchung (Triptychon)', artist: 'Max Beckmann', artistDates: '1884–1950',
    year: '1936/37', technique: 'Öl auf Leinwand', location: 'Pinakothek der Moderne, München',
    bio: 'Max Beckmann (1884–1950) entwickelte nach dem Ersten Weltkrieg eine eigene, figurenreiche Bildsprache mit kräftigen schwarzen Konturen. 1937 als „entartet“ diffamiert, emigrierte er nach Amsterdam und später in die USA. Anekdote: Er schrieb über Jahre ein Tagebuch, in dem er fast jeden Tag festhielt.',
    bioSource: P,
    paintTech: [], facts: [], notes: [], hotspots: [], related: [], tags: ['Moderne', 'Triptychon'],
  },
]
