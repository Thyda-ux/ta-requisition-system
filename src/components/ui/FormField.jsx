export function FormField({ label, htmlFor, required, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  )
}

const baseControl =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

export function Input(props) {
  return <input {...props} className={`${baseControl} ${props.className ?? ''}`} />
}

export function Textarea(props) {
  return <textarea rows={3} {...props} className={`${baseControl} resize-none ${props.className ?? ''}`} />
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={`${baseControl} ${props.className ?? ''}`}>
      {children}
    </select>
  )
}
