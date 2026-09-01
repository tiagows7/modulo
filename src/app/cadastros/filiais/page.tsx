"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Building2, Upload, FolderArchive } from "lucide-react";
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

type TabId = "geral" | "fiscal";

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
  certificado_nome: string | null;
  certificado_storage_path: string | null;
  certificado_senha: string | null;
  schemas_storage_path: string | null;
  schemas_atualizado_em: string | null;
  ult_nsu: string | null;
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
  certificado_senha: string;
  ult_nsu: string;
};

type UfRow = { codigo: string; descricao: string };
type CidadeRow = { codigo: string; descricao: string; uf: string };

const FISCAL_BUCKET = "filial-fiscal";

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "fiscal", label: "Config NF-E / NFC-E" },
];

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
  certificado_senha: "",
  ult_nsu: "",
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
    certificado_senha: item.certificado_senha ?? "",
    ult_nsu: item.ult_nsu ?? "",
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
    certificado_senha: blank(form.certificado_senha),
    ult_nsu: blank(form.ult_nsu)?.replace(/\D/g, "") ?? null,
  };
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 180);
}

function formatDateTimeBr(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
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
  const [tab, setTab] = useState<TabId>("geral");
  const [certNome, setCertNome] = useState<string | null>(null);
  const [certPath, setCertPath] = useState<string | null>(null);
  const [schemasPath, setSchemasPath] = useState<string | null>(null);
  const [schemasAt, setSchemasAt] = useState<string | null>(null);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingSchemas, setUploadingSchemas] = useState(false);
  const certInputRef = useRef<HTMLInputElement | null>(null);
  const schemasInputRef = useRef<HTMLInputElement | null>(null);
  const lastConsultedCnpj = useRef("");
  const consultingRef = useRef(false);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("filial")
        .select(
          "id, codigo, razao_social, fantasia, cnpj, inscricao_estadual, inscricao_municipal, cep, endereco, endereco_numero, endereco_bairro, endereco_uf, endereco_cidade, telefone, status, certificado_nome, certificado_storage_path, certificado_senha, schemas_storage_path, schemas_atualizado_em, ult_nsu",
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

  const syncFiscalState = (item: Filial | null) => {
    setCertNome(item?.certificado_nome ?? null);
    setCertPath(item?.certificado_storage_path ?? null);
    setSchemasPath(item?.schemas_storage_path ?? null);
    setSchemasAt(item?.schemas_atualizado_em ?? null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setActionError("");
    setTab("geral");
    syncFiscalState(null);
    lastConsultedCnpj.current = "";
    setModalOpen(true);
  };

  const openEdit = (item: Filial) => {
    setEditing(item);
    setForm(toForm(item));
    setFormError("");
    setActionError("");
    setTab("geral");
    syncFiscalState(item);
    lastConsultedCnpj.current = onlyDigits(item.cnpj ?? "");
    setModalOpen(true);
  };

  const openDelete = (item: Filial) => {
    setDeleting(item);
    setActionError("");
  };

  const closeModal = () => {
    if (busy || uploadingCert || uploadingSchemas) return;
    setModalOpen(false);
    setEditing(null);
    setFormError("");
    setTab("geral");
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleting(null);
  };

  const uploadCertificado = async (file: File, filialId: string) => {
    const path = `${filialId}/certificado/${Date.now()}-${safeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(FISCAL_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
    if (upErr) throw new Error(upErr.message);

    const { error } = await supabase
      .from("filial")
      .update({
        certificado_nome: file.name.slice(0, 255),
        certificado_storage_path: path,
      })
      .eq("id", filialId);
    if (error) throw new Error(error.message);

    setCertNome(file.name);
    setCertPath(path);
  };

  const uploadSchemas = async (file: File, filialId: string) => {
    const path = `${filialId}/schemas/${Date.now()}-${safeFileName(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(FISCAL_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type || "application/zip" });
    if (upErr) throw new Error(upErr.message);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("filial")
      .update({
        schemas_storage_path: path,
        schemas_atualizado_em: now,
      })
      .eq("id", filialId);
    if (error) throw new Error(error.message);

    setSchemasPath(path);
    setSchemasAt(now);
  };

  const onCertFile = async (file: File | null) => {
    if (!file) return;
    if (!editing?.id) {
      setFormError("Salve a filial na aba Geral antes de enviar o certificado.");
      setTab("geral");
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pfx") && !lower.endsWith(".p12")) {
      setFormError("Envie um certificado A1 (.pfx ou .p12).");
      return;
    }
    setFormError("");
    setUploadingCert(true);
    try {
      await gravar(async () => {
        await uploadCertificado(file, editing.id);
        await loadData();
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha no upload do certificado.");
    } finally {
      setUploadingCert(false);
      if (certInputRef.current) certInputRef.current.value = "";
    }
  };

  const onSchemasFile = async (file: File | null) => {
    if (!file) return;
    if (!editing?.id) {
      setFormError("Salve a filial na aba Geral antes de salvar os schemas.");
      setTab("geral");
      return;
    }
    setFormError("");
    setUploadingSchemas(true);
    try {
      await gravar(async () => {
        await uploadSchemas(file, editing.id);
        await loadData();
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao salvar schemas.");
    } finally {
      setUploadingSchemas(false);
      if (schemasInputRef.current) schemasInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.razao_social.trim()) {
      setFormError("Informe a razão social.");
      setTab("geral");
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
        const { data, error } = await supabase
          .from("filial")
          .insert({
            ...payload,
            codigo,
          })
          .select(
            "id, codigo, razao_social, fantasia, cnpj, inscricao_estadual, inscricao_municipal, cep, endereco, endereco_numero, endereco_bairro, endereco_uf, endereco_cidade, telefone, status, certificado_nome, certificado_storage_path, certificado_senha, schemas_storage_path, schemas_atualizado_em, ult_nsu",
          )
          .single();
        if (error) throw new Error(error.message);
        // Mantém modal aberto na aba fiscal para upload após criar
        setEditing(data as Filial);
        syncFiscalState(data as Filial);
        setTab("fiscal");
        await loadData();
        return;
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
          disabled={busy || uploadingCert || uploadingSchemas}
          width={720}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions
              onCancel={closeModal}
              disabled={busy || uploadingCert || uploadingSchemas}
              busy={busy}
              submitLabel={editing ? "Salvar" : "Salvar e continuar"}
            />
          }
        >
          <input
            ref={certInputRef}
            type="file"
            accept=".pfx,.p12,application/x-pkcs12,application/pkcs12"
            style={{ display: "none" }}
            onChange={(e) => void onCertFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={schemasInputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            style={{ display: "none" }}
            onChange={(e) => void onSchemasFile(e.target.files?.[0] ?? null)}
          />

          <div className="cadastro-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`cadastro-tab${tab === item.id ? " active" : ""}`}
                onClick={() => setTab(item.id)}
                disabled={busy || uploadingCert || uploadingSchemas}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "geral" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
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
            </div>
          ) : null}

          {tab === "fiscal" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              {!editing ? (
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.45,
                  }}
                >
                  Salve a filial na aba <strong>Geral</strong> primeiro para liberar
                  o upload do certificado e dos schemas.
                </p>
              ) : null}

              <CadastroFormGrid>
                <CadastroField label="Certificado A1" htmlFor="certificado" span="full">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      id="certificado"
                      className="input-base input-compact"
                      value={certNome || ""}
                      readOnly
                      placeholder="Nenhum certificado enviado"
                      disabled={busy || uploadingCert}
                      style={{ flex: "1 1 220px" }}
                    />
                    <button
                      type="button"
                      className="cadastro-btn-edit"
                      disabled={busy || uploadingCert || !editing}
                      onClick={() => certInputRef.current?.click()}
                      title="Upload do certificado .pfx / .p12"
                    >
                      <Upload size={12} />
                      {uploadingCert ? "Enviando…" : "Upload certificado"}
                    </button>
                  </div>
                  {certPath ? (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                      Arquivo no storage: <code>{certPath}</code>
                    </p>
                  ) : null}
                </CadastroField>

                <CadastroField label="Senha do certificado" htmlFor="certificado_senha" span="full">
                  <input
                    id="certificado_senha"
                    type="password"
                    className="input-base input-compact"
                    value={form.certificado_senha}
                    onChange={(e) => updateField("certificado_senha", e.target.value)}
                    disabled={busy}
                    autoComplete="new-password"
                    placeholder="Senha do arquivo .pfx"
                  />
                </CadastroField>

                <CadastroField label="Última NSU (SEFAZ)" htmlFor="ult_nsu" span="full">
                  <input
                    id="ult_nsu"
                    className="input-base input-compact"
                    value={form.ult_nsu}
                    onChange={(e) =>
                      updateField("ult_nsu", e.target.value.replace(/\D/g, "").slice(0, 30))
                    }
                    disabled={busy}
                    inputMode="numeric"
                    placeholder="0"
                  />
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                    Cursor da distribuição DF-e. Atualizado automaticamente ao consultar a
                    SEFAZ na digitação de notas.
                  </p>
                </CadastroField>

                <CadastroField label="Schemas NF-e / NFC-e" htmlFor="schemas" span="full">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      id="schemas"
                      className="input-base input-compact"
                      value={
                        schemasPath
                          ? schemasPath.split("/").pop() || schemasPath
                          : ""
                      }
                      readOnly
                      placeholder="Nenhum pacote de schemas salvo"
                      disabled={busy || uploadingSchemas}
                      style={{ flex: "1 1 220px" }}
                    />
                    <button
                      type="button"
                      className="cadastro-btn-edit"
                      disabled={busy || uploadingSchemas || !editing}
                      onClick={() => schemasInputRef.current?.click()}
                      title="Salvar schemas (ZIP com XSDs) para emissão"
                    >
                      <FolderArchive size={12} />
                      {uploadingSchemas ? "Salvando…" : "Salvar schemas"}
                    </button>
                  </div>
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
                    Envie um arquivo <strong>.zip</strong> com os XSDs oficiais usados na
                    validação/emissão de NF-e e NFC-e.
                    {schemasAt
                      ? ` Última atualização: ${formatDateTimeBr(schemasAt)}.`
                      : ""}
                  </p>
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}

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
