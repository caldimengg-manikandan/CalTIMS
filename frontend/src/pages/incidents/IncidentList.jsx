import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, Filter, Eye, ChevronLeft, ChevronRight, XCircle, Plus, Search } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Spinner from '@/components/ui/Spinner';
import incidentService from '@/services/incidents/incidentService';
import CreateIncidentModal from '@/components/incidents/CreateIncidentModal';
import Pagination from '@/components/ui/Pagination';
import ProGuard from '@/components/ui/ProGuard';

const PRIORITIES = ['All', 'Low', 'Medium', 'High', 'Urgent'];
const STATUSES = ['All', 'Open', 'In Progress', 'Pending', 'Resolved', 'Closed', 'Withdrawn'];

export default function IncidentList() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const isAdmin = user?.role === 'admin';

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [filters, setFilters] = useState({
        status: 'All',
        priority: 'All',
        search: '',
    });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['incidents', page, filters],
        queryFn: () => {
            const apiFilters = {};
            if (filters.status !== 'All') apiFilters.status = filters.status;
            if (filters.priority !== 'All') apiFilters.priority = filters.priority;
            if (filters.search) apiFilters.search = filters.search;
            return incidentService.getIncidents({
                page,
                limit,
                sortBy: 'createdAt',
                sortOrder: 'desc',
                ...apiFilters
            });
        },
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

    return (
        <ProGuard
            title="Help & Support Dashboard"
            subtitle="Centralized incident tracking and support tickets are available in the Enterprise Pro tier. Connect with your team efficiently."
            icon={AlertCircle}
        >
            <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in p-4 lg:p-6">
                <PageHeader title={isAdmin ? "Incidents Dashboard" : "My Incidents"}>
                    {!isAdmin && (
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
                        >
                            <Plus size={16} /> Report an Issue
                        </button>
                    )}
                </PageHeader>

                <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-slate-100 dark:border-white p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-white font-semibold">
                            <Filter size={20} className="text-slate-400" />
                            <h2>Filter Tickets</h2>
                        </div>
                        <button
                            onClick={clearFilters}
                            className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Clear Filters
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Search ID / Title</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search INC-XXXX..."
                                    value={filters.search}
                                    onChange={(e) => handleFilterChange('search', e.target.value)}
                                    className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            >
                                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Priority</label>
                            <select
                                value={filters.priority}
                                onChange={(e) => handleFilterChange('priority', e.target.value)}
                                className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                            >
                                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-black rounded-2xl shadow-sm border border-slate-100 dark:border-white overflow-hidden">
                    <div className="p-6 border-b border-slate-100 dark:border-white">
                        <div className="flex items-center gap-2 text-slate-700 dark:text-white font-semibold">
                            <AlertCircle size={20} className="text-slate-400" />
                            <h2>Tickets</h2>
                        </div>
                    </div>

                    <div className="table-wrapper max-h-container rounded-none border-0 shadow-none text-sm">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50/50 dark:bg-black/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Title</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                    {isAdmin && <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>}
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Priority</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="py-12"><Spinner className="mx-auto" /></td>
                                    </tr>
                                ) : data?.data?.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-20 text-center">
                                            <XCircle size={40} className="mx-auto text-slate-300 mb-3" />
                                            <p className="text-slate-500 font-medium">No tickets found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    data?.data?.map((ticket) => (
                                        <tr key={ticket._id} className="hover:bg-slate-50/50 dark:hover:bg-white dark:hover:text-black transition-colors group cursor-pointer" onClick={() => navigate(`/incidents/${ticket._id}`)}>
                                            <td className="px-6 py-5 font-semibold text-indigo-600">
                                                {ticket.incidentId}
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="font-semibold text-slate-700 dark:text-white truncate max-w-[200px]">
                                                    {ticket.title}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-slate-600 dark:text-slate-300 capitalize">
                                                {ticket.category}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-6 py-5 text-slate-600 dark:text-slate-300">
                                                    {ticket.employee?.name}
                                                </td>
                                            )}
                                            <td className="px-6 py-5 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                                                    {ticket.priority}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <StatusBadge status={ticket.status.toLowerCase()} />
                                            </td>
                                            <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400">
                                                {format(new Date(ticket.createdAt), 'MMM d, yyyy')}
                                            </td>
                                            <td className="px-6 py-5 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => navigate(`/incidents/${ticket._id}`)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-white dark:hover:text-black rounded-lg transition-all"
                                                    title="View Details"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!isLoading && data?.data?.length > 0 && (
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
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={refreshTickets}
                />
            </div>
        </ProGuard>
    );
}
