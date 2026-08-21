"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Layers, X } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
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
];

function mapRows(data: GrupoProduto[]) {
  return data.map((item) => ({
    codigo: item.codigo,
    descricao: item.descricao,
    status: (
      <span className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}>
        {item.status || "—"}
      </span>
    ),
  }));
}

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
  const [rows, setRows] = useState<ReturnType<typeof mapRows>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const { data, error } = await supabase
      .from("grupo_produtos")
      .select("id, codigo, descricao, status")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setRows([]);
    } else {
      setRows(mapRows((data ?? []) as GrupoProduto[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openModal = () => {
    setDescricao("");
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setFormError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const desc = descricao.trim();
    if (!desc) {
      setFormError("Informe a descrição do grupo.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const codigo = await nextCodigo();
      const { error } = await supabase.from("grupo_produtos").insert({
        codigo,
        descricao: desc,
        status: "ativo",
      });

      if (error) {
        setFormError(error.message);
        setSaving(false);
        return;
      }

      setModalOpen(false);
      setDescricao("");
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

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

      <ModulePage
        title="Grupo de Produtos"
        description={
          loading
            ? "Carregando grupos..."
            : "Gerenciamento de categorias e grupos"
        }
        icon={<Layers size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Grupo"
        backUrl="/cadastros"
        onAdd={openModal}
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
                Novo Grupo de Produtos
              </h2>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fechar"
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
                disabled={saving}
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
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
