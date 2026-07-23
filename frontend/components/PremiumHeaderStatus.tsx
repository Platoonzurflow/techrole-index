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

  if (!premium) return null;

  return (
    <Link href="/account" className="header-premium-status hidden lg:inline-flex" aria-label="Premium активен">
      <Crown size={15} aria-hidden="true" />
      Premium активен
    </Link>
  );
}
