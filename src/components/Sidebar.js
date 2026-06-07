"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext"; // <-- Import Hook

export default function Sidebar({ isOpen, setIsOpen }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ role: "player", hash: "" });
  
  // Destructure translation function and toggle from context
  const { t, language, toggleLanguage } = useLanguage(); 

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        const { data: profile } = await supabase.from('profiles').select('role, profile_hash').eq('id', session.user.id).single();
        if (profile) setUserProfile({ role: profile.role, hash: profile.profile_hash });
      } else {
        setUser(null);
      }
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => checkUser());
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => setIsOpen(false), [pathname, setIsOpen]);

  if (pathname === "/login" || pathname === "/update-password") return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsOpen(false);
    router.push("/login");
  };

  const formatName = (email) => email ? email.split('@')[0] : t('common.guest');

  // Dynamic nav links using the dictionaries
  const navLinks = [
    { name: t('sidebar.dashboard'), path: "/dashboard", icon: "📊" },
    { name: t('sidebar.logMatch'), path: "/", icon: "🎾" },
    { name: t('sidebar.friends'), path: "/friends", icon: "👥" },
    { name: t('sidebar.events'), path: "/events", icon: "📅" },
  ];

  if (userProfile.role === "admin") navLinks.push({ name: t('sidebar.hostEvent'), path: "/events/create", icon: "➕" });

  return (
    <aside className={`fixed md:sticky top-0 left-0 h-screen z-50 w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
      <div className="p-6 border-b border-zinc-900 flex justify-between items-center">
        <h2 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2"><span className="text-orange-500">⚡</span> Chình</h2>
        <button onClick={() => setIsOpen(false)} className="md:hidden text-zinc-500 hover:text-white transition">✕</button>
      </div>
      
      <nav className="flex-1 p-4 flex flex-col gap-2 overflow-y-auto">
        {navLinks.map((link) => {
          const isActive = pathname === link.path;
          return (
            <Link key={link.name} href={link.path} onClick={() => setIsOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-colors ${isActive ? "bg-orange-600 text-white shadow-lg shadow-orange-900/20" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
              <span className="text-xl">{link.icon}</span>{link.name}
            </Link>
          );
        })}
      </nav>
      
      {/* LANGUAGE TOGGLE & USER PROFILE */}
      {user && (
        <div className="p-4 border-t border-zinc-900 space-y-2">
          
          {/* EN/VN Switcher */}
          <button 
            onClick={toggleLanguage} 
            className="flex items-center justify-between px-4 py-3 w-full rounded-xl font-bold bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <span className="text-sm">Language</span>
            <span className="bg-zinc-950 px-2 py-1 rounded text-xs uppercase text-orange-500">{language}</span>
          </button>
          
          <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl font-bold text-red-500 hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <span className="text-lg">🚪</span> {t('sidebar.signOut')}
          </button>
        </div>
      )}
    </aside>
  );
}