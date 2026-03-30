import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const ACCENT_PRESETS = {
  indigo: { primary: '#6366f1', primaryHover: '#4f46e5', primaryLight: '#eef2ff', name: 'Indigo' },
  violet: { primary: '#8b5cf6', primaryHover: '#7c3aed', primaryLight: '#f5f3ff', name: 'Violet' },
  rose:   { primary: '#f43f5e', primaryHover: '#e11d48', primaryLight: '#fff1f2', name: 'Rose' },
  amber:  { primary: '#f59e0b', primaryHover: '#d97706', primaryLight: '#fffbeb', name: 'Amber' },
  emerald:{ primary: '#10b981', primaryHover: '#059669', primaryLight: '#ecfdf5', name: 'Emerald' },
  sky:    { primary: '#0ea5e9', primaryHover: '#0284c7', primaryLight: '#f0f9ff', name: 'Sky' },
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : null
}

function adjustColor(hex, amt) {
    let usePound = false;
    if (hex[0] === "#") {
        hex = hex.slice(1);
        usePound = true;
    }
    let num = parseInt(hex, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amt;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000FF) + amt;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? "#" : "") + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function applyTheme(state) {
  const root = document.documentElement

  // Mode
  if (state.mode === 'dark') {
    root.classList.add('dark')
  } else if (state.mode === 'light') {
    root.classList.remove('dark')
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    prefersDark ? root.classList.add('dark') : root.classList.remove('dark')
  }

  // Accent color
  const preset = ACCENT_PRESETS[state.accentPreset]
  const primary = state.customColor || preset?.primary || '#6366f1'
  const primaryHover = preset?.primaryHover || adjustColor(primary, -20)
  const primaryLight = preset?.primaryLight || `${primary}15` // 15 is ~8% opacity in hex

  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-primary-rgb', hexToRgb(primary))
  root.style.setProperty('--color-primary-hover', primaryHover)
  root.style.setProperty('--color-primary-light', primaryLight)
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      mode: 'light',              // 'light' | 'dark' | 'system'
      accentPreset: 'indigo',     // key of ACCENT_PRESETS
      customColor: null,          // null = use preset; string hex = custom override

      setMode: (mode) => {
        set({ mode })
      },
      setAccentPreset: (preset) => {
        set({ accentPreset: preset, customColor: null })
      },
      setCustomColor: (hex) => {
        set({ customColor: hex })
      },
      syncFromBranding: (branding) => {
        if (!branding) return
        if (branding.primaryColor) {
           set({ customColor: branding.primaryColor })
        }
      },
      applyTheme: () => applyTheme(get()),
    }),
    { 
      name: 'timesheet-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state)
      }
    }
  )
)

// Global subscriber to apply theme on any change
useThemeStore.subscribe((state) => {
  applyTheme(state)
})

export { ACCENT_PRESETS }

