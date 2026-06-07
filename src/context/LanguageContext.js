"use client";
import { createContext, useState, useContext, useEffect } from "react";
import en from "../dictionaries/en.json";
import vn from "../dictionaries/vn.json";

const dictionaries = { en, vn };
const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState("en");

  // Load saved language from browser storage on load
  useEffect(() => {
    const storedLang = localStorage.getItem("app_lang");
    if (storedLang) setLanguage(storedLang);
  }, []);

  const toggleLanguage = () => {
    const newLang = language === "en" ? "vn" : "en";
    setLanguage(newLang);
    localStorage.setItem("app_lang", newLang);
  };

  // Translation function: looks up keys like "sidebar.dashboard"
  const t = (key) => {
    const keys = key.split(".");
    let value = dictionaries[language];
    for (const k of keys) {
      if (value[k] === undefined) return key; // Fallback to key name if missing
      value = value[k];
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);