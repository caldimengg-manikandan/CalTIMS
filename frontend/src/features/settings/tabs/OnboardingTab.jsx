import React from 'react';
import { HelpCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'react-hot-toast';

export default function OnboardingTab() {
    const { hasCompletedTour, setHasCompletedTour } = useAuthStore();

    const handleRestartTour = () => {
        setHasCompletedTour(false);
        toast.success('Onboarding tour has been reset! Navigate to your Dashboard to see it.');
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/20 text-primary-500 flex items-center justify-center">
                    <HelpCircle size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">Onboarding & Help</h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">Manage your product tour and learning resources.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Product Tour</h3>
                        {hasCompletedTour ? (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                <CheckCircle2 size={12} /> Completed
                            </span>
                        ) : (
                            <span className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                In Progress
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        The onboarding tour guides you through the key features of CalTIMS. If you missed anything or want to refresh your memory, you can restart it anytime.
                    </p>
                    <button
                        onClick={handleRestartTour}
                        className="w-full py-4 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:text-primary-500 transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        <RefreshCw size={14} /> Restart Onboarding Tour
                    </button>
                </div>

                <div className="p-6 rounded-[2rem] bg-primary-600 text-white space-y-4 shadow-xl shadow-primary-500/20">
                    <h3 className="text-lg font-bold">Need more help?</h3>
                    <p className="text-sm text-primary-100 font-medium leading-relaxed">
                        Our support team is always here to help you get the most out of your timesheet and payroll system.
                    </p>
                    <button
                        onClick={() => window.location.href = 'mailto:support@caldim.com'}
                        className="w-full py-4 rounded-2xl bg-white text-primary-600 text-xs font-black uppercase tracking-widest hover:bg-primary-50 transition-all shadow-lg"
                    >
                        Contact Support
                    </button>
                </div>
            </div>
        </div>
    );
}
