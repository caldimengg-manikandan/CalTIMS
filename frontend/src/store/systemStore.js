import { create } from 'zustand'
import { systemAPI } from '../services/endpoints'

export const useSystemStore = create((set) => ({
    appVersion: 'basic', // Default to basic
    isLoading: true,
    error: null,

    fetchVersion: async () => {
        set({ isLoading: true, error: null })
        try {
            const { data } = await systemAPI.getVersion()
            set({ appVersion: data.data.version || 'basic', isLoading: false })
        } catch (error) {
            set({ appVersion: 'basic', isLoading: false })
        }
    },

    updateVersion: async (version) => {
        try {
            await systemAPI.updateVersion(version)
            set({ appVersion: version })
            return true
        } catch (error) {
            console.error('Failed to update version:', error)
            return false
        }
    }
}))
