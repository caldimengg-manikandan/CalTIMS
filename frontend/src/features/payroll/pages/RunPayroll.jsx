import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Lock, CheckCircle2, AlertCircle, Search, ChevronRight, Calculator, Check, X, Users, DollarSign, Wallet, ShieldCheck, BarChart3, PieChart as PieChartIcon, CheckSquare, RefreshCw, TrendingUp, TrendingDown, Clock, DownloadCloud, Activity, Send, ShieldAlert } from 'lucide-react';
import { payrollAPI, settingsAPI, payslipTemplateAPI } from '../../../services/endpoints';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { formatCurrency } from '../../../utils/formatters';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { toast } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import Spinner from '@/components/ui/Spinner';
import StatementPreview from '../components/StatementPreview';
import { exportToPdf } from '@/utils/pdfExport';

import { useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';

const COLORS = ['#4f46e5', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6'];


const RunPayroll = () => {
    const { user: currentUser } = useAuthStore();
    const { payslipDesign, fetchPayslipDesign } = useSettingsStore();
    const userRole = currentUser?.role?.toLowerCase();
    const isAdmin = userRole === 'admin';
    const isHR = userRole === 'hr';
    const isFinance = userRole === 'finance';

    const queryClient = useQueryClient();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
    });
    const currencySymbol = settings?.payroll?.currencySymbol || '₹';
    const currentDate = new Date();
    const [month, setMonth] = useState(parseInt(queryParams.get('month')) || currentDate.getMonth() + 1);
    const [year, setYear] = useState(parseInt(queryParams.get('year')) || currentDate.getFullYear());

    useEffect(() => {
        if (!payslipDesign) fetchPayslipDesign();
    }, []);
    
    // Filters
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('All');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterLop, setFilterLop] = useState(false);
    
    // Actions & Selection
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRows, setSelectedRows] = useState(new Set());
    const [downloadingId, setDownloadingId] = useState(null);
    
    // UX Simulation Map
    const [isSimulating, setIsSimulating] = useState(false);
    const [simProgress, setSimProgress] = useState(0);
    const [showOverrideModal, setShowOverrideModal] = useState(false);

    const { data: dashboardRes, isLoading: dashboardLoading } = useQuery({
        queryKey: ['payrollDashboard', month, year],
        queryFn: () => payrollAPI.getDashboard({ month, year }).then(res => res.data),
    });

    const { data: historyRes, isLoading } = useQuery({
        queryKey: ['payrollHistory', month, year],
        queryFn: () => payrollAPI.getHistory({ month, year }).then(res => res.data),
    });

    const historyData = historyRes?.data || [];
    const batch = dashboardRes?.batch || null;
    const isPaid = batch?.isPaid || false;
    const currentStatus = isPaid ? 'Paid' : (historyData.length > 0 ? 'Calculated' : 'Draft');
    
    // Derivations & Status
    const hasData = historyData.length > 0;
    const isLocked = isPaid; // After payment, it's effectively locked
    
    const departments = ['All', ...new Set(historyData.map(d => d.employeeInfo?.department || d.user?.department).filter(Boolean))];
    const statuses = ['All', 'Paid', 'Unpaid'];

    // Primary Analytics
    const totalGross = historyData.reduce((acc, curr) => acc + (curr.grossYield || 0), 0);
    const totalDeductions = historyData.reduce((acc, curr) => acc + (curr.liability || 0), 0);
    const totalNetPay = historyData.reduce((acc, curr) => acc + (curr.breakdown?.netPay || 0), 0);
    
    // Advanced Analytics
    const totalLopDays = historyData.reduce((acc, curr) => acc + (curr.attendance?.lopDays || 0), 0);
    const avgSalary = historyData.length > 0 ? totalNetPay / historyData.length : 0;
    const netPays = historyData.map(d => d.breakdown?.netPay || 0).filter(n => n > 0);
    const highestPaid = netPays.length > 0 ? Math.max(...netPays) : 0;
    const lowestPaid = netPays.length > 0 ? Math.min(...netPays) : 0;
    const failedCount = historyData.filter(d => (d.breakdown?.executionLog || []).some(log => log.error)).length;

    // Chart Computations
    const deptCostData = useMemo(() => {
        const acc = {};
        historyData.forEach(d => {
            const dept = d.user?.department || d.user?.departmentName || 'Unassigned';
            acc[dept] = (acc[dept] || 0) + (d.breakdown?.netPay || 0);
        });
        return Object.entries(acc).map(([name, cost]) => ({ name, cost: Math.round(cost) }));
    }, [historyData]);

    const pieData = [
        { name: 'Total Dispersal (Net)', value: Math.round(totalNetPay) },
        { name: 'Tax & Statutory (Deductions)', value: Math.round(totalDeductions) }
    ];

    // Dummy Trend (last 6 months placeholder mapped to current values arbitrarily)
    const trendData = useMemo(() => {
        const base = totalGross || 500000;
        return Array.from({length: 6}).map((_, i) => {
            const date = new Date(year, month - 6 + i, 1);
            return {
                name: date.toLocaleString('default', { month: 'short' }),
                cost: Math.round(base * (0.8 + (Math.random() * 0.4))) // simulated ±20% fluctuation
            };
        });
    }, [month, year, totalGross]);

    // Graph Filters
    const filteredData = useMemo(() => {
        return historyData.filter(d => {
            const matchesSearch = !search || 
                d.user?.name?.toLowerCase().includes(search.toLowerCase()) || 
                d.user?.employeeId?.toLowerCase().includes(search.toLowerCase());
            const matchesDept = filterDept === 'All' || d.user?.department === filterDept;
            const matchesStatus = filterStatus === 'All' || 
                (filterStatus === 'Paid' ? d.isPaid : !d.isPaid);
            const matchesLop = !filterLop || (d.attendance?.lopDays > 0);
            return matchesSearch && matchesDept && matchesStatus && matchesLop;
        });
    }, [historyData, search, filterDept, filterStatus, filterLop]);

    // Handle Selection Checkboxes
    const toggleRow = (id) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    const toggleAll = () => {
        if (selectedRows.size === filteredData.length) setSelectedRows(new Set());
        else setSelectedRows(new Set(filteredData.map(d => d._id)));
    };

    // APIs
    const runMutation = useMutation({
        mutationFn: (data) => payrollAPI.run(data).then(res => res.data),
        onSuccess: (res) => {
            const stats = res.data || res;
            // Explicitly invalidating all relevant payroll data to ensure UI sync
            queryClient.invalidateQueries({ queryKey: ['payrollHistory'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['payrollDashboard'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['payrollBatches'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['payrollAnalytics'], exact: false });
            queryClient.invalidateQueries({ queryKey: ['executionLedger'], exact: false }); // Enforcing as per enterprise robustness requirements

            const count = stats.total ?? stats.totalEmployeesProcessed ?? stats.successCount ?? 0;
            toast.success(res.message || `Payroll processed for ${count} employees successfully!`);
        },
        onError: (err) => toast.error(err.response?.data?.message || err.message)
    });


    const markPaidMutation = useMutation({
        mutationFn: (params) => payrollAPI.markPaid({ month, year, ...params }),
        onSuccess: (res) => {
             queryClient.invalidateQueries({ queryKey: ['payrollHistory'] });
             queryClient.invalidateQueries({ queryKey: ['payrollDashboard'] });
             toast.success("Disbursement confirmed! Payroll status: PAID");
        },
        onError: (err) => toast.error(err.response?.data?.message || err.message)
    });


    // Template Selection
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [templates, setTemplates] = useState([]);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await payslipTemplateAPI.getAll();
                if (res.data.success) {
                    setTemplates(res.data.data);
                    const def = res.data.data.find(t => t.isDefault);
                    if (def) setSelectedTemplateId(def._id);
                }
            } catch (err) {
                console.error('Failed to load templates');
            }
        };
        fetchTemplates();
    }, []);

    // UX progress
    const handleRunUX = () => {
        setIsSimulating(true);
        setSimProgress(0);
        let current = 0;
        const interval = setInterval(() => {
            current += 15;
            if (current >= 100) {
                current = 100;
                clearInterval(interval);
                runMutation.mutate({ 
                    month, 
                    year, 
                    payslipTemplateId: selectedTemplateId || payslipDesign?.templateId 
                }, {
                    onSettled: () => setTimeout(() => setIsSimulating(false), 500)
                });
            }
            setSimProgress(current);
        }, 300);
    };

    // Bulk download mockup
    const handleDownloadPayslips = () => {
        if (selectedRows.size === 0) return toast.error("Select employees first!");
        toast.success(`Downloading ${selectedRows.size} payslips securely...`);
    }    // Single PDF Download (Backend Powered)
    const handleDownloadPayslip = async (id) => {
        const toastId = toast.loading('Generating Secure PDF...');
        try {
            const res = await payrollAPI.downloadPayslip(id);
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const record = historyData.find(p => p._id === id);
            link.setAttribute('download', `Payslip-${record?.user?.employeeId || 'Export'}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Downloaded successfully', { id: toastId });
        } catch (err) {
            toast.error('Download failed', { id: toastId });
        }
    };
        // Readiness Calculation
    const readiness = useMemo(() => {
        const total = historyData.length || 0;
        const issues = [];
        let readyCount = 0;

        historyData.forEach(h => {
            const empIssues = [];
            if (!h.user?.accountNumber) empIssues.push('Missing Bank Account');
            if (h.status === 'Failed' || (h.breakdown?.executionLog || []).some(log => log.error)) empIssues.push('Engine Trace Fault');
            
            if (empIssues.length > 0) {
                issues.push({ id: h._id, name: h.user?.name, issues: empIssues });
            } else {
                readyCount++;
            }
        });

        return { total, readyCount, issues };
    }, [historyData]);

    return (
        <div className="p-10 max-w-[1600px] mx-auto space-y-10">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-white dark:bg-slate-800 p-8 rounded-[32px] border border-slate-200/60 dark:border-white/5 shadow-subtle overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform pointer-events-none">
                    <ShieldCheck size={140} />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="w-14 h-14 bg-indigo-600 dark:bg-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                        <ShieldCheck size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-slate-900 dark:text-gray-100 tracking-tight">Enterprise Payroll Console</h1>
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all 
                                ${isPaid ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20'}`}>
                                {isPaid ? 'Ledger Finalized' : (hasData ? (historyData.some(h => (h.breakdown?.executionLog || []).some(log => log.error)) ? 'Anomalies Detected' : 'Calculation complete') : 'Ready for Trace')}
                            </span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                            <Clock size={12} className="text-slate-300 dark:text-slate-600" /> {new Date(0, month-1).toLocaleString('default', { month: 'long' })} {year} Cycle Trace
                        </p>
                    </div>
                </div>

                <div className="relative z-10 flex flex-wrap gap-4 items-center w-full md:w-auto">
                    {!isLocked && (
                        <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1.5 rounded-xl border border-slate-200/50 dark:border-white/5 items-center">
                            <select value={month} onChange={e => setMonth(Number(e.target.value))} className="bg-transparent px-3 py-1.5 text-[10px] font-black text-slate-600 dark:text-slate-400 outline-none cursor-pointer uppercase tracking-widest">
                                {Array.from({ length: 12 }).map((_, i) => (
                                    <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                                ))}
                            </select>
                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1" />
                            <select value={year} onChange={e => setYear(Number(e.target.value))} className="bg-transparent px-3 py-1.5 text-[10px] font-black text-slate-600 dark:text-slate-400 outline-none cursor-pointer uppercase tracking-widest">
                                {[currentDate.getFullYear()-1, currentDate.getFullYear(), currentDate.getFullYear()+1].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>


            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
               {[
                  { label: 'Active Nodes', value: readiness.total, icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                  { label: 'Verified Readiness', value: readiness.readyCount, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                  { label: 'System Anomalies', value: readiness.issues.length, icon: AlertCircle, color: readiness.issues.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500', bg: readiness.issues.length > 0 ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-slate-50 dark:bg-slate-800/50', urgent: readiness.issues.length > 0 },
                  { label: 'LOP Deviation', value: totalLopDays.toFixed(1), icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
                  { label: 'Lifecycle Cost', value: `${currencySymbol}${formatCurrency(totalNetPay)}`, icon: Wallet, color: 'text-slate-900 dark:text-gray-100', bg: 'bg-slate-50 dark:bg-white/5' },
               ].map((kpi, i) => (
                  <div key={i} className={`bg-white dark:bg-slate-800 p-6 rounded-[32px] border ${kpi.urgent ? 'border-rose-200/60 dark:border-rose-500/30' : 'border-slate-200/60 dark:border-white/5'} shadow-subtle flex items-center gap-5 hover:-translate-y-1 transition-all group`}>
                     <div className={`w-14 h-14 flex items-center justify-center rounded-2xl ${kpi.bg} ${kpi.color} transition-all group-hover:scale-110`}>
                        <kpi.icon size={22} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                        <h4 className="text-xl font-black text-slate-900 dark:text-gray-100 tracking-tight">{kpi.value}</h4>
                     </div>
                  </div>
               ))}
            </div>

            {/* Execution Progress */}
            <AnimatePresence>
                {isSimulating && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} 
                        className="bg-indigo-600 dark:bg-indigo-500 p-8 rounded-[32px] text-white shadow-2xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                            <Activity size={140} className="animate-pulse" />
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">Processing Topological Trace</h3>
                                    <p className="text-indigo-100 dark:text-indigo-100 text-[10px] font-bold uppercase tracking-widest mt-2">{simProgress}% Resolved — Running sandboxed mathematical resolution</p>
                                </div>
                                <span className="text-5xl font-black opacity-30 tracking-tighter">{simProgress}%</span>
                            </div>
                            <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden border border-white/10 p-0.5">
                                <motion.div className="h-full bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)]" initial={{ width: 0 }} animate={{ width: `${simProgress}%` }} transition={{ ease: 'linear' }} />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {hasData && !isLoading && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                    <div className="xl:col-span-2 space-y-10">
                        {/* Alerts Box */}
                        {readiness.issues.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-rose-200/60 dark:border-rose-500/20 shadow-subtle overflow-hidden">
                                <div className="p-6 border-b border-rose-50 dark:border-rose-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center">
                                            <AlertCircle size={20} />
                                        </div>
                                        <h3 className="text-[10px] font-black text-slate-900 dark:text-gray-100 uppercase tracking-[0.2em]">Pending Discrepancies</h3>
                                    </div>
                                    <span className="px-3 py-1 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-100 dark:border-rose-500/20">{readiness.issues.length} Critical Flagged</span>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {readiness.issues.slice(0, 4).map((issue, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-white/5 group hover:border-rose-200 dark:hover:border-rose-500/30 transition-all cursor-pointer">
                                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-rose-500 shadow-sm border border-slate-100 dark:border-white/5">
                                                {issue.name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-black text-slate-800 dark:text-gray-200 truncate">{issue.name}</p>
                                                <p className="text-[9px] font-bold text-rose-400 uppercase tracking-[0.1em] truncate">{issue.issues[0]}</p>
                                            </div>
                                            <ChevronRight size={14} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* State-Driven CTA Panel */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-sm">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                                <div className="flex items-center gap-4">
                                    <div className={`p-4 rounded-2xl ${
                                        currentStatus === 'Draft' ? 'bg-amber-50 text-amber-600' :
                                        currentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-indigo-50 text-indigo-600'
                                    }`}>
                                        <Activity size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-gray-100">Lifecycle Action Required</h3>
                                        <p className="text-sm text-slate-500 font-medium">Current Status: <span className="text-indigo-600 font-bold uppercase">{currentStatus}</span></p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {(isAdmin || isHR) && (
                                        <button 
                                            onClick={handleRunUX}
                                            disabled={isSimulating}
                                            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-base font-black transition-all shadow-xl shadow-indigo-200 disabled:opacity-50">
                                            <Play size={20} fill="currentColor" /> {hasData ? 'RE-CALCULATE WORKFORCE COMPUTE' : 'EXECUTE WORKFORCE COMPUTE'}
                                        </button>
                                    )}

                                    {!isPaid && hasData && isAdmin && (
                                        <button 
                                            onClick={() => readiness.issues.length > 0 ? setShowOverrideModal(true) : markPaidMutation.mutate({ month, year })}
                                            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-base font-black transition-all shadow-xl shadow-emerald-200"
                                        >
                                            <Wallet size={20} /> MARK AS PAID
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Smart Data Controls */}
                        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-subtle border border-slate-200/60 dark:border-white/5 p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                                <div className="relative w-full md:w-72 group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Ledger Index..." 
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-gray-200 rounded-2xl border border-slate-200/60 dark:border-white/5 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                                </div>
                                <div className="flex gap-2">
                                    <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest outline-none border border-slate-200/60 dark:border-white/5 cursor-pointer text-slate-600 dark:text-slate-400">
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-2xl text-[9px] font-black uppercase tracking-widest outline-none border border-slate-200/60 dark:border-white/5 cursor-pointer text-slate-600 dark:text-slate-400">
                                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 w-full md:w-auto">
                                <button onClick={handleDownloadPayslips} className="flex-1 md:flex-none px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all shadow-xl shadow-slate-200 dark:shadow-none">
                                    <DownloadCloud size={16}/> Export Ledger
                                </button>
                            </div>
                        </div>

                        {/* Data Matrix */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-white/2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                                            <th className="px-8 py-5">Employee</th>
                                            <th className="px-6 py-5">Department</th>
                                            <th className="px-6 py-5 text-right">Gross Salary</th>
                                            <th className="px-6 py-5 text-right">Deductions</th>
                                            <th className="px-6 py-5 text-right">Net Salary</th>
                                            <th className="px-8 py-5 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                        {filteredData.map((d, i) => {
                                            const hasError = d.status === 'Failed' || (d.breakdown?.executionLog || []).some(log => log.error);
                                            return (
                                                <tr key={i} onClick={() => setSelectedUser(d)} className="group hover:bg-slate-50 dark:hover:bg-white/2 transition-all cursor-pointer">
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-xs font-black text-indigo-600 uppercase">
                                                                {d.employeeInfo?.name[0] || d.user?.name[0] || 'E'}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black text-slate-800 dark:text-gray-100 group-hover:text-indigo-600 transition-colors leading-none mb-1">{d.employeeInfo?.name || d.user?.name}</p>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{d.employeeInfo?.employeeId || d.user?.employeeId}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase">
                                                        {d.employeeInfo?.department || d.user?.department || 'General'}
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-black text-slate-800 dark:text-gray-300">
                                                        ₹{formatCurrency(d.grossYield ?? 0)}
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-black text-rose-500">
                                                        -₹{formatCurrency(d.liability ?? 0)}
                                                    </td>
                                                    <td className="px-6 py-5 text-right font-black text-indigo-600 dark:text-indigo-400 text-lg">
                                                        ₹{formatCurrency(d.netPay ?? 0)}
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 
                                                            ${d.isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                            <div className={`w-1.5 h-1.5 rounded-full ${d.isPaid ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                                            {d.isPaid ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                        {hasError && (
                                                            <div className="mt-1 text-[8px] font-black text-rose-500 uppercase">Engine Fault</div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Cost Preview Sidebar */}
                    <div className="space-y-10">
                        <div className="bg-slate-900 p-8 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                <BarChart3 size={120} />
                           </div>
                           <div className="relative z-10 space-y-10">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Grand Total Payout</h3>
                                    <h2 className="text-5xl font-black mt-2 tracking-tighter">₹{formatCurrency(totalNetPay)}</h2>
                                </div>
                                
                                <div className="space-y-6 pt-10 border-t border-white/10">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Payout</span>
                                        <span className="text-xl font-black text-emerald-400">₹{formatCurrency(totalGross)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Total Deductions</span>
                                        <span className="text-xl font-black text-rose-400">-₹{formatCurrency(totalDeductions)}</span>
                                    </div>
                                    <div className="pt-6 flex justify-between items-center border-t border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                                        <span>Average Net Salary</span>
                                        <span className="text-white">₹{formatCurrency(Math.round(avgSalary))}</span>
                                    </div>
                                </div>

                                <div className="pt-4 flex flex-col gap-3">
                                   <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Execution Progress</span>
                                            <span className="text-[10px] font-black text-indigo-400">{readiness.readyCount}/{readiness.total} READY</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(readiness.readyCount/readiness.total)*100}%` }} />
                                        </div>
                                   </div>
                                </div>
                           </div>
                        </div>

                        {/* Department Distribution (Simplified for Sidebar) */}
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-[40px] border border-slate-100 dark:border-white/5 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
                                <PieChartIcon size={14} /> Department Cost Distribution
                            </h3>
                            <div className="space-y-6">
                                {deptCostData.slice(0, 5).map((dept, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-900 dark:text-gray-100">{dept.name}</span>
                                            <span className="text-slate-400">₹{formatCurrency(dept.cost)}</span>
                                        </div>
                                        <div className="h-1 w-full bg-slate-50 dark:bg-slate-900 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-600 rounded-full opacity-40" style={{ width: `${(dept.cost/totalGross)*100}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Side Drawer: Employee Engine Log */}
            <AnimatePresence>
                {selectedUser && (
                    <>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40" onClick={() => setSelectedUser(null)} />
                    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                        className="fixed right-0 top-0 h-screen w-full md:w-[600px] bg-white dark:bg-slate-900 z-50 shadow-2xl overflow-y-auto border-l border-gray-100 dark:border-white/10 flex flex-col">
                        
                        <div className="p-6 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-white/2 sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold  ">{selectedUser.user?.name}</h2>
                                <p className="text-sm text-gray-500 font-medium">Engine Trace • {new Date(0, month-1).toLocaleString('default',{month:'long'})} {year}</p>
                            </div>
                            <div className="flex gap-3 items-center">
                                <button onClick={() => setSelectedUser(null)} className="p-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 transition-colors rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-8 flex-1 bg-white dark:bg-slate-900">
                            <div className="grid grid-cols-2 gap-4">
                               <div className="bg-indigo-50 dark:bg-indigo-500/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider">Gross Component Build</p>
                                    <p className="text-3xl font-black text-indigo-700 dark:text-indigo-400 mt-1">₹{formatCurrency(selectedUser.breakdown?.grossEarnings || 0)}</p>
                               </div>
                               <div className="bg-rose-50 dark:bg-rose-500/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-500/20">
                                    <p className="text-xs font-bold text-rose-500 uppercase tracking-wider">Deduction Accumulation</p>
                                    <p className="text-3xl font-black text-rose-700 dark:text-rose-400 mt-1">₹{formatCurrency(selectedUser.breakdown?.totalDeductions || 0)}</p>
                               </div>
                            </div>

                            {/* Execution Engine DAG Status */}
                            <div>
                                <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest mb-4 border-b border-gray-200 dark:border-white/10 pb-3 flex items-center justify-between">
                                    <span>Topological Execution Ledger</span>
                                    <span className="text-gray-400 text-xs font-semibold bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md">{selectedUser.breakdown?.executionLog?.length || 0} Steps</span>
                                </h3>
                                <div className="space-y-4">
                                    {selectedUser.breakdown?.executionLog?.map((log, i) => (
                                        <div key={i} className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border flex flex-col gap-3 relative shadow-sm transition-colors
                                            ${log.error ? 'border-red-300 bg-red-50/50' : 'border-gray-100 dark:border-white/5 hover:border-gray-200'}`}>
                                            
                                            {/* Status Badge */}
                                            {log.error ? (
                                                <div className="absolute right-4 top-4 text-red-500 bg-red-100 p-1.5 rounded-full"><X size={14} strokeWidth={3}/></div>
                                            ) : (
                                                <div className="absolute right-4 top-4 text-emerald-500 bg-emerald-100 p-1.5 rounded-full"><Check size={14} strokeWidth={3}/></div>
                                            )}

                                            <div className="flex gap-3 items-center">
                                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${log.type === 'Earning' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>{log.type}</span>
                                                <span className="font-bold text-base  ">{log.component}</span>
                                            </div>
                                            
                                            <div className="bg-gray-50 dark:bg-slate-900 p-3 rounded-xl border border-gray-100 dark:border-white/5 text-xs font-mono text-gray-600 flex flex-col gap-1 overflow-x-auto shadow-inner">
                                                <div className="flex gap-2">
                                                    <span className="text-slate-400 w-16 whitespace-nowrap font-bold">Formula:</span> 
                                                    <span className="text-gray-900 dark:text-white font-medium">{log.formula}</span>
                                                </div>
                                            </div>
                                            
                                            {log.error && (
                                                <div className="bg-red-100/50 p-3 border-l-4 border-red-500 text-sm text-red-700 font-mono mt-1 rounded-r-xl">
                                                    <span className="font-bold block mb-1 uppercase tracking-wider text-[10px]">{log.errorType || 'Evaluation Error Detonation'}</span>
                                                    {log.error}
                                                </div>
                                            )}
                                            
                                            <div className="text-right mt-1 font-black text-lg">
                                                <span className="text-gray-400 text-xs font-bold uppercase mr-2 tracking-widest">Calculated:</span> 
                                                <span className={log.type === 'Earning' ? 'text-emerald-600' : 'text-rose-600'}>₹{formatCurrency(log.result || 0)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedUser.breakdown?.executionLog || selectedUser.breakdown.executionLog.length === 0) && (
                                        <div className="text-center p-8 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-dashed border-gray-300 dark:border-white/20">
                                            <Clock size={32} className="mx-auto text-gray-300 mb-2"/>
                                            <p className="text-sm text-gray-500 font-medium">No execution telemetry traced for this ledger cycle.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* 📥 Hidden Capture Area for background downloads */}
            {downloadingId && (
                <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px' }}>
                    <div id={`capture-${downloadingId}`}>
                        <StatementPreview 
                            payslip={historyData.find(p => p._id === downloadingId)}
                            settings={settings}
                            contentOnly={true}
                        />
                    </div>
                </div>
            )}

            {/* Admin Override Confirmation Modal */}
            <ConfirmModal
                isOpen={showOverrideModal}
                onClose={() => setShowOverrideModal(false)}
                onConfirm={() => {
                    markPaidMutation.mutate({ 
                        month, 
                        year, 
                        companyId: settings?.companyId,
                        isOverride: true,
                        reason: "Proceed despite discrepancies"
                    });
                    setShowOverrideModal(false);
                }}
                showIcon={true}
                icon={<ShieldAlert className="text-rose-500" size={48} />}
                title="Critical Discrepancy Override"
                message={`System indicates ${readiness.issues.length} critical discrepancies in the current ledger (Missing bank details/Tax IDs). Standard disbursement will bypass these records. Proceed with FORCE_DISBURSEMENT for remaining employees?`}
                confirmText="Proceed Anyway (Log Action)"
                cancelText="Return to Ledger"
                type="danger"
            />
        </div>
    );
};

export default RunPayroll;
