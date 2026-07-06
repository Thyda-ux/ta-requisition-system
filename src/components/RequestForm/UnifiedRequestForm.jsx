import { CheckCircle2, AlertCircle, Send, User } from 'lucide-react'
import { REQUEST_TYPES } from './formConfig'
import { SelectableCard } from '../ui/SelectableCard'
import { Button } from '../ui/Button'
import { GeneralBranch } from './GeneralBranch'
import { MaterialBranch } from './MaterialBranch'
import { useRequestForm } from './useRequestForm'
import { useLookups } from '../../hooks/useLookups'

function SectionLabel({ step, children }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
        {step}
      </span>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
    </div>
  )
}

export function UnifiedRequestForm({ profile }) {
  const lookups = useLookups()
  const { state, actions } = useRequestForm({ profile, lookups })
  const { requestType, action, category, details, errors, submitting, submitted } = state

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
        <h2 className="mt-4 text-xl font-semibold text-slate-900">Request submitted</h2>
        <p className="mt-1 text-sm text-slate-500">
          Reference <span className="font-mono font-medium text-slate-700">{submitted.reference}</span> is now
          pending Line Manager approval.
        </p>
        <Button className="mt-6" onClick={actions.reset}>Create another request</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">New Request</h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit a request for approval. Fields adapt to what you choose.
        </p>
      </header>

      {/* Requestor — pre-filled, read-only */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <SectionLabel step={1}>Requestor</SectionLabel>
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <User size={20} />
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <p className="text-slate-400">Name</p>
              <p className="font-medium text-slate-800">{profile.full_name}</p>
            </div>
            <div>
              <p className="text-slate-400">Department</p>
              <p className="font-medium text-slate-800">{profile.department ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-400">Email</p>
              <p className="font-medium text-slate-800">{profile.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Primary type selector */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <SectionLabel step={2}>Request Type</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {REQUEST_TYPES.map((t) => (
            <SelectableCard
              key={t.value}
              icon={t.icon}
              title={t.label}
              description={t.description}
              active={requestType === t.value}
              onClick={() => actions.chooseType(t.value)}
            />
          ))}
        </div>
      </section>

      {/* Branch (progressive disclosure) */}
      {requestType && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <SectionLabel step={3}>Details</SectionLabel>

          {requestType === 'general' ? (
            <GeneralBranch
              category={category}
              details={details}
              errors={errors}
              onCategory={actions.chooseCategory}
              onField={actions.setField}
              userId={profile.id}
              lookups={lookups}
            />
          ) : (
            <MaterialBranch
              action={action}
              category={category}
              details={details}
              errors={errors}
              onAction={actions.chooseAction}
              onCategory={actions.chooseCategory}
              onField={actions.setField}
              userId={profile.id}
              lookups={lookups}
            />
          )}
        </section>
      )}

      {/* Footer / submit */}
      {requestType && category && (
        <div className="flex items-center justify-between">
          {errors._form ? (
            <p className="flex items-center gap-1.5 text-sm text-rose-500">
              <AlertCircle size={16} /> {errors._form}
            </p>
          ) : <span />}
          <Button onClick={actions.submit} disabled={submitting}>
            <Send size={16} />
            {submitting ? 'Submitting…' : 'Submit Request'}
          </Button>
        </div>
      )}
    </div>
  )
}
