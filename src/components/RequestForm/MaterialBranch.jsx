import { Car } from 'lucide-react'
import { SegmentedControl } from '../ui/SegmentedControl'
import { FormField, Select } from '../ui/FormField'
import { DynamicField } from './DynamicField'
import { MATERIAL_ACTIONS, CATEGORY_FIELDS } from './formConfig'

/**
 * Branch B — Material Request.
 * Shows [ Use Stock ] / [ Request Buy ] tabs immediately.
 * Grab Ride is the exception: choosing it as the item morphs the form
 * to capture ride logistics instead of the standard material fields.
 */
export function MaterialBranch({
  action, category, details, errors,
  onAction, onCategory, onField, userId, lookups,
}) {
  // `category` is 'grab_ride' when the Grab morph is active; otherwise it
  // follows the selected action ('use_stock' | 'buy').
  const isGrab = category === 'grab_ride'
  const effectiveCategory = isGrab ? 'grab_ride' : action
  const fields = CATEGORY_FIELDS[effectiveCategory] ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={MATERIAL_ACTIONS}
          value={action}
          onChange={(v) => {
            onAction(v)
            onCategory(v) // leaving the Grab morph resets category back to the action
          }}
        />

        {/* Grab Ride toggle — the "exception" item */}
        <button
          type="button"
          onClick={() => onCategory(isGrab ? action : 'grab_ride')}
          className={
            'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ' +
            (isGrab
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700')
          }
        >
          <Car size={16} />
          Grab Ride
        </button>
      </div>

      {isGrab && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
          <Car size={16} className="mt-0.5 shrink-0" />
          <span>Grab Ride selected — capturing trip logistics instead of standard material details.</span>
        </div>
      )}

      <div
        className={
          'grid grid-cols-1 gap-5 rounded-xl border p-5 sm:grid-cols-2 transition-colors ' +
          (isGrab ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-slate-50/60')
        }
      >
        {fields.map((field) => (
          <div key={field.name} className={field.type === 'textarea' || field.type === 'file' ? 'sm:col-span-2' : ''}>
            <DynamicField
              field={field}
              value={details[field.name]}
              error={errors[field.name]}
              onChange={onField}
              userId={userId}
              lookups={lookups}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
