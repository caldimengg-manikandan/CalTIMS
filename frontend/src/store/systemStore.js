import { create } from 'zustand'
import { systemAPI } from '../services/endpoints'

export const useSystemStore = create((set) => ({
    appVersion: 'basic', // Default to basic
    isLoading: true,
    error: null,

    fetchVersion: async () => {
        set({ isLoading: true, error: null })
        try {
            const res = await systemAPI.getVersion()
            set({ appVersion: res.data?.data?.version || 'basic', isLoading: false })
        } catch (error) {
            set({ error: error.response?.data?.message || 'Failed to fetch application version', isLoading: false })
        }
    },

    toggleVersion: async (version) => {
        set({ isLoading: true, error: null })
        try {
            const res = await systemAPI.updateVersion(version)
            set({ appVersion: res.data?.data?.version || 'basic', isLoading: false })
        } catch (error) {
            set({ error: error.response?.data?.message || 'Failed to update application version', isLoading: false })
            throw error
        }
    }
}))
