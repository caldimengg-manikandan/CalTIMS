# 🎬 CalTIMS — Live Demo Script & Talking Points

> **Estimated Duration:** 25–35 minutes  
> **Demo Accounts (from seed data):**
> | Role | Email | Password |
> |------|-------|----------|
> | Admin/Owner | `admin@tims.com` | `Admin@123` |
> | HR Manager | `hr@tims.com` | `HrManager@123` |
> | Employee | `emp1@tims.com` | `Employee@123` |

---

## 🔑 Pre-Demo Checklist

- [ ] Backend server is running (`npm run dev` in `/backend`)
- [ ] Frontend dev server is running (`npm run dev` in `/frontend`)
- [ ] MongoDB has seed data loaded (`node seed.js`)
- [ ] Browser is in **incognito mode** (to avoid cached sessions)
- [ ] Screen resolution set to **1920×1080** or higher
- [ ] Close all notifications/popups on your machine
- [ ] Have two browser tabs ready (one for Admin, one for Employee to show role differences)

---

## 📍 Demo Segment 1: Landing Page (The First Impression)

**⏱ Duration:** 2–3 minutes

### What to Show:
1. Open the app root URL (`/`) — the **Landing Page** loads
2. Scroll through the hero section with the animated tagline: *"Effortless Time Tracking for Modern Teams"*
3. Point out the **embedded product demo video** (auto-plays in a macOS-style browser frame)
4. Scroll to the **Trust Strip** — "Accurate time tracking · Real-time insights · Enterprise security · Instant payroll runs · Role-based access control"
5. Walk through the **3 Feature Sections** (alternating left-right layout):
   - ⏱ **Track Time** — with timesheet screenshot
   - 👥 **Manage Teams & Projects** — with dashboard screenshot
   - 💰 **Automate Payroll** — with a live payroll summary card
6. Show the **"Who uses CalTIMS?"** cards (HR Teams, Managers, Employees)
7. Show the **"How it works"** 3-step flow (Log Hours → Manage Approvals → Generate Payroll)
8. Scroll to **Pricing Section** — dynamically generated from `PLAN_FEATURES` constant:
   - **Trial** — ₹0, 28 days, up to 10 employees
   - **Basic** — ₹29/user/month
   - **Pro** — ₹49/user/month (★ Most Popular)
9. Show the **FAQ accordion** section
10. Toggle the **Dark Mode / Light Mode** button in the navbar

### What to Say:
> *"This is CalTIMS — a complete Time, Attendance, and Payroll management platform designed for Indian SMBs and growing teams. The landing page dynamically adapts its pricing section based on actual plan constants defined in the codebase — there's zero hardcoding in the UI. Let me show you the dark mode toggle... and notice how the entire theme updates smoothly."*

> [!TIP]
> **Pro Tip:** Click "Get started free" to seamlessly transition into the Signup flow — this creates a natural segue to Demo Segment 2.

---

## 📍 Demo Segment 2: Registration & Onboarding Flow

**⏱ Duration:** 3–4 minutes

### What to Show:
1. Click **"Get started free"** → Navigate to `/signup`
2. Show the **multi-step registration form**:
   - Organization Name, Admin Name, Email
   - **Email OTP Verification** (real email is sent)
   - Password setup with strength indicator
3. After signup, show the **Onboarding Wizard** (`/onboarding`):
   - Company details setup
   - Department & designation configuration
   - Working hours & week configuration
   - First employee invite
4. Show the **Login Page** (`/login`) with:
   - Email/password login
   - **Google OAuth** button (if configured)
   - Forgot Password link
5. Show the **Forgot Password → Reset Password** flow (token-based email link)

### What to Say:
> *"CalTIMS uses a secure, OTP-verified registration flow. The email verification ensures no fake signups. After registration, new organizations go through a guided onboarding wizard that configures their entire workspace — working hours, departments, compliance settings — in under 2 minutes. We also support Google OAuth for one-click authentication."*

> [!IMPORTANT]
> If doing a **live signup demo**, have a real email address ready. The OTP is sent immediately and expires in 10 minutes.

---

## 📍 Demo Segment 3: Dashboard (The Command Center)

**⏱ Duration:** 3–4 minutes

### What to Show:
1. Login as **Admin** (`admin@tims.com` / `Admin@123`)
2. You land on `/dashboard` — the **personalized management dashboard**
3. Walk through each widget:
   - **Weekly Summary** — hours logged this week, target hours, progress percentage, daily hours breakdown
   - **Submission Deadline** — shows when timesheets are due (e.g., "Friday 18:00")
   - **Compliance Overview** — approved, pending, not-submitted timesheet counts
   - **Leave Balances** — annual, casual, sick leave remaining
   - **Recent Activities** — notification feed with timestamps
   - **Announcements** — latest company bulletins
4. Show the **sidebar navigation** — collapsible, with icons and labels
5. Point out the **real-time notification bell** 🔔

### What to Say:
> *"The dashboard is the central hub — it aggregates data from timesheets, leaves, announcements, and notifications into a single view. Every widget pulls live data from the API. Notice how the sidebar is fully responsive and collapsible. The dashboard adapts based on the logged-in user's role — an employee sees their own data, while an admin sees the organization-wide overview."*

> [!NOTE]
> The dashboard interconnects with **5 different API modules**: `timesheetAPI`, `leaveAPI`, `announcementAPI`, `notificationAPI`, and `projectAPI`.

---

## 📍 Demo Segment 4: Timesheet Entry & Approval Workflow

**⏱ Duration:** 4–5 minutes (⭐ Core Feature — spend extra time here)

### What to Show:

#### A. Employee View (Login as `emp1@tims.com`):
1. Navigate to **Timesheets** (`/timesheets`)
2. Show the **weekly timesheet grid**:
   - Rows = Projects assigned to this employee
   - Columns = Days of the week (Mon–Sun)
   - Each cell = hours input
3. Demonstrate:
   - Adding a **new project row**
   - Entering hours (click cell → type hours)
   - Adding **task descriptions** per entry
   - The **daily total** auto-calculating at the bottom
4. Show validation: minimum/maximum hours per day
5. Click **"Submit for Approval"** — status changes to `Submitted`
6. Navigate to **Timesheet History** (`/timesheets/history`):
   - Show past weeks with statuses: Draft, Submitted, Approved, Rejected
   - Click on a past week to view read-only details

#### B. Manager/Admin View (Login as `admin@tims.com`):
1. Navigate to **Manage Timesheets** (`/timesheets/manage`)
2. Show the **admin timesheet overview** — all employees' submissions
3. Click on an employee's submission:
   - View their hours per project per day
   - **Approve** or **Reject** with comments
4. Show **Timesheet Compliance** (`/timesheets/compliance`):
   - Organization-wide compliance matrix
   - Which employees submitted, which didn't
   - Status breakdown per week

### What to Say:
> *"This is the heart of CalTIMS. Employees get a clean, spreadsheet-like interface to log hours against their assigned projects. The system enforces validation rules — minimum hours, maximum hours, and leave-day locks. Once submitted, the manager receives a notification and can approve or reject with one click. The compliance view gives admins a bird's-eye view of who's submitted and who hasn't — critical for month-end payroll processing."*

### Key Technical Points:
- Timesheets auto-lock approved leave days (synced with Leave module)
- Public holidays from Calendar module are visually marked
- Settings like `workingHoursPerDay` and `weekStartDay` are fetched from the Settings API
- Status lifecycle: `Draft → Submitted → Approved/Rejected → Frozen`

---

## 📍 Demo Segment 5: Leave Management

**⏱ Duration:** 2–3 minutes

### What to Show:

#### Employee View:
1. Navigate to **Leaves** (`/leaves`)
2. Show **Leave Tracker** — visual balance cards (Annual, Casual, Sick)
3. **Apply for Leave**:
   - Select leave type, start date, end date
   - Add reason
   - Submit request
4. Show leave status tracking (Pending → Approved/Rejected)

#### Admin View:
1. Navigate to **Manage Leaves** (`/leaves/manage`)
2. Show pending leave requests
3. **Approve/Reject** a leave request
4. Show how approved leaves automatically create "Leave" rows in the employee's timesheet

### What to Say:
> *"Leave management is tightly integrated with timesheets. When a leave is approved, it automatically locks those days in the employee's timesheet with a 'Leave' tag — no manual entry needed. The system tracks accruals, availed days, and remaining balance in real-time. Leave policies are fully configurable from Settings."*

---

## 📍 Demo Segment 6: Project & Task Management

**⏱ Duration:** 2 minutes

### What to Show:
1. Navigate to **Projects** (`/projects`)
2. Show project list with status badges (Active, Completed, On Hold)
3. Create a **new project**: name, code, description, start date, manager assignment
4. Navigate to **Tasks** (`/tasks`)
5. Show task assignment, status tracking, and filtering

### What to Say:
> *"Projects are the containers that employees log time against. Each project has a code, a manager, and a status. Tasks break down the work further. When employees open their timesheet, they only see projects assigned to them — keeping the interface clean and focused."*

---

## 📍 Demo Segment 7: Payroll Engine (⭐ Premium Feature)

**⏱ Duration:** 5–6 minutes (⭐ High-impact segment)

### What to Show:
1. Navigate to **Payroll Dashboard** (`/payroll/dashboard`)
2. Walk through the payroll sub-modules (sidebar navigation):

#### A. Salary Structures (`/payroll/salary-structures`)
- Show pre-configured structures: Software Engineer, HR Specialist, Finance Manager
- Each has **earnings** (Basic, HRA, Special Allowance) and **deductions** (PF, PT, TDS)
- Explain `Percentage` vs `Fixed` calculation types
- Show the formula engine: `Basic = 40% of CTC`, `HRA = 40% of Basic`

#### B. Employee Payroll Profiles (`/payroll/profiles`)
- Show how each employee is linked to a salary structure
- Monthly CTC, salary mode (Employee-Based vs Role-Based)
- Payment type (Monthly)

#### C. Payroll Policy (`/payroll/policy`)
- Show the **single source of truth** for: PF rates, ESI rates, ESI wage limit, tax slabs
- Explain: *"Change it here, and every future payroll run picks it up automatically"*

#### D. Run Payroll (`/payroll/run`)
- Select month & year (e.g., March 2026)
- Show the **pre-processing preview**: eligible employees, estimated costs
- Click **"Process Payroll"**
- Show the **execution log**: topological trace of every calculation step
- Show the **batch status lifecycle**: `Draft → Processed → Approved → Paid → Locked`

#### E. Payroll History (`/payroll/history`)
- Show past processed months
- Click into a month to see the full **Execution Ledger** (`/payroll/execution/2026/3`)

#### F. Payslip Generation (`/payroll/payslip`)
- Generate professional payslips for the processed month
- Show the PDF output with:
  - Employee info, company branding
  - Earnings breakdown, deductions breakdown
  - Net pay, bank details
  - LOP deduction line items (for employees with loss-of-pay)

#### G. Bank Transfer Export (`/payroll/export`)
- Show bank-export-ready CSV/Excel file generation
- Ready for direct upload to banking portals

#### H. Employee View — My Payslips (`/my-payslips`)
- Login as employee → show how they can download their own payslips

### What to Say:
> *"The payroll engine is where CalTIMS truly differentiates itself. It's not a standalone payroll tool — it's directly linked to approved timesheets. The formula engine supports percentage-based and fixed calculations with cascading formulas. PF, ESI, TDS — everything is calculated automatically based on the payroll policy table. The execution log provides a full audit trail of every mathematical step, which is critical for compliance. And payslips are generated with one click, ready for distribution."*

### Key Technical Points:
- **LOP (Loss of Pay)** is auto-calculated from timesheet data
- PF capped at ₹15,000 wage limit (configurable in policy)
- ESI applicable only below ₹21,000 threshold
- Tax slabs support both OLD and NEW regimes
- Payroll policy is the **single source of truth** — no hardcoded values

---

## 📍 Demo Segment 8: Reports & Analytics

**⏱ Duration:** 2 minutes

### What to Show:
1. Navigate to **Reports** (`/reports`)
2. Show available report types:
   - Department utilization
   - Weekly trends
   - Compliance summary
   - Employee attendance matrix
   - Payroll reports (cost analysis, department-wise)
3. Show **export options** (PDF, Excel)
4. Show **scheduled reports automation** (from Settings → Reports Automation tab)

### What to Say:
> *"Reports aggregate historical data from timesheets, leaves, and payroll into actionable business intelligence. Managers can see which departments are over/under-utilized, track weekly productivity trends, and export compliance summaries for audits. Reports can also be scheduled to auto-generate and email on a recurring basis."*

---

## 📍 Demo Segment 9: Settings & RBAC (Role-Based Access Control)

**⏱ Duration:** 3–4 minutes

### What to Show:
1. Navigate to **Settings** (`/settings`)
2. Walk through the **15 settings tabs**:

| Tab | What to Highlight |
|-----|-------------------|
| **Organization** | Company name, address, tax ID |
| **Branding** | Logo upload, primary color, theme customization |
| **Users & Roles** | Dynamic role creation with granular permissions |
| **Timesheet Policy** | Working hours/day, week start day, submission deadline |
| **Leave Policy** | Leave types, accrual rules, carry-forward settings |
| **Payroll Policy** | PF/ESI/TDS rates, tax slabs, currency symbol |
| **Payslip Templates** | HTML/PDF template customization |
| **Compliance Locks** | Lock timesheets after approval |
| **Notifications** | Email/push notification preferences |
| **Integrations** | Third-party service connections |
| **Configuration Center** | System-wide toggles |
| **Reports Automation** | Scheduled report generation |
| **Onboarding** | New employee onboarding flow config |
| **Audit Logs** | System activity tracking |
| **Permission Audit Logs** | Who changed what permission and when |

3. **Deep dive into Users & Roles**:
   - Show the 5 seeded roles: Admin, HR, Finance, Manager, Employee
   - Click into a role → show the **granular permission matrix**:
     - Module → Submodule → Actions (view, create, edit, delete, approve, run)
   - Create a **custom role** live (e.g., "Team Lead" with limited approval permissions)
   - Show how changing permissions **immediately** affects what that user sees

### What to Say:
> *"CalTIMS has a full RBAC system. Every single route in the application is protected by a permission check — not just role-based, but module-submodule-action level. This means you can create a 'Team Lead' role that can approve timesheets but NOT run payroll. Or an 'HR Intern' role that can view employees but not edit them. Permissions are enforced on both the frontend (UI hiding) and backend (API validation)."*

### Key Technical Points:
- Frontend uses `<ProtectedRoute permission={{ module, submodule, action }}>` for every route
- Backend middleware validates the same permissions on every API call
- `hasPermission(user, module, submodule, action)` utility handles the logic
- Subscription-level feature gating (`isPro`, `hasAccess(featureKey)`) adds a second layer

---

## 📍 Demo Segment 10: Calendar & Announcements

**⏱ Duration:** 1–2 minutes

### What to Show:
1. **Calendar** (`/calendar`):
   - Employee view: see public holidays, your leave days
   - Admin view (`/calendar/manage`): add/edit/delete public holidays
2. **Announcements** (`/announcements`):
   - Company-wide bulletin board
   - Create a new announcement (Admin/HR)
   - Show how it appears in the dashboard notification feed

### What to Say:
> *"The calendar syncs with timesheets — public holidays automatically mark those days as non-working in the timesheet grid. Announcements provide a central communication channel visible to all employees right from their dashboard."*

---

## 📍 Demo Segment 11: Audit Logs & Compliance

**⏱ Duration:** 1–2 minutes

### What to Show:
1. Navigate to **Audit Logs** (`/audit-logs`)
2. Show the complete activity trail:
   - Who logged in and when
   - Who approved/rejected which timesheet
   - Who ran payroll
   - Who changed which setting
3. Show filtering by user, action type, date range

### What to Say:
> *"Every significant action in CalTIMS is logged. This is essential for regulatory compliance — you can trace exactly who approved a timesheet, who ran payroll, and who changed a policy setting. The audit log is immutable and available only to authorized users with the 'Audit Logs' permission."*

---

## 📍 Demo Segment 12: Subscription & Feature Gating

**⏱ Duration:** 1–2 minutes

### What to Show:
1. Explain the **3-tier plan system**:
   - **Trial** — Free 28 days, 10 employees, ALL features (to try everything)
   - **Basic** — ₹29/user/month, no Payroll, no Advanced Reports, no AI
   - **Pro** — ₹49/user/month, everything included
2. Show what happens when a Trial **expires** → **Paywall screen** blocks access
3. Show how upgrading **immediately** unlocks gated features
4. Point out the landing page pricing section dynamically shows the user's current plan

### What to Say:
> *"Feature gating is enforced at two levels — the subscription plan controls which modules are available (e.g., Payroll is Pro-only), and RBAC controls who within the organization can access those modules. When a trial expires, the entire application shows a paywall until the organization upgrades. No data is lost."*

---

## 📍 Demo Segment 13: Super Admin Panel

**⏱ Duration:** 1 minute

### What to Show:
1. Login as a **Super Admin** user
2. Navigate to **Admin Dashboard** (`/admin/dashboard`)
3. Show the platform-wide overview:
   - Total organizations registered
   - Active subscriptions
   - System health metrics
4. Explain this is the **platform operator's** view (not visible to individual organizations)

### What to Say:
> *"The Super Admin panel is for the CalTIMS platform operator — it provides a bird's-eye view of all registered organizations, their subscription status, and system health. This is completely hidden from regular organization users."*

---

## 🎯 Closing Summary & Key Differentiators

### Wrap up your demo by highlighting these **5 differentiators**:

| # | Differentiator | One-Liner |
|---|---------------|-----------|
| 1 | **Timesheet → Payroll Pipeline** | Approved timesheets feed directly into payroll — no manual data transfer |
| 2 | **Formula Engine** | Cascading salary calculations with percentage/fixed formulas and full execution logs |
| 3 | **Granular RBAC** | Module → Submodule → Action level permissions, not just simple role checks |
| 4 | **Multi-Tenant SaaS** | Each organization is fully isolated with its own settings, users, and data |
| 5 | **Indian Compliance** | PF, ESI, TDS, Professional Tax, Old/New tax regime — baked into the payroll engine |

### Closing Statement:
> *"CalTIMS is not just a timesheet tool — it's a complete workforce management platform that connects time tracking, leave management, project allocation, and payroll processing into a single, unified system. Every module talks to every other module, eliminating manual data entry and reducing compliance risk. It's built for Indian SMBs but architected for enterprise scale."*

---

## 🛡️ Handling Tough Questions

| Question | Suggested Response |
|----------|-------------------|
| "What tech stack is this?" | MERN — MongoDB, Express.js, React (Vite), Node.js. State management via Zustand. Styling with vanilla CSS. |
| "How does it handle concurrent users?" | WebSocket support via Socket.io for real-time notifications. Stateless JWT auth enables horizontal scaling. |
| "Is the data secure?" | Yes — bcrypt password hashing, JWT tokens, role-based API middleware, audit logging, and encrypted storage. |
| "Can it integrate with biometric systems?" | The architecture supports it — the Attendance module has hooks for biometric punch data integration. |
| "What about mobile support?" | The UI is fully responsive. A dedicated mobile app can be built on top of the existing REST API. |
| "How is payroll calculated?" | Via a formula engine that processes salary structures with cascading formulas (e.g., Basic = 40% CTC, HRA = 40% of Basic). PF/ESI/TDS are calculated per policy table. |
| "What happens if I change a policy mid-month?" | Policy changes apply to future payroll runs only. Already-processed months are locked and immutable. |

---

## 📂 Demo Flow Cheat Sheet (Quick Reference)

```
Landing Page → Sign Up → Onboarding
    ↓
Dashboard (Admin) → Timesheet Entry (Employee) → Submit
    ↓
Timesheet Approval (Admin) → Compliance View
    ↓
Leave Apply (Employee) → Leave Approve (Admin)
    ↓
Projects → Tasks
    ↓
Payroll: Structures → Profiles → Policy → Run → Payslips → Export
    ↓
Reports → Audit Logs
    ↓
Settings: RBAC → Branding → Policies
    ↓
Subscription Gating → Super Admin
    ↓
🎬 Close
```

> [!CAUTION]
> **Before a live demo:** Always run the seed script (`node seed.js`) to ensure clean, consistent demo data. Never demo on production data.
