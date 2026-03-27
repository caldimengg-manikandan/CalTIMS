import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useSystemStore } from '@/store/systemStore'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import Spinner from '@/components/ui/Spinner'

// ─── Lazy-loaded pages (code splitting) ──────────────────────────────────────
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
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

// ─── Protected Route Guard ───────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
    const { isAuthenticated, user } = useAuthStore()
    if (!isAuthenticated) return <Navigate to="/login" replace />
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

export default function App() {
    const { isAuthenticated } = useAuthStore()
    const { fetchVersion } = useSystemStore()

    React.useEffect(() => {
        if (isAuthenticated) {
            fetchVersion()
        }
    }, [isAuthenticated, fetchVersion])

    return (
        <PageSuspense>
            <Routes>
                {/* Public Landing Page / Redirect for Authed */}
                <Route path="/" element={
                    isAuthenticated ? <Navigate to="/dashboard" replace /> : <PageSuspense><LandingPage /></PageSuspense>
                } />

                {/* Auth routes */}
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                </Route>


                {/* App routes */}
                <Route element={
                    <ProtectedRoute>
                        <AppLayout />
                    </ProtectedRoute>
                }>
                    <Route path="/dashboard" element={<PageSuspense><DashboardPage /></PageSuspense>} />
                    <Route path="/profile" element={<PageSuspense><ProfilePage /></PageSuspense>} />
                    <Route path="/timesheets" element={<PageSuspense><TimesheetEntry /></PageSuspense>} />
                    <Route path="/timesheets/history" element={<PageSuspense><TimesheetHistory /></PageSuspense>} />
                    <Route path="/leaves" element={<PageSuspense><LeavePage /></PageSuspense>} />
                    <Route path="/calendar" element={<PageSuspense><CalendarPage /></PageSuspense>} />
                    <Route path="/announcements" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><AnnouncementsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/incidents" element={<PageSuspense><IncidentList /></PageSuspense>} />
                    <Route path="/my-payslips" element={<PageSuspense><MyPayslips /></PageSuspense>} />
                    <Route path="/incidents/:id" element={<PageSuspense><IncidentDetails /></PageSuspense>} />

                    {/* Manager + Admin */}
                    <Route path="/timesheets/manage" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><AdminTimesheets /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/timesheets/compliance" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><AdminTimesheetsCompliance /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/leaves/manage" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><LeavePage /></PageSuspense>
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
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><ReportsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><SettingsLayout /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/audit-logs" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><AuditLogPage /></PageSuspense>
                        </ProtectedRoute>
                    } />


                    {/* Payroll Module */}
                    <Route path="/payroll/dashboard" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><PayrollDashboard /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/profiles" element={<ProtectedRoute roles={['admin', 'manager', 'finance', 'hr']}><PageSuspense><EmployeePayrollProfiles /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/salary-structures" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><SalaryStructures /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/processing" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><PayrollProcessing /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/payslip" element={<ProtectedRoute roles={['admin', 'manager', 'finance', 'employee']}><PageSuspense><PayslipGeneration /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/taxes" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><TaxesDeductions /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/reports" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><PayrollReports /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/export" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><BankTransferExport /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/hour-management" element={<ProtectedRoute roles={['admin', 'manager', 'finance', 'hr']}><PageSuspense><HourManagement /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/policy" element={<ProtectedRoute roles={['admin', 'hr']}><PageSuspense><PolicySettings /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/run" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><RunPayroll /></PageSuspense></ProtectedRoute>} />
                    <Route path="/payroll/history" element={<ProtectedRoute roles={['admin', 'manager', 'finance']}><PageSuspense><PayrollHistory /></PageSuspense></ProtectedRoute>} />
                </Route>

                <Route path="*" element={<PageSuspense><NotFoundPage /></PageSuspense>} />
            </ Routes>
        </PageSuspense>
    )
}
