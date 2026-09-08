"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "sb-";
const POSTO_PDV = "http://127.0.0.1:39199/pdv#/venda";

/**
 * Recebe a sessão do login na nuvem (hash) e grava no origin local do proxy
 * para o PDV em http://127.0.0.1:39199 continuar autenticado.
 */
export default function PdvAuthHandoffPage() {
  const [message, setMessage] = useState("Preparando acesso ao PDV…");

  useEffect(() => {
    try {
      const raw = decodeURIComponent((window.location.hash || "").replace(/^#/, ""));
      if (!raw) {
        setMessage("Sessão não encontrada. Faça login novamente.");
        return;
      }

      const session = JSON.parse(raw) as { access_token?: string };
      if (!session?.access_token) {
        setMessage("Sessão inválida. Faça login novamente.");
        return;
      }

      const host = process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
        : "rdtnlowhhtsickbgxzyu";
      const key = `${STORAGE_PREFIX}${host}-auth-token`;
      sessionStorage.setItem(key, raw);

      window.location.replace(POSTO_PDV);
    } catch {
      setMessage("Falha ao transferir a sessão. Faça login novamente em http://127.0.0.1:39199/");
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b1424",
        color: "#e8edf5",
        fontFamily: "Segoe UI, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p>{message}</p>
    </div>
  );
}
