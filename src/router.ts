// Einfaches Hash-Routing: #/kunst, #/buecher, #/netz …
import { useEffect, useState } from 'react'

export function useRoute() {
  const lies = () => decodeURI(location.hash.replace(/^#/, '') || '/')
  const [r, setR] = useState(lies)
  useEffect(() => {
    const f = () => { setR(lies()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  const [pfad, query = ''] = r.split('?')
  return { teile: pfad.split('/').filter(Boolean), query: new URLSearchParams(query) }
}
export const geh = (p: string) => { location.hash = p }
