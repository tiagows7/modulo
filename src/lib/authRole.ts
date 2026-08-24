"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Roles consideradas Super Admin no sistema. */
const SUPER_ADMIN_ROLES = new Set([
  "admin",
  "super_admin",
  "superadmin",
  "super-admin",
]);

export function isSuperAdminRole(
  role: string | null | undefined,
  email?: string | null,
): boolean {
  const r = String(role || "").trim().toLowerCase();
  if (SUPER_ADMIN_ROLES.has(r)) return true;
  const mail = String(email || "").trim().toLowerCase();
  // Conta padrão criada pelo scripts/createAdmin.mjs
  if (mail === "admin@modulo.com") return true;
  return false;
}

export type AuthProfile = {
  ready: boolean;
  email: string | null;
  role: string | null;
  isSuperAdmin: boolean;
};

/**
 * Lê a sessão atual do Supabase (localStorage) e indica se é Super Admin.
 */
export function useAuthProfile(): AuthProfile {
  const [profile, setProfile] = useState<AuthProfile>({
    ready: false,
    email: null,
    role: null,
    isSuperAdmin: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const user = data.user;
      const role = user?.user_metadata?.role
        ? String(user.user_metadata.role)
        : null;
      const email = user?.email ?? null;
      setProfile({
        ready: true,
        email,
        role,
        isSuperAdmin: isSuperAdminRole(role, email),
      });
    }

    void load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return profile;
}
