"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Layers } from "lucide-react";
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

type ComissaoOpt = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  valor: number;
};

type GrupoProduto = {
  id: string;
  codigo: string;
  descricao: string;
  status: string | null;
  grupocomissao_id: string | null;
  produto_grupocomissao?: {
    codigo: string;
    descricao: string;
    tipo: string;
    valor: number;
  } | null;
};

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição do Grupo" },
  { key: "comissao", label: "Grupo comissão" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function comissaoLabel(c: ComissaoOpt) {
  const sufixo =
    c.tipo === "valor"
      ? `R$ ${Number(c.valor).toFixed(2)}`
      : `${Number(c.valor).toFixed(2)}%`;
  return `${c.codigo} — ${c.descricao} (${sufixo})`;
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
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<GrupoProduto[]>([]);
  const [comissoes, setComissoes] = useState<ComissaoOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoProduto | null>(null);
  const [deleting, setDeleting] = useState<GrupoProduto | null>(null);
  const [descricao, setDescricao] = useState("");
  const [grupocomissaoId, setGrupocomissaoId] = useState("");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const [grupoRes, comRes] = await Promise.all([
        supabase
          .from("grupo_produtos")
          .select(
            `
            id, codigo, descricao, status, grupocomissao_id,
            produto_grupocomissao ( codigo, descricao, tipo, valor )
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("produto_grupocomissao")
          .select("id, codigo, descricao, tipo, valor")
          .order("codigo"),
      ]);

      if (grupoRes.error) {
        setLoadError(grupoRes.error.message);
        setItems([]);
        return;
      }

      const rows = (grupoRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          codigo: String(r.codigo ?? ""),
          descricao: String(r.descricao ?? ""),
          status: r.status != null ? String(r.status) : null,
          grupocomissao_id:
            r.grupocomissao_id != null ? String(r.grupocomissao_id) : null,
          produto_grupocomissao: asOne(
            r.produto_grupocomissao as
              | {
                  codigo: string;
                  descricao: string;
                  tipo: string;
                  valor: number;
                }
              | {
                  codigo: string;
                  descricao: string;
                  tipo: string;
                  valor: number;
                }[]
              | null,
          ),
        } satisfies GrupoProduto;
      });

      setItems(rows);
      setComissoes(
        (comRes.data ?? []).map((c) => ({
          id: String(c.id),
          codigo: String(c.codigo),
          descricao: String(c.descricao),
          tipo: String(c.tipo),
          valor: Number(c.valor) || 0,
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setDescricao("");
    setGrupocomissaoId(comissoes.length === 1 ? comissoes[0].id : "");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: GrupoProduto) => {
    setEditing(item);
    setDescricao(item.descricao);
    setGrupocomissaoId(item.grupocomissao_id ?? "");
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
        const { count: subCount, error: subErr } = await supabase
          .from("subgrupo_produtos")
          .select("id", { count: "exact", head: true })
          .eq("grupo_id", deleting.id);
        if (subErr) throw new Error(subErr.message);
        if ((subCount ?? 0) > 0) {
          throw new Error(
            `Não é possível excluir: há ${subCount} sub-grupo(s) vinculados. Remova ou altere os sub-grupos antes.`,
          );
        }

        const { count: prodCount, error: prodErr } = await supabase
          .from("produtos")
          .select("id", { count: "exact", head: true })
          .eq("grupo_id", deleting.id);
        if (prodErr) throw new Error(prodErr.message);
        if ((prodCount ?? 0) > 0) {
          throw new Error(
            `Não é possível excluir: há ${prodCount} produto(s) vinculados a este grupo.`,
          );
        }

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
    const payload = {
      descricao: desc,
      grupocomissao_id: grupocomissaoId || null,
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("grupo_produtos")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { error } = await supabase.from("grupo_produtos").insert({
            ...payload,
            codigo,
            status: "ativo",
          });
          if (error) throw new Error(error.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      setDescricao("");
      setGrupocomissaoId("");
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    }
  };

  const rows = items.map((item) => {
    const c = item.produto_grupocomissao;
    return {
      codigo: item.codigo,
      descricao: item.descricao,
      comissao: c ? `${c.codigo} — ${c.descricao}` : "—",
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
          message={`Erro ao carregar grupo_produtos: ${loadError}`}
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
                Código:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.codigo}
                </strong>
              </>
            ) : undefined
          }
          onClose={closeModal}
          disabled={busy}
          width={440}
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
            <CadastroField
              label="Descrição *"
              htmlFor="grupo-descricao"
              span="full"
            >
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

            <CadastroField
              label="Grupo de comissão"
              htmlFor="grupo-comissao"
              span="full"
            >
              <select
                id="grupo-comissao"
                className="input-base input-compact"
                value={grupocomissaoId}
                onChange={(e) => setGrupocomissaoId(e.target.value)}
                disabled={busy}
              >
                <option value="">— Sem comissão —</option>
                {comissoes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {comissaoLabel(c)}
                  </option>
                ))}
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
