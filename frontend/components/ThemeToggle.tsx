"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enabled = localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    const frame = requestAnimationFrame(() => {
      setDark(enabled);
      document.documentElement.classList.toggle("dark", enabled);
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button type="button" className="icon-button theme-toggle-button" onClick={toggle} disabled={!ready} aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}>
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
