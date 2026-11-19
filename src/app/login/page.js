"use client";
import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";
import { Segmented } from "../../components/ui";

export default function AuthPage() {
  const { t, language, toggleLanguage } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!isLogin && password !== confirmPassword) return setErrorMsg(t("auth.passwordsNotMatch"));
    if (!isLogin && password.length < 6) return setErrorMsg(t("auth.passwordTooShort"));

    setLoading(true);
    // New accounts get their profile (rating 3.5) from a database trigger.
    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <main className="min-h-dvh md:grid md:grid-cols-2">
      {/* court panel */}
      <section className="relative overflow-hidden bg-court text-white px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-8 md:p-12 md:flex md:flex-col md:justify-between">
        <svg aria-hidden className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="none">
          <g fill="none" stroke="rgb(255 255 255 / .12)" strokeWidth="2.5">
            <rect x="16" y="16" width="368" height="268" />
            <line x1="16" y1="150" x2="384" y2="150" strokeWidth="4" />
            <line x1="16" y1="110" x2="384" y2="110" />
            <line x1="16" y1="190" x2="384" y2="190" />
            <line x1="200" y1="16" x2="200" y2="110" />
            <line x1="200" y1="190" x2="200" y2="284" />
          </g>
        </svg>
        <div className="relative flex items-center justify-between">
          <Link href="/" className="num text-[1.75rem]">Chình</Link>
          <button onClick={toggleLanguage} className="btn btn-sm bg-white/15 text-white hover:bg-white/25">{language === "en" ? "Tiếng Việt" : "English"}</button>
        </div>
        <p className="relative mt-10 md:mt-0 text-[1.75rem] md:text-[2.5rem] leading-[1.1] font-bold max-w-[16ch]" style={{ fontStretch: "112%" }}>
          {t("auth.tagline")}
        </p>
      </section>

      {/* form */}
      <section className="px-6 py-8 md:p-12 flex items-start md:items-center justify-center">
        <form onSubmit={handleAuth} className="w-full max-w-sm flex flex-col gap-3">
          <Segmented label={t("auth.signIn")} value={isLogin ? "in" : "up"} onChange={(v) => { setIsLogin(v === "in"); setErrorMsg(""); }}
            options={[{ value: "in", label: t("auth.signIn") }, { value: "up", label: t("auth.signUp") }]} />
          <h1 className="title mt-4">{isLogin ? t("auth.welcomeBack") : t("auth.createAccount")}</h1>
          <p className="muted -mt-1 mb-2">{isLogin ? t("auth.signInDesc") : t("auth.signUpDesc")}</p>

          <label className="label" htmlFor="email">{t("auth.emailPlaceholder")}</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="field" />
          <label className="label" htmlFor="password">{t("auth.passwordPlaceholder")}</label>
          <input id="password" type="password" required autoComplete={isLogin ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
          {!isLogin && (
            <>
              <label className="label" htmlFor="confirm">{t("auth.confirmPasswordPlaceholder")}</label>
              <input id="confirm" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="field" />
            </>
          )}

          {errorMsg && <p role="alert" className="text-loss text-[0.9375rem]">{errorMsg}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">
            {loading ? (isLogin ? t("auth.signingIn") : t("auth.creatingAccount")) : isLogin ? t("auth.signIn") : t("auth.signUp")}
          </button>
          <Link href="/" className="btn btn-quiet w-full">{t("auth.continueGuest")}</Link>
        </form>
      </section>
    </main>
  );
}
