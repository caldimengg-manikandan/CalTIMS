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
  const [filters, setFilters] = useState({
    action: '',
    status: '',
    search: ''
  });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      // search is filtered client-side for speed

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
  }, [fetchLogs]);

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
      log.action?.toLowerCase().includes(q) ||
      log.performedBy?.name?.toLowerCase().includes(q) ||
      log.entity?.toLowerCase().includes(q) ||
      log.role?.toLowerCase().includes(q)
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-slate-50/30 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-indigo-200 shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            Audit Logs
          </h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2 text-sm">
            <Clock className="w-3.5 h-3.5" />
            Real-time system activity monitoring — {total} total events
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by action, user, entity..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-sm"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <select 
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium"
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
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
          className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-medium"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
          <option value="WARNING">Warning</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4">Entity</th>
              <th className="px-6 py-4">Time</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="7" className="px-6 py-4">
                    <div className="h-4 bg-slate-100 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-10 py-20 text-center">
                  <Shield className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">No audit logs found</p>
                  <p className="text-slate-300 text-xs mt-1">Actions you perform will appear here</p>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr 
                  key={log._id} 
                  className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getActionColor(log.action)}`}>
                      <FileText className="w-3 h-3" />
                      {(log.action || '').replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(log.performedBy?.name || 'S')[0].toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-700 font-medium">
                        {log.performedBy?.name || 'System'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded uppercase">
                      {log.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 
                        log.status === 'FAILED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500 font-medium capitalize">{log.entity}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500 font-medium">
                      {log.createdAt ? format(new Date(log.createdAt), 'MMM d, h:mm a') : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                       <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer */}
      {selectedLog && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[60] transition-all"
            onClick={() => setSelectedLog(null)}
          />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-[70] shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <Shield className="w-5 h-5 text-indigo-600" />
                Audit Detail
              </h2>
              <button 
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
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
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Performed By</p>
                    <p className="text-sm font-bold text-slate-800">{selectedLog.performedBy?.name || 'System'}</p>
                    <p className="text-[10px] text-indigo-600 font-semibold mt-1">{selectedLog.role}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">IP Address</p>
                    <p className="text-sm font-bold text-slate-800 font-mono">{selectedLog.ipAddress || '—'}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      Logged
                    </p>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Action Payload</h4>
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="bg-slate-900 px-4 py-2 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">JSON</span>
                    </div>
                    <pre className="p-4 bg-slate-950 text-emerald-400 text-xs font-mono overflow-auto max-h-[250px] leading-relaxed">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={handleExportCSV}
                className="w-full flex items-center justify-center gap-2 py-3 bg-white text-slate-700 font-bold rounded-xl border border-slate-200 hover:bg-slate-100 transition-all shadow-sm"
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
