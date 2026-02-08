/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080E1A',
        'bg-light': '#0F1729',
        'bg-card': 'rgba(255,255,255,0.025)',
        primary: '#60A5FA',
        'primary-dark': '#2563EB',
        text: '#E2E8F0',
        'text-muted': '#94A3B8',
        'text-dark': '#4B5C75',
        success: '#34D399',
        warning: '#F59E0B',
        danger: '#FB7185',
        member: {
          blue: '#60A5FA',
          orange: '#F59E0B',
          pink: '#F472B6',
          green: '#34D399',
          purple: '#A78BFA',
          red: '#FB7185',
        },
      },
      borderRadius: {
        card: '14px',
        btn: '11px',
      },
    },
  },
  plugins: [],
};
