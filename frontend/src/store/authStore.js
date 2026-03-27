import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { userAPI } from '@/services/endpoints'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      subscription: null,
      isAuthenticated: false,

      // Actions
      setAuth: (user, accessToken, refreshToken, subscription = null) =>
        set({ user, accessToken, refreshToken, subscription, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      setRefreshToken: (refreshToken) =>
        set({ refreshToken }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),

      updateUser: (userData) =>
        set((state) => ({ user: { ...state.user, ...userData } })),

      checkAuth: async () => {
        const { accessToken, isAuthenticated } = get()
        if (!accessToken || !isAuthenticated) return

        try {
          const res = await userAPI.getMe()
          const { user, subscription } = res.data.data
          set({ user, subscription, isAuthenticated: true })
        } catch (error) {
          console.error('CheckAuth failed:', error)
          set({ user: null, accessToken: null, refreshToken: null, subscription: null, isAuthenticated: false })
          localStorage.removeItem('timesheet-auth')
        }
      },

      // Getters
      getRole: () => get().user?.role,
      isAdmin: () => get().user?.role === 'admin',
      isManager: () => get().user?.role === 'manager',
      isEmployee: () => get().user?.role === 'employee',
      isTrial: () => get().subscription?.planType === 'TRIAL',
      isPro: () => {
        const { user, subscription } = get();
        if (user?.role === 'super_admin') return true;
        return subscription?.planType === 'PRO';
      },
      canAccess: (feature) => {
        const { user, subscription } = get();
        if (user?.role === 'super_admin') return true;
        const plan = subscription?.planType || 'TRIAL';
        if (plan === 'PRO') return true;
        if (feature === 'advanced_reports') return plan === 'PRO';
        if (feature === 'ai' || feature === 'payroll') return plan === 'PRO';
        return true; // default access for basic features
      },
    }),
    {
      name: 'timesheet-auth',
      partialize: (state) => ({ 
        user: state.user, 
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        subscription: state.subscription,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)
