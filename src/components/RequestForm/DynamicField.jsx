import { FormField, Input, Select, Textarea } from '../ui/FormField'
import { FileDropzone } from '../ui/FileDropzone'

/**
 * Renders one field from the config against the `details` state.
 * All branch field UIs funnel through here, so every category gets
 * consistent styling and validation display for free.
 */
export function DynamicField({ field, value, onChange, error, userId, lookups }) {
  const id = `field-${field.name}`

  function set(v) {
    onChange(field.name, v)
  }

  let control
  switch (field.type) {
    case 'textarea':
      control = (
        <Textarea id={id} value={value ?? ''} onChange={(e) => set(e.target.value)} />
      )
      break

    case 'number':
      control = (
        <Input
          id={id}
          type="number"
          min={field.min}
          value={value ?? ''}
          onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))}
        />
      )
      break

    case 'date':
    case 'time':
      control = (
        <Input id={id} type={field.type} value={value ?? ''} onChange={(e) => set(e.target.value)} />
      )
      break

    case 'select':
      control = (
        <Select id={id} value={value ?? ''} onChange={(e) => set(e.target.value)}>
          <option value="" disabled>Select…</option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      )
      break

    case 'stock_select':
      control = (
        <Select
          id={id}
          value={value ?? ''}
          onChange={(e) => {
            const item = lookups.stockItems.find((s) => s.id === e.target.value)
            // stash the display name alongside the id for the JSONB payload
            onChange(field.name, e.target.value)
            onChange('item_name', item?.name ?? '')
            onChange('unit', item?.unit ?? 'unit')
          }}
        >
          <option value="" disabled>Select an item…</option>
          {lookups.stockItems.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.quantity} {s.unit} in stock{s.returnable ? ' (returnable)' : ''}
            </option>
          ))}
        </Select>
      )
      break

    case 'cost_center_select':
      control = (
        <Select id={id} value={value ?? ''} onChange={(e) => set(e.target.value)}>
          <option value="" disabled>Select a cost center…</option>
          {lookups.costCenters.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
          ))}
        </Select>
      )
      break

    case 'file':
      control = (
        <FileDropzone
          value={value}
          folder={`${userId}/${field.folderKey ?? 'attachments'}`}
          onUploaded={(meta) => set(meta)}
        />
      )
      break

    default: // text
      control = (
        <Input id={id} type="text" value={value ?? ''} onChange={(e) => set(e.target.value)} />
      )
  }

  return (
    <FormField label={field.label} htmlFor={id} required={field.required} hint={field.hint} error={error}>
      {control}
    </FormField>
  )
}
