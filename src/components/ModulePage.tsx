"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { Search, Plus, Filter, Download, ArrowLeft } from "lucide-react";

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
}: ModulePageProps) {
  const [search, setSearch] = useState("");

  const filtered = rows.filter((row) =>
    Object.values(row).some((v) =>
      String(v).toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {backUrl && (
            <Link href={backUrl} style={{ textDecoration: "none" }}>
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
            }}
          >
            {icon}
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.1 }}>
              {title}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{description}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <motion.button
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 16px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              color: "var(--text-secondary)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
            }}
          >
            <Download size={14} /> Exportar
          </motion.button>
          <motion.button
            type="button"
            id={`btn-add-${title.toLowerCase().replace(/\s/g, "-")}`}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="btn-primary"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            onClick={onAdd}
          >
            <Plus size={15} /> {addLabel}
          </motion.button>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        style={{ display: "flex", gap: 10 }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
          <Search
            size={15}
            style={{
              position: "absolute", left: 12, top: "50%",
              transform: "translateY(-50%)", color: "var(--text-muted)",
            }}
          />
          <input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 16px",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          <Filter size={14} /> Filtros
        </motion.button>
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
