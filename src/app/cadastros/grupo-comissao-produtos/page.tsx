"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Percent } from "lucide-react";
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

type GrupoComissao = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  valor: number;
};

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição" },
  { key: "tipo", label: "Tipo" },
  { key: "valor", label: "Valor", align: "right" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

async function nextCodigo() {
  const { data } = await supabase
    .from("produto_grupocomissao")
    .select("codigo")
    .order("codigo", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const n = Number(String(row.codigo ?? "").replace(/\D/g, ""));
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  const next = max + 1;
  if (next > 99) throw new Error("Limite de códigos atingido (01–99).");
  return String(next).padStart(2, "0");
}

function formatValor(tipo: string, valor: number) {
  if (tipo === "valor") {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  return `${Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

export default function GrupoComissaoProdutosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<GrupoComissao[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoComissao | null>(null);
  const [deleting, setDeleting] = useState<GrupoComissao | null>(null);
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"percentual" | "valor">("percentual");
  const [valor, setValor] = useState("0");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("produto_grupocomissao")
        .select("id, codigo, descricao, tipo, valor")
        .order("codigo", { ascending: true });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }
      setItems(
        (data ?? []).map((row) => ({
          id: String(row.id),
          codigo: String(row.codigo),
          descricao: String(row.descricao),
          tipo: String(row.tipo),
          valor: Number(row.valor) || 0,
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
    setTipo("percentual");
    setValor("0");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: GrupoComissao) => {
    setEditing(item);
    setDescricao(item.descricao);
    setTipo(item.tipo === "valor" ? "valor" : "percentual");
    setValor(String(item.valor ?? 0));
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: GrupoComissao) => {
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
      setFormError("Informe a descrição.");
      return;
    }
    if (desc.length > 30) {
      setFormError("A descrição deve ter no máximo 30 caracteres.");
      return;
    }
    const valorNum = Number(String(valor).trim().replace(",", "."));
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      setFormError("Informe um valor válido (>= 0).");
      return;
    }

    setFormError("");
    const payload = {
      descricao: desc,
      tipo,
      valor: valorNum,
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("produto_grupocomissao")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { error } = await supabase.from("produto_grupocomissao").insert({
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
        const checks = await Promise.all([
          supabase
            .from("grupo_produtos")
            .select("id", { count: "exact", head: true })
            .eq("grupocomissao_id", deleting.id),
          supabase
            .from("produtos")
            .select("id", { count: "exact", head: true })
            .eq("grupocomissao_id", deleting.id),
        ]);
        for (const res of checks) {
          if (res.error) throw new Error(res.error.message);
        }
        const total = (checks[0].count ?? 0) + (checks[1].count ?? 0);
        if (total > 0) {
          throw new Error(
            `Não é possível excluir: há ${total} vínculo(s) em grupo/produto.`,
          );
        }

        const { error } = await supabase
          .from("produto_grupocomissao")
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

  const rows = items.map((item) => ({
    codigo: item.codigo,
    descricao: item.descricao,
    tipo: item.tipo === "valor" ? "Valor" : "Percentual",
    valor: formatValor(item.tipo, item.valor),
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
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar grupos de comissão: ${loadError}`}
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
        title="Grupo de Comissão de Produtos"
        description="Comissões por percentual ou valor fixo"
        icon={<Percent size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Grupo"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={
            editing
              ? "Editar Grupo de Comissão"
              : "Novo Grupo de Comissão"
          }
          titleId="grupo-comissao-title"
          subtitle={
            editing ? (
              <>
                Código:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.codigo}
                </strong>
              </>
            ) : (
              "Código gerado automaticamente ao salvar"
            )
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
          {formError ? (
            <CadastroFormError
              message={formError}
              onClose={() => setFormError("")}
            />
          ) : null}

          <CadastroFormGrid>
            <CadastroField
              label="Descrição *"
              htmlFor="gc-descricao"
              span="full"
            >
              <input
                id="gc-descricao"
                className="input-base input-compact"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={busy}
                autoFocus
                maxLength={30}
                required
                placeholder="Ex.: Comissão padrão"
              />
            </CadastroField>

            <CadastroField label="Tipo *" htmlFor="gc-tipo">
              <select
                id="gc-tipo"
                className="input-base input-compact"
                value={tipo}
                onChange={(e) =>
                  setTipo(e.target.value === "valor" ? "valor" : "percentual")
                }
                disabled={busy}
              >
                <option value="percentual">Percentual</option>
                <option value="valor">Valor</option>
              </select>
            </CadastroField>

            <CadastroField
              label={tipo === "valor" ? "Valor (R$) *" : "Valor (%) *"}
              htmlFor="gc-valor"
            >
              <input
                id="gc-valor"
                className="input-base input-compact"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                disabled={busy}
                inputMode="decimal"
                required
              />
            </CadastroField>
          </CadastroFormGrid>
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir grupo de comissão"
          titleId="grupo-comissao-delete-title"
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
          {actionError ? (
            <CadastroFormError
              message={actionError}
              onClose={() => setActionError("")}
            />
          ) : null}
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
          >
            Confirma a exclusão de{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.codigo} — {deleting.descricao}
            </strong>
            ?
          </p>
        </CadastroModal>
      ) : null}
    </>
  );
}
