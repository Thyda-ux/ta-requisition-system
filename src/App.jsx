import { useProfile } from './hooks/useProfile'
import { UnifiedRequestForm } from './components/RequestForm/UnifiedRequestForm'
import { Loader2 } from 'lucide-react'

// Set to true to preview the UI without a Supabase session (uses a mock profile).
const DEV_PREVIEW = import.meta.env.VITE_DEV_PREVIEW === 'true'

const MOCK_PROFILE = {
  id: '00000000-0000-0000-0000-000000000000',
  full_name: 'Sophea Chan',
  email: 'sophea.chan@tacoin.com',
  department: 'Operations',
  role: 'officer',
  line_manager_id: null,
}

export default function App() {
  const { profile, loading, error } = useProfile()

  const effectiveProfile = DEV_PREVIEW ? MOCK_PROFILE : profile

  if (!DEV_PREVIEW && loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (!DEV_PREVIEW && (error || !profile)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
          <p className="font-medium text-slate-800">Please sign in</p>
          <p className="mt-1 text-sm text-slate-500">
            You need an active session to submit a request.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-50 py-10 px-4">
      <UnifiedRequestForm profile={effectiveProfile} />
    </div>
  )
}
