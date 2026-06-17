"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

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

  return (
    <main className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="glass-panel p-8 sm:p-10 rounded-4xl w-full max-w-md shadow-2xl border border-white/5 bg-linear-to-br from-white/3 to-transparent relative z-10">
        
        <div className="mb-8 text-center">
          <div className="w-14 h-14 glass-card rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-white/10">
            <ShieldCheck className="w-6 h-6 text-orange-500" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tighter mb-2">Set New Password</h2>
          <p className="text-zinc-400 text-xs font-medium">Enter a strong, new password below.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-5">
          <div>
            <label className="block text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2 ml-1">New Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              className="w-full h-12 px-4 bg-black/40 border border-white/10 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner text-sm font-bold" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full h-12 bg-orange-600 text-white font-bold rounded-xl text-base hover:bg-orange-500 active:scale-95 transition-all shadow-[0_8px_20px_rgba(234,88,12,0.25)] disabled:opacity-50 mt-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div> : "Secure My Account"}
          </button>
        </form>

        {message && (
          <div className={`mt-5 p-3 rounded-xl text-xs text-center font-bold border ${message.includes("Error") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
            {message}
          </div>
        )}
      </div>
    </main>
  );
}