import React, { Suspense, lazy, useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
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
const OnboardingPage = lazy(() => import('@/features/auth/pages/OnboardingPage'))
const OAuthSuccessPage = lazy(() => import('@/features/auth/pages/OAuthSuccessPage'))

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
const PayrollExecution = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayrollExecution })))
const MyPayslips = lazy(() => import('@/features/payroll').then(m => ({ default: m.MyPayslips })))
const PayrollSetupWizard = lazy(() => import('@/features/payroll').then(m => ({ default: m.PayrollSetupWizard })))

import { useFeatureAccess } from '@/hooks/useFeatureAccess'
import { FEATURE_KEYS } from '@/constants/plans'
import { useThemeStore } from '@/store/themeStore'
import ToastLimit from '@/components/ui/ToastLimit'
import { hasPermission } from '@/utils/rbac'

// ─── Protected Route Guard ───────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles, permission, featureKey }) => {
    const { isAuthenticated, isHydrating, user, subscription } = useAuthStore()
    const location = useLocation()
    const { hasAccess } = useFeatureAccess()

    // Wait for checkAuth to finish before making any redirect decisions.
    if (isHydrating) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Spinner size="lg" />
            </div>
        )
    }

    if (!isAuthenticated) return <Navigate to="/login" replace />
    if (!user && !isHydrating) return <Navigate to="/login" replace />

    // Onboarding Guard
    const isOnboardingPath = location.pathname === '/onboarding'
    const needsOnboarding = user && !user.isOnboardingComplete && user.role !== 'super_admin'

    if (needsOnboarding && !isOnboardingPath) {
        return <Navigate to="/onboarding" replace />
    }

    if (user?.isOnboardingComplete && isOnboardingPath) {
        return <Navigate to="/dashboard" replace />
    }

    // Trial Expiration Check
    if (user?.role !== 'super_admin' && subscription?.status === 'EXPIRED') {
        return <Paywall />
    }

    if (user?.role === 'super_admin') return children
    
    // 1. Subscription Feature Guard (Plan-level)
    if (featureKey && !hasAccess(featureKey)) {
        return <Navigate to="/dashboard" replace />
    }

    // 2. Dynamic Permission Guard (DB-level)
    if (permission) {
        const { module, submodule, action } = permission
        if (!hasPermission(user, module, submodule, action)) {
            return <Navigate to="/dashboard" replace />
        }
        return children
    }

    // 3. Legacy Role Guard (Fallback)
    if (roles) {
        const userRoleLower = user?.role?.toLowerCase()
        const isAdminOrOwner = ['admin', 'owner'].includes(userRoleLower)
        if (!roles.includes(user?.role) && !isAdminOrOwner) {
            return <Navigate to="/dashboard" replace />
        }
    }

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

export default function App() {
    // Use selective subscriptions for better performance and to prevent re-renders on every state change
    const checkAuth = useAuthStore(s => s.checkAuth)
    const isAuthenticated = useAuthStore(s => s.isAuthenticated)
    const authHydrating = useAuthStore(s => s.isHydrating)
    const user = useAuthStore(s => s.user)

    const fetchGeneralSettings = useSettingsStore(s => s.fetchGeneralSettings)
    const general = useSettingsStore(s => s.general)
    const settingsLoading = useSettingsStore(s => s.isLoading)

    const { sidebarOpen } = useUIStore()
    const syncFromBranding = useThemeStore(s => s.syncFromBranding)

    useEffect(() => {
        const init = async () => {
            // 1. Check if we have tokens in the URL (OAuth Callback Case)
            const params = new URLSearchParams(window.location.search)
            const urlToken = params.get('token')
            const urlRefreshToken = params.get('refreshToken')

            if (urlToken && urlRefreshToken) {
                // If found, update store and CLEAN the URL
                await useAuthStore.getState().setAuthFromURL(urlToken, urlRefreshToken)
                
                // Clean URL parameters for security and cleaner UI
                const newUrl = window.location.pathname
                window.history.replaceState({}, document.title, newUrl)
            } else {
                // Regular Initialization: First check auth from persistence
                await checkAuth()
            }

            // 2. Then fetch settings if we are authenticated
            // We check getState() here to get the LATEST value after checkAuth finished
            if (useAuthStore.getState().isAuthenticated) {
                await fetchGeneralSettings()
                const branding = useSettingsStore.getState().general?.branding
                if (branding) {
                    syncFromBranding(branding)
                }
            }
        }

        // Only run init once on mount. checkAuth and fetchSettings are stable.
        init()
    }, [checkAuth, fetchGeneralSettings, syncFromBranding])

    useEffect(() => {
        setTimeout(() => {
            const el =
                document.querySelector(".react-hot-toast-container") ||
                document.querySelector("[role='status']");

            console.log(
                el ? "✅ TOASTER MOUNTED" : "❌ TOASTER NOT FOUND"
            );
        }, 2000);
    }, []);


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
            <ToastLimit limit={1} />
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
                    <Route path="/oauth-success" element={<OAuthSuccessPage />} />
                </Route>

                {/* Onboarding route (Standalone, no layout) */}
                <Route path="/onboarding" element={
                    <ProtectedRoute>
                        <OnboardingPage />
                    </ProtectedRoute>
                } />


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
                        <ProtectedRoute permission={{ module: 'Announcements', submodule: 'Announcements', action: 'view' }}>
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
                        <ProtectedRoute permission={{ module: 'Timesheets', submodule: 'Management', action: 'view' }}>
                            <PageSuspense><AdminTimesheets isAdminView={true} /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/timesheets/compliance" element={
                        <ProtectedRoute permission={{ module: 'Settings', submodule: 'Audit Logs', action: 'view' }} featureKey={FEATURE_KEYS.AUDIT_LOGS}>
                            <PageSuspense><AdminTimesheetsCompliance /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/leaves/manage" element={
                        <ProtectedRoute permission={{ module: 'Leave Management', submodule: 'Leave Requests', action: 'view' }} featureKey={FEATURE_KEYS.LEAVE_MANAGEMENT}>
                            <PageSuspense><LeavePage isAdminView={true} /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/projects" element={
                        <ProtectedRoute permission={{ module: 'Projects', submodule: 'Project List', action: 'view' }}>
                            <PageSuspense><ProjectsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />

                    {/* Admin only */}
                    <Route path="/calendar/manage" element={
                        <ProtectedRoute permission={{ module: 'Settings', submodule: 'General', action: 'edit' }}>
                            <PageSuspense><AdminCalendarPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/employees" element={
                        <ProtectedRoute permission={{ module: 'Employees', submodule: 'Employee List', action: 'view' }}>
                            <PageSuspense><EmployeesPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/tasks" element={
                        <ProtectedRoute permission={{ module: 'Tasks', submodule: 'Task Management', action: 'view' }}>
                            <PageSuspense><TasksPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/employees/new" element={
                        <ProtectedRoute permission={{ module: 'Employees', submodule: 'Management', action: 'edit' }}>
                            <PageSuspense><EmployeeForm /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/employees/:id" element={
                        <ProtectedRoute permission={{ module: 'Employees', submodule: 'Employee List', action: 'view' }}>
                            <PageSuspense><EmployeeDetail /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/reports" element={
                        <ProtectedRoute permission={{ module: 'Reports', submodule: 'Reports Dashboard', action: 'view' }} featureKey={FEATURE_KEYS.REPORTS}>
                            <PageSuspense><ReportsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute permission={{ module: 'Settings', submodule: 'Users & Roles', action: 'view' }}>
                            <PageSuspense><SettingsLayout /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/audit-logs" element={
                        <ProtectedRoute permission={{ module: 'Settings', submodule: 'Audit Logs', action: 'view' }} featureKey={FEATURE_KEYS.AUDIT_LOGS}>
                            <PageSuspense><AuditLogPage /></PageSuspense>
                        </ProtectedRoute>
                    } />


                    {/* Payroll Module */}
                    <Route path="/payroll/*" element={
                        <ProtectedRoute permission={{ module: 'Payroll' }} featureKey={FEATURE_KEYS.PAYROLL}>
                            <Routes>
                                <Route path="dashboard" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Dashboard', action: 'view' }}><PageSuspense><PayrollDashboard /></PageSuspense></ProtectedRoute>} />
                                <Route path="profiles" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'view' }}><PageSuspense><EmployeePayrollProfiles /></PageSuspense></ProtectedRoute>} />
                                <Route path="salary-structures" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'view' }}><PageSuspense><SalaryStructures /></PageSuspense></ProtectedRoute>} />
                                <Route path="processing" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'run' }}><PageSuspense><PayrollProcessing /></PageSuspense></ProtectedRoute>} />
                                <Route path="payslip" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payslip Generation', action: 'view' }}><PageSuspense><PayslipGeneration /></PageSuspense></ProtectedRoute>} />
                                <Route path="taxes" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'view' }}><PageSuspense><TaxesDeductions /></PageSuspense></ProtectedRoute>} />
                                <Route path="reports" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Reports', action: 'view' }}><PageSuspense><PayrollReports /></PageSuspense></ProtectedRoute>} />
                                <Route path="export" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Bank Export', action: 'view' }}><PageSuspense><BankTransferExport /></PageSuspense></ProtectedRoute>} />
                                <Route path="hour-management" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Hour Management', action: 'view' }}><PageSuspense><HourManagement /></PageSuspense></ProtectedRoute>} />
                                <Route path="policy" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'edit' }}><PageSuspense><PolicySettings /></PageSuspense></ProtectedRoute>} />
                                <Route path="run" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'run' }}><PageSuspense><RunPayroll /></PageSuspense></ProtectedRoute>} />
                                <Route path="setup" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'run' }}><PageSuspense><PayrollSetupWizard /></PageSuspense></ProtectedRoute>} />
                                <Route path="profile" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'run' }}><PageSuspense><PayrollSetupWizard /></PageSuspense></ProtectedRoute>} />
                                <Route path="profile/:userId" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Payroll Engine', action: 'run' }}><PageSuspense><PayrollSetupWizard /></PageSuspense></ProtectedRoute>} />
                                <Route path="execution/:year/:month" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Execution Ledger', action: 'view' }}><PageSuspense><PayrollExecution /></PageSuspense></ProtectedRoute>} />
                                <Route path="history" element={<ProtectedRoute permission={{ module: 'Payroll', submodule: 'Execution Ledger', action: 'view' }}><PageSuspense><PayrollHistory /></PageSuspense></ProtectedRoute>} />
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

            <Toaster
                position="top-right"
                containerStyle={{ top: 20, right: 20 }}
                gutter={8}
                toastOptions={{
                    duration: 4000,
                    className: "z-[9999]",
                    style: {
                        background: "#1e293b",
                        color: "#f1f5f9",
                        borderRadius: "12px",
                        fontSize: "14px",
                        fontFamily: "Inter, sans-serif",
                    },
                    success: {
                        iconTheme: {
                            primary: "#22c55e",
                            secondary: "#fff",
                        },
                    },
                    error: {
                        iconTheme: {
                            primary: "#ef4444",
                            secondary: "#fff",
                        },
                    },
                }}
            />
        </PageSuspense>
    )
}
