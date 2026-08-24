"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthProfile } from "@/lib/authRole";

/**
 * Protege /cadastros/filiais — somente Super Admin.
 */
export default function FiliaisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { ready, isSuperAdmin } = useAuthProfile();

  useEffect(() => {
    if (!ready) return;
    if (!isSuperAdmin) {
      router.replace("/cadastros");
    }
  }, [ready, isSuperAdmin, router]);

  if (!ready) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Verificando permissão…
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div
        style={{
          padding: 24,
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        Acesso restrito ao Super Admin.
      </div>
    );
  }

  return <>{children}</>;
}
