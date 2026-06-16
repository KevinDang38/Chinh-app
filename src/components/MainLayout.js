"use client";
import Sidebar from "./Sidebar";
import { LanguageProvider } from "../context/LanguageContext";

export default function MainLayout({ children }) {
  return (
    <LanguageProvider>
      <div className="flex min-h-screen bg-[#050507] text-white font-sans selection:bg-orange-500/30">
        
        {/* The updated Sidebar automatically handles both the Desktop nav and the Mobile Top Header */}
        <Sidebar />
        
        {/* 
          Main Content Wrapper:
          pt-16 ensures mobile content doesn't hide behind the fixed 4rem (16) mobile header.
          md:pt-0 removes that top padding on desktop since the sidebar is on the left.
        */}
        <div className="flex-1 flex flex-col min-w-0 w-full pt-16 md:pt-0">
          {children}
        </div>

      </div>
    </LanguageProvider>
  );
}