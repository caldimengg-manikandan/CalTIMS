import { create } from 'zustand'

export const useUIStore = create((set) => {
  const initTheme = localStorage.getItem('theme') || 'light';
  
  if (initTheme === 'dark' || initTheme === 'midnight') {
    document.documentElement.classList.add('dark');
  }
  if (initTheme === 'midnight') {
    document.documentElement.classList.add('midnight');
  }

  return {
    sidebarOpen: true,
    sidebarWidth: parseInt(localStorage.getItem('sidebarWidth')) || 260,
    theme: initTheme,
    darkMode: initTheme === 'dark' || initTheme === 'midnight',

    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebar: (val) => set({ sidebarOpen: val }),
    setSidebarWidth: (width) => {
      localStorage.setItem('sidebarWidth', width);
      set({ sidebarWidth: width });
    },

    // Unsaved Changes Tracking
    hasUnsavedChanges: false,
    pendingNavTarget: null,
    setUnsavedChanges: (val) => set({ hasUnsavedChanges: val }),
    setPendingNavTarget: (val) => set({ pendingNavTarget: val }),

    toggleDarkMode: () =>
      set((s) => {
        const nextTheme = s.theme === 'light' ? 'dark' : 'light';

        localStorage.setItem('theme', nextTheme);
        
        const isDark = nextTheme === 'dark';
        
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.remove('midnight'); // clean up if left over
        
        return { theme: nextTheme, darkMode: isDark };
      }),
  };
});
