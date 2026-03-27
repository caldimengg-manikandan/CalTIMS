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
import { formatCurrency } from '../../../utils/formatters';
import StatementPreview from '../components/StatementPreview';
import { exportToPdf } from '../../../utils/pdfExport';

const PayrollHistory = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedRun, setSelectedRun] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: () => settingsAPI.getSettings().then(res => res.data.data),
    });
    const currencySymbol = settings?.payroll?.currencySymbol || '₹';

    const handleDownloadPayslip = async (id) => {
        const toastId = toast.loading('Synchronizing statement artifacts...');
        try {
            setDownloadingId(id);
            setTimeout(async () => {
                const element = document.getElementById(`hist-capture-${id}`);
                if (!element) {
                    toast.error('Synthesis element not found', { id: toastId });
                    setDownloadingId(null);
                    return;
                }
                const record = detailRecords.find(p => p._id === id);
                const filename = `Payslip-${record?.user?.employeeId || 'Export'}.pdf`;
                const success = await exportToPdf(element, { filename, pixelRatio: 3 });
                if (success) toast.success('Generated successfully', { id: toastId });
                setDownloadingId(null);
            }, 800);
        } catch (err) {
            setDownloadingId(null);
            toast.error('Failed to generate statement', { id: toastId });
        }
    };

    // ── Fetch pre-aggregated batch summaries (one doc per month/year) ─────────
    const { data: batchRes, isLoading } = useQuery({
        queryKey: ['payrollBatches'],
        queryFn: () => payrollAPI.getBatches().then(res => res.data),
    });

    // ── If a row is selected, lazy-load individual employee records ───────────
    const { data: detailRes, isLoading: detailLoading } = useQuery({
        queryKey: ['payrollHistoryDetail', selectedRun?.month, selectedRun?.year],
        queryFn: () =>
            payrollAPI
                .getHistory({ month: selectedRun.month, year: selectedRun.year })
                .then(res => res.data),
        enabled: !!selectedRun,
    });

    const runs = batchRes?.data || [];
    const detailRecords = detailRes?.data || [];

    const filteredRuns = useMemo(() => {
        return runs.filter(run => {
            const label = format(new Date(run.year, run.month - 1), 'MMMM yyyy').toLowerCase();
            const matchesSearch =
                label.includes(searchTerm.toLowerCase()) ||
                `${run.year}-${String(run.month).padStart(2, '0')}`.includes(searchTerm.toLowerCase());
            const matchesStatus =
                statusFilter === 'all' || run.status.toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [runs, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        const totalRuns = runs.length;
        const totalDisbursed = runs.reduce((acc, r) => acc + (r.totalNet || 0), 0);
        const avgCost = totalRuns > 0 ? totalDisbursed / totalRuns : 0;
        const failedRuns = runs.filter(r => r.failedCount > 0).length;
        const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;
        return { totalRuns, totalDisbursed, avgCost, errorRate };
    }, [runs]);

    const chartData = useMemo(() => {
        return [...runs]
            .reverse()
            .slice(-6)
            .map(run => ({
                name: format(new Date(run.year, run.month - 1), 'MMM yy'),
                Gross: Math.round(run.totalGross || 0),
                Net: Math.round(run.totalNet || 0),
            }));
    }, [runs]);

    // ── Audit Checklist Dynamization — based on selected run or latest ────────
    const activeAudit = selectedRun?.audit || runs[0]?.audit || {};
    const checklist = useMemo(() => [
        { 
            title: 'Bank Reconciliation', 
            status: activeAudit.bankReconciliation || 'Required', 
            date: selectedRun ? format(new Date(selectedRun.processedAt), 'MMM dd, yyyy') : 'Latest Cycle' 
        },
        { 
            title: 'Tax Compliance Check', 
            status: activeAudit.taxCompliance || 'Pending', 
            date: selectedRun ? `Trace ${selectedRun.month}/${selectedRun.year}` : 'Internal Check' 
        },
        { 
            title: 'Variance Analysis', 
            status: activeAudit.varianceAnalysis || 'Pending', 
            date: (selectedRun?.status === 'Completed' || selectedRun?.status === 'Paid') ? 'Verified' : 'Simulation' 
        },
        { 
            title: 'Employee Discrepancies', 
            status: (activeAudit.discrepancies > 0) ? 'Issues Found' : '0 Items', 
            date: activeAudit.discrepancies > 0 ? `${activeAudit.discrepancies} Faults Found` : 'Clean Trace'
        },
    ], [selectedRun, runs, activeAudit]);

    const getStatusStyles = (status) => {
        switch (status) {
            case 'Completed':
            case 'Paid':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'Failed':
                return 'bg-red-50 text-red-700 border-red-200';
            case 'Draft':
            case 'Processed':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    const handleExport = (type) => {
        setIsExportOpen(false);
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1500)),
            {
                loading: `Preparing ${type} export...`,
                success: `${type} export ready for download.`,
                error: `Failed to generate ${type} export.`,
            }
        );
    };

    return (
        <div className="p-6 min-h-screen bg-[#f9fafb] text-slate-900 font-sans">
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* Header Area */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-100">
                                <Archive size={20} />
                            </div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Run Archive &amp; Ledger</h1>
                        </div>
                        <p className="text-slate-500 font-medium ml-11">
                            Enterprise payroll history and financial audit trail
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all flex-1 md:flex-none md:w-64">
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
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md shadow-indigo-100 transition-all"
                            >
                                <Download size={16} />
                                Export
                                <ChevronDown size={14} className={`transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isExportOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={() => handleExport('CSV')} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                                        <FileText size={16} className="text-slate-400" /> CSV Report
                                    </button>
                                    <button onClick={() => handleExport('Excel')} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 border-y border-slate-50">
                                        <FileSpreadsheet size={16} className="text-slate-400" /> Excel Spreadsheet
                                    </button>
                                    <button onClick={() => handleExport('Bank')} className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2">
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
                        { label: 'Total Payroll Runs', value: stats.totalRuns, icon: Archive, color: 'indigo', trend: 'Last 12mo' },
                        { label: 'Total Disbursed', value: `${currencySymbol}${formatCurrency(stats.totalDisbursed)}`, icon: DollarSign, color: 'emerald', trend: 'Lifetime' },
                        { label: 'Average Payroll Cost', value: `${currencySymbol}${formatCurrency(Math.round(stats.avgCost))}`, icon: TrendingUp, color: 'blue', trend: 'Per Cycle' },
                        { label: 'Runs with Errors', value: `${stats.errorRate.toFixed(1)}%`, icon: AlertCircle, color: 'rose', trend: 'Process Integrity' },
                    ].map((kpi, i) => (
                        <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-2.5 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-600 group-hover:scale-110 transition-transform`}>
                                    <kpi.icon size={22} />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                                    {kpi.trend}
                                </span>
                            </div>
                            <p className="text-slate-500 text-sm font-semibold mb-1">{kpi.label}</p>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{kpi.value}</h3>
                        </div>
                    ))}
                </div>

                {/* Trend Chart & Audit Checklist */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <BarChart3 size={18} className="text-indigo-600"/> Financial Trend
                                </h3>
                                <p className="text-slate-400 text-sm font-medium">Monthly Gross vs Net disbursement comparison</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-indigo-500" /> Gross</div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500" /> Net</div>
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} tickFormatter={(val) => `${currencySymbol}${(val/1000).toFixed(0)}k`} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} cursor={{stroke: '#e2e8f0', strokeWidth: 2}} />
                                    <Area type="monotone" dataKey="Gross" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                                    <Area type="monotone" dataKey="Net" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                             <History size={18} className="text-indigo-600"/> Audit Checklist
                        </h3>
                        <div className="space-y-4 flex-1">
                            {checklist.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/50">
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{item.title}</p>
                                        <p className="text-[11px] font-semibold text-slate-400">{item.date}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-1 rounded-md ${
                                        item.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' :
                                        item.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 
                                        item.status === 'Issues Found' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button className="mt-6 w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
                            Run Full System Audit <ArrowUpRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Filter & Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} className="text-indigo-600" />
                            <h3 className="font-bold text-slate-800">Historical Payroll Runs</h3>
                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ml-1">
                                {filteredRuns.length} Cycles
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 shadow-sm">
                                <Filter size={14} className="text-slate-400 mr-2" />
                                <select
                                    className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Failed">Failed</option>
                                    <option value="Processed">Processed</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto text-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px]">Run Period</th>
                                    <th className="px-6 py-4 text-[10px]">Month / Year</th>
                                    <th className="px-6 py-4 text-[10px]">Employees</th>
                                    <th className="px-6 py-4 text-[10px]">Gross Amount</th>
                                    <th className="px-6 py-4 text-[10px]">Net Disbursed</th>
                                    <th className="px-6 py-4 text-[10px]">Status</th>
                                    <th className="px-6 py-4 text-[10px] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
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
                                        <td colSpan="7" className="p-12 text-center text-slate-400 font-bold">
                                            No matching payroll cycles found. Run payroll first to see data here.
                                        </td>
                                    </tr>
                                ) : filteredRuns.map((run) => {
                                    const runId = `${run.year}-${String(run.month).padStart(2, '0')}`;
                                    return (
                                        <tr
                                            key={run._id}
                                            className="group hover:bg-indigo-50/30 transition-colors cursor-pointer"
                                            onClick={() => setSelectedRun(run)}
                                        >
                                            <td className="px-6 py-4 font-mono font-bold text-indigo-600 text-[13px]">{runId}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center group-hover:bg-white group-hover:border-indigo-200 transition-colors shadow-sm">
                                                        <span className="text-[10px] font-black text-slate-400 leading-none mb-0.5">{run.year}</span>
                                                        <span className="text-[13px] font-black text-slate-800 leading-none">
                                                            {format(new Date(run.year, run.month - 1), 'MMM')}
                                                        </span>
                                                    </div>
                                                    <div className="font-bold text-slate-700">
                                                        {format(new Date(run.year, run.month - 1), 'MMMM yyyy')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-1.5 font-bold text-slate-600">
                                                    <Users size={14} className="text-slate-400" />
                                                    {/* totalEmployees is a Number from the batch doc */}
                                                    {run.totalEmployees}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-600">
                                                {currencySymbol}{formatCurrency(run.totalGross || 0)}
                                            </td>
                                            <td className="px-6 py-4 font-black text-emerald-600">
                                                {currencySymbol}{formatCurrency(run.totalNet || 0)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusStyles(run.status)}`}>
                                                        {run.status}
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
                                                    <button className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100 border border-transparent hover:border-slate-100">
                                                        <MoreHorizontal size={18} />
                                                    </button>
                                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all shadow-sm">
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
                </div>
            </div>

            {/* Drill-down Sidebar */}
            {selectedRun && (
                <div className="fixed inset-0 z-[100] flex items-center justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl h-full bg-white shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex justify-between items-center z-10">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <History size={20} className="text-indigo-600"/>
                                    Run Details: {selectedRun.year}-{String(selectedRun.month).padStart(2, '0')}
                                </h2>
                                <p className="text-sm font-bold text-slate-400">Payroll Cycle Financial Snapshot</p>
                            </div>
                            <button
                                onClick={() => setSelectedRun(null)}
                                className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors border border-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Batch Summary Totals — from the pre-computed batch doc */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gross Pay</p>
                                    <p className="text-lg font-black text-slate-700">
                                        {currencySymbol}{formatCurrency(selectedRun.totalGross || 0)}
                                    </p>
                                </div>
                                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                                    <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Total Net</p>
                                    <p className="text-lg font-black text-indigo-700">
                                        {currencySymbol}{formatCurrency(selectedRun?.totalNet || 0)}
                                    </p>
                                </div>
                                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1">Employees</p>
                                    <p className="text-lg font-black text-emerald-700">
                                        {/* Always a Number — no string risk */}
                                        {selectedRun.totalEmployees}
                                    </p>
                                </div>
                            </div>

                            {/* Employee Breakdown — lazy loaded from ProcessedPayroll */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-black text-slate-800">Employee Breakdown</h3>
                                    <button
                                        onClick={() => navigate(`/payroll/run?month=${selectedRun.month}&year=${selectedRun.year}`)}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                    >
                                        Go to full run wizard <ArrowUpRight size={14} />
                                    </button>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 shadow-sm">
                                    {detailLoading ? (
                                        <div className="p-8 text-center">
                                            <div className="w-6 h-6 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin mx-auto mb-2" />
                                            <p className="text-slate-400 text-sm font-bold">Loading employees...</p>
                                        </div>
                                    ) : detailRecords.length === 0 ? (
                                        <div className="p-8 text-center text-slate-400 text-sm font-semibold">
                                            No individual records found for this period.
                                        </div>
                                    ) : detailRecords.map((rec, idx) => (
                                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs shadow-inner">
                                                    {rec.user?.name?.charAt(0) || 'E'}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">{rec.user?.name || 'Unknown Employee'}</p>
                                                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-tight">
                                                    {rec.user?.employeeId} • {rec.user?.department || rec.user?.departmentName || 'Unassigned'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <p className="font-black text-slate-800 text-sm">
                                                        {currencySymbol}{formatCurrency(rec.breakdown?.netPay || 0)}
                                                    </p>
                                                    <span className={`text-[9px] font-bold ${rec.status === 'Failed' ? 'text-red-500' : 'text-emerald-500'}`}>
                                                        {rec.status}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDownloadPayslip(rec._id); }} 
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                                    title="Download PDF"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-4">
                                <button className="py-4 border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                                    <Download size={18} /> Download CSV
                                </button>
                                <button className="py-4 border border-slate-200 rounded-2xl font-bold text-indigo-700 hover:bg-indigo-50 border-indigo-100 transition-all flex items-center justify-center gap-2 shadow-sm">
                                    <FileText size={18} /> Full PDF Report
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* 📥 Background Capture Module */}
            {downloadingId && (
                <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px' }}>
                    <div id={`hist-capture-${downloadingId}`}>
                        <StatementPreview 
                            payslip={detailRecords.find(p => p._id === downloadingId)}
                            settings={settings}
                            contentOnly={true}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default PayrollHistory;
