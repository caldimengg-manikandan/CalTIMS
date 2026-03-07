import { create } from 'zustand'
import { systemAPI } from '../services/endpoints'

export const useSystemStore = create((set) => ({
    appVersion: 'basic', // Default to basic
    isLoading: true,
    error: null,

    fetchVersion: async () => {
        set({ isLoading: true, error: null })
        try {
            // Force basic mode regardless of backend response
            set({ appVersion: 'basic', isLoading: false })
        } catch (error) {
            set({ appVersion: 'basic', isLoading: false })
        }
    }
}))
