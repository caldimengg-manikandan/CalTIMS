import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { userAPI, subscriptionAPI } from '@/services/endpoints'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      subscription: null,
      isAuthenticated: false,
      isHydrating: true, // true until checkAuth resolves; prevents premature redirects on refresh
      hasCompletedTour: false,

      // Actions
      setAuth: (user, accessToken, refreshToken, subscription = null) =>
        set({ user, accessToken, refreshToken, subscription, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      setRefreshToken: (refreshToken) =>
        set({ refreshToken }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isHydrating: false }),

      updateUser: (userData) =>
        set((state) => ({ user: { ...state.user, ...userData } })),

      setHasCompletedTour: (value) =>
        set({ hasCompletedTour: value }),

      setAuthFromURL: async (accessToken, refreshToken) => {
        set({ accessToken, refreshToken, isAuthenticated: true, isHydrating: true })
        // After setting tokens, trigger checkAuth to fetch the actual user and subscription
        const store = get()
        await store.checkAuth()
      },

      checkAuth: async () => {
        const { accessToken, isAuthenticated, isHydrating } = get()
        
        // Return early if not supposedly authenticated
        if (!accessToken || !isAuthenticated) {
          set({ isHydrating: false })
          return
        }

        // Prevent redundant/concurrent calls if already hydrating
        // (Avoids issues with React StrictMode running effects twice)
        // Only skip if we already started
        // Actually, let's just proceed to ensure the latest check is done
        
        try {
          // 1. Fetch the fresh user object
          const userRes = await userAPI.getMe()
          const user = userRes.data.data
          
          let subscription = get().subscription

          // 2. Only fetch subscription if the user is associated with an organization
          if (user.organizationId) {
            try {
              const subRes = await subscriptionAPI.getCurrent({ skipToast: true })
              subscription = subRes.data.data
            } catch (err) {
              console.warn('Failed to fetch subscription during checkAuth:', err)
              // Keep old subscription or set to null if preferred
            }
          }

          set({ user, subscription, isAuthenticated: true, isHydrating: false })
        } catch (error) {
          console.error('CheckAuth failed:', error)
          set({ user: null, accessToken: null, refreshToken: null, subscription: null, isAuthenticated: false, isHydrating: false })
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
        isAuthenticated: state.isAuthenticated,
        hasCompletedTour: state.hasCompletedTour
      }),
    }
  )
)
