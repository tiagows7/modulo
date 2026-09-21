"use client";

import { useCallback, useEffect, useState } from "react";

const WAKE_URL = "http://127.0.0.1:39200/wake";
const HEALTH_URL = "http://127.0.0.1:39199/__local/health";
const HANDOFF_BASE = "http://127.0.0.1:39199/pdv-auth-handoff";
const MAX_WAIT_MS = 20000;
const POLL_MS = 800;
const FORCE_REDIRECT_AFTER_MS = 6000;

type Phase = "session" | "waking" | "waiting" | "redirect" | "error";

/**
 * Fluxo oficial do caixa:
 * 1) Login na Vercel
 * 2) Esta página acorda o watchdog local (:39200) → sobe pontes + proxy :39199
 * 3) Transfere a sessão e abre o PDV local
 *
 * Se o Chrome bloquear fetch Vercel→localhost (Private Network Access),
 * após alguns segundos redireciona direto para o handoff local (navegação
 * same-tab não depende de CORS).
 */
export default function PdvLaunchPage() {
  const [phase, setPhase] = useState<Phase>("session");
  const [detail, setDetail] = useState("Lendo sessão…");
  const [sessionRaw, setSessionRaw] = useState<string | null>(null);

  const goHandoff = useCallback((session: string) => {
    setPhase("redirect");
    setDetail("Abrindo PDV local…");
    window.location.replace(
      `${HANDOFF_BASE}#${encodeURIComponent(session)}`,
    );
  }, []);

  const wakeAndWait = useCallback(
    async (session: string) => {
      setPhase("waking");
      setDetail("Pedindo ao PC do posto para subir as pontes…");

      try {
        await fetch(WAKE_URL, {
          method: "POST",
          mode: "cors",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
      } catch {
        setDetail(
          "Agente local (39200) offline. Tentando o proxy 39199…",
        );
      }

      setPhase("waiting");
      const started = Date.now();
      let forced = false;

      while (Date.now() - started < MAX_WAIT_MS) {
        const elapsed = Date.now() - started;
        setDetail(
          forced
            ? "Abrindo PDV local…"
            : `Aguardando proxy local (39199)… (${Math.ceil(elapsed / 1000)}s)`,
        );

        // Após alguns segundos, navega direto (evita bloqueio CORS/PNA do Chrome).
        if (!forced && elapsed >= FORCE_REDIRECT_AFTER_MS) {
          forced = true;
          goHandoff(session);
          return;
        }

        try {
          const res = await fetch(HEALTH_URL, {
            method: "GET",
            mode: "cors",
            cache: "no-store",
          });
          if (res.ok) {
            const body = (await res.json().catch(() => null)) as {
              ok?: boolean;
            } | null;
            if (body?.ok) {
              goHandoff(session);
              return;
            }
          }
        } catch {
          /* retry — comum se Chrome bloquear Private Network Access */
        }
        await new Promise((r) => window.setTimeout(r, POLL_MS));
      }

      // Última tentativa: abre o handoff mesmo assim (proxy pode estar no ar).
      goHandoff(session);
    },
    [goHandoff],
  );

  useEffect(() => {
    try {
      const fromHash = decodeURIComponent(
        (window.location.hash || "").replace(/^#/, ""),
      );
      if (!fromHash) {
        setPhase("error");
        setDetail("Sessão não encontrada. Faça login novamente na Vercel.");
        return;
      }
      const parsed = JSON.parse(fromHash) as { access_token?: string };
      if (!parsed?.access_token) {
        setPhase("error");
        setDetail("Sessão inválida. Faça login novamente.");
        return;
      }
      setSessionRaw(fromHash);
      void wakeAndWait(fromHash);
    } catch {
      setPhase("error");
      setDetail("Falha ao ler a sessão. Faça login novamente.");
    }
  }, [wakeAndWait]);

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
      <div style={{ maxWidth: 480 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>
          Abrindo PDV do posto
        </h1>
        <p style={{ margin: 0, color: "#b7c3d6", lineHeight: 1.5 }}>{detail}</p>
        {phase === "error" ? (
          <div style={{ marginTop: 20 }}>
            <pre
              style={{
                textAlign: "left",
                background: "#132238",
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                overflow: "auto",
              }}
            >
              {`npm run posto:autostart
# ou, manualmente:
npm run posto

# PDV local direto:
http://127.0.0.1:39199/pdv`}
            </pre>
            <button
              type="button"
              style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
              onClick={() => {
                if (sessionRaw) void wakeAndWait(sessionRaw);
                else window.location.href = "/";
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
        {phase === "waiting" && sessionRaw ? (
          <button
            type="button"
            style={{
              marginTop: 20,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #3b82f6",
              background: "transparent",
              color: "#93c5fd",
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => goHandoff(sessionRaw)}
          >
            Abrir PDV agora
          </button>
        ) : null}
      </div>
    </div>
  );
}
