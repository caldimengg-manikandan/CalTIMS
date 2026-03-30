# CalTIMS Module Architecture & Linkage Guide

This document provides a comprehensive overview of the CalTIMS (Timesheet & Payroll) system architecture, specifically detailing the "where to where" linkage between the Frontend features and Backend modules.

## 🏗️ System Overview

CalTIMS is built on a modular architecture to ensure scalability and maintainability.

- **Frontend**: React-based, organized by **Features** (`src/features/*`). State management is handled primarily via **Zustand** stores.
- **Backend**: Node.js/Express-based, organized by **Modules** (`src/modules/*`).
- **Communication**: Frontend communicates with the Backend via a centralized Axios instance and service layer (`src/services/*`).

---

## 🔗 Module Linkage Map (Where to Where)

| Feature / Domain | Frontend Feature Path | API Service (`endpoints.js`) | Backend Route (`/api/v1/...`) | Backend Module Path |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | `src/features/auth/` | `authAPI` | `/auth` | `backend/src/modules/auth/` |
| **User Management** | `src/features/employees/` | `userAPI` | `/users` | `backend/src/modules/users/` |
| **Role Management** | `src/features/settings/` | `roleAPI` | `/roles` | `backend/src/modules/users/` |
| **Timesheets** | `src/features/timesheets/` | `timesheetAPI` | `/timesheets` | `backend/src/modules/timesheets/` |
| **Attendance** | `src/features/calendar/` | `attendanceAPI` | `/attendance` | `backend/src/modules/attendance/` |
| **Projects** | `src/features/projects/` | `projectAPI` | `/projects` | `backend/src/modules/projects/` |
| **Leave Management** | `src/features/leaves/` | `leaveAPI` | `/leaves` | `backend/src/modules/leaves/` |
| **Payroll Engine** | `src/features/payroll/` | `payrollAPI` | `/payroll` | `backend/src/modules/payroll/` |
| **Payslip Templates** | `src/features/payroll/` | `payslipTemplateAPI`| `/payslip-templates` | `backend/src/modules/payroll/` |
| **Reporting** | `src/features/reports/` | `reportAPI` | `/reports` | `backend/src/modules/reports/` |
| **Subscriptions** | `src/features/subscriptions/`| `subscriptionAPI` | `/subscriptions` | `backend/src/modules/subscriptions/` |
| **Announcements** | `src/features/announcements/`| `announcementAPI` | `/announcements` | `backend/src/modules/announcements/` |
| **Audit Logs** | `src/features/audit/` | `auditAPI` | `/audit` | `backend/src/modules/audit/` |
| **Global Settings** | `src/features/settings/` | `settingsAPI` | `/settings` | `backend/src/modules/settings/` |
| **Super Admin** | `src/features/admin/` | `adminAPI` | `/admin` | `backend/src/modules/admin/` |

---

## 🛠️ Linkage Mechanics

### 1. The Service Layer (Frontend)
The frontend uses a centralized `api.js` (Axios instance) which handles:
- Base URL configuration.
- Token injection (Authorization headers).
- Global error handling (401 redirects to login).

Files: `frontend/src/services/api.js` and `frontend/src/services/endpoints.js`.

### 2. State Hydration
On application load, `useAuthStore` (Zustand) triggers `checkAuth()`. This calls `/users/me` and `/subscriptions/current` to hydrate the global state.
- **Where**: `frontend/src/store/authStore.js`
- **Link**: `/api/v1/users/me` -> `backend/src/modules/users/user.controller.js`

### 3. Feature Gating
Access to specific modules (like Payroll) is controlled by the `isPro` check and `canAccess(feature)` helper in `authStore.js`.
- **Link**: Frontend UI checks -> `subscription` state from backend.

### 4. Route Mounting (Backend)
All backend modules are mounted in the main application entry point.
- **Where**: `backend/src/app.js`
- **Pattern**: `app.use('/api/v1/module-name', moduleRoutes);`

---

## 🧩 Detailed Module Interconnection & Data Flow

This section details exactly how each module is interconnected and what data flows into the frontend features.

### 1. Dashboard Module (The Central Hub)
The dashboard aggregates data from almost every major module to provide an executive overview.

- **Interconnection**:
    - `timesheetAPI` -> Fetch weekly/daily productivity.
    - `leaveAPI` -> Fetch user leave balances.
    - `announcementAPI` -> Fetch latest company bulletins.
    - `notificationAPI` -> Fetch system activity feed.
    - `projectAPI` -> Fetch allocated projects for filtering.
- **Data Inflow (Key Data Points)**:
    - **Weekly Summary**: `hoursThisWeek`, `targetHours`, `progressPct`, `dailyHours` (array of day/hours).
    - **Deadlines**: `submissionDeadline` (e.g., "Friday 18:00").
    - **Compliance**: `approvedTimesheets`, `pendingTimesheets`, `notSubmittedCount`.
    - **Leave State**: `annualBalance`, `casualBalance`, `sickBalance`.
    - **Activities**: `recentNotifications` (titles, messages, timestamps).

### 2. Timesheet Module (Core Data Entry)
This is where users log their daily work and where the primary data for payroll and billing is generated.

- **Interconnection**:
    - `settingsAPI` -> Fetch company-wide `workingHoursPerDay`, `weekStartDay`, and `submissionDeadline`.
    - `projectAPI` -> Fetch only projects assigned to the current user.
    - `leaveAPI` -> Fetch approved leaves to automatically lock/fill leave rows in the timesheet.
    - `calendarAPI` -> Fetch public holidays to visually mark non-working days.
    - `attendanceAPI` -> (Optional) Fetch biometric punch-in/out data to assist in time logging.
- **Data Inflow**:
    - **Row Config**: `projectId`, `taskCategory`, `totalHours`.
    - **Daily Entries**: `date`, `hoursLogged`, `taskDescription`.
    - **Validation Rules**: `minHoursPerDay`, `maxHoursPerDay`, `lockStatus` (draft/submitted/approved/frozen).

### 3. Payroll Engine (Compensation Logic)
The most sensitive module, calculating payouts based on timesheets and policy.

- **Interconnection**:
    - `timesheetAPI` -> Fetch approved hours as the basis for salary calculation.
    - `settingsAPI` -> Fetch `currencySymbol`, statutory rules, and payslip branding.
    - `payslipTemplateAPI` -> Fetch chosen HTML/PDF templates for payslip generation.
    - `userAPI` -> Fetch employee bank details (`accountNumber`, `IFSC`, `bankName`).
- **Data Inflow**:
    - **Calculation Metadata**: `grossEarnings`, `totalDeductions`, `netPay`.
    - **Breakdown**: `basicSalary`, `HRA`, `PF`, `ESI`, `PT`, `IncomeTax`, `LOP (Loss of Pay) Deductions`.
    - **Batch State**: `batchStatus` (Draft -> Processed -> Approved -> Paid -> Locked).
    - **Execution Log**: Topological trace of every mathematical formula applied during the run.

### 4. Leave Management Module
Handles the lifecycle of employee leaves and their impact on attendance.

- **Interconnection**:
    - `timesheetAPI` -> Synced automatically; approved leaves create special "Leave" rows in timesheets.
    - `userAPI` -> Fetch employee department and manager (for approval routing).
- **Data Inflow**:
    - **Leave Object**: `leaveType`, `startDate`, `endDate`, `totalDays`, `reason`, `status`.
    - **Accrual State**: `availed`, `balance`, `accrued` for each leave category.

### 5. Reporting & Analytics Module
Aggregates historical data for business intelligence.

- **Interconnection**:
    - `timesheetAPI` & `leaveAPI` -> Primary sources for productivity and availability reports.
    - `projectAPI` -> Source for project budget vs. actual utilization reports.
- **Data Inflow**:
    - **Aggregated Data**: `departmentUtilization`, `weeklyTrend`, `complianceSummary`, `employeeAttendanceMatrix`.
    - **Insights**: AI-driven strings (e.g., "Department-X contributed 40% of all logged hours").

### 6. Auth & RBAC Module
Secures the application and defines what data each user can see.

- **Interconnection**:
    - `subscriptionAPI` -> Checks if the organization is on TRIAL or PRO to gate software features.
    - `organizationsAPI` -> Manages multi-tenant silos.
- **Data Inflow**:
    - **User Context**: `name`, `role`, `permissions` (array), `isPro` (boolean check).
    - **Token State**: `accessToken`, `refreshToken`, `isAuthenticated`.

---

## 🚀 How to Trace a Data Point

1.  **Start at the UI**: Identify the component (e.g., `DashboardPage.jsx`).
2.  **Check the Service**: Look at the `useQuery` or `useMutation` calling a service (e.g., `timesheetAPI.getDashboardSummary`).
3.  **Check `endpoints.js`**: See the exact API route (e.g., `/timesheets/summary`).
4.  **Check `backend/src/app.js`**: Find where the route is mounted (e.g., `/api/v1/timesheets` points to `timesheet.routes.js`).
5.  **Check the Backend Route**: Locate the handler in `timesheet.routes.js` (e.g., `router.get('/summary', ...)`).
6.  **Trace through Controller -> Service -> Model**: See exactly which MongoDB collection and fields are being queried.
