import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
        <BrowserRouter basename={import.meta.env.VITE_ROUTER_BASENAME || ""}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>

        </BrowserRouter>
    </React.StrictMode>
)
