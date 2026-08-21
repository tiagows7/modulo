"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Layers, Pencil, Trash2, X } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import { supabase } from "@/lib/supabase";

type GrupoProduto = {
  id: string;
  codigo: string;
  descricao: string;
  status: string | null;
};

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
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<GrupoProduto[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoProduto | null>(null);
  const [deleting, setDeleting] = useState<GrupoProduto | null>(null);
  const [descricao, setDescricao] = useState("");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("grupo_produtos")
        .select("id, codigo, descricao, status")
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }
      setItems((data ?? []) as GrupoProduto[]);
    });
  }, [pesquisar]);

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
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: GrupoProduto) => {
    setDeleting(item);
    setActionError("");
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleting(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");

    try {
      await gravar(async () => {
        const { error } = await supabase
          .from("grupo_produtos")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });

      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Falha ao excluir o grupo.",
      );
    }
  };

  const closeModal = () => {
    if (busy) return;
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

    setFormError("");

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("grupo_produtos")
            .update({ descricao: desc })
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { error } = await supabase.from("grupo_produtos").insert({
            codigo,
            descricao: desc,
            status: "ativo",
          });
          if (error) throw new Error(error.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      setDescricao("");
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
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
      <div style={{ display: "inline-flex", gap: 8, justifyContent: "center" }}>
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
        <button
          type="button"
          onClick={() => openDelete(item)}
          disabled={busy}
          title="Excluir"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
            color: "#EF4444",
            fontSize: 12,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Trash2 size={13} />
          Excluir
        </button>
      </div>
    ),
  }));

  return (
    <>
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

      {actionError && !deleting ? (
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
          {actionError}
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
                disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
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
              <button type="submit" className="btn-primary" disabled={busy}>
                {busy ? "Aguarde..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleting ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="grupo-produto-delete-title"
          onClick={closeDelete}
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
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(420px, 100%)",
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
            <h2
              id="grupo-produto-delete-title"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Excluir grupo
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Confirma a exclusão de{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {deleting.codigo} — {deleting.descricao}
              </strong>
              ?
            </p>

            {actionError ? (
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
                {actionError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={closeDelete}
                disabled={busy}
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
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={busy}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "#EF4444",
                  color: "white",
                  cursor: busy ? "wait" : "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {busy ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
