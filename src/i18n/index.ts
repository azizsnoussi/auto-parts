import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import fr from './fr.json';
import en from './en.json';

export type AppLanguage = 'fr' | 'en';

const STORAGE_KEY = 'ba_lang';

/** French is the default: the storefront audience is Tunisian. */
const savedLang: AppLanguage =
  localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'fr';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
    },
    lng: savedLang,
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
  });

// Keep <html lang> in sync for screen readers and browser translation prompts.
const applyHtmlLang = (lang: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
};
applyHtmlLang(savedLang);

/** Switch to an explicit language and persist the choice. */
export const setLanguage = (lang: AppLanguage) => {
  if (i18n.language === lang) return;
  i18n.changeLanguage(lang);
  localStorage.setItem(STORAGE_KEY, lang);
  applyHtmlLang(lang);
};

export const toggleLanguage = () => {
  setLanguage(i18n.language === 'fr' ? 'en' : 'fr');
};

export default i18n;
