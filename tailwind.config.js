/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
  safelist: [
    // Dynamic colors used in components
    { pattern: /bg-(orange|red|green|blue|yellow|purple|pink|amber|cyan|indigo|emerald)-500\/(10|15|20|25|30)/ },
    { pattern: /text-(orange|red|green|blue|yellow|purple|pink|amber|cyan|indigo|emerald)-400/ },
    { pattern: /border-(orange|red|green|blue|yellow|purple|pink|amber|cyan|indigo|emerald)-500\/(20|30)/ },
    'hover:bg-white/3',
  ],
}
