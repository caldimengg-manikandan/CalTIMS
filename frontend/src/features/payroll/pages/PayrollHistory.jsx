import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    Archive, Calendar, Users, DollarSign, ChevronRight, 
    CheckCircle2, AlertCircle, Clock, Filter, Search, 
    Download, TrendingUp, BarChart3, ArrowUpRight, 
    FileText, FileSpreadsheet, CreditCard, X, 
    ChevronDown, MoreHorizontal, History
} from 'lucide-react';
import { payrollAPI, settingsAPI } from '../../../services/endpoints';
import { useNavigate } from 'react-router-dom';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, AreaChart, Area,
    BarChart, Bar, Legend
} from 'recharts';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { formatCurrency, getCurrencySymbol } from '../../../utils/formatters';

const PayrollHistory = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(res => res.data.data),
    });
    const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

    // ── Fetch pre-aggregated batch summaries (one doc per month/year) ─────────
    const { data: batchRes, isLoading } = useQuery({
        queryKey: ['payrollBatches'],
        queryFn: () => payrollAPI.getBatches().then(res => res.data),
    });

    const runs = batchRes?.data || [];

    const filteredRuns = useMemo(() => {
        return runs.filter(run => {
            const label = format(new Date(run.year, run.month - 1), 'MMMM yyyy').toLowerCase();
            const matchesSearch =
                label.includes(searchTerm.toLowerCase()) ||
                `${run.year}-${String(run.month).padStart(2, '0')}`.includes(searchTerm.toLowerCase());
            const matchesStatus =
                statusFilter === 'all' || 
                (statusFilter === 'Paid' ? run.isPaid : !run.isPaid);
            return matchesSearch && matchesStatus;
        });
    }, [runs, searchTerm, statusFilter]);

    const paginatedRuns = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredRuns.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredRuns, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredRuns.length / itemsPerPage);

    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, itemsPerPage]);

    const stats = useMemo(() => {
        const totalRuns = runs.length;
        const totalDisbursed = runs.filter(r => r.isPaid).reduce((acc, r) => acc + (r.totalNet || 0), 0);
        const avgCost = totalRuns > 0 ? (runs.reduce((acc, r) => acc + (r.totalNet || 0), 0) / totalRuns) : 0;
        const failedRuns = runs.filter(r => r.failedCount > 0).length;
        const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
        return { totalRuns, totalDisbursed, avgCost, errorRate };
    }, [runs]);

    const chartData = useMemo(() => {
        return runs.slice(0, 12).reverse().map(r => ({
            period: format(new Date(r.year, r.month - 1), 'MMM yy'),
            net: r.totalNet || 0,
            gross: r.totalGross || 0,
            employees: r.totalEmployees || 0
        }));
    }, [runs]);

    const getStatusStyles = (isPaid) => {
        return isPaid 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
            : 'bg-amber-50 text-amber-600 border-amber-100';
    };

    const handleExport = (format) => {
        toast.success(`Preparing ${format} export...`);
        setIsExportOpen(false);
    };

    return (
        <div className="p-6 min-h-screen bg-[#f9fafb] dark:bg-black text-slate-900 dark:text-gray-200 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Area */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                                <Archive size={20} />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Run Archive & Ledger</h1>
                        </div>
                        <p className="text-slate-500 dark:text-gray-400 font-medium ml-11">
                            Enterprise payroll history and financial audit trail
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex-1 md:flex-none md:w-64">
                            <Search size={18} className="text-slate-400 mr-2" />
                            <input
                                type="text"
                                placeholder="Search by Month or Year..."
                                className="bg-transparent border-none text-sm outline-none w-full font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setIsExportOpen(!isExportOpen)}
                                className="flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md shadow-indigo-100 dark:shadow-none transition-all"
                            >
                                <Download size={16} />
                                Export
                                <ChevronDown size={14} className={`transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isExportOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={() => handleExport('CSV')} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2">
                                        <FileText size={16} className="text-slate-400" /> CSV Report
                                    </button>
                                    <button onClick={() => handleExport('Excel')} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 border-y border-slate-50 dark:border-white/5">
                                        <FileText size={16} className="text-slate-400" /> Excel Spreadsheet
                                    </button>
                                    <button onClick={() => handleExport('Bank')} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2">
                                        <CreditCard size={16} className="text-slate-400" /> Bank Transfer File
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* KPI Section */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Total Payroll Runs', value: stats.totalRuns, icon: Archive, color: 'indigo', trend: 'Last 12mo', bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400' },
                        { label: 'Total Disbursed', value: `${currencySymbol}${formatCurrency(stats.totalDisbursed)}`, icon: DollarSign, color: 'emerald', trend: 'Lifetime', bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Average Payroll Cost', value: `${currencySymbol}${formatCurrency(Math.round(stats.avgCost))}`, icon: TrendingUp, color: 'blue', trend: 'Per Cycle', bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Runs with Errors', value: `${stats.errorRate.toFixed(1)}%`, icon: AlertCircle, color: 'rose', trend: 'Process Integrity', bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400' },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-200 dark:border-[#333333] shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-2.5 rounded-xl ${kpi.bg} ${kpi.text} group-hover:scale-110 transition-transform`}>
                                    <kpi.icon size={22} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500 bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-md">
                                    {kpi.trend}
                                </span>
                            </div>
                            <p className="text-slate-500 dark:text-gray-400 text-sm font-semibold mb-1">{kpi.label}</p>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{kpi.value}</h3>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Charts Column */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest flex items-center gap-2">
                                    <TrendingUp size={18} className="text-indigo-600" /> Trend Analysis
                                </h3>
                                <select className="text-[10px] font-bold uppercase text-slate-400 bg-slate-50 dark:bg-white/5 border-none outline-none rounded-lg px-2 py-1">
                                    <option className="dark:bg-[#111111]">Net Payout</option>
                                    <option className="dark:bg-[#111111]">Headcount</option>
                                </select>
                            </div>
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="period" hide />
                                        <YAxis hide />
                                        <Tooltip 
                                            contentStyle={{ 
                                                borderRadius: '24px', 
                                                border: 'none', 
                                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
                                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                                backdropFilter: 'blur(8px)',
                                                padding: '12px 20px'
                                            }}
                                            itemStyle={{ fontWeight: '900', fontSize: '14px', color: '#1e293b' }}
                                            cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
                                        />
                                        <Area type="monotone" dataKey="net" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorNet)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                                <div className="flex justify-between items-center pt-8">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Global Payout</p>
                                        <p className="text-2xl font-black text-slate-900 dark:text-white">
                                            {currencySymbol}{formatCurrency(runs[0]?.totalNet || 0)}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Volatility</p>
                                        <div className="flex items-center gap-1.5 justify-end px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full">
                                            <TrendingUp size={12} className="text-emerald-500 font-black" />
                                            <span className="text-[13px] font-black text-emerald-600 dark:text-emerald-400">+4.2%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table Column */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-200 dark:border-[#333333] shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
                                <h3 className="font-black text-slate-800 dark:text-white text-sm uppercase tracking-widest">Historical Run Ledger</h3>
                                
                            </div>
                            <div className="overflow-x-auto max-h-[500px] overflow-y-auto scroll-smooth">
                                <table className="w-full text-left border-separate border-spacing-0">
                                    <thead className="sticky top-0 z-30">
                                        <tr className="bg-slate-50 dark:bg-[#1a1a1a] text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="px-6 py-4 text-[10px] bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Run Period</th>
                                            <th className="px-6 py-4 text-[10px] bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Month / Year</th>
                                            <th className="px-6 py-4 text-[10px] bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Employees</th>
                                            <th className="px-6 py-4 text-[10px] bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Gross Amount</th>
                                            <th className="px-6 py-4 text-[10px] bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Net Payout</th>
                                            <th className="px-6 py-4 text-[10px] bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Status</th>
                                            <th className="px-6 py-4 text-[10px] text-right bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">Actions</th>
                                        </tr>
                                    </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-[#333333]">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="7" className="p-12 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin" />
                                                    <p className="text-slate-400 font-bold animate-pulse">Fetching Ledger Data...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredRuns.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="p-16 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full text-slate-300 dark:text-gray-600">
                                                        <History size={48} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-slate-500 dark:text-gray-400 font-bold text-lg">No payroll cycles found</p>
                                                        <p className="text-slate-400 dark:text-gray-500 text-sm max-w-md mx-auto">This period doesn't have any finalized payroll records yet. Run the payroll wizard to generate payslips.</p>
                                                    </div>
                                                    <button 
                                                        onClick={() => navigate('/payroll/run')}
                                                        className="mt-2 flex items-center gap-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 dark:shadow-none transition-all"
                                                    >
                                                        <DollarSign size={16} />
                                                        Run Payroll Wizard
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedRuns.map((run) => {
                                        const runId = `${run.year}-${String(run.month).padStart(2, '0')}`;
                                        return (
                                            <tr
                                                key={run.id}
                                                className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/payroll/execution/${run.year}/${run.month}`)}
                                            >
                                                <td className="px-6 py-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[13px]">{runId}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] flex flex-col items-center justify-center group-hover:bg-white dark:group-hover:bg-[#222] group-hover:border-indigo-200 transition-colors shadow-sm">
                                                            <span className="text-[10px] font-black text-slate-400 leading-none mb-0.5">{run.year}</span>
                                                            <span className="text-[13px] font-black text-slate-800 dark:text-white leading-none">
                                                                {format(new Date(run.year, run.month - 1), 'MMM')}
                                                            </span>
                                                        </div>
                                                        <div className="font-bold text-slate-700 dark:text-gray-300">
                                                            {format(new Date(run.year, run.month - 1), 'MMMM yyyy')}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-gray-400">
                                                        <Users size={14} className="text-slate-400" />
                                                        {run.totalEmployees}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-600 dark:text-gray-400">
                                                    {currencySymbol}{formatCurrency(run.totalGross || 0)}
                                                </td>
                                                <td className="px-6 py-4 font-black text-emerald-600 dark:text-emerald-400">
                                                    {currencySymbol}{formatCurrency(run.totalNet || 0)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(run.isPaid)}`}>
                                                            {run.isPaid ? 'Paid' : 'Unpaid'}
                                                        </span>
                                                        {run.failedCount > 0 && (
                                                            <span className="text-[10px] font-bold text-rose-500">
                                                                {run.failedCount} failed
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100 border border-transparent hover:border-slate-100 dark:hover:border-white/10">
                                                            <MoreHorizontal size={18} />
                                                        </button>
                                                        <div className="w-8 h-8 rounded-full bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all shadow-sm">
                                                            <ChevronRight size={18} strokeWidth={2.5}/>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* 📄 Pagination Controls */}
                        <div className="p-4 border-t border-slate-50 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-[#111111] gap-4">
                            <div className="flex items-center gap-4">
                                <p className="text-xs font-bold text-slate-400 dark:text-gray-500">
                                    Showing <span className="text-slate-900 dark:text-white">{Math.min(filteredRuns.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-slate-900 dark:text-white">{Math.min(filteredRuns.length, currentPage * itemsPerPage)}</span> of <span className="text-slate-900 dark:text-white">{filteredRuns.length}</span> cycles
                                </p>
                                
                                <div className="h-4 w-px bg-slate-100 dark:bg-white/10 hidden sm:block" />

                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows:</span>
                                    <select 
                                        value={itemsPerPage} 
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-md px-2 py-0.5 text-[10px] font-black text-slate-600 dark:text-gray-400 outline-none cursor-pointer"
                                    >
                                        {[5, 10, 20, 50, 100].map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        className="p-2 border border-slate-100 dark:border-white/5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                                    >
                                        <ChevronRight className="rotate-180" size={16} />
                                    </button>
                                    
                                    <div className="flex items-center gap-1 mx-1">
                                        {[...Array(totalPages)].map((_, idx) => {
                                            if (idx === 0 || idx === totalPages - 1 || (idx >= currentPage - 2 && idx <= currentPage)) {
                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setCurrentPage(idx + 1)}
                                                        className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === idx + 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                                    >
                                                        {idx + 1}
                                                    </button>
                                                );
                                            }
                                            if (idx === 1 || idx === totalPages - 2) return <span key={idx} className="text-slate-300 dark:text-gray-600 font-black">...</span>;
                                            return null;
                                        })}
                                    </div>

                                    <button
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        className="p-2 border border-slate-100 dark:border-white/5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
};

export default PayrollHistory;
