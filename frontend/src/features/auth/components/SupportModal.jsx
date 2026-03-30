import React, { useState } from 'react'
import Modal from '@/components/ui/Modal'
import {
    Send, CheckCircle2, AlertCircle, Loader2, Search,
    BookOpen, MessageSquare, History, ArrowLeft,
    ExternalLink, ChevronRight, Mail, LifeBuoy
} from 'lucide-react'
import supportService from '@/services/support/supportService'
import { toast } from 'react-hot-toast'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const ISSUE_CATEGORIES = [
    'Login & Access',
    'Timesheet Issues',
    'Leave Management',
    'Reports',
    'Technical Issues',
    'General Support'
]

const FAQ_ITEMS = [
    { q: "I can't login to my account", a: "Check your credentials or contact IT to reset your password if your account is locked." },
    { q: "How to submit a timesheet?", a: "Navigate to 'Timesheet Entry', fill in your hours for each project, and click 'Submit' at the bottom." },
    { q: "Forget my password", a: "Use the 'Forgot Password' link on the login page to receive a reset link via email." },
    { q: "Leave request status pending", a: "Contact your manager or department head to approve your pending leave requests." }
]

export default function SupportModal({ isOpen, onClose }) {
    const [view, setView] = useState('center') // 'center' | 'ticket' | 'track' | 'track-list' | 'success'
    const [formData, setFormData] = useState({ name: '', email: '', issueType: '', message: '' })
    const [searchQuery, setSearchQuery] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isActionLoading, setIsActionLoading] = useState(false)
    const [emailSent, setEmailSent] = useState(false)
    const [emailVerified, setEmailVerified] = useState(false)
    const [otp, setOtp] = useState('')
    const [myTickets, setMyTickets] = useState([])
    const [trackEmail, setTrackEmail] = useState('')
    const [submittedTicket, setSubmittedTicket] = useState(null)
    const [selectedTicket, setSelectedTicket] = useState(null)

    const filteredFAQs = FAQ_ITEMS.filter(item =>
        item.q.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const handleSendOTP = async (targetEmail) => {
        if (!targetEmail || !targetEmail.includes('@')) {
            toast.error('Please enter a valid email address.')
            return
        }

        setIsActionLoading(true)
        try {
            await supportService.sendOTP(targetEmail)
            setEmailSent(true)
            toast.success('Verification code sent to your email.')
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send verification code.')
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleVerifyOTP = async () => {
        const email = view === 'ticket' ? formData.email : trackEmail
        if (!otp || otp.length !== 6) {
            toast.error('Please enter a valid 6-digit code.')
            return
        }

        setIsActionLoading(true)
        try {
            await supportService.verifyOTP(email, otp)
            setEmailVerified(true)
            toast.success('Email verified successfully!')

            if (view === 'track') {
                handleFetchMyTickets(email)
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Invalid or expired code.')
        } finally {
            setIsActionLoading(false)
        }
    }

    const handleFetchMyTickets = async (email) => {
        try {
            const res = await supportService.trackTickets(email)
            setMyTickets(res.data.tickets)
            setView('track-list')
        } catch (err) {
            toast.error('Failed to fetch your tickets.')
        }
    }

    const handleSubmitTicket = async (e) => {
        e.preventDefault()
        if (!emailVerified) return toast.error('Email verification required.')

        setIsSubmitting(true)
        try {
            const res = await supportService.submitTicket(formData)
            setSubmittedTicket(res.data)
            setView('success')
            resetState()
        } catch (err) {
            toast.error('Failed to submit ticket.')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetState = () => {
        setFormData({ name: '', email: '', issueType: '', message: '' })
        setEmailSent(false)
        setEmailVerified(false)
        setOtp('')
        setTrackEmail('')
    }

    const { isAuthenticated } = useAuthStore()
    const navigate = useNavigate()

    const handleClose = () => {
        onClose()
        setTimeout(() => {
            resetState()
            setView('center')
        }, 300)
    }

    const handleEnterPortal = () => {
        handleClose()
        if (isAuthenticated) {
            navigate('/dashboard')
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'Open': return 'text-rose-600 bg-rose-50 border-rose-100'
            case 'In Progress': return 'text-amber-600 bg-amber-50 border-amber-100'
            case 'Resolved': return 'text-emerald-600 bg-emerald-50 border-emerald-100'
            default: return 'text-slate-600 bg-slate-50 border-slate-100'
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={false} maxWidth="max-w-xl">
            <div className="p-1">
                {/* Header with Back Button */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        {view !== 'center' && view !== 'success' && (
                            <button 
                                onClick={() => setView(view === 'details' ? 'track-list' : 'center')} 
                                className="p-2 hover:bg-slate-100 rounded-xl transition-all"
                            >
                                <ArrowLeft size={18} className="text-slate-400" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <LifeBuoy className="text-primary" size={24} />
                                CALTIMS Support Center
                            </h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enterprise Helpdesk System</p>
                        </div>
                    </div>
                </div>

                {/* VIEW: SUPPORT CENTER (MAIN) */}
                {view === 'center' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                       

                        {/* Common Issues */}
                        <div>
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <BookOpen size={16} className="text-primary" />
                                <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Common Solutions</h3>
                            </div>
                            <div className="grid gap-3">
                                {filteredFAQs.length > 0 ? filteredFAQs.map((faq, i) => (
                                    <div key={i} onClick={() => setView('ticket')} className="group p-5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-3xl hover:border-primary/30 hover:shadow-xl hover:shadow-indigo-600/5 transition-all cursor-pointer">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-black text-slate-800 dark:text-white mb-1">{faq.q}</p>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">{faq.a}</p>
                                            </div>
                                            <ChevronRight size={16} className="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                )) : (
                                    <p className="text-center py-8 text-xs font-bold text-slate-400 uppercase">No articles matched your search</p>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setView('ticket')}
                                className="group p-6 btn-primary text-white rounded-[2.5rem] hover:bg-primary-700 transition-all shadow-xl shadow-primary/20 flex flex-col items-center text-center gap-3"
                            >
                                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <MessageSquare size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest">Create Ticket</p>
                                    <p className="text-[10px] text-white/70 font-bold mt-1 uppercase tracking-tight">Speak with human support</p>
                                </div>
                            </button>
                            <button
                                onClick={() => setView('track')}
                                className="group p-6 bg-slate-900 dark:bg-white text-white dark:text-black rounded-[2.5rem] hover:scale-[1.02] transition-all shadow-xl shadow-black/10 flex flex-col items-center text-center gap-3"
                            >
                                <div className="w-12 h-12 bg-white/10 dark:bg-slate-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <History size={24} />
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest">Track Status</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-tight">Check your existing requests</p>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* VIEW: CREATE TICKET */}
                {view === 'ticket' && (
                    <form onSubmit={handleSubmitTicket} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                        <div className="grid gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Stakeholder Name *</label>
                                <input
                                    required
                                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="Enter your full name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Verification *</label>
                                <div className="relative">
                                    <input
                                        required
                                        type="email"
                                        disabled={emailVerified}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all pr-32 disabled:opacity-50"
                                        placeholder="user@organization.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                    {!emailVerified ? (
                                        <button
                                            type="button"
                                            disabled={isActionLoading || !formData.email}
                                            onClick={() => handleSendOTP(formData.email)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 btn-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-700 transition-colors"
                                        >
                                            {isActionLoading ? <Loader2 size={12} className="animate-spin" /> : emailSent ? 'Resend' : 'Get OTP'}
                                        </button>
                                    ) : (
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase">Verified</span>
                                            <CheckCircle2 size={18} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {emailSent && !emailVerified && (
                            <div className="p-6 bg-indigo-50 dark:bg-primary-500/5 rounded-[2rem] border border-indigo-100 dark:border-indigo-500/10 space-y-4 animate-in zoom-in-95">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="text-primary" size={18} />
                                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">Security Challenge</h4>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="6-digit code"
                                        className="flex-1 bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-500/30 rounded-xl px-4 py-3 text-center text-lg font-black tracking-widest outline-none focus:ring-2 focus:ring-primary"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    />
                                    <button
                                        type="button"
                                        disabled={isActionLoading || otp.length !== 6}
                                        onClick={handleVerifyOTP}
                                        className="px-8 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:scale-105 transition-all"
                                    >
                                        Verify
                                    </button>
                                </div>
                                <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-tighter">Check your inbox for the authorization code</p>
                            </div>
                        )}

                        {emailVerified && (
                            <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Classification Category *</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {ISSUE_CATEGORIES.map(cat => (
                                            <button
                                                key={cat}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, issueType: cat })}
                                                className={`px-4 py-3 rounded-2xl text-[11px] font-black transition-all border-2 ${formData.issueType === cat ? 'bg-indigo-50 border-primary text-primary' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`}
                                            >
                                                {cat}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Detailed Log / Message *</label>
                                    <textarea
                                        required
                                        rows={4}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                                        placeholder="Please provide specifics for a faster resolution..."
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    />
                                </div>
                                <button
                                    disabled={isSubmitting}
                                    className="w-full h-16 btn-primary text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:grayscale"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <>Initialize Request <Send size={18} /></>}
                                </button>
                            </div>
                        )}
                    </form>
                )}

                {/* VIEW: TRACK TICKETS (EMAIL INPUT & OTP) */}
                {view === 'track' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300 py-4">
                        <div className="text-center space-y-2">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white">Track Your Requests</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Access your full ticket history securely</p>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Registry Email</label>
                                <div className="relative">
                                    <input
                                        required
                                        type="email"
                                        disabled={emailVerified}
                                        className="w-full h-14 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl px-5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all pr-32 disabled:opacity-50"
                                        placeholder="Enter your email"
                                        value={trackEmail}
                                        onChange={(e) => setTrackEmail(e.target.value)}
                                    />
                                    {!emailVerified && (
                                        <button
                                            type="button"
                                            disabled={isActionLoading || !trackEmail}
                                            onClick={() => handleSendOTP(trackEmail)}
                                            className="absolute right-2.5 top-2.5 bottom-2.5 px-4 btn-primary text-white text-[10px] font-black uppercase rounded-xl hover:bg-primary-700 transition-colors"
                                        >
                                            {isActionLoading ? <Loader2 size={12} className="animate-spin" /> : emailSent ? 'Resend' : 'Send Code'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {emailSent && !emailVerified && (
                                <div className="space-y-4 animate-in zoom-in-95">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="000000"
                                        className="w-full h-16 bg-white border-2 border-primary/20 rounded-2xl text-center text-2xl font-black tracking-[1em] outline-none focus:border-primary"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    />
                                    <button
                                        onClick={handleVerifyOTP}
                                        disabled={isActionLoading || otp.length !== 6}
                                        className="w-full h-14 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl"
                                    >
                                        {isActionLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Authorize View'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW: MY TICKETS LIST */}
                {view === 'track-list' && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Total Tickets: {myTickets.length}</h4>
                            <span className="text-[10px] font-bold text-primary bg-indigo-50 px-3 py-1 rounded-full uppercase">{trackEmail}</span>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                            {myTickets.length > 0 ? myTickets.map(ticket => (
                                <div key={ticket._id} className="p-5 bg-white border border-slate-100 rounded-3xl space-y-3 hover:border-indigo-200 transition-all">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-black text-primary uppercase tracking-widest">{ticket.ticketId}</span>
                                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getStatusColor(ticket.status)}`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    <h5 className="text-sm font-black text-slate-800">{ticket.issueType}</h5>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">{ticket.message}</p>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}</span>
                                        <button 
                                            onClick={() => {
                                                setSelectedTicket(ticket)
                                                setView('details')
                                            }}
                                            className="text-[10px] font-black text-primary uppercase flex items-center gap-1 hover:underline"
                                        >
                                            View Details <ExternalLink size={10} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-20">
                                    <History size={40} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No service record history found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* VIEW: TICKET DETAILS */}
                {view === 'details' && selectedTicket && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 py-4">
                        <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-primary uppercase tracking-widest">{selectedTicket.ticketId}</span>
                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getStatusColor(selectedTicket.status)}`}>
                                    {selectedTicket.status}
                                </span>
                            </div>
                            
                            <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Classification</h4>
                                <p className="text-sm font-bold text-slate-800 dark:text-white uppercase">{selectedTicket.issueType}</p>
                            </div>

                            <div className="space-y-1">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Logged On</h4>
                                <p className="text-sm font-medium text-slate-500 uppercase">{format(new Date(selectedTicket.createdAt), 'MMMM dd, yyyy HH:mm')}</p>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-2">
                                <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Message Log</h4>
                                <div className="p-4 bg-white dark:bg-black/20 rounded-2xl border border-slate-100 dark:border-white/5">
                                    <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                                        {selectedTicket.message}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={() => setView('track-list')}
                            className="w-full py-4 border-2 border-slate-100 dark:border-white/5 text-[10px] font-black uppercase tracking-widest text-slate-400 rounded-2xl hover:bg-slate-50 transition-all"
                        >
                            Back to Request List
                        </button>
                    </div>
                )}
                {view === 'success' && (
                    <div className="py-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
                        <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl">
                            <CheckCircle2 size={48} className="text-emerald-500" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-slate-900">Request Dispatched!</h3>
                            <p className="text-sm text-slate-500 font-medium max-w-[280px] mx-auto leading-relaxed">
                                Your support request has been logged successfully.
                                <span className="block mt-1 text-xs text-primary">Ticket ID: {submittedTicket?.ticketId}</span>
                            </p>
                        </div>
                        <div className="pt-6">
                            <button
                                onClick={handleEnterPortal}
                                className="px-12 py-4 bg-slate-900 text-white rounded-[2rem] text-xs font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl"
                            >
                                Enter Portal
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    )
}
