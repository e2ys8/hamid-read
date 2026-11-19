// Erzeugt PNG-Icons aus public/icon.svg
import sharp from 'sharp'
const svg = 'public/icon.svg'
for (const [n, s] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]])
  await sharp(svg).resize(s, s).png().toFile('public/' + n)
console.log('Icons erzeugt')
