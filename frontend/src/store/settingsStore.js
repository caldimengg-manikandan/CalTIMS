import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { settingsAPI } from '@/services/endpoints'

export const useSettingsStore = create(
    persist(
        (set, get) => ({
            general: null,
            isLoading: false,

            fetchGeneralSettings: async () => {
                set({ isLoading: true })
                try {
                    const res = await settingsAPI.getGeneralSettings()
                    set({ general: res.data.data, isLoading: false })
                } catch (err) {
                    set({ isLoading: false })
                    console.error('Failed to fetch general settings:', err)
                }
            },

            updateGeneralSettings: (newSettings) => {
                set({ general: { ...get().general, ...newSettings } })
            }
        }),
        {
            name: 'settings-storage',
            getStorage: () => localStorage,
        }
    )
)
