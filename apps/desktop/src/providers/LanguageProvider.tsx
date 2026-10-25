import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import ja from '@/locales/ja.json';
import en from '@/locales/en.json';

export type Language = 'ja' | 'en';

export const translations = {
  ja,
  en,
} as const;

export type TranslationKey = keyof typeof ja;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ja',
  setLanguage: () => {},
  t: (key) => key,
});

const LANGUAGE_STORAGE_KEY = 'ketchup_language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
    if (saved === 'ja' || saved === 'en') {
      return saved;
    }
    // Default to browser language or ja
    const navLang = navigator.language.toLowerCase();
    if (navLang.startsWith('en')) {
      return 'en';
    }
    return 'ja';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    document.documentElement.setAttribute('lang', lang);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('lang', language);
  }, [language]);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.ja;
      let text: string = (dict as Record<string, string>)[key] || (translations.ja as Record<string, string>)[key] || key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return text;
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
