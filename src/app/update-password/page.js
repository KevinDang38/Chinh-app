"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import { useLanguage } from "../../context/LanguageContext";

export default function UpdatePassword() {
  const { t } = useLanguage();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage({ ok: false, text: error.message });
      setLoading(false);
    } else {
      setMessage({ ok: true, text: t("auth.passwordUpdated") });
      setTimeout(() => router.push("/dashboard"), 1500);
    }
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-6">
      <form onSubmit={handleUpdatePassword} className="w-full max-w-sm flex flex-col gap-3">
        <p className="num text-[1.5rem]">Chình</p>
        <h1 className="title mt-4">{t("auth.newPasswordTitle")}</h1>
        <label className="label" htmlFor="new-password">{t("auth.passwordPlaceholder")}</label>
        <input id="new-password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="field" />
        {message && <p role="status" className={message.ok ? "text-win" : "text-loss"}>{message.text}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary w-full mt-2">{t("auth.savePassword")}</button>
      </form>
    </main>
  );
}
