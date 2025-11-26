// frontend/src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ru from './locales/ru.json';
import en from './locales/en.json';
import zh from './locales/zh.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      zh: { translation: zh }
    },
    lng: localStorage.getItem('language') || 'ru',
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;