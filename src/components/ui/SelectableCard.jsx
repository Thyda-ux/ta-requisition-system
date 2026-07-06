export function SelectableCard({ icon, title, description, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all ' +
        (active
          ? 'border-brand-500 bg-brand-50/60 shadow-popover ring-1 ring-brand-500'
          : 'border-slate-200 bg-white shadow-card hover:border-brand-200 hover:shadow-popover')
      }
    >
      <div
        className={
          'flex h-11 w-11 items-center justify-center rounded-xl ' +
          (active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')
        }
      >
        {icon}
      </div>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
    </button>
  )
}
