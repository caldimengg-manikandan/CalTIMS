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
    theme: initTheme,
    darkMode: initTheme === 'dark' || initTheme === 'midnight',

    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebar: (val) => set({ sidebarOpen: val }),

    toggleDarkMode: () =>
      set((s) => {
        let nextTheme = 'light';
        if (s.theme === 'light') nextTheme = 'dark';
        else if (s.theme === 'dark') nextTheme = 'midnight';
        else if (s.theme === 'midnight') nextTheme = 'light';

        localStorage.setItem('theme', nextTheme);
        
        const isDark = nextTheme === 'dark' || nextTheme === 'midnight';
        const isMidnight = nextTheme === 'midnight';
        
        document.documentElement.classList.toggle('dark', isDark);
        document.documentElement.classList.toggle('midnight', isMidnight);
        
        return { theme: nextTheme, darkMode: isDark };
      }),
  };
});
