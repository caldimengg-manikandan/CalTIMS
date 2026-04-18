import React from 'react'
import { clsx } from 'clsx'

const statusMap = {
    // Timesheet/Leave states
    draft:          { cls: 'badge-gray',    label: 'Draft' },
    submitted:      { cls: 'badge-warning', label: 'Submitted' },
    approved:       { cls: 'badge-success', label: 'Approved' },
    rejected:       { cls: 'badge-danger',  label: 'Rejected' },
    pending:        { cls: 'badge-warning', label: 'Pending' },
    cancelled:      { cls: 'badge-gray',    label: 'Cancelled' },
    withdrawn:      { cls: 'badge-gray',    label: 'Withdrawn' },
    frozen:         { cls: 'badge-danger',  label: '⛔ Frozen' },
    admin_filled:   { cls: 'badge-indigo',  label: 'Admin Filled' },
    // Project/Task states
    active:         { cls: 'badge-info',    label: 'Active' },
    'on-hold':      { cls: 'badge-warning', label: 'On Hold' },
    'in-progress':  { cls: 'badge-info',    label: 'In Progress' },
    completed:      { cls: 'badge-success', label: 'Completed' },
    // Priority
    low:            { cls: 'badge-gray',    label: 'Low' },
    medium:         { cls: 'badge-info',    label: 'Medium' },
    high:           { cls: 'badge-warning', label: 'High' },
    urgent:         { cls: 'badge-danger',  label: 'Urgent' },
    // Leave types
    annual:         { cls: 'badge-info',    label: 'Annual' },
    sick:           { cls: 'badge-warning', label: 'Sick' },
    casual:         { cls: 'badge-success', label: 'Casual' },
    unpaid:         { cls: 'badge-gray',    label: 'Unpaid' },
    // Support
    open:           { cls: 'badge-danger',  label: 'Open' },
    resolved:       { cls: 'badge-success', label: 'Resolved' },
    closed:         { cls: 'badge-gray',    label: 'Closed' },
    // Payroll-specific
    processed:      { cls: 'badge-success', label: 'Processed' },
    paid:           { cls: 'badge-indigo',  label: 'Paid' },
    finalized:      { cls: 'badge-indigo',  label: 'Finalized' },
    failed:         { cls: 'badge-danger',  label: 'Failed' },
    running:        { cls: 'badge-info',    label: 'Running' },
    scheduled:      { cls: 'badge-purple',  label: 'Scheduled' },
    'partially-paid': { cls: 'badge-warning', label: 'Partial' },
    // Employee status
    inactive:       { cls: 'badge-gray',    label: 'Inactive' },
    terminated:     { cls: 'badge-danger',  label: 'Terminated' },
    'on-leave':     { cls: 'badge-warning', label: 'On Leave' },
}

export default function StatusBadge({ status, className, showDot = true, overrideLabel }) {
    const key = status?.toLowerCase?.()?.replace(/\s+/g, '-') || ''
    const entry = statusMap[key] || { cls: 'badge-gray', label: status || 'Unknown' }

    return (
        <span
            className={clsx(
                'badge',
                entry.cls,
                !showDot && 'badge-nodot',
                className
            )}
        >
            {overrideLabel || entry.label}
        </span>
    )
}

/**
 * PayrollStatusBadge — specialized badge for payroll batch status
 * with more prominent styling
 */
export function PayrollStatusBadge({ status, className }) {
    const config = {
        processed: { bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Processed' },
        paid:       { bg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',   label: 'Paid' },
        finalized:  { bg: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',   label: 'Finalized' },
        failed:     { bg: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',               label: 'Failed' },
        running:    { bg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',           label: 'Running' },
        draft:      { bg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',         label: 'Draft' },
    }
    const key = status?.toLowerCase?.() || ''
    const { bg, label } = config[key] || { bg: 'bg-slate-100 text-slate-600', label: status }

    return (
        <span className={clsx('badge badge-nodot font-semibold', bg, className)}>
            {label}
        </span>
    )
}
