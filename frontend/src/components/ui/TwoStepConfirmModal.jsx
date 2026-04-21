import React from 'react';
import Modal from './Modal';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';

const TwoStepConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure you want to delete this?",
  message,
  confirmText = 'Yes, Delete',
  isLoading = false,
  danger = true
}) => {
  const [step, setStep] = React.useState(1);

  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isLoading) return;
    setStep(1);
    onClose();
  };

  const handleNextStep = () => {
    setStep(2);
  };

  if (step === 1) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Confirm Action" maxWidth="max-w-md">
        <div className="flex flex-col items-center text-center p-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-amber-50 text-amber-500 dark:bg-amber-500/10">
            <AlertTriangle size={32} />
          </div>
          
          <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
            {title}
          </h3>
          
          <div className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed font-medium">
            {message}
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full">
            <button
              onClick={handleClose}
              className="py-4 px-6 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={handleNextStep}
              className="py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 hover:scale-105 bg-primary text-white shadow-primary-500/20"
            >
              Continue
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Final Confirmation" maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center p-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
          isLoading ? 'scale-90 opacity-50' : ''
        } bg-rose-50 text-rose-500 dark:bg-rose-500/10`}>
          <ShieldAlert size={32} className={isLoading ? 'animate-pulse' : ''} />
        </div>
        
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
          Wait, This is Permanent!
        </h3>
        
        <div className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed font-bold">
          This action is permanent and cannot be undone. Do you really want to delete this?
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="py-4 px-6 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            No, Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed bg-rose-500 text-white shadow-rose-500/20"
          >
            {isLoading ? (
               <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deleting...</span>
               </div>
            ) : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TwoStepConfirmModal;
