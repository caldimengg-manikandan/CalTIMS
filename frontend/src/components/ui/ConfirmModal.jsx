import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Delete', 
  type = 'danger',
  danger = false,
  isLoading = false 
}) => {
  const finalType = danger ? 'danger' : type;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center p-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
          isLoading ? 'scale-90 opacity-50' : ''
        } ${
          finalType === 'danger' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-primary-50 text-primary-500 dark:bg-primary-500/10'
        }`}>
          <AlertTriangle size={32} className={isLoading ? 'animate-pulse' : ''} />
        </div>
        
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
          {title}
        </h3>
        
        <div className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed font-medium">
          {message}
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="py-4 px-6 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
              finalType === 'danger' 
                ? 'bg-rose-500 text-white shadow-rose-500/20' 
                : 'bg-primary text-white shadow-primary-500/20'
            }`}
          >
            {isLoading ? (
               <div className="flex items-center justify-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processing...</span>
               </div>
            ) : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
