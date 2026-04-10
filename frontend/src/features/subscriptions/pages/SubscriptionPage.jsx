import React, { useState, useEffect } from 'react';
import { 
  Check, X, Crown, Zap, ShieldCheck, 
  ArrowRight, Sparkles, Users, Calendar, 
  CreditCard, History, Info, AlertCircle,
  TrendingUp, Layers, HelpCircle, FileText,
  Clock, ShieldAlert, BadgeCheck
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import UpgradeContactModal from '../components/UpgradeContactModal';
import { useQuery } from '@tanstack/react-query';
import { settingsAPI } from '@/services/endpoints';
import { getCurrencySymbol } from '@/utils/formatters';
import '../SubscriptionStyles.css';

const SubscriptionPage = () => {
  const { user, subscription, setSubscription } = useAuthStore();
  const [history, setHistory] = useState([]);
  const [userCount, setUserCount] = useState(subscription?.userCount || 10);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentPlan = subscription?.planType || 'TRIAL';
  const isTrial = currentPlan === 'TRIAL';

  const { data: settings } = useQuery({
     queryKey: ['settings'],
     queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
  });
  const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');
  
  // Pricing Constants
  const BASIC_PRICE = 29;
  const PRO_PRICE = 49;

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const [subRes, histRes] = await Promise.all([
        fetch('/api/v1/subscriptions/current').then(res => res.json()),
        fetch('/api/v1/subscriptions/history').then(res => res.json())
      ]);

      if (subRes.success) {
        setSubscription(subRes.data);
        setUserCount(subRes.data.userCount || 10);
      }
      if (histRes.success) {
        setHistory(histRes.data);
      }
    } catch (err) {
      console.error('Error fetching subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanAction = (plan) => {
    if (plan.name === currentPlan) return;
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const COMPARISON_FEATURES = [
    { name: 'Employee Management', basic: true, pro: true },
    { name: 'Timesheet Entry & Tasks', basic: true, pro: true },
    { name: 'Payroll Processing', basic: false, pro: true },
    { name: 'Leave Management', basic: false, pro: true },
    { name: 'Reports & Analytics', basic: false, pro: true },
    { name: 'Audit Logs & Security', basic: false, pro: true },
    { name: 'Compliance Controls', basic: false, pro: true },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-8 h-8 border-2 border-slate-200 dark:border-white/10 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-24">
      <div className="subscription-container px-6 pt-16 space-y-20">
        
        {/* 1. Header & Current Plan */}
        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Subscription & Billing</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium">Manage your organization's plan, billing cycle, and history.</p>
          </div>

          <div className="plan-card">
            <h2 className="section-title">Current Plan</h2>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isTrial ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-slate-900 dark:bg-white text-white dark:text-black'}`}>
                    {currentPlan === 'PRO' ? <Crown size={24} /> : <Zap size={24} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">
                      {isTrial ? 'Free Trial' : `${currentPlan} Plan`}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`status-badge ${subscription?.status === 'ACTIVE' ? 'status-active' : 'status-expired'}`}>
                        {subscription?.status || 'Active'}
                      </span>
                      {isTrial && <span className="status-badge status-trial">Trial Phase</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handlePlanAction({ name: 'PRO', price: PRO_PRICE })}
                    disabled={currentPlan === 'PRO'}
                    className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black dark:hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    Upgrade Plan
                  </button>
                  <button className="px-6 py-3 bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#333333] text-slate-400 dark:text-gray-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-rose-500 hover:border-rose-200 transition-all">
                    Cancel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-t border-slate-50 dark:border-white/5">
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest">Active Users</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-300">{subscription?.userCount || 0} Members</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest">Monthly Cost</span>
                  <p className="text-sm font-black text-slate-900 dark:text-white">{currencySymbol}{subscription?.totalMonthlyCost || 0}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest">Started Date</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-300">{formatDate(subscription?.trialStartDate || subscription?.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 dark:text-gray-500 text-[9px] font-black uppercase tracking-widest">{isTrial ? 'Expires On' : 'Next Renewal'}</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-gray-300">{formatDate(subscription?.trialEndDate || subscription?.expiryDate)}</p>
                </div>
              </div>
              
              {isTrial && (
                <div className="p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-xl border border-slate-100 dark:border-[#333333] flex items-center gap-3">
                  <Info size={16} className="text-slate-400" />
                  <p className="text-xs text-slate-500 font-medium italic">
                    Your estimated cost after trial: <span className="font-black text-slate-900 dark:text-white">{currencySymbol}{userCount * PRO_PRICE} / month</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Plan Selection */}
        <div className="space-y-8">
          <div>
            <h2 className="section-title">Change Plan</h2>
            <div className="flex items-center justify-between mb-6 p-4 bg-slate-50 dark:bg-[#0a0a0a] rounded-2xl border border-slate-100 dark:border-[#333333]">
               <div className="flex items-center gap-3">
                 <Users size={16} className="text-slate-400" />
                 <span className="text-xs font-bold text-slate-700 dark:text-gray-300">Calculate for your team size:</span>
               </div>
               <div className="flex items-center gap-4 flex-1 max-w-xs mx-8">
                 <input 
                   type="range" min="1" max="500" value={userCount}
                   onChange={(e) => setUserCount(parseInt(e.target.value))}
                 />
               </div>
               <span className="text-sm font-black text-slate-900 dark:text-white">{userCount} Users</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className={`plan-card ${currentPlan === 'BASIC' ? 'active' : ''}`}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Basic</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{currencySymbol}{BASIC_PRICE}</span>
                    <span className="text-slate-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">/ user</span>
                  </div>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-400"><Check size={14} className="text-emerald-500" /> Essential Time Tracking</li>
                <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-400"><Check size={14} className="text-emerald-500" /> Team Management</li>
                <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-400"><Check size={14} className="text-emerald-500" /> Basic Reporting</li>
              </ul>
              <button 
                onClick={() => handlePlanAction({ name: 'BASIC', price: BASIC_PRICE })}
                className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                  currentPlan === 'BASIC' ? 'bg-slate-50 dark:bg-[#1a1a1a] text-slate-300 dark:text-gray-600' : 'bg-white dark:bg-[#111111] border-2 border-slate-900 dark:border-white text-slate-900 dark:text-white hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-black'
                }`}
              >
                {currentPlan === 'BASIC' ? 'Current Plan' : 'Select Basic'}
              </button>
            </div>

            <div className={`plan-card relative overflow-hidden ${currentPlan === 'PRO' ? 'active' : ''}`}>
              <div className="absolute top-4 right-4 px-2 py-1 bg-slate-900 dark:bg-white text-white dark:text-black rounded text-[8px] font-black uppercase tracking-widest">Recommended</div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Pro</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">{currencySymbol}{PRO_PRICE}</span>
                    <span className="text-slate-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-widest">/ user</span>
                  </div>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-400"><Check size={14} className="text-emerald-500" /> Advanced Payroll</li>
                <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-400"><Check size={14} className="text-emerald-500" /> Compliance Controls</li>
                <li className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-gray-400"><Check size={14} className="text-emerald-500" /> Strategic Insights</li>
              </ul>
              <button 
                onClick={() => handlePlanAction({ name: 'PRO', price: PRO_PRICE })}
                className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
                  currentPlan === 'PRO' ? 'bg-slate-50 dark:bg-[#1a1a1a] text-slate-300 dark:text-gray-600' : 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-black dark:hover:bg-gray-200'
                }`}
              >
                {currentPlan === 'PRO' ? 'Current Plan' : 'Select Pro'}
              </button>
            </div>
          </div>
        </div>

        {/* 3. Feature Matrix */}
        <div className="space-y-8">
          <h2 className="section-title">Feature Comparison</h2>
          <div className="border border-slate-100 dark:border-[#333333] rounded-2xl overflow-hidden">
            <table className="comparison-table w-full border-collapse">
              <thead>
                <tr className="bg-slate-50/30 dark:bg-white/5">
                  <th>Platform Feature</th>
                  <th className="text-center">Basic</th>
                  <th className="text-center">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_FEATURES.map((f, i) => (
                  <tr key={i}>
                    <td className="dark:text-gray-300">{f.name}</td>
                    <td className="text-center">{f.basic ? <Check size={14} className="mx-auto text-emerald-500" /> : <X size={14} className="mx-auto text-slate-200 dark:text-gray-700" />}</td>
                    <td className="text-center">{f.pro ? <Check size={14} className="mx-auto text-emerald-500" /> : <X size={14} className="mx-auto text-slate-200 dark:text-gray-700" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Billing History */}
        <div className="space-y-8 mb-20">
          <h2 className="section-title">Subscription Ledger</h2>
          <div className="space-y-2">
            {history.map((record, idx) => (
              <div key={idx} className="history-item flex items-center justify-between group">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-slate-50 dark:bg-[#1a1a1a] rounded-xl flex items-center justify-center text-slate-400 dark:text-gray-500 group-hover:bg-slate-100 dark:group-hover:bg-[#222222] transition-all">
                     {record.planName.toLowerCase().includes('pro') ? <Crown size={16} /> : <Zap size={16} />}
                   </div>
                   <div>
                     <p className="text-sm font-black text-slate-800 dark:text-white">{record.planName}</p>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{formatDate(record.startDate)} - {formatDate(record.endDate)}</p>
                   </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-900 dark:text-white">{currencySymbol}{record.totalCost}</p>
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${record.status === 'ACTIVE' ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {record.status}
                  </span>
                </div>
              </div>
            ))}
            {history.length === 0 && (
              <div className="py-12 text-center bg-slate-50 dark:bg-[#0a0a0a] rounded-3xl border border-dashed border-slate-200 dark:border-[#333333]">
                <p className="text-sm text-slate-400 dark:text-gray-600 font-medium italic">No previous billing records found.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <UpgradeContactModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        plan={selectedPlan}
      />
    </div>
  );
};

export default SubscriptionPage;
