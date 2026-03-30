import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useSettingsStore } from '@/store/settingsStore'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import Spinner from '@/components/ui/Spinner'

// ─── Lazy-loaded pages (code splitting) ──────────────────────────────────────
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const SignupPage = lazy(() => import('@/features/auth/pages/SignupPage'))
const ForgotPassword = lazy(() => import('@/features/auth/pages/ForgotPasswordPage'))
const ResetPassword = lazy(() => import('@/features/auth/pages/ResetPasswordPage'))

const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'))
const EmployeesPage = lazy(() => import('@/features/employees/pages/EmployeesPage'))
const EmployeeDetail = lazy(() => import('@/features/employees/pages/EmployeeDetailPage'))
const EmployeeForm = lazy(() => import('@/features/employees/pages/EmployeeFormPage'))
const TimesheetEntry = lazy(() => import('@/features/timesheets/pages/TimesheetEntryPage'))
const TimesheetHistory = lazy(() => import('@/features/timesheets/pages/TimesheetHistoryPage'))
const AdminTimesheets = lazy(() => import('@/features/timesheets/pages/AdminTimesheetPage'))
const AdminTimesheetsCompliance = lazy(() => import('@/features/timesheets/pages/AdminTimesheetCompliancePage'))
const ProjectsPage = lazy(() => import('@/features/projects/pages/ProjectsPage'))
const TasksPage = lazy(() => import('@/features/tasks/pages/TasksPage'))
const LeavePage = lazy(() => import('@/features/leaves/pages/LeavePage'))
const AnnouncementsPage = lazy(() => import('@/features/announcements/pages/AnnouncementsPage'))
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage'))
const ProfilePage = lazy(() => import('@/features/employees/pages/ProfilePage'))
const SettingsLayout = lazy(() => import('@/features/settings/pages/SettingsLayout'))
const CalendarPage = lazy(() => import('@/features/calendar/pages/CalendarPage'))
const AdminCalendarPage = lazy(() => import('@/features/calendar/pages/AdminCalendarPage'))
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'))
const Paywall = lazy(() => import('@/components/ui/Paywall'))
const IncidentList = lazy(() => import('@/pages/incidents/IncidentList'))
const IncidentDetails = lazy(() => import('@/pages/incidents/IncidentDetails'))
const LandingPage = lazy(() => import('@/pages/LandingPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const AuditLogPage = lazy(() => import('@/features/audit/pages/AuditLogPage'))


// --- Payroll Pages ---
const PayrollDashboard = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayrollDashboard })))
const EmployeePayrollProfiles = lazy(() => import('@/features/payroll').then(m => ({ default: m.EmployeePayrollProfiles })))
const SalaryStructures = lazy(() => import('@/features/payroll').then(m => ({ default: m.SalaryStructures })))
const PayrollProcessing = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayrollProcessing })))
const PayslipGeneration = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayslipGeneration })))
const TaxesDeductions = lazy(() => import('@/features/payroll').then(m => ({ default: m.TaxesDeductions })))
const PayrollReports = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayrollReports })))
const BankTransferExport = lazy(() => import('@/features/payroll').then(m => ({ default: m.BankTransferExport })))
const HourManagement = lazy(() => import('@/features/payroll').then(m => ({ default: m.HourManagement })))
const PolicySettings = lazy(() => import('@/features/payroll').then(m => ({ default: m.PolicySettings })))
const RunPayroll = lazy(() => import('@/features/payroll').then(m => ({ default: m.RunPayroll })))
const PayrollHistory = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayrollHistory })))
const MyPayslips = lazy(() => import('@/features/payroll').then(m => ({ default: m.MyPayslips })))

import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { FEATURE_KEYS } from '@/constants/plans'

// ─── Protected Route Guard ───────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles, featureKey }) => {
    const { isAuthenticated, isHydrating, user, subscription } = useAuthStore()

    // Wait for checkAuth to finish before making any redirect decisions.
    // Without this guard, the app redirects before the token is validated on refresh.
    if (isHydrating) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />

    // Trial Expiration Check (Skip for Super Admin)
    if (user?.role !== 'super_admin' && subscription?.status === 'EXPIRED') {
        return <Paywall />
    }

    const { hasAccess } = useFeatureAccess()

    if (user?.role === 'super_admin') return children
    
    // Subscription Feature Guard
    if (featureKey && !hasAccess(featureKey)) {
        return <Navigate to="/dashboard" replace />
    }

    if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />
    return children
}

// ─── Page Suspense Wrapper ───────────────────────────────────────────────────
const PageSuspense = ({ children }) => (
    <Suspense fallback={
        <div className="flex items-center justify-center h-full min-h-[400px]">
            <Spinner size="lg" />
        </div>
    }>
        {children}
    </Suspense>
)

import { useThemeStore } from '@/store/themeStore'

export default function App() {
    const { checkAuth, isAuthenticated, isHydrating: authHydrating, user } = useAuthStore()
    const { fetchGeneralSettings, general, isLoading: settingsLoading } = useSettingsStore()
    const { sidebarOpen } = useUIStore()
    const syncFromBranding = useThemeStore(s => s.syncFromBranding)

    useEffect(() => {
        const init = async () => {
            // First check auth
            await checkAuth()
            // Then fetch settings if we are authenticated
            if (useAuthStore.getState().isAuthenticated) {
                await fetchGeneralSettings()
                const branding = useSettingsStore.getState().general?.branding
                if (branding) {
                    syncFromBranding(branding)
                }
            }
        }
        init()
    }, [checkAuth, fetchGeneralSettings, syncFromBranding])


    // Block ALL route rendering until auth check AND settings fetch have settled.
    // This prevents components from mounting with null settings (and thus wrong defaults).
    const isAppHydrating = authHydrating || (isAuthenticated && !general && settingsLoading)

    if (isAppHydrating) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-950">
                <Spinner size="lg" />
            </div>
        )
    }

    return (
        <PageSuspense>
            <Routes>
                {/* Public Landing Page / Redirect for Authed */}
                <Route path="/" element={
                    isAuthenticated
                        ? (user?.role === 'super_admin' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />)
                        : <PageSuspense><LandingPage /></PageSuspense>
                } />

                {/* Auth routes */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                </Route>


                {/* App routes */}
                <Route element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }>
                    <Route index element={user?.role === 'super_admin' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />} />
                    <Route path="/" element={user?.role === 'super_admin' ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<PageSuspense><DashboardPage /></PageSuspense>} />
                    <Route path="/profile" element={<PageSuspense><ProfilePage /></PageSuspense>} />
                    <Route path="/timesheets" element={<PageSuspense><TimesheetEntry /></PageSuspense>} />
                    <Route path="/timesheets/history" element={<PageSuspense><TimesheetHistory /></PageSuspense>} />
                    <Route path="/leaves" element={
                        <ProtectedRoute featureKey={FEATURE_KEYS.LEAVE_MANAGEMENT}>
                            <PageSuspense><LeavePage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/calendar" element={<PageSuspense><CalendarPage /></PageSuspense>} />
                    <Route path="/announcements" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><AnnouncementsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/incidents" element={
                        <ProtectedRoute featureKey={FEATURE_KEYS.SUPPORT}>
                            <PageSuspense><IncidentList /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/my-payslips" element={
                        <ProtectedRoute featureKey={FEATURE_KEYS.PAYSLIPS}>
                            <PageSuspense><MyPayslips /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/incidents/:id" element={
                        <ProtectedRoute featureKey={FEATURE_KEYS.SUPPORT}>
                            <PageSuspense><IncidentDetails /></PageSuspense>
                        </ProtectedRoute>
                    } />

                    {/* Manager + Admin */}
                    <Route path="/timesheets/manage" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><AdminTimesheets isAdminView={true} /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/timesheets/compliance" element={
                        <ProtectedRoute roles={['admin', 'manager']} featureKey={FEATURE_KEYS.AUDIT_LOGS}>
                            <PageSuspense><AdminTimesheetsCompliance /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/leaves/manage" element={
                        <ProtectedRoute roles={['admin', 'manager']} featureKey={FEATURE_KEYS.LEAVE_MANAGEMENT}>
                            <PageSuspense><LeavePage isAdminView={true} /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/projects" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><ProjectsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />

                    {/* Admin only */}
                    <Route path="/calendar/manage" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><AdminCalendarPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/employees" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><EmployeesPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/tasks" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><TasksPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/employees/new" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><EmployeeForm /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/employees/:id" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><EmployeeDetail /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/reports" element={
                        <ProtectedRoute roles={['admin', 'manager']} featureKey={FEATURE_KEYS.REPORTS}>
                            <PageSuspense><ReportsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><SettingsLayout /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/audit-logs" element={
                        <ProtectedRoute roles={['admin', 'manager']} featureKey={FEATURE_KEYS.AUDIT_LOGS}>
                            <PageSuspense><AuditLogPage /></PageSuspense>
                        </ProtectedRoute>
                    } />


                    {/* Payroll Module */}
                    <Route path="/payroll/*" element={
                        <ProtectedRoute roles={['admin', 'manager', 'finance', 'hr', 'employee']} featureKey={FEATURE_KEYS.PAYROLL}>
                            <Routes>
                                <Route path="dashboard" element={<PageSuspense><PayrollDashboard /></PageSuspense>} />
                                <Route path="profiles" element={<PageSuspense><EmployeePayrollProfiles /></PageSuspense>} />
                                <Route path="salary-structures" element={<PageSuspense><SalaryStructures /></PageSuspense>} />
                                <Route path="processing" element={<PageSuspense><PayrollProcessing /></PageSuspense>} />
                                <Route path="payslip" element={<PageSuspense><PayslipGeneration /></PageSuspense>} />
                                <Route path="taxes" element={<PageSuspense><TaxesDeductions /></PageSuspense>} />
                                <Route path="reports" element={<PageSuspense><PayrollReports /></PageSuspense>} />
                                <Route path="export" element={<PageSuspense><BankTransferExport /></PageSuspense>} />
                                <Route path="hour-management" element={<PageSuspense><HourManagement /></PageSuspense>} />
                                <Route path="policy" element={<PageSuspense><PolicySettings /></PageSuspense>} />
                                <Route path="run" element={<PageSuspense><RunPayroll /></PageSuspense>} />
                                <Route path="history" element={<PageSuspense><PayrollHistory /></PageSuspense>} />
                            </Routes>
                        </ProtectedRoute>
                    } />

                    {/* Super Admin only */}
                    <Route path="/admin/dashboard" element={
                        <ProtectedRoute roles={['super_admin']}>
                            <PageSuspense><AdminDashboard /></PageSuspense>
                        </ProtectedRoute>
                    } />
                </Route>

                <Route path="*" element={<PageSuspense><NotFoundPage /></PageSuspense>} />
            </Routes>
        </PageSuspense>
    )
}
