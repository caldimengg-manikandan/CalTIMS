import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '@/services/endpoints';
import { 
  Shield, Search, Download, 
  ChevronRight, User, Layout, 
  FileText, AlertCircle, 
  CheckCircle2, XCircle, Info, Clock, 
  ArrowRight, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [filters, setFilters] = useState({
    action: '',
    status: '',
    search: ''
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
      };
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      // Search is still client-side for now or we could move to backend

      const res = await auditAPI.getAll(params);
      setLogs(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters.action, filters.status]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, page, limit]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'FAILED': return <XCircle className="w-4 h-4 text-rose-500" />;
      case 'WARNING': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getActionColor = (action) => {
    if (!action) return 'bg-slate-100 text-slate-600';
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'bg-rose-100 text-rose-700';
    if (action.includes('CREATE') || action.includes('ACTIVATE')) return 'bg-emerald-100 text-emerald-700';
    if (action.includes('LOGIN') || action.includes('LOGOUT')) return 'bg-blue-100 text-blue-700';
    if (action.includes('PAYROLL')) return 'bg-indigo-100 text-indigo-700';
    if (action.includes('UPDATE') || action.includes('CHANGE')) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  };

  // Client-side search filter
  const filteredLogs = logs.filter(log => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    return (
      (log.action || '').toLowerCase().includes(q) ||
      (log.performedBy?.name || 'System').toLowerCase().includes(q) ||
      (log.entity || '').toLowerCase().includes(q) ||
      (log.role || '').toLowerCase().includes(q)
    );
  });

  const handleExportCSV = () => {
    const rows = [
      ['Action', 'User', 'Role', 'Entity', 'Status', 'IP Address', 'Timestamp'],
      ...filteredLogs.map(l => [
        l.action,
        l.performedBy?.name || 'System',
        l.role,
        l.entity,
        l.status,
        l.ipAddress,
        new Date(l.createdAt).toISOString()
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= Math.ceil(total / limit)) {
      setPage(newPage);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50/30 dark:bg-black min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            Audit Logs
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm font-medium">
            <Clock className="w-3.5 h-3.5" />
            Real-time system activity monitoring — {total} total events
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setPage(1); fetchLogs(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] text-slate-700 dark:text-white font-bold rounded-lg border border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] text-slate-700 dark:text-white font-bold rounded-lg border border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-[#111111] p-4 rounded-xl border border-slate-200 dark:border-[#333333] shadow-sm">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by action, user, entity..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm font-medium dark:text-white"
            value={filters.search}
            onChange={(e) => {
              setFilters({ ...filters, search: e.target.value });
              setPage(1);
            }}
          />
        </div>
        <select 
          className="px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-semibold text-slate-700 dark:text-white"
          value={filters.action}
          onChange={(e) => {
            setFilters({ ...filters, action: e.target.value });
            setPage(1);
          }}
        >
          <option value="">All Actions</option>
          <option value="LOGIN">Login</option>
          <option value="LOGOUT">Logout</option>
          <option value="RUN_PAYROLL">Run Payroll</option>
          <option value="CREATE_EMPLOYEE">Create Employee</option>
          <option value="UPDATE_EMPLOYEE">Update Employee</option>
          <option value="DELETE_EMPLOYEE">Delete Employee</option>
          <option value="DEACTIVATE_EMPLOYEE">Deactivate Employee</option>
          <option value="CHANGE_EMPLOYEE_ROLE">Change Role</option>
          <option value="STRUCTURE_CREATE">Structure Create</option>
          <option value="STRUCTURE_UPDATE">Structure Update</option>
          <option value="POLICY_UPDATE">Policy Update</option>
          <option value="CHANGE_PASSWORD">Change Password</option>
        </select>
        <select 
          className="px-4 py-2.5 bg-slate-50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-semibold text-slate-700 dark:text-white"
          value={filters.status}
          onChange={(e) => {
            setFilters({ ...filters, status: e.target.value });
            setPage(1);
          }}
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="WARNING">Warning</option>
        </select>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#111111] rounded-xl border border-slate-200 dark:border-[#333333] shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-250px)]">
        {/* Scrollable Table Area */}
        <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 relative">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-20 bg-white dark:bg-[#111111] shadow-[0_1px_0_0_rgba(241,245,249,1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
              <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-5 sticky top-0 bg-white dark:bg-[#111111]">Action</th>
                <th className="px-8 py-5 sticky top-0 bg-white dark:bg-[#111111]">User</th>
                <th className="px-8 py-5 sticky top-0 bg-white dark:bg-[#111111]">Role</th>
                <th className="px-8 py-5 text-center sticky top-0 bg-white dark:bg-[#111111]">Status</th>
                <th className="px-8 py-5 sticky top-0 bg-white dark:bg-[#111111]">Entity</th>
                <th className="px-8 py-5 sticky top-0 bg-white dark:bg-[#111111]">Time</th>
                <th className="px-8 py-5 sticky top-0 bg-white dark:bg-[#111111] text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {loading ? (
                [...Array(limit)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan="7" className="px-8 py-5">
                      <div className="h-4 bg-slate-50 dark:bg-[#0a0a0a] rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-10 py-32 text-center">
                    <div className="bg-slate-50 dark:bg-[#0a0a0a] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-8 h-8 text-slate-200 dark:text-[#333333]" />
                    </div>
                    <p className="text-slate-400 font-bold text-sm tracking-tight">No activity logs found</p>
                    <p className="text-slate-300 text-xs mt-1">Actions performed in the system will be tracked here</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getActionColor(log.action)} bg-opacity-10`}>
                        {log.action?.replace(/_/g, ' ') || 'ACTION'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[11px] font-black pointer-events-none transition-transform group-hover:scale-105 shadow-sm border border-indigo-100/50 dark:border-indigo-500/20">
                          {(log.performedBy?.name || 'S')[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-slate-600 dark:text-white font-bold tracking-tight">
                          {log.performedBy?.name || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight px-2 py-1 bg-slate-50 dark:bg-[#0a0a0a] rounded">
                        {log.role || '—'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex justify-center">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' : 
                          log.status === 'FAILED' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                             log.status === 'SUCCESS' ? 'bg-emerald-500' : 
                             log.status === 'FAILED' ? 'bg-rose-500' : 'bg-amber-500'
                          }`} />
                          {log.status}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-xs text-slate-500 font-medium tracking-tight">
                        {log.entity || '—'}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-mono text-[11px] text-slate-400">
                      {log.createdAt ? format(new Date(log.createdAt), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-8 py-5 text-right">
                       <button className="p-2 text-slate-300 dark:text-[#333333] hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                         <ChevronRight className="w-4 h-4" />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Frozen Pagination Footer */}
        <div className="flex items-center justify-between px-8 py-5 bg-white dark:bg-[#111111] border-t border-slate-100 dark:border-[#333333] sticky bottom-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 font-medium">Items per page:</span>
            <select 
              className="text-sm font-bold text-slate-600 dark:text-white bg-slate-50/50 dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#333333] rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-slate-300 transition-all focus:ring-2 focus:ring-indigo-500/20"
              value={limit}
              onChange={(e) => {
                setLimit(parseInt(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div className="flex items-center gap-8">
            <p className="text-sm text-slate-400 font-medium tracking-tight">
              Showing <span className="text-slate-900 dark:text-white font-bold">{(page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-white font-bold">{Math.min(page * limit, total)}</span> of <span className="text-slate-900 dark:text-white font-bold">{total}</span> results
            </p>
            
            <div className="flex items-center gap-1.5">
              <button 
                disabled={page === 1 || loading}
                onClick={() => handlePageChange(page - 1)}
                className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-600 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              
              <div className="flex items-center gap-1.5">
                {[...Array(Math.ceil(total / limit))].map((_, i) => {
                  const pageNum = i + 1;
                  const totalPages = Math.ceil(total / limit);
                  
                  if (totalPages > 5) {
                    if (pageNum !== 1 && pageNum !== totalPages && (pageNum < page - 1 || pageNum > page + 1)) {
                      if (pageNum === page - 2 || pageNum === page + 2) return <span key={pageNum} className="text-slate-300">...</span>;
                      return null;
                    }
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        page === pageNum 
                        ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-600 shadow-sm shadow-indigo-100' 
                        : 'bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] text-slate-500 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:border-slate-300'
                    }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button 
                disabled={page >= Math.ceil(total / limit) || loading}
                onClick={() => handlePageChange(page + 1)}
                className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] hover:text-slate-600 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <>
          <div 
            className="fixed inset-0 bg-black/70 z-[60] transition-all"
            onClick={() => setSelectedLog(null)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white dark:bg-[#111111] z-[70] shadow-2xl border-l border-slate-200 dark:border-[#333333] flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-[#333333] flex items-center justify-between bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-600" />
                Audit Detail
              </h2>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Action Banner */}
              <div className={`p-5 rounded-2xl text-white shadow-xl ${
                selectedLog.status === 'SUCCESS' ? 'bg-indigo-600 shadow-indigo-100' :
                selectedLog.status === 'FAILED' ? 'bg-rose-600 shadow-rose-100' : 'bg-amber-500 shadow-amber-100'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Activity</p>
                    <h3 className="text-xl font-black">{(selectedLog.action || '').replace(/_/g, ' ')}</h3>
                  </div>
                  <div className="bg-white/20 p-2 rounded-xl">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium border-t border-white/10 pt-4">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 opacity-60" />
                    {selectedLog.createdAt ? format(new Date(selectedLog.createdAt), 'MMM d, yyyy h:mm:ss a') : '—'}
                  </div>
                  {selectedLog.entity && (
                    <>
                      <div className="h-4 w-px bg-white/20" />
                      <div className="flex items-center gap-1.5 capitalize">
                        <Layout className="w-3.5 h-3.5 opacity-60" />
                        {selectedLog.entity}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Identity */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Identity</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl border border-slate-100 dark:border-[#333333]">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Performed By</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{selectedLog.performedBy?.name || 'System'}</p>
                    <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">{selectedLog.role}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl border border-slate-100 dark:border-[#333333]">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">IP Address</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">{selectedLog.ipAddress || '—'}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      Logged
                    </p>
                  </div>
                </div>
              </div>

              {/* Changes Section */}
              {(() => {
                const details = selectedLog.details || {};
                const before  = details.before;
                const after   = details.after;
                const message = details.message;

                // Collect any extra contextual keys (exclude internals)
                const SKIP = new Set(['before', 'after', 'message', 'status', 'ipAddress', 'entityId', 'organizationId']);
                const extraKeys = Object.keys(details).filter(k => !SKIP.has(k) && details[k] !== null && details[k] !== undefined && details[k] !== '');

                const hasDiff    = before && after;
                const hasMessage = !!message;
                const hasExtras  = extraKeys.length > 0;

                if (!hasDiff && !hasMessage && !hasExtras) return null;

                // Compute changed keys when both before/after exist
                const allKeys = hasDiff
                  ? [...new Set([...Object.keys(before), ...Object.keys(after)])]
                  : [];
                const changedKeys = allKeys.filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

                const fmtVal = (v) => {
                  if (v === null || v === undefined) return <span className="italic text-slate-400">—</span>;
                  if (typeof v === 'object') return <span className="font-mono text-[10px]">{JSON.stringify(v)}</span>;
                  return <span>{String(v)}</span>;
                };

                return (
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Changes</h4>

                    {/* Human-readable message */}
                    {hasMessage && (
                      <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-500/20 rounded-xl text-sm text-blue-700 dark:text-blue-300 font-medium">
                        {message}
                      </div>
                    )}

                    {/* Before / After diff table */}
                    {hasDiff && changedKeys.length > 0 && (
                      <div className="rounded-xl border border-slate-200 dark:border-[#333333] overflow-hidden">
                        <div className="grid grid-cols-3 bg-slate-50 dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#333333] px-4 py-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Field</span>
                          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">Before</span>
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">After</span>
                        </div>
                        {changedKeys.map(key => (
                          <div key={key} className="grid grid-cols-3 border-b border-slate-100 dark:border-[#222222] last:border-0 px-4 py-2.5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 capitalize pr-2">
                              {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                            </span>
                            <span className="text-xs text-rose-600 dark:text-rose-400 pr-2 break-all">{fmtVal(before[key])}</span>
                            <span className="text-xs text-emerald-700 dark:text-emerald-400 break-all">{fmtVal(after[key])}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unchanged fields note */}
                    {hasDiff && changedKeys.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No field-level changes detected.</p>
                    )}

                    {/* Extra contextual fields */}
                    {hasExtras && (
                      <div className="rounded-xl border border-slate-200 dark:border-[#333333] overflow-hidden">
                        {extraKeys.map(k => (
                          <div key={k} className="flex items-start gap-4 border-b border-slate-100 dark:border-[#222222] last:border-0 px-4 py-2.5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide w-28 shrink-0 pt-0.5">
                              {k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                            </span>
                            <span className="text-xs text-slate-700 dark:text-slate-300 break-all font-mono">
                              {typeof details[k] === 'object'
                                ? JSON.stringify(details[k], null, 2)
                                : String(details[k])}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-[#333333] bg-slate-50/50 dark:bg-[#0a0a0a]/50">
              <button 
                onClick={handleExportCSV}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white dark:bg-[#111111] text-slate-700 dark:text-white font-bold rounded-xl border border-slate-200 dark:border-[#333333] hover:bg-slate-100 dark:hover:bg-[#1a1a1a] transition-all shadow-sm"
              >
                <Download className="w-4 h-4" />
                Export All Logs as CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogPage;
