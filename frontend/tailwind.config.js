/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',  // Small phones (iPhone SE, etc.)
        'sm': '640px',  // Large phones
        'md': '768px',  // Tablets
        'lg': '1024px', // Laptops
        'xl': '1280px', // Desktops
        '2xl': '1536px', // Large desktops
      },
      colors: {
        cream: {
          50: '#fffdf5',
          100: '#fefcf0',
          200: '#fdf8e1',
          300: '#fcf4d2',
          400: '#faf0c3',
          500: '#f8ecb4',
        },
        orange: {
          light: '#FFD166',
          DEFAULT: '#FF9F1C',
          dark: '#E88A00',
        },
        brown: {
          light: '#8B7355',
          DEFAULT: '#5D4E37',
          dark: '#3D3222',
        },
        mint: {
          light: '#A8E6CF',
          DEFAULT: '#88D8B0',
        },
        lavender: {
          light: '#DDA0DD',
          DEFAULT: '#DA70D6',
        },
        sky: {
          light: '#87CEEB',
          DEFAULT: '#4FC3F7',
        }
      },
      fontFamily: {
        nunito: ['Nunito', 'sans-serif'],
        fredoka: ['Fredoka One', 'cursive'],
      },
      boxShadow: {
        'soft': '4px 4px 15px rgba(0,0,0,0.05), -2px -2px 10px rgba(255,255,255,0.8)',
        'soft-lg': '8px 8px 20px rgba(0,0,0,0.08), -4px -4px 15px rgba(255,255,255,0.9)',
        'glow-orange': '0 8px 25px rgba(255, 159, 28, 0.45)',
        'glow-green': '0 8px 25px rgba(46, 204, 113, 0.4)',
        'glow-red': '0 8px 25px rgba(231, 76, 60, 0.5)',
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: 1, transform: 'scale(1)' },
          '50%': { opacity: 0.7, transform: 'scale(1.1)' },
        },
        'glow': {
          '0%, 100%': { transform: 'scale(1)', opacity: 0.5 },
          '50%': { transform: 'scale(1.05)', opacity: 0.8 },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
    },
  },
  plugins: [],
}
