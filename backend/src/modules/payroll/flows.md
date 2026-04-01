# 🏦 Manual Payment Flow (Check/Cash/Manual)

This document describes the flow for manually disbursing payroll (e.g., via physical Check or Cash) while maintaining Bank-Grade security and auditability.

---

## 🛠️ Disbursement Flow

### 1. Verification
Before a check is issued, the Administrator reviews the `ProcessedPayroll` records for the month.
- **Engine Resolution**: The system uses the active **Effective-Dated** salary structure for that specific month to ensure correct calculations.

### 2. Manual Action
The Administrator triggers the "Mark as Paid" action via the UI or API.
- **Endpoint**: `POST /api/v1/payroll/mark-paid`
- **Required Payload**:
  ```json
  {
    "month": 4,
    "year": 2026,
    "version": 0, // Optimistic Concurrency Control (OCC) Version
    "paymentMethod": "Check",
    "transactionId": "CHQ-100234", // The Manual Check Number
    "notes": "Issued by Finance Dept"
  }
  ```

### 3. Business Logic Safeguards
- **Optimistic Concurrency Control (OCC)**: The system checks if the `PayrollBatch` version (`__v`) matches the provided one. If another admin has modified the batch, the request is rejected with a **Transaction Conflict** error.
- **Double-Disbursement Prevention**: The service layer checks if `isPaid` is already `true`. If so, the operation is blocked.

### 4. Immutable Transition
Upon success, the following happens atomically:
- **ProcessedPayroll Update**: `isPaid` set to `true`, `paidAt` and `paidBy` are recorded.
- **Data Lock**: Schema-level Mongoose hooks (`pre-save`) now block ANY further modification to the financial fields of this record. It is now officially "Frozen".

### 5. Bank-Grade Auditing (Ledger)
A new entry is emitted to the `PayrollLedger`:
- **Hashing**: A SHA-256 hash is generated for the action.
- **Chaining**: The `previousHash` from the last transaction is linked to this one.
- **Payload**: The Check Number (`transactionId`) is stored in the immutable ledger.

### 6. Side Effects
The `PayrollJob` queue receives a task:
- **Worker**: Generates the PDF Payslip with the "Paid via Check (Ref: CHQ-100234)" stamp and dispatches it via email in the background.

---

## 🔒 Security Summary
| Layer | Protection |
| :--- | :--- |
| **API** | RBAC check for `disburse` permission. |
| **Service** | OCC version check and double-payment guard. |
| **Model** | Pre-save hook immutability lock. |
| **Ledger** | Cryptographic hashing of the check issuance. |

---

## 🔍 Verification Flow (Ledger Integrity Check)

If an Administrator or Auditor needs to manually verify that the system hasn't been tampered with:

### 1. Hash Recalculation
Recalculate the SHA-256 hash using the following payload fields:
- `organizationId`
- `batchId`
- `action`
- `status`
- `processedBy`
- `previousHash`

### 2. Chain Verification (Merkle-style)
The system ensures that for each entry `n`:
- `entry[n].previousHash` matches `entry[n-1].hash`.
- This ensures any modification to historical data is immediately evident as the chain "breaks".

### 3. Database Immobilization
Even if an internal actor attempts a raw database update, the **Mongoose Pre-Save Lock** will reject any modification to financial fields where `isPaid: true`. This prevents raw-data tampering outside the standard business flow.
