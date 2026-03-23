import React, { Suspense, lazy, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
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
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

// ─── Protected Route Guard ───────────────────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
    const { isAuthenticated, user, subscription } = useAuthStore()
    
    if (!isAuthenticated) return <Navigate to="/login" replace />

    // Trial Expiration Check (Skip for Super Admin)
    if (user?.role !== 'super_admin' && subscription?.status === 'EXPIRED') {
        return <Paywall />
    }

    if (user?.role === 'super_admin') return children
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
    const { checkAuth, isTrial, subscription, user } = useAuthStore()
    const { sidebarOpen } = useUIStore()

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    return (
        <PageSuspense>
            <Routes>
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
                    <Route path="/leaves" element={<PageSuspense><LeavePage /></PageSuspense>} />
                    <Route path="/calendar" element={<PageSuspense><CalendarPage /></PageSuspense>} />
                    <Route path="/announcements" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><AnnouncementsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/incidents" element={<PageSuspense><IncidentList /></PageSuspense>} />
                    <Route path="/incidents/:id" element={<PageSuspense><IncidentDetails /></PageSuspense>} />

                    {/* Manager + Admin */}
                    <Route path="/timesheets/manage" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><AdminTimesheets isAdminView={true} /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/timesheets/compliance" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><AdminTimesheetsCompliance /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/leaves/manage" element={
                        <ProtectedRoute roles={['admin', 'manager']}>
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
                        <ProtectedRoute roles={['admin', 'manager']}>
                            <PageSuspense><ReportsPage /></PageSuspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute roles={['admin']}>
                            <PageSuspense><SettingsLayout /></PageSuspense>
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
