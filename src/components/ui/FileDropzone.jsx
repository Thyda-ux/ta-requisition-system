import { useRef, useState } from 'react'
import { UploadCloud, FileText, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const BUCKET = 'request-attachments'

/**
 * Uploads directly to Supabase Storage on selection and reports the
 * resulting storage path back via onUploaded, so the parent form only
 * ever holds a path string (not the raw file) in its state.
 */
export function FileDropzone({ value, onUploaded, folder, accept = '.pdf,.jpg,.jpeg,.png' }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(file) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const path = `${folder}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false })
      if (uploadError) throw uploadError
      onUploaded({ path, name: file.name })
    } catch (err) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <FileText size={16} className="text-brand-600" />
          <span className="truncate max-w-[220px]">{value.name}</span>
        </div>
        <button
          type="button"
          onClick={() => onUploaded(null)}
          className="text-slate-400 hover:text-rose-500"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed
                   border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 transition-colors
                   hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60"
      >
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-brand-600" />
        ) : (
          <UploadCloud size={20} className="text-slate-400" />
        )}
        <span>{uploading ? 'Uploading…' : 'Click to upload a file'}</span>
        <span className="text-xs text-slate-400">PDF, JPG or PNG</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  )
}
