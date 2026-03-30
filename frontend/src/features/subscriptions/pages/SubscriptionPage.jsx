import React, { useState } from 'react';
import { 
  Check, Crown, Zap, ShieldCheck, 
  ArrowRight, Sparkles, Building2, 
  Mail, Info
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { motion } from 'framer-motion';
import UpgradeContactModal from '../components/UpgradeContactModal';

const SubscriptionPage = () => {
  const { subscription } = useAuthStore();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const currentPlan = subscription?.planType || 'TRIAL';

  const handlePlanAction = (plan) => {
    if (plan.name === currentPlan) return;
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const plans = [
    {
      name: 'TRIAL',
      price: '0',
      description: 'Ideal for small teams trying CALTIMS.',
      features: [
        { name: 'Timesheet Entry', included: true },
        { name: 'Weekly Timesheet Submission', included: true },
        { name: 'Project-based Logging', included: true },
        { name: 'Dashboard Overview', included: true },
        { name: 'Holiday Calendar', included: true },
        { name: 'Timesheet History', included: false },
        { name: 'Advanced Reports', included: false },
        { name: 'Payroll Automation', included: false },
        { name: 'Leave Management', included: false },
      ],
      color: 'slate',
      icon: Zap,
    },
    {
      name: 'BASIC',
      price: '29',
      description: 'Enhanced features for growing businesses.',
      period: '/ user / month',
      features: [
        { name: 'Everything in Trial', included: true },
        { name: 'Unlimited Projects', included: true },
        { name: 'Timesheet History', included: true },
        { name: 'Weekly Reports', included: true },
        { name: 'Holiday Management', included: true },
        { name: 'Advanced Dashboard', included: true },
        { name: 'Payroll Automation', included: false },
        { name: 'Leave Management', included: false },
        { name: 'Role Based Access', included: false },
      ],
      color: 'primary',
      icon: ShieldCheck,
      recommended: true
    },
    {
      name: 'PRO',
      price: '49',
      description: 'The ultimate workforce management suite.',
      period: '/ user / month',
      features: [
        { name: 'Everything in Basic', included: true },
        { name: 'Full Payroll Automation', included: true },
        { name: 'Leave Management', included: true },
        { name: 'Advanced Analytics', included: true },
        { name: 'Custom Reports', included: true },
        { name: 'Audit Logs', included: true },
        { name: 'Single Sign On (SSO)', included: true },
        { name: 'Priority 24/7 Support', included: true },
        { name: 'Dedicated Manager', included: true },
      ],
      color: 'rose',
      icon: Crown,
      popular: true
    }
  ];

  return (
    <div className="space-y-16 pb-24 bg-slate-50/30">
      {/* Hero Section */}
      <div className="text-center space-y-6 pt-16 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[800px] h-[400px] bg-gradient-to-b from-primary-50/50 to-transparent blur-3xl opacity-60 rounded-full" />
        
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/80 backdrop-blur-md rounded-full border border-slate-200/60 shadow-sm mb-4"
        >
          <Sparkles className="text-amber-500" size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Transparent SaaS Pricing</span>
        </motion.div>

        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
          Choose the right plan <br /> 
          <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent italic">for your organization.</span>
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto text-lg font-medium leading-relaxed opacity-80">
          Scale your productivity with automated timesheets and payroll. <br />
          Start your 28-day free trial today.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-[1240px] mx-auto px-6">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.6 }}
            className={`
              relative bg-white rounded-[2.5rem] flex flex-col transition-all duration-300 border-2
              ${plan.popular ? 'border-primary-600 shadow-[0_32px_64px_-16px_rgba(var(--color-primary-rgb),0.15)] scale-105 z-10' : 'border-slate-100 hover:border-slate-200'}
            `}
          >
            {plan.popular && (
              <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-primary-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary-200">
                ⭐ Most Popular
              </div>
            )}

            {plan.recommended && !plan.popular && (
              <div className="absolute top-0 left-8 transform -translate-y-1/2 bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                Recommended
              </div>
            )}

            <div className="p-10 flex flex-col h-full space-y-8">
              <div className="flex items-start justify-between">
                <div className={`w-14 h-14 bg-${plan.color}-50 rounded-2xl flex items-center justify-center border border-${plan.color}-100/50`}>
                  <plan.icon size={28} className={`text-${plan.name === 'PRO' ? 'rose-500' : plan.color === 'primary' ? 'primary-600' : 'slate-600'}`} />
                </div>
                {currentPlan === plan.name && (
                   <span className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase tracking-wider bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100/50">
                     <Check size={12} strokeWidth={3} /> Active
                   </span>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-wider">{plan.name}</h3>
                  <p className="text-slate-400 text-sm font-medium mt-1 leading-relaxed">
                    {plan.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-black text-slate-900">₹{plan.price}</span>
                  <div className="flex flex-col">
                    <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest leading-none">
                      {plan.period ? 'per user' : 'Free Trial'}
                    </span>
                    {plan.period && <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">per month</span>}
                    {!plan.period && <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">28 Days</span>}
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 flex-shrink-0" />

              <div className="flex-1 overflow-visible">
                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className={`flex items-start gap-3 transition-opacity duration-300 ${!feature.included ? 'opacity-25' : 'opacity-100'}`}>
                      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${feature.included ? 'bg-primary-50 text-primary-600' : 'bg-slate-50 text-slate-300'}`}>
                        {feature.included ? <Check size={12} strokeWidth={3} /> : <div className="w-1 h-1 rounded-full bg-slate-300" />}
                      </div>
                      <span className={`text-[13px] font-bold uppercase tracking-tight ${feature.included ? 'text-slate-700' : 'text-slate-400 italic font-medium'}`}>
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 flex-shrink-0">
                <button
                  onClick={() => handlePlanAction(plan)}
                  disabled={currentPlan === plan.name}
                  className={`
                    w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.98]
                    ${currentPlan === plan.name 
                      ? 'bg-slate-50 text-slate-400 cursor-not-allowed border-2 border-slate-100' 
                      : plan.popular 
                        ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-xl shadow-primary-200' 
                        : 'bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white'}
                  `}
                >
                   {currentPlan === plan.name ? 'Your Current Plan' : plan.name === 'TRIAL' ? 'Get Started Free' : `Upgrade to ${plan.name}`}
                   {currentPlan !== plan.name && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
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
