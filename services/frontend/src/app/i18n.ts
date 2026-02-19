import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import translationEN from '../locales/en/translation.json';
import translationKK from '../locales/kk/translation.json';
import translationRU from '../locales/ru/translation.json';

const resources = {
  en: {
    translation: translationEN,
  },
  kk: {
    translation: translationKK,
  },
  ru: {
    translation: translationRU,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('i18nextLng') || 'kk', // Default language is Kazakh
    fallbackLng: 'kk',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      order: ['localStorage', 'cookie', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
    },
  });

export default i18n;
