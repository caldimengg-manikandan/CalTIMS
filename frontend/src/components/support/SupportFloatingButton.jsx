import React, { useState } from 'react'
import { LifeBuoy, X } from 'lucide-react'
import SupportModal from '@/features/auth/components/SupportModal'

export default function SupportFloatingButton() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 w-14 h-14 btn-primary text-white rounded-full shadow-2xl shadow-indigo-600/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-[9999] group"
                title="Support Center"
            >
                <div className="absolute -top-12 right-0 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap shadow-xl">
                    Need Help?
                </div>
                <LifeBuoy size={24} />
            </button>

            <SupportModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    )
}
