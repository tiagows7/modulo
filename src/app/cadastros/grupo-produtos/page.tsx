"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import {
  CadastroField,
  CadastroFormActions,
  CadastroFormError,
  CadastroModal,
  CadastroRowActions,
} from "@/components/CadastroUi";
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
        err instanceof Error ? err.message : "Falha ao excluir o grupo.",
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
      <CadastroRowActions
        disabled={busy}
        onEdit={() => openEdit(item)}
        onDelete={() => openDelete(item)}
      />
    ),
  }));

  return (
    <>
      {loadError ? (
        <div className="cadastro-alert">Erro ao carregar grupo_produtos: {loadError}</div>
      ) : null}

      {actionError && !deleting ? (
        <div className="cadastro-alert">{actionError}</div>
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
        <CadastroModal
          title={editing ? "Editar Grupo de Produtos" : "Novo Grupo de Produtos"}
          titleId="grupo-produto-title"
          subtitle={
            editing ? (
              <>
                Código: <strong style={{ color: "var(--text-secondary)" }}>{editing.codigo}</strong>
              </>
            ) : undefined
          }
          onClose={closeModal}
          disabled={busy}
          width={420}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions onCancel={closeModal} disabled={busy} busy={busy} />
          }
        >
          <CadastroField label="Descrição" htmlFor="grupo-descricao">
            <input
              id="grupo-descricao"
              name="descricao"
              className="input-base input-compact"
              placeholder="Ex.: Combustíveis, Conveniência..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              autoFocus
              maxLength={100}
              required
              disabled={busy}
            />
          </CadastroField>
          <CadastroFormError message={formError} />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir grupo"
          titleId="grupo-produto-delete-title"
          onClose={closeDelete}
          disabled={busy}
          width={400}
          footer={
            <CadastroFormActions
              onCancel={closeDelete}
              disabled={busy}
              busy={busy}
              danger
              submitLabel="Excluir"
              busyLabel="Excluindo..."
              onConfirm={() => void handleDelete()}
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.45 }}>
            Confirma a exclusão de{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.codigo} — {deleting.descricao}
            </strong>
            ?
          </p>
          <CadastroFormError message={actionError} />
        </CadastroModal>
      ) : null}
    </>
  );
}
