"use client";

import { FormEvent, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Pencil, Trash2, Truck, X } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import { supabase } from "@/lib/supabase";
import { consultarCnpj } from "@/components/barrapdv/services/document/cnpjPublic";
import {
  formatCpfCnpj,
  isValidCnpj,
  onlyDigits,
} from "@/components/barrapdv/services/document/documentValidator";

type Fornecedor = {
  id: string;
  codigo: string;
  razao_social: string;
  fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  /** Código IBGE do município */
  cidade: number | null;
  uf: string | null;
  telefone1: string | null;
  telefone2: string | null;
  telefone3: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  contato: string | null;
  email: string | null;
  status: string | null;
};

type FornecedorForm = {
  razao_social: string;
  fantasia: string;
  cnpj: string;
  cpf: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  /** Código IBGE (string no select) */
  cidade: string;
  uf: string;
  telefone1: string;
  telefone2: string;
  telefone3: string;
  inscricao_estadual: string;
  inscricao_municipal: string;
  contato: string;
  email: string;
};

type UfRow = { codigo: string; descricao: string };
type CidadeRow = { codigo: string; descricao: string; uf: string };

const emptyForm: FornecedorForm = {
  razao_social: "",
  fantasia: "",
  cnpj: "",
  cpf: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  telefone1: "",
  telefone2: "",
  telefone3: "",
  inscricao_estadual: "",
  inscricao_municipal: "",
  contato: "",
  email: "",
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

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const labelStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.45px",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
};

const compactInputStyle: CSSProperties = {
  fontSize: 11,
  padding: "5px 8px",
  borderRadius: 6,
};

async function nextCodigo() {
  const { data } = await supabase
    .from("fornecedores")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `FOR-${String(max + 1).padStart(3, "0")}`;
}

function toForm(item: Fornecedor): FornecedorForm {
  return {
    razao_social: item.razao_social ?? "",
    fantasia: item.fantasia ?? "",
    cnpj: item.cnpj ?? "",
    cpf: item.cpf ?? "",
    cep: item.cep ?? "",
    endereco: item.endereco ?? "",
    numero: item.numero ?? "",
    complemento: item.complemento ?? "",
    bairro: item.bairro ?? "",
    cidade: item.cidade != null ? String(item.cidade) : "",
    uf: item.uf ?? "",
    telefone1: item.telefone1 ?? "",
    telefone2: item.telefone2 ?? "",
    telefone3: item.telefone3 ?? "",
    inscricao_estadual: item.inscricao_estadual ?? "",
    inscricao_municipal: item.inscricao_municipal ?? "",
    contato: item.contato ?? "",
    email: item.email ?? "",
  };
}

function toPayload(form: FornecedorForm) {
  const blank = (v: string) => {
    const t = v.trim();
    return t ? t : null;
  };
  const cidadeCodigo = form.cidade.trim() ? Number(form.cidade) : null;
  return {
    razao_social: form.razao_social.trim(),
    fantasia: blank(form.fantasia),
    cnpj: blank(form.cnpj),
    cpf: blank(form.cpf),
    cep: blank(form.cep),
    endereco: blank(form.endereco),
    numero: blank(form.numero),
    complemento: blank(form.complemento),
    bairro: blank(form.bairro),
    cidade: Number.isFinite(cidadeCodigo) ? cidadeCodigo : null,
    uf: blank(form.uf)?.toUpperCase() ?? null,
    telefone1: blank(form.telefone1),
    telefone2: blank(form.telefone2),
    telefone3: blank(form.telefone3),
    inscricao_estadual: blank(form.inscricao_estadual),
    inscricao_municipal: blank(form.inscricao_municipal),
    contato: blank(form.contato),
    email: blank(form.email),
  };
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

export default function FornecedoresPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Fornecedor[]>([]);
  const [cidadeNomes, setCidadeNomes] = useState<Record<string, string>>({});
  const [ufs, setUfs] = useState<UfRow[]>([]);
  const [cidadesUf, setCidadesUf] = useState<CidadeRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [deleting, setDeleting] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState<FornecedorForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [consultingCnpj, setConsultingCnpj] = useState(false);
  const lastConsultedCnpj = useRef("");
  const consultingRef = useRef(false);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("fornecedores")
        .select(
          "id, codigo, razao_social, fantasia, cnpj, cpf, cep, endereco, numero, complemento, bairro, cidade, uf, telefone1, telefone2, telefone3, inscricao_estadual, inscricao_municipal, contato, email, status",
        )
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        setCidadeNomes({});
        return;
      }

      const list = (data ?? []) as Fornecedor[];
      setItems(list);

      const codes = [
        ...new Set(
          list
            .map((row) => row.cidade)
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
    const uf = form.uf.trim().toUpperCase();
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
  }, [form.uf]);

  const updateField = (key: keyof FornecedorForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onUfChange = (value: string) => {
    const uf = value.toUpperCase();
    setForm((prev) => ({
      ...prev,
      uf,
      cidade: prev.uf === uf ? prev.cidade : "",
    }));
  };

  const preencherPorCnpj = useCallback(async (rawCnpj: string, force = false) => {
    const digits = onlyDigits(rawCnpj);
    if (digits.length !== 14 || !isValidCnpj(digits)) {
      setFormError("Informe um CNPJ válido com 14 dígitos para consultar.");
      return;
    }
    if (consultingRef.current) return;
    if (!force && lastConsultedCnpj.current === digits) return;

    consultingRef.current = true;
    setConsultingCnpj(true);
    setFormError("");
    try {
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
        numero: data.number || prev.numero,
        complemento: data.complemento || prev.complemento,
        bairro: data.neighborhood || prev.bairro,
        uf: uf || prev.uf,
        cidade: cidadeCodigo || prev.cidade,
        telefone1: data.phone || prev.telefone1,
        inscricao_estadual: data.stateRegistration || prev.inscricao_estadual,
        email: data.email || prev.email,
      }));
    } catch (err) {
      lastConsultedCnpj.current = "";
      setFormError(
        err instanceof Error ? err.message : "Não foi possível consultar o CNPJ.",
      );
    } finally {
      consultingRef.current = false;
      setConsultingCnpj(false);
    }
  }, []);

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

  const openEdit = (item: Fornecedor) => {
    setEditing(item);
    setForm(toForm(item));
    setFormError("");
    setActionError("");
    lastConsultedCnpj.current = onlyDigits(item.cnpj ?? "");
    setModalOpen(true);
  };

  const openDelete = (item: Fornecedor) => {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.razao_social.trim()) {
      setFormError("Informe a razão social.");
      return;
    }

    setFormError("");
    const payload = toPayload(form);

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("fornecedores")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { error } = await supabase.from("fornecedores").insert({
            ...payload,
            codigo,
            status: "ativo",
          });
          if (error) throw new Error(error.message);
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

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await gravar(async () => {
        const { error } = await supabase
          .from("fornecedores")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  };

  const rows = items.map((item) => ({
    codigo: item.codigo,
    razao: item.razao_social,
    fantasia: item.fantasia || "—",
    cnpj: item.cnpj || "—",
    cidade: item.cidade != null ? cidadeNomes[String(item.cidade)] || String(item.cidade) : "—",
    uf: item.uf || "—",
    telefone: item.telefone1 || "—",
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
            gap: 4,
            padding: "3px 7px",
            borderRadius: 6,
            border: "1px solid var(--border-default)",
            background: "var(--bg-elevated)",
            color: "var(--blue-light)",
            fontSize: 10,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Pencil size={11} />
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
            gap: 4,
            padding: "3px 7px",
            borderRadius: 6,
            border: "1px solid rgba(239,68,68,0.35)",
            background: "rgba(239,68,68,0.08)",
            color: "#EF4444",
            fontSize: 10,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <Trash2 size={11} />
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
          Erro ao carregar fornecedores: {loadError}
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
        title="Fornecedores"
        description="Gerenciamento de fornecedores"
        icon={<Truck size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Fornecedor"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="fornecedor-title"
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(6, 13, 26, 0.72)",
            display: "grid",
            placeItems: "center",
            padding: 12,
            overflowY: "auto",
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            style={{
              width: "min(680px, 100%)",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              margin: "12px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2
                  id="fornecedor-title"
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {editing ? "Editar Fornecedor" : "Novo Fornecedor"}
                </h2>
                {editing ? (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                    Código: <strong style={{ color: "var(--text-secondary)" }}>{editing.codigo}</strong>
                  </div>
                ) : null}
              </div>
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
                  padding: 2,
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                <label htmlFor="cnpj" style={labelStyle}>CNPJ</label>
                <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                  <input
                    id="cnpj"
                    className="input-base"
                    value={form.cnpj}
                    onChange={(e) => onCnpjChange(e.target.value)}
                    onBlur={() => {
                      const digits = onlyDigits(form.cnpj);
                      if (digits.length === 14) void preencherPorCnpj(digits);
                    }}
                    placeholder="00.000.000/0000-00"
                    disabled={busy || consultingCnpj}
                    autoFocus
                    inputMode="numeric"
                    style={{ ...compactInputStyle, flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => void preencherPorCnpj(form.cnpj, true)}
                    disabled={busy || consultingCnpj}
                    title="Consultar CNPJ na Receita (publica.cnpj.ws)"
                    style={{
                      padding: "0 12px",
                      borderRadius: 7,
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-elevated)",
                      color: "var(--blue-light)",
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: busy || consultingCnpj ? "wait" : "pointer",
                      opacity: busy || consultingCnpj ? 0.6 : 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {consultingCnpj ? "…" : "Consultar"}
                  </button>
                </div>
              </div>

              <div style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                <label htmlFor="razao_social" style={labelStyle}>Razão Social *</label>
                <input
                  id="razao_social"
                  className="input-base"
                  value={form.razao_social}
                  onChange={(e) => updateField("razao_social", e.target.value)}
                  required
                  disabled={busy || consultingCnpj}
                  style={compactInputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="fantasia" style={labelStyle}>Fantasia</label>
                <input id="fantasia" className="input-base" value={form.fantasia} onChange={(e) => updateField("fantasia", e.target.value)} disabled={busy || consultingCnpj} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="cpf" style={labelStyle}>CPF</label>
                <input id="cpf" className="input-base" value={form.cpf} onChange={(e) => updateField("cpf", e.target.value)} disabled={busy || consultingCnpj} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="inscricao_estadual" style={labelStyle}>Inscrição Estadual</label>
                <input id="inscricao_estadual" className="input-base" value={form.inscricao_estadual} onChange={(e) => updateField("inscricao_estadual", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="inscricao_municipal" style={labelStyle}>Inscrição Municipal</label>
                <input id="inscricao_municipal" className="input-base" value={form.inscricao_municipal} onChange={(e) => updateField("inscricao_municipal", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="cep" style={labelStyle}>CEP</label>
                <input id="cep" className="input-base" value={form.cep} onChange={(e) => updateField("cep", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={{ ...fieldStyle, gridColumn: "span 2" }}>
                <label htmlFor="endereco" style={labelStyle}>Endereço</label>
                <input id="endereco" className="input-base" value={form.endereco} onChange={(e) => updateField("endereco", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="numero" style={labelStyle}>Número</label>
                <input id="numero" className="input-base" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="complemento" style={labelStyle}>Complemento</label>
                <input id="complemento" className="input-base" value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="bairro" style={labelStyle}>Bairro</label>
                <input id="bairro" className="input-base" value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="uf" style={labelStyle}>UF</label>
                <select
                  id="uf"
                  className="input-base"
                  value={form.uf}
                  onChange={(e) => onUfChange(e.target.value)}
                  disabled={busy || consultingCnpj}
                  style={compactInputStyle}
                >
                  <option value="">Selecione</option>
                  {ufs.map((row) => (
                    <option key={row.codigo} value={row.codigo}>
                      {row.codigo} — {row.descricao}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ ...fieldStyle, gridColumn: "span 2" }}>
                <label htmlFor="cidade" style={labelStyle}>Cidade</label>
                <select
                  id="cidade"
                  className="input-base"
                  value={form.cidade}
                  onChange={(e) => updateField("cidade", e.target.value)}
                  disabled={busy || consultingCnpj || !form.uf}
                  style={compactInputStyle}
                >
                  <option value="">{form.uf ? "Selecione a cidade" : "Selecione a UF primeiro"}</option>
                  {cidadesUf.map((row) => (
                    <option key={row.codigo} value={String(row.codigo)}>
                      {row.descricao}
                    </option>
                  ))}
                </select>
              </div>

              <div style={fieldStyle}>
                <label htmlFor="telefone1" style={labelStyle}>Telefone 1</label>
                <input id="telefone1" className="input-base" value={form.telefone1} onChange={(e) => updateField("telefone1", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="telefone2" style={labelStyle}>Telefone 2</label>
                <input id="telefone2" className="input-base" value={form.telefone2} onChange={(e) => updateField("telefone2", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="telefone3" style={labelStyle}>Telefone 3</label>
                <input id="telefone3" className="input-base" value={form.telefone3} onChange={(e) => updateField("telefone3", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={fieldStyle}>
                <label htmlFor="contato" style={labelStyle}>Contato</label>
                <input id="contato" className="input-base" value={form.contato} onChange={(e) => updateField("contato", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
              <div style={{ ...fieldStyle, gridColumn: "span 2" }}>
                <label htmlFor="email" style={labelStyle}>E-mail</label>
                <input id="email" type="email" className="input-base" value={form.email} onChange={(e) => updateField("email", e.target.value)} disabled={busy} style={compactInputStyle} />
              </div>
            </div>

            {formError ? (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: 7,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#EF4444",
                  fontSize: 11,
                }}
              >
                {formError}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={busy}
                style={{ padding: "6px 12px", fontSize: 11, borderRadius: 6 }}
              >
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
          aria-labelledby="fornecedor-delete-title"
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
              id="fornecedor-delete-title"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              Excluir fornecedor
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.45 }}>
              Confirma a exclusão de{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {deleting.codigo} — {deleting.razao_social}
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
