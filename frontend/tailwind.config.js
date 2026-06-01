/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '390px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['Nunito', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        // Refined dusty-rose primary — warm and friendly, but muted and elegant
        brand: {
          50: '#FBF4F4',
          100: '#F6E7E8',
          200: '#EDCFD2',
          300: '#DFACB2',
          400: '#CC828C',
          500: '#B85E6C',
          600: '#A14856',
          700: '#853A47',
          800: '#6F323C',
          900: '#5E2C34',
        },
        // Soft sage as a calm secondary accent
        sage: {
          50: '#F4F7F4',
          100: '#E6EDE5',
          200: '#CDDccb',
          300: '#A9C2A6',
          400: '#7FA37B',
          500: '#5F855B',
          600: '#4A6B47',
          700: '#3D563B',
          800: '#334631',
          900: '#2C3B2A',
        },
        // Muted warm gold for subtle highlights
        gold: {
          400: '#D9A766',
          500: '#C79350',
        },
        warm: '#FAF6F1',
        ink: '#2A2422',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        'pop-up': 'popUp 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popUp: {
          '0%': { opacity: '0', transform: 'translateY(40px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
