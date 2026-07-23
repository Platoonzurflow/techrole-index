"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { useEffect, useState } from "react";
import type { User } from "@/lib/types";

export function PremiumHeaderStatus() {
  const [premium, setPremium] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/me", { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<User> : null)
      .then((user) => {
        if (active) setPremium(user?.access_level === "premium");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <Link
      href={premium ? "/account" : "/pricing"}
      className={`header-premium-status inline-flex${premium ? " is-active" : ""}`}
      aria-label={premium ? "Premium активен" : "Premium"}
    >
      <Crown size={15} aria-hidden="true" />
      <span className="hidden sm:inline">{premium ? "Premium активен" : "Premium"}</span>
      <span className="sm:hidden">Premium</span>
    </Link>
  );
}
