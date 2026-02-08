import { create } from 'zustand';

interface ThemeState {
  darkMode: boolean;
  toggle: () => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  darkMode: true,

  toggle: () => {
    const next = !get().darkMode;
    set({ darkMode: next });
    applyTheme(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  },

  initialize: () => {
    const saved = localStorage.getItem('theme');
    const darkMode = saved !== 'light';
    set({ darkMode });
    applyTheme(darkMode);
  },
}));

function applyTheme(darkMode: boolean) {
  document.documentElement.classList.toggle('light', !darkMode);
}
