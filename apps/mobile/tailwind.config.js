/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--app-bg)',
        'bg-light': 'var(--app-bg-light)',
        'bg-card': 'var(--app-bg-card)',
        'bg-input': 'var(--app-bg-input)',
        'bg-hover': 'var(--app-bg-hover)',
        'toggle-off': 'var(--app-toggle-off)',
        primary: '#60A5FA',
        'primary-dark': '#2563EB',
        text: 'var(--app-text)',
        'text-muted': 'var(--app-text-muted)',
        'text-dark': 'var(--app-text-dark)',
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
      borderColor: {
        subtle: 'var(--app-border)',
        strong: 'var(--app-border-strong)',
      },
      borderRadius: {
        card: '14px',
        btn: '11px',
      },
    },
  },
  plugins: [],
};
