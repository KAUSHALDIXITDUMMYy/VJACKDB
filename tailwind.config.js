/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'cyberpunk-black': '#18181b',
        'cyberpunk-violet': '#6d28d9',
        'cyberpunk-pink': '#ec4899',
        'cyberpunk-blue': '#38bdf8',
        'cyberpunk-yellow': '#fde047',
        'cyberpunk-green': '#22d3ee',
        'cyberpunk-red': '#f43f5e',
      },
    },
  },
  plugins: [],
};
