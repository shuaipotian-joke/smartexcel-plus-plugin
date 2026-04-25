import type { Config } from 'tailwindcss';

export default {
  content: ['entrypoints/**/*.{ts,tsx,html}', 'components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1fbf6',
          100: '#d9f5e8',
          200: '#b7ead4',
          300: '#82dbb9',
          400: '#4fc799',
          500: '#2ab37f',
          600: '#1f966b',
          700: '#1d7858',
          800: '#1b604a',
          900: '#184f3e',
        },
        cream: {
          50: '#fffdf7',
          100: '#fbf7ea',
          200: '#f0e6cd',
        },
      },
      boxShadow: {
        soft: '0 16px 42px -28px hsl(155 38% 10% / 0.28)',
        lift: '0 28px 78px -42px hsl(155 38% 10% / 0.40)',
      },
    },
  },
  plugins: [],
} satisfies Config;
