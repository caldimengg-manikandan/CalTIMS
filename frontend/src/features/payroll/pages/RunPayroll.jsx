import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Play, CheckCircle2, AlertCircle, ChevronRight, Calculator, Check, X, 
    Users, DollarSign, Wallet, ShieldCheck, BarChart3, PieChart as PieChartIcon, 
    CheckSquare, RefreshCw, Clock, DownloadCloud, Activity, Send, 
    Calendar, ArrowRight, ArrowLeft, Loader2, Info, Lock, Receipt
} from 'lucide-react';
import { payrollAPI, settingsAPI } from '../../../services/endpoints';
import { formatCurrency, getCurrencySymbol } from '../../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';

const RunPayroll = () => {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    
    // Wizard State
    const [step, setStep] = useState(1);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [overtimeEnabled, setOvertimeEnabled] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Queries
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
    });
    const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

    const { data: readinessRes, isLoading: readinessLoading, refetch: refetchReadiness } = useQuery({
        queryKey: ['payrollReadiness', month, year],
        queryFn: () => payrollAPI.getReadiness({ month, year }).then(res => res.data.data),
        enabled: step >= 2
    });

    const { data: previewRes, isLoading: previewLoading, refetch: refetchPreview } = useQuery({
        queryKey: ['payrollPreview', month, year, overtimeEnabled],
        queryFn: () => payrollAPI.getPreview({ month, year, overtimeEnabled }).then(res => res.data.data),
        enabled: step >= 3
    });

    // Mutations
    const runMutation = useMutation({
        mutationFn: (data) => payrollAPI.run(data).then(res => res.data),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['payrollHistory'] });
            queryClient.invalidateQueries({ queryKey: ['payslipsList'] });
            queryClient.invalidateQueries({ queryKey: ['payrollDashboard'] });
            toast.success(res.message || 'Payroll processed successfully!');
            setStep(4); // Move to success step
        },
        onError: (err) => {
            toast.error(err.response?.data?.message || err.message);
            setIsProcessing(false);
        }
    });

    // Handlers
    const nextStep = () => {
        if (step === 1) setStep(2);
        if (step === 2) setStep(3);
    };

    const prevStep = () => setStep(step - 1);

    const handleExecute = () => {
        setIsProcessing(true);
        runMutation.mutate({ month, year, overtimeEnabled });
    };

    // UI Helpers
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const years = [2024, 2025, 2026];

    const stepVariants = {
        hidden: { opacity: 0, x: 20 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 }
    };

    return (
        <div className="p-10 max-w-[1200px] mx-auto space-y-12 min-h-[80vh] flex flex-col dark:text-gray-200">
            {/* Header / Stepper */}
            <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Payroll Engine</h1>
                        <p className="text-slate-500 dark:text-gray-400 font-medium text-sm">Guided workforce compensation processing</p>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-white/10 -translate-y-1/2 rounded-full" />
                    <motion.div 
                        className="absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: `${((step - 1) / 3) * 100}%` }}
                    />
                    <div className="relative flex justify-between">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex flex-col items-center gap-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-500 z-10 
                                    ${step >= s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-white dark:bg-[#1a1a1a] text-slate-400 border-2 border-slate-100 dark:border-[#333333] shadow-sm'}`}>
                                    {step > s ? <Check size={18} /> : s}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${step >= s ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-gray-600'}`}>
                                    {s === 1 && 'Period'}
                                    {s === 2 && 'Readiness'}
                                    {s === 3 && 'Preview'}
                                    {s === 4 && 'Execute'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div key="step1" variants={stepVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
                            <div className="bg-white dark:bg-[#111111] p-12 rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-subtle text-center space-y-10">
                                <div className="max-w-md mx-auto space-y-4">
                                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto mb-6">
                                        <Calendar size={32} />
                                    </div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Select Payroll Period</h2>
                                    <p className="text-slate-500 dark:text-gray-400 font-medium">Choose the month and year you wish to process payroll for.</p>
                                </div>

                                <div className="flex flex-col md:flex-row justify-center items-center gap-6">
                                    <div className="w-full md:w-64 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">Salary Month</label>
                                        <select 
                                            value={month} 
                                            onChange={(e) => setMonth(parseInt(e.target.value))}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-100 dark:border-[#333333] rounded-2xl text-base font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                                        >
                                            {months.map((m, i) => (
                                                <option key={i} value={i + 1} className="dark:bg-[#111111]">{m}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-full md:w-48 space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest ml-1">Salary Year</label>
                                        <select 
                                            value={year} 
                                            onChange={(e) => setYear(parseInt(e.target.value))}
                                            className="w-full px-6 py-4 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-100 dark:border-[#333333] rounded-2xl text-base font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer"
                                        >
                                            {years.map((y) => (
                                                <option key={y} value={y} className="dark:bg-[#111111]">{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-8">
                                    <button 
                                        onClick={nextStep}
                                        className="px-10 py-5 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-3xl text-lg font-black transition-all shadow-xl shadow-indigo-200 dark:shadow-none flex items-center gap-3 mx-auto group"
                                    >
                                        Continue to Readiness <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div key="step2" variants={stepVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">System Readiness Check</h2>
                                    <p className="text-slate-500 dark:text-gray-400 font-medium">Auto-verifying employee profiles and bank details...</p>
                                </div>
                                <button onClick={refetchReadiness} className="p-3 bg-white dark:bg-[#111111] border border-slate-100 dark:border-[#333333] rounded-xl text-slate-400 hover:text-indigo-600 shadow-sm transition-all">
                                    <RefreshCw size={20} className={readinessLoading ? 'animate-spin' : ''} />
                                </button>
                            </div>

                            {readinessLoading ? (
                                <div className="bg-white dark:bg-[#111111] p-20 rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-subtle flex flex-col items-center justify-center space-y-6">
                                    <Loader2 size={48} className="text-indigo-600 animate-spin" />
                                    <p className="text-slate-500 dark:text-gray-400 font-black uppercase tracking-widest text-xs">Simulating Lifecycle Nodes...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    <div className="bg-white dark:bg-[#111111] p-8 rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-subtle space-y-6 hover:-translate-y-1 transition-all border-b-8 border-b-emerald-500">
                                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center">
                                            <CheckCircle2 size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-3xl font-black text-slate-800 dark:text-white">{readinessRes?.summary.readyCount}</h4>
                                            <p className="text-[11px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">Ready Employees</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Fully configured and validated for processing.</p>
                                    </div>

                                    <div className="bg-white dark:bg-[#111111] p-8 rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-subtle space-y-6 hover:-translate-y-1 transition-all border-b-8 border-b-amber-500">
                                        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center">
                                            <Users size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-3xl font-black text-slate-800 dark:text-white">{readinessRes?.summary.missingProfileCount}</h4>
                                            <p className="text-[11px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">Missing Profiles</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">These employees will be automatically skipped.</p>
                                    </div>

                                    <div className="bg-white dark:bg-[#111111] p-8 rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-subtle space-y-6 hover:-translate-y-1 transition-all border-b-8 border-b-rose-500">
                                        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center">
                                            <ShieldAlert size={24} />
                                        </div>
                                        <div>
                                            <h4 className="text-3xl font-black text-slate-800 dark:text-white">{readinessRes?.summary.missingBankCount}</h4>
                                            <p className="text-[11px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">Missing Bank Details</p>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Critical for disbursement. Will be skipped.</p>
                                    </div>
                                </div>
                            )}

                            {!readinessLoading && (
                                <div className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-500/10 p-6 rounded-[32px] border border-indigo-100 dark:border-indigo-500/20">
                                    <div className="flex items-center gap-3 text-indigo-700 dark:text-indigo-400">
                                        <Info size={20} />
                                        <span className="text-sm font-bold">Only {readinessRes?.summary.readyCount} employees meet the criteria for selection.</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <button onClick={prevStep} className="px-6 py-3 text-slate-500 dark:text-gray-400 font-bold hover:text-slate-700 dark:hover:text-white transition-colors">Back</button>
                                        <button 
                                            disabled={readinessRes?.summary.readyCount === 0}
                                            onClick={nextStep} 
                                            className="px-8 py-4 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 dark:shadow-none disabled:opacity-50"
                                        >
                                            Generate Preview
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div key="step3" variants={stepVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Preview Payroll</h2>
                                    <p className="text-slate-500 dark:text-gray-400 font-medium">Aggregated calculation for valid employees.</p>
                                </div>
                                <div className="flex items-center gap-6">
                                    {/* Overtime Toggle */}
                                    <div className="flex items-center gap-4 bg-white dark:bg-[#111111] px-5 py-2.5 rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black uppercase text-slate-400 leading-none mb-1">Overtime</span>
                                            <span className={`text-[11px] font-black uppercase leading-none ${overtimeEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-gray-600'}`}>
                                                {overtimeEnabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={() => setOvertimeEnabled(!overtimeEnabled)}
                                            className={`w-10 h-5 rounded-full transition-all relative ${overtimeEnabled ? 'bg-indigo-600 dark:bg-indigo-500 shadow-lg shadow-indigo-100 dark:shadow-none' : 'bg-slate-200 dark:bg-white/10'}`}
                                        >
                                            <motion.div 
                                                layout
                                                className="absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm"
                                                animate={{ x: overtimeEnabled ? 20 : 0 }}
                                            />
                                        </button>
                                    </div>

                                    <div className="flex gap-3">
                                    <button onClick={prevStep} className="px-6 py-3 border border-slate-200 dark:border-[#333333] rounded-xl text-slate-600 dark:text-gray-400 font-bold hover:bg-slate-50 dark:hover:bg-[#1a1a1a]">Back</button>
                                    <button 
                                        onClick={handleExecute}
                                        disabled={isProcessing}
                                        className="px-8 py-3 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-xl font-black flex items-center gap-2 shadow-lg shadow-emerald-100 dark:shadow-none disabled:opacity-50"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                                        Run Payroll
                                    </button>
                                </div>
                            </div>
                        </div>

                            {previewLoading ? (
                                <div className="bg-white dark:bg-[#111111] p-20 rounded-[40px] border border-slate-100 dark:border-[#333333] shadow-subtle flex flex-col items-center justify-center space-y-6 text-center">
                                    <Activity size={48} className="text-indigo-600 animate-pulse" />
                                    <div className="space-y-2">
                                        <p className="text-slate-900 dark:text-white font-black text-xl">Aggregating Financial Metrics</p>
                                        <p className="text-slate-400 dark:text-gray-500 text-sm font-medium">Calculating gross, deductions, and net tax implications...</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Aggregate Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        {[
                                            { label: 'Employees', value: previewRes?.summary.totalEmployees, color: 'text-slate-900 dark:text-white', bg: 'bg-slate-50 dark:bg-white/5' },
                                            { label: 'Total Earnings', value: `${currencySymbol}${formatCurrency(previewRes?.summary.totalGross)}`, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                                            { label: 'Total Deductions', value: `-${currencySymbol}${formatCurrency(previewRes?.summary.totalDeductions)}`, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10' },
                                            { label: 'Net Payout', value: `${currencySymbol}${formatCurrency(previewRes?.summary.totalNetPay)}`, color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                                        ].map((card, idx) => (
                                            <div key={idx} className={`${card.bg} p-6 rounded-[32px] border border-white dark:border-[#1a1a1a] shadow-sm flex flex-col gap-1`}>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-gray-500">{card.label}</span>
                                                <span className={`text-2xl font-black ${card.color} tracking-tight`}>{card.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Breakdown Table */}
                                    <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-slate-100 dark:border-[#333333] shadow-subtle overflow-hidden">
                                        <div className="p-6 border-b border-slate-50">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Employee Breakdown</h3>
                                        </div>
                                        <div className="overflow-x-auto max-h-[400px]">
                                            <table className="w-full text-left">
                                                <thead className="sticky top-0 bg-white z-10">
                                                    <tr className="bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                        <th className="px-8 py-4">Employee</th>
                                                        <th className="px-2 py-4 text-center">Total Days</th>
                                                        <th className="px-2 py-4 text-center">Adj. Working</th>
                                                        <th className="px-2 py-4 text-center">Present</th>
                                                        <th className="px-2 py-4 text-center">LOP</th>
                                                        <th className="px-4 py-4 text-center">OT Hrs</th>
                                                        <th className="px-6 py-4 text-right">Adjusted Gross</th>
                                                        <th className="px-8 py-4 text-right text-indigo-600 font-bold">Final Net</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-[#333333] text-[11px]">
                                                    {previewRes?.breakdown.map((row, i) => (
                                                        <tr key={i} className={`hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors ${row.status === 'ERROR' ? 'bg-rose-50/30' : ''}`}>
                                                            <td className="px-8 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-[10px] uppercase shadow-sm ${row.status === 'ERROR' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'}`}>
                                                                        {row.name[0]}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[11px] font-black text-slate-800 dark:text-white leading-tight">{row.name}</p>
                                                                        <p className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase leading-tight">{row.employeeId}</p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            {row.status === 'ERROR' ? (
                                                                <td colSpan={8} className="px-8 py-4 text-rose-500 font-bold italic text-center">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        <AlertCircle size={14} />
                                                                        Calculation Failed: {row.error || 'Unknown Error'}
                                                                    </div>
                                                                </td>
                                                            ) : (
                                                                <>
                                                                    <td className="px-2 py-4 text-center font-bold text-slate-500 dark:text-gray-400">{row.totalOrgWorkingDays || 0}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">{row.working || 0}</td>
                                                                    <td className="px-2 py-4 text-center font-black text-emerald-600 dark:text-emerald-400">{row.present || 0}</td>
                                                                    <td className="px-2 py-4 text-center font-bold text-rose-500 dark:text-rose-400">{row.lop || 0}</td>
                                                                    <td className="px-4 py-4 text-center font-bold text-slate-600 dark:text-gray-400">{row.overtimeHours || 0}</td>
                                                                    <td className="px-6 py-4 text-right font-bold text-slate-600 dark:text-gray-400">{currencySymbol}{formatCurrency(row.adjustedGross || 0)}</td>
                                                                    <td className="px-8 py-4 text-right text-sm font-black text-slate-900 dark:text-white border-l border-slate-50 dark:border-white/5 bg-slate-50/30 dark:bg-white/5">{currencySymbol}{formatCurrency(row.net || 0)}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    ))}

                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div key="step4" variants={stepVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col items-center justify-center py-20 space-y-10">
                            <div className="relative">
                                <motion.div 
                                    initial={{ scale: 0 }} 
                                    animate={{ scale: 1 }} 
                                    transition={{ type: 'spring', damping: 10, stiffness: 100 }}
                                    className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-200"
                                >
                                    <Check size={64} strokeWidth={4} />
                                </motion.div>
                                <motion.div 
                                    className="absolute -top-4 -right-4 w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl"
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ repeat: Infinity, duration: 2 }}
                                >
                                    <DollarSign size={24} />
                                </motion.div>
                            </div>

                            <div className="text-center space-y-4 max-w-md">
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Payroll Executed!</h2>
                                <p className="text-slate-500 dark:text-gray-400 font-medium">Workforce compensation for {months[month-1]} {year} has been committed to the ledger successfully.</p>
                            </div>

                            <div className="flex flex-wrap justify-center gap-4">
                                <button onClick={() => navigate('/payroll/dashboard')} className="px-8 py-4 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-gray-300 rounded-2xl font-black transition-all hover:bg-slate-100 dark:hover:bg-white/10">
                                    Dashboard
                                </button>
                                <button 
                                    onClick={() => navigate('/payroll/payslip')} 
                                    className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-black transition-all hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2"
                                >
                                    <Receipt size={20} /> Generate Payslips
                                </button>
                                <button onClick={() => navigate(`/payroll/execution/${year}/${month}`)} className="px-8 py-4 bg-white dark:bg-transparent border border-slate-200 dark:border-[#333333] text-slate-900 dark:text-white rounded-2xl font-black transition-all hover:bg-slate-50 dark:hover:bg-white/5">
                                    View Ledger
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Static Info */}
            {step < 4 && (
                <div className="pt-10 flex items-center justify-center gap-10 opacity-40">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Secure Trace</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Lock size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Encrypted Snapshot</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <BarChart3 size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audit Compliant</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const ShieldAlert = ({ size, className }) => (
    <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

export default RunPayroll;
