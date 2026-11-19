"use client";
import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import en from "../dictionaries/en.json";
import vn from "../dictionaries/vn.json";

const dictionaries = { en, vn };
const LanguageContext = createContext();

// The chosen language lives in localStorage; this tiny store lets React read it without an effect.
const listeners = new Set();
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
const read = () => {
  try { return localStorage.getItem("app_lang") === "vn" ? "vn" : "en"; } catch { return "en"; }
};

export function LanguageProvider({ children }) {
  const language = useSyncExternalStore(subscribe, read, () => "en");

  // Keep <html lang> in step so screen readers and the browser use the right language.
  useEffect(() => {
    document.documentElement.lang = language === "vn" ? "vi" : "en";
  }, [language]);

  const toggleLanguage = () => {
    try { localStorage.setItem("app_lang", language === "en" ? "vn" : "en"); } catch {}
    listeners.forEach((cb) => cb());
  };

  // Looks up keys like "sidebar.dashboard"; falls back to the key name if missing.
  const t = (key) => {
    let value = dictionaries[language];
    for (const k of key.split(".")) {
      if (value?.[k] === undefined) return key;
      value = value[k];
    }
    return value;
  };

  return <LanguageContext.Provider value={{ language, toggleLanguage, t }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
