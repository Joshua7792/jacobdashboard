// i18n config: English + Spanish, persistence in localStorage.
//
// We use react-i18next so any component can call useTranslation() and read
// strings via t('key.path'). The user's choice is stored in localStorage so
// it survives reloads. Fallback language is English when a key is missing.
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import en from './locales/en.json'
import es from './locales/es.json'

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'es'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'cordillera_lang',
    },
  })

export default i18n
