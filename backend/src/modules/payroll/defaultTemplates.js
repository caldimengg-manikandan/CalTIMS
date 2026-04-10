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
    description: 'High-fidelity, blue-themed header, dual-column breakdown.',
    isSystemDefault: true,
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
    <style>
        body { ${commonStyles} background-color: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .container { max-width: 800px; margin: 0 auto; border: 1px solid #f1f5f9; border-radius: 24px; padding: 40px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); min-height: 280mm; box-sizing: border-box; }
        .header { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 25px; margin-bottom: 35px; align-items: flex-start; }
        .company-name { font-size: 26px; font-weight: 900; color: #4f46e5; text-transform: uppercase; letter-spacing: -0.5px; }
        .company-address { font-size: 12px; color: #64748b; margin-top: 6px; line-height: 1.5; max-width: 320px; }
        .title { font-size: 20px; font-weight: 800; text-align: right; color: #0f172a; }
        .info-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 40px; margin-bottom: 40px; }
        .section-title { font-size: 11px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 18px; border-bottom: 2px solid #f8fafc; padding-bottom: 6px; }
        .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; border-bottom: 1px solid #f8fafc; padding-bottom: 4px; }
        .label { color: #94a3b8; font-weight: 500; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        .value { color: #1e293b; font-weight: 700; }
        .table-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .summary-box { padding: 16px; border-radius: 12px; margin-top: 15px; display: flex; justify-content: space-between; font-weight: 800; font-size: 14px; }
        .earnings { background: #f0fdf4; color: #166534; }
        .deductions { background: #fef2f2; color: #991b1b; }
        .net-pay { background: #0f172a; color: white; padding: 35px; border-radius: 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 45px; position: relative; overflow: hidden; }
        .net-pay::after { content: ''; position: absolute; right: -20px; top: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.03); border-radius: 50%; }
        .net-val { font-size: 40px; font-weight: 900; letter-spacing: -1px; }
        .disclaimer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 40px; font-style: italic; opacity: 0.8; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <div class="company-name">{{companyName}}</div>
                <div class="company-address">{{companyAddress}}</div>
            </div>
            <div class="title">
                <div>PAYSLIP {{monthName}} {{year}}</div>
                <div style="font-size: 10px; color: #94a3b8;">REF: {{refNo}}</div>
            </div>
        </div>
        
        <div class="info-grid">
            <div>
                <div class="section-title">Employee Information</div>
                <div class="row"><span class="label">Name</span><span class="value">{{employeeName}}</span></div>
                <div class="row"><span class="label">Employee ID</span><span class="value">{{employeeId}}</span></div>
                <div class="row"><span class="label">Department</span><span class="value">{{department}}</span></div>
                <div class="row"><span class="label">Designation</span><span class="value">{{designation}}</span></div>
            </div>
            <div>
                <div class="section-title">Payment Account</div>
                <div class="row"><span class="label">Bank</span><span class="value">{{bankName}}</span></div>
                <div class="row"><span class="label">A/C No</span><span class="value">{{accountNo}}</span></div>
                <div class="row"><span class="label">PAN ID</span><span class="value">{{panId}}</span></div>
                <div class="row"><span class="label">LOP Days</span><span class="value">{{lopDays}}</span></div>
            </div>
        </div>

        <div class="table-grid">
            <div>
                <div class="section-title" style="color: #059669;">Earnings</div>
                {{earningsTable}}
                <div class="summary-box earnings"><span>Gross Earnings</span><span>{{grossEarnings}}</span></div>
            </div>
            <div>
                <div class="section-title" style="color: #e11d48;">Deductions</div>
                {{deductionsTable}}
                <div class="summary-box deductions"><span>Total Deductions</span><span>{{totalDeductions}}</span></div>
            </div>
        </div>

        <div class="net-pay">
            <div><div style="font-size: 11px; opacity: 0.6;">NET DISBURSEMENT</div><div class="net-val">{{netPay}}</div></div>
            <div style="text-align: right;"><div style="color: #10b981; font-weight: 800;">✓ VERIFIED</div><div style="font-size: 10px; opacity: 0.4;">Electronically Generated</div></div>
        </div>

        <div class="disclaimer">This is a computer-generated document and does not require a signature.</div>
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
