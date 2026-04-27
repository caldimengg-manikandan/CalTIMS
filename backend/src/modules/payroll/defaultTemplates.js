'use strict';

/**
 * Default HTML Templates for Payslips
 * 1. Standard Corporate
 * 2. Modern Minimal
 * 3. Detailed Breakdown
 * 4. Executive Format
 * 5. Compact Payslip
 */

const commonStyles = `
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 0;
`;

exports.DEFAULT_TEMPLATES = [
  {
    name: 'CORPORATE',
    description: 'TIMS Signature Layout - High-fidelity, blue-themed.',
    isSystemDefault: true,
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 0; background-color: white; }
        .container { max-width: 850px; margin: 0 auto; padding: 40px; box-sizing: border-box; min-height: 297mm; position: relative; }
        .main-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 10px; }
        .grid-table { width: 100%; margin-bottom: 40px; table-layout: fixed; border-collapse: collapse; }
        .section-header { border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }
        .section-title { font-size: 12px; font-weight: 800; color: #3b82f6; text-transform: uppercase; letter-spacing: 1px; }
        .table-container { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 12px 15px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        .th-blue { color: #3b82f6; }
        .th-red { color: #ef4444; }
        td { padding: 8px 15px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
        .td-label { width: 130px; color: #64748b; font-weight: 600; border: none; padding: 6px 0; }
        .td-value { color: #0f172a; font-weight: 700; border: none; padding: 6px 0; }
        .td-name { color: #64748b; font-weight: 500; border-right: 1px solid #e2e8f0; }
        .td-val { font-weight: 700; text-align: right; }
        .val-blue { color: #0f172a; border-right: 1px solid #e2e8f0; }
        .deduction-val { color: #ef4444; }
        .total-row { background: #f8fafc; font-weight: 800; font-size: 12px; }
        .summary-banner { background: #0f172a; color: white; padding: 30px; border-radius: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; }
        .net-large { font-size: 42px; font-weight: 950; letter-spacing: -2px; }
        .footer-grid { display: flex; justify-content: space-between; margin-top: 60px; align-items: flex-end; }
        .token { font-size: 9px; color: #cbd5e1; font-family: monospace; }
        .signatory { text-align: right; }
        .sign-title { font-size: 12px; font-weight: 900; color: #3b82f6; text-transform: uppercase; }
        .company-name { font-size: 32px; font-weight: 950; color: #0f172a; text-transform: uppercase; letter-spacing: -1.5px; line-height: 1; }
    </style>
</head>
<body>
    <div class="container">
        <div class="main-header">
            <div>
                <div class="company-name">{{companyName}}</div>
                <div style="font-size: 12px; color: #64748b; font-weight: 700; margin-top: 10px; letter-spacing: 2px;">SALARY STATEMENT</div>
            </div>
            <div style="text-align: right; min-width: 200px;">
                <div style="font-size: 11px; font-weight: 900; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; white-space: nowrap;">Payslip Period</div>
                <div style="font-size: 26px; font-weight: 900; color: #1e293b; margin-top: 2px; white-space: nowrap;">{{monthName}} {{year}}</div>
            </div>
        </div>

        <table class="grid-table">
            <tr>
                <td style="vertical-align: top; padding-right: 20px; border: none;">
                    <div class="section-header"><div class="section-title">Employee Details</div></div>
                    <table style="width: 100%;">
                        <tr><td class="td-label">Name</td><td class="td-value">: {{employeeName}}</td></tr>
                        <tr><td class="td-label">Employee ID</td><td class="td-value">: {{employeeId}}</td></tr>
                        <tr><td class="td-label">Designation</td><td class="td-value">: {{designation}}</td></tr>
                        <tr><td class="td-label">Joining Date</td><td class="td-value">: {{joiningDate}}</td></tr>
                    </table>
                </td>
                <td style="vertical-align: top; padding-left: 20px; border: none;">
                    <div class="section-header"><div class="section-title">Attendance & Banking</div></div>
                    <table style="width: 100%;">
                        <tr><td class="td-label">Working Days</td><td class="td-value">: {{standardWorkingDays}}</td></tr>
                        <tr><td class="td-label">Payable Days</td><td class="td-value">: <span style="color: #3b82f6;">{{payableDays}}</span></td></tr>
                        <tr><td class="td-label">Bank Name</td><td class="td-value">: {{bankName}}</td></tr>
                        <tr><td class="td-label">Account No</td><td class="td-value" style="font-family: monospace;">: {{accountNo}}</td></tr>
                    </table>
                </td>
            </tr>
        </table>

        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th class="th-blue">Earnings</th>
                        <th class="th-blue" align="right">Amount</th>
                        <th class="th-red">Deductions</th>
                        <th class="th-red" align="right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {{earningsDeductionsRows}}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td style="color: #3b82f6; border-right: 1px solid #e2e8f0;">Gross Total</td>
                        <td align="right" style="color: #3b82f6; border-right: 1px solid #e2e8f0;">{{grossEarnings}}</td>
                        <td style="color: #ef4444;">Total Deductions</td>
                        <td align="right" style="color: #ef4444;">{{totalDeductions}}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <div class="summary-banner">
            <div>
                <div style="font-size: 11px; font-weight: 700; opacity: 0.8; text-transform: uppercase; letter-spacing: 2px;">Net Monthly Salary Payable</div>
                <div class="net-large">{{netPay}}</div>
            </div>
            <div style="text-align: right; max-width: 350px;">
                <div style="font-size: 11px; font-weight: 700; opacity: 0.8; text-transform: uppercase;">Amount in Words</div>
                <div style="font-size: 14px; font-weight: 700; font-style: italic;">{{amountInWords}}</div>
            </div>
        </div>

        <div class="footer-grid">
            <div class="token">VERIFICATION TOKEN: {{refNo}}</div>
            <div class="signatory">
                <div class="sign-title">Authorized Signatory</div>
                <div style="font-size: 9px; color: #94a3b8; margin-top: 5px;">Computer Generated - No Signature Required</div>
            </div>
        </div>
    </div>
</body>
</html>
    `
  },
  {
    name: 'MODERN',
    description: 'Clean layout with large typography and grayscale theme.',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { ${commonStyles} background: white; padding: 20px; }
        .container { border-radius: 20px; padding: 20px; max-width: 750px; margin: 0 auto; box-sizing: border-box; min-height: 280mm; }
        .header { margin-bottom: 40px; }
        .period { font-size: 48px; font-weight: 900; letter-spacing: -2px; }
        .emp-info { display: flex; gap: 40px; margin-bottom: 40px; font-size: 14px; }
        .label { color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; display: block; margin-bottom: 4px; }
        .val { font-weight: 700; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; }
        .table { width: 100%; border-collapse: collapse; }
        .total-row { font-weight: 900; font-size: 18px; padding-top: 20px !important; }
        .net-section { margin-top: 80px; border-top: 4px solid #0f172a; padding-top: 20px; display: flex; justify-content: space-between; align-items: baseline; }
        .table td { border-bottom: 1px solid rgba(0,0,0,0.05); }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="period">{{monthName}} {{year}}</div>
            <div style="color: #64748b;">TIMS CORPORATION • PAYSLIP</div>
        </div>
        <div class="emp-info">
            <div><span class="label">Employee</span><span class="val">{{employeeName}}</span></div>
            <div><span class="label">ID</span><span class="val">{{employeeId}}</span></div>
            <div><span class="label">Designation</span><span class="val">{{designation}}</span></div>
        </div>
        <div class="grid">
            <div>
                <span class="label">Earnings</span>
                <table class="table">
                    {{earningsRows}}
                    <tr><td class="total-row">Gross</td><td class="total-row" align="right">{{grossEarnings}}</td></tr>
                </table>
            </div>
            <div>
                <span class="label">Deductions</span>
                <table class="table">
                    {{deductionsRows}}
                    <tr><td class="total-row">Total</td><td class="total-row" align="right">{{totalDeductions}}</td></tr>
                </table>
            </div>
        </div>
        <div class="net-section">
            <span style="font-size: 24px; font-weight: 900;">NET PAY</span>
            <span style="font-size: 64px; font-weight: 900;">{{netPay}}</span>
        </div>
    </div>
</body>
</html>
    `
  },
  {
    name: 'MINIMAL',
    description: 'Multi-layered grid showing statutory specifics and attendance.',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { ${commonStyles} font-size: 12px; padding: 10px; background: white; }
        .container { border-radius: 12px; padding: 15px; max-width: 750px; margin: 0 auto; min-height: 280mm; box-sizing: border-box; }
        .box { border: 1px solid rgba(0,0,0,0.1); margin-bottom: 15px; border-radius: 8px; overflow: hidden; }
        .box-title { background: rgba(0, 0, 0, 0.05); padding: 10px 15px; font-weight: 800; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .inner { padding: 15px; }
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        table { width: 100%; border-collapse: collapse; }
        table th { text-align: left; padding: 8px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; }
        table td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
    </style>
</head>
<body>
    <div class="container">
        <h2 style="text-align: center;">DETAILED PAYSLIP STATEMENT</h2>
        <div class="box">
            <div class="box-title">Employment & Attendance</div>
            <div class="inner grid-4">
                <div><strong>Name:</strong> {{employeeName}}</div>
                <div><strong>ID:</strong> {{employeeId}}</div>
                <div><strong>Month:</strong> {{monthName}}</div>
                <div><strong>Year:</strong> {{year}}</div>
                <div><strong>Dept:</strong> {{department}}</div>
                <div><strong>Desig:</strong> {{designation}}</div>
                <div><strong>LOP:</strong> {{lopDays}} Days</div>
                <div><strong>OT:</strong> {{overtimeHours}} Hrs</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
            <div class="box">
                <div class="box-title">Earnings Breakdown</div>
                <div class="inner">
                    <table>
                        <thead><tr><th>Component</th><th align="right">Amount</th></tr></thead>
                        <tbody>{{earningsRows}}</tbody>
                        <tfoot><tr><th>GROSS EARNINGS</th><th align="right">{{grossEarnings}}</th></tr></tfoot>
                    </table>
                </div>
            </div>
            <div class="box">
                <div class="box-title">Deductions & Liabilities</div>
                <div class="inner">
                    <table>
                        <thead><tr><th>Component</th><th align="right">Amount</th></tr></thead>
                        <tbody>{{deductionsRows}}</tbody>
                        <tfoot><tr><th>TOTAL DEDUCTIONS</th><th align="right">{{totalDeductions}}</th></tr></tfoot>
                    </table>
                </div>
            </div>
        </div>
        <div class="box" style="background: rgba(30, 41, 59, 0.1);">
            <div class="inner" style="display: flex; justify-content: space-between; align-items: center; font-size: 18px; font-weight: 900;">
                <span>TOTAL NET PAYABLE</span>
                <span>{{netPay}}</span>
            </div>
        </div>
    </div>
</body>
</html>
    `
  },
  {
    name: 'EXECUTIVE',
    description: 'Premium indigo aesthetic with badges and professional metrics.',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { ${commonStyles} background: white; padding: 20px; }
        .card { border-radius: 30px; padding: 30px; box-shadow: none; max-width: 750px; margin: 0 auto; min-height: 280mm; box-sizing: border-box; }
        .top-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
        .logo { width: 50px; height: 50px; background: #6366f1; border-radius: 12px; }
        .pill { background: #e0e7ff; color: #4338ca; padding: 6px 16px; border-radius: 99px; font-size: 12px; font-weight: 700; }
        .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 50px; }
        .summary-card { background: rgba(0, 0, 0, 0.05); border-radius: 20px; padding: 30px; border: 1px solid rgba(0,0,0,0.05); }
        .net-large { font-size: 48px; font-weight: 900; color: #1e1b4b; }
    </style>
</head>
<body>
    <div class="card">
        <div class="top-bar">
            <div style="display: flex; align-items: center; gap: 15px;">
                <div class="logo"></div>
                <div><div style="font-weight: 900; font-size: 18px;">TIMS CORP</div><div style="font-size: 10px; color: #64748b;">EXECUTIVE STATEMENT</div></div>
            </div>
            <div class="pill">{{monthName}} {{year}}</div>
        </div>
        <div class="main-grid">
            <div>
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 15px;">
                    {{earningsRows}}
                    <tr><td style="font-weight: 800; border-top: 1px solid #eee; padding-top: 15px;">GROSS</td><td align="right" style="font-weight: 800; border-top: 1px solid #eee; padding-top: 15px;">{{grossEarnings}}</td></tr>
                </table>
            </div>
            <div class="summary-card">
                <div style="font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 20px;">SUMMARY</div>
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 12px; color: #64748b;">Net Payable</div>
                    <div class="net-large">{{netPay}}</div>
                </div>
                <div style="margin-bottom: 10px; display: flex; justify-content: space-between;"><span>Deductions</span><span style="color: #ef4444;">{{totalDeductions}}</span></div>
                <div style="display: flex; justify-content: space-between;"><span>LOP</span><span>{{lopDays}} Days</span></div>
            </div>
        </div>
    </div>
</body>
</html>
    `
  },
  {
    name: 'COMPACT',
    description: 'Ultra-concise single column format for mobile or quick view.',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { ${commonStyles} font-size: 11px; padding: 15px; background: transparent; }
        .container { border-radius: 12px; padding: 15px; }
        .h { font-weight: 900; border-bottom: 1px solid rgba(0,0,0,0.1); margin-bottom: 10px; padding-bottom: 5px; }
        .row { display: flex; justify-content: space-between; padding: 4px 0; }
        .total { border-top: 1px dashed #ccc; margin-top: 10px; padding-top: 10px; font-weight: 900; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="h">TIMS PAYSLIP - {{monthName}} {{year}}</div>
        <div>{{employeeName}} ({{employeeId}})</div>
        <div>{{designation}}</div>
        <div style="margin: 15px 0;">
            <strong>EARNINGS:</strong>
            {{earningsRows}}
        </div>
        <div style="margin: 15px 0;">
            <strong>DEDUCTIONS:</strong>
            {{deductionsRows}}
        </div>
        <div class="total">NET PAY: {{netPay}}</div>
        <div style="text-align: center; margin-top: 20px; font-size: 8px;">Generated on {{date}}</div>
    </div>
</body>
</html>
    `
  }
];
