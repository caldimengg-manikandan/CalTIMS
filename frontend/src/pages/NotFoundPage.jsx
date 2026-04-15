import React from 'react'
import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'

//loga

export default function NotFoundPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-surface-50 dark:bg-black">
            <div className="text-8xl font-black text-gradient mb-4">404</div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Page not found</h1>
            <p className="text-slate-500 mb-8">The page you're looking for doesn't exist or was moved.</p>
            <Link to="/dashboard" className="btn-primary btn-lg">
                <Home size={18} /> Back to Dashboard
            </Link>
        </div>
    )
}
