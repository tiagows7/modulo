"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Pencil, X } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

type GrupoProduto = {
  id: string;
  codigo: string;
  descricao: string;
  status: string | null;
};

type DbStatus = "idle" | "pesquisando" | "gravando";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição do Grupo" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

async function nextCodigo() {
  const { data } = await supabase
    .from("grupo_produtos")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `GRP-${String(max + 1).padStart(3, "0")}`;
}

export default function GrupoProdutosPage() {
  const [items, setItems] = useState<GrupoProduto[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>("pesquisando");
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoProduto | null>(null);
  const [descricao, setDescricao] = useState("");
  const [formError, setFormError] = useState("");

  const busy = dbStatus !== "idle";

  const loadData = useCallback(async () => {
    setDbStatus("pesquisando");
    setLoadError("");
    const { data, error } = await supabase
      .from("grupo_produtos")
      .select("id, codigo, descricao, status")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setItems([]);
    } else {
      setItems((data ?? []) as GrupoProduto[]);
    }
    setDbStatus("idle");
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setDescricao("");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: GrupoProduto) => {
    setEditing(item);
    setDescricao(item.descricao);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (dbStatus === "gravando") return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const desc = descricao.trim();
    if (!desc) {
      setFormError("Informe a descrição do grupo.");
      return;
    }

    setDbStatus("gravando");
    setFormError("");

    try {
      if (editing) {
        const { error } = await supabase
          .from("grupo_produtos")
          .update({ descricao: desc })
          .eq("id", editing.id);

        if (error) {
          setFormError(error.message);
          setDbStatus("idle");
          return;
        }
      } else {
        const codigo = await nextCodigo();
        const { error } = await supabase.from("grupo_produtos").insert({
          codigo,
          descricao: desc,
          status: "ativo",
        });

        if (error) {
          setFormError(error.message);
          setDbStatus("idle");
          return;
        }
      }

      setModalOpen(false);
      setEditing(null);
      setDescricao("");
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
      setDbStatus("idle");
    }
  };

  const rows = items.map((item) => ({
    codigo: item.codigo,
    descricao: item.descricao,
    status: (
      <span className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}>
        {item.status || "—"}
      </span>
    ),
    acoes: (
      <button
        type="button"
        onClick={() => openEdit(item)}
        disabled={busy}
        title="Editar"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 10px",
          borderRadius: 8,
          border: "1px solid var(--border-default)",
          background: "var(--bg-elevated)",
          color: "var(--blue-light)",
          fontSize: 12,
          fontWeight: 600,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Pencil size={13} />
        Editar
      </button>
    ),
  }));

  const statusLabel =
    dbStatus === "pesquisando"
      ? "Pesquisando no banco de dados…"
      : dbStatus === "gravando"
        ? "Gravando no banco de dados…"
        : "";

  return (
    <>
      <AnimatePresence>
        {statusLabel ? (
          <motion.div
            key={dbStatus}
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
              zIndex: 120,
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
                  {dbStatus === "pesquisando" ? "Pesquisando" : "Gravando"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {statusLabel}
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
                    background: "linear-gradient(90deg, transparent, var(--blue-light), transparent)",
                  }}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loadError ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#EF4444",
            fontSize: 13,
          }}
        >
          Erro ao carregar grupo_produtos: {loadError}
        </div>
      ) : null}

      <ModulePage
        title="Grupo de Produtos"
        description="Gerenciamento de categorias e grupos"
        icon={<Layers size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Grupo"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="grupo-produto-title"
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(6, 13, 26, 0.72)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              width: "min(440px, 100%)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2
                id="grupo-produto-title"
                style={{
                  margin: 0,
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                {editing ? "Editar Grupo de Produtos" : "Novo Grupo de Produtos"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar"
                disabled={dbStatus === "gravando"}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            {editing ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Código: <strong style={{ color: "var(--text-secondary)" }}>{editing.codigo}</strong>
              </div>
            ) : null}

            <div>
              <label
                htmlFor="grupo-descricao"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Descrição
              </label>
              <input
                id="grupo-descricao"
                name="descricao"
                className="input-base"
                placeholder="Ex.: Combustíveis, Conveniência..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                autoFocus
                maxLength={100}
                required
                disabled={dbStatus === "gravando"}
              />
            </div>

            {formError ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#EF4444",
                  fontSize: 13,
                }}
              >
                {formError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={dbStatus === "gravando"}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={dbStatus === "gravando"}>
                {dbStatus === "gravando" ? "Gravando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
