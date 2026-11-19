"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { LanguageProvider } from "../context/LanguageContext";

export default function MainLayout({ children }) {
  const pathname = usePathname();
  const bare = pathname === "/login" || pathname === "/update-password";
  return (
    <LanguageProvider>
      <Sidebar />
      {/* mobile: room for top bar (h-14) and bottom tabs; desktop: room for the 15rem rail */}
      <div className={bare ? "min-h-dvh" : "min-h-dvh pt-14 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pt-0 md:pb-0 md:pl-60"}>
        {children}
      </div>
    </LanguageProvider>
  );
}
