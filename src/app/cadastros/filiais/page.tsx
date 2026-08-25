"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import {
  CadastroField,
  CadastroFormActions,
  CadastroFormError,
  CadastroFormGrid,
  CadastroModal,
} from "@/components/CadastroUi";
import { supabase } from "@/lib/supabase";
import { consultarCnpj } from "@/components/barrapdv/services/document/cnpjPublic";
import {
  formatCpfCnpj,
  isValidCnpj,
  onlyDigits,
} from "@/components/barrapdv/services/document/documentValidator";

type Filial = {
  id: string;
  codigo: string;
  razao_social: string;
  fantasia: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  cep: string | null;
  endereco: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_uf: string | null;
  endereco_cidade: number | null;
  telefone: string | null;
  status: string | null;
};

type FilialForm = {
  razao_social: string;
  fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  cep: string;
  endereco: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_uf: string;
  endereco_cidade: string;
  telefone: string;
  status: string;
};

type UfRow = { codigo: string; descricao: string };
type CidadeRow = { codigo: string; descricao: string; uf: string };

const emptyForm: FilialForm = {
  razao_social: "",
  fantasia: "",
  cnpj: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  cep: "",
  endereco: "",
  endereco_numero: "",
  endereco_bairro: "",
  endereco_uf: "",
  endereco_cidade: "",
  telefone: "",
  status: "ativo",
};

const columns = [
  { key: "codigo", label: "Código" },
  { key: "razao", label: "Razão Social" },
  { key: "fantasia", label: "Fantasia" },
  { key: "cnpj", label: "CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF", align: "center" as const },
  { key: "telefone", label: "Telefone" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

async function nextCodigo() {
  const { data } = await supabase
    .from("filial")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `FIL-${String(max + 1).padStart(3, "0")}`;
}

function toForm(item: Filial): FilialForm {
  return {
    razao_social: item.razao_social ?? "",
    fantasia: item.fantasia ?? "",
    cnpj: item.cnpj ?? "",
    inscricao_estadual: item.inscricao_estadual ?? "",
    inscricao_municipal: item.inscricao_municipal ?? "",
    cep: item.cep ?? "",
    endereco: item.endereco ?? "",
    endereco_numero: item.endereco_numero ?? "",
    endereco_bairro: item.endereco_bairro ?? "",
    endereco_uf: item.endereco_uf ?? "",
    endereco_cidade:
      item.endereco_cidade != null ? String(item.endereco_cidade) : "",
    telefone: item.telefone ?? "",
    status: item.status === "inativo" ? "inativo" : "ativo",
  };
}

function toPayload(form: FilialForm) {
  const blank = (v: string) => {
    const t = v.trim();
    return t ? t : null;
  };
  const cidadeCodigo = form.endereco_cidade.trim()
    ? Number(form.endereco_cidade)
    : null;
  return {
    razao_social: form.razao_social.trim(),
    fantasia: blank(form.fantasia),
    cnpj: blank(form.cnpj),
    inscricao_estadual: blank(form.inscricao_estadual),
    inscricao_municipal: blank(form.inscricao_municipal),
    cep: blank(form.cep),
    endereco: blank(form.endereco),
    endereco_numero: blank(form.endereco_numero),
    endereco_bairro: blank(form.endereco_bairro),
    endereco_uf: blank(form.endereco_uf)?.toUpperCase() ?? null,
    endereco_cidade: Number.isFinite(cidadeCodigo) ? cidadeCodigo : null,
    telefone: blank(form.telefone),
    status: form.status === "inativo" ? "inativo" : "ativo",
  };
}

/** Retorna mensagem se a filial tiver vínculo/movimento; null se puder excluir. */
async function filialTemVinculo(filial: Filial): Promise<string | null> {
  const checks: { table: string; label: string }[] = [
    { table: "bicos", label: "bicos" },
    { table: "tanques", label: "tanques" },
    { table: "abastecimentos", label: "abastecimentos" },
  ];

  for (const check of checks) {
    const { count, error } = await supabase
      .from(check.table)
      .select("id", { count: "exact", head: true })
      .eq("filial", filial.id);
    if (error) {
      return `Não foi possível verificar vínculos em ${check.label}: ${error.message}`;
    }
    if ((count ?? 0) > 0) {
      return `Não é possível excluir: há movimento/vínculo em ${check.label} (${count}). Desative a filial em vez de excluir.`;
    }
  }

  const { count: caixaCount, error: caixaErr } = await supabase
    .from("caixa")
    .select("codigo", { count: "exact", head: true })
    .eq("filial", filial.codigo);
  if (caixaErr) {
    // coluna pode não existir em todos os ambientes — não bloqueia por erro de schema
    if (!/column|does not exist|42703/i.test(caixaErr.message)) {
      return `Não foi possível verificar vínculos em caixa: ${caixaErr.message}`;
    }
  } else if ((caixaCount ?? 0) > 0) {
    return `Não é possível excluir: há movimento em caixa (${caixaCount}). Desative a filial em vez de excluir.`;
  }

  return null;
}

async function resolverCidadeIbge(nome: string, uf: string): Promise<string> {
  const nomeLimpo = nome.trim();
  const ufLimpa = uf.trim().toUpperCase();
  if (!nomeLimpo || !ufLimpa) return "";

  const { data: exact } = await supabase
    .from("cidades")
    .select("codigo")
    .eq("uf", ufLimpa)
    .ilike("descricao", nomeLimpo)
    .limit(1)
    .maybeSingle();
  if (exact?.codigo != null) return String(exact.codigo);

  const { data: partial } = await supabase
    .from("cidades")
    .select("codigo")
    .eq("uf", ufLimpa)
    .ilike("descricao", `%${nomeLimpo}%`)
    .limit(1)
    .maybeSingle();
  return partial?.codigo != null ? String(partial.codigo) : "";
}

export default function FilialPage() {
  const { busy, pesquisar, gravar, consultar } = useDbStatus();
  const [items, setItems] = useState<Filial[]>([]);
  const [cidadeNomes, setCidadeNomes] = useState<Record<string, string>>({});
  const [ufs, setUfs] = useState<UfRow[]>([]);
  const [cidadesUf, setCidadesUf] = useState<CidadeRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Filial | null>(null);
  const [deleting, setDeleting] = useState<Filial | null>(null);
  const [form, setForm] = useState<FilialForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const lastConsultedCnpj = useRef("");
  const consultingRef = useRef(false);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("filial")
        .select(
          "id, codigo, razao_social, fantasia, cnpj, inscricao_estadual, inscricao_municipal, cep, endereco, endereco_numero, endereco_bairro, endereco_uf, endereco_cidade, telefone, status",
        )
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        setCidadeNomes({});
        return;
      }

      const list = (data ?? []) as Filial[];
      setItems(list);

      const codes = [
        ...new Set(
          list
            .map((row) => row.endereco_cidade)
            .filter((code): code is number => code != null)
            .map((code) => String(code)),
        ),
      ];
      if (codes.length === 0) {
        setCidadeNomes({});
        return;
      }

      const { data: cidadesData } = await supabase
        .from("cidades")
        .select("codigo, descricao")
        .in("codigo", codes);

      const map: Record<string, string> = {};
      for (const row of cidadesData ?? []) {
        map[String(row.codigo)] = String(row.descricao);
      }
      setCidadeNomes(map);
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("uf")
        .select("codigo, descricao")
        .order("codigo", { ascending: true });
      setUfs((data ?? []) as UfRow[]);
    })();
  }, []);

  useEffect(() => {
    const uf = form.endereco_uf.trim().toUpperCase();
    if (!uf) {
      setCidadesUf([]);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("cidades")
        .select("codigo, descricao, uf")
        .eq("uf", uf)
        .order("descricao", { ascending: true });
      setCidadesUf((data ?? []) as CidadeRow[]);
    })();
  }, [form.endereco_uf]);

  const updateField = (key: keyof FilialForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onUfChange = (value: string) => {
    const uf = value.toUpperCase();
    setForm((prev) => ({
      ...prev,
      endereco_uf: uf,
      endereco_cidade: prev.endereco_uf === uf ? prev.endereco_cidade : "",
    }));
  };

  const preencherPorCnpj = useCallback(
    async (rawCnpj: string, force = false) => {
      const digits = onlyDigits(rawCnpj);
      if (digits.length !== 14 || !isValidCnpj(digits)) {
        setFormError("Informe um CNPJ válido com 14 dígitos para consultar.");
        return;
      }
      if (consultingRef.current) return
      if (!force && lastConsultedCnpj.current === digits) return;

      consultingRef.current = true;
      setFormError("");
      try {
        await consultar(async () => {
          const data = await consultarCnpj(digits);
          lastConsultedCnpj.current = digits;
          const uf = (data.uf || "").toUpperCase();
          const cidadeCodigo = await resolverCidadeIbge(data.city, uf);
          setForm((prev) => ({
            ...prev,
            cnpj: formatCpfCnpj(data.cnpj),
            razao_social: data.razaoSocial || data.name || prev.razao_social,
            fantasia: data.fantasia || prev.fantasia,
            cep: data.cep || prev.cep,
            endereco: data.address || prev.endereco,
            endereco_numero: data.number || prev.endereco_numero,
            endereco_bairro: data.neighborhood || prev.endereco_bairro,
            endereco_uf: uf || prev.endereco_uf,
            endereco_cidade: cidadeCodigo || prev.endereco_cidade,
            telefone: data.phone || prev.telefone,
            inscricao_estadual:
              data.stateRegistration || prev.inscricao_estadual,
          }));
        });
      } catch (err) {
        lastConsultedCnpj.current = "";
        setFormError(
          err instanceof Error
            ? err.message
            : "Não foi possível consultar o CNPJ.",
        );
      } finally {
        consultingRef.current = false;
      }
    },
    [consultar],
  );

  const onCnpjChange = (value: string) => {
    const formatted = formatCpfCnpj(value);
    const digits = onlyDigits(formatted);
    if (digits !== lastConsultedCnpj.current) {
      lastConsultedCnpj.current = "";
    }
    updateField("cnpj", formatted);
    if (digits.length === 14 && isValidCnpj(digits)) {
      void preencherPorCnpj(digits);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setActionError("");
    lastConsultedCnpj.current = "";
    setModalOpen(true);
  };

  const openEdit = (item: Filial) => {
    setEditing(item);
    setForm(toForm(item));
    setFormError("");
    setActionError("");
    lastConsultedCnpj.current = onlyDigits(item.cnpj ?? "");
    setModalOpen(true);
  };

  const openDelete = (item: Filial) => {
    setDeleting(item);
    setActionError("");
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleting(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.razao_social.trim()) {
      setFormError("Informe a razão social.");
      return;
    }
    setFormError("");
    setActionError("");

    await gravar(async () => {
      const payload = toPayload(form);
      if (editing) {
        const { error } = await supabase
          .from("filial")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw new Error(error.message);
      } else {
        const codigo = await nextCodigo();
        const { error } = await supabase.from("filial").insert({
          ...payload,
          codigo,
        });
        if (error) throw new Error(error.message);
      }
      setModalOpen(false);
      setEditing(null);
      await loadData();
    }).catch((err: unknown) => {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");
    await gravar(async () => {
      const bloqueio = await filialTemVinculo(deleting);
      if (bloqueio) throw new Error(bloqueio);

      const { error } = await supabase
        .from("filial")
        .delete()
        .eq("id", deleting.id);
      if (error) {
        if (/foreign key|violates|restric/i.test(error.message)) {
          throw new Error(
            "Não é possível excluir: a filial está vinculada a outros cadastros ou movimentos. Desative a filial em vez de excluir.",
          );
        }
        throw new Error(error.message);
      }
      setDeleting(null);
      await loadData();
    }).catch((err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Falha ao excluir.");
    });
  };

  const toggleStatus = async (item: Filial) => {
    const next = item.status === "ativo" ? "inativo" : "ativo";
    setActionError("");
    await gravar(async () => {
      const { error } = await supabase
        .from("filial")
        .update({ status: next })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      await loadData();
    }).catch((err: unknown) => {
      setActionError(
        err instanceof Error ? err.message : "Falha ao alterar status.",
      );
    });
  };

  const rows = items.map((item) => ({
    codigo: item.codigo,
    razao: item.razao_social,
    fantasia: item.fantasia || "—",
    cnpj: item.cnpj || "—",
    cidade:
      item.endereco_cidade != null
        ? cidadeNomes[String(item.endereco_cidade)] ||
          String(item.endereco_cidade)
        : "—",
    uf: item.endereco_uf || "—",
    telefone: item.telefone || "—",
    status: (
      <span
        className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}
      >
        {item.status || "—"}
      </span>
    ),
    acoes: (
      <div className="cadastro-row-actions">
        <button
          type="button"
          className="cadastro-btn-edit"
          onClick={() => void toggleStatus(item)}
          disabled={busy}
          title={item.status === "ativo" ? "Desativar" : "Ativar"}
        >
          {item.status === "ativo" ? "Desativar" : "Ativar"}
        </button>
        <button
          type="button"
          className="cadastro-btn-edit"
          onClick={() => openEdit(item)}
          disabled={busy}
          title="Editar"
        >
          Editar
        </button>
        <button
          type="button"
          className="cadastro-btn-delete"
          onClick={() => openDelete(item)}
          disabled={busy}
          title="Excluir"
        >
          Excluir
        </button>
      </div>
    ),
  }));

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar filiais: ${loadError}`}
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
        title="Filiais"
        description="Cadastro de filiais do posto"
        icon={<Building2 size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Nova Filial"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Filial" : "Nova Filial"}
          titleId="filial-title"
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
          width={680}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions onCancel={closeModal} disabled={busy} busy={busy} />
          }
        >
          <CadastroFormGrid>
            <CadastroField label="CNPJ" htmlFor="cnpj" span="full">
              <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                <input
                  id="cnpj"
                  className="input-base input-compact"
                  value={form.cnpj}
                  onChange={(e) => onCnpjChange(e.target.value)}
                  onBlur={() => {
                    const digits = onlyDigits(form.cnpj);
                    if (digits.length === 14) void preencherPorCnpj(digits);
                  }}
                  placeholder="00.000.000/0000-00"
                  disabled={busy}
                  autoFocus
                  inputMode="numeric"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="cadastro-btn-edit"
                  style={{ padding: "0 12px", fontSize: 11 }}
                  onClick={() => void preencherPorCnpj(form.cnpj, true)}
                  disabled={busy}
                  title="Consultar CNPJ"
                >
                  Consultar
                </button>
              </div>
            </CadastroField>

            <CadastroField label="Razão Social *" htmlFor="razao_social" span="full">
              <input
                id="razao_social"
                className="input-base input-compact"
                value={form.razao_social}
                onChange={(e) => updateField("razao_social", e.target.value)}
                required
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="Fantasia" htmlFor="fantasia">
              <input
                id="fantasia"
                className="input-base input-compact"
                value={form.fantasia}
                onChange={(e) => updateField("fantasia", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Telefone" htmlFor="telefone">
              <input
                id="telefone"
                className="input-base input-compact"
                value={form.telefone}
                onChange={(e) => updateField("telefone", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Status" htmlFor="filial-status">
              <select
                id="filial-status"
                className="input-base input-compact"
                value={form.status}
                onChange={(e) => updateField("status", e.target.value)}
                disabled={busy}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </CadastroField>
            <CadastroField label="Inscrição Estadual" htmlFor="inscricao_estadual">
              <input
                id="inscricao_estadual"
                className="input-base input-compact"
                value={form.inscricao_estadual}
                onChange={(e) =>
                  updateField("inscricao_estadual", e.target.value)
                }
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Inscrição Municipal" htmlFor="inscricao_municipal">
              <input
                id="inscricao_municipal"
                className="input-base input-compact"
                value={form.inscricao_municipal}
                onChange={(e) =>
                  updateField("inscricao_municipal", e.target.value)
                }
                disabled={busy}
              />
            </CadastroField>

            <CadastroField label="CEP" htmlFor="cep">
              <input
                id="cep"
                className="input-base input-compact"
                value={form.cep}
                onChange={(e) => updateField("cep", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Endereço" htmlFor="endereco" span={2}>
              <input
                id="endereco"
                className="input-base input-compact"
                value={form.endereco}
                onChange={(e) => updateField("endereco", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Número" htmlFor="endereco_numero">
              <input
                id="endereco_numero"
                className="input-base input-compact"
                value={form.endereco_numero}
                onChange={(e) => updateField("endereco_numero", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Bairro" htmlFor="endereco_bairro">
              <input
                id="endereco_bairro"
                className="input-base input-compact"
                value={form.endereco_bairro}
                onChange={(e) => updateField("endereco_bairro", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="UF" htmlFor="endereco_uf">
              <select
                id="endereco_uf"
                className="input-base input-compact"
                value={form.endereco_uf}
                onChange={(e) => onUfChange(e.target.value)}
                disabled={busy}
              >
                <option value="">Selecione</option>
                {ufs.map((row) => (
                  <option key={row.codigo} value={row.codigo}>
                    {row.codigo} — {row.descricao}
                  </option>
                ))}
              </select>
            </CadastroField>
            <CadastroField label="Cidade" htmlFor="endereco_cidade" span={2}>
              <select
                id="endereco_cidade"
                className="input-base input-compact"
                value={form.endereco_cidade}
                onChange={(e) => updateField("endereco_cidade", e.target.value)}
                disabled={busy || !form.endereco_uf}
              >
                <option value="">
                  {form.endereco_uf ? "Selecione" : "Selecione a UF"}
                </option>
                {cidadesUf.map((row) => (
                  <option key={row.codigo} value={row.codigo}>
                    {row.descricao}
                  </option>
                ))}
              </select>
            </CadastroField>
          </CadastroFormGrid>
          <CadastroFormError message={formError} onClose={() => setFormError("")} />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir Filial"
          titleId="filial-delete-title"
          onClose={closeDelete}
          disabled={busy}
          width={420}
          footer={
            <CadastroFormActions
              onCancel={closeDelete}
              disabled={busy}
              busy={busy}
              submitLabel="Excluir"
              busyLabel="Excluindo..."
              danger
              onConfirm={() => void handleDelete()}
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Excluir a filial{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.codigo} — {deleting.razao_social}
            </strong>
            ?
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: 12,
              color: "var(--text-muted)",
              lineHeight: 1.45,
            }}
          >
            Se houver vínculo em bicos, tanques, abastecimentos ou caixa, a
            exclusão será bloqueada. Nesse caso, use <strong>Desativar</strong>.
          </p>
          {actionError ? (
            <CadastroFormError message={actionError} onClose={() => setActionError("")} />
          ) : null}
        </CadastroModal>
      ) : null}
    </>
  );
}
