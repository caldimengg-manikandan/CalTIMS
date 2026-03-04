import { useLocation } from 'react-router-dom'

const ROUTE_LABELS = {
    'dashboard': 'Dashboard',
    'profile': 'Account Settings',
    'timesheets': 'Timesheet Entry',
    'history': 'History',
    'manage': 'Manage Timesheets',
    'leaves': 'Leave Tracker',
    'calendar': 'Calendar',
    'announcements': 'Announcements',
    'projects': 'Projects',
    'tasks': 'Tasks',
    'employees': 'Employees',
    'reports': 'Reports',
    'settings': 'Settings',
    'new': 'New',
    'edit': 'Edit'
}

export default function PageHeader({ title, subtitle, children }) {
    const location = useLocation()
    const pathnames = location.pathname.split('/').filter(x => x)

    // Helper to get label from path part
    const getLabel = (part) => {
        if (/^[0-9a-fA-F]{24}$/.test(part)) return 'Details'
        return ROUTE_LABELS[part] || part.charAt(0).toUpperCase() + part.slice(1)
    }

    if (pathnames.length === 0) {
        return null
    }

    return (
        <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                {/* Title Section */}
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight leading-none px-0.5">
                        {title || getLabel(pathnames[pathnames.length - 1])}
                    </h1>
                    {subtitle && (
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium pl-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* Action Section */}
                {children && (
                    <div className="flex items-center gap-3">
                        {children}
                    </div>
                )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-white/5 w-full mt-4" />
        </div>
    )
}
