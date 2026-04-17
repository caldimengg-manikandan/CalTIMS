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

// Dynamically determine basename based on current path to support subpath deployment
const getBasename = () => {
    const path = window.location.pathname;
    if (path.startsWith('/caltims')) return '/caltims';
    return import.meta.env.VITE_ROUTER_BASENAME || "";
};

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter basename={getBasename()}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>

        </BrowserRouter>
    </React.StrictMode>
)
