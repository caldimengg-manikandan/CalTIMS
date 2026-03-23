import React from 'react';
import { Lock, Crown, Zap, LogOut, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';

const Paywall = () => {
  const { logout, subscription } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="grid grid-cols-1 md:grid-cols-5 h-full">
          {/* Left Decorative Side */}
          <div className="md:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 p-8 flex flex-col justify-between text-white relative h-full min-h-[300px]">
            <div className="absolute top-0 left-0 p-12 opacity-10 transform -translate-x-8 -translate-y-8">
              <Lock size={160} />
            </div>
            
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
                <Crown size={24} className="text-white" />
              </div>
              <h2 className="text-3xl font-black leading-tight mb-2">Access Locked</h2>
              <p className="text-indigo-100/80 text-sm font-medium">Your 28-day trial of CALTIMS has come to an end.</p>
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-indigo-200">
                <Zap size={14} />
                <span>Basic Plan Includes</span>
              </div>
              <ul className="space-y-3 text-sm font-medium">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  Unlimited Timesheets
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  Detailed Reports
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full" />
                  Team Management
                </li>
              </ul>
            </div>
          </div>

          {/* Right Action Side */}
          <div className="md:col-span-3 p-10 flex flex-col justify-center bg-white dark:bg-slate-900">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Time to Upgrade</h3>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              Don't lose momentum. Upgrade your organization today to regain access to your timesheets, reports, and team data.
            </p>

            <div className="space-y-4">
              <button 
                onClick={() => window.location.href = '/settings?tab=subscription'}
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                Choose a Plan
                <Crown size={18} />
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={handleLogout}
                  className="h-12 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
                <button className="h-12 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2">
                  <MessageCircle size={16} />
                  Support
                </button>
              </div>
            </div>

            <p className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              CALTIMS Enterprise Solutions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paywall;
