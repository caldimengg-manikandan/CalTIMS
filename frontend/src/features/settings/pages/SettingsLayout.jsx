import React, { useState } from 'react'
import {
    Briefcase, Building2, ShieldCheck, PaintRoller,
    Clock, Mail, Workflow, FileLock, Users, LayoutDashboard, History
} from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import OrganizationTab from '../tabs/OrganizationTab'
import TimesheetPolicyTab from '../tabs/TimesheetPolicyTab'
import ReportsAutomationTab from '../tabs/ReportsAutomationTab'
import BrandingTab from '../tabs/BrandingTab'
import IntegrationsTab from '../tabs/IntegrationsTab'
import LeavePolicyTab from '../tabs/LeavePolicyTab'
import ComplianceLocksTab from '../tabs/ComplianceLocksTab'
import NotificationsTab from '../tabs/NotificationsTab'
import UsersAndRolesTab from '../tabs/UsersAndRolesTab'
import AuditLogsTab from '../tabs/AuditLogsTab'

const NAVIGATION_SECTIONS = [
    {
        title: 'Organization',
        items: [
            { id: 'organization', label: 'General & Organization', icon: Building2 },
            { id: 'branding', label: 'Branding & Theme', icon: PaintRoller },
        ]
    },
    {
        title: 'Access & Control',
        items: [
            { id: 'roles', label: 'Users & Roles', icon: ShieldCheck },
            { id: 'audit', label: 'Audit Logs', icon: History },
        ]
    },
    {
        title: 'Policies',
        items: [
            { id: 'timesheet_policy', label: 'Timesheet Policy', icon: Clock },
            { id: 'leave_policy', label: 'Leave Policy', icon: Briefcase },
            { id: 'compliance', label: 'Compliance & Locks', icon: FileLock },
        ]
    },
    {
        title: 'System',
        items: [
            { id: 'reports', label: 'Reports & Automation', icon: Mail },
            { id: 'notifications', label: 'Notifications', icon: Users }, // Replace icon later
            { id: 'integrations', label: 'Integrations', icon: Workflow },
        ]
    }
]

export default function SettingsLayout() {
    const [activeTab, setActiveTab] = useState('organization')

    const renderContent = () => {
        switch (activeTab) {
            case 'organization': return <OrganizationTab />
            case 'timesheet_policy': return <TimesheetPolicyTab />
            case 'reports': return <ReportsAutomationTab />
            case 'branding': return <BrandingTab />
            case 'roles': return <UsersAndRolesTab />
            case 'audit': return <AuditLogsTab />
            case 'leave_policy': return <LeavePolicyTab />
            case 'compliance': return <ComplianceLocksTab />
            case 'notifications': return <NotificationsTab />
            case 'integrations': return <IntegrationsTab />
            default: return <OrganizationTab />
        }
    }

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <PageHeader title="Enterprise Settings" subtitle="Configure system-wide preferences, policies, and integrations." />

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Vertical Sidebar */}
                <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
                    {NAVIGATION_SECTIONS.map((section, idx) => (
                        <div key={idx}>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
                                {section.title}
                            </h4>
                            <nav className="space-y-1">
                                {section.items.map((item) => (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveTab(item.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === item.id
                                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                                            }`}
                                    >
                                        <item.icon size={16} className={activeTab === item.id ? 'opacity-100' : 'opacity-60'} />
                                        {item.label}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0">
                    <div className="bg-slate-50/50 dark:bg-slate-900/10 rounded-2xl p-1 pb-4">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}
