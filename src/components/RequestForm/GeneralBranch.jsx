import { FormField, Select } from '../ui/FormField'
import { DynamicField } from './DynamicField'
import { GENERAL_CATEGORIES, CATEGORY_FIELDS } from './formConfig'

/**
 * Branch A — General Request.
 * A sub-category dropdown reveals the matching field set (progressive disclosure).
 */
export function GeneralBranch({ category, details, errors, onCategory, onField, userId, lookups }) {
  const fields = category ? CATEGORY_FIELDS[category] ?? [] : []

  return (
    <div className="space-y-5">
      <FormField label="Request Category" htmlFor="general-category" required>
        <Select
          id="general-category"
          value={category ?? ''}
          onChange={(e) => onCategory(e.target.value)}
        >
          <option value="" disabled>Choose a category…</option>
          {GENERAL_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </FormField>

      {category && (
        <div className="grid grid-cols-1 gap-5 rounded-xl border border-slate-100 bg-slate-50/60 p-5 sm:grid-cols-2">
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
      )}
    </div>
  )
}
