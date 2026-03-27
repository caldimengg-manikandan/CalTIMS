import React from 'react'
import { clsx } from 'clsx'

const ROUTE_LABELS = {
    // Core
    dashboard: 'Dashboard',
    profile: 'Account Settings',
    // Timesheets
    timesheets: 'Timesheets',
    history: 'History',
    manage: 'Manage',
    compliance: 'Compliance & Locks',
    // People
    employees: 'Employees',
    leaves: 'Leave Tracker',
    announcements: 'Announcements',
    incidents: 'Help & Support',
    // Work
    projects: 'Projects',
    tasks: 'Tasks',
    calendar: 'Calendar',
    // Payroll (full sub-route map)
    payroll: 'Payroll',
    profiles: 'Payroll Profiles',
    'salary-structures': 'Salary Structures',
    run: 'Payroll Engine',
    payslip: 'Payslip Generation',
    taxes: 'Taxes & Deductions',
    reports: 'Reports',
    export: 'Bank Export',
    'hour-management': 'Hour Management',
    'my-payslips': 'My Payslips',
    // System
    settings: 'Settings',
    'audit-logs': 'Audit Logs',
    // Generic
    new: 'New',
    edit: 'Edit',
}

export default function PageHeader({ title, subtitle, children, className = '', noBorder = false }) {
    return (
        <div className={clsx('animate-fade-in mb-6', className)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Title */}
                <div className="min-w-0">
                    <h1 className="page-title truncate">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="page-subtitle mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Actions */}
                {children && (
                    <div className="flex items-center gap-2.5 flex-shrink-0 flex-wrap">
                        {children}
                    </div>
                )}
            </div>

            {!noBorder && (
                <div className="h-px bg-slate-100 dark:bg-slate-800 w-full mt-5" />
            )}
        </div>
    )
}

/* Export the route labels so Navbar can consume them too */
export { ROUTE_LABELS }
