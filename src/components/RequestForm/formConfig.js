import { FileText, Package } from 'lucide-react'
import { createElement } from 'react'

/**
 * Single source of truth for the dynamic form.
 * Each category declares its fields; the renderer walks this config,
 * so adding a new sub-category never touches component code.
 */

export const REQUEST_TYPES = [
  {
    value: 'general',
    label: 'General Request',
    description: 'Leave, meeting rooms, IT support and other internal requests.',
    icon: createElement(FileText, { size: 22 }),
  },
  {
    value: 'material',
    label: 'Material Request',
    description: 'Buy new materials or use items already in company stock.',
    icon: createElement(Package, { size: 22 }),
  },
]

// General Request sub-categories (shown in a dropdown)
export const GENERAL_CATEGORIES = [
  { value: 'sick_leave',    label: 'Sick Leave' },
  { value: 'annual_leave',  label: 'Annual Leave' },
  { value: 'meeting_room',  label: 'Meeting Room Booking' },
  { value: 'it_support',    label: 'IT Support' },
  { value: 'general_other', label: 'Other' },
]

// Material Request quick-action tabs
export const MATERIAL_ACTIONS = [
  { value: 'use_stock', label: 'Use Stock' },
  { value: 'buy',       label: 'Request Buy' },
]

/**
 * Field definitions keyed by category.
 * type: text | textarea | number | date | time | select | file | stock_select | cost_center_select
 */
export const CATEGORY_FIELDS = {
  // ---- General ----
  sick_leave: [
    { name: 'start_date', label: 'Start Date', type: 'date', required: true },
    { name: 'end_date',   label: 'End Date',   type: 'date', required: true },
    { name: 'reason',     label: 'Reason',     type: 'textarea' },
    {
      name: 'medical_cert',
      label: 'Medical Certificate',
      type: 'file',
      hint: 'Attach a scan/photo of the certificate (PDF, JPG, PNG).',
      folderKey: 'sick-cert',
    },
  ],
  annual_leave: [
    { name: 'start_date', label: 'Start Date', type: 'date', required: true },
    { name: 'end_date',   label: 'End Date',   type: 'date', required: true },
    { name: 'reason',     label: 'Reason',     type: 'textarea' },
  ],
  meeting_room: [
    { name: 'room',       label: 'Room', type: 'select', required: true,
      options: ['Meeting Room A', 'Meeting Room B', 'Board Room', 'Training Room'] },
    { name: 'date',       label: 'Date',       type: 'date', required: true },
    { name: 'start_time', label: 'Start Time', type: 'time', required: true },
    { name: 'end_time',   label: 'End Time',   type: 'time', required: true },
    { name: 'attendees',  label: 'No. of Attendees', type: 'number', min: 1 },
    { name: 'purpose',    label: 'Purpose', type: 'textarea' },
  ],
  it_support: [
    { name: 'issue_type', label: 'Issue Type', type: 'select', required: true,
      options: ['Hardware', 'Software', 'Network', 'Account / Access', 'Other'] },
    { name: 'priority',   label: 'Priority', type: 'select',
      options: ['Low', 'Medium', 'High', 'Urgent'] },
    { name: 'description', label: 'Describe the issue', type: 'textarea', required: true },
  ],
  general_other: [
    { name: 'subject',     label: 'Subject', type: 'text', required: true },
    { name: 'description', label: 'Details', type: 'textarea', required: true },
    { name: 'expected_date', label: 'Expected Date', type: 'date' },
  ],

  // ---- Material: Buy ----
  buy: [
    { name: 'item_name',     label: 'Item Name', type: 'text', required: true },
    { name: 'quantity',      label: 'Quantity',  type: 'number', required: true, min: 1 },
    { name: 'unit',          label: 'Unit', type: 'select',
      options: ['unit', 'box', 'ream', 'set', 'pack'] },
    { name: 'est_cost',      label: 'Estimated Cost (USD)', type: 'number', min: 0 },
    { name: 'purpose',       label: 'Purpose', type: 'textarea', required: true },
    { name: 'expected_date', label: 'Expected Date', type: 'date' },
    { name: 'remark',        label: 'Remark', type: 'textarea' },
  ],

  // ---- Material: Use Stock ----
  use_stock: [
    { name: 'stock_item_id', label: 'Item (from stock)', type: 'stock_select', required: true },
    { name: 'quantity',      label: 'Quantity', type: 'number', required: true, min: 1 },
    { name: 'purpose',       label: 'Purpose', type: 'textarea', required: true },
    { name: 'expected_return_date', label: 'Expected Return Date', type: 'date',
      hint: 'Required only for returnable items.' },
    { name: 'remark',        label: 'Remark', type: 'textarea' },
  ],

  // ---- Material: Grab Ride (the exception morph) ----
  grab_ride: [
    { name: 'pickup',        label: 'Pickup Location',  type: 'text', required: true },
    { name: 'dropoff',       label: 'Drop-off Location', type: 'text', required: true },
    { name: 'cost_center_id', label: 'Cost Center', type: 'cost_center_select', required: true },
    { name: 'trip_date',     label: 'Trip Date', type: 'date', required: true },
    { name: 'purpose',       label: 'Purpose of Trip', type: 'textarea', required: true },
  ],
}

// A short human title used for the list view / reference.
export function deriveTitle(category, details) {
  switch (category) {
    case 'grab_ride':  return `Grab: ${details.pickup ?? ''} → ${details.dropoff ?? ''}`
    case 'buy':        return `Buy: ${details.item_name ?? ''}`
    case 'use_stock':  return `Use Stock: ${details.item_name ?? details.stock_item_id ?? ''}`
    case 'sick_leave': return 'Sick Leave'
    case 'annual_leave': return 'Annual Leave'
    case 'meeting_room': return `Meeting Room: ${details.room ?? ''}`
    case 'it_support': return `IT Support: ${details.issue_type ?? ''}`
    default:           return details.subject ?? 'General Request'
  }
}
