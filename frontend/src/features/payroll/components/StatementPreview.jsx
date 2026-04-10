import React, { useRef } from 'react';
import { createPortal } from 'react-dom';

import { 
    Users, Landmark, Wallet, ShieldCheck, 
    LayoutDashboard, Receipt, Printer, Download, X 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { exportToPdf } from '@/utils/pdfExport';
import { getCurrencySymbol } from '@/utils/formatters';

import { payslipTemplateAPI, payrollAPI } from '@/services/endpoints';
import { useSettingsStore } from '@/store/settingsStore';
import { toast } from 'react-hot-toast';

const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const StatementPreview = ({ payslip, settings, onClose = () => {}, onDownload = () => {}, contentOnly = false }) => {
    const { payslipDesign } = useSettingsStore();
    const payslipRef = useRef(null);
    const [dynamicHtml, setDynamicHtml] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [downloading, setDownloading] = React.useState(false);

    React.useEffect(() => {
        if (payslip?.id) {
            fetchRenderedHtml();
        }
    }, [payslip?.id]);

    const fetchRenderedHtml = async () => {
        try {
            setLoading(true);
            const res = await payslipTemplateAPI.getRendered(payslip.id);
            setDynamicHtml(res.data.data.html);
        } catch (err) {
            console.error('Failed to fetch dynamic payslip:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!payslip) return null;

    const handleGeneratePdf = async () => {
        setDownloading(true);
        const toastId = toast.loading('Securing your payslip...');
        try {
            const res = await payrollAPI.downloadPayslip(payslip.id);

            // Check if we got a blob that might actually be a JSON error
            if (res.data instanceof Blob && res.data.type === 'application/json') {
                const text = await res.data.text();
                const json = JSON.parse(text);
                throw new Error(json.message || 'Download failed');
            }

            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            
            const empCode = payslip.employeeInfo?.employeeId || payslip.employee?.employeeCode || 'EMP';
            const filename = `Payslip_${empCode}_${monthName}_${payslip.year}.pdf`;
            
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success('Downloaded successfully!', { 
                id: toastId,
                icon: '📄'
            });
        } catch (err) {
            console.error('Download error:', err);
            toast.error(err.message || 'Download failed', { id: toastId });
        } finally {
            setDownloading(false);
        }
    };

    const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');
    const companyName = settings?.organization?.companyName || 'TIMS CORPORATION Ltd.';
    const monthName = new Date(2024, payslip.month - 1).toLocaleString('default', { month: 'long' });

    const legacyContent = (
        <div 
            ref={payslipRef}
            className={clsx(
                "bg-white dark:bg-[#1a1a1a] relative overflow-hidden",
                !contentOnly ? "max-w-3xl mx-auto border border-slate-200 dark:border-[#333333] rounded-2xl shadow-xl p-16 space-y-12 mb-8" : "w-full p-10 space-y-8"
            )}
        >
            {/* Background Image Support */}
            {payslipDesign?.backgroundImageUrl && (
                <div 
                    className="absolute inset-0 opacity-20 pointer-events-none bg-cover bg-center z-0"
                    style={{ backgroundImage: `url(${payslipDesign.backgroundImageUrl})` }}
                />
            )}

            {/* Branding Watermark */}
            {!payslipDesign?.backgroundImageUrl && (
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none rotate-12">
                    <LayoutDashboard size={400} />
                </div>
            )}

            <div className="flex justify-between items-start border-b border-slate-100 dark:border-white/5 pb-10">
                <div className="space-y-3">
                    <h1 className="text-3xl font-black text-indigo-600 tracking-tighter">
                        {companyName.toUpperCase()}
                    </h1>
                    <div className="text-xs font-bold text-slate-400 space-y-1 uppercase tracking-widest">
                        <p>Employee Payout statement</p>
                        <p>Status: Authenticated Document</p>
                    </div>
                </div>
                <div className="text-right">
                    <h4 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                        {monthName} {payslip.year}
                    </h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                        Cycle ID: {payslip.id?.toString().slice(-8).toUpperCase()}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-16">
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-50 dark:border-white/5 pb-2">
                        <Users size={14} className="text-indigo-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 text-xs">
                        <span className="font-bold text-slate-500 dark:text-slate-400">Employee ID</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">{payslip.employeeInfo?.employeeId || 'N/A'}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">Full Name</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">{payslip.employeeInfo?.name || 'N/A'}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">Department</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">{payslip.employeeInfo?.department || 'N/A'}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">Designation</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">{payslip.employeeInfo?.designation || 'N/A'}</span>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-50 dark:border-white/5 pb-2">
                        <Landmark size={14} className="text-indigo-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Context</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 text-xs">
                        <span className="font-bold text-slate-500 dark:text-slate-400">Bank Interface</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">{payslip.bankDetails?.bankName || 'N/A'}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">Account No.</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">****{(payslip.bankDetails?.accountNumber || '').slice(-4) || '----'}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">Pan ID</span>
                        <span className="font-black text-slate-800 dark:text-white text-right">{payslip.bankDetails?.pan || '---'}</span>
                        <span className="font-bold text-slate-500 dark:text-slate-400">OT Hours</span>
                        <span className="font-black text-indigo-500 text-right">{payslip.breakdown?.overtimeHours || 0} hrs</span>
                        {payslip.attendance?.lopDays > 0 && (
                            <>
                                <span className="font-bold text-slate-400">LOP Loss</span>
                                <span className="font-black text-rose-500 text-right">{currencySymbol}{formatCurrency(payslip.breakdown?.lopDeduction || 0)}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-16 border-t border-slate-100 dark:border-white/5 pt-10">
                <div className="space-y-8">
                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4">Earnings Breakdown</h4>
                    <div className="space-y-4">
                        {(Array.isArray(payslip.breakdown?.earnings) ? payslip.breakdown.earnings : payslip.breakdown?.earnings?.components || []).map((comp, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-bold border-b border-slate-50 dark:border-white/5 pb-3">
                                <span className="text-slate-500 dark:text-slate-400">{comp.name}</span>
                                <span className="text-slate-800 dark:text-white">{currencySymbol}{formatCurrency(comp.value)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between items-center py-4 bg-emerald-50/50 dark:bg-emerald-500/10 px-4 rounded-xl border border-emerald-100/50 dark:border-emerald-500/20">
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Gross Earning</span>
                            <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">{currencySymbol}{formatCurrency(payslip.grossYield || payslip.breakdown?.earnings?.grossEarnings || payslip.breakdown?.grossPay)}</span>
                        </div>

                        {/* Net Additions (Post-Gross Items like Overtime per request) */}
                        {(payslip.breakdown?.earnings?.additionalAdditions || []).map((add, idx) => (
                            <div key={idx} className="flex justify-between items-center py-3 bg-indigo-50/30 dark:bg-indigo-500/10 px-4 rounded-xl border border-indigo-100/30 dark:border-indigo-500/20 group">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{add.name}</span>
                                    <span className="text-[8px] font-bold text-slate-400 dark:text-gray-500">Paid directly to Net</span>
                                </div>
                                <span className="text-base font-black text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">+{currencySymbol}{formatCurrency(add.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-8">
                    <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4">Deduction Liabilities</h4>
                    <div className="space-y-4">
                        {(Array.isArray(payslip.breakdown?.deductions) ? payslip.breakdown.deductions : payslip.breakdown?.deductions?.components || []).map((comp, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-bold border-b border-slate-50 dark:border-white/5 pb-3">
                                <span className="text-slate-500 dark:text-slate-400">{comp.name}</span>
                                <span className="text-rose-500">{currencySymbol}{formatCurrency(comp.value)}</span>
                            </div>
                        ))}
                        {payslip.attendance?.lopDays > 0 && payslip.breakdown?.lopDeduction > 0 && (
                            <div className="flex justify-between text-xs font-bold border-b border-rose-100 dark:border-rose-500/20 pb-3">
                                <span className="text-rose-400 italic">Attendance Adjustment</span>
                                <span className="text-rose-600">-{currencySymbol}{formatCurrency(payslip.breakdown.lopDeduction)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-4 bg-rose-50/50 dark:bg-rose-500/10 px-4 rounded-xl border border-rose-100/50 dark:border-rose-500/20">
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Total Liability</span>
                            <span className="text-xl font-black text-rose-700 dark:text-rose-300">-{currencySymbol}{formatCurrency(payslip.liability || payslip.breakdown?.deductions?.totalDeductions || payslip.breakdown?.totalDeductions)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-10 bg-slate-900 dark:bg-black text-white rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                    <Wallet size={120} />
                </div>
                <div className="relative z-10 space-y-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Authenticated Net Disbursement</p>
                    <h3 className="text-6xl font-black tracking-tighter">{currencySymbol}{formatCurrency(payslip.netPay || payslip.breakdown?.netPay || payslip.breakdown?.netSalary)}</h3>
                </div>
                <div className="mt-8 md:mt-0 relative z-10 px-8 py-4 bg-white/10 border border-white/20 rounded-2xl flex flex-col items-center gap-1 backdrop-blur-md">
                    <ShieldCheck size={24} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Verified Document</span>
                </div>
            </div>

            <div className="text-center pt-8 space-y-2">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">This is a system generated statement and does not require signature.</p>
                <p className="text-[8px] font-bold text-slate-400">© {new Date().getFullYear()} {companyName.toUpperCase()}</p>
            </div>
        </div>
    );

    const dynamicContent = (
        <div className={clsx(
            "bg-white dark:bg-[#1a1a1a] shadow-2xl overflow-hidden animate-in fade-in duration-500",
            !contentOnly ? "max-w-[842px] mx-auto rounded-3xl" : "w-full"
        )}>
            {loading ? (
                <div className="h-[842px] flex flex-col items-center justify-center gap-4 bg-slate-50/50 dark:bg-white/5">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Securing Document...</p>
                </div>
            ) : dynamicHtml ? (
                <iframe 
                    srcDoc={dynamicHtml} 
                    className="w-full h-full min-h-[842px] border-none"
                    title="Dynamic Payslip"
                />
            ) : legacyContent}
        </div>
    );

    const content = dynamicHtml ? dynamicContent : legacyContent;

    if (contentOnly) return content;

    return createPortal(
        <div className="fixed inset-0 z-[999] flex items-center justify-end bg-slate-900/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300 no-print">
            <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                className="w-full max-w-4xl h-full bg-white dark:bg-[#111111] shadow-2xl flex flex-col overflow-hidden"
            >
                <div className="sticky top-0 bg-white dark:bg-[#111111] border-b border-slate-100 dark:border-[#333333] p-6 flex justify-between items-center z-10 box-decoration-clone">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <Receipt size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Statement Preview</h2>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Employee Ref: {payslip.employeeInfo?.employeeId || payslip.employee?.employeeCode}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* <button onClick={() => window.print()} className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:text-indigo-600 rounded-xl transition-all border border-slate-100 dark:border-[#333333]"><Printer size={20}/></button>
                        <button onClick={handleGeneratePdf} disabled={downloading} className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-gray-400 hover:text-indigo-600 rounded-xl transition-all border border-slate-100 dark:border-[#333333] disabled:opacity-50">
                            {downloading ? (
                                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Download size={20}/>
                            )}
                        </button> */}
                        <button 
                            onClick={onClose}
                            className="p-2.5 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-all ml-2"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 dark:bg-black custom-scrollbar">
                    {content}
                </div>

                {/* <div className="p-8 bg-white dark:bg-[#111111] border-t border-slate-100 dark:border-[#333333] flex gap-4 no-print shadow-2xl">
                    <button 
                        onClick={() => window.print()}
                        className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3"
                    >
                        Print Statement
                    </button>
                    <button 
                        onClick={handleGeneratePdf}
                        disabled={downloading}
                        className="px-10 py-4 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {downloading && <div className="w-3 h-3 border-2 border-slate-600 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />}
                        Download PDF
                    </button>
                </div> */}
            </motion.div>
        </div>,
        document.body
    );

};

export default StatementPreview;
