import React from 'react';
import { ChevronRight, ChevronLeft, X } from 'lucide-react';

export default function TourTooltip({
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    isLastStep,
    size,
    tooltipProps,
}) {
    return (
        <div
            {...tooltipProps}
            className="tour-tooltip bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-100 dark:border-slate-800 max-w-sm"
            style={{ 
                minWidth: index === 0 ? '380px' : '300px',
                animation: 'tour-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
        >
            <style>{`
                @keyframes tour-slide-in {
                    0% { opacity: 0; transform: translateY(10px) scale(0.95); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-500">
                        Step {index + 1} of {size}
                    </span>
                    <h1 className="text-xl font-black text-slate-800 dark:text-white leading-tight">
                        {step.title}
                    </h1>
                </div>
                <button
                    {...closeProps}
                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                {step.content}
            </p>

            <div className="flex items-center justify-between pt-2">
                <button
                    {...skipProps}
                    className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                    Skip
                </button>

                <div className="flex items-center gap-2">
                    {index > 0 && (
                        <button
                            {...backProps}
                            className="p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 hover:text-primary-500 hover:border-primary-100 transition-all flex items-center justify-center group"
                        >
                            <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
                        </button>
                    )}
                    <button
                        {...primaryProps}
                        className="px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-primary-500/20 hover:shadow-lg hover:shadow-primary-500/40 hover:-translate-y-0.5 flex items-center gap-2"
                    >
                        {isLastStep ? 'Get Started' : 'Next'}
                        {!isLastStep && <ChevronRight size={14} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
