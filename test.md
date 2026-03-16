# Hikvision Attendance Integration Test Plan

## 1. Overview
The Hikvision Attendance integration allows the system to synchronize attendance logs from Hikvision biometric devices.

## 2. Prerequisites
- Hikvision Biometric Device (ISAPI compatible)
- Device IP Address, Port (default 80), Username, and Password.
- Backend API reachable from the device network.

## 3. Configuration
1. Navigate to **Settings > Integrations**.
2. Scroll to **Hardware Gateways**.
3. Enable **Hikvision Attendance**.
4. Enter the Device Details:
   - IP Address: `192.168.1.131` (as per screenshot)
   - Port: `8080`
   - Username: `admin`
   - Password: `your_password`
5. Click **Authorize & Save**.

## 4. Test Cases
| ID | Test Case | Expected Result | Status |
|---|---|---|---|
| TC-01 | Save configuration | Settings are persisted in the database. | Pending |
| TC-02 | Test connection | Backend successfully connects to the device. | Pending |
| TC-03 | Fetch logs | Attendance logs are retrieved and mapped to users. | Pending |
| TC-04 | Sync to Timesheets | Attendance hours are reflected in the Draft timesheets. | Pending |

## 5. Known Issues / Errors
- [X] Missing synchronization logic in backend. (Fixed)
- [X] Missing API endpoint for gateway daemon. (Fixed)
