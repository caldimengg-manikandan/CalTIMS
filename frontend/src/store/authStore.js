import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      isAuthenticated: false,

      // Actions
      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),

      updateUser: (userData) =>
        set((state) => ({ user: { ...state.user, ...userData } })),

      // Getters
      getRole: () => get().user?.role,
      isAdmin: () => get().user?.role === 'admin',
      isManager: () => get().user?.role === 'manager',
      isEmployee: () => get().user?.role === 'employee',
    }),
    {
      name: 'timesheet-auth',
      partialize: (state) => ({ 
        user: state.user, 
        accessToken: state.accessToken, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)
