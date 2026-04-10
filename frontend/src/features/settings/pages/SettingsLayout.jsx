import React, { useState } from 'react'
import {
    Briefcase, Building2, ShieldCheck, PaintRoller,
    Clock, Mail, Workflow, FileLock, Users, History, Banknote, FileText,
    Crown, HelpCircle
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
import PermissionAuditLogsTab from '../tabs/PermissionAuditLogsTab'
import PayrollPolicyTab from '../tabs/PayrollPolicyTab'
import PayslipTemplatesTab from '../tabs/PayslipTemplatesTab'
import OnboardingTab from '../tabs/OnboardingTab'
import ConfigurationCenterTab from '../tabs/ConfigurationCenterTab'
import { PolicySettings } from '../../payroll/pages/PolicySettings'
import SubscriptionPage from '../../subscriptions/pages/SubscriptionPage'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'

const NAVIGATION_SECTIONS = [
    {
        title: 'Organization',
        items: [
            { id: 'organization', label: 'General & Organization', icon: Building2 },
            { id: 'branding', label: 'Branding & Theme', icon: PaintRoller },
            { id: 'subscription', label: 'Plan & Subscription', icon: Crown },
        ]
    },
    {
        title: 'Access & Control',
        items: [
            { id: 'roles', label: 'Users & Roles', icon: ShieldCheck },
            { id: 'permission_audit', label: 'Permission History', icon: History },
        ]
    },
    {
        title: 'Policies',
        items: [
    
            { id: 'timesheet_policy', label: 'Timesheet Policy', icon: Clock },
            { id: 'leave_policy', label: 'Leave Policy', icon: Briefcase },
            // { id: 'payroll_policy', label: 'Payroll Policy', icon: Banknote },
            // { id: 'payslip_templates', label: 'Payslip Templates', icon: FileText },
            { id: 'compliance', label: 'Compliance & Locks', icon: FileLock },
        ]
    },
    {
        title: 'System',
        items: [
            { id: 'reports', label: 'Reports & Automation', icon: Mail },
            { id: 'notifications', label: 'Notifications', icon: Users },
            { id: 'integrations', label: 'Integrations', icon: Workflow },
        ]
    },
    // {
    //     title: 'Help & Support',
    //     items: [
    //         { id: 'onboarding', label: 'Onboarding Tour', icon: HelpCircle },
    //     ]
    // }
]

export default function SettingsLayout() {
    const [activeTab, setActiveTab] = useState('organization')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchParams] = useSearchParams()

    React.useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab) {
            setActiveTab(tab)
        }
    }, [searchParams])

    const renderContent = () => {
        switch (activeTab) {
            case 'organization': return <OrganizationTab />
            case 'core_policy': return <PolicySettings />
            case 'timesheet_policy': return <TimesheetPolicyTab />
            case 'reports': return <ReportsAutomationTab />
            case 'branding': return <BrandingTab />
            case 'roles':
            case 'rbac': return <UsersAndRolesTab />
            case 'permission_audit': return <PermissionAuditLogsTab />
            case 'audit': return <AuditLogsTab />
            case 'leave_policy': return <LeavePolicyTab />
            case 'compliance': return <ComplianceLocksTab />
            case 'notifications': return <NotificationsTab />
            case 'integrations': return <IntegrationsTab />
            case 'payroll_policy': return <PayrollPolicyTab />
            case 'payslip_templates': return <PayslipTemplatesTab />
            case 'subscription': return <SubscriptionPage />
            case 'onboarding': return <OnboardingTab />
            default: return <OrganizationTab />
        }
    }

    const filteredSections = NAVIGATION_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(item => 
            item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            section.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(section => section.items.length > 0)

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <PageHeader title="Enterprise Settings" subtitle="Configure system-wide preferences, policies, and integrations." />

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Vertical Sidebar */}
                <div className="w-full lg:w-72 flex-shrink-0 flex flex-col lg:sticky lg:top-6 lg:h-[calc(100vh-180px)]">
                    {/* Sidebar Search */}
                    <div className="relative group px-1 mb-8">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                            <Search size={14} className="text-slate-400 group-focus-within:text-primary transition-colors" />
                        </div>
                        <input 
                            type="search" 
                            name="settings-search-bar"
                            autoComplete="off"
                            className="w-full bg-slate-100 dark:bg-white/5 border-none focus:ring-2 focus:ring-primary/20 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-slate-700 dark:text-slate-200 placeholder:text-slate-400 transition-all shadow-inner"
                            placeholder="Find a setting..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className="space-y-7 lg:overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
                        {filteredSections.map((section, idx) => (
                            <div key={idx} className="animate-in fade-in slide-in-from-left-2 duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 px-4 flex items-center justify-between">
                                    {section.title}
                                    <div className="h-px flex-1 bg-slate-100 dark:bg-white/5 ml-4 opacity-50" />
                                </h4>
                                <nav className="space-y-1.5 px-1">
                                    {section.items.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveTab(item.id)}
                                            className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${activeTab === item.id
                                                ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-1'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-white/5 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`p-1.5 rounded-lg transition-transform group-hover:scale-110 ${activeTab === item.id ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/5'}`}>
                                                <item.icon size={16} className={activeTab === item.id ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                                            </div>
                                            {item.label}
                                            {activeTab === item.id && (
                                                <motion.div 
                                                    layoutId="sidebar-active-indicator"
                                                    className="absolute -left-1 w-1 h-6 bg-primary rounded-full"
                                                />
                                            )}
                                        </button>
                                    ))}
                                </nav>
                            </div>
                        ))}

                        {filteredSections.length === 0 && (
                            <div className="text-center py-10 px-4">
                                <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                    <Search size={20} className="text-slate-300" />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">No results found</p>
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="text-[10px] font-black text-primary uppercase mt-2 hover:underline"
                                >
                                    Clear search
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 lg:h-[calc(100vh-180px)] lg:overflow-y-auto pr-2 custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-8 shadow-sm"
                        >
                            {renderContent()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
