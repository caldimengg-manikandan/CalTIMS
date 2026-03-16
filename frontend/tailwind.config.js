/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          50:  'rgb(var(--color-primary-rgb) / 0.05)',
          100: 'rgb(var(--color-primary-rgb) / 0.1)',
          200: 'rgb(var(--color-primary-rgb) / 0.2)',
          300: 'rgb(var(--color-primary-rgb) / 0.3)',
          400: 'rgb(var(--color-primary-rgb) / 0.4)',
          500: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-primary-rgb) / 0.8)',
          700: 'rgb(var(--color-primary-rgb) / 0.9)',
          800: 'rgb(var(--color-primary-rgb) / 0.95)',
          900: 'rgb(var(--color-primary-rgb) / 1)',
          950: 'rgb(var(--color-primary-rgb) / 1)',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        success: { 50: '#f0fdf4', 500: '#22c55e', 600: '#16a34a' },
        warning: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        danger:  { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        info:    { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        glow: '0 0 20px rgb(99 102 241 / 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { opacity: 0, transform: 'translateY(-10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: 0, transform: 'scale(0.95)' }, to: { opacity: 1, transform: 'scale(1)' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mesh': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      },
      screens: {
        'short': { 'raw': '(max-height: 700px)' },
        'tall': { 'raw': '(min-height: 900px)' },
        'ultrawide': { 'raw': '(min-aspect-ratio: 21/9)' },
      },
      transitionDuration: {
        'fast': '150ms',
        'slow': '400ms',
      }
    },
  },
  plugins: [
    function({ addVariant }) {
      addVariant('midnight', '.midnight &')
    }
  ],
}
