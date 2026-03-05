---
title: CalTIMS Application Detailed Test Cases
author: testing team
date: 2026-03-05
---

# Detailed Test Cases: CalTIMS Application

## 1. Authentication & Authorization (AUTH)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_AUTH_01 | Auth | Valid Login | User is authenticated, JWT token received, redirected to Dashboard. |
| TC_AUTH_02 | Auth | Invalid Login | Error message displayed: "Invalid credentials." |
| TC_AUTH_03 | Auth | Forgot Password Flow | Password reset link sent to valid email address. |
| TC_AUTH_04 | Auth | Reset Password | Password successfully updated using a valid token. |
| TC_AUTH_05 | Auth | RBAC Navigation | Employee attempting to navigate to `/employees` (Admin router) is blocked/redirected. |
| TC_AUTH_06 | Auth | Session Expiration | User is redirected to login page when JWT expires. |

## 2. Employee Management (EMP)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_EMP_01 | Users | Create Employee (Admin) | Employee account created successfully and defaults setup. |
| TC_EMP_02 | Users | Update Profile | User can successfully update personal details. |
| TC_EMP_03 | Users | Deactivate Employee | Admin successfully deactivates an employee; deactivated user cannot login. |
| TC_EMP_04 | Users | Change Role | Admin can change Employee role to Manager; Manager features unlock. |

## 3. Timesheets Management (TS)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_TS_01 | Timesheet | Add Normal Entry | Entry saved successfully with accurate hours and task description. |
| TC_TS_02 | Timesheet | Entry Exceeding 24h/Day | System rejects entry; "Total hours cannot exceed 24 per day". |
| TC_TS_03 | Timesheet | Negative Hours Entry | System throws constraint error; saves blocked. |
| TC_TS_04 | Timesheet | Save as Draft | Timesheet saved but status remains 'DRAFT'. Total hours calculated. |
| TC_TS_05 | Timesheet | Submit incomplete week (<40h) | System highlights week as incomplete, submission blocked or flagged. |
| TC_TS_06 | Timesheet | Submit valid Timesheet | Status changes from DRAFT to SUBMITTED. Cannot be edited by employee. |
| TC_TS_07 | Timesheet | Manager Approval | Submitted timesheet status updated to APPROVED. |
| TC_TS_08 | Timesheet | Manager Rejection | Status updated to REJECTED with mandatory rejection reason. |
| TC_TS_09 | Timesheet | Admin Bulk Submit/Approve | Authorized users can process multiple timesheets at once. |
| TC_TS_10 | Timesheet | Edit Saved Draft | Data (including zero values for unspecified days) accurately loads in UI. |

## 4. Leave Operations (LV)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_LV_01 | Leave | Apply for Paid Leave | Leave requires existing balance; status set to PENDING upon apply. |
| TC_LV_02 | Leave | Apply for LOP | Unpaid leave applied without balance checks. LOP appears in dropdown. |
| TC_LV_03 | Leave | Insufficient Balance | System rejects Paid Leave application if request > balance available. |
| TC_LV_04 | Leave | Manager Approve Leave | Status changes to APPROVED. Relevant timesheet days auto-filled. |
| TC_LV_05 | Leave | Calendar Integration | Approved leaves populate on the global calendar view accurately. |
| TC_LV_06 | Leave | Cancel Approved Leave | User can cancel; balances strictly refunded; timesheet sync reverted. |
| TC_LV_07 | Leave | Sync Leave to Timesheet | Paid (8h or 4h half-day) and LOP (0h) correctly reflect mapped hours in timesheet row. |
| TC_LV_08 | Leave | Display All Leaves per Day | Single row in timesheet correctly consolidates approved/pending varied leave scopes. |

## 5. Projects & Tasks (PT)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_PT_01 | Projects | Add New Project | Project saved and visible in Time Entry project dropdown. |
| TC_PT_02 | Tasks | Assign Task | Employees see assigned tasks in their dashboard. |
| TC_PT_03 | Projects | Admin Deactivate Project | Inactive projects no longer selectable by employees. |

## 6. Reports & Auto-Scheduling (REP)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_REP_01 | Reports | Generate Timesheet Report | Correct data aggregation shown based on date and project filters. |
| TC_REP_02 | Reports | Schedule Report Setting | "Send Now" triggers email dispatch to selected recipient list. |
| TC_REP_03 | Reports | PDF/Preview Report | HTML-to-PDF preview generated securely for Admin review. |

## 7. Application Settings (SET)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_SET_01 | Settings | Update Timesheet Config | `maxEntriesPerDay` respects newly set value. |
| TC_SET_02 | Settings | Toggle Leave Types | Disabled Leave types immediately hide from Employee Leave apply form. |
| TC_SET_03 | Settings | Working Hours setting | Adjusts minimum limit rules accurately for week/day calculations. |

## 8. Dashboard (DB)
| Test ID | Module | Scenario | Expected Result |
| :--- | :--- | :--- | :--- |
| TC_DB_01 | Dashboard | Admin KPI Count | Admins see total employee count; metric updates alongside new creations. |
| TC_DB_02 | Dashboard | Employee UI Hiding | Employee cannot see Total Employee/Admin counts or Manager quick action panels. |
