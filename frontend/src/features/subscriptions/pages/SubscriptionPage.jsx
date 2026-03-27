import React from 'react';
import { Check, Crown, Zap, ShieldCheck, Activity, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const SubscriptionPage = () => {
  const { subscription, setAuth, user, accessToken, refreshToken } = useAuthStore();
  const [loadingPlan, setLoadingPlan] = React.useState(null);

  const currentPlan = subscription?.planType || 'TRIAL';

  const handleUpgrade = async (planType) => {
    if (planType === currentPlan) return;
    
    setLoadingPlan(planType);
    try {
      const { data } = await api.post('/subscriptions/upgrade', { planType });
      // Update local storage/state with new subscription info
      setAuth(user, accessToken, refreshToken, data.data);
      toast.success(`Successfully upgraded to ${planType} plan!`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upgrade subscription');
    } finally {
      setLoadingPlan(null);
    }
  };

  const plans = [
    {
      name: 'TRIAL',
      price: '$0',
      description: 'Perfect for exploring CALTIMS.',
      features: ['Unlimited Timesheets', 'Standard Reports', 'Up to 10 Employees'],
      color: 'slate',
      icon: Zap
    },
    {
      name: 'BASIC',
      price: '$49',
      description: 'For growing teams needing more power.',
      period: '/month',
      features: ['Everything in Trial', 'Advanced Analytics', 'Up to 50 Employees', 'Priority Support'],
      color: 'indigo',
      icon: ShieldCheck
    },
    {
      name: 'PRO',
      price: '$149',
      description: 'The complete enterprise solution.',
      period: '/month',
      features: ['Everything in Basic', 'Full Payroll Automation', 'AI Insights', 'Custom Integration', 'Unlimited Employees'],
      color: 'rose',
      icon: Crown,
      popular: true
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black text-slate-800 tracking-tight">Choose Your Plan</h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Scale your business with CALTIMS. Whether you're a small team or a large enterprise, we have a plan for you.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4">
        {plans.map((plan) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
              relative bg-white rounded-[2.5rem] p-8 border-2 transition-all duration-300
              ${plan.popular ? 'border-indigo-500 shadow-xl shadow-indigo-100' : 'border-slate-100 hover:border-slate-200'}
              ${currentPlan === plan.name ? 'ring-4 ring-indigo-500/10' : ''}
            `}
          >
            {plan.popular && (
              <div className="absolute top-0 right-12 transform -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Most Popular
              </div>
            )}

            {currentPlan === plan.name && (
              <div className="absolute top-0 left-12 transform -translate-y-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                Current Plan
              </div>
            )}

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className={`w-14 h-14 bg-${plan.color}-50 rounded-2xl flex items-center justify-center`}>
                  <plan.icon size={28} className={`text-${plan.color}-600`} />
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-black text-slate-800">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                  <span className="text-slate-400 font-bold uppercase text-xs tracking-widest">{plan.period}</span>
                </div>
                <p className="mt-4 text-sm text-slate-500 font-medium leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 bg-green-50 text-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={12} />
                    </div>
                    <span className="text-sm font-semibold text-slate-600 italic">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.name)}
                disabled={currentPlan === plan.name || (plan.name === 'TRIAL' && currentPlan !== 'TRIAL') || loadingPlan === plan.name}
                className={`
                  w-full h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3
                  ${currentPlan === plan.name 
                    ? 'bg-slate-50 text-slate-400 cursor-default border-2 border-slate-100' 
                    : plan.popular 
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100' 
                      : 'bg-slate-900 text-white hover:bg-slate-800'}
                  disabled:opacity-50
                `}
              >
                {loadingPlan === plan.name ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    {currentPlan === plan.name ? 'Active' : 'Upgrade Plan'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto bg-slate-50 rounded-[2rem] p-8 border border-slate-100 flex items-center gap-6">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
          <Activity className="text-indigo-600" size={24} />
        </div>
        <div>
          <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">Enterprise Support</h4>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Need a custom solution for your organization? <span className="text-indigo-600 font-bold cursor-pointer hover:underline">Contact our sales team</span> for a personalized plan.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
