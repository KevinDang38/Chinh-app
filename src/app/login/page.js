"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../../context/LanguageContext";

export default function AuthPage() {
  // Safely grab all possible language functions from your context
  const { t, language, toggleLanguage, setLanguage, changeLanguage } = useLanguage();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Bulletproof function to guarantee the language switches regardless of context naming
  const handleLanguageSwitch = () => {
    if (toggleLanguage) {
      toggleLanguage();
    } else if (setLanguage) {
      setLanguage(language === 'en' ? 'vi' : 'en');
    } else if (changeLanguage) {
      changeLanguage(language === 'en' ? 'vi' : 'en');
    } else {
      console.error("Language toggle function missing from LanguageContext.");
    }
  };

  // Ensures every string has a fallback if the translation key is missing
  const safeTranslate = (key, fallback) => {
    const result = t(key);
    return (result === key || !result) ? fallback : result;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (!isLogin && password !== confirmPassword) {
      setErrorMsg(safeTranslate('auth.passwordsNotMatch', 'Passwords do not match.'));
      setLoading(false);
      return;
    }

    if (!isLogin && password.length < 6) {
      setErrorMsg(safeTranslate('auth.passwordTooShort', 'Password must be at least 6 characters.'));
      setLoading(false);
      return;
    }

    let error;

    if (isLogin) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      error = signInError;
    } else {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      error = signUpError;
      
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').insert([{ id: user.id, email: user.email, rating: 3.500, role: 'player' }]);
        }
      }
    }

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <main className="fixed inset-0 z-100 flex flex-col items-center justify-center p-6 bg-[#050507] overflow-y-auto">
      
      {/* Brand Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 sm:mb-12 text-center"
      >
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter drop-shadow-md">
          Chình
        </h1>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass-panel p-8 sm:p-10 rounded-4xl border border-white/5 shadow-2xl relative overflow-hidden shrink-0"
      >
        {/* Subtle Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          
          {/* PERFECT ALIGNMENT: Flexbox container for Title and Button */}
          <div className="flex justify-between items-start mb-2 gap-4">
            <h2 className="text-3xl font-black text-white tracking-tighter leading-none pt-1">
              {isLogin ? safeTranslate('auth.welcomeBack', 'Welcome Back') : safeTranslate('auth.createAccount', 'Create Account')}
            </h2>
            
            <button 
              type="button"
              onClick={handleLanguageSwitch} 
              className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 hover:bg-white/10 transition-all shadow-md active:scale-95 cursor-pointer shrink-0"
            >
              <span className="text-[10px] font-bold text-zinc-400 tracking-wide">
                {safeTranslate('sidebar.language', 'Language')}
              </span>
              <span className="text-[10px] font-black text-orange-500 uppercase">
                {language || 'EN'}
              </span>
            </button>
          </div>

          <p className="text-zinc-400 text-sm mb-8 font-medium">
            {isLogin ? safeTranslate('auth.signInDesc', 'Enter your details to sign in to Chình.') : safeTranslate('auth.signUpDesc', 'Join Chình and start tracking your matches.')}
          </p>

          {/* Form */}
          <form onSubmit={handleAuth} className="flex flex-col w-full">
            <input 
              type="email" 
              placeholder={safeTranslate('auth.emailPlaceholder', 'Email address')}
              className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner mb-4"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder={safeTranslate('auth.passwordPlaceholder', 'Password')}
              className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            {/* Animated Confirm Password (Sign Up Only) */}
            <AnimatePresence>
              {!isLogin && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <input 
                    type="password" 
                    placeholder={safeTranslate('auth.confirmPasswordPlaceholder', 'Confirm Password')}
                    className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-600 shadow-inner"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Animated Error Message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  className="overflow-hidden"
                >
                  <p className="text-red-400 text-xs font-bold bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                    {errorMsg}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            <button 
              disabled={loading}
              className="w-full bg-orange-600 text-white font-extrabold py-4 rounded-xl mt-6 hover:bg-orange-500 active:scale-95 transition-all shadow-[0_0_20px_rgba(234,88,12,0.3)] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading 
                ? (isLogin ? safeTranslate('auth.signingIn', 'Signing in...') : safeTranslate('auth.creatingAccount', 'Creating account...')) 
                : (isLogin ? safeTranslate('auth.signIn', 'Sign In') : safeTranslate('auth.signUp', 'Sign Up'))}
            </button>
          </form>

          {/* Toggle between Login and Signup */}
          <div className="mt-8 text-center">
            <p className="text-zinc-500 text-sm font-medium">
              {isLogin ? safeTranslate('auth.noAccount', "Don't have an account?") : safeTranslate('auth.hasAccount', 'Already have an account?')}{" "}
              <button 
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrorMsg("");
                }}
                className="text-orange-500 font-bold hover:text-orange-400 transition-colors"
              >
                {isLogin ? safeTranslate('auth.signUp', 'Sign Up') : safeTranslate('auth.signIn', 'Sign In')}
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}