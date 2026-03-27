import React from 'react';
import { Zap, Clock, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Link } from 'react-router-dom';

const TrialBanner = () => {
  const { subscription, isTrial, user } = useAuthStore();

  if (!isTrial() || !subscription || subscription.status !== 'ACTIVE' || user?.role === 'super_admin') {
    return null;
  }

  const trialEndDate = new Date(subscription.trialEndDate);
  const now = new Date();
  const diffTime = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, diffTime);

  // Don't show if more than 28 days (shouldn't happen but for safety)
  if (daysRemaining > 28) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto] animate-gradient-x text-white py-2 px-4 shadow-lg flex items-center justify-center gap-6 text-sm font-medium transition-all">
      <div className="flex items-center gap-2">
        <div className="bg-white/20 p-1 rounded-md">
          <Zap size={14} className="fill-white" />
        </div>
        <span>
          Trial active: <span className="font-bold">{daysRemaining} days</span> remaining
        </span>
      </div>
      
      <div className="hidden md:flex items-center gap-1.5 opacity-80">
        <Clock size={14} />
        <span>Upgrade to Pro for unlimited employees & advanced reports</span>
      </div>

      <Link 
        to="/settings?tab=subscription" 
        className="bg-white text-indigo-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1 group shadow-sm"
      >
        Upgrade Now
        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  );
};

export default TrialBanner;
