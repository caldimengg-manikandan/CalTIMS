import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'
import { useThemeStore } from './store/themeStore.js'

// Apply persisted theme before first render
useThemeStore.getState().applyTheme()

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000,   // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            onError: (err) => console.error('Mutation error:', err),
        },
    },
})

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <App />
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: '#1e293b',
                            color: '#f1f5f9',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontFamily: 'Inter, sans-serif',
                        },
                        success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
                        error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
                    }}
                />

            </QueryClientProvider>
        </BrowserRouter>
    </React.StrictMode>
)
