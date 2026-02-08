import { useTranslation } from 'react-i18next';

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith('es') ? 'es' : 'en';

  const languages = [
    { code: 'es', flag: '\ud83c\uddea\ud83c\uddf8', label: 'Espa\u00f1ol' },
    { code: 'en', flag: '\ud83c\uddec\ud83c\udde7', label: 'English' },
  ] as const;

  return (
    <div className="flex gap-2">
      {languages.map(({ code, flag, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => i18n.changeLanguage(code)}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn text-sm font-medium transition-colors ${
            current === code
              ? 'bg-primary/15 border border-primary/30 text-primary'
              : 'bg-white/5 border border-white/10 text-text-muted'
          }`}
        >
          <span>{flag}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
