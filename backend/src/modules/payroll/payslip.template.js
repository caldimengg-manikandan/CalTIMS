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

const maskStr = (str, visibleCount = 4) => {
    if (!str) return 'N/A';
    const s = str.toString().trim();
    if (s.length <= visibleCount) return s;
    const maskedPart = '*'.repeat(Math.max(0, s.length - visibleCount));
    // Split into groups of 4 for better readability
    const formattedMasked = maskedPart.replace(/(.{4})/g, '$1 ').trim();
    return formattedMasked + ' ' + s.slice(-visibleCount);
};

const numberToWords = (num) => {
    if (num === 0) return 'Zero Rupees Only';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const format = (n, suffix) => {
        if (n === 0) return '';
        if (n > 19) return b[Math.floor(n / 10)] + ' ' + a[n % 10] + suffix;
        return a[n] + suffix;
    };
    let str = '';
    str += format(Math.floor(num / 10000000), 'Crore ');
    str += format(Math.floor((num / 100000) % 100), 'Lakh ');
    str += format(Math.floor((num / 1000) % 100), 'Thousand ');
    str += format(Math.floor((num / 100) % 10), 'Hundred ');
    let lastTwo = Math.floor(num % 100);
    if (lastTwo > 0) {
        if (str !== '') str += 'and ';
        if (lastTwo > 19) str += b[Math.floor(lastTwo / 10)] + ' ' + a[lastTwo % 10];
        else str += a[lastTwo];
    }
    return str.trim() + ' Rupees Only';
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
    const companyName = settings?.organization?.companyName || 'TIMS'
    const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const monthName = monthNames[(payroll.month || 1) - 1];
    const year = payroll.year || new Date().getFullYear();
    const payslipId = (payroll._id || payroll.id || '').toString().slice(-8).toUpperCase();

    // Extract and Deduplicate Components by Name
    const rawEarnings = Array.isArray(breakdown.earnings) ? breakdown.earnings : (breakdown.earnings?.components || []);
    const rawDeductions = Array.isArray(breakdown.deductions) ? breakdown.deductions : (breakdown.deductions?.components || []);
    
    // Using Map to maintain last value for each unique component name
    const earningsMap = new Map();
    rawEarnings
        .filter(e => !e.hidden && !e._isStatutoryConfig && !(e.name || '').toLowerCase().includes('metadata'))
        .forEach(e => earningsMap.set(e.name, e));
    const earnings = Array.from(earningsMap.values());

    const deductionsMap = new Map();
    rawDeductions
        .filter(d => !d.hidden && !d._isStatutoryConfig && !(d.name || '').toLowerCase().includes('metadata') && !(d.name || '').toLowerCase().includes('gratuity'))
        .forEach(d => deductionsMap.set(d.name, d));
    const deductions = Array.from(deductionsMap.values());

    const gross = breakdown.earnings?.grossEarnings || breakdown.grossPay || 0;
    const totalDeds = breakdown.deductions?.totalDeductions || breakdown.totalDeductions || 0;
    const net = breakdown.netPay || 0;
    const lop = breakdown.lopDeduction || 0;
    
    // Attendance metrics — Engine v3 stores these directly in breakdown; fallback to attendance snapshot
    // Priority: breakdown (engine-computed) > attendance snapshot (raw)
    const totalDaysInMonth   = breakdown.standardMonthlyDays || payroll.attendance?.calendarDaysInMonth || payroll.attendance?.standardMonthlyDays || 30;
    const preJoinDays        = breakdown.preJoinDays ?? (payroll.attendance?.preJoinDays || 0);
    const daysAfterJoin      = breakdown.daysAfterJoin ?? (breakdown.workingDays || Math.max(0, totalDaysInMonth - preJoinDays));
    const lopDays            = breakdown.lopDays ?? (payroll.attendance?.lopDays || 0);
    const payableDays        = breakdown.payableDays ?? Math.max(0, daysAfterJoin - lopDays);
    const perDaySalary       = breakdown.perDaySalary || 0;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
        }
        .payslip-container {
            max-width: 850px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            position: relative;
            min-height: 297mm;
            box-sizing: border-box;
        }
        .header-line {
            height: 4px;
            background: #3b82f6;
            margin-bottom: 40px;
        }
        .section-header {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 8px;
        }
        .section-title {
            font-size: 12px;
            font-weight: 800;
            color: #3b82f6;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .grid {
            display: grid;
            grid-template-columns: 1.2fr 1fr;
            gap: 40px;
            margin-bottom: 30px;
        }
        .info-row {
            display: flex;
            margin-bottom: 8px;
            font-size: 13px;
        }
        .label {
            width: 140px;
            color: #64748b;
            font-weight: 500;
        }
        .value {
            font-weight: 700;
            color: #0f172a;
        }
        .table-container {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 30px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            background: #f8fafc;
            padding: 12px 15px;
            text-align: left;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid #e2e8f0;
        }
        .th-earning { color: #3b82f6; border-right: 1px solid #e2e8f0; }
        .th-amount { color: #3b82f6; text-align: center; }
        .th-deduction { color: #ef4444; border-right: 1px solid #e2e8f0; }
        
        td {
            padding: 12px 15px;
            font-size: 13px;
            border-bottom: 1px solid #f1f5f9;
        }
        .td-name { color: #64748b; font-weight: 500; border-right: 1px solid #e2e8f0; }
        .td-val { font-weight: 700; text-align: right; width: 120px; }
        .earning-val { color: #0f172a; border-right: 1px solid #e2e8f0; }
        .deduction-val { color: #ef4444; }

        .total-row {
            background: #f8fafc;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 12px;
        }
        .total-earning { color: #3b82f6; border-right: 1px solid #e2e8f0; }
        .total-deduction { color: #ef4444; }

        .banner {
            background: #3b82f6;
            color: white;
            padding: 30px;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 60px;
        }
        .net-desc { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; }
        .net-val { font-size: 42px; font-weight: 900; margin-top: 5px; }
        .words-box { text-align: right; max-width: 300px; }
        .amount-words { font-size: 14px; font-weight: 700; font-style: italic; }

        .footer-grid {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 40px;
        }
        .token { font-size: 9px; color: #cbd5e1; font-family: monospace; }
        .signatory { text-align: right; }
        .sign-title { font-size: 12px; font-weight: 900; color: #3b82f6; text-transform: uppercase; }
        .sign-desc { font-size: 9px; color: #94a3b8; margin-top: 5px; }

        .company-footer {
            text-align: center;
            margin-top: 80px;
            font-size: 10px;
            font-weight: 800;
            color: #cbd5e1;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
    </style>
</head>
<body>
    <div class="payslip-container">
        <div style="display: flex; justify-content: space-between; margin-bottom: 40px; align-items: flex-end; padding-bottom: 10px;">
            <div style="flex: 1;">
                <div style="font-size: 32px; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -1.5px; line-height: 1;">${companyName}</div>
                <div style="font-size: 12px; color: #64748b; font-weight: 700; margin-top: 10px; letter-spacing: 2px;">SALARY STATEMENT</div>
            </div>
            <div style="text-align: right; min-width: 200px;">
                <div style="font-size: 11px; font-weight: 900; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; white-space: nowrap;">Payslip Period</div>
                <div style="font-size: 26px; font-weight: 900; color: #1e293b; margin-top: 2px; white-space: nowrap;">${monthName} ${year}</div>
            </div>
        </div>
        
        <table style="width: 100%; margin-bottom: 40px; table-layout: fixed; border-collapse: collapse;">
            <tr>
                <td style="vertical-align: top; padding-right: 20px;">
                    <div class="section-header">
                        <div class="section-title">Employee Information</div>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 6px 0; width: 130px; color: #64748b; font-weight: 600; font-size: 13px;">Name</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 13px;">: ${employeeInfo.name || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600; font-size: 13px;">Employee ID</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 13px;">: ${employeeInfo.employeeId || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600; font-size: 13px;">Designation</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 13px;">: ${employeeInfo.designation || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #64748b; font-weight: 600; font-size: 13px;">Joining Date</td>
                            <td style="padding: 6px 0; color: #0f172a; font-weight: 700; font-size: 13px;">: ${employeeInfo.joiningDate ? new Date(employeeInfo.joiningDate).toLocaleDateString('en-GB') : 'N/A'}</td>
                        </tr>
                    </table>
                </td>
                <td style="vertical-align: top; padding-left: 20px;">
                    <div class="section-header">
                        <div class="section-title">Attendance & Banking</div>
                    </div>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px 0; width: 140px; color: #64748b; font-weight: 600; font-size: 12px;">Days in Month</td>
                            <td style="padding: 5px 0; color: #0f172a; font-weight: 700; font-size: 12px;">: ${totalDaysInMonth}</td>
                        </tr>
                        ${preJoinDays > 0 ? `<tr>
                            <td style="padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px;">Pre-Joining Days</td>
                            <td style="padding: 5px 0; color: #f59e0b; font-weight: 700; font-size: 12px;">: ${preJoinDays} (excluded)</td>
                        </tr>` : ''}
                        ${lopDays > 0 ? `<tr>
                            <td style="padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px;">LOP Days</td>
                            <td style="padding: 5px 0; color: #ef4444; font-weight: 700; font-size: 12px;">: ${lopDays}</td>
                        </tr>` : ''}
                        <tr>
                            <td style="padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px;">Payable Days</td>
                            <td style="padding: 5px 0; color: #3b82f6; font-weight: 800; font-size: 12px;">: ${payableDays}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px;">Per Day Salary</td>
                            <td style="padding: 5px 0; color: #0f172a; font-weight: 700; font-size: 12px;">: ${currencySymbol}${formatCurrency(perDaySalary)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px;">Account No</td>
                            <td style="padding: 5px 0; color: #0f172a; font-weight: 700; font-size: 12px; font-family: monospace;">: ${maskStr(bankDetails.accountNumber)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px;">Bank Name</td>
                            <td style="padding: 5px 0; color: #0f172a; font-weight: 700; font-size: 12px;">: ${bankDetails.bankName || 'N/A'}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th class="th-earning">Earnings Description</th>
                        <th class="th-amount">Amount (${currencySymbol})</th>
                        <th class="th-deduction">Deductions Description</th>
                        <th class="th-amount">Amount (${currencySymbol})</th>
                    </tr>
                </thead>
                <tbody>
                    ${(() => {
                        const rows = [];
                        const maxRows = Math.max(earnings.length, deductions.length);
                        for (let i = 0; i < maxRows; i++) {
                            const e = earnings[i] || {};
                            const d = deductions[i] || {};
                            const isLOP = d.isLOP === true;
                            rows.push(`
                            <tr>
                                <td class="td-name">${e.name || ''}</td>
                                <td class="td-val earning-val">${(e.value || e.calculatedValue) ? formatCurrency(e.value || e.calculatedValue) : ''}</td>
                                <td class="td-name" style="${isLOP ? 'color:#ef4444;font-style:italic;' : ''}">${d.name || ''}</td>
                                <td class="td-val deduction-val" style="${isLOP ? 'font-weight:900;' : ''}">${(d.value || d.calculatedValue) ? formatCurrency(d.value || d.calculatedValue) : ''}</td>
                            </tr>`);
                        }
                        return rows.join('');
                    })()}
                    <tr class="total-row">
                        <td class="total-earning">Gross Earnings</td>
                        <td class="td-val total-earning">${currencySymbol}${formatCurrency(gross)}</td>
                        <td class="total-deduction">Total Deductions</td>
                        <td class="td-val total-deduction">${currencySymbol}${formatCurrency(totalDeds)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="banner">
            <div>
                <div class="net-desc">Net Monthly Salary Payable</div>
                <div class="net-val">${currencySymbol}${formatCurrency(net)}</div>
            </div>
            <div class="words-box">
                <div class="net-desc">Amount in Words</div>
                <div class="amount-words">${numberToWords(net)}</div>
            </div>
        </div>

        <div class="footer-grid">
            <div class="token">
                DIGITAL VERIFICATION TOKEN<br>
                ${(payroll._id || payroll.id || 'N/A').toString().toUpperCase()}
            </div>
            <div class="signatory">
                <div class="sign-title">Authorized Signatory</div>
                <div class="sign-desc">Computer Generated Document - Signatory not mandatory</div>
            </div>
        </div>

        <div class="company-footer">
            ${companyName}
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
