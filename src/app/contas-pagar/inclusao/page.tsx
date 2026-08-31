"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { FilePlus2 } from "lucide-react";
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
import { formatMoney2, maskMoneyInput, parseMoney } from "@/lib/moneyMask";

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type FornecedorOpt = {
  id: string;
  codigo: string;
  razao_social: string;
  fantasia: string | null;
};

type ContaPagar = {
  id: string;
  fornecedor: string;
  titulo: string;
  nota_entrada: string | null;
  finalidade: string | null;
  filial: string;
  tipo: string;
  data_emissao: string | null;
  data_chegada: string | null;
  data_vencimento: string | null;
  valor: number;
  valor_saldo: number;
  valor_outros: number;
  situacao: number;
};

type ContaForm = {
  filial: string;
  fornecedor: string;
  titulo: string;
  tipo: string;
  finalidade: string;
  data_emissao: string;
  data_chegada: string;
  data_vencimento: string;
  valor: string;
  valor_outros: string;
  situacao: string;
};

const emptyForm: ContaForm = {
  filial: "",
  fornecedor: "",
  titulo: "",
  tipo: "despesa",
  finalidade: "",
  data_emissao: "",
  data_chegada: "",
  data_vencimento: "",
  valor: "0,00",
  valor_outros: "0,00",
  situacao: "0",
};

const columns = [
  { key: "titulo", label: "Título" },
  { key: "tipo", label: "Tipo", align: "center" as const },
  { key: "fornecedor", label: "Fornecedor" },
  { key: "filial", label: "Filial" },
  { key: "emissao", label: "Emissão" },
  { key: "vencimento", label: "Vencimento" },
  { key: "valor", label: "Valor", align: "right" as const },
  { key: "saldo", label: "Saldo", align: "right" as const },
  { key: "situacao", label: "Situação", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function fornecedorLabel(f: FornecedorOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function formatDateBr(iso: string | null) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function formatCurrency(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function situacaoBadge(situacao: number, saldo: number) {
  if (situacao === 1 || saldo <= 0) {
    return <span className="badge badge-success">Quitado</span>;
  }
  return <span className="badge badge-warning">Aberto</span>;
}

async function nextTitulo(filialId: string, fornecedorId: string) {
  const { data } = await supabase
    .from("contas_pagar")
    .select("titulo")
    .eq("filial", filialId)
    .eq("fornecedor", fornecedorId)
    .order("created_at", { ascending: false })
    .limit(80);

  let max = 0;
  for (const row of data ?? []) {
    const m = String(row.titulo ?? "").match(/(\d+)/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return String(max + 1);
}

export default function ContasPagarInclusaoPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOpt[]>([]);
  const [items, setItems] = useState<ContaPagar[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContaPagar | null>(null);
  const [deleting, setDeleting] = useState<ContaPagar | null>(null);
  const [form, setForm] = useState<ContaForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const filialById = useMemo(() => {
    const map = new Map<string, FilialOpt>();
    for (const f of filiais) map.set(f.id, f);
    return map;
  }, [filiais]);

  const fornecedorById = useMemo(() => {
    const map = new Map<string, FornecedorOpt>();
    for (const f of fornecedores) map.set(f.id, f);
    return map;
  }, [fornecedores]);

  const loadLookups = useCallback(async () => {
    const [filRes, fornRes] = await Promise.all([
      supabase
        .from("filial")
        .select("id, codigo, fantasia, razao_social")
        .eq("status", "ativo")
        .order("codigo"),
      supabase
        .from("fornecedores")
        .select("id, codigo, razao_social, fantasia")
        .eq("status", "ativo")
        .order("razao_social"),
    ]);

    setFiliais(
      (filRes.data ?? []).map((f) => ({
        id: String(f.id),
        codigo: String(f.codigo),
        fantasia: f.fantasia != null ? String(f.fantasia) : null,
        razao_social: String(f.razao_social ?? ""),
      })),
    );
    setFornecedores(
      (fornRes.data ?? []).map((f) => ({
        id: String(f.id),
        codigo: String(f.codigo),
        razao_social: String(f.razao_social ?? ""),
        fantasia: f.fantasia != null ? String(f.fantasia) : null,
      })),
    );
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("contas_pagar")
        .select(
          `
          id, fornecedor, titulo, nota_entrada, finalidade, filial, tipo,
          data_emissao, data_chegada, data_vencimento,
          valor, valor_saldo, valor_outros, situacao
        `,
        )
        .order("data_vencimento", { ascending: true })
        .order("titulo", { ascending: true });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      setItems(
        (data ?? []).map((row) => ({
          id: String(row.id),
          fornecedor: String(row.fornecedor),
          titulo: String(row.titulo ?? ""),
          nota_entrada:
            row.nota_entrada != null ? String(row.nota_entrada) : null,
          finalidade:
            row.finalidade != null ? String(row.finalidade) : null,
          filial: String(row.filial),
          tipo: String(row.tipo || "nota"),
          data_emissao:
            row.data_emissao != null ? String(row.data_emissao) : null,
          data_chegada:
            row.data_chegada != null ? String(row.data_chegada) : null,
          data_vencimento:
            row.data_vencimento != null ? String(row.data_vencimento) : null,
          valor: Number(row.valor) || 0,
          valor_saldo: Number(row.valor_saldo) || 0,
          valor_outros: Number(row.valor_outros) || 0,
          situacao: Number(row.situacao) || 0,
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadLookups();
    void loadData();
  }, [loadLookups, loadData]);

  const updateForm = <K extends keyof ContaForm>(key: K, value: ContaForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditing(null);
    setForm({
      ...emptyForm,
      filial: filiais.length === 1 ? filiais[0].id : "",
      data_emissao: today,
      data_chegada: today,
      data_vencimento: today,
      tipo: "despesa",
    });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: ContaPagar) => {
    setEditing(item);
    setForm({
      filial: item.filial,
      fornecedor: item.fornecedor,
      titulo: item.titulo,
      tipo: item.tipo || "despesa",
      finalidade: item.finalidade ?? "",
      data_emissao: toDateInput(item.data_emissao),
      data_chegada: toDateInput(item.data_chegada),
      data_vencimento: toDateInput(item.data_vencimento),
      valor: formatMoney2(item.valor ?? 0),
      valor_outros: formatMoney2(item.valor_outros ?? 0),
      situacao: String(item.situacao ?? 0),
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: ContaPagar) => {
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
          .from("contas_pagar")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir a conta.",
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
    if (!form.filial) {
      setFormError("Selecione a filial.");
      return;
    }
    if (!form.fornecedor) {
      setFormError("Selecione o fornecedor.");
      return;
    }

    const valor = parseMoney(form.valor);
    if (valor <= 0) {
      setFormError("Informe um valor válido.");
      return;
    }

    setFormError("");

    try {
      await gravar(async () => {
        const titulo =
          form.titulo.trim() ||
          (editing
            ? editing.titulo
            : await nextTitulo(form.filial, form.fornecedor));

        const payload = {
          filial: form.filial,
          fornecedor: form.fornecedor,
          titulo: titulo.slice(0, 15),
          tipo: form.tipo === "nota" ? "nota" : "despesa",
          finalidade: form.finalidade.trim() || null,
          data_emissao: form.data_emissao || null,
          data_chegada: form.data_chegada || null,
          data_vencimento: form.data_vencimento || null,
          valor,
          valor_outros: parseMoney(form.valor_outros),
          situacao: form.situacao === "1" ? 1 : 0,
          valor_saldo:
            form.situacao === "1"
              ? 0
              : editing
                ? Math.min(editing.valor_saldo, valor)
                : valor,
        };

        if (editing) {
          const { error } = await supabase
            .from("contas_pagar")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await supabase
            .from("contas_pagar")
            .insert({
              ...payload,
              valor_saldo: valor,
              nota_entrada: null,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);

          const ano = new Date().getFullYear();
          const { data: numData, error: numErr } = await supabase.rpc(
            "next_contas_pagar_numero_pagamento",
            { p_ano: ano },
          );
          if (numErr) throw new Error(numErr.message);

          const { error: movErr } = await supabase
            .from("contas_pagarpagamento")
            .insert({
              contas_pagar: data.id,
              filial: form.filial,
              fornecedor: form.fornecedor,
              titulo: titulo.slice(0, 15),
              data_movimento:
                form.data_chegada ||
                form.data_emissao ||
                new Date().toISOString().slice(0, 10),
              hora_lancamento: new Date().toISOString(),
              tipo: payload.tipo,
              tipo_transacao: "inclusao",
              sinal: -1,
              valor,
              valor_desconto: 0,
              valor_juros: 0,
              observacao: (form.finalidade || "Inclusão").slice(0, 30),
              numero_pagamento_ano: ano,
              numero_pagamento: Number(numData) || 1,
            });
          if (movErr) throw new Error(movErr.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    }
  };

  const rows = items.map((item) => {
    const fil = filialById.get(item.filial);
    const forn = fornecedorById.get(item.fornecedor);
    return {
      titulo: item.titulo,
      tipo: item.tipo === "despesa" ? "Despesa" : "Nota",
      fornecedor: forn ? fornecedorLabel(forn) : "—",
      filial: fil ? filialLabel(fil) : "—",
      emissao: formatDateBr(item.data_emissao),
      vencimento: formatDateBr(item.data_vencimento),
      valor: formatCurrency(item.valor),
      saldo: formatCurrency(item.valor_saldo),
      situacao: situacaoBadge(item.situacao, item.valor_saldo),
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
          message={`Erro ao carregar contas a pagar: ${loadError}`}
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
        title="Inclusão de Contas a Pagar"
        description="Cadastro de títulos a pagar (notas e despesas)"
        icon={<FilePlus2 size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Nova Conta"
        backUrl="/contas-pagar"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}
          titleId="conta-pagar-title"
          subtitle={
            editing ? (
              <>
                Título: <strong>{editing.titulo}</strong>
              </>
            ) : (
              "Preencha os dados do título"
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
          <CadastroFormGrid>
            <CadastroField label="Filial *" htmlFor="cp-filial">
              <select
                id="cp-filial"
                className="input-base input-compact"
                value={form.filial}
                onChange={(e) => updateForm("filial", e.target.value)}
                disabled={busy || Boolean(editing)}
              >
                <option value="">Selecione…</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {filialLabel(f)}
                  </option>
                ))}
              </select>
            </CadastroField>

            <CadastroField label="Fornecedor *" htmlFor="cp-forn" span={2}>
              <select
                id="cp-forn"
                className="input-base input-compact"
                value={form.fornecedor}
                onChange={(e) => updateForm("fornecedor", e.target.value)}
                disabled={busy || Boolean(editing)}
              >
                <option value="">Selecione…</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {fornecedorLabel(f)}
                  </option>
                ))}
              </select>
            </CadastroField>

            <CadastroField label="Título" htmlFor="cp-titulo">
              <input
                id="cp-titulo"
                className="input-base input-compact"
                maxLength={15}
                value={form.titulo}
                onChange={(e) => updateForm("titulo", e.target.value)}
                disabled={busy || Boolean(editing)}
                placeholder="Auto se vazio"
              />
            </CadastroField>

            <CadastroField label="Tipo *" htmlFor="cp-tipo">
              <select
                id="cp-tipo"
                className="input-base input-compact"
                value={form.tipo}
                onChange={(e) => updateForm("tipo", e.target.value)}
                disabled={busy}
              >
                <option value="despesa">Despesa</option>
                <option value="nota">Nota</option>
              </select>
            </CadastroField>

            <CadastroField label="Situação" htmlFor="cp-sit">
              <select
                id="cp-sit"
                className="input-base input-compact"
                value={form.situacao}
                onChange={(e) => updateForm("situacao", e.target.value)}
                disabled={busy}
              >
                <option value="0">Aberto</option>
                <option value="1">Quitado</option>
              </select>
            </CadastroField>

            <CadastroField label="Finalidade" htmlFor="cp-fin" span="full">
              <input
                id="cp-fin"
                className="input-base input-compact"
                maxLength={50}
                value={form.finalidade}
                onChange={(e) => updateForm("finalidade", e.target.value)}
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="Emissão" htmlFor="cp-emi">
              <input
                id="cp-emi"
                type="date"
                className="input-base input-compact"
                value={form.data_emissao}
                onChange={(e) => updateForm("data_emissao", e.target.value)}
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="Chegada" htmlFor="cp-cheg">
              <input
                id="cp-cheg"
                type="date"
                className="input-base input-compact"
                value={form.data_chegada}
                onChange={(e) => updateForm("data_chegada", e.target.value)}
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="Vencimento" htmlFor="cp-venc">
              <input
                id="cp-venc"
                type="date"
                className="input-base input-compact"
                value={form.data_vencimento}
                onChange={(e) => updateForm("data_vencimento", e.target.value)}
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="Valor *" htmlFor="cp-valor">
              <input
                id="cp-valor"
                className="input-base input-compact"
                inputMode="decimal"
                value={form.valor}
                onChange={(e) =>
                  updateForm("valor", maskMoneyInput(e.target.value))
                }
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="Valor outros" htmlFor="cp-outros">
              <input
                id="cp-outros"
                className="input-base input-compact"
                inputMode="decimal"
                value={form.valor_outros}
                onChange={(e) =>
                  updateForm("valor_outros", maskMoneyInput(e.target.value))
                }
                disabled={busy}
              />
            </CadastroField>
          </CadastroFormGrid>

          {formError ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--danger, #e35d6a)",
              }}
            >
              {formError}
            </p>
          ) : null}
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir Conta a Pagar"
          titleId="conta-pagar-delete"
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
              onConfirm={() => void handleDelete()}
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Excluir o título <strong>{deleting.titulo}</strong>? Os movimentos
            vinculados também serão removidos.
          </p>
          {actionError ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "var(--danger, #e35d6a)",
              }}
            >
              {actionError}
            </p>
          ) : null}
        </CadastroModal>
      ) : null}
    </>
  );
}
