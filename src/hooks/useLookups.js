import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/** Loads stock items + cost centers for the Material / Grab branches. */
export function useLookups() {
  const [lookups, setLookups] = useState({ stockItems: [], costCenters: [] })

  useEffect(() => {
    let active = true
    async function load() {
      const [{ data: stockItems }, { data: costCenters }] = await Promise.all([
        supabase.from('stock_items').select('id, name, unit, quantity, returnable').eq('active', true).order('name'),
        supabase.from('cost_centers').select('id, code, name').eq('active', true).order('code'),
      ])
      if (active) setLookups({ stockItems: stockItems ?? [], costCenters: costCenters ?? [] })
    }
    load()
    return () => { active = false }
  }, [])

  return lookups
}
