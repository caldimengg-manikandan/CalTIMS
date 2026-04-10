import React, { useState, useEffect } from 'react';
import { 
  Check, Sparkles, Loader2, ArrowRight, Mail, Zap, Crown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import Modal from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';
import supportService from '@/services/support/supportService';
import { useQuery } from '@tanstack/react-query';
import { settingsAPI } from '@/services/endpoints';
import { getCurrencySymbol } from '@/utils/formatters';

const UpgradeContactModal = ({ isOpen, onClose, plan }) => {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    company: user?.organizationName || '',
    email: user?.email || '',
    message: ''
  });

  const { data: settings } = useQuery({
     queryKey: ['settings'],
     queryFn: () => settingsAPI.getSettings().then(res => res.data.data)
  });
  const currencySymbol = settings?.organization?.currency ? getCurrencySymbol(settings.organization.currency) : (settings?.payroll?.currencySymbol || '₹');

  useEffect(() => {
    if (isOpen && plan) {
      const displayPrice = plan.price || (plan.name === 'PRO' ? 49 : 29);
      setSubmitted(false);
      setFormData(prev => ({
        ...prev,
        name: user?.name || prev.name,
        email: user?.email || prev.email,
        company: user?.organizationName || user?.organization?.name || prev.company,
        message: `I'm interested in upgrading to the ${plan.name} plan (${currencySymbol}${displayPrice} / user / month). Please contact me with more details.`
      }));
    }
  }, [isOpen, plan, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await supportService.submitTicket({
        organizationId: user?.organizationId,
        name: formData.name,
        email: formData.email,
        issueType: 'General Support',
        message: `PLAN UPGRADE REQUEST: ${plan?.name}\nOrganization: ${formData.company}\n\nUser Message: ${formData.message}`
      });
      setSubmitted(true);
      toast.success('Upgrade request sent successfully!');
    } catch (err) {
      toast.error('Failed to send request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={false} maxWidth="max-w-xl">
      <div className="p-1">
        {!submitted ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-primary-100">
                <Sparkles className="text-primary-600" size={24} />
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Upgrade to {plan?.name}</h2>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.25em] max-w-sm mx-auto">
                Step into enterprise-grade productivity
              </p>
            </div>

            {/* Plan Summary Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                  {plan?.name === 'PRO' ? <Crown className="text-primary-600" size={20} /> : <Zap className="text-slate-600" size={20} />}
                </div>
                <div>
                   <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{plan?.name} Plan</p>
                   <p className="text-[10px] text-slate-500 font-medium">Professional Workforce Suite</p>
                </div>
              </div>
              <div className="text-right">
                 <p className="text-sm font-black text-slate-900">{currencySymbol}{plan?.price || 0}</p>
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">per user / month</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                  <input
                    required
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Organization</label>
                  <input
                    required
                    className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                    placeholder="Company Name"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Work Email</label>
                <input
                  required
                  type="email"
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Additional Notes</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-600/20 focus:border-primary-600 transition-all resize-none"
                  placeholder="Any specific requirements?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-16 bg-slate-900 text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-black transition-all flex items-center justify-center gap-3 disabled:grayscale disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <>Send Upgrade Request <ArrowRight size={18} /></>}
                </button>
                <a
                  href={`mailto:support@caltims.com?subject=Upgrade to ${plan?.name}&body=Hello CALTIMS Team, I would like to upgrade my plan to ${plan?.name}.`}
                  className="w-full h-14 bg-white border-2 border-slate-100 text-slate-600 rounded-[2rem] font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                >
                  <Mail size={16} /> Direct Email Support
                </a>
              </div>
            </form>
          </div>
        ) : (
          <div className="py-12 text-center space-y-6 animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl relative">
              <Check className="text-emerald-500" size={48} />
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1, repeat: Infinity }}
                className="absolute inset-0 bg-emerald-100 rounded-full -z-10"
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Request Received!</h3>
              <p className="text-sm text-slate-500 font-medium max-w-[320px] mx-auto leading-relaxed">
                Our team will contact you shortly to finalize your upgrade to the <span className="text-primary-600 font-black">{plan?.name}</span> plan.
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={onClose}
                className="px-12 py-4 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UpgradeContactModal;
