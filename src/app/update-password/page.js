"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password: password });

    if (error) {
      setMessage("Error: " + error.message);
      setLoading(false);
    } else {
      setMessage("Password updated successfully! Taking you to the courts...");
      setTimeout(() => router.push("/dashboard"), 2000);
    }
  };

  const inputStyle = "block w-full h-12 rounded-xl border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all px-4";

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="bg-zinc-950 p-8 rounded-3xl shadow-2xl border border-zinc-800 w-full max-w-md">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-extrabold text-white mb-2">Set New Password</h2>
          <p className="text-zinc-400 text-sm">Enter a strong, new password below.</p>
        </div>
        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-zinc-400 mb-2">New Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-orange-600 text-white font-extrabold py-4 rounded-xl hover:bg-orange-500 transition shadow-lg shadow-orange-900/50 disabled:bg-zinc-800 disabled:text-zinc-500 text-lg">
            {loading ? "Updating..." : "Secure My Account"}
          </button>
        </form>
        {message && (
          <div className={`mt-6 p-4 rounded-xl text-sm text-center font-bold ${message.includes("Error") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>
            {message}
          </div>
        )}
      </div>
    </main>
  );
}