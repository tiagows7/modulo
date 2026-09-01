"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { Search, Plus, Filter, Download, ArrowLeft } from "lucide-react";
import { useSuppressGhostClick } from "@/lib/useSuppressGhostClick";

interface Column {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
}

interface ModulePageProps {
  title: string;
  description: string;
  icon: ReactNode;
  columns: Column[];
  rows: Record<string, ReactNode>[];
  addLabel?: string;
  backUrl?: string;
  onAdd?: () => void;
  /** Conteúdo extra na barra de busca (ex.: select de filial). */
  filters?: ReactNode;
  /**
   * Onde ficam Exportar + botão principal.
   * `search` = mesma linha do campo Buscar (ex.: digitação de notas).
   */
  actionsPlacement?: "header" | "search";
  /** Desabilita Exportar / botão principal (ex.: durante consulta). */
  actionsDisabled?: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export function ModulePage({
  title,
  description,
  icon,
  columns,
  rows,
  addLabel = "Novo",
  backUrl,
  onAdd,
  filters,
  actionsPlacement = "header",
  actionsDisabled = false,
}: ModulePageProps) {
  const [search, setSearch] = useState("");
  const interactive = useSuppressGhostClick(450);
  const actionsInSearch = actionsPlacement === "search";

  const filtered = rows.filter((row) =>
    Object.values(row).some((v) =>
      String(v).toLowerCase().includes(search.toLowerCase())
    )
  );

  const actionButtons = (
    <>
      <motion.button
        type="button"
        whileHover={actionsDisabled ? undefined : { scale: 1.03, y: -1 }}
        whileTap={actionsDisabled ? undefined : { scale: 0.97 }}
        disabled={actionsDisabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          padding: "9px 16px",
          height: 40,
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          color: "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 500,
          cursor: actionsDisabled ? "not-allowed" : "pointer",
          opacity: actionsDisabled ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <Download size={14} /> Exportar
      </motion.button>
      <motion.button
        type="button"
        id={`btn-add-${title.toLowerCase().replace(/\s/g, "-")}`}
        whileHover={actionsDisabled || !onAdd ? undefined : { scale: 1.03, y: -1 }}
        whileTap={actionsDisabled || !onAdd ? undefined : { scale: 0.97 }}
        className="btn-primary"
        disabled={actionsDisabled || !onAdd}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          height: 40,
          flexShrink: 0,
          opacity: actionsDisabled || !onAdd ? 0.65 : 1,
          cursor: actionsDisabled || !onAdd ? "not-allowed" : "pointer",
        }}
        onClick={onAdd}
      >
        <Plus size={15} /> {addLabel}
      </motion.button>
    </>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        pointerEvents: interactive ? "auto" : "none",
      }}
    >
      {/* Header */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        className="module-page-header"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          {backUrl && (
            <Link href={backUrl} style={{ textDecoration: "none", flexShrink: 0 }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={20} />
              </motion.button>
            </Link>
          )}
          <div
            style={{
              width: 46, height: 46, borderRadius: 12,
              background: "linear-gradient(135deg, rgba(26,111,216,0.3), rgba(13,59,142,0.2))",
              border: "1px solid rgba(74,159,232,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--blue-light)",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
              {title}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{description}</p>
          </div>
        </div>

        {!actionsInSearch ? (
          <div className="module-page-header-actions">{actionButtons}</div>
        ) : null}
      </motion.div>

      {/* Search & Filters (+ ações opcionais na mesma linha) */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={
          actionsInSearch
            ? "module-page-toolbar module-page-toolbar--with-actions"
            : "module-page-toolbar"
        }
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "nowrap",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: "1 1 200px",
            maxWidth: actionsInSearch ? 320 : 380,
            minWidth: 160,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Search
            size={15}
            aria-hidden
            style={{
              position: "absolute",
              left: 12,
              top: 0,
              bottom: 0,
              margin: "auto 0",
              color: "var(--text-muted)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
          <input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base"
            style={{ paddingLeft: 38, width: "100%", height: 40 }}
          />
        </div>
        {!filters ? (
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 16px",
              height: 40,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Filter size={14} /> Filtros
          </motion.button>
        ) : null}
        {filters ? (
          <div
            className="module-page-toolbar-filters"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "nowrap",
              flex: "1 1 auto",
              minWidth: 0,
              overflowX: "auto",
            }}
          >
            {filters}
          </div>
        ) : null}
        {actionsInSearch ? (
          <div
            className="module-page-toolbar-actions"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexShrink: 0,
              marginLeft: "auto",
            }}
          >
            {actionButtons}
          </div>
        ) : null}
      </motion.div>

      {/* Table */}
      <motion.div
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} style={{ textAlign: col.align ?? "left" }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.04, duration: 0.3 }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} style={{ textAlign: col.align ?? "left" }}>
                        {row[col.key]}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            fontSize: 12, color: "var(--text-muted)",
          }}
        >
          <span>{filtered.length} registro(s) encontrado(s)</span>
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3].map((p) => (
              <motion.button
                key={p}
                whileHover={{ scale: 1.1 }}
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: p === 1 ? "var(--blue-bright)" : "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  color: p === 1 ? "white" : "var(--text-muted)",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {p}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
