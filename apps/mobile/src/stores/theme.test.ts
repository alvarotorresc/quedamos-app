import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './theme';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ darkMode: true });
    document.documentElement.classList.remove('light');
  });

  it('should default to dark mode', () => {
    expect(useThemeStore.getState().darkMode).toBe(true);
  });

  it('should toggle theme', () => {
    useThemeStore.getState().toggle();

    expect(useThemeStore.getState().darkMode).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('should toggle back to dark', () => {
    useThemeStore.getState().toggle(); // → light
    useThemeStore.getState().toggle(); // → dark

    expect(useThemeStore.getState().darkMode).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should initialize from localStorage (light)', () => {
    (localStorage.getItem as any).mockReturnValue('light');

    useThemeStore.getState().initialize();

    expect(useThemeStore.getState().darkMode).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('should initialize as dark when no saved preference', () => {
    (localStorage.getItem as any).mockReturnValue(null);

    useThemeStore.getState().initialize();

    expect(useThemeStore.getState().darkMode).toBe(true);
  });
});
