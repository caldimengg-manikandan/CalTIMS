import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import {
    AlertCircle, Filter, Eye, XCircle, Plus, Search,
    LifeBuoy, ShieldAlert, Trash2, CheckCircle2, Clock,
    MoreVertical
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Spinner from '@/components/ui/Spinner';
import incidentService from '@/services/incidents/incidentService';
import supportService from '@/services/support/supportService';
import CreateIncidentModal from '@/components/incidents/CreateIncidentModal';
import SupportTicketDetail from '@/components/support/SupportTicketDetail';
import Pagination from '@/components/ui/Pagination';
import ProGuard from '@/components/ui/ProGuard';
import { toast } from 'react-hot-toast';

const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['All', 'Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Withdrawn'];
const SUPPORT_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];

export default function IncidentList() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const isAdmin = user?.role === 'admin';

    const [activeTab, setActiveTab] = useState('incidents'); // 'incidents' | 'support'
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [filters, setFilters] = useState({
        status: 'All',
        priority: 'All',
        search: '',
    });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [modalInitialData, setModalInitialData] = useState(null);
    const location = useLocation();

    useEffect(() => {
        if (location.state?.autoOpen) {
            if (location.state.type === 'frozen') {
                setModalInitialData({
                    title: 'FROZEN TIMESHEET',
                    category: 'timesheet error',
                    priority: 'High'
                });
            }
            setIsCreateModalOpen(true);
            // Clear the state so it doesn't reopen on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);

    // Queries
    const incidentsQuery = useQuery({
        queryKey: ['incidents', page, limit, filters],
        queryFn: () => {
            const apiFilters = {};
            if (filters.status !== 'All') apiFilters.status = filters.status;
            if (filters.priority !== 'All') apiFilters.priority = filters.priority;
            if (filters.search) apiFilters.search = filters.search;
            return incidentService.getIncidents({ page, limit, ...apiFilters });
        },
        enabled: activeTab === 'incidents'
    });

    const supportQuery = useQuery({
        queryKey: ['support-tickets', page, limit, filters],
        queryFn: () => {
            const apiFilters = {};
            if (filters.status !== 'All') apiFilters.status = filters.status;
            if (filters.search) apiFilters.search = filters.search;
            return supportService.getTickets({ page, limit, ...apiFilters });
        },
        enabled: activeTab === 'support' && isAdmin
    });

    // Mutations
    const updateSupportStatus = useMutation({
        mutationFn: ({ id, status }) => supportService.updateTicketStatus(id, status),
        onSuccess: () => {
            toast.success('Ticket status updated');
            qc.invalidateQueries(['support-tickets']);
        },
        onError: (err) => toast.error(err.message)
    });

    const deleteSupportTicket = useMutation({
        mutationFn: (id) => supportService.deleteTicket(id),
        onSuccess: () => {
            toast.success('Ticket deleted');
            qc.invalidateQueries(['support-tickets']);
        },
        onError: (err) => toast.error(err.message)
    });

    const refreshTickets = () => {
        setPage(1);
    };

    const handleFilterChange = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    };

    const clearFilters = () => {
        setFilters({ status: 'All', priority: 'All', search: '' });
        setPage(1);
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'Urgent': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'High': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'Medium': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Low': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const data = activeTab === 'incidents' ? incidentsQuery.data : supportQuery.data;
    const isLoading = activeTab === 'incidents' ? incidentsQuery.isLoading : supportQuery.isLoading;

    const listItems = (data?.data || []).map((item, index) => {
        if (activeTab === 'support') {
            // Create a sequential display ID: SUP-0001, SUP-0002 etc.
            // Using the total count and index to make it look like a series
            const total = data?.total || (data?.data || []).length;
            const serial = (total - index).toString().padStart(4, '0');
            
            return {
                ...item,
                ticketId: `SUP-${serial}`,
                name: item.employee?.user?.name || 'Anonymous User',
                email: item.employee?.user?.email || 'N/A',
                issueType: item.category || 'General Issue',
                message: item.description || '',
                responses: (item.comments || []).map(c => ({
                    ...c,
                    message: c.message || c.content,
                    sender: (c.user?.role === 'admin' || c.user?.role === 'owner') ? 'admin' : 'user'
                }))
            };
        }
        return item;
    });

    return (
        <ProGuard
            title="Help & Support Dashboard"
            subtitle="Centralized incident tracking and support tickets are available in the Enterprise Pro tier. Connect with your team efficiently."
            icon={AlertCircle}
        >
            <div className="min-h-[calc(100vh-160px)] flex flex-col gap-4 animate-fade-in">
                <PageHeader title={isAdmin ? "Help & Support Center" : "My Incidents"}>
                    {activeTab === 'incidents' && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 btn-primary hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            <Plus size={18} /> Report an Issue
                        </button>
                    )}
                </PageHeader>

                {selectedTicket ? (
                    <SupportTicketDetail
                        ticket={selectedTicket}
                        onBack={() => setSelectedTicket(null)}
                    />
                ) : (
                    <>
                        {/* Admin Tabs */}
                        {isAdmin && (
                            <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl w-fit">
                                <button
                                    onClick={() => { setActiveTab('incidents'); clearFilters(); }}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'incidents' ? 'bg-white dark:bg-black text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                                >
                                    <ShieldAlert size={16} /> Internal Incidents
                                </button>
                                <button
                                    onClick={() => { setActiveTab('support'); clearFilters(); }}
                                    className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'support' ? 'bg-white dark:bg-black text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}
                                >
                                    <LifeBuoy size={16} /> External Support Requests
                                </button>
                            </div>
                        )}

                        {/* Filters */}
                        <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-slate-100 dark:border-white p-6 shrink-0">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-xl text-slate-400">
                                        <Filter size={18} />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Filter Pipeline</h2>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Refine results by parameters</p>
                                    </div>
                                </div>
                                <button onClick={clearFilters} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-colors">
                                    Reset Filters
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search ID / Context</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold" size={16} />
                                        <input
                                            type="text"
                                            placeholder={activeTab === 'incidents' ? "Search INC-XXXX" : "Search SUP-XXXX, Name or Email"}
                                            value={filters.search}
                                            onChange={(e) => handleFilterChange('search', e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl pl-12 pr-12 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                        />
                                        {filters.search && (
                                            <button
                                                onClick={() => handleFilterChange('search', '')}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Status Protocol</label>
                                    <select
                                        value={filters.status}
                                        onChange={(e) => handleFilterChange('status', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        {(activeTab === 'incidents' ? STATUSES : ['All', ...SUPPORT_STATUSES]).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                {activeTab === 'incidents' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Severity Level</label>
                                        <select
                                            value={filters.priority}
                                            onChange={(e) => handleFilterChange('priority', e.target.value)}
                                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl px-5 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                                        >
                                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="bg-white dark:bg-black rounded-3xl shadow-sm border border-slate-100 dark:border-white overflow-hidden flex flex-col min-h-0 flex-1">
                            <div className="p-6 border-b border-slate-100 dark:border-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-primary">
                                        <AlertCircle size={18} />
                                    </div>
                                    <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">
                                        {activeTab === 'incidents' ? 'Active Incidents' : 'External Support Tickets'}
                                    </h2>
                                </div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{data?.pagination?.total || 0} TOTAL RECORDS</p>
                            </div>

                            <div className="overflow-y-auto flex-1 scroll-v-adaptive scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-white/5">
                                        <tr>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">{activeTab === 'incidents' ? 'Context' : 'Stakeholder'}</th>
                                            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Classification</th>
                                            {isAdmin && activeTab === 'incidents' && <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Employee</th>}
                                            {activeTab === 'incidents' && <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Priority</th>}
                                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Network Status</th>
                                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                                            <th className="px-6 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                        {isLoading ? (
                                            <tr><td colSpan={8} className="py-20 text-center"><Spinner className="mx-auto" /></td></tr>
                                        ) : listItems.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="py-24 text-center">
                                                    <XCircle size={40} className="mx-auto text-slate-300 mb-4" />
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No matching records found</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            listItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group">
                                                    <td className="px-6 py-5">
                                                        <span className="text-xs font-black text-primary bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-lg">
                                                            {activeTab === 'incidents' ? item.incidentId : item.ticketId}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <div className="max-w-[200px]">
                                                            <p className="text-sm font-black text-slate-800 dark:text-white truncate">
                                                                {activeTab === 'incidents' ? item.title : item.name}
                                                            </p>
                                                            <p className="text-[10px] font-bold text-slate-400 truncate tracking-tight">
                                                                {activeTab === 'incidents' ? item.description : item.email}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5">
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                            {activeTab === 'incidents' ? item.category : item.issueType}
                                                        </span>
                                                    </td>
                                                    {isAdmin && activeTab === 'incidents' && (
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                                                                    {item.employee?.name?.charAt(0)}
                                                                </div>
                                                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{item.employee?.user?.name}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {activeTab === 'incidents' && (
                                                        <td className="px-6 py-5 text-center">
                                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${getPriorityColor(item.priority)}`}>
                                                                {item.priority}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-5 text-center">
                                                        <StatusBadge status={item.status.toLowerCase()} />
                                                    </td>
                                                    <td className="px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {format(new Date(item.createdAt), 'MMM d, yyyy')}
                                                    </td>
                                                    <td className="px-6 py-5 text-center">
                                                        {activeTab === 'incidents' ? (
                                                            <button onClick={() => navigate(`/incidents/${item.id}`)} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all shadow-sm">
                                                                <Eye size={18} />
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button
                                                                    onClick={() => setSelectedTicket(item)}
                                                                    className="p-2 text-primary hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all shadow-sm"
                                                                    title="Review Ticket"
                                                                >
                                                                    <Eye size={18} />
                                                                </button>
                                                                <div className="relative group/menu">
                                                                    <button className="p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all">
                                                                        <MoreVertical size={18} />
                                                                    </button>
                                                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-50 p-2 space-y-1">
                                                                        <p className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-100 dark:border-white/5">Update Status</p>
                                                                        {SUPPORT_STATUSES.map(s => (
                                                                            <button
                                                                                key={s}
                                                                                onClick={() => updateSupportStatus.mutate({ id: item.id, status: s })}
                                                                                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${item.status === s ? 'bg-indigo-50 dark:bg-indigo-900/30 text-primary' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                                                                            >
                                                                                <div className={`w-1.5 h-1.5 rounded-full ${s === 'Resolved' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                                                {s}
                                                                            </button>
                                                                        ))}
                                                                        <button
                                                                            onClick={() => { if (confirm('Purge support record?')) deleteSupportTicket.mutate(item.id) }}
                                                                            className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all flex items-center gap-2 border-t border-slate-100 dark:border-white/5 mt-1"
                                                                        >
                                                                            <Trash2 size={14} /> Purge Ticket
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {!isLoading && data?.pagination?.total > 0 && (
                                <Pagination
                                    currentPage={data.pagination.page}
                                    totalPages={data.pagination.totalPages}
                                    totalResults={data.pagination.total}
                                    limit={limit}
                                    onPageChange={setPage}
                                    onLimitChange={(l) => { setLimit(l); setPage(1); }}
                                />
                            )}
                        </div>

                        <CreateIncidentModal
                            isOpen={isCreateModalOpen}
                            onClose={() => {
                                setIsCreateModalOpen(false);
                                setModalInitialData(null);
                            }}
                            onSuccess={refreshTickets}
                            initialData={modalInitialData}
                        />
                    </>
                )}
            </div>
        </ProGuard>
    );
}
