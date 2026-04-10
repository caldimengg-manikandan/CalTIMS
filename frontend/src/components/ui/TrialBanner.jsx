import React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';

const TrialBanner = () => {
  const { isTrial, subscription } = useAuthStore();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = React.useState(true);

  // Correctly call the isTrial() getter function from authStore
  if (!isTrial() || !subscription || subscription.status === 'EXPIRED' || !isVisible) {
    return null;
  }

  const trialEndDate = subscription.trialEndDate ? new Date(subscription.trialEndDate) : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffTime = trialEndDate - now;
  const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  if (diffDays < 0) return null;

  return (
    <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-primary-700 text-white relative overflow-hidden group">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-32 h-32 bg-primary-400/20 rounded-full blur-3xl -translate-y-1/2 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            
            <p className="text-sm font-medium tracking-wide">
              Your free trial expires in <span className="font-bold text-amber-200">{diffDays} days</span>. 
              <span className="hidden md:inline ml-1 text-white/80">Enjoy all access to premium features including Payroll and AI.</span>
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/settings?tab=subscription')}
              className="px-4 py-1.5 bg-white text-primary-600 rounded-full text-xs font-black uppercase tracking-widest hover:bg-primary-50 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              Upgrade Now
              <ArrowRight size={14} />
            </button>

            <button 
              onClick={() => setIsVisible(false)}
              className="p-1 text-white/60 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;
