"use client";

import React, { createContext, useContext } from 'react';
import { usePOIStore } from '../hooks/usePOIStore';
import { translations, Language, TranslationKey } from '../lib/translations';

interface LanguageContextType {
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  t: (key) => translations['English'][key] || key,
});

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const language = usePOIStore((state) => state.language) as Language;

  const t = (key: TranslationKey): string => {
    const langDict = translations[language] || translations['English'];
    return langDict[key] || translations['English'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ t }}>
      {children}
    </LanguageContext.Provider>
  );
};
