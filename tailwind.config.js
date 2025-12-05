/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        cream: '#FFFBF0',
        milk: '#FDF6E3',
        lavender: '#E6E6FA',
        matcha: '#D0F0C0',
        peach: '#FFDAB9',
        sky: '#B0E0E6',
        salmon: '#FA8072',
        slate: {
          750: '#2D3748',
        }
      },
      boxShadow: {
        'cute': '0 8px 0 0 rgba(0,0,0,0.1)',
        'cute-hover': '0 4px 0 0 rgba(0,0,0,0.1)',
        'card': '0 4px 20px rgba(0,0,0,0.05)',
      },
      animation: {
        'in': 'fadeIn 0.2s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
