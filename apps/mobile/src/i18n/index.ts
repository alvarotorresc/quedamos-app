import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import es from './locales/es.json';
import en from './locales/en.json';
import { registerLanguageSync } from '../lib/language-sync';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'quedamos-lang',
      caches: ['localStorage'],
    },
  });

// The API writes each push in the recipient's language, so the choice made here has to
// reach the Supabase profile the API reads it from.
registerLanguageSync(i18n);

export default i18n;
