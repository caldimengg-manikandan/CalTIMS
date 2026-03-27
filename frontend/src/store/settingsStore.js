import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { settingsAPI } from '@/services/endpoints'

export const useSettingsStore = create(
    persist(
        (set, get) => ({
            general: null,
            payroll: null,
            payslipDesign: null,
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

            fetchPayrollSettings: async () => {
                set({ isLoading: true })
                try {
                    const res = await settingsAPI.getPayrollSettings()
                    set({ payroll: res.data.data, isLoading: false })
                } catch (err) {
                    set({ isLoading: false })
                    console.error('Failed to fetch payroll settings:', err)
                }
            },

            fetchPayslipDesign: async () => {
                const { payslipTemplateAPI } = await import('@/services/endpoints')
                try {
                    const res = await payslipTemplateAPI.getActive()
                    set({ payslipDesign: res.data.data })
                } catch (err) {
                    console.error('Failed to fetch active payslip design:', err)
                    // Fallback
                    set({ payslipDesign: { templateId: 'CORPORATE', backgroundImageUrl: null } })
                }
            },

            updateGeneralSettings: (newSettings) => {
                set({ general: { ...get().general, ...newSettings } })
            },

            updatePayrollSettings: (newSettings) => {
                set({ payroll: { ...get().payroll, ...newSettings } })
            },

            updatePayslipDesign: (newDesign) => {
                set({ payslipDesign: { ...get().payslipDesign, ...newDesign } })
            }
        }),
        {
            name: 'settings-storage',
            getStorage: () => localStorage,
        }
    )
)
