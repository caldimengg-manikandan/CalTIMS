import React, { useState, useEffect } from 'react';
import { 
  Check, Sparkles, Loader2, ArrowRight, Mail
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import Modal from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';
import supportService from '@/services/support/supportService';

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

  useEffect(() => {
    if (isOpen && plan) {
      setSubmitted(false);
      setFormData(prev => ({
        ...prev,
        message: `I'm interested in upgrading to the ${plan.name} plan (₹${plan.price} / user / month). Please contact me with more details.`
      }));
    }
  }, [isOpen, plan]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await supportService.submitTicket({
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
              <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-indigo-100">
                <Sparkles className="text-indigo-600" size={24} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Upgrade to {plan?.name}</h2>
              <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto uppercase tracking-tighter">
                Contact our accounts team to finalize your professional plan transition
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</label>
                  <input
                    required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Organization</label>
                  <input
                    required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
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
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="name@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Additional Notes</label>
                <textarea
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                  placeholder="Any specific requirements?"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                />
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-16 btn-primary text-white rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/20 hover:bg-primary-700 transition-all flex items-center justify-center gap-3 disabled:grayscale"
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
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl">
              <Check className="text-emerald-500" size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Request Received!</h3>
              <p className="text-sm text-slate-500 font-medium max-w-[280px] mx-auto leading-relaxed italic">
                Our team will contact you shortly to finalize your upgrade to the <span className="text-indigo-600 font-bold">{plan?.name}</span> plan.
              </p>
            </div>
            <div className="pt-6">
              <button
                onClick={onClose}
                className="px-12 py-4 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-2xl"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UpgradeContactModal;
