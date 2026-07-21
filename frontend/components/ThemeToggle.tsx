"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const enabled = localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && matchMedia("(prefers-color-scheme: dark)").matches);
    const frame = requestAnimationFrame(() => {
      setDark(enabled);
      document.documentElement.classList.toggle("dark", enabled);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
