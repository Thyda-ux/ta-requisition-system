import { useCallback, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { CATEGORY_FIELDS, deriveTitle } from './formConfig'

/**
 * Central state machine for the Unified Request Form.
 *
 *   requestType : 'general' | 'material' | null
 *   action      : 'use_stock' | 'buy'          (material only)
 *   category    : the concrete sub-category driving which fields show
 *   details     : { [fieldName]: value }         (becomes the JSONB payload)
 *
 * Progressive disclosure falls out of these values: components render
 * nothing until the value above them in the tree is chosen.
 */
export function useRequestForm({ profile, lookups }) {
  const [requestType, setRequestType] = useState(null)
  const [action, setAction] = useState('use_stock')
  const [category, setCategory] = useState(null)
  const [details, setDetails] = useState({})
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  // --- transitions -----------------------------------------------------------
  const chooseType = useCallback((type) => {
    setRequestType(type)
    setErrors({})
    setDetails({})
    if (type === 'material') {
      setAction('use_stock')
      setCategory('use_stock')
    } else {
      setCategory(null) // general waits for the sub-category dropdown
    }
  }, [])

  const chooseCategory = useCallback((cat) => {
    setCategory(cat)
    setErrors({})
    setDetails({}) // switching category clears stale fields
  }, [])

  const chooseAction = useCallback((act) => {
    setAction(act)
    setErrors({})
    setDetails({})
  }, [])

  const setField = useCallback((name, value) => {
    setDetails((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev))
  }, [])

  const reset = useCallback(() => {
    setRequestType(null)
    setCategory(null)
    setAction('use_stock')
    setDetails({})
    setErrors({})
    setSubmitted(null)
  }, [])

  // --- validation ------------------------------------------------------------
  const activeFields = useMemo(
    () => (category ? CATEGORY_FIELDS[category] ?? [] : []),
    [category],
  )

  const validate = useCallback(() => {
    const next = {}
    for (const field of activeFields) {
      if (!field.required) continue
      const v = details[field.name]
      if (v === undefined || v === null || v === '' ) {
        next[field.name] = `${field.label} is required`
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }, [activeFields, details])

  // --- submit ----------------------------------------------------------------
  const submit = useCallback(async () => {
    if (!requestType || !category) {
      setErrors((e) => ({ ...e, _form: 'Choose a request type and category first.' }))
      return
    }
    if (!validate()) return

    setSubmitting(true)
    try {
      // Use-stock of a returnable item starts life pending a return (doc §5.3).
      let returnStatus = 'not_applicable'
      if (category === 'use_stock') {
        const item = lookups.stockItems.find((s) => s.id === details.stock_item_id)
        if (item?.returnable) returnStatus = 'pending_return'
      }

      const payload = {
        requestor_id: profile.id,
        department: profile.department,
        request_type: requestType,
        category,
        title: deriveTitle(category, details),
        details,
        status: 'pending_line_manager',
        current_stage: 'line_manager',
        return_status: returnStatus,
        submitted_at: new Date().toISOString(),
      }
      // The DB seeds the pending approval rows via trigger (seed_request_approvals),
      // so the client only needs to insert the request itself.
      const { data, error } = await supabase
        .from('requests')
        .insert(payload)
        .select('id, reference, status')
        .single()
      if (error) throw error

      setSubmitted(data)
    } catch (err) {
      setErrors((e) => ({ ...e, _form: err.message ?? 'Submission failed' }))
    } finally {
      setSubmitting(false)
    }
  }, [requestType, category, validate, profile, details, lookups])

  return {
    state: { requestType, action, category, details, errors, submitting, submitted },
    actions: { chooseType, chooseCategory, chooseAction, setField, submit, reset },
  }
}
