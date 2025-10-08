import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .init({
    supportedLngs: ['en', 'zh'],
    fallbackLng: 'en',
    debug: true,
    // backend options
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },
    // detection options
    detection: {
      order: ['queryString', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      caches: ['cookie', 'localStorage'],
    },
  });

export default i18n;
