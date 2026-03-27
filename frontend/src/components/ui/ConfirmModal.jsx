import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Delete', type = 'danger' }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex flex-col items-center text-center p-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
          type === 'danger' ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-primary-50 text-primary-500 dark:bg-primary-500/10'
        }`}>
          <AlertTriangle size={32} />
        </div>
        
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
          {title}
        </h3>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed font-medium">
          {message}
        </p>
        
        <div className="grid grid-cols-2 gap-4 w-full">
          <button
            onClick={onClose}
            className="py-4 px-6 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-500 font-bold uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all active:scale-95 hover:scale-105 ${
              type === 'danger' 
                ? 'bg-rose-500 text-white shadow-rose-500/20' 
                : 'bg-primary text-white shadow-primary-500/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
