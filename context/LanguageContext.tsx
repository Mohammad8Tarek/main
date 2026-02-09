import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations } from '../services/translations';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, options?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(
    (localStorage.getItem('language') as Language) || 'en'
  );

  useEffect(() => {
    const root = document.documentElement;
    if (language === 'ar') {
      root.setAttribute('dir', 'rtl');
      root.setAttribute('lang', 'ar');
    } else {
      root.setAttribute('dir', 'ltr');
      root.setAttribute('lang', 'en');
    }
    localStorage.setItem('language', language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string, options?: { [key: string]: string | number }): string => {
    const keys = key.split('.');
    
    const findTranslation = (lang: Language): any => {
        let result: any = translations[lang];
        for (const k of keys) {
            result = result?.[k];
            if (result === undefined) return undefined;
        }
        return result;
    };

    let translation = findTranslation(language);

    if (translation === undefined) {
        translation = findTranslation('en'); // Fallback to English
    }

    if (typeof translation !== 'string') {
        return key; // Return key if not found or not a string
    }

    if (options) {
        return Object.entries(options).reduce(
            (acc, [optKey, optValue]) => acc.replace(`{${optKey}}`, String(optValue)),
            translation
        );
    }

    return translation;
  };
  
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
