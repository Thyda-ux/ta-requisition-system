export function Button({ variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    ghost: 'text-slate-500 hover:bg-slate-100',
  }
  return (
    <button
      {...props}
      className={
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ' +
        'transition-colors disabled:cursor-not-allowed ' +
        variants[variant] +
        ' ' +
        className
      }
    />
  )
}
