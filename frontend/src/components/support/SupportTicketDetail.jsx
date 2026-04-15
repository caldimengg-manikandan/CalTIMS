import React, { useState } from 'react'
import { format } from 'date-fns'
import { Send, User, Shield, Clock, CheckCircle2, MessageSquare, ArrowLeft } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import supportService from '@/services/support/supportService'
import { toast } from 'react-hot-toast'

export default function SupportTicketDetail({ ticket, onBack }) {
    const [replyMessage, setReplyMessage] = useState('')
    const qc = useQueryClient()

    const addMessageMutation = useMutation({
        mutationFn: (message) => supportService.addTicketMessage(ticket.id, message, 'admin'),
        onSuccess: () => {
            toast.success('Reply submitted')
            setReplyMessage('')
            qc.invalidateQueries(['support-tickets'])
            qc.invalidateQueries(['support-ticket', ticket.id])
        },
        onError: (err) => toast.error(err.message)
    })

    const handleReply = (e) => {
        e.preventDefault()
        if (!replyMessage.trim()) return
        addMessageMutation.mutate(replyMessage)
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'Open': return 'bg-rose-100 text-rose-700 border-rose-200'
            case 'In Progress': return 'bg-orange-100 text-orange-700 border-orange-200'
            case 'Resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            default: return 'bg-slate-100 text-slate-700 border-slate-200'
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-xs font-black uppercase tracking-widest">Back to Dashboard</span>
                </button>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(ticket.status)}`}>
                    {ticket.status}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Ticket Header */}
                    <div className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] border border-slate-100 dark:border-white/5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-primary bg-indigo-50 px-3 py-1 rounded-xl uppercase tracking-widest">{ticket.ticketId}</span>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Clock size={14} />
                            <span className="text-[10px] font-bold uppercase">{format(new Date(ticket.createdAt), 'MMM d, yyyy HH:mm')}</span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">{ticket.issueType}</h2>
                    <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                            {ticket.message}
                        </p>
                    </div>
                </div>

                {/* Conversation Thread */}
                <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-4 flex items-center gap-2">
                        <MessageSquare size={14} />
                        Communication Thread
                    </h3>

                    <div className="space-y-4">
                        {ticket.responses && ticket.responses.map((resp, i) => (
                            <div key={i} className={`flex ${resp.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-5 rounded-3xl ${resp.sender === 'admin' ? 'btn-primary text-white rounded-tr-none' : 'bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-800 dark:text-slate-200 rounded-tl-none'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {resp.sender === 'admin' ? <Shield size={12} className="text-indigo-200" /> : <User size={12} className="text-slate-400" />}
                                        <span className="text-[9px] font-black uppercase tracking-widest opacity-70">
                                            {resp.sender === 'admin' ? 'Support Agent' : ticket.name}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium leading-relaxed">{resp.message}</p>
                                    <p className={`text-[8px] font-bold uppercase mt-2 text-right ${resp.sender === 'admin' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                        {format(new Date(resp.createdAt), 'HH:mm')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Reply Form */}
                    {ticket.status !== 'Closed' && (
                        <form onSubmit={handleReply} className="relative group">
                            <textarea
                                className="w-full bg-white dark:bg-white/5 border border-slate-100 focus:border-primary focus:ring-1 focus:ring-primary outline-none rounded-[2rem] px-8 py-6 text-sm font-medium transition-all shadow-sm pr-20 resize-none"
                                placeholder="Type your professional response..."
                                rows={3}
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={addMessageMutation.isPending || !replyMessage.trim()}
                                className="absolute right-4 bottom-4 p-4 btn-primary text-white rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:grayscale"
                            >
                                {addMessageMutation.isPending ? <Clock className="animate-spin" size={20} /> : <Send size={20} />}
                            </button>
                        </form>
                    )}
                </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <div className="bg-white dark:bg-white/5 p-6 rounded-[2rem] border border-slate-100 dark:border-white/5 divide-y divide-slate-50 dark:divide-white/5">
                        <div className="pb-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Stakeholder Details</h4>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 text-primary rounded-xl flex items-center justify-center font-black">
                                    {ticket.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{ticket.name}</p>
                                    <p className="text-xs text-slate-500 font-bold">{ticket.email}</p>
                                </div>
                            </div>
                        </div>
                        <div className="py-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Meta Protocol</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-[10px] font-bold text-slate-400">CATEGORY</span>
                                    <span className="text-[10px] font-black uppercase text-slate-800 dark:text-white">{ticket.issueType}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[10px] font-bold text-slate-400">INITIATED</span>
                                    <span className="text-[10px] font-black uppercase text-slate-800 dark:text-white">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-500/5 p-6 rounded-[2rem] border border-emerald-100 dark:border-emerald-500/10">
                        <div className="flex items-center gap-3 mb-4">
                            <CheckCircle2 size={18} className="text-emerald-500" />
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-900 dark:text-emerald-400">Operational Suggestion</h4>
                        </div>
                        <p className="text-xs text-emerald-800/70 dark:text-emerald-400/70 font-bold leading-relaxed">
                            Respond promptly to maintain a high service level indicator (SLI). Once resolved, remember to update the protocol status.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
