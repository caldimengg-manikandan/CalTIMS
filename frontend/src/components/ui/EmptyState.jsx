import React from 'react'
import { clsx } from 'clsx'

/**
 * EmptyState — consistent empty/no-data UI across the app.
 *
 * Usage:
 *   <EmptyState
 *     icon={<FileText size={24} />}
 *     title="No payroll runs yet"
 *     description="Run your first payroll to see records here."
 *     action={{ label: 'Run Payroll', onClick: () => navigate('/payroll/run') }}
 *   />
 */
export default function EmptyState({
    icon,
    title = 'Nothing here yet',
    description,
    action,
    secondaryAction,
    className = '',
    compact = false,
}) {
    return (
        <div className={clsx('empty-state', compact && 'py-8', className)}>
            {icon && (
                <div className="empty-state-icon">
                    {icon}
                </div>
            )}

            <h3 className="empty-state-title">{title}</h3>

            {description && (
                <p className="empty-state-desc">
                    {description}
                </p>
            )}

            {(action || secondaryAction) && (
                <div className="flex items-center gap-3 flex-wrap justify-center mt-1">
                    {action && (
                        <button
                            onClick={action.onClick}
                            className="btn btn-primary btn-sm"
                        >
                            {action.icon}
                            {action.label}
                        </button>
                    )}
                    {secondaryAction && (
                        <button
                            onClick={secondaryAction.onClick}
                            className="btn btn-secondary btn-sm"
                        >
                            {secondaryAction.icon}
                            {secondaryAction.label}
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}

/** Inline empty — for use inside a card or table cell */
export function InlineEmpty({ message = 'No data available', icon, className = '' }) {
    return (
        <div className={clsx('flex items-center gap-2 py-6 justify-center text-slate-400', className)}>
            {icon && <span className="opacity-50">{icon}</span>}
            <span className="text-sm text-slate-400">{message}</span>
        </div>
    )
}

/** Error state variant */
export function ErrorState({ title = 'Something went wrong', description, onRetry, className = '' }) {
    return (
        <div className={clsx('empty-state', className)}>
            <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
            </div>
            <h3 className="empty-state-title text-slate-700 dark:text-slate-300">{title}</h3>
            {description && <p className="empty-state-desc">{description}</p>}
            {onRetry && (
                <button onClick={onRetry} className="btn btn-secondary btn-sm mt-1">
                    Try again
                </button>
            )}
        </div>
    )
}
