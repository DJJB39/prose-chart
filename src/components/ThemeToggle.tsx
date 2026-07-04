import { useEffect, useState } from "react";

const KEY = "veritas-theme";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    const prefers = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial = saved ? saved === "dark" : Boolean(prefers);
    setDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { window.localStorage.setItem(KEY, next ? "dark" : "light"); } catch {}
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-2 border border-ink/20 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-ink transition-opacity hover:opacity-80"
      aria-label={dark ? "Switch to paper theme" : "Switch to ink theme"}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-ink" />
      {dark ? "Ink" : "Paper"}
    </button>
  );
}
