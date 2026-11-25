// PDF.js einrichten (Worker wird mitgebündelt, funktioniert offline).
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
export { pdfjs }
export const ladePdf = async (blob: Blob) => pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
