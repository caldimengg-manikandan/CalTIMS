import React, { useRef } from 'react';
import { 
    Users, Landmark, Wallet, ShieldCheck, 
    LayoutDashboard, Receipt, Printer, Download, X 
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { exportToPdf } from '@/utils/pdfExport';

import { payslipTemplateAPI, payrollAPI } from '@/services/endpoints';
import { useSettingsStore } from '@/store/settingsStore';

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

    React.useEffect(() => {
        if (payslip?._id) {
            fetchRenderedHtml();
        }
    }, [payslip?._id]);

    const fetchRenderedHtml = async () => {
        try {
            setLoading(true);
            const res = await payslipTemplateAPI.getRendered(payslip._id);
            setDynamicHtml(res.data.data.html);
        } catch (err) {
            console.error('Failed to fetch dynamic payslip:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!payslip) return null;

    const handleGeneratePdf = async () => {
        const toastId = toast.loading('Generating secure PDF...');
        try {
            const res = await payrollAPI.downloadPayslip(payslip._id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Payslip-${payslip.user?.employeeId || 'Export'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Downloaded successfully', { id: toastId });
        } catch (err) {
            toast.error('Download failed', { id: toastId });
        }
    };

    const currencySymbol = settings?.payroll?.currencySymbol || '₹';
    const companyName = settings?.organization?.companyName || 'TIMS CORPORATION Ltd.';
    const monthName = new Date(2024, payslip.month - 1).toLocaleString('default', { month: 'long' });

    const legacyContent = (
        <div 
            ref={payslipRef}
            className={clsx(
                "bg-white relative overflow-hidden",
                !contentOnly ? "max-w-3xl mx-auto border border-slate-200 rounded-2xl shadow-xl p-16 space-y-12 mb-8" : "w-full p-10 space-y-8"
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

            <div className="flex justify-between items-start border-b border-slate-100 pb-10">
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
                    <h4 className="text-2xl font-black text-slate-800 tracking-tight">
                        {monthName} {payslip.year}
                    </h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                        Cycle ID: {payslip._id?.toString().slice(-8).toUpperCase()}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-16">
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                        <Users size={14} className="text-indigo-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Details</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 text-xs">
                        <span className="font-bold text-slate-400">Employee ID</span>
                        <span className="font-black text-slate-800 text-right">{payslip.user?.employeeId}</span>
                        <span className="font-bold text-slate-400">Full Name</span>
                        <span className="font-black text-slate-800 text-right">{payslip.user?.name}</span>
                        <span className="font-bold text-slate-400">Department</span>
                        <span className="font-black text-slate-800 text-right">{payslip.user?.department}</span>
                        <span className="font-bold text-slate-400">Designation</span>
                        <span className="font-black text-slate-800 text-right">{payslip.user?.designation}</span>
                    </div>
                </div>
                <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                        <Landmark size={14} className="text-indigo-500"/>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Context</span>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 text-xs">
                        <span className="font-bold text-slate-400">Bank Interface</span>
                        <span className="font-black text-slate-800 text-right">{payslip.user?.bankName || 'N/A'}</span>
                        <span className="font-bold text-slate-400">Account No.</span>
                        <span className="font-black text-slate-800 text-right">****{payslip.user?.accountNumber?.slice(-4) || '----'}</span>
                        <span className="font-bold text-slate-400">Pan ID</span>
                        <span className="font-black text-slate-800 text-right">{payslip.user?.pan || '---'}</span>
                        <span className="font-bold text-slate-400">LOP Loss</span>
                        <span className="font-black text-rose-500 text-right">{payslip.breakdown?.lopDeduction || 0} </span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-16 border-t border-slate-100 pt-10">
                <div className="space-y-8">
                    <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4">Earnings Breakdown</h4>
                    <div className="space-y-4">
                        {payslip.breakdown?.earnings?.components?.map((comp, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-bold border-b border-slate-50 pb-3">
                                <span className="text-slate-400">{comp.name}</span>
                                <span className="text-slate-800">{currencySymbol}{formatCurrency(comp.value)}</span>
                            </div>
                        ))}
                        <div className="flex justify-between items-center py-4 bg-emerald-50/50 px-4 rounded-xl border border-emerald-100/50">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Gross Earning</span>
                            <span className="text-xl font-black text-emerald-700">{currencySymbol}{formatCurrency(payslip.breakdown?.earnings?.grossEarnings)}</span>
                        </div>
                    </div>
                </div>
                <div className="space-y-8">
                    <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4">Deduction Liabilities</h4>
                    <div className="space-y-4">
                        {payslip.breakdown?.deductions?.components?.map((comp, idx) => (
                            <div key={idx} className="flex justify-between text-xs font-bold border-b border-slate-50 pb-3">
                                <span className="text-slate-400">{comp.name}</span>
                                <span className="text-rose-500">-{currencySymbol}{formatCurrency(comp.value)}</span>
                            </div>
                        ))}
                        {payslip.breakdown?.lopDeduction > 0 && (
                            <div className="flex justify-between text-xs font-bold border-b border-rose-100 pb-3">
                                <span className="text-rose-400 italic">Attendance Adjustment</span>
                                <span className="text-rose-600">-{currencySymbol}{formatCurrency(payslip.breakdown.lopDeduction)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center py-4 bg-rose-50/50 px-4 rounded-xl border border-rose-100/50">
                            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Total Liability</span>
                            <span className="text-xl font-black text-rose-700">-{currencySymbol}{formatCurrency(payslip.breakdown?.deductions?.totalDeductions)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-10 bg-slate-900 text-white rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform">
                    <Wallet size={120} />
                </div>
                <div className="relative z-10 space-y-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Authenticated Net Disbursement</p>
                    <h3 className="text-6xl font-black tracking-tighter">{currencySymbol}{formatCurrency(payslip.breakdown?.netPay)}</h3>
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
            "bg-white shadow-2xl overflow-hidden animate-in fade-in duration-500",
            !contentOnly ? "max-w-[842px] mx-auto rounded-3xl" : "w-full"
        )}>
            {loading ? (
                <div className="h-[842px] flex flex-col items-center justify-center gap-4 bg-slate-50/50">
                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Securing Document...</p>
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300 no-print">
            <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col overflow-hidden"
            >
                <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10 box-decoration-clone">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Receipt size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">Statement Preview</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee Ref: {payslip.user?.employeeId}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.print()} className="p-2.5 bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-all border border-slate-100"><Printer size={20}/></button>
                        <button onClick={handleGeneratePdf} className="p-2.5 bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-all border border-slate-100"><Download size={20}/></button>
                        <button 
                            onClick={onClose}
                            className="p-2.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-all ml-2"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-12 bg-slate-50 custom-scrollbar">
                    {content}
                </div>

                <div className="p-8 bg-white border-t border-slate-100 flex gap-4 no-print shadow-2xl">
                    <button 
                        onClick={() => window.print()}
                        className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-3"
                    >
                        Print Statement
                    </button>
                    <button 
                        onClick={handleGeneratePdf}
                        className="px-10 py-4 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                    >
                        Download PDF
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default StatementPreview;
