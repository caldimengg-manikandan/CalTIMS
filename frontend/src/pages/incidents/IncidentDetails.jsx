import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { format } from 'date-fns';
import { ArrowLeft, MessageSquare, Send, User, Calendar, Tag, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Spinner from '@/components/ui/Spinner';
import toast from 'react-hot-toast';
import incidentService from '@/services/incidents/incidentService';
import ProGuard from '@/components/ui/ProGuard';

export default function IncidentDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const isAdmin = user?.role === 'admin';

    const [replyText, setReplyText] = useState('');

    const { data: ticket, isLoading } = useQuery({
        queryKey: ['incident', id],
        queryFn: () => incidentService.getIncident(id).then(r => r.data),
        refetchInterval: 5000, // Poll for new replies every 5 seconds
    });

    const replyMutation = useMutation({
        mutationFn: (message) => incidentService.addResponse(id, message),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incident', id] });
            setReplyText('');
            toast.success('Reply submitted');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to submit reply'),
    });

    const statusMutation = useMutation({
        mutationFn: (status) => incidentService.updateIncident(id, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['incident', id] });
            toast.success('Status updated');
        },
        onError: (err) => toast.error(err.response?.data?.message || 'Failed to update status'),
    });

    if (isLoading) return <div className="flex justify-center p-20"><Spinner /></div>;
    if (!ticket) return <div className="p-20 text-center text-slate-500">Ticket not found</div>;

    const handleReply = (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        replyMutation.mutate(replyText);
    };

    return (
        <ProGuard
            title="Incident Details"
            subtitle="Deep-dive incident analysis and communication threads are available in the Enterprise Pro tier."
            icon={AlertCircle}
        >
            <div className="space-y-6 max-w-[1200px] mx-auto animate-fade-in p-4 lg:p-6">
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => navigate('/incidents')}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <PageHeader title={`Ticket ${ticket.incidentId}`} subtitle="Incident Details" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Left Column: Details & Thread */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Original Ticket */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <div className="flex justify-between items-start mb-4">
                                <h2 className="text-xl font-bold text-slate-800">{ticket.title}</h2>
                                <StatusBadge status={ticket.status.toLowerCase()} />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                                <span className="flex items-center gap-1"><User size={16} /> {ticket.employee.name}</span>
                                <span className="flex items-center gap-1"><Calendar size={16} /> {format(new Date(ticket.createdAt), 'MMM d, yyyy h:mm a')}</span>
                            </div>
                            <div className="prose max-w-none text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl">
                                {ticket.description}
                            </div>
                        </div>

                        {/* Responses Thread */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                                <MessageSquare size={20} className="text-indigo-500" />
                                Conversation
                            </h3>

                            <div className="space-y-6 mb-6">
                                {ticket.responses.length === 0 ? (
                                    <p className="text-slate-500 italic text-center py-4">No replies yet.</p>
                                ) : (
                                    ticket.responses.map((res, idx) => {
                                        const isMe = res.user._id === user.id;
                                        const isAdminResponse = res.user.role === 'admin';

                                        return (
                                            <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-sm font-semibold text-slate-700">{res.user.name}</span>
                                                    {isAdminResponse && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Admin</span>}
                                                    <span className="text-xs text-slate-400">{format(new Date(res.createdAt), 'MMM d, h:mm a')}</span>
                                                </div>
                                                <div className={`px-4 py-3 rounded-2xl max-w-[85%] ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                                                    {res.message}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Reply Form / Status Actions */}
                            {ticket.status !== 'Closed' && ticket.status !== 'Withdrawn' ? (
                                <form onSubmit={handleReply} className="mt-4 relative">
                                    <textarea
                                        rows={3}
                                        placeholder="Type your reply..."
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all pr-12 resize-none"
                                    />
                                    <button
                                        type="submit"
                                        disabled={replyMutation.isPending || !replyText.trim()}
                                        className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                    >
                                        <Send size={16} />
                                    </button>
                                </form>
                            ) : (
                                <div className="bg-amber-50 rounded-lg p-4 text-amber-800 text-sm text-center font-medium">
                                    This ticket is {ticket.status.toLowerCase()}. You cannot add new replies.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Meta Info */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                            <h3 className="font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Ticket Info</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Category</label>
                                    <div className="text-sm font-medium text-slate-700 capitalize flex items-center gap-2">
                                        <Tag size={16} className="text-slate-400" /> {ticket.category}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Priority</label>
                                    <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <AlertCircle size={16} className={ticket.priority === 'Urgent' ? 'text-rose-500' : 'text-slate-400'} /> {ticket.priority}
                                    </div>
                                </div>

                                {/* Admin Controls */}
                                {isAdmin && (
                                    <div className="pt-4 mt-4 border-t border-slate-100">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Admin Actions - Status</label>
                                        <select
                                            value={ticket.status}
                                            onChange={(e) => statusMutation.mutate(e.target.value)}
                                            disabled={statusMutation.isPending}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                                        >
                                            <option value="Open">Open</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Pending">Pending</option>
                                            <option value="Resolved">Resolved</option>
                                            <option value="Closed">Closed</option>
                                            {ticket.status === 'Withdrawn' && <option value="Withdrawn">Withdrawn</option>}
                                        </select>
                                    </div>
                                )}

                                {/* Employee Controls: Withdraw & Reopen */}
                                {!isAdmin && (ticket.employee._id === user.id || ticket.employee === user.id) && (
                                    <div className="pt-4 mt-4 border-t border-slate-100 space-y-3">
                                        {['Open', 'In Progress'].includes(ticket.status) && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Are you sure you want to withdraw this support ticket?')) {
                                                        statusMutation.mutate('Withdrawn');
                                                    }
                                                }}
                                                disabled={statusMutation.isPending}
                                                className="w-full py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors"
                                            >
                                                Withdraw Ticket
                                            </button>
                                        )}
                                        {['Resolved', 'Closed', 'Withdrawn'].includes(ticket.status) && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Do you want to reopen this support ticket?')) {
                                                        statusMutation.mutate('Open');
                                                    }
                                                }}
                                                disabled={statusMutation.isPending}
                                                className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                                            >
                                                Reopen Ticket
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </ProGuard>
    );
}
