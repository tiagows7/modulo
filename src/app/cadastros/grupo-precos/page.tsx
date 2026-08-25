"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BadgeDollarSign, Plus, Trash2 } from "lucide-react";
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

type TipoPreco = "percentual" | "unitario" | "centavos";

type GrupoPreco = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: TipoPreco | string | null;
  status: string | null;
};

type ProdutoOpt = {
  id: string;
  codigo: string;
  descricao: string;
  preco_venda: number | null;
};

type ItemForm = {
  key: string;
  id?: string;
  produto_id: string;
  preco: string;
};

const TIPO_OPTIONS: { value: TipoPreco; label: string; hint: string }[] = [
  {
    value: "unitario",
    label: "Valor unitário",
    hint: "Define o preço final em R$ para cada produto.",
  },
  {
    value: "percentual",
    label: "Percentual",
    hint: "Aplica % sobre o preço de tabela (ex.: -5 = 5% de desconto).",
  },
  {
    value: "centavos",
    label: "Centavos",
    hint: "Soma ou subtrai centavos do preço de tabela (ex.: -5 = R$ 0,05 a menos).",
  },
];

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição" },
  { key: "tipo", label: "Tipo" },
  { key: "itens", label: "Produtos", align: "center" as const },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function normalizeTipo(value: string | null | undefined): TipoPreco {
  if (value === "percentual" || value === "centavos") return value;
  return "unitario";
}

function tipoLabel(tipo: TipoPreco) {
  return TIPO_OPTIONS.find((o) => o.value === tipo)?.label ?? "Valor unitário";
}

function valorLabel(tipo: TipoPreco) {
  if (tipo === "percentual") return "Percentual (%)";
  if (tipo === "centavos") return "Centavos";
  return "Preço (R$)";
}

function valorPlaceholder(tipo: TipoPreco) {
  if (tipo === "percentual") return "-5";
  if (tipo === "centavos") return "-5";
  return "0,00";
}

function emptyItem(produtoId = "", preco = ""): ItemForm {
  return { key: crypto.randomUUID(), produto_id: produtoId, preco };
}

/** Unitário: >= 0. Percentual/centavos: qualquer número finito (permite desconto). */
function parseValor(value: string, tipo: TipoPreco): number | null {
  const n = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(n)) return null;
  if (tipo === "unitario" && n < 0) return null;
  return n;
}

async function nextCodigo() {
  const { data } = await supabase
    .from("grupo_precos")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `GPR-${String(max + 1).padStart(3, "0")}`;
}

function produtoLabel(p: ProdutoOpt) {
  return `${p.codigo} — ${p.descricao}`;
}

export default function GrupoPrecosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<GrupoPreco[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GrupoPreco | null>(null);
  const [deleting, setDeleting] = useState<GrupoPreco | null>(null);
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<TipoPreco>("unitario");
  const [status, setStatus] = useState("ativo");
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const [gruposRes, produtosRes, itensRes] = await Promise.all([
        supabase
          .from("grupo_precos")
          .select("id, codigo, descricao, tipo, status")
          .order("created_at", { ascending: false }),
        supabase
          .from("produtos")
          .select("id, codigo, descricao, preco_venda")
          .eq("status", "ativo")
          .order("descricao"),
        supabase.from("grupo_precos_itens").select("grupo_id"),
      ]);

      if (gruposRes.error) {
        setLoadError(gruposRes.error.message);
        setItems([]);
        return;
      }

      setItems((gruposRes.data ?? []) as GrupoPreco[]);
      setProdutos((produtosRes.data ?? []) as ProdutoOpt[]);

      const counts: Record<string, number> = {};
      for (const row of itensRes.data ?? []) {
        const gid = String((row as { grupo_id: string }).grupo_id);
        counts[gid] = (counts[gid] ?? 0) + 1;
      }
      setItemCounts(counts);
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setDescricao("");
    setTipo("unitario");
    setStatus("ativo");
    setItens([emptyItem()]);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = async (item: GrupoPreco) => {
    setEditing(item);
    setDescricao(item.descricao);
    setTipo(normalizeTipo(item.tipo));
    setStatus(item.status === "inativo" ? "inativo" : "ativo");
    setFormError("");
    setActionError("");
    setItens([emptyItem()]);
    setModalOpen(true);

    const { data, error } = await supabase
      .from("grupo_precos_itens")
      .select("id, produto_id, preco")
      .eq("grupo_id", item.id)
      .order("created_at");

    if (error) {
      setFormError(error.message);
      return;
    }

    const rows = (data ?? []) as {
      id: string;
      produto_id: string;
      preco: number;
    }[];
    setItens(
      rows.length
        ? rows.map((r) => ({
            key: r.id,
            id: r.id,
            produto_id: r.produto_id,
            preco: String(r.preco ?? ""),
          }))
        : [emptyItem()],
    );
  };

  const openDelete = (item: GrupoPreco) => {
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

  const updateItem = (key: string, patch: Partial<ItemForm>) => {
    setItens((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (
          tipo === "unitario" &&
          patch.produto_id &&
          patch.produto_id !== row.produto_id
        ) {
          const prod = produtos.find((p) => p.id === patch.produto_id);
          if (prod && !row.preco.trim()) {
            next.preco =
              prod.preco_venda != null ? String(prod.preco_venda) : "";
          }
        }
        return next;
      }),
    );
  };

  const addItem = () => setItens((prev) => [...prev, emptyItem()]);

  const removeItem = (key: string) => {
    setItens((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [emptyItem()];
    });
  };

  const syncItens = async (grupoId: string) => {
    const valid = itens
      .map((row) => {
        const preco = parseValor(row.preco, tipo);
        return {
          ...row,
          produto_id: row.produto_id.trim(),
          precoNum: preco,
        };
      })
      .filter((row) => row.produto_id && row.precoNum != null);

    const produtoIds = valid.map((r) => r.produto_id);
    if (new Set(produtoIds).size !== produtoIds.length) {
      throw new Error("Há produto repetido na lista de preços.");
    }

    const { data: existentes, error: loadErr } = await supabase
      .from("grupo_precos_itens")
      .select("id, produto_id")
      .eq("grupo_id", grupoId);
    if (loadErr) throw new Error(loadErr.message);

    const keepIds = new Set(
      valid.map((r) => r.id).filter(Boolean) as string[],
    );
    const toDelete = (existentes ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keepIds.has(id));

    if (toDelete.length) {
      const { error } = await supabase
        .from("grupo_precos_itens")
        .delete()
        .in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    for (const row of valid) {
      if (row.id) {
        const { error } = await supabase
          .from("grupo_precos_itens")
          .update({ produto_id: row.produto_id, preco: row.precoNum })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("grupo_precos_itens").insert({
          grupo_id: grupoId,
          produto_id: row.produto_id,
          preco: row.precoNum,
        });
        if (error) throw new Error(error.message);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const desc = descricao.trim();
    if (!desc) {
      setFormError("Informe a descrição do grupo.");
      return;
    }

    for (const row of itens) {
      const hasProduto = Boolean(row.produto_id.trim());
      const hasPreco = Boolean(row.preco.trim());
      if (!hasProduto && !hasPreco) continue;
      if (!hasProduto) {
        setFormError("Selecione o produto em todas as linhas preenchidas.");
        return;
      }
      if (parseValor(row.preco, tipo) == null) {
        setFormError(
          tipo === "unitario"
            ? "Informe um preço unitário válido (>= 0) para cada produto."
            : `Informe um valor válido de ${valorLabel(tipo).toLowerCase()} para cada produto.`,
        );
        return;
      }
    }

    setFormError("");

    try {
      await gravar(async () => {
        let grupoId = editing?.id ?? "";
        const payload = {
          descricao: desc,
          tipo,
          status: status === "inativo" ? "inativo" : "ativo",
        };
        if (editing) {
          const { error } = await supabase
            .from("grupo_precos")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { data, error } = await supabase
            .from("grupo_precos")
            .insert({ ...payload, codigo })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          grupoId = data.id as string;
        }

        await syncItens(grupoId);
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
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("grupo_preco_id", deleting.id);
        if (linkErr) throw new Error(linkErr.message);
        if ((count ?? 0) > 0) {
          throw new Error(
            `Não é possível excluir: há ${count} cliente(s) vinculados. Desative o grupo ou troque o grupo nos clientes.`,
          );
        }

        const { error } = await supabase
          .from("grupo_precos")
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

  const tipoHint =
    TIPO_OPTIONS.find((o) => o.value === tipo)?.hint ??
    TIPO_OPTIONS[0].hint;

  const rows = items.map((item) => {
    const t = normalizeTipo(item.tipo);
    return {
      codigo: item.codigo,
      descricao: item.descricao,
      tipo: tipoLabel(t),
      itens: itemCounts[item.id] ?? 0,
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
          onEdit={() => void openEdit(item)}
          onDelete={() => openDelete(item)}
        />
      ),
    };
  });

  const produtosUsados = new Set(
    itens.map((r) => r.produto_id).filter(Boolean),
  );

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar grupo de preços: ${loadError}`}
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
        title="Grupo de Preços"
        description="Preços diferenciados por cliente"
        icon={<BadgeDollarSign size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Grupo"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Grupo de Preços" : "Novo Grupo de Preços"}
          titleId="grupo-preco-title"
          subtitle={
            editing ? (
              <>
                Código:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.codigo}
                </strong>
              </>
            ) : (
              "Escolha o tipo de preço e informe os valores por produto."
            )
          }
          onClose={closeModal}
          disabled={busy}
          width={680}
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
            <CadastroField label="Descrição" htmlFor="gpr-descricao" span={2}>
              <input
                id="gpr-descricao"
                className="input-base input-compact"
                placeholder="Ex.: Frota empresa, Posto próprio..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                autoFocus
                maxLength={100}
                required
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Tipo de preço" htmlFor="gpr-tipo" span={2}>
              <select
                id="gpr-tipo"
                className="input-base input-compact"
                value={tipo}
                onChange={(e) => setTipo(normalizeTipo(e.target.value))}
                disabled={busy}
              >
                {TIPO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                {tipoHint}
              </div>
            </CadastroField>
            <CadastroField label="Status" htmlFor="gpr-status">
              <select
                id="gpr-status"
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

          <div className="cadastro-options-panel" style={{ marginTop: 14 }}>
            <div
              className="cadastro-options-title"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span>Valores por produto</span>
              <button
                type="button"
                className="cadastro-btn-edit"
                onClick={addItem}
                disabled={busy}
              >
                <Plus size={12} />
                Adicionar
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {itens.map((row, idx) => (
                <div
                  key={row.key}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px 36px",
                    gap: 8,
                    alignItems: "end",
                  }}
                >
                  <CadastroField
                    label={idx === 0 ? "Produto" : ""}
                    htmlFor={`gpr-prod-${row.key}`}
                  >
                    <select
                      id={`gpr-prod-${row.key}`}
                      className="input-base input-compact"
                      value={row.produto_id}
                      onChange={(e) =>
                        updateItem(row.key, { produto_id: e.target.value })
                      }
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {produtos.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={
                            produtosUsados.has(p.id) &&
                            row.produto_id !== p.id
                          }
                        >
                          {produtoLabel(p)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>
                  <CadastroField
                    label={idx === 0 ? valorLabel(tipo) : ""}
                    htmlFor={`gpr-preco-${row.key}`}
                  >
                    <input
                      id={`gpr-preco-${row.key}`}
                      className="input-base input-compact"
                      inputMode="decimal"
                      placeholder={valorPlaceholder(tipo)}
                      value={row.preco}
                      onChange={(e) =>
                        updateItem(row.key, { preco: e.target.value })
                      }
                      disabled={busy}
                    />
                  </CadastroField>
                  <button
                    type="button"
                    className="cadastro-btn-delete"
                    style={{ height: 34, padding: "0 8px" }}
                    onClick={() => removeItem(row.key)}
                    disabled={busy}
                    title="Remover"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <CadastroFormError message={formError} onClose={() => setFormError("")} />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir grupo de preços"
          titleId="grupo-preco-delete-title"
          onClose={closeDelete}
          disabled={busy}
          width={420}
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
          <CadastroFormError message={actionError} onClose={() => setActionError("")} />
        </CadastroModal>
      ) : null}
    </>
  );
}
