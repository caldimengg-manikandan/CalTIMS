import React from 'react'
import { clsx } from 'clsx'

const statusMap = {
    draft: 'badge-gray',
    submitted: 'badge-warning',
    approved: 'badge-success',
    rejected: 'badge-danger',
    pending: 'badge-warning',
    cancelled: 'badge-gray',
    active: 'badge-success',
    'on-hold': 'badge-warning',
    'in-progress': 'badge-info',
    completed: 'badge-success',
    low: 'badge-gray',
    medium: 'badge-info',
    high: 'badge-warning',
    urgent: 'badge-danger',
    annual: 'badge-info',
    sick: 'badge-warning',
    casual: 'badge-success',
    unpaid: 'badge-gray',
}

export default function StatusBadge({ status, className }) {
    const cls = statusMap[status?.toLowerCase()] || 'badge-gray'
    return (
        <span className={clsx('badge', cls, className)}>
            {status}
        </span>
    )
}
