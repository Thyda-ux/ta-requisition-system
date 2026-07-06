import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Loads the signed-in user's auth session plus their profile row
 * (full name, department, line manager) so the form's requestor
 * section can be pre-filled and read-only.
 */
export function useProfile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        if (active) {
          setError(authError ?? new Error('Not signed in'))
          setLoading(false)
        }
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, department, role, line_manager_id')
        .eq('id', user.id)
        .single()

      if (!active) return
      if (profileError) {
        setError(profileError)
      } else {
        setProfile(data)
      }
      setLoading(false)
    }

    load()
    return () => { active = false }
  }, [])

  return { profile, loading, error }
}
