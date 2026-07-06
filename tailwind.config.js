/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd2ff',
          300: '#8fb4ff',
          400: '#5c8dff',
          500: '#3366ff',
          600: '#1f47e0',
          700: '#1a38b3',
          800: '#1a318f',
          900: '#1b2e73',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        popover: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 10px 24px -6px rgb(0 0 0 / 0.10)',
      },
    },
  },
  plugins: [],
}
