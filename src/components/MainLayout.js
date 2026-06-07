"use client";
import { useState } from "react";
import Sidebar from "./Sidebar";
import { LanguageProvider } from "../context/LanguageContext";

export default function MainLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <LanguageProvider>
      <div className="flex h-screen overflow-hidden bg-black text-white w-full">
        
        {/* Mobile Overlay Backdrop (Click to close) */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* The Sidebar */}
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        {/* The Main Content Area */}
        <div className="flex-1 flex flex-col h-screen overflow-y-auto w-full">
          
          {/* Mobile Header: Hamburger moved to the Left */}
          <div className="md:hidden flex items-center gap-4 p-4 border-b border-zinc-900 bg-zinc-950 shadow-sm sticky top-0 z-30">
            <button 
              onClick={() => setIsSidebarOpen(true)} 
              className="text-2xl text-zinc-400 hover:text-white transition"
            >
              ☰
            </button>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
              <span className="text-orange-500">⚡</span> Chình
            </h1>
          </div>

          {/* Page Content */}
          <div className="w-full">
            {children}
          </div>

        </div>
      </div>
    </LanguageProvider>
  );
}