"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
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

type TabId = "geral" | "outras" | "contabil";

type Opt = { id: string; codigo: string; descricao: string };

type SubgrupoOpt = Opt & { grupo_id: string };

type Produto = {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  descricao: string;
  grupo_id: string | null;
  subgrupo_id: string | null;
  unidade_id: string | null;
  controla_estoque: boolean;
  categoria_icm_id: string | null;
  cfop_id: string | null;
  preco_venda: number | null;
  estoque_atual: number | null;
  status: string | null;
  observacao: string | null;
  conta_contabil: string | null;
  centro_custo: string | null;
  grupo_produtos?: { codigo: string; descricao: string } | null;
  subgrupo_produtos?: { codigo: string; descricao: string } | null;
  unidade_medida?: { codigo: string; descricao: string } | null;
  categorias_icm?: { codigo: number; descricao: string } | null;
  produto_cfop?: { codigo: string; descricao: string } | null;
};

type FormState = {
  codigo_barras: string;
  descricao: string;
  unidade_id: string;
  controla_estoque: "S" | "N";
  grupo_id: string;
  subgrupo_id: string;
  categoria_icm_id: string;
  cfop_id: string;
  preco_venda: string;
  estoque_atual: string;
  status: string;
  observacao: string;
  conta_contabil: string;
  centro_custo: string;
};

const emptyForm: FormState = {
  codigo_barras: "",
  descricao: "",
  unidade_id: "",
  controla_estoque: "S",
  grupo_id: "",
  subgrupo_id: "",
  categoria_icm_id: "",
  cfop_id: "",
  preco_venda: "0",
  estoque_atual: "0",
  status: "ativo",
  observacao: "",
  conta_contabil: "",
  centro_custo: "",
};

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "outras", label: "Outras informações" },
  { id: "contabil", label: "Contábil" },
];

const columns = [
  { key: "codigo", label: "Código" },
  { key: "barras", label: "Cód. barras" },
  { key: "descricao", label: "Descrição" },
  { key: "unidade", label: "Unidade" },
  { key: "grupo", label: "Grupo" },
  { key: "preco", label: "Preço (R$)", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function optLabel(o: { codigo: string | number; descricao: string }) {
  return `${o.codigo} — ${o.descricao}`;
}

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

async function nextCodigo() {
  const { data } = await supabase
    .from("produtos")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(80);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function parseMoney(raw: string) {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function ProdutosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Produto[]>([]);
  const [grupos, setGrupos] = useState<Opt[]>([]);
  const [subgrupos, setSubgrupos] = useState<SubgrupoOpt[]>([]);
  const [unidades, setUnidades] = useState<Opt[]>([]);
  const [categoriasIcm, setCategoriasIcm] = useState<
    { id: string; codigo: number; descricao: string }[]
  >([]);
  const [cfops, setCfops] = useState<Opt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState<Produto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tab, setTab] = useState<TabId>("geral");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const [
        prodRes,
        grupoRes,
        subRes,
        undRes,
        catRes,
        cfopRes,
      ] = await Promise.all([
        supabase
          .from("produtos")
          .select(
            `
            id, codigo, codigo_barras, descricao, grupo_id, subgrupo_id,
            unidade_id, controla_estoque, categoria_icm_id, cfop_id,
            preco_venda, estoque_atual, status, observacao,
            conta_contabil, centro_custo,
            grupo_produtos ( codigo, descricao ),
            subgrupo_produtos ( codigo, descricao ),
            unidade_medida ( codigo, descricao ),
            categorias_icm ( codigo, descricao ),
            produto_cfop ( codigo, descricao )
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("grupo_produtos")
          .select("id, codigo, descricao")
          .eq("status", "ativo")
          .order("descricao"),
        supabase
          .from("subgrupo_produtos")
          .select("id, codigo, descricao, grupo_id")
          .eq("status", "ativo")
          .order("descricao"),
        supabase
          .from("unidade_medida")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("categorias_icm")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("produto_cfop")
          .select("id, codigo, descricao")
          .order("codigo"),
      ]);

      if (prodRes.error) {
        setLoadError(prodRes.error.message);
        setItems([]);
        return;
      }

      const rows = (prodRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          codigo: String(r.codigo ?? ""),
          codigo_barras: r.codigo_barras != null ? String(r.codigo_barras) : null,
          descricao: String(r.descricao ?? ""),
          grupo_id: r.grupo_id != null ? String(r.grupo_id) : null,
          subgrupo_id: r.subgrupo_id != null ? String(r.subgrupo_id) : null,
          unidade_id: r.unidade_id != null ? String(r.unidade_id) : null,
          controla_estoque: Boolean(r.controla_estoque ?? true),
          categoria_icm_id:
            r.categoria_icm_id != null ? String(r.categoria_icm_id) : null,
          cfop_id: r.cfop_id != null ? String(r.cfop_id) : null,
          preco_venda: r.preco_venda != null ? Number(r.preco_venda) : 0,
          estoque_atual: r.estoque_atual != null ? Number(r.estoque_atual) : 0,
          status: r.status != null ? String(r.status) : "ativo",
          observacao: r.observacao != null ? String(r.observacao) : null,
          conta_contabil:
            r.conta_contabil != null ? String(r.conta_contabil) : null,
          centro_custo: r.centro_custo != null ? String(r.centro_custo) : null,
          grupo_produtos: asOne(
            r.grupo_produtos as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          subgrupo_produtos: asOne(
            r.subgrupo_produtos as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          unidade_medida: asOne(
            r.unidade_medida as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          categorias_icm: asOne(
            r.categorias_icm as
              | { codigo: number; descricao: string }
              | { codigo: number; descricao: string }[]
              | null,
          ),
          produto_cfop: asOne(
            r.produto_cfop as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
        } satisfies Produto;
      });

      setItems(rows);
      setGrupos((grupoRes.data ?? []) as Opt[]);
      setSubgrupos((subRes.data ?? []) as SubgrupoOpt[]);
      setUnidades((undRes.data ?? []) as Opt[]);
      setCategoriasIcm(
        (catRes.data ?? []).map((c) => ({
          id: String(c.id),
          codigo: Number(c.codigo),
          descricao: String(c.descricao),
        })),
      );
      setCfops((cfopRes.data ?? []) as Opt[]);
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const subgruposFiltrados = useMemo(() => {
    if (!form.grupo_id) return [];
    return subgrupos.filter((s) => s.grupo_id === form.grupo_id);
  }, [form.grupo_id, subgrupos]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "grupo_id") {
        const stillValid = subgrupos.some(
          (s) => s.grupo_id === value && s.id === prev.subgrupo_id,
        );
        if (!stillValid) next.subgrupo_id = "";
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    const undPadrao =
      unidades.find((u) => u.codigo.toUpperCase() === "UN")?.id ??
      (unidades.length === 1 ? unidades[0].id : "");
    setForm({
      ...emptyForm,
      unidade_id: undPadrao,
      grupo_id: grupos.length === 1 ? grupos[0].id : "",
    });
    setTab("geral");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: Produto) => {
    setEditing(item);
    setForm({
      codigo_barras: item.codigo_barras ?? "",
      descricao: item.descricao,
      unidade_id: item.unidade_id ?? "",
      controla_estoque: item.controla_estoque ? "S" : "N",
      grupo_id: item.grupo_id ?? "",
      subgrupo_id: item.subgrupo_id ?? "",
      categoria_icm_id: item.categoria_icm_id ?? "",
      cfop_id: item.cfop_id ?? "",
      preco_venda: String(item.preco_venda ?? 0),
      estoque_atual: String(item.estoque_atual ?? 0),
      status: item.status === "inativo" ? "inativo" : "ativo",
      observacao: item.observacao ?? "",
      conta_contabil: item.conta_contabil ?? "",
      centro_custo: item.centro_custo ?? "",
    });
    setTab("geral");
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: Produto) => {
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
    const desc = form.descricao.trim();
    if (!desc) {
      setFormError("Informe a descrição do produto.");
      setTab("geral");
      return;
    }
    if (!form.unidade_id) {
      setFormError("Selecione a unidade de medida.");
      setTab("geral");
      return;
    }

    setFormError("");
    const payload = {
      codigo_barras: form.codigo_barras.trim() || null,
      descricao: desc,
      unidade_id: form.unidade_id || null,
      controla_estoque: form.controla_estoque === "S",
      grupo_id: form.grupo_id || null,
      subgrupo_id: form.subgrupo_id || null,
      categoria_icm_id: form.categoria_icm_id || null,
      cfop_id: form.cfop_id || null,
      preco_venda: parseMoney(form.preco_venda),
      estoque_atual: parseMoney(form.estoque_atual),
      status: form.status === "inativo" ? "inativo" : "ativo",
      observacao: form.observacao.trim() || null,
      conta_contabil: form.conta_contabil.trim() || null,
      centro_custo: form.centro_custo.trim() || null,
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("produtos")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { error } = await supabase.from("produtos").insert({
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
            .from("tanques")
            .select("id", { count: "exact", head: true })
            .eq("produto_id", deleting.id),
          supabase
            .from("bicos")
            .select("id", { count: "exact", head: true })
            .eq("produto_id", deleting.id),
          supabase
            .from("grupo_precos_itens")
            .select("id", { count: "exact", head: true })
            .eq("produto_id", deleting.id),
        ]);

        for (const res of checks) {
          if (res.error) throw new Error(res.error.message);
        }
        const [tanques, bicos, precos] = checks;
        const total =
          (tanques.count ?? 0) + (bicos.count ?? 0) + (precos.count ?? 0);
        if (total > 0) {
          throw new Error(
            `Não é possível excluir: produto vinculado a tanques/bicos/grupo de preços (${total} vínculo(s)).`,
          );
        }

        const { error } = await supabase
          .from("produtos")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });

      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o produto.",
      );
    }
  };

  const rows = items.map((item) => ({
    codigo: item.codigo,
    barras: item.codigo_barras || "—",
    descricao: item.descricao,
    unidade: item.unidade_medida?.codigo ?? "—",
    grupo: item.grupo_produtos
      ? `${item.grupo_produtos.codigo} — ${item.grupo_produtos.descricao}`
      : "—",
    preco: Number(item.preco_venda ?? 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
    }),
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
  }));

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar produtos: ${loadError}`}
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
        title="Produtos"
        description="Cadastro de produtos e itens"
        icon={<Package size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Produto"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Produto" : "Novo Produto"}
          titleId="produto-title"
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
          width={720}
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

          <div className="cadastro-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`cadastro-tab${tab === item.id ? " active" : ""}`}
                onClick={() => setTab(item.id)}
                disabled={busy}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "geral" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField
                  label="Código de barras"
                  htmlFor="prod-barras"
                  span="full"
                >
                  <input
                    id="prod-barras"
                    className="input-base input-compact"
                    value={form.codigo_barras}
                    onChange={(e) => updateForm("codigo_barras", e.target.value)}
                    disabled={busy}
                    autoFocus
                    maxLength={50}
                    placeholder="EAN / GTIN"
                  />
                </CadastroField>

                <CadastroField label="Unidade *" htmlFor="prod-unidade">
                  <select
                    id="prod-unidade"
                    className="input-base input-compact"
                    value={form.unidade_id}
                    onChange={(e) => updateForm("unidade_id", e.target.value)}
                    disabled={busy}
                    required
                  >
                    <option value="">— Selecione —</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {optLabel(u)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="Controla estoque" htmlFor="prod-estoque">
                  <select
                    id="prod-estoque"
                    className="input-base input-compact"
                    value={form.controla_estoque}
                    onChange={(e) =>
                      updateForm(
                        "controla_estoque",
                        e.target.value === "N" ? "N" : "S",
                      )
                    }
                    disabled={busy}
                  >
                    <option value="S">Sim</option>
                    <option value="N">Não</option>
                  </select>
                </CadastroField>

                <CadastroField
                  label="Descrição *"
                  htmlFor="prod-descricao"
                  span="full"
                >
                  <input
                    id="prod-descricao"
                    className="input-base input-compact"
                    value={form.descricao}
                    onChange={(e) => updateForm("descricao", e.target.value)}
                    disabled={busy}
                    required
                    maxLength={200}
                  />
                </CadastroField>

                <CadastroField label="Grupo" htmlFor="prod-grupo">
                  <select
                    id="prod-grupo"
                    className="input-base input-compact"
                    value={form.grupo_id}
                    onChange={(e) => updateForm("grupo_id", e.target.value)}
                    disabled={busy}
                  >
                    <option value="">— Sem grupo —</option>
                    {grupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        {optLabel(g)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="Sub-grupo" htmlFor="prod-subgrupo">
                  <select
                    id="prod-subgrupo"
                    className="input-base input-compact"
                    value={form.subgrupo_id}
                    onChange={(e) => updateForm("subgrupo_id", e.target.value)}
                    disabled={busy || !form.grupo_id}
                  >
                    <option value="">
                      {form.grupo_id ? "— Sem sub-grupo —" : "— Selecione o grupo —"}
                    </option>
                    {subgruposFiltrados.map((s) => (
                      <option key={s.id} value={s.id}>
                        {optLabel(s)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="CFOP" htmlFor="prod-cfop">
                  <select
                    id="prod-cfop"
                    className="input-base input-compact"
                    value={form.cfop_id}
                    onChange={(e) => updateForm("cfop_id", e.target.value)}
                    disabled={busy}
                  >
                    <option value="">— Selecione —</option>
                    {cfops.map((c) => (
                      <option key={c.id} value={c.id}>
                        {optLabel(c)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="Categoria ICMS" htmlFor="prod-cat-icm">
                  <select
                    id="prod-cat-icm"
                    className="input-base input-compact"
                    value={form.categoria_icm_id}
                    onChange={(e) =>
                      updateForm("categoria_icm_id", e.target.value)
                    }
                    disabled={busy}
                  >
                    <option value="">— Selecione —</option>
                    {categoriasIcm.map((c) => (
                      <option key={c.id} value={c.id}>
                        {optLabel(c)}
                      </option>
                    ))}
                  </select>
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}

          {tab === "outras" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="Preço de venda (R$)" htmlFor="prod-preco">
                  <input
                    id="prod-preco"
                    className="input-base input-compact"
                    value={form.preco_venda}
                    onChange={(e) => updateForm("preco_venda", e.target.value)}
                    disabled={busy}
                    inputMode="decimal"
                  />
                </CadastroField>

                <CadastroField label="Estoque atual" htmlFor="prod-estoque-qtd">
                  <input
                    id="prod-estoque-qtd"
                    className="input-base input-compact"
                    value={form.estoque_atual}
                    onChange={(e) => updateForm("estoque_atual", e.target.value)}
                    disabled={busy || form.controla_estoque === "N"}
                    inputMode="decimal"
                  />
                </CadastroField>

                <CadastroField label="Status" htmlFor="prod-status">
                  <select
                    id="prod-status"
                    className="input-base input-compact"
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                    disabled={busy}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </CadastroField>

                <CadastroField
                  label="Observação"
                  htmlFor="prod-obs"
                  span="full"
                >
                  <textarea
                    id="prod-obs"
                    className="input-base input-compact"
                    value={form.observacao}
                    onChange={(e) => updateForm("observacao", e.target.value)}
                    disabled={busy}
                    rows={3}
                    style={{ resize: "vertical", minHeight: 64 }}
                  />
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}

          {tab === "contabil" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="Conta contábil" htmlFor="prod-conta">
                  <input
                    id="prod-conta"
                    className="input-base input-compact"
                    value={form.conta_contabil}
                    onChange={(e) =>
                      updateForm("conta_contabil", e.target.value)
                    }
                    disabled={busy}
                    maxLength={30}
                    placeholder="Ex.: 1.1.01.001"
                  />
                </CadastroField>

                <CadastroField label="Centro de custo" htmlFor="prod-ccusto">
                  <input
                    id="prod-ccusto"
                    className="input-base input-compact"
                    value={form.centro_custo}
                    onChange={(e) => updateForm("centro_custo", e.target.value)}
                    disabled={busy}
                    maxLength={30}
                  />
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir produto"
          titleId="produto-delete-title"
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
          {actionError ? (
            <CadastroFormError
              message={actionError}
              onClose={() => setActionError("")}
            />
          ) : null}
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
            Confirma a exclusão do produto{" "}
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
