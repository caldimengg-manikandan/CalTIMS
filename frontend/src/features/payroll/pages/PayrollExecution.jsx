import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    ChevronLeft, Download, CreditCard, AlertCircle, CheckCircle2, 
    Search, Filter, Building2, User as UserIcon, Wallet, 
    ArrowRight, Info, ShieldCheck, ShieldAlert, MoreHorizontal,
    ExternalLink, FileText, Send, Building
} from 'lucide-react';
import { payrollAPI, settingsAPI } from '../../../services/endpoints';
import { formatCurrency, getCurrencySymbol } from '../../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const PayrollExecution = () => {
    const { year, month } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Queries
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
    });
    const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

    const { data: payrollRecords, isLoading, refetch } = useQuery({
        queryKey: ['payrollExecution', year, month],
        queryFn: () => payrollAPI.getHistory({ month: parseInt(month), year: parseInt(year) }).then(res => res.data.data)
    });

    // Mutations
    const markPaidMutation = useMutation({
        mutationFn: (id) => payrollAPI.markPayslipAsPaid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payrollExecution'] });
            toast.success('Payment marked as completed');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to mark as paid')
    });

    const bulkMarkPaidMutation = useMutation({
        mutationFn: (ids) => payrollAPI.bulkMarkPayslipsAsPaid(ids),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['payrollExecution'] });
            toast.success(`Successfully processed ${res.data?.data?.success || 'all'} payments`);
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Bulk update failed')
    });

    // Logic & Filtering
    const monthName = useMemo(() => {
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long' });
    }, [year, month]);

    const processedData = useMemo(() => {
        if (!payrollRecords) return [];
        return payrollRecords.filter(rec => {
            const matchesSearch = rec.employeeInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 rec.employeeInfo?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const bankMissing = !rec.bankDetails?.accountNumber || !rec.bankDetails?.ifscCode;
            const payslipGenerated = !!rec.payslip;
            
            let status = 'draft';
            if (rec.isPaid || rec.payslip?.status === 'PAID') status = 'paid';
            else if (bankMissing) status = 'blocked';
            else if (payslipGenerated) status = 'pending';
            
            const matchesStatus = statusFilter === 'all' || status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [payrollRecords, searchTerm, statusFilter]);

    const kpis = useMemo(() => {
        if (!payrollRecords) return { total: 0, payable: 0, paid: 0, pending: 0 };
        const total = payrollRecords.length;
        const payable = payrollRecords.reduce((acc, r) => acc + (r.netPay || 0), 0);
        const paid = payrollRecords.filter(r => r.isPaid || r.payslip?.status === 'PAID').reduce((acc, r) => acc + (r.netPay || 0), 0);
        return {
            total,
            payable,
            paid,
            pending: payable - paid,
            blockedCount: payrollRecords.filter(r => !r.isPaid && (!r.bankDetails?.accountNumber || !r.bankDetails?.ifscCode)).length
        };
    }, [payrollRecords]);


    const handleMarkPaid = (record) => {
        if (!record.payslip) {
            toast.error('Generate payslip first to mark as paid');
            return;
        }
        markPaidMutation.mutate(record.payslip.id);
    };

    const handleMarkAllPaid = () => {
        const pendingIds = payrollRecords
            .filter(r => !r.isPaid && r.payslip && r.bankDetails?.accountNumber && r.bankDetails?.ifscCode)
            .map(r => r.payslip.id);
        
        if (pendingIds.length === 0) {
            toast.error('No pending payments to process (Ensure payslips are generated)');
            return;
        }

        if (window.confirm(`Mark ${pendingIds.length} payments as completed?`)) {
            bulkMarkPaidMutation.mutate(pendingIds);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full"
                />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-10 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-gray-200 bg-slate-50/30 dark:bg-black min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <button 
                        onClick={() => navigate('/payroll/history')}
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4 hover:gap-3 transition-all group"
                    >
                        <ChevronLeft size={16} /> Back to History
                    </button>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        Payroll Execution – <span className="text-indigo-600 dark:text-indigo-400">{monthName} {year}</span>
                    </h1>
                    <p className="text-slate-500 dark:text-gray-400 font-medium mt-1">Review, approve, and complete salary disbursement</p>
                </div>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleMarkAllPaid}
                        className="px-6 py-3.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-xl shadow-indigo-100 dark:shadow-none active:scale-95"
                    >
                        <CreditCard size={18} /> Mark All as Paid
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Employees', value: kpis.total, icon: UserIcon, color: 'indigo', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                    { label: 'Total Payable', value: `${currencySymbol}${formatCurrency(kpis.payable)}`, icon: Wallet, color: 'slate', bg: 'bg-slate-100 dark:bg-white/10' },
                    { label: 'Paid Amount', value: `${currencySymbol}${formatCurrency(kpis.paid)}`, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                    { label: 'Pending Amount', value: `${currencySymbol}${formatCurrency(kpis.pending)}`, icon: ClockIcon, color: 'amber', bg: 'bg-amber-50 dark:bg-amber-500/10' }
                ].map((kpi, idx) => (
                    <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white dark:bg-[#111111] p-6 rounded-[32px] border border-slate-100 dark:border-[#333333] shadow-sm flex items-center gap-5 hover:shadow-md transition-all group"
                    >
                        <div className={`w-14 h-14 ${kpi.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <kpi.icon size={24} className={`text-${kpi.color}-600 dark:text-${kpi.color}-400`} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1.5">{kpi.label}</p>
                            <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{kpi.value}</h4>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
                {/* Main Table Area */}
                <div className="xl:col-span-3 space-y-6">
                    {/* Filters & Search */}
                    <div className="bg-white dark:bg-[#111111] p-4 rounded-[32px] border border-slate-100 dark:border-[#333333] shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div className="flex-1 min-w-[300px] relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or employee ID..."
                                className="w-full pl-12 pr-6 py-3.5 bg-slate-50 dark:bg-[#0a0a0a] border border-transparent dark:border-[#333333]/50 dark:text-white rounded-[20px] text-sm font-medium focus:bg-white dark:focus:bg-[#1a1a1a] focus:border-indigo-100 dark:focus:border-[#333333] outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <Filter size={16} className="text-slate-400" />
                            <div className="flex items-center bg-slate-50 dark:bg-[#0a0a0a] p-1 rounded-2xl border border-slate-100 dark:border-[#333333]">
                                {['all', 'pending', 'paid', 'blocked', 'draft'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setStatusFilter(f)}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === f ? 'bg-white dark:bg-[#1a1a1a] shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-300'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white dark:bg-[#111111] rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden min-h-[500px]">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-[#333333]">
                                    <th className="px-10 py-6">Employee</th>
                                    <th className="px-6 py-6 font-center text-center">Bank Status</th>
                                    <th className="px-4 py-6 text-center">OT Hrs</th>
                                    <th className="px-6 py-6 text-right">Net Salary</th>
                                    <th className="px-6 py-6 text-center">Payment Status</th>
                                    <th className="px-10 py-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-[#333333]">
                                <AnimatePresence mode="popLayout">
                                    {processedData.length > 0 ? processedData.map((row) => {
                                        const bankMissing = !row.bankDetails?.accountNumber || !row.bankDetails?.ifscCode;
                                        return (
                                            <motion.tr 
                                                key={row.id}
                                                layout
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                                            >
                                                <td className="px-10 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm uppercase">
                                                            {row.employeeInfo?.name?.[0]}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900 dark:text-white leading-tight mb-1">{row.employeeInfo?.name}</p>
                                                            <p className="text-[11px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tight">{row.employeeInfo?.employeeId}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex justify-center">
                                                        {bankMissing ? (
                                                            <div className="flex flex-col items-center gap-1 group/tip relative">
                                                                <ShieldAlert size={20} className="text-amber-500" />
                                                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Missing Details</span>
                                                                <div className="absolute bottom-full mb-2 hidden group-hover/tip:block bg-slate-900 text-white text-[10px] py-2 px-3 rounded-xl w-48 text-center shadow-xl z-10 font-medium">
                                                                    Update bank details in Employee Profile to unblock payment.
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-1">
                                                                <ShieldCheck size={20} className="text-emerald-500" />
                                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Verified</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5 font-bold text-slate-600 dark:text-gray-400 text-center">
                                                    {row.attendance?.overtimeHours || 0}
                                                </td>
                                                <td className="px-6 py-5 text-right font-black text-slate-900 dark:text-white">
                                                    {currencySymbol}{formatCurrency(row.netPay)}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex justify-center">
                                                        {row.isPaid || row.payslip?.status === 'PAID' ? (
                                                            <span className="px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-500/20 flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid
                                                            </span>
                                                        ) : bankMissing ? (
                                                            <span className="px-4 py-1.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-500/20 flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" /> Blocked
                                                            </span>
                                                        ) : row.payslip ? (
                                                            <span className="px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-500/20 flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                                                            </span>
                                                        ) : (
                                                            <span className="px-4 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest border border-slate-100 dark:border-white/10 flex items-center gap-1.5">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-gray-600" /> Draft
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-5 text-right">
                                                    {!(row.isPaid || row.payslip?.status === 'PAID') && !bankMissing && row.payslip ? (
                                                        <button 
                                                            onClick={() => handleMarkPaid(row)}
                                                            className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all shadow-sm group/btn"
                                                            title="Mark as Paid"
                                                        >
                                                            <CheckCircle2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => navigate(`/employees/${row.employee?.userId}`)}
                                                            className="p-3 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-sm transition-all"
                                                            title="View Employee Profile"
                                                        >
                                                            <ExternalLink size={18} />
                                                        </button>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={5} className="py-32 text-center">
                                                <div className="max-w-xs mx-auto space-y-4 opacity-30">
                                                    <Search size={48} className="mx-auto" />
                                                    <p className="text-sm font-black uppercase tracking-widest">No matching records found</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* RHS Insights Panel */}
                <div className="space-y-8">
                    {/* Insights Card */}
                    <div className="bg-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden group">
                        {/* Decorative Gradient */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-indigo-500/30 transition-all duration-700" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 group-hover:bg-emerald-500/30 transition-all duration-700" />

                        <div className="relative z-10 space-y-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-inner group-hover:rotate-12 transition-transform">
                                    <Building2 size={20} className="text-indigo-300" />
                                </div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-white/50">Execution Readiness</h3>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Disbursement Progress</span>
                                        <span className="text-xs font-black text-emerald-400">{Math.round((kpis.paid / kpis.payable) * 100 || 0)}%</span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(kpis.paid / kpis.payable) * 100}%` }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-white/60">
                                                <ShieldAlert size={14} className={kpis.blockedCount > 0 ? "text-amber-500" : "text-white/20"} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Blocked Payments</span>
                                            </div>
                                            <span className={`text-sm font-black ${kpis.blockedCount > 0 ? "text-amber-400" : "text-white/20"}`}>{kpis.blockedCount}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-emerald-400">
                                                <ShieldCheck size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Ready to Pay</span>
                                            </div>
                                            <span className="text-sm font-black text-emerald-400">{kpis.total - kpis.blockedCount - (kpis.paidAt ? 1 : 0)} Users</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Operational Guard Card */}
                    <div className="bg-white dark:bg-[#111111] rounded-[40px] p-8 border border-slate-100 dark:border-[#333333] shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 dark:text-amber-400">
                                <Info size={20} />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">Next Steps</h3>
                        </div>
                        <ul className="space-y-4">
                            {[
                                { text: 'Finalize individual disbursements', done: false },
                                { text: 'Dispatch digital payslips', done: false }
                            ].map((step, i) => (
                                <li key={i} className="flex items-start gap-4 group cursor-pointer">
                                    <div className="w-5 h-5 rounded-full border-2 border-slate-100 dark:border-[#333333] flex-shrink-0 mt-0.5 group-hover:border-indigo-200 transition-colors" />
                                    <span className="text-xs font-bold text-slate-500 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{step.text}</span>
                                </li>
                            ))}
                        </ul>
                        <button 
                            onClick={() => navigate('/payroll/payslip')}
                            className="w-full py-4 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-4 border border-transparent hover:border-slate-200 dark:hover:border-[#333333]"
                        >
                            <FileText size={16} /> Manage Payslips <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ClockIcon = ({ size, className }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

export default PayrollExecution;
