"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PDVLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
      } else {
        setLoadingSession(false);
      }
    });
  }, [router]);

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#e2e8f0' }}>
        Carregando...
      </div>
    );
  }

  return <>{children}</>;
}
