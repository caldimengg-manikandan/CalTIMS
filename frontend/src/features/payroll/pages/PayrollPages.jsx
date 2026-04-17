import React from 'react';
import { LayoutDashboard, Wallet, Receipt, Calculator, FileText, Percent, BarChart3, Landmark, ShieldCheck, PieChart, TrendingUp, Users, Clock, CheckCircle2, Download, DollarSign, TrendingDown, AlertCircle, Layers, Play, Trash2, ShieldAlert, Plus, X, CreditCard, Settings, ChevronDown, ExternalLink, Search, RefreshCw, Shield, Lock, Edit3, Archive, Eye, Building2, Building, Zap, Filter, Upload, MoreVertical, CreditCard as BankIcon, Check, ChevronLeft, ChevronRight, Mail, Send, Printer, Activity, FileSpreadsheet, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { payrollAPI, userAPI, settingsAPI, policyAPI } from '@/services/endpoints';
import { toast } from 'react-hot-toast';
import Spinner from '@/components/ui/Spinner';
import StatementPreview from '../components/StatementPreview';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend, PieChart as RePieChart, Pie, LineChart, Line } from 'recharts';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Modal from '@/components/ui/Modal';
import { formatCurrency, getCurrencySymbol } from '@/utils/formatters';
import { exportToPdf } from '@/utils/pdfExport';
import { calculateSalaryBreakdown } from '../payrollUtils';


const fadeUp = {
   hidden: { opacity: 0, y: 20 },
   visible: { opacity: 1, y: 0 }
};
const PayrollPlaceholder = ({ title, description, children }) => (
   <div className="p-6 space-y-6">
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
         <h1 className="text-2xl font-medium text-gray-900 dark:text-white">{title}</h1>
         <p className="text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </motion.div>
      {children}
   </div>
);

export const PayrollDashboard = () => {
   const navigate = useNavigate();
   const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth() + 1);
   const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
   const queryClient = useQueryClient();

   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const { data: dash, isLoading } = useQuery({
      queryKey: ['payrollDashboard', selectedMonth, selectedYear],
      queryFn: () => payrollAPI.getDashboard({ month: selectedMonth, year: selectedYear }).then(res => res.data.data)
   });

   const { data: history } = useQuery({
      queryKey: ['payrollBatches', { limit: 5 }],
      queryFn: () => payrollAPI.getBatches().then(res => res.data.data.slice(0, 5))
   });

   const { data: analytics } = useQuery({
      queryKey: ['payrollAnalytics', selectedMonth, selectedYear],
      queryFn: () => payrollAPI.getAnalytics({ month: selectedMonth, year: selectedYear, department: 'All' }).then(res => res.data.data)
   });

   const deptData = React.useMemo(() => {
      return dash?.trends?.deptDistribution || analytics?.departmentDistribution || [];
   }, [dash, analytics]);
   const breakdownData = (analytics?.breakdown || []).sort((a, b) => b.value - a.value).slice(0, 8);
   const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

   // 📊 Interactive Chart State (Phase 10)
   const [chartType, setChartType] = React.useState('area');
   const [timeRange, setTimeRange] = React.useState(6);
   const [metrics, setMetrics] = React.useState(['grossPay', 'netPay']);


   const toggleMetric = (m) => {
      setMetrics(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
   };

   const chartData = React.useMemo(() => {
      const raw = dash?.trends?.monthlyTrend || [];
      return raw.slice(-timeRange);
   }, [dash, timeRange]);

   const metricConfigs = {
      grossPay: { label: 'Gross', color: '#6366f1', gradient: 'colorGross' },
      netPay: { label: 'Net Pay', color: '#10b981', gradient: 'colorNet' },
      deductions: { label: 'Deductions', color: '#f43f5e', gradient: 'colorDeds' }
   };


   if (isLoading) {
      return (
         <div className="p-8 space-y-8">
            <div className="flex items-center justify-between">
               <div className="space-y-2">
                  <div className="skeleton h-7 w-48" />
                  <div className="skeleton h-4 w-64" />
               </div>
               <div className="skeleton h-9 w-32 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {[...Array(4)].map((_, i) => (
                  <div key={i} className="card flex items-center gap-4">
                     <div className="skeleton w-12 h-12 rounded-xl" />
                     <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-24" />
                        <div className="skeleton h-7 w-32" />
                     </div>
                  </div>
               ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               <div className="lg:col-span-4 card h-64" />
               <div className="lg:col-span-8 card h-64" />
            </div>
         </div>
      );
   }

   const kpis = [
      { label: 'Total Payout', value: (dash?.summary?.totalGross || 0), icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { label: 'Net Pay Disbursed', value: (dash?.summary?.totalPayroll || 0), icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Total Deductions', value: (dash?.summary?.totalDeductions || 0), icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50' },
      { label: 'Active Employees', value: dash?.summary?.activeEmployees || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', isStatic: true },
   ];

   return (
      <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-black min-h-screen">
         {/* 🚀 Header & Action Bar */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
               <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Payroll Dashboard</h1>
               <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Manage organization dispersal and compliance</p>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex items-center bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-lg p-1 shadow-sm">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="bg-transparent dark:text-white px-3 py-1.5 text-xs font-bold outline-none cursor-pointer border-r border-slate-100 dark:border-[#333333]">{[...Array(12)].map((_, i) => <option key={i} value={i + 1}>{new Date(2024, i).toLocaleString('default', { month: 'short' })}</option>)}</select>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="bg-transparent dark:text-white px-3 py-1.5 text-xs font-bold outline-none cursor-pointer">{[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}</select>
               </div>
               <button
                  onClick={() => window.location.href = '/payroll/run'}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-none"
               >
                  <Play size={16} fill="currentColor" /> Run Payroll
               </button>
            </div>
         </div>

         {/* KPI Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {kpis.map((kpi, i) => (
               <div key={i} className="bg-white dark:bg-[#111111] p-5 rounded-xl border border-slate-100 dark:border-[#333333] shadow-[0_1px_3px_0_rgb(0_0_0/0.05)] flex items-center gap-4 hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.08)] hover:-translate-y-0.5 transition-all duration-200">
                  <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-xl flex-shrink-0`}>
                     <kpi.icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                     <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest truncate">{kpi.label}</p>
                     <div className="flex items-baseline gap-2">
                        <h4 className="text-xl font-bold text-slate-800 dark:text-white tabular-nums mt-0.5">
                           {kpi.isStatic ? kpi.value : `${currencySymbol}${formatCurrency(kpi.value)}`}
                        </h4>
                        {!kpi.isStatic && dash?.summary?.growthPercentage !== undefined && i === 1 && (
                           <span className={`text-[10px] font-bold ${dash.summary.growthPercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {dash.summary.growthPercentage >= 0 ? '↑' : '↓'} {Math.abs(dash.summary.growthPercentage)}%
                           </span>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 🧾 Left: Summary & Status */}
            <div className="lg:col-span-4 bg-white dark:bg-[#111111] rounded-2xl p-6 border border-slate-100 dark:border-[#333333] shadow-sm space-y-6">
               <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-white">Payroll Cycle Status</h3>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-all ${dash?.summary?.status === 'Draft' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        dash?.summary?.status === 'Processed' || dash?.summary?.status === 'Warning' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                           dash?.summary?.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              dash?.summary?.status === 'Paid' ? 'bg-emerald-600 text-white' :
                                 dash?.summary?.status === 'Locked' ? 'bg-slate-900 dark:bg-white dark:text-black text-white' :
                                    'bg-slate-50 dark:bg-[#1a1a1a] text-slate-400'
                     }`}>
                     {dash?.summary?.status || 'Draft'}
                  </span>
               </div>

               <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl border border-slate-100 dark:border-[#333333]">
                     <p className="text-xs font-bold text-slate-400 uppercase">Last Execution</p>
                     <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mt-1">{dash?.summary?.lastRunDate ? new Date(dash.summary.lastRunDate).toLocaleDateString() : 'No recent runs'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-center">
                     <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                        <p className="text-[10px] font-black text-indigo-400 uppercase">Processed</p>
                        <p className="text-lg font-black text-indigo-700">{dash?.summary?.totalProcessed || 0}</p>

                     </div>
                     <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50">
                        <p className="text-[10px] font-black text-emerald-400 uppercase">Paid</p>
                        <p className="text-lg font-black text-emerald-700">{dash?.summary?.totalPaid || 0}</p>

                     </div>

                  </div>
               </div>

               {/* 🚨 Redesigned Alerts Panel */}
               <div className="pt-6 border-t border-slate-100 dark:border-white/5">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                     <AlertCircle size={14} className="text-rose-500" /> Critical Alerts
                  </h4>
                  <div className="space-y-2">
                     {[
                        { label: 'Missing Bank Details', count: dash?.compliance?.missingBankDetails || 0, route: '/employees' },
                        { label: 'Pending Structures', count: dash?.compliance?.missingSalaryStructure || 0, route: '/payroll/profiles' },
                        { label: 'Formula Errors', count: dash?.summary?.failedEmployees || 0, route: '/payroll/run' }
                     ].map((alert, idx) => (
                        <div key={idx} onClick={() => window.location.href = alert.route} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent hover:border-slate-100 dark:hover:border-white/5 rounded-xl transition-all cursor-pointer group">
                           <span className="text-xs font-bold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{alert.label}</span>
                           <span className={`text-[10px] font-black px-2 py-0.5 rounded ${alert.count > 0 ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                              {alert.count}
                           </span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* 📈 Right: Trend Chart (UPGRADED) */}
            <div className="lg:col-span-8 bg-white dark:bg-[#111111] rounded-2xl p-6 border border-slate-100 dark:border-[#333333] shadow-sm flex flex-col">
               <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-8">
                  <div>
                     <h3 className="font-bold text-slate-800 dark:text-white">Financial Disbursement Trend</h3>
                     <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Explore organization liabilities</p>
                  </div>

                  {/* Chart Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                     <div className="flex items-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg p-1">
                        {['line', 'bar', 'area'].map(type => (
                           <button key={type} onClick={() => setChartType(type)} className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all ${chartType === type ? 'bg-white dark:bg-[#111111] shadow-sm text-indigo-600 border border-slate-200 dark:border-[#333333]' : 'text-slate-400 hover:text-slate-600'}`}>
                              {type}
                           </button>
                        ))}
                     </div>

                     <select value={timeRange} onChange={e => setTimeRange(parseInt(e.target.value))} className="bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg px-2 py-1.5 text-[10px] font-black uppercase outline-none cursor-pointer dark:text-white">
                        <option value={3}>3 Months</option>
                        <option value={6}>6 Months</option>
                        <option value={12}>12 Months</option>
                     </select>

                     <div className="flex items-center gap-1.5 ml-2">
                        {Object.entries(metricConfigs).map(([key, config]) => (
                           <button
                              key={key}
                              onClick={() => toggleMetric(key)}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all ${metrics.includes(key) ? `bg-[${config.color}]10 border-[${config.color}]40` : 'bg-slate-50 border-transparent opacity-40 grayscale'}`}
                              style={{
                                 backgroundColor: metrics.includes(key) ? `${config.color}15` : '',
                                 borderColor: metrics.includes(key) ? `${config.color}40` : ''
                              }}
                           >
                              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
                              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{config.label}</span>
                           </button>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                     {chartType === 'bar' ? (
                        <BarChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `${currencySymbol}${v / 1000}k`} />
                           <ReTooltip 
                              contentStyle={{ 
                                 borderRadius: '12px', 
                                 border: 'none', 
                                 boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', 
                                 backgroundColor: '#111827',
                                 color: '#fff',
                                 fontWeight: 700 
                              }} 
                              itemStyle={{ color: '#fff' }}
                              labelStyle={{ color: '#94a3b8' }}
                           />
                           {metrics.map(m => (
                              <Bar key={m} dataKey={m} fill={metricConfigs[m].color} radius={[4, 4, 0, 0]} barSize={25} />
                           ))}
                        </BarChart>
                     ) : chartType === 'line' ? (
                        <LineChart data={chartData}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `${currencySymbol}${v / 1000}k`} />
                           <ReTooltip 
                              contentStyle={{ 
                                 borderRadius: '12px', 
                                 border: 'none', 
                                 boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', 
                                 backgroundColor: '#111827',
                                 color: '#fff',
                                 fontWeight: 700 
                              }} 
                              itemStyle={{ color: '#fff' }}
                              labelStyle={{ color: '#94a3b8' }}
                              formatter={(v, name) => [formatCurrency(v), metricConfigs[name]?.label || name]} 
                           />

                           {metrics.map(m => (
                              <Line key={m} type="monotone" dataKey={m} stroke={metricConfigs[m].color} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                           ))}
                        </LineChart>
                     ) : (
                        <AreaChart data={chartData}>
                           <defs>
                              {Object.values(metricConfigs).map(c => (
                                 <linearGradient key={c.gradient} id={c.gradient} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={c.color} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                                 </linearGradient>
                              ))}
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                           <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                           <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} tickFormatter={(v) => `${currencySymbol}${v / 1000}k`} />
                           <ReTooltip 
                              contentStyle={{ 
                                 borderRadius: '12px', 
                                 border: 'none', 
                                 boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', 
                                 backgroundColor: '#111827',
                                 color: '#fff',
                                 fontWeight: 700 
                              }} 
                              itemStyle={{ color: '#fff' }}
                              labelStyle={{ color: '#94a3b8' }}
                              formatter={(v, name) => [formatCurrency(v), metricConfigs[name]?.label || name]} 
                           />

                           {metrics.map(m => (
                              <Area key={m} type="monotone" dataKey={m} stroke={metricConfigs[m].color} strokeWidth={3} fillOpacity={1} fill={`url(#${metricConfigs[m].gradient})`} />
                           ))}
                        </AreaChart>
                     )}

                  </ResponsiveContainer>
               </div>
            </div>
         </div>

         {/* 🎯 Analytics Overview */}
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 🥧 Department Distribution */}
            <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-slate-100 dark:border-[#333333] shadow-sm flex flex-col">
               <div className="mb-6">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">Cost by Department</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Organizational Payroll Weight</p>
               </div>
               <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height={300}>
                     <RePieChart>
                        <Pie data={deptData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} fill="#8884d8" paddingAngle={5} dataKey="value" isAnimationActive={true} animationBegin={0} animationDuration={1500} animationEasing="ease-out">
                           {deptData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <ReTooltip 
                           contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', 
                              backgroundColor: '#111827',
                              color: '#fff',
                              fontWeight: 700 
                           }} 
                           itemStyle={{ color: '#fff' }}
                           labelStyle={{ color: '#94a3b8' }}
                           formatter={(v) => [`${currencySymbol}${formatCurrency(v)}`, 'Total Cost']} 
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                     </RePieChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* 📊 Component Breakdown */}
            <div className="bg-white dark:bg-[#111111] rounded-2xl p-6 border border-slate-100 dark:border-[#333333] shadow-sm flex flex-col">
               <div className="mb-6">
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">Payroll Component Breakdown</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">Top 8 Global Components</p>
               </div>
               <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height={300}>
                     <BarChart data={breakdownData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 20 }} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="text-slate-100 dark:text-white/5" />
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} width={120} />
                        <ReTooltip 
                           cursor={{ fill: 'rgba(255,255,255,0.02)' }} 
                           contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)', 
                              backgroundColor: '#111827',
                              color: '#fff',
                              fontWeight: 700 
                           }} 
                           itemStyle={{ color: '#fff' }}
                           labelStyle={{ color: '#94a3b8' }}
                           formatter={(v) => [`${currencySymbol}${formatCurrency(v)}`, 'Total Vol.']} 
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30} isAnimationActive={true} animationBegin={0} animationDuration={1500} animationEasing="ease-out">
                           {breakdownData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.type === 'Earning' ? '#6366f1' : '#f43f5e'} fillOpacity={0.8} />)}
                        </Bar>
                     </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-4">
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-indigo-500 opacity-80" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Earnings</span></div>
                     <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-rose-500 opacity-80" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deductions</span></div>
                  </div>
               </div>
            </div>
         </div>

         {/* 📅 Recent Payroll Runs */}
         <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 dark:text-white">Recent Payroll Batches</h3>
               <button onClick={() => window.location.href = '/payroll/history'} className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-colors flex items-center gap-1.5">
                  View Full Ledger <ExternalLink size={12} />
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50 dark:bg-[#1a1a1a] text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5">
                        <th className="px-6 py-3.5 text-left">Pay Period</th>
                        <th className="px-6 py-3.5 text-left">Employees</th>
                        <th className="px-6 py-3.5 text-right">Net Disbursed</th>
                        <th className="px-6 py-3.5 text-center">Status</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                     {(history || []).map((run, i) => (
                        <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors text-sm">
                           <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{new Date(0, run.month - 1).toLocaleString('default', { month: 'long' })} {run.year}</td>
                           <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{run.totalEmployees} employees</td>
                           <td className="px-6 py-4 text-right font-bold text-slate-800 dark:text-white tabular-nums">{currencySymbol}{formatCurrency(run.totalNet || 0)}</td>
                           <td className="px-6 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium ${run.status === 'Completed' || run.status === 'Paid' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' :
                                    run.status === 'Processed' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' :
                                       'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                                 }`}>
                                 <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                                 {run.status}
                              </span>
                           </td>
                        </tr>
                     ))}

                     {(!history || history.length === 0) && (
                        <tr>
                           <td colSpan="4" className="px-6 py-12 text-center text-slate-400 font-medium">No recent payroll history found</td>
                        </tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
};

export const EmployeePayrollProfiles = () => {
   const queryClient = useQueryClient();
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const navigate = useNavigate();
   const [deleteConfirm, setDeleteConfirm] = React.useState({ isOpen: false, id: null });
   const [viewModal, setViewModal] = React.useState({ isOpen: false, data: null });
   const [searchTerm, setSearchTerm] = React.useState('');
   const [deptFilter, setDeptFilter] = React.useState('All');
   const [statusFilter, setStatusFilter] = React.useState('All');
   const [currentPage, setCurrentPage] = React.useState(1);
   const itemsPerPage = 10;

   const { data: users } = useQuery({
      queryKey: ['users'],
      queryFn: () => userAPI.getAll({ limit: 1000 }).then(res => res.data.data)
   });

   const { data: profiles, isLoading: profilesLoading } = useQuery({
      queryKey: ['payrollProfiles'],
      queryFn: () => payrollAPI.getProfiles().then(res => res.data.data)
   });

   const { data: structures } = useQuery({
      queryKey: ['roleStructures'],
      queryFn: () => payrollAPI.getRoleStructures().then(res => res.data.data)
   });

   const { data: globalPolicy } = useQuery({
      queryKey: ['payrollPolicy'],
      queryFn: () => policyAPI.getPolicy().then(res => res.data.data)
   });

   const departments = React.useMemo(() => {
      if (!users) return [];
      return ['All', ...new Set(users.map(u => u.department).filter(Boolean))];
   }, [users]);

   const enrichedUsers = React.useMemo(() => {
      if (!users) return [];

      let filtered = users.map(u => {
         // Find profile using both standard and legacy user identity mappings
         const profile = profiles?.find(p => (p.employee?.userId === (u._id || u.id)) || (p.user === (u._id || u.id)));

         const bankDetailsComplete = !!(u.bankName && u.accountNumber && u.ifscCode && u.pan);
         let bankStatus = bankDetailsComplete ? 'Verified' : (u.bankName || u.accountNumber ? 'Pending' : 'Missing');

         // Payroll Status Logic (Unified Profile)
         let payrollStatus = 'Not Configured';
         if (profile) {
            const isProfileComplete = !!(profile.annualCTC && profile.earnings?.length > 0 && bankDetailsComplete);
            payrollStatus = isProfileComplete ? 'Active' : 'Warning';
         }

         return {
            ...u,
            profile,
            hasProfile: !!profile,
            payrollStatus,
            bankStatus
         };
      });

      // Filter logic
      if (searchTerm) {
         const lowerTerm = searchTerm.toLowerCase();
         filtered = filtered.filter(u =>
            u.name.toLowerCase().includes(lowerTerm) ||
            (u.employeeId && u.employeeId.toLowerCase().includes(lowerTerm)) ||
            (u.employee?.employeeCode && u.employee.employeeCode.toLowerCase().includes(lowerTerm))
         );
      }

      if (deptFilter !== 'All') {
         filtered = filtered.filter(u => u.department === deptFilter);
      }

      if (statusFilter !== 'All') {
         filtered = filtered.filter(u => u.payrollStatus === statusFilter);
      }

      return filtered;
   }, [users, profiles, structures, searchTerm, deptFilter, statusFilter]);

   React.useEffect(() => {
      setCurrentPage(1);
   }, [searchTerm, deptFilter, statusFilter]);

   const paginatedUsers = React.useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return enrichedUsers.slice(startIndex, startIndex + itemsPerPage);
   }, [enrichedUsers, currentPage]);

   const totalPages = Math.ceil(enrichedUsers.length / itemsPerPage);

   const kpis = React.useMemo(() => [
      { label: 'Total Employees', value: users?.length || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Configured Profiles', value: profiles?.length || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Pending Setup', value: (users?.length || 0) - (profiles?.length || 0), icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
      { label: 'Critical Errors', value: enrichedUsers?.filter(u => u.payrollStatus === 'Warning' || u.bankStatus === 'Missing').length || 0, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
   ], [users, profiles, enrichedUsers]);


   const deleteProfileMutation = useMutation({
      mutationFn: (id) => payrollAPI.deleteProfile(id),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['payrollProfiles'] });
         toast.success('Payroll Profile Successfully Removed');
      }
   });

   const handleUserSelect = (userId, mode = 'edit') => {
      const user = users.find(u => (u._id === userId || u.id === userId));
      if (mode === 'view') {
         const profile = profiles?.find(p => (p.employee?.userId === userId) || (p.user === userId));
         if (!profile) return toast.error('No payroll configuration found for this user');
         
         const breakdown = calculateSalaryBreakdown(profile.earnings, profile.deductions, profile.monthlyCTC, globalPolicy);
         setViewModal({ isOpen: true, data: { user, profile, breakdown } });
      } else {
         navigate(`/payroll/profile/${user.id || user._id}`, { state: { preSelectedUser: user } });
      }
   };

   return (
      <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-black min-h-screen">
         {/* 🚀 Header Section */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
               <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Payroll Profiles</h1>
               <p className="text-sm text-slate-500 dark:text-gray-400 font-medium mt-1">Manage employee salary structures and bank configurations</p>
            </div>
         </div>

         {/* 📊 KPI Summary */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi, i) => (
               <div key={i} className="bg-white dark:bg-[#111111] p-5 rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-xl`}>
                     <kpi.icon size={22} />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{kpi.label}</p>
                     <h4 className="text-xl font-black text-slate-900 dark:text-white">{kpi.value}</h4>
                  </div>
               </div>
            ))}
         </div>

         {/* 🔍 Search & Filters */}
         <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-100 dark:border-[#333333] shadow-sm flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[300px]">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input
                  type="text"
                  placeholder="Search employee by name or ID..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>

            <div className="flex items-center gap-2">
               <Filter size={16} className="text-slate-400" />
               <select
                  className="bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-2 text-sm font-medium outline-none cursor-pointer hover:border-slate-300 transition-colors dark:text-white"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
               >
                  {departments.map(dept => (
                     <option key={dept} value={dept} className="dark:bg-[#111111]">{dept === 'All' ? 'All Departments' : dept}</option>
                  ))}
               </select>

               <select
                  className="bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-2 text-sm font-medium outline-none cursor-pointer hover:border-slate-300 transition-colors dark:text-white"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
               >
                  <option value="All" className="dark:bg-[#111111]">All Status</option>
                  <option value="Active" className="dark:bg-[#111111]">Active</option>
                  <option value="Not Configured" className="dark:bg-[#111111]">Pending Setup</option>
                  <option value="Warning" className="dark:bg-[#111111]">Incomplete Details</option>
               </select>
            </div>
         </div>

         {/* 📋 Main Table */}
         <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden flex flex-col">
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
               <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 z-20">
                     <tr className="bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-[#333333]">
                        <th className="px-6 py-4 bg-slate-50 dark:bg-[#1a1a1a]">Employee</th>
                        <th className="px-6 py-4 bg-slate-50 dark:bg-[#1a1a1a]">Role / Designation</th>
                        <th className="px-6 py-4 text-right bg-slate-50 dark:bg-[#1a1a1a]">Defined CTC</th>
                        <th className="px-6 py-4 text-center bg-slate-50 dark:bg-[#1a1a1a]">Payroll Status</th>
                        <th className="px-6 py-4 text-center bg-slate-50 dark:bg-[#1a1a1a]">Bank Status</th>
                        <th className="px-6 py-4 text-right bg-slate-50 dark:bg-[#1a1a1a]">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {profilesLoading ? (
                        <tr>
                           <td colSpan="6" className="px-6 py-20 text-center">
                              <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                              <p className="text-sm font-medium text-slate-500">Loading payroll profiles...</p>
                           </td>
                        </tr>
                     ) : enrichedUsers.length === 0 ? (
                        <tr>
                           <td colSpan="6" className="px-6 py-20 text-center">
                              <div className="max-w-xs mx-auto">
                                 <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users size={32} className="text-slate-300 dark:text-gray-600" />
                                 </div>
                                 <h3 className="text-slate-900 dark:text-white font-bold">No payroll profiles configured yet</h3>
                                 <p className="text-slate-500 dark:text-gray-400 text-xs mt-1 mb-6">Start by configuring payroll for your employees to enable salary processing.</p>
                                 <button
                                    onClick={() => navigate('/payroll/profile')}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all dark:shadow-none"
                                 >
                                    + Launch Setup Wizard
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ) : paginatedUsers.map((u, i) => (
                        <tr key={u._id || i} className="group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shadow-sm">
                                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : u.name.charAt(0)}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{u.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tighter">ID: {u.employeeId}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4">
                              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">{u.designation || 'Technical Resource'}</p>
                              <p className="text-xs text-slate-400 dark:text-gray-500">{u.department}</p>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                 {u.profile ? `${currencySymbol}${formatCurrency(u.profile.monthlyCTC)}` : '—'}
                              </p>
                              {u.profile && <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 italic font-medium">{u.profile.payrollType}</p>}
                           </td>

                           <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit ${u.payrollStatus === 'Active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' :
                                 u.payrollStatus === 'Warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20' :
                                    'bg-slate-50 dark:bg-white/10 text-slate-400 dark:text-gray-500 border border-slate-100 dark:border-white/5'
                                 }`}>
                                 {u.payrollStatus === 'Active' ? <CheckCircle2 size={10} /> : u.payrollStatus === 'Warning' ? <AlertCircle size={10} /> : <Clock size={10} />}
                                 {u.payrollStatus === 'Not Configured' ? 'Pending Setup' : u.payrollStatus}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 mx-auto w-fit ${u.bankStatus === 'Verified' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' :
                                 u.bankStatus === 'Missing' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20' :
                                    'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                                 }`}>
                                 {u.bankStatus === 'Verified' ? <ShieldCheck size={10} /> : <AlertCircle size={10} />}
                                 {u.bankStatus}
                              </span>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                 <button
                                    onClick={() => handleUserSelect(u._id, 'view')}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all"
                                    title="View Profile"
                                 >
                                    <Eye size={16} />
                                 </button>
                                 <button
                                    onClick={() => handleUserSelect(u._id)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all"
                                    title={u.hasProfile ? 'Edit Profile' : 'Configure Profile'}
                                 >
                                    <Edit3 size={16} />
                                 </button>
                                 <button
                                    onClick={() => setDeleteConfirm({ isOpen: true, id: u.profile?.id })}
                                    disabled={!u.hasProfile}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-all disabled:opacity-0"
                                    title="Remove Salary Configuration"
                                 >
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>

            {/* 📄 Pagination Controls */}
            {totalPages > 1 && (
               <div className="p-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111111]">
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-500">
                     Showing <span className="text-slate-900 dark:text-white">{Math.min(enrichedUsers.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-slate-900 dark:text-white">{Math.min(enrichedUsers.length, currentPage * itemsPerPage)}</span> of <span className="text-slate-900 dark:text-white">{enrichedUsers.length}</span> employees
                  </p>
                  <div className="flex items-center gap-2">
                     <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="p-2 border border-slate-100 dark:border-white/5 rounded-lg text-slate-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-all"
                     >
                        <ChevronLeft size={16} />
                     </button>
                     {[...Array(totalPages)].map((_, idx) => (
                        <button
                           key={idx}
                           onClick={() => setCurrentPage(idx + 1)}
                           className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === idx + 1 ? 'bg-indigo-600 text-white' : 'text-slate-400 dark:text-gray-500 hover:bg-slate-50 dark:hover:bg-white/5'
                              }`}
                        >
                           {idx + 1}
                        </button>
                     ))}
                     <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="p-2 border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-all"
                     >
                        <ChevronRight size={16} />
                     </button>
                  </div>
               </div>
            )}
         </div>

         {/* Delete Confirmation Modal */}
         <ConfirmModal
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
            onConfirm={() => deleteConfirm.id && deleteProfileMutation.mutate(deleteConfirm.id)}
            title="Remove Salary Configuration?"
            message="Are you sure you want to clear the salary structure for this employee? This will stop future salary processing, but bank details and historical records will remain intact."
            confirmText="Yes, Remove Salary"
         />

         {/* Clean Profile View Modal */}
         <Modal
            isOpen={viewModal.isOpen}
            onClose={() => setViewModal({ isOpen: false, data: null })}
            title="Employee Payroll Profile"
            maxWidth="3xl"
         >
            {viewModal.data && (
               <div className="space-y-8 p-1">
                  {/* Header: User Info */}
                  <div className="flex items-center gap-5 p-6 bg-slate-50 dark:bg-white/5 rounded-[2rem] border border-slate-100 dark:border-[#333333]">
                     <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-200 dark:shadow-none">
                        {viewModal.data.user.name.charAt(0)}
                     </div>
                     <div className="flex-1">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{viewModal.data.user.name}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{viewModal.data.user.designation || 'Staff'}</span>
                           <span className="text-xs font-bold text-slate-300 dark:text-gray-600">•</span>
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{viewModal.data.user.department}</span>
                           <span className="text-xs font-bold text-slate-300 dark:text-gray-600">•</span>
                           <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ID: {viewModal.data.user.employeeId}</span>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual CTC</p>
                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                           {currencySymbol}{formatCurrency(viewModal.data.profile.annualCTC || (viewModal.data.profile.monthlyCTC * 12))}
                        </p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     {/* Salary Structure Card */}
                     <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#333333] pb-3">
                           <Calculator size={16} className="text-indigo-500" />
                           <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Monthly Breakdown</span>
                        </div>

                        <div className="bg-slate-900 rounded-[2rem] p-6 text-white space-y-5 shadow-xl shadow-indigo-100/10">
                           <div className="space-y-3">
                              <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">Earnings</p>
                              {viewModal.data.breakdown.earnings.map((e, idx) => (
                                 <div key={idx} className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-white/50">{e.name}</span>
                                    <span className="text-xs font-black text-emerald-400">{currencySymbol}{formatCurrency(e.calculatedValue)}</span>
                                 </div>
                              ))}
                           </div>
                           <div className="h-px bg-white/5" />
                           <div className="space-y-3">
                              <p className="text-[9px] font-black uppercase text-white/20 tracking-widest">Deductions</p>
                              {/* Statutory Section */}
                              {viewModal.data.breakdown.statutoryDeductions?.length > 0 && (
                                 <div className="space-y-2 mb-4 bg-white/5 p-3 rounded-xl border border-white/5">
                                    <p className="text-[8px] font-black uppercase text-indigo-400/60 tracking-tighter mb-1">Statutory (Policy Driven)</p>
                                    {viewModal.data.breakdown.statutoryDeductions.map((d, idx) => (
                                       <div key={`stat-${idx}`} className="flex justify-between items-center opacity-80">
                                          <span className="text-[11px] font-bold text-white/60 italic">{d.name}</span>
                                          <span className="text-xs font-black text-rose-400/80">{currencySymbol}{formatCurrency(d.calculatedValue)}</span>
                                       </div>
                                    ))}
                                 </div>
                              )}
                              
                              {/* Profile Deductions */}
                              {viewModal.data.breakdown.deductions.map((d, idx) => (
                                 <div key={idx} className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-white/50">{d.name}</span>
                                    <span className="text-xs font-black text-rose-400">{currencySymbol}{formatCurrency(d.calculatedValue)}</span>
                                 </div>
                              ))}
                           </div>
                           <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                              <div className="space-y-1">
                                 <span className="text-[9px] font-black uppercase text-white/20">Monthly Net Payout</span>
                                 <p className="text-2xl font-black text-emerald-400">{currencySymbol}{formatCurrency(viewModal.data.breakdown.netSalary)}</p>
                              </div>
                              <div className="text-right space-y-1">
                                 <span className="text-[9px] font-black uppercase text-white/20">Gross Pay</span>
                                 <p className="text-lg font-black text-white/80">{currencySymbol}{formatCurrency(viewModal.data.breakdown.grossPay)}</p>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Bank & Compliance Card */}
                     <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-[#333333] pb-3">
                           <Landmark size={16} className="text-emerald-500" />
                           <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Bank & Compliance</span>
                        </div>
                        
                        <div className="space-y-4">
                           <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#333333] rounded-2xl shadow-sm space-y-4">
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">Bank Name</span>
                                 <span className="text-sm font-black text-slate-800 dark:text-white">{viewModal.data.user.bankName || 'Not Set'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">Account Number</span>
                                 <span className="text-sm font-bold text-slate-600 dark:text-gray-300 tabular-nums">{viewModal.data.user.accountNumber || '—'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">IFSC Code</span>
                                 <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{viewModal.data.user.ifscCode || '—'}</span>
                              </div>
                           </div>

                           <div className="p-5 bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#333333] rounded-2xl shadow-sm space-y-4">
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">PAN Card</span>
                                 <span className="text-sm font-black text-slate-800 dark:text-white font-mono">{viewModal.data.user.pan || '—'}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase">UAN Number</span>
                                 <span className="text-sm font-bold text-slate-600 dark:text-gray-300 tabular-nums">{viewModal.data.user.uan || '—'}</span>
                              </div>
                           </div>

                           <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center gap-3 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20">
                              <ShieldCheck size={18} />
                              <p className="text-[10px] font-bold">Payroll profile is currently active and verified.</p>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="flex justify-end pt-4">
                     <button 
                        onClick={() => navigate(`/payroll/profile/${viewModal.data.user.id || viewModal.data.user._id}`, { state: { preSelectedUser: viewModal.data.user } })}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white dark:text-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 dark:shadow-none"
                     >
                        <Edit3 size={14} /> Edit Configuration
                     </button>
                  </div>
               </div>
            )}
         </Modal>

      </div>
   );
};

export const SalaryStructures = () => {
   const queryClient = useQueryClient();
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const [isEditing, setIsEditing] = React.useState(null);
   const [showTemplates, setShowTemplates] = React.useState(false);
   const [selectedTemplate, setSelectedTemplate] = React.useState(null);
   const [deleteConfirm, setDeleteConfirm] = React.useState({ isOpen: false, id: null });
   const [removeCompConfirm, setRemoveCompConfirm] = React.useState({ isOpen: false, type: null, index: null });
   const [configModal, setConfigModal] = React.useState({ isOpen: false, type: null, index: null, data: { year: '', amount: '' } });

   const { data: usersData } = useQuery({
      queryKey: ['usersList'],
      queryFn: () => userAPI.getAll().then(res => res.data?.data || res.data || [])
   });
   const { data: profiles } = useQuery({
      queryKey: ['payrollProfiles'],
      queryFn: () => payrollAPI.getProfiles().then(res => res.data.data)
   });

   const employeesList = React.useMemo(() => {
      const list = Array.isArray(usersData) ? usersData : usersData?.users || [];
      return list;
   }, [usersData]);

   const scrollContainerRef = React.useRef(null);
   const defaultEarnings = [
      { name: 'Basic Salary', value: 40, calculationType: 'Percentage', formula: 'Basic = 40% of CTC' },
      { name: 'House Rent Allowance (HRA)', value: 20, calculationType: 'Percentage', formula: 'HRA = 20% of Basic' },
      { name: 'Special Allowance', value: '', calculationType: 'Fixed', formula: '' },
      { name: 'Bonus', value: '', calculationType: 'Fixed', formula: '' }
   ];

   const defaultDeductions = [
      { name: 'Provident Fund (PF)', value: 12, calculationType: 'Percentage', formula: 'PF = 12% of Basic' },
      { name: 'Tax', value: '', calculationType: 'Fixed', formula: 'System Variable' },
      { name: 'ESI', value: 0.75, calculationType: 'Percentage', formula: 'Apply if Salary <= 21000' },
      { name: 'Professional Tax', value: 200, calculationType: 'Fixed', formula: 'Monthly or Selected Months' }
   ];

   const ROLE_TEMPLATES = {
      'manager': {
         earnings: [
            { name: 'Basic Salary', value: 50, calculationType: 'Percentage', formula: 'Basic = 50% of CTC' },
            { name: 'House Rent Allowance (HRA)', value: 50, calculationType: 'Percentage', formula: 'HRA = 50% of Basic' },
            { name: 'Special Allowance', value: 15000, calculationType: 'Fixed', formula: '' }
         ],
         deductions: [
            { name: 'Provident Fund (PF)', value: 12, calculationType: 'Percentage', formula: 'PF = 12% of Basic' },
            { name: 'Professional Tax', value: 200, calculationType: 'Fixed', formula: '' }
         ]
      },
      'employee': {
         earnings: [
            { name: 'Basic Salary', value: 40, calculationType: 'Percentage', formula: 'Basic = 40% of CTC' },
            { name: 'House Rent Allowance (HRA)', value: 40, calculationType: 'Percentage', formula: 'HRA = 40% of Basic' },
            { name: 'Conveyance', value: 2000, calculationType: 'Fixed', formula: '' }
         ],
         deductions: [
            { name: 'Provident Fund (PF)', value: 12, calculationType: 'Percentage', formula: 'PF = 12% of Basic' },
            { name: 'ESI', value: 0.75, calculationType: 'Percentage', formula: 'Gross <= 21000' }
         ]
      },
      'intern': {
         earnings: [
            { name: 'Stipend', value: 15000, calculationType: 'Fixed', formula: '' }
         ],
         deductions: []
      },
      'admin': {
         earnings: [
            { name: 'Basic Salary', value: 60, calculationType: 'Percentage', formula: 'Basic = 60% of CTC' },
            { name: 'Admin Allowance', value: 10000, calculationType: 'Fixed', formula: '' }
         ],
         deductions: [{ name: 'Professional Tax', value: 200, calculationType: 'Fixed', formula: '' }]
      },
      'hr': {
         earnings: [{ name: 'Stipend', value: 30000, calculationType: 'Fixed', formula: '' }],
         deductions: [{ name: 'Professional Tax', value: 200, calculationType: 'Fixed', formula: '' }]
      },
      'finance': {
         earnings: [{ name: 'Stipend', value: 35000, calculationType: 'Fixed', formula: '' }],
         deductions: [{ name: 'Professional Tax', value: 200, calculationType: 'Fixed', formula: '' }]
      }
   };

   const [formData, setFormData] = React.useState({
      name: '',
      description: '',
      type: 'Role-Based',
      userId: null,
      earnings: defaultEarnings,
      deductions: defaultDeductions
   });

   const [modalRole, setModalRole] = React.useState('employee');
   const [modalUserId, setModalUserId] = React.useState('');

   const loadTemplate = (roleName) => {
      // First check if an existing structure with this name exists in the database
      const existing = structures?.find(s => s.name === roleName);
      if (existing) {
         setFormData(existing);
         toast.success(`${roleName} structure loaded from records`);
         return;
      }

      const template = ROLE_TEMPLATES[roleName];
      if (template) {
         setFormData({
            ...formData,
            name: roleName,
            earnings: template.earnings,
            deductions: template.deductions
         });
         toast.success(`${roleName} template applied`);
      } else {
         setFormData({
            ...formData,
            name: roleName,
            earnings: [],
            deductions: []
         });
         toast.success(`Initialized ${roleName} structure`);
      }
   };

   const { data: structures, isLoading } = useQuery({
      queryKey: ['roleStructures'],
      queryFn: () => payrollAPI.getRoleStructures().then(res => res.data.data)
   });

   const mutation = useMutation({
      mutationFn: (data) => payrollAPI.updateRoleStructure(data),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['roleStructures'] });
         toast.success('Architecture Successfully Saved');
         setIsEditing(null);
      }
   });
   const toggleStatusMutation = useMutation({
      mutationFn: (id) => payrollAPI.toggleStructureStatus(id),
      onSuccess: (res) => {
         queryClient.invalidateQueries({ queryKey: ['roleStructures'] });
         toast.success(res.data.message || 'Status updated');
         setStatusConfirm({ isOpen: false, id: null, isActive: false });
      }
   });

   const deleteMutation = useMutation({
      mutationFn: (id) => payrollAPI.deleteStructure(id),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['roleStructures'] });
         toast.success('Structure Successfully Purged');
         setHardDeleteConfirm({ isOpen: false, id: null });
      }
   });

   const [statusConfirm, setStatusConfirm] = React.useState({ isOpen: false, id: null, isActive: false });
   const [hardDeleteConfirm, setHardDeleteConfirm] = React.useState({ isOpen: false, id: null });

   const addComponent = (type) => {
      const newComp = { name: '', value: 0, calculationType: 'Fixed', formula: '' };
      setFormData(prev => ({
         ...prev,
         [type]: [...prev[type], newComp]
      }));

      // Auto-scroll after state update
      setTimeout(() => {
         const elements = document.querySelectorAll(`[data-comp-type="${type}"]`);
         if (elements.length > 0) {
            elements[elements.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
         }
      }, 100);
   };

   const removeComponent = (type, index) => {
      setRemoveCompConfirm({ isOpen: true, type, index });
   };

   const updateComponent = (type, index, field, val) => {
      const updated = [...formData[type]];
      if (field === 'value') {
         const parsed = parseFloat(val);
         // Ensure positive values only, allowing empty string for user input flexibility
         if (val !== '' && (isNaN(parsed) || parsed < 0)) {
            return;
         }
         val = val === '' ? '' : parsed;
      }
      updated[index][field] = val;

      // Auto-trigger requirements for Tax/Insurance when typing name
      if (field === 'name') {
         const lowerVal = val.toLowerCase();
         if (lowerVal.includes('tax') || lowerVal.includes('insurance')) {
            setConfigModal({
               isOpen: true,
               type,
               index,
               data: updated[index].config || { durationType: '', componentType: '', amount: '' }
            });
         }
      }

      setFormData({ ...formData, [type]: updated });
   };

   const [simulationCTC, setSimulationCTC] = React.useState('');
   const [refreshTrigger, setRefreshTrigger] = React.useState(0);

   const preview = React.useMemo(() => {
      const context = {};
      let gross = 0;

      const employeeProfile = profiles?.find(p => p.user?._id === modalUserId || p.user === modalUserId);
      const liveCTC = employeeProfile?.monthlyCTC || parseFloat(simulationCTC) || 0;

      formData.earnings.forEach(e => {
         let val = parseFloat(e.value) || 0;
         if (e.calculationType === 'Percentage') {
            const formula = (e.formula || '').toLowerCase();
            let base = formula.includes('ctc') ? liveCTC : (context['Basic Salary'] || context['Basic'] || 0);
            if (e.name.toLowerCase().includes('basic')) base = liveCTC;
            val = (base * (parseFloat(e.value) || 0)) / 100;
         }
         context[e.name] = val;
         gross += val;
      });

      let totalDeds = 0;
      formData.deductions.forEach(d => {
         let val = parseFloat(d.value) || 0;
         if (d.config && d.config.durationType && d.config.amount) {
            const configAmount = parseFloat(d.config.amount) || 0;
            if (d.config.durationType === '6 Months') val = configAmount / 6;
            else if (d.config.durationType === '1 Year') val = configAmount / 12;
         } else if (d.calculationType === 'Percentage') {
            const formula = (d.formula || '').toLowerCase();
            let base = formula.includes('ctc') ? liveCTC : (context['Basic Salary'] || context['Basic'] || 0);
            if (formula.includes('gross')) base = gross;
            val = (base * (parseFloat(d.value) || 0)) / 100;
         }
         if (d.name.toUpperCase() === 'ESI' && gross > 21000) val = 0;
         totalDeds += val;
      });

      return { gross, totalDeds, net: gross - totalDeds, activeCTC: liveCTC, isSimulation: !employeeProfile && !!simulationCTC };
   }, [formData, profiles, modalUserId, simulationCTC, refreshTrigger]);

   const handleAdd = () => {
      setFormData({
         name: '',
         description: '',
         type: 'Role-Based',
         userId: null,
         earnings: [{ name: 'Basic Salary', calculationType: 'Fixed', value: 0, formula: '' }],
         deductions: [],
         status: 'active'
      });
      setModalRole('employee');
      setModalUserId('');
      setIsEditing('new');
      setShowTemplates(false);
      setSelectedTemplate(null);
   };

   const handleEdit = (struct) => {
      setFormData({ ...struct });
      setIsEditing(struct._id);
      setModalUserId(struct.userId || '');
   };

   return (
      <PayrollPlaceholder
         title="Salary Structures"
         description="Manage salary templates for roles and employees"
      >
         <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8 mb-10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full xl:max-w-3xl">
               {[
                  { label: 'Total Structures', value: structures?.length || 0, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Active Structures', value: structures?.filter(s => s.isActive).length || 0, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Assigned Employees', value: profiles?.length || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
               ].map((kpi, i) => (
                  <motion.div
                     key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                     className="bg-white dark:bg-[#111111] p-4 rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm flex items-center gap-4 hover:shadow-md transition-all group"
                  >
                     <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-xl group-hover:scale-110 transition-transform`}>
                        <kpi.icon size={20} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white leading-none">{kpi.value}</h4>
                     </div>
                  </motion.div>
               ))}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
               <button
                  onClick={handleAdd}
                  className="flex-1 sm:flex-none px-8 py-3.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:scale-95"
               >
                  <Plus size={16} /> Create Structure
               </button>
            </div>
         </div>

         <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-[#333333]">
                        <th className="px-6 py-4">Structure Details</th>
                        <th className="px-6 py-4">Configuration Type</th>
                        <th className="px-6 py-4">Component Preview</th>
                        <th className="px-6 py-4 text-center">Assignments</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#333333]">
                     {isLoading ? (
                        <tr>
                           <td colSpan="6" className="px-6 py-20 text-center">
                              <Spinner size="lg" />
                              <p className="text-sm text-gray-500 mt-2">Loading salary structures...</p>
                           </td>
                        </tr>
                     ) : !structures?.length ? (
                        <tr>
                           <td colSpan="6" className="px-6 py-20 text-center">
                              <div className="max-w-xs mx-auto">
                                 <div className="w-16 h-16 bg-slate-50 dark:bg-[#1a1a1a] rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Layers size={32} className="text-slate-300" />
                                 </div>
                                 <h3 className="text-slate-900 dark:text-white font-bold">No salary structures yet</h3>
                                 <p className="text-slate-500 text-xs mt-1 mb-6">Create templates with earnings and deductions to automate payroll.</p>
                                 <button onClick={handleAdd} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100">
                                    + Create First Architecture
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ) : (
                        structures.map((struct, i) => {
                           const assignedCount = profiles?.filter(p => p.salaryStructureId === struct._id).length || 0;
                           return (
                              <tr key={struct._id || i} className="group hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-colors">
                                 <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${struct.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                                          <Layers size={20} />
                                       </div>
                                       <div>
                                          <p className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{struct.name}</p>
                                          <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest uppercase">ST_ID: {struct._id?.slice(-6).toUpperCase()}</p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest border ${struct.type === 'Employee-Based' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/20' : 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20'}`}>
                                       {struct.type === 'Employee-Based' ? 'Individual' : `${struct.role || 'General'}`}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1.5">
                                       <div className="flex gap-1.5 flex-wrap">
                                          {struct.earnings?.slice(0, 2).map((e, idx) => (
                                             <span key={idx} className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-md text-[9px] font-bold border border-emerald-100 dark:border-emerald-500/20">{e.name}</span>
                                          ))}
                                          {struct.earnings?.length > 2 && <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500">+{struct.earnings.length - 2}</span>}
                                       </div>
                                       <div className="flex gap-1.5 flex-wrap">
                                          {struct.deductions?.slice(0, 2).map((d, idx) => (
                                             <span key={idx} className="px-2 py-0.5 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 rounded-md text-[9px] font-bold border border-rose-100 dark:border-rose-500/20">{d.name}</span>
                                          ))}
                                          {struct.deductions?.length > 2 && <span className="text-[9px] font-bold text-slate-400 dark:text-gray-500">+{struct.deductions.length - 2}</span>}
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-[#0a0a0a] rounded-lg text-slate-600 dark:text-gray-400">
                                       <Users size={14} />
                                       <span className="text-sm font-black">{assignedCount}</span>
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${struct.isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 'bg-slate-50 dark:bg-[#1a1a1a] text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-[#333333]'}`}>
                                       <div className={`w-1.5 h-1.5 rounded-full ${struct.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300 dark:bg-gray-600'}`} />
                                       {struct.isActive ? 'Active' : 'Archived'}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <button onClick={() => handleEdit(struct)} className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-[#222222] rounded-lg transition-all" title="Edit Architecture"><Edit3 size={16} /></button>
                                       <button onClick={() => setStatusConfirm({ isOpen: true, id: struct._id, isActive: struct.isActive })} className={`p-2 rounded-lg transition-all ${struct.isActive ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`} title={struct.isActive ? 'Archive' : 'Activate'}>
                                          {struct.isActive ? <Archive size={16} /> : <Play size={16} />}
                                       </button>
                                       <button
                                          onClick={() => setHardDeleteConfirm({ isOpen: true, id: struct.id })}
                                          className="p-2 text-slate-400 dark:text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                                          title="Delete Structure"
                                       >
                                          <Trash2 size={16} />
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           )
                        })
                     )}
                  </tbody>
               </table>
            </div>
         </div>
         {isEditing && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-end">
               <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  className="bg-white dark:bg-[#0a0a0a] w-full max-w-4xl h-full shadow-2xl flex flex-col"
               >
                  {/* Drawer Header */}
                  <div className="p-8 border-b border-slate-100 dark:border-[#333333] flex justify-between items-center bg-white dark:bg-[#111111] shrink-0">
                     <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-indigo-600 dark:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-100 dark:shadow-none">
                           <Calculator size={32} />
                        </div>
                        <div>
                           <div className="flex items-center gap-3">
                              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Salary Structure Designer</h3>
                           </div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure architecture for {modalRole.toUpperCase()}</p>
                        </div>
                     </div>
                     <button onClick={() => setIsEditing(null)} className="w-12 h-12 bg-slate-50 dark:bg-[#1a1a1a] rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all active:scale-95">
                        <X size={20} />
                     </button>
                  </div>

                  <div className="flex-1 overflow-hidden">
                     <form
                        onSubmit={(e) => {
                           e.preventDefault();
                           if (!formData.name.trim()) { toast.error('Structure requires a name'); return; }
                           mutation.mutate(formData);
                        }}
                        className="flex flex-col h-full"
                     >
                        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-slate-50/30 dark:bg-[#0a0a0a]">
                           <div className="max-w-3xl mx-auto space-y-12">
                              {/* Meta Config */}
                              <div className="grid grid-cols-2 gap-8">
                                 <div className="space-y-6">
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Role</label>
                                       <select
                                          value={modalRole}
                                          onChange={(e) => {
                                             const newRole = e.target.value;
                                             setModalRole(newRole);
                                             setModalUserId('');
                                             setFormData({ ...formData, type: 'Role-Based', userId: null, name: `${newRole.toUpperCase()} STANDARD` });
                                             loadTemplate(newRole);
                                          }}
                                          className="w-full px-4 py-3 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
                                       >
                                          {['intern', 'employee', 'manager', 'hr', 'finance', 'admin'].map(r => <option key={r} value={r} className="dark:bg-[#111111]">{r.toUpperCase()}</option>)}
                                       </select>
                                    </div>
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Structure Name</label>
                                       <input
                                          required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                          placeholder="e.g. Senior Developer Template"
                                          className="w-full px-4 py-3 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
                                       />
                                    </div>
                                 </div>

                                 <div className="space-y-6">
                                    <div className="space-y-2">
                                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee Override</label>
                                       <select
                                          value={modalUserId}
                                          onChange={(e) => {
                                             const uId = e.target.value;
                                             setModalUserId(uId);
                                             if (uId) {
                                                const existing = structures?.find(s => s.userId === uId);
                                                if (existing) {
                                                   setFormData(existing);
                                                } else {
                                                   const u = employeesList.find(emp => emp._id === uId);
                                                   setFormData({ ...formData, type: 'Employee-Based', userId: uId, name: `${u?.name} Individual Override` });
                                                }
                                             } else {
                                                setFormData({ ...formData, type: 'Role-Based', userId: null, name: `${modalRole.toUpperCase()} STANDARD` });
                                                loadTemplate(modalRole);
                                             }
                                          }}
                                          className="w-full px-4 py-3 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
                                       >
                                          <option value="">Standard Role Structure</option>
                                          {employeesList?.filter(u => u.role === modalRole).map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                                       </select>
                                    </div>

                                    {/* Simulation Card Inlined */}
                                    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                                       <div className="relative z-10 flex justify-between items-end">
                                          <div className="space-y-1">
                                             <p className="text-[9px] font-black uppercase tracking-widest opacity-50">Monthly Take Home</p>
                                             <h4 className="text-2xl font-black">{currencySymbol}{formatCurrency(preview.net)}</h4>

                                          </div>
                                          <div className="text-right">
                                             <p className="text-[9px] font-black opacity-40 uppercase">Gross: {currencySymbol}{formatCurrency(preview.gross)}</p>
                                             <p className="text-[9px] font-black text-rose-400 uppercase">Deds: {currencySymbol}{formatCurrency(preview.totalDeds)}</p>

                                          </div>
                                       </div>
                                       <div className="mt-4 pt-4 border-t border-white/10">
                                          <input
                                             type="number"
                                             value={simulationCTC}
                                             onChange={(e) => setSimulationCTC(e.target.value)}
                                             placeholder="Simulate CTC..."
                                             className="w-full bg-transparent border-none p-0 text-xs font-bold outline-none placeholder:text-white/20"
                                          />
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              {/* Components */}
                              <div className="space-y-12">
                                 {/* Earnings */}
                                 <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                       <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                          <TrendingUp size={16} className="text-emerald-500" /> Earnings
                                       </h4>
                                       <button type="button" onClick={() => addComponent('earnings')} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-all">+ Add Item</button>
                                    </div>
                                    <div className="space-y-3">
                                       {formData.earnings.map((e, idx) => (
                                          <div key={idx} className="flex gap-4 items-center bg-white dark:bg-[#0a0a0a] p-3 rounded-xl border border-slate-100 dark:border-[#333333] shadow-sm transition-all group">
                                             <input value={e.name} onChange={(ev) => updateComponent('earnings', idx, 'name', ev.target.value)} placeholder="Basic" className="flex-1 bg-transparent border-none text-xs font-bold outline-none dark:text-white" />
                                             <select value={e.calculationType} onChange={(ev) => updateComponent('earnings', idx, 'calculationType', ev.target.value)} className="w-24 bg-slate-50 dark:bg-[#1a1a1a] border-none rounded-lg text-[10px] font-black outline-none px-2 py-1 dark:text-white">
                                                <option className="dark:bg-[#111111]">Fixed</option><option className="dark:bg-[#111111]">Percentage</option><option className="dark:bg-[#111111]">Formula</option>
                                             </select>
                                             <input type={e.calculationType === 'Formula' ? 'text' : 'number'} value={e.value} onChange={(ev) => updateComponent('earnings', idx, 'value', ev.target.value)} disabled={e.calculationType === 'Formula'} className="w-20 bg-slate-50 dark:bg-[#1a1a1a] border-none rounded-lg text-[10px] font-black outline-none px-2 py-1 text-right disabled:opacity-20 dark:text-white" />
                                             <button type="button" onClick={() => removeComponent('earnings', idx)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                          </div>
                                       ))}
                                    </div>
                                 </div>

                                 {/* Deductions */}
                                 <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                       <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                                          <TrendingDown size={16} className="text-rose-500" /> Deductions
                                       </h4>
                                       <button type="button" onClick={() => addComponent('deductions')} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-700 transition-all">+ Add Item</button>
                                    </div>
                                    <div className="space-y-3">
                                       {formData.deductions.map((d, idx) => (
                                          <div key={idx} className="flex gap-4 items-center bg-white dark:bg-[#0a0a0a] p-3 rounded-xl border border-slate-100 dark:border-[#333333] shadow-sm transition-all group">
                                             <input value={d.name} onChange={(ev) => updateComponent('deductions', idx, 'name', ev.target.value)} placeholder="PF" className="flex-1 bg-transparent border-none text-xs font-bold outline-none dark:text-white" />
                                             <select value={d.calculationType} onChange={(ev) => updateComponent('deductions', idx, 'calculationType', ev.target.value)} className="w-24 bg-slate-50 dark:bg-[#1a1a1a] border-none rounded-lg text-[10px] font-black outline-none px-2 py-1 dark:text-white">
                                                <option className="dark:bg-[#111111]">Fixed</option><option className="dark:bg-[#111111]">Percentage</option><option className="dark:bg-[#111111]">Formula</option>
                                             </select>
                                             <input type={d.calculationType === 'Formula' ? 'text' : 'number'} value={d.value} onChange={(ev) => updateComponent('deductions', idx, 'value', ev.target.value)} disabled={d.calculationType === 'Formula'} className="w-20 bg-slate-50 dark:bg-[#1a1a1a] border-none rounded-lg text-[10px] font-black outline-none px-2 py-1 text-right disabled:opacity-20 dark:text-white" />
                                             <button type="button" onClick={() => removeComponent('deductions', idx)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <div className="p-8 bg-white dark:bg-[#111111] border-t border-slate-100 dark:border-white/5 flex justify-between items-center shrink-0">
                           <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500">
                              <AlertCircle size={16} />
                              <p className="text-[9px] font-black uppercase tracking-widest">Recalculation triggers on save</p>
                           </div>
                           <div className="flex gap-4">
                              <button onClick={() => setIsEditing(null)} type="button" className="px-6 py-3 text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-white transition-all">Cancel</button>
                              <button type="submit" className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:-translate-y-0.5 transition-all">Save</button>
                           </div>
                        </div>
                     </form>
                  </div>
               </motion.div>
            </div>
         )}
         <ConfirmModal
            isOpen={statusConfirm.isOpen}
            onClose={() => setStatusConfirm({ isOpen: false, id: null, isActive: false })}
            onConfirm={() => statusConfirm.id && toggleStatusMutation.mutate(statusConfirm.id)}
            title={statusConfirm.isActive ? "Deactivate Structure?" : "Activate Structure?"}
            message={statusConfirm.isActive
               ? "This will deactivate the structure. It won't be available for new employee assignments."
               : "This will restore the structure to active status. Are you sure?"
            }
            confirmText={statusConfirm.isActive ? "Yes, Deactivate" : "Yes, Activate"}
         />

         <ConfirmModal
            isOpen={hardDeleteConfirm.isOpen}
            onClose={() => setHardDeleteConfirm({ isOpen: false, id: null })}
            onConfirm={() => hardDeleteConfirm.id && deleteMutation.mutate(hardDeleteConfirm.id)}
            title="Delete Structure Permanently?"
            message="Are you sure? This permanently removes this structure from the database."
            confirmText="Yes, Delete Permanently"
            variant="danger"
         />

         <ConfirmModal
            isOpen={removeCompConfirm.isOpen}
            onClose={() => setRemoveCompConfirm({ isOpen: false, type: null, index: null })}
            onConfirm={() => {
               const { type, index } = removeCompConfirm;
               const updated = [...formData[type]];
               updated.splice(index, 1);
               setFormData({ ...formData, [type]: updated });
            }}
            title={`Remove ${removeCompConfirm.type === 'earnings' ? 'Earning' : 'Deduction'}?`}
            message={`Are you sure you want to remove this ${removeCompConfirm.type} component? This will recalculate all linked payslips during the next processing cycle.`}
            confirmText="Remove Component"
         />

         <Modal
            isOpen={configModal.isOpen}
            onClose={() => setConfigModal({ ...configModal, isOpen: false })}
            title="Component Logic Config"
            maxWidth="max-w-md"
         >
            <div className="p-8 space-y-8">
               <div className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl">
                  <div className="p-2 bg-white dark:bg-[#1a1a1a] rounded-lg text-indigo-600 dark:text-indigo-400 shadow-sm"><Settings size={20} /></div>
                  <div>
                     <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Advanced Logic</p>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Configure specific triggers and values for {configModal.type}</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Condition Priority / Duration</label>
                     <select
                        value={configModal.data.durationType || ''}
                        onChange={(e) => setConfigModal({ ...configModal, data: { ...configModal.data, durationType: e.target.value } })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
                     >
                        <option value="" className="dark:bg-[#111111]">Select Duration</option>
                        <option value="6 Months" className="dark:bg-[#111111]">6 Months</option>
                        <option value="1 Year" className="dark:bg-[#111111]">1 Year</option>
                     </select>
                  </div>

                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fixed Threshold / Amount</label>
                     <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-300">{currencySymbol}</span>
                        <input
                           type="number"
                           min="0"
                           value={configModal.data.amount || ''}
                           onChange={(e) => {
                              const val = e.target.value;
                              setConfigModal({ ...configModal, data: { ...configModal.data, amount: val === '' ? '' : Math.max(0, parseFloat(val) || 0) } });
                           }}
                           className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all dark:text-white"
                           placeholder="0.00"
                        />
                     </div>
                  </div>
               </div>

               <div className="pt-4 flex flex-col gap-3">
                  <button
                     type="button"
                     onClick={() => {
                        const { type, index, data } = configModal;
                        if (!data.durationType || !data.amount) {
                           toast.error('Required logic missing');
                           return;
                        }
                        const updated = [...formData[type]];
                        updated[index].config = data;
                        setFormData({ ...formData, [type]: updated });
                        setConfigModal({ ...configModal, isOpen: false });
                        toast.success('Configuration Applied');
                     }}
                     className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none transition-all hover:-translate-y-0.5"
                  >
                     Save Logic Parameters
                  </button>
                  <button onClick={() => setConfigModal({ ...configModal, isOpen: false })} className="w-full py-3 text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest hover:text-slate-600 dark:hover:text-white transition-all">Cancel</button>
               </div>
            </div>
         </Modal>
      </PayrollPlaceholder>
   );
};

export const PayrollProcessing = () => {
   const queryClient = useQueryClient();
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const [filters, setFilters] = React.useState({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      department: '',
      employeeId: '',
      branch: '',
      designation: '',
      location: '',
      bank: ''
   });
   const [isSimulating, setIsSimulating] = React.useState(false);
   const [simulatedData, setSimulatedData] = React.useState(null);

   const { data: usersData } = useQuery({
      queryKey: ['usersList'],
      queryFn: () => userAPI.getAll().then(res => res.data?.data || res.data || [])
   });
   const { data: profiles } = useQuery({
      queryKey: ['payrollProfiles'],
      queryFn: () => payrollAPI.getProfiles().then(res => res.data.data)
   });

   const employeesList = React.useMemo(() => {
      return Array.isArray(usersData) ? usersData : usersData?.users || [];
   }, [usersData]);

   const { uniqueDepartments, uniqueDesignations, uniqueBanks } = React.useMemo(() => {
      const list = Array.isArray(usersData) ? usersData : usersData?.users || [];
      const depts = new Set([]);
      const desigs = new Set([]);
      const banks = new Set([]);
      list.forEach(u => {
         if (u.department) depts.add(u.department);
         if (u.designation) desigs.add(u.designation);
         if (u.bankName) banks.add(u.bankName);
      });
      return {
         uniqueDepartments: Array.from(depts).sort(),
         uniqueDesignations: Array.from(desigs).sort(),
         uniqueBanks: Array.from(banks).sort()
      };
   }, [usersData]);

   const simulateMutation = useMutation({
      mutationFn: (data) => payrollAPI.simulate(data),
      onSuccess: (res) => {
         setSimulatedData(res.data.data || []);
         setIsSimulating(false);
         const results = res.data.data || [];
         const errorCount = results.filter(r => r.error).length;
         if (errorCount > 0) toast.warning(`Simulation complete with ${errorCount} anomalies`);
         else toast.success(`Simulation of ${results.length} nodes complete`);
      },
      onError: () => {
         setIsSimulating(false);
         toast.error('Strategic simulation failed');
      }
   });

   const saveMutation = useMutation({
      mutationFn: (data) => payrollAPI.save({ payrolls: data }),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['payrollHistory'], exact: false });
         queryClient.invalidateQueries({ queryKey: ['payrollDashboard'], exact: false });
         queryClient.invalidateQueries({ queryKey: ['payrollBatches'], exact: false });
         queryClient.invalidateQueries({ queryKey: ['payrollAnalytics'], exact: false });
         toast.success('Batch Payroll Successfully Committed');
         setSimulatedData(null);
      }
   });

   const lockMutation = useMutation({
      mutationFn: (data) => payrollAPI.lockMonth(data),
      onSuccess: (res) => {
         toast.success(res.data.message || 'Month locked successfully');
         queryClient.invalidateQueries({ queryKey: ['payrollHistory'] });
      },
      onError: (e) => toast.error(e.response?.data?.message || 'Locking failed')
   });


   const handleRun = () => {
      setIsSimulating(true);
      simulateMutation.mutate(filters);
   };

   const exportToCSV = () => {
      if (!simulatedData || simulatedData.length === 0) return;

      // Define headers
      const headers = [
         'Employee ID', 'Employee Name', 'Department', 'Designation', 'Payment Type',
         'Gross Earnings ($)', 'Total Deductions ($)', 'LOP Deductions ($)', 'Net Pay ($)'
      ];

      // Map data
      const csvData = (simulatedData || []).filter(s => !s.error && s.breakdown).map(s => [
         s.user?.employeeId || '',
         s.user?.name || '',
         s.user?.department || '',
         s.user?.designation || '',
         s.paymentType,
         s.breakdown?.earnings?.grossEarnings || 0,
         s.breakdown?.deductions?.totalDeductions || 0,
         s.breakdown?.deductions?.lopDeduction || 0,
         s.breakdown?.netPay || 0
      ]);

      // Convert to CSV string
      const csvContent = [
         headers.join(','),
         ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      // Trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payroll_export_${filters.month}_${filters.year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   const exportToBankFormat = () => {
      if (!simulatedData || simulatedData.length === 0) return;

      // Generate bank-compliant description: SALARY_MMM_YYYY (e.g. SALARY_MAR_2026)
      const getMonthName = (month) =>
         new Date(2026, month - 1).toLocaleString('en-US', { month: 'short' }).toUpperCase();
      const description = `SALARY_${getMonthName(filters.month)}_${filters.year}`;

      // Validate description before proceeding
      if (!description || description.length >= 30 || !/^[A-Z0-9_]+$/.test(description)) {
         toast.error('Invalid bank description. Must be uppercase, non-empty, and under 30 chars.');
         return;
      }

      // Bank format: Account Number, Beneficiary Name, Bank Name, IFSC, Amount, Description
      const headers = ['Account Number', 'Beneficiary Name', 'Bank Name', 'IFSC', 'Amount', 'Description'];
      const csvData = (simulatedData || []).filter(s => !s.error && s.breakdown).map(s => [
         s.user?.accountNumber || s.bankDetails?.accountNumber || `N/A-${s.user?.employeeId}`,
         s.user?.name || '',
         s.user?.bankName || s.bankDetails?.bankName || '',
         s.user?.ifscCode || s.bankDetails?.ifscCode || '',
         s.breakdown?.netPay || 0,
         description
      ]);

      const csvContent = [
         headers.join(','),
         ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bank_transfer_M${filters.month}_Y${filters.year}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
   };

   const readinessStats = React.useMemo(() => {
      const total = employeesList.length;
      const issues = [];
      const readyEmployees = [];

      employeesList.forEach(emp => {
         const profile = profiles?.find(p => (p.user?._id || p.user) === emp._id);
         const empIssues = [];

         if (!profile) empIssues.push('Salary Structure Missing');
         if (!emp.accountNumber) empIssues.push('Bank Account Missing');

         if (empIssues.length === 0) {
            readyEmployees.push(emp);
         } else {
            issues.push({ employee: emp, messages: empIssues });
         }
      });

      return {
         total,
         readyCount: readyEmployees.length,
         pendingProfiles: total - (profiles?.length || 0),
         errorCount: issues.length,
         issues
      };
   }, [employeesList, profiles]);

   const costStats = React.useMemo(() => {
      if (!simulatedData) return { gross: 0, deductions: 0, net: 0, count: 0 };
      const valid = simulatedData.filter(s => !s.error);
      return {
         gross: valid.reduce((acc, s) => acc + (s.breakdown?.earnings?.grossEarnings || 0), 0),
         deductions: valid.reduce((acc, s) => acc + (s.breakdown?.deductions?.totalDeductions || 0), 0),
         net: valid.reduce((acc, s) => acc + (s.breakdown?.netPay || 0), 0),
         count: valid.length
      };
   }, [simulatedData]);

   return (
      <PayrollPlaceholder
         title="Enterprise Payroll Control Panel"
         description="Command center for monthly payroll execution and organization-wide monitoring."
      >
         <div className="flex flex-col gap-10">
            {/* 1. Header & Status Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100 dark:shadow-none">
                     <ShieldCheck size={32} />
                  </div>
                  <div>
                     <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Enterprise Control Panel</h2>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${simulatedData ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                           {simulatedData ? 'READY TO EXECUTE' : 'PENDING SIMULATION'}
                        </span>
                     </div>
                     <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Lifecycle: {new Date(2024, filters.month - 1).toLocaleString('default', { month: 'long' })} {filters.year}</p>
                  </div>
               </div>

               <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="grid grid-cols-2 gap-2 flex-1 md:flex-none">
                     <select value={filters.month} onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#333333] text-sm font-bold outline-none appearance-none cursor-pointer dark:text-white">
                        {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1} className="dark:bg-[#111111]">{new Date(2024, i).toLocaleString('default', { month: 'long' })}</option>)}
                     </select>
                     <select value={filters.year} onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })} className="px-4 py-3 rounded-xl bg-slate-50 dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#333333] text-sm font-bold outline-none appearance-none cursor-pointer dark:text-white">
                        {[2024, 2025, 2026].map(y => <option key={y} value={y} className="dark:bg-[#111111]">{y}</option>)}
                     </select>
                  </div>
               </div>
            </div>

            {/* 2. KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
               {[
                  { label: 'Total Employees', value: readinessStats.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Ready for Payroll', value: readinessStats.readyCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Pending Profiles', value: readinessStats.pendingProfiles, icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Alerts / Issues', value: readinessStats.errorCount, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', urgent: readinessStats.errorCount > 0 },
                  { label: 'Estimated Cost', value: `${currencySymbol}${formatCurrency(costStats.net)}`, icon: Wallet, color: 'text-slate-900', bg: 'bg-slate-100' },

               ].map((kpi, i) => (
                  <div key={i} className={`bg-white dark:bg-[#111111] p-6 rounded-2xl border ${kpi.urgent ? 'border-rose-100 dark:border-rose-500/20 shadow-rose-50 dark:shadow-none' : 'border-slate-100 dark:border-[#333333]'} shadow-sm flex items-center gap-4 hover:shadow-md transition-all group`}>
                     <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-xl group-hover:scale-110 transition-transform`}>
                        <kpi.icon size={20} />
                     </div>
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                        <h4 className={`text-xl font-black ${kpi.urgent ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>{kpi.value}</h4>
                     </div>
                  </div>
               ))}
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
               {/* Column 1 & 2: Alerts & Readiness */}
               <div className="xl:col-span-2 space-y-10">
                  {/* Readiness Alerts */}
                  {readinessStats.issues.length > 0 && (
                     <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-50 dark:border-white/5 flex items-center gap-3">
                           <div className="w-8 h-8 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-lg flex items-center justify-center">
                              <AlertCircle size={18} />
                           </div>
                           <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Crucial Execution Alerts</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                           {readinessStats.issues.slice(0, 4).map((issue, idx) => (
                              <div key={idx} className="flex items-center gap-4 p-4 bg-rose-50/30 dark:bg-rose-500/5 rounded-2xl border border-rose-50 dark:border-rose-500/10 group hover:border-rose-100 dark:hover:border-rose-500/20 transition-all cursor-pointer">
                                 <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1a1a1a] flex items-center justify-center text-[10px] font-bold text-rose-500 shadow-sm border border-rose-100 dark:border-rose-500/10">
                                    {issue.employee.name[0]}
                                 </div>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-slate-800 dark:text-gray-200 truncate">{issue.employee.name}</p>
                                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest truncate">{issue.messages[0]}</p>
                                 </div>
                                 <ChevronRight size={14} className="text-rose-300 group-hover:translate-x-1 transition-transform" />
                              </div>
                           ))}
                           {readinessStats.issues.length > 4 && (
                              <button className="md:col-span-2 py-3 text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-50 transition-all rounded-xl border border-dashed border-rose-200">
                                 View all {readinessStats.issues.length} Issues
                              </button>
                           )}
                        </div>
                     </div>
                  )}

                  {/* Readiness Table */}
                  <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden">
                     <div className="p-8 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                        <div>
                           <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Payroll Readiness Table</h3>
                           <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-1">Cross-check profile and attendance status before commit</p>
                        </div>
                        <div className="flex gap-2">
                           <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all"><Search size={18} /></button>
                           <button className="p-2 text-slate-400 hover:text-indigo-600 transition-all"><Filter size={18} /></button>
                        </div>
                     </div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                           <thead>
                              <tr className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-[#333333]">
                                 <th className="px-8 py-4">Employee</th>
                                 <th className="px-6 py-4">Profile</th>
                                 <th className="px-6 py-4 text-center">Status</th>
                                 <th className="px-6 py-4 text-right">Preview</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                              {employeesList.slice(0, 10).map((emp, i) => {
                                 const profile = profiles?.find(p => (p.user?._id || p.user) === emp._id);
                                 const simulation = simulatedData?.find(s => s.user?._id === emp._id);
                                 return (
                                    <tr key={emp._id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                       <td className="px-8 py-4">
                                          <div className="flex items-center gap-3">
                                             <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-[#1a1a1a] flex items-center justify-center text-xs font-black text-slate-500 dark:text-gray-500 uppercase">
                                                {emp.name[0]}
                                             </div>
                                             <div>
                                                <p className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">{emp.name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tight">{emp.employeeId}</p>
                                             </div>
                                          </div>
                                       </td>
                                       <td className="px-6 py-4">
                                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest border ${profile ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                             {profile ? 'Configured' : 'Missing'}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-center">
                                          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${!profile || !emp.accountNumber ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                             <div className={`w-1.5 h-1.5 rounded-full ${!profile || !emp.accountNumber ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                             {!profile || !emp.accountNumber ? 'Warning' : 'Ready'}
                                          </div>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                          <p className="text-[11px] font-black text-slate-800 dark:text-white">
                                             {simulation ? `${currencySymbol}${formatCurrency(simulation.breakdown?.netPay)}` : '--'}
                                          </p>

                                       </td>
                                    </tr>
                                 );
                              })}
                           </tbody>
                        </table>
                        <div className="p-4 bg-slate-50/30 dark:bg-white/5 border-t border-slate-50 dark:border-[#333333] text-center">
                           <button className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest hover:text-indigo-600 transition-all">Displaying top 10 results — Scroll for more</button>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Column 3: Summary & Execution */}
               <div className="space-y-10">
                  {/* Cost Preview Sidebar */}
                  <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp size={120} />
                     </div>
                     <div className="relative z-10 space-y-8">
                        <div>
                           <h3 className="text-xs font-black uppercase tracking-widest text-white/40">Grand Total Preview</h3>
                           <h2 className="text-4xl font-black mt-2">{currencySymbol}{formatCurrency(costStats.net)}</h2>

                        </div>

                        <div className="space-y-4 pt-8 border-t border-white/10">
                           <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-white/40 uppercase tracking-widest">Gross Earning</span>
                              <span className="text-emerald-400">{currencySymbol}{formatCurrency(costStats.gross)}</span>

                           </div>
                           <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-white/40 uppercase tracking-widest">Total Liability</span>
                              <span className="text-rose-400">-{currencySymbol}{formatCurrency(costStats.deductions)}</span>

                           </div>
                           <div className="flex justify-between items-center text-xs font-bold pt-4 border-t border-white/5">
                              <span className="text-white/40 uppercase tracking-widest">Processed Nodes</span>
                              <span>{costStats.count} </span>
                           </div>
                        </div>

                        <div className="pt-4 flex flex-col gap-3">
                           {simulatedData ? (
                              <button onClick={() => setSimulatedData(null)} className="w-full py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest text-center transition-all">Discard Preview</button>
                           ) : (
                              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                                 <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest text-center">Run simulation to view precise costs</p>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* Execution Panel */}
                  <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm p-8 space-y-8">
                     <div className="space-y-2">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                           <Zap size={16} className="text-amber-500" /> Action Terminal
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest">Final Step: Commit organization payroll</p>
                     </div>

                     <div className="space-y-6">
                        {isSimulating ? (
                           <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Executing Simulation...</span>
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">74%</span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                 <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '74%' }}
                                    className="h-full bg-indigo-600 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)] dark:shadow-none"
                                 />
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Applying formula logic to employee nodes...</p>
                           </div>
                        ) : (
                           <button
                              onClick={handleRun}
                              className="w-full py-5 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-100 dark:shadow-none hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
                           >
                              <Play size={18} fill="currentColor" /> Run Payroll Simulation
                           </button>
                        )}

                        {simulatedData && (
                           <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-white/5">
                              <p className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest text-center mb-6">Simulation Successful — No Critical Faults</p>
                              <div className="grid grid-cols-2 gap-3">
                                 <button onClick={exportToCSV} className="py-3 bg-slate-50 dark:bg-[#1a1a1a] text-slate-600 dark:text-gray-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-[#222222] transition-all flex items-center justify-center gap-2">
                                    <Download size={14} /> Export CSV
                                 </button>
                                 <button onClick={exportToBankFormat} className="py-3 bg-slate-50 dark:bg-[#1a1a1a] text-slate-600 dark:text-gray-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-[#222222] transition-all flex items-center justify-center gap-2">
                                    <Building size={14} /> Bank File
                                 </button>
                              </div>
                              <button
                                 onClick={() => saveMutation.mutate(simulatedData.filter(s => !s.error))}
                                 disabled={saveMutation.isPending}
                                 className="w-full py-5 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-emerald-100 dark:shadow-none hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
                              >
                                 {saveMutation.isPending ? <Spinner size="sm" /> : <ShieldCheck size={18} />}
                                 {saveMutation.isPending ? 'Committing...' : 'Commit & Execute Payroll'}
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </PayrollPlaceholder>
   );
};

export const PayslipGeneration = () => {
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const [filters, setFilters] = React.useState({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      department: 'All',
      status: 'all'
   });
   const [searchTerm, setSearchTerm] = React.useState('');
   const [selectedRows, setSelectedRows] = React.useState([]);
   const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
   const [activePayslipId, setActivePayslipId] = React.useState(null);
   const [downloadingId, setDownloadingId] = React.useState(null);
   const [sendingEmailId, setSendingEmailId] = React.useState(null);
   const [markPaidConfirm, setMarkPaidConfirm] = React.useState({ isOpen: false, id: null, name: '' });
   const [bulkMarkPaidConfirm, setBulkMarkPaidConfirm] = React.useState(false);

   const { data: usersData } = useQuery({
      queryKey: ['usersListForPayslips'],
      queryFn: () => userAPI.getAll({ limit: 1000 }).then(res => res.data?.data || res.data || [])
   });

   const employeesList = React.useMemo(() => {
      const list = Array.isArray(usersData) ? usersData : usersData?.users || [];
      return list;
   }, [usersData]);

   const departments = React.useMemo(() => {
      return ['All', ...new Set(employeesList.map(e => e.department).filter(Boolean))];
   }, [employeesList]);

   const { data: payslips, isLoading: payslipsLoading } = useQuery({
      queryKey: ['payslipsList', filters],
      queryFn: () => payrollAPI.getGeneratedPayslips({
         month: filters.month,
         year: filters.year
      }).then(res => res.data.data)
   });

   const { data: history = [], isLoading: historyLoading } = useQuery({
      queryKey: ['processedHistoryCheck', filters.month, filters.year],
      queryFn: () => payrollAPI.getHistory({ month: filters.month, year: filters.year }).then(res => res.data.data)
   });

   const isLoading = payslipsLoading || historyLoading;

   const enrichedPayslips = React.useMemo(() => {
      if (!payslips) return [];
      return payslips.filter(p => {
         const matchesSearch = p.employeeInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.employeeInfo?.employeeId?.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesDept = filters.department === 'All' || p.employeeInfo?.department === filters.department;
         const matchesStatus = filters.status === 'all' || p.status?.toLowerCase() === filters.status.toLowerCase();
         return matchesSearch && matchesDept && matchesStatus;
      });
   }, [payslips, searchTerm, filters]);

   const stats = React.useMemo(() => {
      const total = history?.length || 0;
      const generated = payslips?.filter(p => p.status === 'GENERATED').length || 0;
      const paid = payslips?.filter(p => p.status === 'PAID').length || 0;
      const sent = payslips?.filter(p => p.status === 'SENT' || p.isEmailSent).length || 0;
      return { total, generated, paid, sent };
   }, [payslips, history]);

   const { data: selectedPayslip } = useQuery({
      queryKey: ['payslip', activePayslipId],
      queryFn: () => payrollAPI.getPayslip(activePayslipId).then(res => res.data.data),
      enabled: !!activePayslipId
   });

   // ─── Mark as Paid mutations ──────────────────────────────────────────────
   const markPaidMutation = useMutation({
      mutationFn: (id) => payrollAPI.markPayslipAsPaid(id),
      onSuccess: (_, id) => {
         queryClient.invalidateQueries({ queryKey: ['payslipsList'] });
         const record = (payslips || []).find(p => p.id === id);
         toast.success(`✅ Payslip for ${record?.employeeInfo?.name || 'employee'} marked as Paid.`);
         setMarkPaidConfirm({ isOpen: false, id: null, name: '' });
      },
      onError: (err) => {
         toast.error(`❌ Mark as Paid failed: ${err.response?.data?.message || err.message}`);
         setMarkPaidConfirm({ isOpen: false, id: null, name: '' });
      }
   });

   const bulkMarkPaidMutation = useMutation({
      mutationFn: (ids) => payrollAPI.bulkMarkPayslipsAsPaid(ids),
      onSuccess: (res) => {
         queryClient.invalidateQueries({ queryKey: ['payslipsList'] });
         const { success = 0, failed = 0 } = res.data?.data || {};
         if (failed > 0) toast(`⚠️ Marked ${success} as Paid. ${failed} failed.`);
         else toast.success(`✅ ${success} payslip(s) marked as Paid!`);
         setSelectedRows([]);
         setBulkMarkPaidConfirm(false);
      },
      onError: (err) => {
         toast.error(`❌ Bulk Mark as Paid failed: ${err.response?.data?.message || err.message}`);
         setBulkMarkPaidConfirm(false);
      }
   });

   const selectedGeneratedCount = selectedRows.filter(id => {
      const p = (payslips || []).find(x => x.id === id);
      return p?.status === 'GENERATED';
   }).length;

   // ─── Download ────────────────────────────────────────────────────────────
   const handleDownload = async (id) => {
      const targetId = id || activePayslipId;
      if (!targetId) return;

      const record = enrichedPayslips.find(p => p.id === targetId);
      const empName = record?.employeeInfo?.name || 'Employee';
      const monthName = new Date(filters.year, (record?.month || filters.month) - 1).toLocaleString('default', { month: 'long' });
      const filename = `Payslip-${record?.employeeInfo?.employeeId || 'Export'}-${monthName}-${record?.year || filters.year}.pdf`;

      const toastId = toast.loading(`Preparing payslip for ${empName}...`);
      try {
         setDownloadingId(targetId);

         // Wait for DOM to sync and render hidden preview
         setTimeout(async () => {
            const element = document.getElementById(`gen-capture-${targetId}`);
            if (!element) {
               toast.error(`Could not render payslip for ${empName}. Please try again.`, { id: toastId });
               setDownloadingId(null);
               return;
            }

            const success = await exportToPdf(element, { filename, pixelRatio: 3 });
            if (success) {
               toast.success(
                  `✅ Payslip downloaded successfully!
${filename}`,
                  { id: toastId, duration: 4000 }
               );
            } else {
               toast.error(`PDF generation failed for ${empName}. Please retry.`, { id: toastId });
            }
            setDownloadingId(null);
         }, 800);
      } catch (err) {
         setDownloadingId(null);
         console.error('Download error:', err);
         toast.error(`Failed to download payslip for ${empName}.`, { id: toastId });
      }
   };

   const handleBulkDownload = async () => {
      if (selectedRows.length === 0) {
         toast.error('Please select at least one employee first.');
         return;
      }
      const toastId = toast.loading(`Preparing ${selectedRows.length} payslip(s) for download...`);
      let success = 0;
      for (const id of selectedRows) {
         await handleDownload(id);
         success++;
      }
      toast.success(`✅ ${success} payslip(s) downloaded successfully!`, { id: toastId, duration: 4000 });
      setSelectedRows([]);
   };

   const handleSendEmail = (id, empRecord) => {
      const targetId = id || activePayslipId;
      if (!targetId) return;

      const empName = empRecord?.employeeInfo?.name || enrichedPayslips.find(p => p.id === targetId)?.employeeInfo?.name || 'employee';
      const empEmail = empRecord?.employeeInfo?.email || enrichedPayslips.find(p => p.id === targetId)?.employeeInfo?.email;

      setSendingEmailId(targetId);
      toast.promise(
         payrollAPI.sendPayslipEmail(targetId),
         {
            loading: `Sending payslip email to ${empName}...`,
            success: () => {
               setSendingEmailId(null);
               queryClient.invalidateQueries({ queryKey: ['payslipsList'] });
               return `✅ Payslip sent to ${empEmail || empName} successfully!`;
            },
            error: (err) => {
               setSendingEmailId(null);
               const msg = err.response?.data?.message || err.message || 'Unknown error';
               return `❌ Failed to send to ${empName}: ${msg}`;
            },
         }
      );
   };

   const handleBulkSend = () => {
      if (selectedRows.length === 0) {
         toast.error('Please select at least one employee.');
         return;
      }

      toast.promise(
         payrollAPI.bulkSendPayslipEmails(selectedRows),
         {
            loading: `Sending payslips to ${selectedRows.length} employee(s)...`,
            success: (res) => {
               setSelectedRows([]);
               queryClient.invalidateQueries({ queryKey: ['payslipsList'] });
               return `📦 ${selectedRows.length} payslip(s) queued for background delivery!`;
            },
            error: (err) => {
               const msg = err.response?.data?.message || err.message || 'Server error';
               return `❌ Bulk send failed: ${msg}`;
            },
         }
      );
   };

   const handleGenerate = () => {
      const monthLabel = new Date(filters.year, filters.month - 1).toLocaleString('default', { month: 'long' });
      toast.promise(
         payrollAPI.generatePayslips({ month: filters.month, year: filters.year }),
         {
            loading: `Generating payslips for ${monthLabel} ${filters.year}...`,
            success: (res) => {
               queryClient.invalidateQueries({ queryKey: ['payslipsList'] });
               const count = res.data?.data?.length || '';
               return `✅ ${count ? count + ' payslips' : 'Payslips'} generated successfully for ${monthLabel} ${filters.year}!`;
            },
            error: (err) => {
               const msg = err.response?.data?.message || err.message || 'Server error';
               return `❌ Generation failed: ${msg}`;
            },
         }
      );
   };

   const toggleRow = (id) => { setSelectedRows(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
   const toggleAll = () => { if (selectedRows.length === enrichedPayslips.length) setSelectedRows([]); else setSelectedRows(enrichedPayslips.map(p => p.id)); };

   const monthLabel = new Date(filters.year, filters.month - 1).toLocaleString('default', { month: 'long' });

   const StatusBadge = ({ status, isEmailSent }) => {
      const effectiveStatus = (status === 'SENT' || isEmailSent) ? 'SENT' : (status || 'GENERATED');
      const cfg = {
         GENERATED: { label: 'Generated', cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20', dot: 'bg-blue-400' },
         PAID:      { label: 'Paid',      cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-500' },
         SENT:      { label: 'Sent',      cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20', dot: 'bg-indigo-400' },
         PENDING:   { label: 'Pending',   cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-100 dark:border-amber-500/20', dot: 'bg-amber-400' },
      }[effectiveStatus] || { label: effectiveStatus, cls: 'bg-slate-50 dark:bg-white/10 text-slate-400 dark:text-gray-500 border-slate-100 dark:border-white/5', dot: 'bg-slate-300' };
      return (
         <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${cfg.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
         </span>
      );
   };

   return (
      <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-black min-h-screen font-sans text-slate-900 dark:text-gray-200">
         <style>{`
            @media print {
               .no-print { display: none !important; }
               .print-only { display: block !important; }
               body { background: white !important; }
            }
         `}</style>

         {/* ── Header ─────────────────────────────────────────────────── */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
               <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 dark:bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                     <Receipt size={24} />
                  </div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Payslip Generation</h1>
               </div>
               <p className="text-sm text-slate-500 dark:text-gray-400 font-medium mt-1 ml-14">Generate payslips → Mark as Paid → Send by email</p>
               <div className="flex items-center gap-2 ml-14 mt-3">
                  {[
                     { label: 'Processed', done: stats.total > 0, color: 'bg-slate-400' },
                     { label: 'Generated', done: (stats.generated + stats.paid + stats.sent) > 0, color: 'bg-blue-500' },
                     { label: 'Paid', done: (stats.paid + stats.sent) > 0, color: 'bg-emerald-500' },
                     { label: 'Sent', done: stats.sent > 0, color: 'bg-indigo-500' },
                  ].map((step, i, arr) => (
                     <React.Fragment key={step.label}>
                        <div className="flex items-center gap-1.5">
                           <div className={`w-2 h-2 rounded-full transition-colors ${step.done ? step.color : 'bg-slate-200 dark:bg-white/10'}`} />
                           <span className={`text-[10px] font-black uppercase tracking-widest ${step.done ? 'text-slate-700 dark:text-gray-300' : 'text-slate-300 dark:text-gray-600'}`}>{step.label}</span>
                        </div>
                        {i < arr.length - 1 && <div className="w-6 h-px bg-slate-200 dark:bg-white/5" />}
                     </React.Fragment>
                  ))}
               </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
               <button
                  onClick={handleGenerate}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] text-slate-700 dark:text-gray-200 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] rounded-xl text-sm font-bold transition-all shadow-sm"
               >
                  <RefreshCw size={16} className="text-indigo-600 dark:text-indigo-400" />
                  Generate Payslips
               </button>
               <button
                  onClick={() => handleBulkSend()}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-indigo-100 dark:shadow-none border border-indigo-500"
               >
                  <Send size={16} />
                  Send All
               </button>
            </div>
         </div>

         {/* ── KPI Cards ──────────────────────────────────────────────── */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
               { label: 'Payroll Records', value: stats.total, icon: Users, color: 'slate', desc: 'Processed employees' },
               { label: 'Generated', value: stats.generated, icon: FileText, color: 'blue', desc: 'Statements ready' },
               { label: 'Marked as Paid', value: stats.paid, icon: CreditCard, color: 'emerald', desc: 'Salary disbursed' },
               { label: 'Sent to Employees', value: stats.sent, icon: Mail, color: 'indigo', desc: 'Emails dispatched' },
            ].map((kpi, i) => (
               <div key={i} className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm hover:shadow-md transition-all group flex items-center gap-4">
                  <div className={`p-3 bg-${kpi.color}-50 dark:bg-${kpi.color}-500/10 text-${kpi.color}-600 dark:text-${kpi.color}-400 rounded-xl group-hover:scale-110 transition-transform flex-shrink-0`}>
                     <kpi.icon size={22} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest leading-none mb-1">{kpi.label}</p>
                     <h4 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{kpi.value}</h4>
                     <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">{kpi.desc}</p>
                  </div>
               </div>
            ))}
         </div>

         {/* 🔍 Filters & Search */}
         <div className="bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-100 dark:border-[#333333] shadow-sm flex flex-wrap items-center gap-4">
            <div className="flex items-center bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg p-1 shadow-inner">
               <select
                  value={filters.month}
                  onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
                  className="bg-transparent px-3 py-1.5 text-xs font-black outline-none tracking-tight cursor-pointer border-r border-slate-200 dark:text-white"
               >
                  {[...Array(12)].map((_, i) => (
                     <option key={i + 1} value={i + 1} className="dark:bg-[#111111]">{new Date(2024, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
               </select>
               <select
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                  className="bg-transparent px-3 py-1.5 text-xs font-black outline-none tracking-tight cursor-pointer dark:text-white"
               >
                  {[2024, 2025, 2026].map(y => <option key={y} value={y} className="dark:bg-[#111111]">{y}</option>)}
               </select>
            </div>

            <div className="flex-1 min-w-[250px] relative">
               <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input
                  type="text"
                  placeholder="Search employee by name or ID..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>

            <div className="flex items-center gap-3">
               <div className="flex items-center gap-2">
                  <Filter size={14} className="text-slate-400" />
                  <select
                     value={filters.department}
                     onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                     className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-2 text-xs font-bold outline-none cursor-pointer dark:text-white"
                  >
                     {departments.map(d => <option key={d} value={d} className="dark:bg-[#111111]">{d === 'All' ? 'All Departments' : d}</option>)}
                  </select>
               </div>
               <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-2 text-xs font-bold outline-none cursor-pointer dark:text-white"
               >
                  <option value="all" className="dark:bg-[#111111]">All Status</option>
                  <option value="GENERATED" className="dark:bg-[#111111]">Generated</option>
                  <option value="PAID" className="dark:bg-[#111111]">Paid</option>
                  <option value="SENT" className="dark:bg-[#111111]">Sent</option>
               </select>
            </div>
         </div>

         {/* 📋 Employee Payslip Table */}
         <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden flex flex-col">
            {/* ── Bulk Action Overlay ─────────────────────────────────── */}
            {selectedRows.length > 0 && (
               <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-white">
                     <span className="text-sm font-black">{selectedRows.length} selected</span>
                     <div className="h-4 w-px bg-white/20" />
                     <button onClick={toggleAll} className="text-[10px] font-black uppercase tracking-widest hover:underline opacity-80">Deselect All</button>
                  </div>
                  <div className="flex items-center gap-2">
                     <button onClick={handleBulkDownload} className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                        <Download size={14} /> PDF
                     </button>
                     {selectedGeneratedCount > 0 && (
                        <button
                           onClick={() => setBulkMarkPaidConfirm(true)}
                           className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                        >
                           <CreditCard size={14} /> Mark {selectedGeneratedCount} as Paid
                        </button>
                     )}
                     <button onClick={handleBulkSend} className="px-4 py-1.5 bg-white text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-all flex items-center gap-2">
                        <Mail size={14} /> Send Email
                     </button>
                  </div>
               </div>
            )}

            <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-slate-50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-[#333333]">
                        <th className="px-6 py-4 w-10">
                           <input
                              type="checkbox"
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              checked={selectedRows.length === enrichedPayslips.length && enrichedPayslips.length > 0}
                              onChange={toggleAll}
                           />
                        </th>
                        <th className="px-6 py-4">Employee</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4 text-right">Gross Amount</th>
                        <th className="px-6 py-4 text-right">Deductions</th>
                        <th className="px-6 py-4 text-right">Net Payout</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-[#333333]">
                     {isLoading ? (
                        <tr>
                           <td colSpan="8" className="px-6 py-20 text-center">
                              <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto mb-2" />
                              <p className="text-sm font-bold text-slate-400 animate-pulse">Synchronizing Ledger...</p>
                           </td>
                        </tr>
                     ) : enrichedPayslips.length === 0 ? (
                        <tr>
                           <td colSpan="8" className="px-6 py-32 text-center">
                              <div className="max-w-xs mx-auto space-y-4">
                                 <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-300 dark:text-gray-600">
                                    <Receipt size={40} />
                                 </div>
                                 {history?.length > 0 ? (
                                    <div className="space-y-4">
                                       <div>
                                          <h3 className="text-slate-900 dark:text-white font-bold">Payroll Processed but Statements Not Generated</h3>
                                          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">We found {history.length} processed payroll records for {new Date(2024, filters.month - 1).toLocaleString('default', { month: 'long' })} ready for final statement generation.</p>
                                       </div>
                                       <button
                                          onClick={handleGenerate}
                                          className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none flex items-center justify-center gap-2 mx-auto"
                                       >
                                          <RefreshCw size={14} /> Generate & Finalize Payslips
                                       </button>
                                       <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-2 italic">Generating payslips will create immutable records for employee distribution.</p>
                                    </div>
                                 ) : (
                                    <div className="space-y-4">
                                       <div>
                                          <h3 className="text-slate-900 dark:text-white font-bold">No Payslips Generated Yet</h3>
                                          <p className="text-slate-500 dark:text-gray-400 text-xs mt-1">Start by processing payroll for {new Date(2024, filters.month - 1).toLocaleString('default', { month: 'long' })} to generate statements.</p>
                                       </div>
                                       <button
                                          onClick={() => navigate('/payroll/run')}
                                          className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none"
                                       >
                                          Run Payroll Wizard
                                       </button>
                                       <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-2">Payslips are only available after payroll execution.</p>
                                    </div>
                                 )}
                              </div>
                           </td>
                        </tr>
                     ) : enrichedPayslips.map((p) => {
                        const isGenerated = p.isGenerated || p.status === 'GENERATED';
                        const isPaid = p.status === 'PAID';
                        const isSent = p.status === 'SENT' || p.isEmailSent;
                        const canSendEmail = isPaid || isSent;
                        return (
                        <tr key={p.id} className={`group hover:bg-indigo-50/30 dark:hover:bg-indigo-500/10 transition-colors ${selectedRows.includes(p.id) ? 'bg-indigo-50/50 dark:bg-indigo-500/20' : ''}`}>
                           <td className="px-6 py-4">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" checked={selectedRows.includes(p.id)} onChange={() => toggleRow(p.id)} />
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-sm flex-shrink-0">{p.employeeInfo?.name?.charAt(0) || 'E'}</div>
                                 <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-none mb-1">{p.employeeInfo?.name}</p>
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 tracking-tighter uppercase">{p.employeeInfo?.employeeId} • {p.employeeInfo?.department}</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-4"><p className="text-xs font-bold text-slate-700 dark:text-gray-300">{p.employeeInfo?.designation || 'Technical Staff'}</p></td>
                           <td className="px-6 py-4 text-right font-bold text-slate-600 dark:text-gray-400">{currencySymbol}{formatCurrency(p.gross || 0)}</td>
                           <td className="px-6 py-4 text-right font-bold text-rose-500">-{currencySymbol}{formatCurrency(p.totalDeductions || 0)}</td>
                           <td className="px-6 py-4 text-right">
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{currencySymbol}{formatCurrency(p.netPay || 0)}</span>
                              {p.paidAt && <p className="text-[9px] font-bold text-slate-400 dark:text-gray-500 mt-0.5">Paid {new Date(p.paidAt).toLocaleDateString()}</p>}
                           </td>
                           <td className="px-6 py-4 text-center">
                              <StatusBadge status={p.status} isEmailSent={p.isEmailSent} />
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                 <button onClick={() => { setActivePayslipId(p.id); setIsPreviewOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="View Statement"><Eye size={16} /></button>
                                 <button onClick={() => handleDownload(p.id)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all" title="Download PDF">
                                    {downloadingId === p.id ? <RefreshCw size={16} className="animate-spin text-indigo-600" /> : <Download size={16} />}
                                 </button>
                                 {isGenerated && (
                                    <button
                                       onClick={() => setMarkPaidConfirm({ isOpen: true, id: p.id, name: p.employeeInfo?.name || 'employee' })}
                                       className="p-2 text-slate-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                       title="Mark as Paid — confirm salary disbursement"
                                    ><CreditCard size={16} /></button>
                                 )}
                                 {(isPaid && !isSent) && <span className="p-2 text-emerald-500 dark:text-emerald-400" title="Salary Paid"><Check size={16} /></span>}
                                 <button
                                    onClick={() => canSendEmail ? handleSendEmail(p.id, p) : (isGenerated ? toast.error('Mark this payslip as Paid before sending.') : toast.error('Generate this payslip before sending.'))}
                                    className={`p-2 rounded-lg transition-all ${canSendEmail ? (isSent ? 'text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/10' : 'text-slate-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10') : 'text-slate-200 dark:text-gray-800 cursor-not-allowed'}`}
                                    title={canSendEmail ? (isSent ? `Resend email` : `Send payslip email`) : 'Mark as Paid before sending'}
                                 >
                                    {sendingEmailId === p.id ? <RefreshCw size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" /> : <Mail size={16} />}
                                 </button>
                              </div>
                           </td>
                        </tr>
                        );
                     })}

                  </tbody>
               </table>
            </div>
         </div>

         {/* ── Preview Drawer ─────────────────────────────────────── */}
         {isPreviewOpen && selectedPayslip && (
            <StatementPreview payslip={selectedPayslip} settings={settings} onClose={() => setIsPreviewOpen(false)} onDownload={handleDownload} />
         )}

         {/* ── PDF Capture Module ────────────────────────────────── */}
         {downloadingId && (
            <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px' }}>
               <div id={`gen-capture-${downloadingId}`}>
                  <StatementPreview payslip={enrichedPayslips.find(p => p.id === downloadingId)} settings={settings} contentOnly={true} />
               </div>
            </div>
         )}

         {/* ── Single Mark as Paid Confirm ────────────────────────── */}
         <ConfirmModal
            isOpen={markPaidConfirm.isOpen}
            onClose={() => setMarkPaidConfirm({ isOpen: false, id: null, name: '' })}
            onConfirm={() => markPaidMutation.mutate(markPaidConfirm.id)}
            title="Confirm Salary Disbursement"
            message={
               <div className="space-y-3">
                  <p className="text-slate-700 dark:text-gray-300">You are about to mark <strong>{markPaidConfirm.name}</strong>'s payslip as <strong className="text-emerald-700 dark:text-emerald-400">PAID</strong>.</p>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                     <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                     <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">This confirms salary has been disbursed. This action is logged and auditable.</p>
                  </div>
               </div>
            }
            confirmText="Yes, Mark as Paid"
            isLoading={markPaidMutation.isPending}
         />

         {/* ── Bulk Mark as Paid Confirm ──────────────────────────── */}
         <ConfirmModal
            isOpen={bulkMarkPaidConfirm}
            onClose={() => setBulkMarkPaidConfirm(false)}
            onConfirm={() => {
               const generatedIds = selectedRows.filter(id => {
                  const p = (payslips || []).find(x => x.id === id);
                  return p?.status === 'GENERATED';
               });
               bulkMarkPaidMutation.mutate(generatedIds);
            }}
            title="Confirm Bulk Salary Disbursement"
            message={
               <div className="space-y-3">
                  <p className="text-slate-700">You are marking <strong>{selectedGeneratedCount} payslip(s)</strong> as <strong className="text-emerald-700">PAID</strong>.</p>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                     <AlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                     <p className="text-xs text-amber-700 font-medium">Only GENERATED payslips will be updated. This action is logged and auditable.</p>
                  </div>
               </div>
            }
            confirmText={`Confirm — Mark ${selectedGeneratedCount} as Paid`}
            isLoading={bulkMarkPaidMutation.isPending}
         />
      </div>
   );
};


export const TaxesDeductions = () => {
   const queryClient = useQueryClient();
   const { data: settings, isLoading } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });

   const [isEditing, setIsEditing] = React.useState(false);
   const [formData, setFormData] = React.useState(null);
   const [selectedFY, setSelectedFY] = React.useState('2024-25');
   const [previewSalary, setPreviewSalary] = React.useState(100000);

   React.useEffect(() => {
      if (settings && !formData) {
         setFormData(settings);
      }
   }, [settings, formData]);

   const mutation = useMutation({
      mutationFn: (data) => settingsAPI.updateSettings(data),
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ['settings'] });
         toast.success('Compliance Policy Synchronized');
         setIsEditing(false);
      },
      onError: (err) => toast.error('Sync Failure: ' + err.message)
   });

   if (isLoading || !formData) return <div className="h-96 flex items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent animate-spin rounded-full" /></div>;

   const payroll = formData.payroll || {};
   const taxSlabs = payroll.taxSlabs || [];
   const currencySymbol = formData.organization?.currency ? getCurrencySymbol(formData.organization.currency) : (payroll.currencySymbol || '₹');

   const handleSave = () => mutation.mutate(formData);

   const updatePayroll = (field, value) => {
      setFormData(prev => ({
         ...prev,
         payroll: { ...prev.payroll, [field]: value }
      }));
   };

   const updateToggle = (field, value) => {
      setFormData(prev => ({
         ...prev,
         payroll: {
            ...prev.payroll,
            taxToggles: { ...prev.payroll.taxToggles, [field]: value }
         }
      }));
   };

   const addSlab = () => {
      const lastSlab = taxSlabs[taxSlabs.length - 1] || { max: 0 };
      updatePayroll('taxSlabs', [...taxSlabs, { min: lastSlab.max + 1, max: lastSlab.max + 250000, rate: 0 }]);
   };

   const updateSlab = (idx, field, val) => {
      const newSlabs = [...taxSlabs];
      newSlabs[idx][field] = Number(val);
      updatePayroll('taxSlabs', newSlabs);
   };

   const removeSlab = (idx) => {
      updatePayroll('taxSlabs', taxSlabs.filter((_, i) => i !== idx));
   };

   // 📊 Tax Preview Calculation (Simplistic)
   const calculatePreview = () => {
      const annual = previewSalary * 12;
      const stdDed = payroll.standardDeduction || 50000;
      const taxable = Math.max(0, annual - stdDed);
      let tax = 0;
      taxSlabs.forEach(s => {
         if (taxable > s.min) {
            tax += (Math.min(taxable, s.max || Infinity) - s.min) * (s.rate / 100);
         }
      });
      const monthlyTax = tax / 12;
      const pf = payroll.taxToggles?.pf ? (Math.min(previewSalary * 0.4, payroll.pfWageLimit || 15000) * (payroll.pfRate || 12)) / 100 : 0;
      const esi = (payroll.taxToggles?.esi && previewSalary <= (payroll.esiLimit || 21000)) ? (previewSalary * (payroll.esiRate || 0.75)) / 100 : 0;
      return { tax: monthlyTax, pf, esi, net: previewSalary - monthlyTax - pf - esi };
   };

   const preview = calculatePreview();

   return (
      <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-black min-h-screen">
         {/* 🚀 Dynamic Header */}
         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm">
            <div className="flex items-center gap-5">
               <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none">
                  <ShieldCheck size={28} />
               </div>
               <div>
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Taxes & Compliance</h1>
                  <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Configure statutory rules, tax slabs, and deduction policies</p>
               </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
               <div className="flex items-center bg-slate-50 dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl p-1 shadow-inner">
                  <select
                     value={selectedFY}
                     onChange={(e) => setSelectedFY(e.target.value)}
                     className="bg-transparent px-4 py-2 text-xs font-black uppercase outline-none cursor-pointer border-r border-slate-200 dark:border-white/5 dark:text-white"
                  >
                     <option value="2023-24" className="dark:bg-[#111111]">FY 2023-24</option>
                     <option value="2024-25" className="dark:bg-[#111111]">FY 2024-25</option>
                  </select>
                  <select
                     value={payroll.country || 'India'}
                     onChange={(e) => updatePayroll('country', e.target.value)}
                     className="bg-transparent px-4 py-2 text-xs font-black uppercase outline-none cursor-pointer dark:text-white"
                  >
                     <option value="India" className="dark:bg-[#111111]">🇮🇳 India</option>
                     <option value="USA" className="dark:bg-[#111111]">🇺🇸 USA</option>
                     <option value="UAE" className="dark:bg-[#111111]">🇦🇪 UAE</option>
                  </select>
               </div>

               <button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isEditing ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-none' : 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg shadow-slate-100 dark:shadow-none'}`}
               >
                  {isEditing ? <><Save size={16} /> Save Policy</> : <><Edit3 size={16} /> Edit Policy</>}
               </button>
            </div>
         </div>

         {/* 📊 Compliance Health Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
               { label: 'Tax Regime', val: payroll.taxRegime || 'OLD', sub: 'Standard Progressive', icon: Percent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
               { label: 'PF Status', val: payroll.taxToggles?.pf ? 'ACTIVE' : 'INACTIVE', sub: `${payroll.pfRate || 12}% Contribution`, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
               { label: 'ESI Status', val: payroll.taxToggles?.esi ? 'ACTIVE' : 'INACTIVE', sub: `${payroll.esiRate || 0.75}% Health Cover`, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
               { label: 'Compliance Health', val: '98%', sub: 'No Critical Alerts', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' }
            ].map((kpi, i) => (
               <div key={i} className="bg-white dark:bg-[#111111] p-6 rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm group hover:shadow-md transition-all">
                  <div className={`p-2.5 w-fit rounded-xl ${kpi.bg} dark:bg-white/5 ${kpi.color} mb-4 group-hover:scale-110 transition-transform`}>
                     <kpi.icon size={20} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">{kpi.val}</h4>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">{kpi.sub}</p>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
            {/* 🧾 Income Tax Section */}
            <div className="xl:col-span-2 space-y-8">
               <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                     <div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Income Tax (TDS) Configuration</h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase">Configure annual tax brackets and exemptions</p>
                     </div>
                     <div className="flex items-center bg-slate-50 dark:bg-[#1a1a1a] p-1 rounded-lg border border-slate-200 dark:border-[#333333]">
                        <button
                           onClick={() => updatePayroll('taxRegime', 'OLD')}
                           className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all ${payroll.taxRegime === 'OLD' ? 'bg-white dark:bg-[#222222] shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-white'}`}
                        >Old Regime</button>
                        <button
                           onClick={() => updatePayroll('taxRegime', 'NEW')}
                           className={`px-3 py-1 text-[10px] font-black uppercase rounded-md transition-all ${payroll.taxRegime === 'NEW' ? 'bg-white dark:bg-[#222222] shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-white'}`}
                        >New Regime</button>
                     </div>
                  </div>

                  <div className="p-8 space-y-8">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-6 bg-slate-50 dark:bg-[#1a1a1a] rounded-2xl border border-slate-100 dark:border-[#333333]">
                           <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest block mb-4">Standard Deduction (Annual)</label>
                           <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-slate-400 dark:text-gray-600">{currencySymbol}</span>
                              <input
                                 type="number"
                                 disabled={!isEditing}
                                 className="bg-transparent text-xl font-black text-slate-900 dark:text-white outline-none w-full disabled:opacity-60"
                                 value={payroll.standardDeduction || 50000}
                                 onChange={e => updatePayroll('standardDeduction', e.target.value)}
                              />
                           </div>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-[#1a1a1a] rounded-2xl border border-slate-100 dark:border-[#333333]">
                           <label className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest block mb-4">TDS Exemption Threshold</label>
                           <div className="flex items-center gap-3">
                              <span className="text-xl font-black text-slate-400 dark:text-gray-600">{currencySymbol}</span>
                              <input
                                 type="number"
                                 disabled={!isEditing}
                                 className="bg-transparent text-xl font-black text-slate-900 dark:text-white outline-none w-full disabled:opacity-60"
                                 value={payroll.tdsThreshold || 50000}
                                 onChange={e => updatePayroll('tdsThreshold', e.target.value)}
                              />
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex justify-between items-center px-4">
                           <h4 className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Tax Bracket Table</h4>
                           {isEditing && (
                              <button onClick={addSlab} className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:underline">
                                 <Plus size={14} /> Add New Slab
                              </button>
                           )}
                        </div>

                        <div className="space-y-3">
                           {taxSlabs.map((s, i) => (
                              <div key={i} className="flex flex-wrap items-center gap-4 p-4 bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-[#333333] rounded-2xl hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-colors shadow-sm">
                                 <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center text-[10px] font-black text-slate-400 dark:text-gray-500">{i + 1}</div>
                                 <div className="flex-1 min-w-[120px]">
                                    <p className="text-[9px] font-black text-slate-300 dark:text-gray-600 uppercase mb-1">Min. Amount</p>
                                    <input type="number" disabled={!isEditing} className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-gray-300 outline-none disabled:opacity-60" value={s.min} onChange={e => updateSlab(i, 'min', e.target.value)} />
                                 </div>
                                 <div className="flex-1 min-w-[120px]">
                                    <p className="text-[9px] font-black text-slate-300 dark:text-gray-600 uppercase mb-1">Max. Amount</p>
                                    <input type="number" disabled={!isEditing} className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-gray-300 outline-none disabled:opacity-60" value={s.max} onChange={e => updateSlab(i, 'max', e.target.value)} />
                                 </div>
                                 <div className="w-24">
                                    <p className="text-[9px] font-black text-slate-300 dark:text-gray-600 uppercase mb-1">Tax Rate</p>
                                    <div className="flex items-center gap-1">
                                       <input type="number" disabled={!isEditing} className="w-full bg-transparent text-sm font-black text-indigo-600 dark:text-indigo-400 outline-none disabled:opacity-60" value={s.rate} onChange={e => updateSlab(i, 'rate', e.target.value)} />
                                       <span className="text-sm font-black text-indigo-400">%</span>
                                    </div>
                                 </div>
                                 {isEditing && (
                                    <button onClick={() => removeSlab(i)} className="p-2 text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors">
                                       <Trash2 size={16} />
                                    </button>
                                 )}
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>

               {/* ⚙️ Statutory Components */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* PF Card */}
                  <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm p-8 space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center"><Shield size={22} /></div>
                           <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">Provident Fund (PF)</h3>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={payroll.taxToggles?.pf} onChange={e => updateToggle('pf', e.target.checked)} disabled={!isEditing} className="sr-only peer" />
                           <div className="w-11 h-6 bg-slate-200 dark:bg-[#222222] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                     </div>
                     <div className="space-y-5">
                        <div className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-white/5">
                           <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase">Employee Contribution</span>
                           <div className="flex items-center gap-1">
                              <input type="number" disabled={!isEditing} className="w-12 text-right bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none" value={payroll.pfRate || 12} onChange={e => updatePayroll('pfRate', e.target.value)} />
                              <span className="text-sm font-black text-slate-400 dark:text-gray-600">%</span>
                           </div>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-white/5">
                           <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase">Employer Contribution</span>
                           <div className="flex items-center gap-1">
                              <input type="number" disabled={!isEditing} className="w-12 text-right bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none" value={payroll.pfEmployerRate || 12} onChange={e => updatePayroll('pfEmployerRate', e.target.value)} />
                              <span className="text-sm font-black text-slate-400 dark:text-gray-600">%</span>
                           </div>
                        </div>
                        <div className="flex justify-between items-center py-3">
                           <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase">Monthly Wage Limit</span>
                           <div className="flex items-center gap-1">
                              <span className="text-sm font-black text-slate-400 dark:text-gray-600">{currencySymbol}</span>
                              <input type="number" disabled={!isEditing} className="w-20 text-right bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none" value={payroll.pfWageLimit || 15000} onChange={e => updatePayroll('pfWageLimit', e.target.value)} />
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* ESI Card */}
                  <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm p-8 space-y-6">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center"><Activity size={22} /></div>
                           <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase">Employees State Insurance</h3>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" checked={payroll.taxToggles?.esi} onChange={e => updateToggle('esi', e.target.checked)} disabled={!isEditing} className="sr-only peer" />
                           <div className="w-11 h-6 bg-slate-200 dark:bg-[#222222] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                     </div>
                     <div className="space-y-5">
                        <div className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-white/5">
                           <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase">Employee Rate</span>
                           <div className="flex items-center gap-1">
                              <input type="number" step="0.01" disabled={!isEditing} className="w-12 text-right bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none" value={payroll.esiRate || 0.75} onChange={e => updatePayroll('esiRate', e.target.value)} />
                              <span className="text-sm font-black text-slate-400 dark:text-gray-600">%</span>
                           </div>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-white/5">
                           <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase">Employer Rate</span>
                           <div className="flex items-center gap-1">
                              <input type="number" step="0.01" disabled={!isEditing} className="w-12 text-right bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none" value={payroll.esiEmployerRate || 3.25} onChange={e => updatePayroll('esiEmployerRate', e.target.value)} />
                              <span className="text-sm font-black text-slate-400 dark:text-gray-600">%</span>
                           </div>
                        </div>
                        <div className="flex justify-between items-center py-3">
                           <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase">Max Gross Salary Cap</span>
                           <div className="flex items-center gap-1">
                              <span className="text-sm font-black text-slate-400 dark:text-gray-600">{currencySymbol}</span>
                              <input type="number" disabled={!isEditing} className="w-20 text-right bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none" value={payroll.esiLimit || 21000} onChange={e => updatePayroll('esiLimit', e.target.value)} />
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            {/* 📊 Tax Preview Panel (Sidebar) */}
            <div className="xl:col-span-1 space-y-8">
               <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 p-8 opacity-5 -translate-x-1/4 -translate-y-1/4"><Calculator size={180} /></div>
                  <div className="relative z-10 space-y-8">
                     <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Quick Simulation</h3>
                        <h2 className="text-xl font-black mt-2">Tax Preview Calculator</h2>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Gross Monthly Salary</label>
                           <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-black">{currencySymbol}</span>
                              <input
                                 type="number"
                                 className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-10 pr-4 text-xl font-black outline-none focus:border-indigo-500 transition-all placeholder:text-white/10"
                                 value={previewSalary}
                                 onChange={e => setPreviewSalary(Number(e.target.value))}
                                 placeholder="Enter amount..."
                              />
                           </div>
                        </div>

                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                           <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-white/60">Estimated Income Tax</span>
                              <span className="text-rose-400">-{currencySymbol}{formatCurrency(preview.tax)}</span>

                           </div>
                           <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-white/60">Provident Fund (EE)</span>
                              <span className="text-amber-400">-{currencySymbol}{formatCurrency(preview.pf)}</span>

                           </div>
                           <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-white/60">ESI Contribution</span>
                              <span className="text-blue-400">-{currencySymbol}{formatCurrency(preview.esi)}</span>

                           </div>
                           <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                              <span className="text-sm font-black text-indigo-400 uppercase tracking-widest">Net Payout</span>
                              <span className="text-2xl font-black">{currencySymbol}{formatCurrency(preview.net)}</span>

                           </div>
                        </div>

                        <div className="flex flex-col gap-3">
                           <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10">
                              <div className="p-2 bg-indigo-500 rounded-lg"><AlertCircle size={14} /></div>
                              <p className="text-[10px] font-medium leading-relaxed text-indigo-100/60 uppercase tracking-wider">Estimated based on <span className="text-white font-bold">{payroll.taxRegime}</span> tax regime settings.</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* 📅 FY History Sidebar */}
               <div className="bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm p-8 space-y-6">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest">Compliance Timeline</h3>
                  <div className="space-y-4">
                     {[
                        { fy: '2024-25', status: 'Active', color: 'bg-emerald-500', tColor: 'text-emerald-600' },
                        { fy: '2023-24', status: 'Archived', color: 'bg-slate-300', tColor: 'text-slate-500' },
                        { fy: '2022-23', status: 'Archived', color: 'bg-slate-300', tColor: 'text-slate-500' }
                     ].map((item, i) => (
                        <div key={i} className="flex items-center gap-4 group cursor-pointer">
                           <div className={`w-1.5 h-10 rounded-full ${item.color} group-hover:scale-y-110 transition-transform`} />
                           <div>
                              <p className="text-sm font-black text-slate-800 dark:text-white tracking-tight">Financial Year {item.fy}</p>
                              <p className={`text-[10px] font-black uppercase ${item.tColor}`}>{item.status}</p>
                           </div>
                        </div>
                     ))}
                  </div>
                  <button className="w-full py-3 bg-slate-50 dark:bg-white/5 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-white/10 transition-all">Create New FY Policy</button>
               </div>
            </div>
         </div>
      </div>
   );
};

export const PayrollReports = () => {
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const { data: history } = useQuery({
      queryKey: ['payrollHistory'],
      queryFn: () => payrollAPI.getHistory().then(res => res.data.data)
   });

   const [chartType, setChartType] = React.useState('area');
   const [timeRange, setTimeRange] = React.useState(6);
   const [selectedMetric, setSelectedMetric] = React.useState('netPay');
   const [tableFilter, setTableFilter] = React.useState('All');

   const safe = (val) => Number(val || 0);

   const processedData = React.useMemo(() => {
      if (!history) return { trends: [], depts: [], summary: {} };

      // 1. Trends Calculation based on metric and time range
      const monthMap = {};
      const allMonths = [];
      const now = new Date();
      for (let i = 0; i < timeRange; i++) {
         const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
         const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
         allMonths.push({ key, label: `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear().toString().slice(-2)}`, month: d.getMonth() + 1, year: d.getFullYear() });
      }
      allMonths.reverse();

      history.forEach(p => {
         const key = `${p.year}-${p.month}`;
         if (!monthMap[key]) monthMap[key] = { grossPay: 0, netPay: 0, deductions: 0, employees: new Set() };
         monthMap[key].grossPay += safe(p.grossYield || p.breakdown?.grossPay || p.breakdown?.earnings?.grossEarnings);
         monthMap[key].netPay += safe(p.netPay || p.breakdown?.netPay);
         monthMap[key].deductions += safe(p.liability || p.breakdown?.totalDeductions || p.breakdown?.deductions?.totalDeductions);
         monthMap[key].employees.add(p.employeeId || p.userId || p.user?._id || p.user);
      });

      const trends = allMonths.map(m => {
         const data = monthMap[m.key] || { grossPay: 0, netPay: 0, deductions: 0, employees: new Set() };
         return {
            name: m.label,
            grossPay: data.grossPay,
            netPay: data.netPay,
            deductions: data.deductions,
            employees: data.employees.size,
            value: selectedMetric === 'employees' ? data.employees.size : data[selectedMetric] || 0
         };
      });

      // 2. Department Distribution
      const depts = history.reduce((acc, p) => {
         const d = p.employeeInfo?.department || p.employee?.department?.name || p.user?.department || 'Operations';
         acc[d] = (acc[d] || 0) + safe(p.grossYield || p.breakdown?.grossPay || p.breakdown?.earnings?.grossEarnings);
         return acc;
      }, {});
      const colors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
      const deptList = Object.entries(depts).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));

      // 3. Current Month Stats & Insights (Fixed: Using Latest History Data)
      const sortedMonths = Object.keys(monthMap).sort((a, b) => {
         const [y1, m1] = a.split('-').map(Number);
         const [y2, m2] = b.split('-').map(Number);
         return y2 - y1 || m2 - m1;
      });
      const latestMonthKey = sortedMonths[0];
      const prevMonthKey = sortedMonths[1];

      const curr = monthMap[latestMonthKey] || { grossPay: 0, netPay: 0, deductions: 0, employees: new Set() };
      const prev = monthMap[prevMonthKey] || { grossPay: 0, netPay: 0 };

      const growth = prev.grossPay > 0 ? ((curr.grossPay - prev.grossPay) / prev.grossPay) * 100 : 0;
      const highDept = deptList.sort((a, b) => b.value - a.value)[0]?.name || 'N/A';
      const netGrossRatio = curr.grossPay > 0 ? (curr.netPay / curr.grossPay) * 100 : 0;

      // Anomaly Detection for latest month
      const [lYear, lMonth] = (latestMonthKey || "").split('-').map(Number);
      const anomalies = history.filter(h =>
         h.month === lMonth &&
         h.year === lYear &&
         ((safe(h.breakdown?.deductions?.totalDeductions) > safe(h.breakdown?.earnings?.grossEarnings) * 0.3) || safe(h.breakdown?.netPay) === 0)
      );

      const insights = [
         {
            title: "Efficiency",
            label: "Efficiency",
            icon: Activity,
            color: "bg-indigo-500",
            textColor: "text-indigo-400",
            message: `Net vs Gross ratio is ${netGrossRatio.toFixed(2)}%`
         },
         {
            title: "Growth",
            label: "Growth",
            icon: growth >= 0 ? TrendingUp : TrendingDown,
            color: growth >= 0 ? "bg-emerald-500" : "bg-rose-500",
            textColor: growth >= 0 ? "text-emerald-400" : "text-rose-400",
            message: `Payroll ${growth >= 0 ? 'increased' : 'decreased'} by ${Math.abs(growth).toFixed(2)}%`
         },
         {
            title: "Anomalies",
            label: "Anomalies",
            icon: anomalies.length > 0 ? AlertCircle : CheckCircle2,
            color: anomalies.length > 0 ? "bg-rose-500" : "bg-emerald-500",
            textColor: anomalies.length > 0 ? "text-rose-400" : "text-emerald-400",
            message: anomalies.length > 0
               ? `${anomalies.length} employees flagged`
               : "No anomalies detected"
         }
      ];

      return {
         trends,
         depts: deptList,
         insights,
         summary: {
            totalCost: curr.grossPay,
            avgCost: curr.employees.size > 0 ? curr.grossPay / curr.employees.size : 0,
            growth,
            highDept,
            netGrossRatio,
            employeeCount: curr.employees.size
         }
      };
   }, [history, timeRange, selectedMetric]);

   const filteredTableData = React.useMemo(() => {
      if (!history) return [];
      let data = history.filter(h => h.month === (new Date().getMonth() + 1) && h.year === new Date().getFullYear());
      if (tableFilter !== 'All') {
         data = data.filter(h => (h.employeeInfo?.department || h.user?.department) === tableFilter);
      }
      return data;
   }, [history, tableFilter]);

   const [reportPeriod, setReportPeriod] = React.useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });

   const downloadReport = async (type) => {
      try {
         if (type === 'Summary' || type === 'DeptAnalysis') {
            const fetchFn = type === 'Summary' ? payrollAPI.getSummaryReport : payrollAPI.getDepartmentAnalysis;
            const res = await fetchFn(reportPeriod);
            const data = res.data.data;
            let headers = [], rows = [];
            
            if (type === 'Summary') {
               headers = ['Metric', 'Value'];
               rows = [
                  ['Total Employees', data.totalEmployees],
                  ['Total Gross Disbursement', data.totalGrossEarnings],
                  ['Total Statutory Deductions', data.totalDeductions],
                  ['Total Net Liquidity (Payout)', data.totalNetPay]
               ];
            } else {
               // Department Spending Analysis
               headers = ['Department', 'Employee Count', 'Total Gross Spending', 'Total Net Payout', 'Total Liability (Deductions)'];
               rows = data.map(d => [
                  d.department || d._id || 'Unassigned',
                  d.employeeCount || 0,
                  d.totalGross || 0,
                  d.totalNet || 0,
                  d.totalDeductions || 0
               ]);
            }
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `Payroll_${type}_M${reportPeriod.month}_Y${reportPeriod.year}.csv`;
            a.click();
            toast.success(`${type} Report Exported`);
            return;
         }

         if (type === 'PDF') {
            window.print();
            return;
         }

         if (type === 'Export') {
            const relevantHistory = history.filter(h => h.month === reportPeriod.month && h.year === reportPeriod.year);
            if (!relevantHistory.length) return toast.error('No payroll records found for selected period');

            // 1. Discover all unique earning and deduction component names across all records
            const earningNames = new Set();
            const deductionNames = new Set();
            
            relevantHistory.forEach(h => {
               (h.breakdown?.earnings || []).forEach(e => earningNames.add(e.name));
               (h.breakdown?.deductions || []).forEach(d => deductionNames.add(d.name));
            });

            const sortedEarnings = Array.from(earningNames).sort();
            const sortedDeductions = Array.from(deductionNames).sort();

            // 2. Define Headers
            const headers = [
               'Employee Name', 
               'Employee ID', 
               'Department', 
               'Pay Period', 
               'Monthly CTC (Full)',
               'Gross Earnings (Payable)', 
               ...sortedEarnings.map(name => `Earning: ${name}`),
               'Total Deductions',
               ...sortedDeductions.map(name => `Deduction: ${name}`),
               'Net Payout',
               'Bank Name',
               'Account Number',
               'IFSC Code',
               'PAN',
               'UAN'
            ];

            // 3. Map Rows
            const rows = relevantHistory.map(h => {
               const earningsMap = {};
               (h.breakdown?.earnings || []).forEach(e => earningsMap[e.name] = e.value);
               
               const deductionsMap = {};
               (h.breakdown?.deductions || []).forEach(d => deductionsMap[d.name] = d.value);

               const ctcVal = h.user?.annualCTC ? (parseFloat(h.user.annualCTC) / 12) : (h.breakdown?.monthlyCTC || h.grossYield);

               return [
                  h.user?.name || h.employeeInfo?.name,
                  h.user?.employeeId || h.employeeInfo?.employeeId,
                  h.user?.department || h.employeeInfo?.department || 'Unassigned',
                  `${h.month}/${h.year}`,
                  safe(ctcVal),
                  safe(h.grossYield || h.breakdown?.grossPay),
                  ...sortedEarnings.map(name => safe(earningsMap[name] || 0)),
                  safe(h.liability || h.breakdown?.totalDeductions),
                  ...sortedDeductions.map(name => safe(deductionsMap[name] || 0)),
                  safe(h.netPay || h.breakdown?.netPay),
                  h.user?.bankName || h.bankDetails?.bankName || 'N/A',
                  `'${h.user?.accountNumber || h.bankDetails?.accountNumber || 'N/A'}`, // Force text for Excel
                  h.user?.ifscCode || h.bankDetails?.ifscCode || 'N/A',
                  h.user?.pan || h.bankDetails?.pan || 'N/A',
                  h.user?.uan || h.bankDetails?.uan || 'N/A'
               ];
            });

            const csvContent = [
               headers.join(','),
               ...rows.map(row => row.map(cell => {
                  const cellStr = String(cell === null || cell === undefined ? '' : cell);
                  if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                      return `"${cellStr.replace(/"/g, '""')}"`;
                  }
                  return cellStr;
               }).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `Full_Payroll_Ledger_M${reportPeriod.month}_Y${reportPeriod.year}.csv`;
            a.click();
            toast.success('Comprehensive Ledger Exported');
            return;
         }

         if (type === 'Tax') {
            const relevantHistory = history.filter(h => h.month === reportPeriod.month && h.year === reportPeriod.year);
            if (!relevantHistory.length) return toast.error('No tax vectors for selected period');

            const taxHeaders = ['Employee Name', 'PAN Number', 'Period', 'Total Gross', 'Statutory Deductions', 'Taxable Net'];
            const taxRows = relevantHistory.map(h => [
               h.user?.name || h.employeeInfo?.name, 
               h.user?.pan || h.bankDetails?.pan || 'N/A', 
               `${h.month}/${h.year}`, 
               safe(h.grossYield || h.breakdown?.grossPay), 
               safe(h.liability || h.breakdown?.totalDeductions),
               safe((h.grossYield || h.breakdown?.grossPay) - (h.liability || h.breakdown?.totalDeductions))
            ]);

            const csv = [taxHeaders.join(','), ...taxRows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `Tax_Compliance_Report_${reportPeriod.month}_${reportPeriod.year}.csv`;
            a.click();
            toast.success('Tax Compliance Report Exported');
         }
      } catch (err) { 
         console.error(err);
         toast.error('Extraction Engine Error'); 
      }
   };

   return (
      <PayrollPlaceholder
         title="Enterprise Payroll Analytics"
         description="Management dashboard for strategic financial oversight and compliance monitoring."
      >
         {/* 1. Dashboard Controls */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div className="flex flex-wrap items-center gap-4">
               <div className="flex items-center bg-slate-100/50 dark:bg-white/5 rounded-2xl p-1.5 backdrop-blur-sm">
                  {['line', 'bar', 'area'].map(type => (
                     <button
                        key={type}
                        onClick={() => setChartType(type)}
                        className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 ${chartType === type ? 'bg-white dark:bg-slate-700 shadow-xl text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        {type}
                     </button>
                  ))}
               </div>

               <select
                  value={timeRange}
                  onChange={e => setTimeRange(parseInt(e.target.value))}
                  className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-5 py-2.5 text-[10px] font-black uppercase outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/20 transition-all"
               >
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={12}>12 Months</option>
               </select>

               <div className="flex items-center gap-2">
                  {[
                     { id: 'grossPay', label: 'Gross' },
                     { id: 'netPay', label: 'Net' },
                     { id: 'employees', label: 'Staff' }
                  ].map(m => (
                     <button
                        key={m.id}
                        onClick={() => setSelectedMetric(m.id)}
                        className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase transition-all ${selectedMetric === m.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white dark:bg-white/5 border border-transparent dark:border-[#333333] text-slate-400 hover:text-slate-600'}`}
                     >
                        {m.label}
                     </button>
                  ))}
               </div>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={() => downloadReport('Summary')} className="p-3 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 rounded-2xl transition-all">
                  <Printer size={18} className="text-slate-400" />
               </button>
               <button onClick={() => downloadReport('Export')} className="flex items-center gap-3 px-6 py-3 bg-slate-900 border border-slate-800 text-white dark:text-black dark:bg-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-black dark:hover:bg-gray-200 shadow-2xl">
                  <FileSpreadsheet size={16} /> Data Export
               </button>
            </div>
         </div>

         {/* 2. KPI Section */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-10">
            {[
               { label: 'Total Payroll Cost', value: `${currencySymbol}${formatCurrency(processedData.summary.totalCost)}`, sub: 'Current Month Gross', icon: Wallet, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },

               { label: 'Avg Cost / Head', value: `${currencySymbol}${formatCurrency(processedData.summary.avgCost)}`, sub: 'Across Organization', icon: Calculator, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },

               { label: 'Growth rate', value: `${processedData.summary.growth?.toFixed(1)}%`, sub: processedData.summary.growth >= 0 ? 'Increase vs Prev Month' : 'Decrease vs Prev Month', icon: processedData.summary.growth >= 0 ? TrendingUp : TrendingDown, color: processedData.summary.growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400', bg: processedData.summary.growth >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10' },
               { label: 'Top Department', value: processedData.summary.highDept, sub: 'Highest Expenditure', icon: Building2, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
               { label: 'Net/Gross Ratio', value: `${processedData.summary.netGrossRatio?.toFixed(1)}%`, sub: 'Efficiency Index', icon: Activity, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-500/10' },
            ].map((kpi, i) => (
               <div key={i} className="bg-white dark:bg-[#111111] p-5 rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm hover:shadow-md transition-all group">
                  <div className={`p-2.5 w-fit rounded-xl ${kpi.bg} ${kpi.color} mb-4 group-hover:scale-110 transition-transform`}>
                     <kpi.icon size={18} />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</p>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white leading-none mb-1">{kpi.value}</h4>
                  <p className="text-[9px] font-bold text-slate-400 dark:text-gray-500 uppercase">{kpi.sub}</p>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-10">
            {/* 3. Main Trend Chart */}
            <div className="lg:col-span-8 bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm">
               <div className="flex items-center justify-between mb-10">
                  <div>
                     <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Financial Performance Trend</h3>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase">Historical analysis of {selectedMetric} over {timeRange} months</p>
                  </div>
                  <button onClick={() => setSelectedMetric('netPay')} className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg text-slate-400 transition-colors"><RefreshCw size={16} /></button>
               </div>

               <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                     {chartType === 'bar' ? (
                        <BarChart data={processedData.trends}>
                           <XAxis dataKey="name" hide />
                           <YAxis hide />
                           <ReTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontWeight: 900 }} />
                           <Bar dataKey="value" fill="#6366f1" radius={[12, 12, 12, 12]} barSize={24} />
                        </BarChart>
                     ) : chartType === 'line' ? (
                        <AreaChart data={processedData.trends}>
                           <XAxis dataKey="name" hide />
                           <YAxis hide />
                           <ReTooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontWeight: 900 }} />
                           <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={5} fill="transparent" dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} />
                        </AreaChart>
                     ) : (
                        <AreaChart data={processedData.trends}>
                           <defs>
                              <linearGradient id="primaryGradient" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                 <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                           </defs>
                           <XAxis dataKey="name" hide />
                           <YAxis hide />
                           <ReTooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', fontWeight: 900 }} />
                           <Area type="monotone" dataKey="value" stroke="#6366f1" fillOpacity={1} fill="url(#primaryGradient)" strokeWidth={5} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} />
                        </AreaChart>
                     )}
                  </ResponsiveContainer>
               </div>
            </div>

            {/* 4. Dept Pie Chart */}
            <div className="lg:col-span-4 bg-white dark:bg-[#111111] p-8 rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm">
               <div className="mb-6">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Cost by Department</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase">Organization-wide distribution</p>
               </div>

               <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                     <RePieChart>
                        <Pie
                           data={processedData.depts}
                           innerRadius={60}
                           outerRadius={85}
                           paddingAngle={5}
                           dataKey="value"
                           stroke="none"
                           onClick={(data) => setTableFilter(data.name)}
                           className="cursor-pointer"
                        >
                           {processedData.depts.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <ReTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 700 }} />
                     </RePieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                     <div className="text-center">
                        <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase leading-none">Total</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{currencySymbol}{processedData.summary.totalCost > 1000 ? (processedData.summary.totalCost / 1000).toFixed(1) + 'k' : processedData.summary.totalCost}</p>
                     </div>
                  </div>
               </div>

               <div className="mt-6 space-y-2">
                  {processedData.depts.slice(0, 4).map((d, i) => (
                     <div key={i} onClick={() => setTableFilter(d.name)} className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all ${tableFilter === d.name ? 'bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-[#333333]' : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'}`}>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                           <span className="text-[10px] font-black text-slate-600 dark:text-gray-400 uppercase truncate max-w-[100px]">{d.name}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-900 dark:text-white">{((d.value / processedData.summary.totalCost) * 100).toFixed(1)}%</span>
                     </div>
                  ))}
                  {processedData.depts.length > 4 && (
                     <button onClick={() => setTableFilter('All')} className="w-full py-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest text-center hover:bg-indigo-50 dark:hover:bg-white/5 rounded-lg transition-all">Show All Departments</button>
                  )}
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            {/* 5. Smart Insights Panel */}
            <div className="xl:col-span-4 bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-5 -translate-x-1/4 -translate-y-1/4"><PieChart size={180} /></div>
               <div className="relative z-10 space-y-8">
                  <div>
                     <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Advanced Analytics</h3>
                     <h2 className="text-xl font-black mt-2">Monthly Insights</h2>
                  </div>

                  <div className="space-y-6">
                     {(processedData.insights || []).map((insight, idx) => (
                        <div key={idx} className="p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all cursor-default">
                           <div className="flex items-center gap-3 mb-2">
                              <div className={`p-1.5 ${insight.color} rounded-lg`}><insight.icon size={14} /></div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">{insight.title}</p>
                           </div>
                           <p className="text-xs font-medium leading-relaxed">{insight.message}</p>
                        </div>
                     ))}
                  </div>

                  <button onClick={() => downloadReport('Export')} className="w-full py-4 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl">Generate Report</button>
               </div>
            </div>

            {/* 6. Detailed Table */}
            <div className="xl:col-span-8 bg-white dark:bg-[#111111] rounded-3xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden flex flex-col">
               <div className="p-8 border-b border-slate-50 dark:border-white/5 flex justify-between items-center">
                  <div>
                     <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Detail Transactional Ledger</h3>
                     <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 mt-1 uppercase">Filtering: {tableFilter === 'All' ? 'Complete Organization' : tableFilter}</p>
                  </div>
                  {tableFilter !== 'All' && <button onClick={() => setTableFilter('All')} className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:text-indigo-700">Clear Filter</button>}
               </div>

               <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest border-b border-slate-100 dark:border-[#333333]">
                           <th className="px-8 py-5">Employee Context</th>
                           <th className="px-6 py-5">Department</th>
                           <th className="px-6 py-5 text-right">Gross Earnings</th>
                           <th className="px-6 py-5 text-right">Deductions</th>
                           <th className="px-6 py-5 text-right">Net Payout</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        {filteredTableData.length > 0 ? filteredTableData.slice(0, 10).map((h, i) => (
                           <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                              <td className="px-8 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-[#222] shadow-sm">{(h.user?.name || h.employeeInfo?.name || '?')[0]}</div>
                                    <div>
                                       <p className="text-sm font-black text-slate-800 dark:text-white leading-none mb-1">{h.user?.name || h.employeeInfo?.name}</p>
                                       <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-tight">{h.user?.employeeId || h.employeeInfo?.employeeId}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-6 py-4">
                                 <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest">{h.user?.department || h.employeeInfo?.department || 'Unassigned'}</span>
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-bold text-slate-600 dark:text-gray-400">{currencySymbol}{formatCurrency(safe(h.grossYield || h.breakdown?.grossPay || h.breakdown?.earnings?.grossEarnings))}</td>
                              <td className="px-6 py-4 text-right text-xs font-bold text-rose-500">-{currencySymbol}{formatCurrency(safe(h.liability || h.breakdown?.totalDeductions || h.breakdown?.deductions?.totalDeductions))}</td>
                              <td className="px-6 py-4 text-right text-sm font-black text-slate-900 dark:text-white">{currencySymbol}{formatCurrency(safe(h.netPay || h.breakdown?.netPay))}</td>
                           </tr>
                        )) : (
                           <tr>
                              <td colSpan={5} className="px-8 py-20 text-center">
                                 <p className="text-sm font-medium text-slate-400">No data records found for current filter criteria</p>
                              </td>
                           </tr>
                        )}
                     </tbody>
                  </table>
                  {filteredTableData.length > 10 && (
                     <div className="p-4 bg-slate-50/30 dark:bg-white/5 text-center border-t border-slate-50 dark:border-[#333333]">
                        <button className="text-[9px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest hover:text-indigo-600 transition-all">Showing top 10 records — View full audit in ledger</button>
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* 7. Old Report Generation (Retained & Styled) */}
         <div className="bg-white dark:bg-[#111111] border-slate-100 dark:border-[#333333] border rounded-3xl p-10 mt-10 relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 right-0 p-12 opacity-5 translate-x-1/4 -translate-y-1/4 -rotate-12"><Archive size={200} /></div>
            <div className="flex flex-wrap items-center justify-between gap-10 relative z-10">
               <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-gray-500 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-[#333333]"><Archive size={28} /></div>
                  <div>
                     <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest leading-none">Report Archive Extraction</h3>
                     <p className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-widest mt-2">Generate point-in-time compliance artifacts</p>
                  </div>
               </div>
               <div className="flex flex-wrap gap-3">
                  <div className="flex items-center bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-xl p-1 shadow-sm">
                     <select value={reportPeriod.month} onChange={(e) => setReportPeriod({ ...reportPeriod, month: parseInt(e.target.value) })} className="px-6 py-2 bg-transparent dark:text-white text-xs font-black uppercase outline-none cursor-pointer border-r border-slate-100 dark:border-[#333333]">
                        {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1} className="dark:bg-[#111111]">{new Date(2024, i).toLocaleString('default', { month: 'long' })}</option>)}
                     </select>
                     <select value={reportPeriod.year} onChange={(e) => setReportPeriod({ ...reportPeriod, year: parseInt(e.target.value) })} className="px-6 py-2 bg-transparent dark:text-white text-xs font-black uppercase outline-none cursor-pointer">
                        {[2024, 2025, 2026].map(y => <option key={y} value={y} className="dark:bg-[#111111]">{y}</option>)}
                     </select>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-12 relative z-10">
               {[
                  // { label: 'Executive Summary', type: 'Summary', icon: TrendingUp },
                  { label: 'Department Spend Analysis', type: 'DeptAnalysis', icon: Users },
                  // { label: 'Tax Compliance', type: 'Tax', icon: Percent },
                  { label: 'Detailed Payroll Ledger (All Data)', type: 'Export', icon: FileText }
               ].map((r, i) => (
                  <button key={i} onClick={() => downloadReport(r.type)} className="p-6 bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-[#333333] rounded-2xl flex flex-col items-center gap-4 text-slate-600 dark:text-gray-400 hover:bg-white dark:hover:bg-[#1a1a1a] hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-100 dark:hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-50 dark:hover:shadow-none transition-all group/btn">
                     <r.icon size={20} className="group-hover/btn:scale-110 " />
                     <span className="text-[10px] font-black uppercase tracking-widest">{r.label}</span>
                  </button>
               ))}
            </div>
         </div>
      </PayrollPlaceholder>
   );
};

export const BankTransferExport = () => {
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

   const [month, setMonth] = React.useState(new Date().getMonth() + 1);
   const [year, setYear] = React.useState(new Date().getFullYear());
   const [bankFilter, setBankFilter] = React.useState('');
   const [statusFilter, setStatusFilter] = React.useState('All');
   const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
   const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);

   const { data: usersData } = useQuery({
      queryKey: ['usersList'],
      queryFn: () => userAPI.getAll().then(res => res.data?.data || res.data || [])
   });

   const uniqueBanks = React.useMemo(() => {
      const list = Array.isArray(usersData) ? usersData : usersData?.users || [];
      const banks = new Set([]);
      list.forEach(u => {
         if (u.bankName) banks.add(u.bankName);
      });
      return Array.from(banks).sort();
   }, [usersData]);

   const { data: history } = useQuery({
      queryKey: ['payrollHistory'],
      queryFn: () => payrollAPI.getHistory().then(res => res.data.data)
   });

   const validatePayout = React.useCallback((h) => {
      const bankName = h.employee?.user?.bankName || h.bankDetails?.bankName;
      const accountNumber = h.employee?.user?.accountNumber || h.bankDetails?.accountNumber;
      const ifsc = h.employee?.user?.ifscCode || h.bankDetails?.ifscCode;

      if (bankName && accountNumber && ifsc) {
         return { type: 'Ready', label: 'Ready', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2 };
      }
      if (!bankName && !accountNumber && !ifsc) {
         return { type: 'Error', label: 'Missing Info', color: 'text-rose-600', bg: 'bg-rose-50', icon: ShieldAlert };
      }
      return { type: 'Pending', label: 'Partial Info', color: 'text-amber-600', bg: 'bg-amber-50', icon: AlertCircle };
   }, []);

   const filteredNodes = React.useMemo(() => {
      if (!history) return [];
      let nodes = history.filter(h => h.month === month && h.year === year && h.breakdown?.netPay > 0);

      nodes = nodes.map(n => ({
         ...n,
         validation: validatePayout(n)
      }));

      if (bankFilter) {
         nodes = nodes.filter(h => h.employee?.user?.bankName === bankFilter || h.bankDetails?.bankName === bankFilter);
      }

      if (statusFilter !== 'All') {
         nodes = nodes.filter(h => h.validation.type === statusFilter);
      }

      return nodes;
   }, [history, month, year, bankFilter, statusFilter, validatePayout]);

   const stats = React.useMemo(() => {
      const totalLiquidity = filteredNodes.reduce((acc, curr) => acc + (curr.breakdown?.netPay || 0), 0);
      return {
         totalLiquidity,
         nodeCount: filteredNodes.length,
         readyCount: filteredNodes.filter(n => n.validation.type === 'Ready').length,
         pendingCount: filteredNodes.filter(n => n.validation.type === 'Pending').length,
         errorCount: filteredNodes.filter(n => n.validation.type === 'Error').length,
      };
   }, [filteredNodes]);

   const headers = ['Account Number', 'Beneficiary Name', 'Bank Name', 'IFSC', 'Amount', 'Description'];
   const previewRows = React.useMemo(() => {
      return filteredNodes.map(h => [
         h.employee?.user?.accountNumber || h.bankDetails?.accountNumber || 'NOT-MAPPED',
         h.employee?.user?.name || h.employeeInfo?.name || 'Unknown',
         h.employee?.user?.bankName || h.bankDetails?.bankName || 'NOT-MAPPED',
         h.employee?.user?.ifscCode || h.bankDetails?.ifscCode || 'N/A',
         h.breakdown?.netPay,
         `Salary_${month}_${year}`
      ]);
   }, [filteredNodes, month, year]);

   const downloadBankFile = () => {
      if (!filteredNodes.length) {
         toast.error('No validated payouts found for export');
         return;
      }
      const csvContent = [headers.join(','), ...previewRows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank_Transfer_${bankFilter || 'All'}_M${month}_Y${year}.csv`;
      a.click();
      toast.success('Bank Transfer File Generated');
      setIsConfirmOpen(false);
      setIsPreviewOpen(false);
   };

   return (
      <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-black min-h-screen">
         {/* 🚀 Header Section */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
               <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                  <Landmark className="text-indigo-600 dark:text-indigo-400" size={28} />
                  Bank Clearing Export
               </h1>
               <p className="text-sm text-slate-500 font-medium">Generate and validate bank transfer files for salary payouts</p>
            </div>

            <div className="flex items-center gap-3">

               <button
                  onClick={() => setIsPreviewOpen(true)}
                  disabled={!filteredNodes.length}
                  className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-none disabled:opacity-50"
               >
                  Generate File
               </button>
            </div>
         </div>

         {/* 📊 KPI Dashboard Grid */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
               { id: 'All', label: 'Total Payout Amount', val: `${currencySymbol}${formatCurrency(stats.totalLiquidity)}`, icon: Wallet, color: 'text-indigo-600', bg: 'bg-indigo-50', sub: 'Calculated Net Pay' },

               { id: 'Ready', label: 'Employees Ready', val: stats.readyCount, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: 'Complete Bank Details' },
               { id: 'Pending', label: 'Pending Bank Info', val: stats.pendingCount, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', sub: 'Incomplete Records' },
               { id: 'Error', label: 'Failed Validations', val: stats.errorCount, icon: ShieldAlert, color: 'text-rose-600', bg: 'bg-rose-50', sub: 'Missing All Details' }
            ].map((kpi, i) => (
               <div
                  key={i}
                  onClick={() => setStatusFilter(kpi.id)}
                  className={`bg-white dark:bg-[#111111] p-5 rounded-2xl border ${statusFilter === kpi.id ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-100 dark:border-[#333333]'} shadow-sm hover:shadow-md transition-all group cursor-pointer`}
               >
                  <div className="flex justify-between items-start mb-4">
                     <div className={`p-3 rounded-xl ${kpi.bg} ${kpi.color} group-hover:scale-110 transition-transform`}>
                        <kpi.icon size={22} />
                     </div>
                     <span className="text-[10px] font-black text-slate-400 dark:text-gray-500 uppercase tracking-widest bg-slate-50 dark:bg-white/5 px-2 py-1 rounded">Real-time</span>
                  </div>
                  <p className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">{kpi.label}</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{kpi.val}</h3>
                  <p className="text-[10px] font-medium text-slate-400 dark:text-gray-500 mt-1">{kpi.sub}</p>
               </div>
            ))}
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 📋 Employee Table & Filters */}
            <div className="lg:col-span-12 space-y-6">
               <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-100 dark:border-[#333333] shadow-sm overflow-hidden">
                  {/* 🔍 Filter Bar */}
                  <div className="p-6 border-b border-slate-50 dark:border-white/5 bg-slate-50/30 dark:bg-white/5 flex flex-wrap items-center justify-between gap-6">
                     <div className="flex items-center gap-4">
                        <div className="flex items-center bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg p-1 shadow-sm">
                           <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="bg-transparent dark:text-white px-3 py-1.5 text-xs font-bold outline-none cursor-pointer border-r border-slate-100 dark:border-[#333333]">
                              {[...Array(12)].map((_, i) => <option key={i + 1} value={i + 1} className="dark:bg-[#111111]">{new Date(2024, i).toLocaleString('default', { month: 'short' })}</option>)}
                           </select>
                           <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="bg-transparent dark:text-white px-3 py-1.5 text-xs font-bold outline-none cursor-pointer">
                              {[2024, 2025, 2026].map(y => <option key={y} value={y} className="dark:bg-[#111111]">{y}</option>)}
                           </select>
                        </div>

                        <div className="flex items-center bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-1.5 shadow-sm">
                           <BankIcon size={14} className="text-slate-400 mr-2" />
                           <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} className="bg-transparent dark:text-white text-xs font-bold text-slate-600 outline-none cursor-pointer">
                              <option value="" className="dark:bg-[#111111]">All Banks</option>
                              {uniqueBanks.map(b => <option key={b} value={b} className="dark:bg-[#111111]">{b}</option>)}
                           </select>
                        </div>

                        <div className="flex items-center bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#333333] rounded-lg px-3 py-1.5 shadow-sm">
                           <Filter size={14} className="text-slate-400 mr-2" />
                           <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent dark:text-white text-xs font-bold text-slate-600 outline-none cursor-pointer">
                              <option value="All" className="dark:bg-[#111111]">All Statuses</option>
                              <option value="Ready" className="dark:bg-[#111111]">Ready</option>
                              <option value="Pending" className="dark:bg-[#111111]">Pending</option>
                              <option value="Error" className="dark:bg-[#111111]">Error</option>
                           </select>
                        </div>
                     </div>

                     <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        Total {filteredNodes.length} Records Found
                     </div>
                  </div>

                  {/* 🗄️ Table */}
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-[#333333]">
                              <th className="px-8 py-4">Employee Name</th>
                              <th className="px-8 py-4">Employee ID</th>
                              <th className="px-8 py-4">Bank Details</th>
                              <th className="px-8 py-4 text-right">Net Pay</th>
                              <th className="px-8 py-4 text-center">Status</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                           {filteredNodes.length > 0 ? filteredNodes.map((h, i) => (
                              <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                 <td className="px-8 py-4">
                                    <div className="flex items-center gap-3">
                                       <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-indigo-500 flex items-center justify-center text-white text-xs font-black shadow-inner">
                                          {(h.employee?.user?.name || h.employeeInfo?.name || 'E')[0]}
                                        </div>
                                        <p className="font-bold text-slate-800 dark:text-white text-sm">{h.employee?.user?.name || h.employeeInfo?.name}</p>
                                    </div>
                                 </td>
                                 <td className="px-8 py-4">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase">#{h.employee?.employeeCode || h.employeeInfo?.employeeId}</p>
                                 </td>
                                 <td className="px-8 py-4">
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{h.employee?.user?.bankName || h.bankDetails?.bankName || 'NOT MAPPED'}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                       <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded uppercase">ACC: {h.employee?.user?.accountNumber || h.bankDetails?.accountNumber || 'N/A'}</span>
                                       <span className="text-[10px] font-bold text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-[#1a1a1a] px-1.5 py-0.5 rounded uppercase">IFSC: {h.employee?.user?.ifscCode || h.bankDetails?.ifscCode || 'N/A'}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-4 text-right">
                                    <p className="font-black text-slate-900 dark:text-white text-sm">{currencySymbol}{formatCurrency(h.breakdown?.netPay)}</p>

                                    <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500">Regular Payout</p>
                                 </td>
                                 <td className="px-8 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${h.validation.bg} ${h.validation.color}`}>
                                       {h.validation.label}
                                    </span>
                                 </td>
                              </tr>
                           )) : (
                              <tr>
                                 <td colSpan={5} className="px-8 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                       <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-full text-slate-300 dark:text-gray-600">
                                          <Search size={32} />
                                       </div>
                                       <p className="text-sm font-bold text-slate-400">No payout records match your current selection</p>
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>

                  {/* 📤 Export Status Bar */}
                  <div className="p-6 bg-slate-900 dark:bg-[#1a1a1a] flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ready to Disburse</span>
                           <h4 className="text-white font-bold">{stats.readyCount} Employees</h4>
                        </div>
                        <div className="h-8 w-px bg-white/10 hidden md:block" />
                        {/* <div className="flex flex-col">
                           <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Issues Found</span>
                           <h4 className="text-white font-bold">{stats.pendingCount + stats.errorCount} Records</h4>
                        </div> */}
                     </div>

                     <div className="flex items-center gap-3 w-full md:w-auto">
                        {/* <button className="flex-1 md:flex-none px-6 py-2 border border-white/20 text-white rounded-lg text-xs font-bold hover:bg-white/5 transition-all uppercase tracking-widest">
                           Fix Issues
                        </button> */}
                        <button
                           onClick={() => setIsPreviewOpen(true)}
                           disabled={!filteredNodes.length}
                           className="flex-1 md:flex-none px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all uppercase tracking-widest shadow-lg shadow-indigo-500/20 dark:shadow-none disabled:opacity-30"
                        >
                           Preview & Export
                        </button>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* 🧾 Preview Modal */}
         <Modal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            title="Export File Preview"
            maxWidth="4xl"
         >
            <div className="p-6 space-y-6">
               <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl flex gap-3">
                  <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                     <p className="text-sm font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">Safety Verification</p>
                     <p className="text-xs font-medium text-amber-700/80 dark:text-amber-500/70 mt-1">
                        Please review the payout records below. Once generated, this file will serve as the official bank transfer instruction.
                     </p>
                  </div>
               </div>

               <div className="border border-slate-100 dark:border-[#333333] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                     <thead className="sticky top-0 bg-slate-50 dark:bg-[#1a1a1a] border-b border-slate-100 dark:border-[#333333]">
                        <tr>
                           {headers.map((h, idx) => (
                              <th key={idx} className="px-4 py-3 font-black text-slate-400 dark:text-gray-500 uppercase tracking-wider">{h}</th>
                           ))}
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50 dark:divide-white/5 italic">
                        {previewRows.map((row, idx) => (
                           <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                              {row.map((cell, cidx) => (
                                 <td key={cidx} className="px-4 py-3 text-slate-600 dark:text-slate-300 font-medium">
                                    {typeof cell === 'number' ? `${currencySymbol}${formatCurrency(cell)}` : cell}
                                 </td>

                              ))}
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="flex justify-end gap-3 pt-4">
                  <button
                     onClick={() => setIsPreviewOpen(false)}
                     className="px-6 py-2.5 bg-slate-100 dark:bg-[#333333] text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-[#444444] transition-all"
                  >
                     Discard
                  </button>
                  <button
                     onClick={() => setIsConfirmOpen(true)}
                     className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 dark:shadow-none flex items-center gap-2"
                  >
                     <Download size={18} /> Generate Final CSV
                  </button>
               </div>
            </div>
         </Modal>

         {/* 🔐 Safety Confirmation */}
         <ConfirmModal
            isOpen={isConfirmOpen}
            onClose={() => setIsConfirmOpen(false)}
            onConfirm={downloadBankFile}
            title="Generate Bank Transfer File?"
            message={`You are about to generate a transfer file for ${stats.nodeCount} employees totaling ${currencySymbol}${formatCurrency(stats.totalLiquidity)}. Ensure all details are verified.`}

            confirmText="Generate & Download"
            type="primary"
         />
      </div>
   );
};

export const HourManagement = () => {
   const { data: settings } = useQuery({
      queryKey: ['settings'],
      queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
   });
   const currencySymbol = settings?.payroll?.currencySymbol || '$';

   const { data: users, isLoading } = useQuery({
      queryKey: ['settings', 'employees', 'picker'],
      queryFn: () => settingsAPI.getPickerEmployees().then(res => res.data.data)
   });

   const { data: profiles } = useQuery({
      queryKey: ['payrollProfiles'],
      queryFn: () => payrollAPI.getProfiles().then(res => res.data.data)
   });

   const hourData = React.useMemo(() => {
      if (!users) return [];
      return users.map(u => {
         const profile = profiles?.find(p => p.user?._id === u._id);
         // Fallback to whatever is in the users list if profiles don't have it yet
         return {
            ...u,
            hourRate: profile?.hourlyRate || 0,
            role: u.role || 'Employee'
         };
      });
   }, [users, profiles]);

   return (
      <PayrollPlaceholder
         title="Hour Management"
         description="Manage hourly rates for employees under the Hourly Rate payroll policy."
      >
         <div className="bg-white dark:bg-[#111111] rounded-xl border border-gray-100 dark:border-[#333333] shadow-sm overflow-hidden animate-fade-in">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-[#333333]">
                     <th className="px-8 py-6 text-sm font-semibold text-gray-500 dark:text-gray-400">Employee ID</th>
                     <th className="px-8 py-6 text-sm font-semibold text-gray-500 dark:text-gray-400">Name</th>
                     <th className="px-8 py-6 text-sm font-semibold text-gray-500 dark:text-gray-400">Designation</th>
                     <th className="px-8 py-6 text-sm font-semibold text-gray-500 dark:text-gray-400">Role</th>
                     <th className="px-8 py-6 text-sm font-semibold text-gray-500 dark:text-gray-400">Hour Rate</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {isLoading ? (
                     <tr><td colSpan="5" className="px-8 py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                           <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                           <p className="font-semibold text-gray-500 dark:text-gray-400 text-xs">Architecting Roster...</p>
                        </div>
                     </td></tr>
                  ) : hourData?.map((u, i) => (
                     <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-all group">
                        <td className="px-8 py-6 font-mono text-sm font-medium text-gray-900 dark:text-white tracking-tight">{u.employeeId}</td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-black/80 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-white dark:text-indigo-400 text-xs font-semibold shadow-sm">
                                 {u.name.charAt(0)}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white">{u.name}</span>
                           </div>
                        </td>
                        <td className="px-8 py-6 text-xs font-medium text-gray-500 dark:text-gray-400">{u.designation || 'Trainee'}</td>
                        <td className="px-8 py-6">
                           <span className="px-3 py-1.5 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-xl text-sm font-semibold border border-primary-500/20">{u.role}</span>
                        </td>
                        <td className="px-8 py-6">
                           <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-green-700 dark:text-emerald-400">
                                 <Wallet size={16} />
                              </div>
                              <span className="text-xl font-semibold text-gray-900 dark:text-gray-900">{currencySymbol}{u.hourRate || '0.00'}</span>
                              <span className="text-sm text-gray-500 font-semibold   mt-1">/ hr</span>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </PayrollPlaceholder>
   );
};

