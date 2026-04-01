import React, { useState, useEffect } from 'react'
import { 
    Calendar, Download, Eye, FileText, AlertCircle, 
    ChevronRight, Wallet, TrendingDown, Landmark,
    Mail, Receipt, History, ArrowUpRight, CheckCircle2
} from 'lucide-react'
import { payrollAPI, settingsAPI } from '@/services/endpoints'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import StatementPreview from '../components/StatementPreview'
import { exportToPdf } from '@/utils/pdfExport'
import { useRef } from 'react'

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

const years = [2024, 2025, 2026]

export default function MyPayslipsPage() {
    const { user } = useAuthStore()
    const { payslipDesign, fetchPayslipDesign } = useSettingsStore()
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [payslip, setPayslip] = useState(null)
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [selectedPayslip, setSelectedPayslip] = useState(null)
    const [settings, setSettings] = useState(null)

    const fetchData = async () => {
        try {
            setLoading(true)
            // Fetch settings
            const settRes = await settingsAPI.getSettings()
            if (settRes.data.success) {
                setSettings(settRes.data.data)
            }

            // Fetch history first
            const histRes = await payrollAPI.getMyPayslips()
            if (histRes.data.success) {
                setHistory(histRes.data.data)
                
                // Find current one
                const current = histRes.data.data.find(p => p.month === selectedMonth && p.year === selectedYear)
                setPayslip(current || null)
            }
        } catch (err) {
            toast.error('Failed to load payslip data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        if (!payslipDesign) fetchPayslipDesign()
    }, [selectedMonth, selectedYear])

    const handleDownload = async (id = payslip?._id) => {
        const targetId = id || payslip?._id
        if (!targetId) return

        const toastId = toast.loading('Generating Secure PDF...')
        try {
            const res = await payrollAPI.downloadPayslip(targetId)
            const url = window.URL.createObjectURL(new Blob([res.data]))
            const link = document.createElement('a')
            link.href = url
            const targetPayslip = history.find(p => p._id === targetId) || payslip
            const filename = `Payslip_${user.employeeId}_${months[targetPayslip.month-1]}_${targetPayslip.year}.pdf`
            link.setAttribute('download', filename)
            document.body.appendChild(link)
            link.click()
            link.remove()
            toast.success('Downloaded successfully', { id: toastId })
        } catch (err) {
            toast.error('Download failed', { id: toastId })
        }
    }

    const handleEmail = async (id = payslip?._id) => {
        const targetId = id || payslip?._id
        if (!targetId) return
        const toastId = toast.loading('Enqueuing email dispatch...')
        try {
            await payrollAPI.sendPayslipEmail(targetId)
            toast.success('Payslip sent to your registered email', { id: toastId })
        } catch (err) {
            toast.error('Email failed. Please check your connectivity.', { id: toastId })
        }
    }

    const handleView = async (id) => {
        const targetId = id || payslip?._id
        if (!targetId) return
        
        // Find the full payslip object from history or current
        const fullPayslip = history.find(p => p._id === targetId) || payslip
        if (fullPayslip) {
            setSelectedPayslip(fullPayslip)
            setPreviewOpen(true)
        } else {
            toast.error('Statement details not found')
        }
    }

    const Skeleton = () => (
        <div className="animate-pulse space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl" />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="h-[400px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
                <div className="lg:col-span-2 h-[400px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
            </div>
        </div>
    )

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-white/10 pb-8">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        Salary Statement
                        <span className="text-sm font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg uppercase tracking-widest leading-none">Self-Service</span>
                    </h1>
                    <p className="text-slate-500 font-medium">Manage and monitor your monthly payroll disbursements.</p>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-white/5 p-2 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-2 px-3 border-r border-slate-100 dark:border-white/10 mr-1">
                        <Calendar size={18} className="text-primary-500" />
                    </div>
                    <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer min-w-[110px]"
                    >
                        {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0 cursor-pointer"
                    >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {loading ? <Skeleton /> : (
                <>
                {/* ── 1. Top Summary Cards ───────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { label: 'Net Pay', value: payslip?.breakdown?.netPay, icon: Wallet, color: 'text-primary-600', bg: 'bg-primary-50 dark:bg-primary-500/10' },
                        { label: 'Gross Pay', value: payslip?.breakdown?.earnings?.grossEarnings, icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                        { label: 'Total Deductions', value: payslip?.breakdown?.deductions?.totalDeductions, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-500/10' },
                        { label: 'Status', value: payslip?.isPaid ? 'Paid' : 'Pending', icon: CheckCircle2, color: payslip?.isPaid ? 'text-emerald-600' : 'text-amber-600', bg: payslip?.isPaid ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10', isStatus: true },
                    ].map((card, i) => (
                        <div key={i} className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 p-6 rounded-2xl flex items-center justify-between transition-all hover:shadow-lg hover:-translate-y-1 group">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{card.label}</p>
                                <p className={clsx("text-xl font-black", !card.isStatus ? "text-slate-900 dark:text-white" : card.color)}>
                                    {card.isStatus ? card.value : `₹${card.value?.toLocaleString() || '0'}`}
                                </p>
                            </div>
                            <div className={clsx("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", card.bg, card.color)}>
                                <card.icon size={22} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── 2. Main Section ────────────────────────────── */}
                {payslip ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left: Net Salary Card */}
                        <div className="lg:col-span-1">
                             <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] p-10 space-y-10 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-primary-500/10 transition-colors" />
                                
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-primary-600 font-bold text-sm bg-primary-50 dark:bg-primary-500/10 w-fit px-3 py-1 rounded-lg">
                                        <Calendar size={14} />
                                        {months[selectedMonth-1]} {selectedYear}
                                    </div>
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest pt-4">Net Take-Home Salary</h3>
                                    <div className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter">
                                        ₹{payslip.breakdown?.netPay?.toLocaleString()}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6">
                                    <button 
                                        onClick={() => handleView()}
                                        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/10"
                                    >
                                        <Eye size={18} />
                                        View Statement
                                    </button>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button 
                                            onClick={() => handleDownload()}
                                            className="py-3.5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                                        >
                                            <Download size={18} />
                                            Download
                                        </button>
                                        <button 
                                            onClick={() => handleEmail()}
                                            className="py-3.5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 text-slate-700 dark:text-slate-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                                        >
                                            <Mail size={18} />
                                            Email
                                        </button>
                                    </div>
                                </div>
                             </div>
                        </div>

                        {/* Right: Breakdown Table */}
                        <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] p-10 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                                    <Receipt size={22} className="text-primary-500" />
                                    Detailed Breakdown
                                </h3>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-white/5 px-2.5 py-1 rounded-lg">Component Analysis</div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-100 dark:border-white/10">Earnings</h4>
                                    <div className="space-y-4">
                                        {payslip.breakdown?.earnings?.components?.map((comp, idx) => (
                                            <div key={`${comp.name}-${idx}`} className="flex justify-between items-center group/row">
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors">{comp.name}</span>
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">₹{comp.value?.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-100 dark:border-white/10">Deductions</h4>
                                    <div className="space-y-4">
                                        {payslip.breakdown?.deductions?.components?.map((comp, idx) => (
                                            <div key={`${comp.name}-${idx}`} className="flex justify-between items-center group/row">
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors">{comp.name}</span>
                                                <span className="text-sm font-bold text-rose-600">₹{comp.value?.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-white/5 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-[2.5rem] p-20 flex flex-col items-center justify-center text-center gap-6 group hover:border-primary-500/20 transition-all duration-500">
                        <div className="w-24 h-24 rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-700 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 shadow-inner">
                            <AlertCircle size={48} />
                        </div>
                        <div className="max-w-sm space-y-2">
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Statement Not Found</h3>
                            <p className="text-slate-500 font-medium">Payslip has not been generated for <span className="text-primary-600 font-bold">{months[selectedMonth-1]} {selectedYear}</span> yet.</p>
                        </div>
                    </div>
                )}

                {/* ── 3. Payslip History Table ───────────────────── */}
                <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-sm">
                    <div className="px-10 py-8 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02]">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                            <History size={22} className="text-primary-500" />
                            Payment History
                        </h3>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/10 px-3 py-1.5 rounded-full">Archive</div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100 dark:border-white/10">
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Period</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Salary</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length > 0 ? history.map((h, i) => (
                                    <tr key={i} className="group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors border-b last:border-0 border-slate-100 dark:border-white/10">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-500 font-bold text-sm">
                                                    {h.month.toString().padStart(2, '0')}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{months[h.month-1]}</p>
                                                    <p className="text-xs text-slate-400 font-medium">{h.year}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 font-bold text-slate-900 dark:text-white">
                                            ₹{h.breakdown?.netPay?.toLocaleString()}
                                        </td>
                                        <td className="px-10 py-6">
                                            <span className={clsx(
                                                "text-[10px] font-black tracking-widest px-3 py-1 rounded-full uppercase",
                                                h.isPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                                            )}>
                                                {h.isPaid ? 'Paid' : 'Pending'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    onClick={() => handleView(h._id)}
                                                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                    title="View"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDownload(h._id)}
                                                    className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                                    title="Download"
                                                >
                                                    <Download size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleEmail(h._id)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                    title="Email to me"
                                                >
                                                    <Mail size={18} />
                                                </button>
                                                <button 
                                                    className="p-2 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0"
                                                    onClick={() => {
                                                        setSelectedMonth(h.month)
                                                        setSelectedYear(h.year)
                                                        window.scrollTo({ top: 0, behavior: 'smooth' })
                                                    }}
                                                >
                                                    <ArrowUpRight size={20} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-10 py-12 text-center text-slate-400 font-medium">No payment history found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                </>
            )}
            {/* 🔍 Statement Preview Side Drawer */}
            {previewOpen && selectedPayslip && (
                <StatementPreview 
                    payslip={selectedPayslip} 
                    settings={settings} 
                    onClose={() => setPreviewOpen(false)} 
                    onDownload={handleDownload}
                />
            )}
        </div>
    )
}
