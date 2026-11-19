"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PenLine, CalendarDays, Users, UserRound, PlusCircle, LogOut, Languages, Moon, Sun } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../lib/theme";

// Mobile: slim top bar + bottom tab bar. Desktop (md+): left rail.
export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, language, toggleLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("player");

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session) {
        const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        setRole(data?.role ?? "player");
      }
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub?.subscription?.unsubscribe();
  }, []);

  if (pathname === "/login" || pathname === "/update-password") return null;

  const items = [
    { label: t("sidebar.logMatch"), href: "/", icon: PenLine, match: (p) => p === "/" },
    { label: t("sidebar.events"), href: "/events", icon: CalendarDays, match: (p) => p.startsWith("/events") && p !== "/events/create" },
    { label: t("sidebar.friends"), href: "/friends", icon: Users, match: (p) => p.startsWith("/friends") || p.startsWith("/profile") },
    { label: user ? t("nav.me") : t("auth.signIn"), href: user ? "/dashboard" : "/login", icon: UserRound, match: (p) => p.startsWith("/dashboard") },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const langLabel = language === "en" ? "Tiếng Việt" : "English";
  const themeLabel = theme === "dark" ? t("nav.lightMode") : t("nav.darkMode");
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <>
      {/* ---------- mobile top bar ---------- */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 px-4 flex items-center justify-between bg-paper/95 backdrop-blur border-b border-line">
        <Link href={user ? "/dashboard" : "/"} className="num text-[1.375rem] tracking-tight">Chình</Link>
        <div className="flex items-center gap-1">
          {role === "admin" && (
            <Link href="/events/create" className="btn btn-quiet btn-sm" aria-label={t("sidebar.hostEvent")}><PlusCircle size={20} /></Link>
          )}
          <button onClick={toggleTheme} className="btn btn-quiet btn-sm" aria-label={themeLabel}><ThemeIcon size={19} /></button>
          <button onClick={toggleLanguage} className="btn btn-quiet btn-sm" aria-label={langLabel}>
            <Languages size={18} /> {language === "en" ? "VI" : "EN"}
          </button>
        </div>
      </header>

      {/* ---------- mobile bottom tabs ---------- */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label="Main">
        <ul className="grid grid-cols-4">
          {items.map(({ label, href, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={`flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[0.75rem] font-semibold ${active ? "text-ink" : "text-ink-3"}`}>
                  <span className={`w-14 h-8 rounded-full flex items-center justify-center ${active ? "bg-volt text-volt-ink" : ""}`}>
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ---------- desktop rail ---------- */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-line bg-surface px-4 py-6">
        <Link href={user ? "/dashboard" : "/"} className="num text-[1.75rem] tracking-tight px-3">Chình</Link>
        <nav className="mt-8 flex flex-col gap-1" aria-label="Main">
          {items.map(({ label, href, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 h-12 px-3 rounded-xl font-semibold ${active ? "bg-volt text-volt-ink" : "text-ink-2 hover:bg-court-tint hover:text-ink"}`}>
                <Icon size={20} /> {label}
              </Link>
            );
          })}
          {role === "admin" && (
            <Link href="/events/create" aria-current={pathname === "/events/create" ? "page" : undefined}
              className={`flex items-center gap-3 h-12 px-3 rounded-xl font-semibold ${pathname === "/events/create" ? "bg-volt text-volt-ink" : "text-ink-2 hover:bg-court-tint hover:text-ink"}`}>
              <PlusCircle size={20} /> {t("sidebar.hostEvent")}
            </Link>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <button onClick={toggleTheme} className="flex items-center gap-3 h-12 px-3 rounded-xl font-semibold text-ink-2 hover:bg-court-tint hover:text-ink">
            <ThemeIcon size={20} /> {themeLabel}
          </button>
          <button onClick={toggleLanguage} className="flex items-center gap-3 h-12 px-3 rounded-xl font-semibold text-ink-2 hover:bg-court-tint hover:text-ink">
            <Languages size={20} /> {langLabel}
          </button>
          {user && (
            <button onClick={signOut} className="flex items-center gap-3 h-12 px-3 rounded-xl font-semibold text-ink-2 hover:bg-loss-tint hover:text-loss">
              <LogOut size={20} /> {t("sidebar.signOut")}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
