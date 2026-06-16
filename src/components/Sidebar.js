"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext";

export default function Sidebar({ isOpen, setIsOpen }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ role: "player", hash: "" });

  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isMobileOpen = isOpen !== undefined ? isOpen : localIsOpen;
  const setMobileOpen = setIsOpen !== undefined ? setIsOpen : setLocalIsOpen;

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
    return () => authListener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => setMobileOpen(false), [pathname, setMobileOpen]);

  if (pathname === "/login" || pathname === "/update-password") return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/login");
  };

  const safeTranslate = (key, fallback) => {
    const result = t(key);
    return (result === key || !result) ? fallback : result;
  };

  const navItems = [
    { name: safeTranslate('sidebar.dashboard', 'Dashboard'), path: '/dashboard' },
    { name: safeTranslate('sidebar.logMatch', 'Log Match'), path: '/' },
    { name: safeTranslate('sidebar.friends', 'Friends'), path: '/friends' },
    { name: safeTranslate('sidebar.events', 'Events'), path: '/events' },
  ];

  if (userProfile.role === "admin") {
    navItems.push({ name: safeTranslate('sidebar.hostEvent', 'Host Event'), path: '/events/create' });
  }

  return (
    <>
      {/* 📱 MOBILE: Top Header (Logo Left, Hamburger Right) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-5">
        <Link href="/dashboard" className="text-xl font-black text-white tracking-tighter">
          Chình
        </Link>

        <button 
          onClick={() => setMobileOpen(!isMobileOpen)}
          className="w-10 h-10 flex flex-col justify-center items-end gap-1.5 focus:outline-none rounded-full bg-white/5 px-2.5 active:scale-95 transition-all border border-white/5"
        >
          <span className={`block h-0.5 bg-white transition-all duration-300 ${isMobileOpen ? 'w-5 rotate-45 translate-y-2' : 'w-5'}`}></span>
          <span className={`block h-0.5 bg-white transition-all duration-300 ${isMobileOpen ? 'w-0 opacity-0' : 'w-4'}`}></span>
          <span className={`block h-0.5 bg-white transition-all duration-300 ${isMobileOpen ? 'w-5 -rotate-45 -translate-y-2' : 'w-5'}`}></span>
        </button>
      </div>

      {/* 📱 MOBILE: Sleek Slide-In Drawer (From Right) */}
      {isMobileOpen && (
        <>
          <div 
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setMobileOpen(false)}
          ></div>
          
          <div className="md:hidden fixed inset-y-0 right-0 w-70 bg-[#0a0a0c] z-50 flex flex-col justify-between shadow-2xl border-l border-white/5 animate-in slide-in-from-right duration-300">
            <div>
              {/* Profile Integration in Mobile Menu */}
              <div className="p-6 border-b border-white/5 mb-2 bg-white/2">
                {user ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 shrink-0 rounded-full bg-orange-500/20 border border-orange-500/50 flex items-center justify-center text-orange-400 font-black text-sm shadow-[0_0_10px_rgba(234,88,12,0.2)]">
                      {user.email ? user.email.substring(0, 2).toUpperCase() : 'ME'}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Account</span>
                      <span className="text-white font-bold text-sm truncate">{user.email}</span>
                    </div>
                  </div>
                ) : (
                  <h2 className="text-2xl font-black text-white tracking-tighter">Chình</h2>
                )}
              </div>

              <nav className="px-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      href={item.path}
                      className={`block w-full px-5 py-4 text-sm font-bold rounded-2xl transition-all ${
                        isActive 
                          ? "text-orange-400 bg-orange-500/10 border border-orange-500/20 shadow-inner" 
                          : "text-zinc-400 active:bg-white/5 active:text-white"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {user && (
              <div className="p-3 border-t border-white/5 space-y-1">
                <button 
                  onClick={toggleLanguage}
                  className="w-full flex justify-between items-center px-5 py-4 text-sm font-bold text-zinc-500 rounded-2xl active:bg-white/5 transition-colors"
                >
                  <span>{safeTranslate('sidebar.language', 'Language')}</span>
                  <span className="text-orange-500 uppercase">{language || 'EN'}</span>
                </button>
                <button 
                  onClick={handleSignOut} 
                  className="w-full text-left px-5 py-4 text-sm font-bold text-red-500/80 active:text-red-500 rounded-2xl active:bg-red-500/10 transition-colors"
                >
                  {safeTranslate('sidebar.signOut', 'Sign Out')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* 💻 DESKTOP: "Floating Island" Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 h-[calc(100vh-2rem)] sticky top-4 ml-4 mb-4 bg-[#0a0a0c]/80 backdrop-blur-3xl border border-white/5 shrink-0 rounded-4xl shadow-2xl overflow-hidden z-50">
        <div className="absolute top-0 left-0 w-full h-32 bg-linear-to-b from-white/3 to-transparent pointer-events-none"></div>

        <div className="pt-10 relative z-10">
          <div className="px-8 mb-10">
            <Link href="/dashboard" className="text-3xl font-black text-white tracking-tighter hover:text-zinc-300 transition-colors drop-shadow-md">
              Chình
            </Link>
          </div>

          <nav className="space-y-1.5 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`relative flex items-center w-full px-5 py-3 text-sm font-bold rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? "text-white bg-white/10 shadow-sm border border-white/10" 
                      : "text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span className="tracking-wide">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {user && (
          <div className="p-3 space-y-1 relative z-10">
            <button 
              onClick={toggleLanguage}
              className="w-full flex justify-between items-center px-5 py-3 text-sm font-bold text-zinc-500 hover:text-white transition-colors rounded-2xl hover:bg-white/5"
            >
              <span className="tracking-wide">{safeTranslate('sidebar.language', 'Language')}</span>
              <span className="text-orange-500 uppercase">{language || 'EN'}</span>
            </button>
            <button 
              onClick={handleSignOut} 
              className="w-full text-left px-5 py-3 text-sm font-bold text-red-500/70 hover:text-red-500 transition-colors rounded-2xl hover:bg-red-500/10 tracking-wide"
            >
              {safeTranslate('sidebar.signOut', 'Sign Out')}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}