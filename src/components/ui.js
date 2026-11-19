"use client";
import { useEffect } from "react";
import { Minus, Plus, X } from "lucide-react";

// ---------- names & avatars ----------
export const displayName = (email, fallback = "Guest") => {
  if (!email) return fallback;
  return email.split("@")[0];
};

export function Avatar({ email, you = false, size = 40 }) {
  const initials = email ? email.substring(0, 2).toUpperCase() : "?";
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      className={`shrink-0 inline-flex items-center justify-center rounded-full font-bold ${
        you ? "bg-volt text-volt-ink" : email ? "bg-court-tint text-court-text" : "border border-dashed border-ink-3 text-ink-3"
      }`}
    >
      {email ? initials : "?"}
    </span>
  );
}

// ---------- page chrome ----------
export function PageHeader({ title, sub, action }) {
  return (
    <header className="flex items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="title">{title}</h1>
        {sub && <p className="muted mt-1 text-[0.9375rem]">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Page({ children, wide = false }) {
  return <main className={`w-full mx-auto px-4 pt-5 pb-8 md:px-8 md:pt-10 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>{children}</main>;
}

export function Loading({ text }) {
  return (
    <div className="min-h-[60dvh] flex flex-col items-center justify-center gap-3 muted">
      <span className="spinner" />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}

export function Empty({ children, action }) {
  return (
    <div className="panel px-5 py-8 text-center">
      <p className="muted">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---------- controls ----------
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Scoreboard-style score entry: big number, − / + buttons, number keypad still works. */
export function ScoreStepper({ value, onChange, label, readOnly = false }) {
  const n = value === "" ? 0 : Number(value);
  const set = (v) => onChange(String(Math.max(0, Math.min(50, v))));
  return (
    <div className="flex items-center gap-1">
      {!readOnly && (
        <button type="button" onClick={() => set(n - 1)} className="w-10 h-10 shrink-0 rounded-full bg-court-tint text-court-text flex items-center justify-center active:scale-95" aria-label={`${label} −1`}>
          <Minus size={18} />
        </button>
      )}
      <input
        aria-label={label}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="num w-[3.75rem] text-center text-[1.875rem] leading-none bg-transparent outline-none focus:text-court"
      />
      {!readOnly && (
        <button type="button" onClick={() => set(n + 1)} className="w-10 h-10 shrink-0 rounded-full bg-court text-white flex items-center justify-center active:scale-95" aria-label={`${label} +1`}>
          <Plus size={18} />
        </button>
      )}
    </div>
  );
}

// ---------- rating ----------
export const confidenceKey = (rd) => {
  const r = Number(rd ?? 0.5);
  if (r <= 0.2) return "rating.established";
  if (r <= 0.32) return "rating.settling";
  return "rating.provisional";
};

/** The signature element: your rating painted on a court. */
export function CourtRating({ rating, rd, caption, t }) {
  const value = Number(rating ?? 3.5).toFixed(3);
  const conf = Math.max(0, Math.min(1, (0.5 - Number(rd ?? 0.5)) / (0.5 - 0.15)));
  return (
    <section className="relative overflow-hidden rounded-[22px] bg-court text-white">
      {/* court markings: outer lines, net, kitchen lines, centre service line */}
      <svg aria-hidden className="absolute inset-0 w-full h-full" viewBox="0 0 400 220" preserveAspectRatio="none">
        <g fill="none" stroke="rgb(255 255 255 / .28)" strokeWidth="2.5">
          <rect x="14" y="14" width="372" height="192" />
          <line x1="200" y1="14" x2="200" y2="206" strokeWidth="4" stroke="rgb(255 255 255 / .38)" />
          <line x1="150" y1="14" x2="150" y2="206" />
          <line x1="250" y1="14" x2="250" y2="206" />
          <line x1="14" y1="110" x2="150" y2="110" />
          <line x1="250" y1="110" x2="386" y2="110" />
        </g>
        <rect x="151.5" y="15.5" width="97" height="189" fill="rgb(46 125 91 / .35)" />
      </svg>
      <div className="relative px-5 pt-5 pb-5 md:px-7 md:pt-7">
        <p className="text-[0.9375rem] text-white/80">{caption}</p>
        <p className="num text-[3.75rem] md:text-[4.5rem] leading-none mt-2 text-volt">{value}</p>
        <div className="mt-5 flex items-center gap-3">
          <div className="h-2 flex-1 max-w-48 rounded-full bg-white/20 overflow-hidden" aria-hidden>
            <div className="h-full rounded-full bg-volt" style={{ width: `${Math.round(conf * 100)}%` }} />
          </div>
          <span className="text-sm text-white/90">{t(confidenceKey(rd))}</span>
        </div>
      </div>
    </section>
  );
}

export function ResultTag({ win, t }) {
  return <span className={`tag ${win ? "tag-win" : "tag-loss"} min-w-[3.25rem] justify-center`}>{win ? t("common.win") : t("common.loss")}</span>;
}

export function Change({ value }) {
  if (value === null || value === undefined) return null;
  const v = Number(value);
  return (
    <span className={`num text-sm ${v >= 0 ? "text-win" : "text-loss"}`}>
      {v >= 0 ? "+" : "−"}
      {Math.abs(v).toFixed(3)}
    </span>
  );
}

// ---------- bottom sheet (dialog) ----------
export function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full md:max-w-md bg-surface rounded-t-[24px] md:rounded-[24px] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sheet-in">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h2 className="heading">{title}</h2>
          <button onClick={onClose} className="w-10 h-10 -mr-2 -mt-2 rounded-full flex items-center justify-center muted hover:bg-court-tint" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
