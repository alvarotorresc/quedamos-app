import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LanguageSelector } from './LanguageSelector';

// Create a shared spy that both the test and the component will reference
const changeLanguageSpy = vi.fn();
let mockLanguage = 'es';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      get language() {
        return mockLanguage;
      },
      changeLanguage: changeLanguageSpy,
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('LanguageSelector', () => {
  beforeEach(() => {
    mockLanguage = 'es';
  });

  it('renders both language buttons', () => {
    render(<LanguageSelector />);
    expect(screen.getByText('English')).toBeInTheDocument();
  });

  it('highlights Spanish as current when i18n.language starts with es', () => {
    render(<LanguageSelector />);
    const buttons = screen.getAllByRole('button');
    const spanishButton = buttons.find((btn) => !btn.textContent?.includes('English'));
    expect(spanishButton?.className).toContain('bg-primary/15');
  });

  it('highlights English as inactive by default (language is es)', () => {
    render(<LanguageSelector />);
    const englishButton = screen.getByText('English').closest('button');
    expect(englishButton?.className).toContain('bg-white/5');
    expect(englishButton?.className).toContain('text-text-muted');
  });

  it('calls i18n.changeLanguage with "en" when English button is clicked', () => {
    render(<LanguageSelector />);
    const englishButton = screen.getByText('English').closest('button')!;
    fireEvent.click(englishButton);
    expect(changeLanguageSpy).toHaveBeenCalledWith('en');
  });

  it('calls i18n.changeLanguage with "es" when Spanish button is clicked', () => {
    render(<LanguageSelector />);
    const buttons = screen.getAllByRole('button');
    const spanishButton = buttons.find((btn) => !btn.textContent?.includes('English'))!;
    fireEvent.click(spanishButton);
    expect(changeLanguageSpy).toHaveBeenCalledWith('es');
  });

  it('renders two language option buttons', () => {
    render(<LanguageSelector />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });

  it('renders buttons with type=button to prevent form submission', () => {
    render(<LanguageSelector />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((button) => {
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  it('treats language codes starting with "es" as Spanish', () => {
    mockLanguage = 'es-MX';
    render(<LanguageSelector />);
    const buttons = screen.getAllByRole('button');
    const spanishButton = buttons.find((btn) => !btn.textContent?.includes('English'));
    expect(spanishButton?.className).toContain('bg-primary/15');
  });

  it('treats non-es language codes as English', () => {
    mockLanguage = 'en';
    render(<LanguageSelector />);
    const englishButton = screen.getByText('English').closest('button');
    expect(englishButton?.className).toContain('bg-primary/15');
  });
});
