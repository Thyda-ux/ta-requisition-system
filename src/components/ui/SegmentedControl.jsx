export function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              'flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ' +
              (active
                ? 'bg-white text-slate-900 shadow-card'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
