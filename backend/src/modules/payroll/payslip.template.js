'use strict';

/**
 * Enterprise Payslip HTML Template
 * Standardized High-Fidelity design for consistent view, email, and download.
 */

const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

exports.getEnterprisePayslipHtml = (payroll, settings = {}) => {
    const employeeInfo = payroll.employeeInfo || payroll.user || {};
    const bankDetails = payroll.bankDetails || payroll.user || {};
    const breakdown = payroll.breakdown || {};
    const getCurrencySymbol = (code) => {
        const symbols = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ' };
        return symbols[code] || '₹';
    };
    const currencyCode = settings?.organization?.currency || 'INR';
    const currencySymbol = getCurrencySymbol(currencyCode);
    const companyName = settings?.organization?.companyName || 'TIMS CORPORATION';
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[(payroll.month || 1) - 1];
    const year = payroll.year || new Date().getFullYear();
    const payslipId = (payroll._id || '').toString().slice(-8).toUpperCase();

    // Extract and Deduplicate Components by Name
    const rawEarnings = Array.isArray(breakdown.earnings) ? breakdown.earnings : (breakdown.earnings?.components || []);
    const rawDeductions = Array.isArray(breakdown.deductions) ? breakdown.deductions : (breakdown.deductions?.components || []);
    
    // Using Map to maintain last value for each unique component name
    const earningsMap = new Map();
    rawEarnings.forEach(e => earningsMap.set(e.name, e));
    const earnings = Array.from(earningsMap.values());

    const deductionsMap = new Map();
    rawDeductions.forEach(d => deductionsMap.set(d.name, d));
    const deductions = Array.from(deductionsMap.values());

    const gross = breakdown.earnings?.grossEarnings || 0;
    const totalDeds = breakdown.deductions?.totalDeductions || 0;
    const net = breakdown.netPay || 0;
    const lop = breakdown.lopDeduction || 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }
        .payslip-container {
            max-width: 750px;
            margin: 0 auto;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 24px;
            padding: 30px;
            position: relative;
            overflow: hidden;
            min-height: 280mm;
            box-sizing: border-box;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 40px;
            margin-bottom: 40px;
        }
        .company-name {
            font-size: 28px;
            font-weight: 900;
            color: #4f46e5;
            margin: 0;
            letter-spacing: -1px;
        }
        .statement-label {
            font-size: 12px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 10px;
        }
        .period-box {
            text-align: right;
        }
        .period-title {
            font-size: 24px;
            font-weight: 900;
            color: #1e293b;
            margin: 0;
        }
        .cycle-id {
            font-size: 10px;
            font-weight: 900;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 8px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 60px;
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 10px;
            font-weight: 900;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 2px;
            border-bottom: 1px solid #f8fafc;
            padding-bottom: 8px;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            margin-bottom: 12px;
        }
        .label {
            font-weight: 700;
            color: #64748b;
        }
        .value {
            font-weight: 900;
            color: #0f172a;
        }
        .financial-grid {
            border-top: 1fr solid #f1f5f9;
            padding-top: 40px;
        }
        .table-header {
            font-size: 11px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            margin-bottom: 25px;
        }
        .earning-header { color: #059669; }
        .deduction-header { color: #e11d48; }
        
        .line-item {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 700;
            border-bottom: 1px solid #f8fafc;
            padding-bottom: 12px;
            margin-bottom: 12px;
        }
        .line-label { color: #94a3b8; }
        .line-value { color: #1e293b; }
        .deduction-value { color: #e11d48; }

        .summary-box {
            padding: 16px;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
        }
        .earning-summary {
            background-color: #f0fdf4;
            border: 1px solid #dcfce7;
        }
        .deduction-summary {
            background-color: #fff1f2;
            border: 1px solid #ffe4e6;
        }
        .summary-label {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .earning-summary .summary-label { color: #059669; }
        .deduction-summary .summary-label { color: #e11d48; }
        
        .summary-value {
            font-size: 20px;
            font-weight: 900;
        }
        .earning-summary .summary-value { color: #166534; }
        .deduction-summary .summary-value { color: #991b1b; }

        .net-pay-banner {
            background-color: #0f172a;
            color: white;
            border-radius: 40px;
            padding: 40px;
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
        }
        .net-label {
            font-size: 11px;
            font-weight: 900;
            color: rgba(255,255,255,0.4);
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        .net-amount {
            font-size: 54px;
            font-weight: 900;
            margin-top: 8px;
            letter-spacing: -2px;
        }
        .verified-badge {
            background-color: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            padding: 16px 24px;
            border-radius: 16px;
            text-align: center;
            backdrop-filter: blur(8px);
        }
        .verified-text {
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #10b981;
            display: block;
            margin-bottom: 4px;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
        }
        .footer-text {
            font-size: 10px;
            font-weight: 900;
            color: #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 4px;
        }
        .watermark {
            position: absolute;
            top: -100px;
            right: -100px;
            opacity: 0.03;
            pointer-events: none;
            transform: rotate(15deg);
        }
    </style>
</head>
<body>
    <div class="payslip-container">
        <div class="header">
            <div>
                <h1 class="company-name">${companyName}</h1>
                <div class="statement-label">Employee Payout Statement</div>
            </div>
            <div class="period-box">
                <div class="period-title">${monthName} ${year}</div>
                <div class="cycle-id">REF NO: ${payslipId}</div>
            </div>
        </div>

        <div class="grid">
            <div>
                <div class="section-title">Employee Details</div>
                <div class="info-row"><span class="label">Employee ID</span><span class="value">${employeeInfo.employeeId || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Full Name</span><span class="value">${employeeInfo.name || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Department</span><span class="value">${employeeInfo.department || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Designation</span><span class="value">${employeeInfo.designation || 'N/A'}</span></div>
            </div>
            <div>
                <div class="section-title">Financial Context</div>
                <div class="info-row"><span class="label">Bank Name</span><span class="value">${bankDetails.bankName || 'N/A'}</span></div>
                <div class="info-row"><span class="label">Account No</span><span class="value">****${(bankDetails.accountNumber || '').slice(-4)}</span></div>
                <div class="info-row"><span class="label">PAN ID</span><span class="value">${bankDetails.pan || 'N/A'}</span></div>
                ${(payroll.attendance?.lopDays > 0) ? `
                <div class="info-row"><span class="label">LOP Days / Adjustment</span><span class="value">${payroll.attendance.lopDays} Days / ${currencySymbol}${formatCurrency(lop)}</span></div>
                ` : ''}
            </div>
        </div>

        <div class="grid" style="grid-template-columns: 1fr 1fr; border-top: 1px solid #f1f5f9; padding-top: 40px;">
            <div>
                <div class="table-header earning-header">Earnings Breakdown</div>
                ${earnings.map(e => `
                    <div class="line-item">
                        <span class="line-label">${e.name}</span>
                        <span class="line-value">${currencySymbol}${formatCurrency(e.value)}</span>
                    </div>
                `).join('')}
                <div class="summary-box earning-summary">
                    <span class="summary-label">Earned Gross</span>
                    <span class="summary-value">${currencySymbol}${formatCurrency(gross)}</span>
                </div>
            </div>
            <div>
                <div class="table-header deduction-header">Deduction Liabilities</div>
                ${deductions.map(d => `
                    <div class="line-item">
                        <span class="line-label">${d.name}</span>
                        <span class="deduction-value">-${currencySymbol}${formatCurrency(d.value)}</span>
                    </div>
                `).join('')}
                <div class="summary-box deduction-summary">
                    <span class="summary-label">Total Liability</span>
                    <span class="summary-value">-${currencySymbol}${formatCurrency(totalDeds)}</span>
                </div>
            </div>

        </div>

        <div class="net-pay-banner">
            <div>
                <div class="net-label">Authenticated Net Disbursement</div>
                <div class="net-amount">${currencySymbol}${formatCurrency(net)}</div>
            </div>
            <div class="verified-badge">
                <span class="verified-text">✓ VERIFIED</span>
                <span style="font-size: 8px; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase;">System Authenticated</span>
            </div>
        </div>

        <div class="footer">
            <p class="footer-text">This is a system generated statement and does not require a physical signature.</p>
            <p style="font-size: 8px; color: #cbd5e1; font-weight: 700; margin-top: 10px;">© ${new Date().getFullYear()} ${companyName}</p>
        </div>
    </div>
</body>
</html>
    `;
};

/**
 * Professional Payslip Email Notification Template
 * High-end design for the email body that notifies the user.
 */
exports.getProfessionalPayslipEmailBody = (payroll, settings = {}) => {
    const employeeName = payroll.user?.name || payroll.employeeInfo?.name || 'Employee';
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[(payroll.month || 1) - 1];
    const year = payroll.year || new Date().getFullYear();
    const net = payroll.breakdown?.netPay || 0;
    const companyName = settings?.organization?.companyName || 'CALTIMS';
    const currencySymbol = settings?.organization?.currency === 'USD' ? '$' : '₹';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f7fa; color: #334155; margin: 0; padding: 0; }
        .wrapper { padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
        .body { padding: 40px; line-height: 1.6; }
        .greeting { font-size: 18px; font-weight: 700; color: #1e293b; margin-bottom: 16px; }
        .message { font-size: 15px; color: #475569; margin-bottom: 24px; }
        .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .label { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
        .value { font-size: 15px; font-weight: 700; color: #1e293b; }
        .net-value { font-size: 20px; font-weight: 800; color: #4f46e5; }
        .footer { padding: 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        .attachment-note { font-size: 13px; color: #64748b; font-style: italic; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1 style="color: white; margin: 0;">${companyName}</h1>
            </div>
            <div class="body">
                <div class="greeting">Hello ${employeeName},</div>
                <div class="message">
                    Your payroll statement for <strong>${monthName} ${year}</strong> has been processed and is now available for your review.
                </div>
                
                <div class="summary-card">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding-bottom: 10px;"><span class="label">Pay Period</span></td>
                            <td style="text-align: right; padding-bottom: 10px;"><span class="value">${monthName} ${year}</span></td>
                        </tr>
                        <tr>
                            <td style="padding-top: 10px; border-top: 1px solid #e2e8f0;"><span class="label">Net Disbursement</span></td>
                            <td style="text-align: right; padding-top: 10px; border-top: 1px solid #e2e8f0;"><span class="net-value">${currencySymbol}${net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></td>
                        </tr>
                    </table>
                </div>

                <div class="message">
                    Please find the detailed payslip attached as a PDF document to this email for your records.
                </div>

                <div class="attachment-note">
                    Note: If you have any discrepancies or questions regarding this payout, please reach out to the HR or Finance department.
                </div>
            </div>
            <div class="footer">
                &copy; ${year} ${companyName} | Secure Payroll Services
            </div>
        </div>
    </div>
</body>
</html>
    `;
};
