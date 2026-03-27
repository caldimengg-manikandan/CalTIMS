import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Building2, 
  Crown, 
  Zap, 
  ShieldCheck, 
  Activity,
  RefreshCw
} from 'lucide-react';
import api from '@/services/api';
import MetricCard from '../components/MetricCard';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({
    total_users: 0,
    total_organizations: 0,
    trial_users: 0,
    basic_users: 0,
    pro_users: 0,
    active_users_today: 0,
  });
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const { data } = await api.get('/admin/dashboard-metrics');
      setMetrics(data.data);
    } catch (err) {
      console.error('Failed to fetch admin metrics:', err);
    } finally {
      if (!isManual) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const { data } = await api.get('/admin/organizations');
      setOrganizations(data.data);
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchMetrics(true), fetchOrganizations()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchMetrics(), fetchOrganizations()]);
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time platform metrics and subscription health.</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard title="Total Users" value={metrics.total_users} icon={Users} color="blue" />
        <MetricCard title="Organizations" value={metrics.total_organizations} icon={Building2} color="indigo" />
        <MetricCard title="Active Today" value={metrics.active_users_today} icon={Activity} color="green" />
        <MetricCard title="Trial Plans" value={metrics.trial_users} icon={Zap} color="orange" />
        <MetricCard title="Basic Plans" value={metrics.basic_users} icon={ShieldCheck} color="purple" />
        <MetricCard title="Pro Plans" value={metrics.pro_users} icon={Crown} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 transform translate-x-4 -translate-y-4 opacity-10 rotate-12 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500">
            <Activity size={120} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-6">Subscription Mix</h2>
          <div className="space-y-6">
            <PlanProgress label="Free Trial" count={metrics.trial_users} total={metrics.total_organizations} color="bg-orange-400" />
            <PlanProgress label="Basic Plan" count={metrics.basic_users} total={metrics.total_organizations} color="bg-purple-500" />
            <PlanProgress label="Pro Plus" count={metrics.pro_users} total={metrics.total_organizations} color="bg-rose-500" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl text-white relative overflow-hidden group shadow-xl shadow-indigo-100">
          <div className="absolute top-0 right-0 p-12 opacity-20 transform translate-x-8 -translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-700">
            <Building2 size={160} />
          </div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Platform Health</h2>
            <p className="text-indigo-100 mb-8 max-w-xs">All systems are operational. Backup sync completed 12 minutes ago.</p>
            <div className="flex gap-4">
              <button className="px-6 py-2.5 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors shadow-lg shadow-black/5">
                View Logs
              </button>
              <button className="px-6 py-2.5 bg-indigo-500/30 backdrop-blur-md border border-white/20 rounded-xl text-sm font-bold hover:bg-indigo-500/40 transition-colors">
                Server Status
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Organizations Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Registered Organizations</h2>
          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-wider">
            {organizations.length} Total
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Organization</th>
                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Plan</th>
                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Trial Ends</th>
                <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {organizations.map((org) => (
                <tr key={org._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-500 uppercase tracking-tighter shadow-sm border border-slate-100">
                        {org.name.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{org.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{org._id.substring(0, 8)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <PlanBadge plan={org.subscription?.planType || 'NONE'} />
                  </td>
                  <td className="px-8 py-5">
                    <StatusBadge status={org.subscription?.status || 'UNKNOWN'} />
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-600">
                    {org.subscription?.planType === 'TRIAL' 
                      ? new Date(org.subscription.trialEndDate).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-8 py-5 text-sm font-medium text-slate-600">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {organizations.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-8 py-12 text-center text-slate-400 italic font-medium">
                    No organizations found on this platform.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PlanProgress = ({ label, count, total, color }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{count} orgs ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const PlanBadge = ({ plan }) => {
  const styles = {
    TRIAL: 'bg-orange-50 text-orange-600 border-orange-100',
    BASIC: 'bg-purple-50 text-purple-600 border-purple-100',
    PRO: 'bg-rose-50 text-rose-600 border-rose-100',
    NONE: 'bg-slate-50 text-slate-400 border-slate-100'
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${styles[plan] || styles.NONE}`}>
      {plan}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const styles = {
    ACTIVE: 'bg-green-50 text-green-600',
    EXPIRED: 'bg-red-50 text-red-600',
    CANCELLED: 'bg-slate-50 text-slate-600'
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${status === 'ACTIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
      <span className={`text-[11px] font-bold uppercase tracking-tight ${styles[status] || styles.ACTIVE}`}>
        {status}
      </span>
    </div>
  );
};

export default AdminDashboard;
