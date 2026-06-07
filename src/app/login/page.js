"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); 
  const [showPassword, setShowPassword] = useState(false); // Toggle State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (isForgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) setMessage("Error: " + error.message);
      else setMessage("Check your email for the password reset link!");
    } else if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMessage("Error: " + error.message);
      else setMessage("Success! Check your email to verify.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage("Error: " + error.message);
      else router.push("/dashboard"); 
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    });
    if (error) setMessage("Google Login Error: " + error.message);
  };

  const inputStyle = "block w-full h-12 rounded-xl border border-zinc-800 bg-zinc-900 text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all px-4";

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold text-white tracking-tight flex items-center justify-center gap-3">
          <span className="text-orange-500">⚡</span> Chình
        </h1>
        <p className="text-zinc-500 mt-2 font-bold uppercase tracking-widest text-sm">The Ultimate DUPR Network</p>
      </div>

      <div className="bg-zinc-950 p-8 rounded-3xl shadow-2xl border border-zinc-800 w-full max-w-md">
        {!isForgotPassword && (
          <>
            <div className="flex bg-zinc-900 rounded-xl p-1 mb-8 border border-zinc-800">
              <button onClick={() => {setIsSignUp(false); setMessage("");}} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!isSignUp ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>Sign In</button>
              <button onClick={() => {setIsSignUp(true); setMessage("");}} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${isSignUp ? 'bg-zinc-800 text-white shadow-md' : 'text-zinc-500 hover:text-white'}`}>Create Account</button>
            </div>
            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-black font-extrabold py-3 px-4 rounded-xl hover:bg-zinc-200 transition shadow-sm mb-6">Continue with Google</button>
            <div className="flex items-center gap-4 mb-6"><div className="h-px bg-zinc-800 flex-1"></div><span className="text-zinc-600 text-xs font-bold uppercase tracking-wider">Or Email</span><div className="h-px bg-zinc-800 flex-1"></div></div>
          </>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-400 mb-1">Email Address</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} placeholder="player@example.com" />
          </div>

          {!isForgotPassword && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-semibold text-zinc-400">Password</label>
                {!isSignUp && <button type="button" onClick={() => {setIsForgotPassword(true); setMessage("");}} className="text-xs font-bold text-orange-500 hover:text-orange-400">Forgot?</button>}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className={inputStyle} 
                  placeholder="••••••••" 
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  className="absolute right-4 top-3.5 text-zinc-500 hover:text-white text-xs font-bold uppercase"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-orange-600 text-white font-extrabold py-4 rounded-xl hover:bg-orange-500 mt-4 text-lg">{loading ? "Processing..." : isForgotPassword ? "Send Reset Link" : isSignUp ? "Create Account" : "Sign In"}</button>
        </form>

        {isForgotPassword && <button onClick={() => {setIsForgotPassword(false); setMessage("");}} className="w-full mt-4 text-sm font-bold text-zinc-500 hover:text-white transition">&larr; Back to Login</button>}
        {message && <div className={`mt-6 p-4 rounded-xl text-sm text-center font-bold ${message.includes("Error") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>{message}</div>}
      </div>
    </main>
  );
}