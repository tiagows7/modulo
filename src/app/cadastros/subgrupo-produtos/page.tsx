"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { FolderTree } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import {
  CadastroField,
  CadastroFormActions,
  CadastroFormError,
  CadastroFormGrid,
  CadastroModal,
  CadastroRowActions,
} from "@/components/CadastroUi";
import { supabase } from "@/lib/supabase";

type GrupoOpt = {
  id: string;
  codigo: string;
  descricao: string;
};

type Subgrupo = {
  id: string;
  codigo: string;
  descricao: string;
  grupo_id: string;
  status: string | null;
  grupo_produtos?: { codigo: string; descricao: string } | null;
};

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição" },
  { key: "grupo", label: "Grupo" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function grupoLabel(g: GrupoOpt) {
  return `${g.codigo} — ${g.descricao}`;
}

async function nextCodigo() {
  const { data } = await supabase
    .from("subgrupo_produtos")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `SGR-${String(max + 1).padStart(3, "0")}`;
}

export default function SubgrupoProdutosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Subgrupo[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subgrupo | null>(null);
  const [deleting, setDeleting] = useState<Subgrupo | null>(null);
  const [descricao, setDescricao] = useState("");
  const [grupoId, setGrupoId] = useState("");
  const [status, setStatus] = useState("ativo");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const [subRes, grupoRes] = await Promise.all([
        supabase
          .from("subgrupo_produtos")
          .select(
            "id, codigo, descricao, grupo_id, status, grupo_produtos ( codigo, descricao )",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("grupo_produtos")
          .select("id, codigo, descricao")
          .eq("status", "ativo")
          .order("descricao"),
      ]);

      if (subRes.error) {
        setLoadError(subRes.error.message);
        setItems([]);
        return;
      }

      setItems((subRes.data ?? []) as Subgrupo[]);
      setGrupos((grupoRes.data ?? []) as GrupoOpt[]);
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setDescricao("");
    setGrupoId(grupos.length === 1 ? grupos[0].id : "");
    setStatus("ativo");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: Subgrupo) => {
    setEditing(item);
    setDescricao(item.descricao);
    setGrupoId(item.grupo_id);
    setStatus(item.status === "inativo" ? "inativo" : "ativo");
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: Subgrupo) => {
    setDeleting(item);
    setActionError("");
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleting(null);
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
      setFormError("Informe a descrição do sub-grupo.");
      return;
    }
    if (!grupoId) {
      setFormError("Selecione o grupo de produtos.");
      return;
    }

    setFormError("");
    const payload = {
      descricao: desc,
      grupo_id: grupoId,
      status: status === "inativo" ? "inativo" : "ativo",
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("subgrupo_produtos")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { error } = await supabase.from("subgrupo_produtos").insert({
            ...payload,
            codigo,
          });
          if (error) throw new Error(error.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");

    try {
      await gravar(async () => {
        const { count, error: linkErr } = await supabase
          .from("produtos")
          .select("id", { count: "exact", head: true })
          .eq("subgrupo_id", deleting.id);
        if (linkErr) throw new Error(linkErr.message);
        if ((count ?? 0) > 0) {
          throw new Error(
            `Não é possível excluir: há ${count} produto(s) vinculados a este sub-grupo.`,
          );
        }

        const { error } = await supabase
          .from("subgrupo_produtos")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });

      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o sub-grupo.",
      );
    }
  };

  const gruposParaSelect = (() => {
    if (!editing) return grupos;
    if (grupos.some((g) => g.id === editing.grupo_id)) return grupos;
    const g = editing.grupo_produtos;
    if (!g) return grupos;
    return [
      { id: editing.grupo_id, codigo: g.codigo, descricao: g.descricao },
      ...grupos,
    ];
  })();

  const rows = items.map((item) => {
    const g = item.grupo_produtos;
    return {
      codigo: item.codigo,
      descricao: item.descricao,
      grupo: g ? `${g.codigo} — ${g.descricao}` : "—",
      status: (
        <span
          className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}
        >
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
    };
  });

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar sub-grupos: ${loadError}`}
          onClose={() => setLoadError("")}
        />
      ) : null}

      {actionError && !deleting ? (
        <CadastroFormError
          message={actionError}
          onClose={() => setActionError("")}
        />
      ) : null}

      <ModulePage
        title="Sub-grupo de Produtos"
        description="Subcategorias vinculadas ao grupo de produtos"
        icon={<FolderTree size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Sub-grupo"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={
            editing ? "Editar Sub-grupo de Produtos" : "Novo Sub-grupo de Produtos"
          }
          titleId="subgrupo-produto-title"
          subtitle={
            editing ? (
              <>
                Código:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.codigo}
                </strong>
              </>
            ) : (
              "Vincule o sub-grupo a um grupo de produtos."
            )
          }
          onClose={closeModal}
          disabled={busy}
          width={480}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions
              onCancel={closeModal}
              disabled={busy}
              busy={busy}
            />
          }
        >
          <CadastroFormGrid>
            <CadastroField label="Grupo *" htmlFor="sgr-grupo" span="full">
              <select
                id="sgr-grupo"
                className="input-base input-compact"
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                disabled={busy}
                required
              >
                <option value="">— Selecione o grupo —</option>
                {gruposParaSelect.map((g) => (
                  <option key={g.id} value={g.id}>
                    {grupoLabel(g)}
                  </option>
                ))}
              </select>
            </CadastroField>
            <CadastroField label="Descrição *" htmlFor="sgr-descricao" span="full">
              <input
                id="sgr-descricao"
                className="input-base input-compact"
                placeholder="Ex.: Gasolina, Óleos, Conveniência..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                autoFocus
                maxLength={100}
                required
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Status" htmlFor="sgr-status">
              <select
                id="sgr-status"
                className="input-base input-compact"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={busy}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </CadastroField>
          </CadastroFormGrid>
          <CadastroFormError
            message={formError}
            onClose={() => setFormError("")}
          />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir sub-grupo"
          titleId="subgrupo-produto-delete-title"
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
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.45,
            }}
          >
            Confirma a exclusão de{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.codigo} — {deleting.descricao}
            </strong>
            ?
          </p>
          <CadastroFormError
            message={actionError}
            onClose={() => setActionError("")}
          />
        </CadastroModal>
      ) : null}
    </>
  );
}
