"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";

export type DbStatus = "idle" | "pesquisando" | "gravando" | "consultando";

type DbStatusContextValue = {
  status: DbStatus;
  busy: boolean;
  setStatus: (status: DbStatus) => void;
  /** Exibe "Pesquisando…" enquanto executa a função. */
  pesquisar: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Exibe "Gravando…" enquanto executa a função. */
  gravar: <T>(fn: () => Promise<T>) => Promise<T>;
  /** Exibe "Consultando…" enquanto executa a função. */
  consultar: <T>(fn: () => Promise<T>) => Promise<T>;
};

const DbStatusContext = createContext<DbStatusContextValue | null>(null);

function statusCopy(status: DbStatus) {
  if (status === "pesquisando") {
    return {
      title: "Pesquisando",
      message: "Pesquisando no banco de dados…",
    };
  }
  if (status === "gravando") {
    return {
      title: "Gravando",
      message: "Gravando no banco de dados…",
    };
  }
  if (status === "consultando") {
    return {
      title: "Consultando",
      message: "Consultando CNPJ…",
    };
  }
  return null;
}

function DbStatusOverlay({ status }: { status: DbStatus }) {
  const copy = statusCopy(status);

  return (
    <AnimatePresence>
      {copy ? (
        <motion.div
          key={status}
          role="status"
          aria-live="polite"
          aria-busy="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(6, 13, 26, 0.72)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: "min(360px, 100%)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: 18,
              padding: "28px 24px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                border: "3px solid rgba(74,159,232,0.25)",
                borderTopColor: "var(--blue-light)",
              }}
            />
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  marginBottom: 6,
                }}
              >
                {copy.title}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                {copy.message}
              </div>
            </div>
            <motion.div
              style={{
                width: "100%",
                height: 4,
                borderRadius: 999,
                background: "rgba(74,159,232,0.15)",
                overflow: "hidden",
              }}
            >
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  width: "45%",
                  height: "100%",
                  borderRadius: 999,
                  background:
                    "linear-gradient(90deg, transparent, var(--blue-light), transparent)",
                }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function DbStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DbStatus>("idle");

  const runWithStatus = useCallback(
    async <T,>(next: Exclude<DbStatus, "idle">, fn: () => Promise<T>) => {
      setStatus(next);
      try {
        return await fn();
      } finally {
        setStatus("idle");
      }
    },
    [],
  );

  const pesquisar = useCallback(
    <T,>(fn: () => Promise<T>) => runWithStatus("pesquisando", fn),
    [runWithStatus],
  );

  const gravar = useCallback(
    <T,>(fn: () => Promise<T>) => runWithStatus("gravando", fn),
    [runWithStatus],
  );

  const consultar = useCallback(
    <T,>(fn: () => Promise<T>) => runWithStatus("consultando", fn),
    [runWithStatus],
  );

  const value = useMemo<DbStatusContextValue>(
    () => ({
      status,
      busy: status !== "idle",
      setStatus,
      pesquisar,
      gravar,
      consultar,
    }),
    [status, pesquisar, gravar, consultar],
  );

  return (
    <DbStatusContext.Provider value={value}>
      {children}
      <DbStatusOverlay status={status} />
    </DbStatusContext.Provider>
  );
}

export function useDbStatus() {
  const ctx = useContext(DbStatusContext);
  if (!ctx) {
    throw new Error("useDbStatus deve ser usado dentro de DbStatusProvider.");
  }
  return ctx;
}
