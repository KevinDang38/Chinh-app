"use client";
import { useSyncExternalStore } from "react";

// The theme lives on <html data-theme>; the inline script in layout.js sets it before paint.
const subscribe = (cb) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};
const read = () => document.documentElement.getAttribute("data-theme") || "light";

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "light");
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch {}
  };
  return { theme, toggleTheme };
}
