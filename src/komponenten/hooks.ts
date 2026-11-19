import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { zaehleFaellig } from '../lernen/session'

/** Werk und zugehöriges Künstlerprofil, live aus der Datenbank. */
export function useWerk(id?: string) {
  return useLiveQuery(async () => {
    if (!id) return null
    const werk = await db.werke.get(id)
    if (!werk || werk.deleted) return null
    const kuenstler = werk.artistId ? await db.kuenstler.get(werk.artistId) : undefined
    return { werk, kuenstler }
  }, [id])
}
export const useFaellig = () => useLiveQuery(zaehleFaellig, [], 0)
