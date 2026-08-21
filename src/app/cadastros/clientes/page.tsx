"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
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
import { consultarCnpj } from "@/components/barrapdv/services/document/cnpjPublic";
import {
  formatCpfCnpj,
  isValidCnpj,
  onlyDigits,
} from "@/components/barrapdv/services/document/documentValidator";

type Cliente = {
  id: string;
  codigo: string;
  nome: string;
  nome_fantasia: string | null;
  cpf_cnpj: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: number | null;
  uf: string | null;
  fone1: string | null;
  fone2: string | null;
  fone3: string | null;
  inscricao_estadual: string | null;
  identidade: string | null;
  inscricao_municipal: string | null;
  email: string | null;
  email2: string | null;
  contato: string | null;
  restricoes: string | null;
  mensagem: string | null;
  obriga_placa_venda: boolean | null;
  libera_veiculo_nao_cadastrado: boolean | null;
  obriga_km: boolean | null;
  controla_frota: boolean | null;
  obriga_autorizacao: boolean | null;
  envia_nfce_venda: boolean | null;
  obriga_motorista: boolean | null;
  status: string | null;
};

type VeiculoForm = {
  key: string;
  id?: string;
  placa: string;
  descricao: string;
  frota: string;
  ultima_km: string;
  obrigado_km: boolean;
  obrigado_autorizacao: boolean;
};

type ClienteForm = {
  nome: string;
  nome_fantasia: string;
  cpf_cnpj: string;
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  fone1: string;
  fone2: string;
  fone3: string;
  inscricao_estadual: string;
  identidade: string;
  inscricao_municipal: string;
  email: string;
  email2: string;
  contato: string;
  restricoes: string;
  mensagem: string;
  obriga_placa_venda: boolean;
  libera_veiculo_nao_cadastrado: boolean;
  obriga_km: boolean;
  controla_frota: boolean;
  obriga_autorizacao: boolean;
  envia_nfce_venda: boolean;
  obriga_motorista: boolean;
};

type UfRow = { codigo: string; descricao: string };
type CidadeRow = { codigo: string; descricao: string; uf: string };
type TabId = "geral" | "outras" | "veiculos";

const emptyForm: ClienteForm = {
  nome: "",
  nome_fantasia: "",
  cpf_cnpj: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: "",
  fone1: "",
  fone2: "",
  fone3: "",
  inscricao_estadual: "",
  identidade: "",
  inscricao_municipal: "",
  email: "",
  email2: "",
  contato: "",
  restricoes: "",
  mensagem: "",
  obriga_placa_venda: false,
  libera_veiculo_nao_cadastrado: false,
  obriga_km: false,
  controla_frota: false,
  obriga_autorizacao: false,
  envia_nfce_venda: false,
  obriga_motorista: false,
};

const emptyVeiculo = (): VeiculoForm => ({
  key: crypto.randomUUID(),
  placa: "",
  descricao: "",
  frota: "",
  ultima_km: "",
  obrigado_km: false,
  obrigado_autorizacao: false,
});

const columns = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Nome / Razão Social" },
  { key: "cpfCnpj", label: "CPF / CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "telefone", label: "Telefone" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "outras", label: "Outras informações" },
  { id: "veiculos", label: "Veículos" },
];

async function nextCodigoCliente() {
  const { data } = await supabase
    .from("clientes")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(50);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `CLI-${String(max + 1).padStart(3, "0")}`;
}

function blank(v: string) {
  const t = v.trim();
  return t ? t : null;
}

function toForm(item: Cliente): ClienteForm {
  return {
    nome: item.nome ?? "",
    nome_fantasia: item.nome_fantasia ?? "",
    cpf_cnpj: item.cpf_cnpj ?? "",
    cep: item.cep ?? "",
    endereco: item.endereco ?? "",
    numero: item.numero ?? "",
    complemento: item.complemento ?? "",
    bairro: item.bairro ?? "",
    cidade: item.cidade != null ? String(item.cidade) : "",
    uf: item.uf ?? "",
    fone1: item.fone1 ?? "",
    fone2: item.fone2 ?? "",
    fone3: item.fone3 ?? "",
    inscricao_estadual: item.inscricao_estadual ?? "",
    identidade: item.identidade ?? "",
    inscricao_municipal: item.inscricao_municipal ?? "",
    email: item.email ?? "",
    email2: item.email2 ?? "",
    contato: item.contato ?? "",
    observacao: item.observacao ?? "",
    restricoes: item.restricoes ?? "",
    mensagem: item.mensagem ?? "",
    obriga_placa_venda: Boolean(item.obriga_placa_venda),
    libera_veiculo_nao_cadastrado: Boolean(item.libera_veiculo_nao_cadastrado),
    obriga_km: Boolean(item.obriga_km),
    controla_frota: Boolean(item.controla_frota),
    obriga_autorizacao: Boolean(item.obriga_autorizacao),
    envia_nfce_venda: Boolean(item.envia_nfce_venda),
    obriga_motorista: Boolean(item.obriga_motorista),
  };
}

function toClientePayload(form: ClienteForm) {
  const cidadeCodigo = form.cidade.trim() ? Number(form.cidade) : null;
  return {
    nome: form.nome.trim(),
    nome_fantasia: blank(form.nome_fantasia),
    cpf_cnpj: blank(form.cpf_cnpj),
    cep: blank(form.cep),
    endereco: blank(form.endereco),
    numero: blank(form.numero),
    complemento: blank(form.complemento),
    bairro: blank(form.bairro),
    cidade: Number.isFinite(cidadeCodigo) ? cidadeCodigo : null,
    uf: blank(form.uf)?.toUpperCase() ?? null,
    fone1: blank(form.fone1),
    fone2: blank(form.fone2),
    fone3: blank(form.fone3),
    inscricao_estadual: blank(form.inscricao_estadual),
    identidade: blank(form.identidade),
    inscricao_municipal: blank(form.inscricao_municipal),
    email: blank(form.email),
    email2: blank(form.email2),
    contato: blank(form.contato),
    observacao: blank(form.observacao),
    restricoes: blank(form.restricoes),
    mensagem: blank(form.mensagem)?.slice(0, 200) ?? null,
    obriga_placa_venda: form.obriga_placa_venda,
    libera_veiculo_nao_cadastrado: form.libera_veiculo_nao_cadastrado,
    obriga_km: form.obriga_km,
    controla_frota: form.controla_frota,
    obriga_autorizacao: form.obriga_autorizacao,
    envia_nfce_venda: form.envia_nfce_venda,
    obriga_motorista: form.obriga_motorista,
  };
}

function toVeiculoPayload(v: VeiculoForm, clienteId: string) {
  const km = v.ultima_km.trim() ? Number(v.ultima_km.replace(",", ".")) : null;
  return {
    cliente_id: clienteId,
    placa: v.placa.trim().toUpperCase(),
    descricao: blank(v.descricao),
    frota: blank(v.frota),
    ultima_km: Number.isFinite(km) ? km : null,
    obrigado_km: v.obrigado_km,
    obrigado_autorizacao: v.obrigado_autorizacao,
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

export default function ClientesPage() {
  const { busy, pesquisar, gravar, consultar } = useDbStatus();
  const [items, setItems] = useState<Cliente[]>([]);
  const [cidadeNomes, setCidadeNomes] = useState<Record<string, string>>({});
  const [ufs, setUfs] = useState<UfRow[]>([]);
  const [cidadesUf, setCidadesUf] = useState<CidadeRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [deleting, setDeleting] = useState<Cliente | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [veiculos, setVeiculos] = useState<VeiculoForm[]>([]);
  const [veiculoDraft, setVeiculoDraft] = useState<VeiculoForm>(emptyVeiculo());
  const [editingVeiculoKey, setEditingVeiculoKey] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [tab, setTab] = useState<TabId>("geral");
  const lastConsultedCnpj = useRef("");
  const consultingRef = useRef(false);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("clientes")
        .select(
          "id, codigo, nome, nome_fantasia, cpf_cnpj, cep, endereco, numero, complemento, bairro, cidade, uf, fone1, fone2, fone3, inscricao_estadual, identidade, inscricao_municipal, email, email2, contato, observacao, restricoes, mensagem, obriga_placa_venda, libera_veiculo_nao_cadastrado, obriga_km, controla_frota, obriga_autorizacao, envia_nfce_venda, obriga_motorista, status",
        )
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        setCidadeNomes({});
        return;
      }

      const list = (data ?? []) as Cliente[];
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

  const updateField = (key: keyof ClienteForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateFlag = (key: keyof ClienteForm, value: boolean) => {
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
    if (digits.length === 11) {
      setFormError("A consulta automática funciona com CNPJ (14 dígitos).");
      return;
    }
    if (digits.length !== 14 || !isValidCnpj(digits)) {
      setFormError("Informe um CNPJ válido com 14 dígitos para consultar.");
      return;
    }
    if (consultingRef.current) return;
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
          cpf_cnpj: formatCpfCnpj(data.cnpj),
          nome: data.razaoSocial || data.name || prev.nome,
          nome_fantasia: data.fantasia || prev.nome_fantasia,
          cep: data.cep || prev.cep,
          endereco: data.address || prev.endereco,
          numero: data.number || prev.numero,
          complemento: data.complemento || prev.complemento,
          bairro: data.neighborhood || prev.bairro,
          uf: uf || prev.uf,
          cidade: cidadeCodigo || prev.cidade,
          fone1: data.phone || prev.fone1,
          inscricao_estadual: data.stateRegistration || prev.inscricao_estadual,
          email: data.email || prev.email,
        }));
      });
    } catch (err) {
      lastConsultedCnpj.current = "";
      setFormError(
        err instanceof Error ? err.message : "Não foi possível consultar o CNPJ.",
      );
    } finally {
      consultingRef.current = false;
    }
  }, [consultar]);

  const onCpfCnpjChange = (value: string) => {
    const formatted = formatCpfCnpj(value);
    const digits = onlyDigits(formatted);
    if (digits !== lastConsultedCnpj.current) {
      lastConsultedCnpj.current = "";
    }
    updateField("cpf_cnpj", formatted);
    if (digits.length === 14 && isValidCnpj(digits)) {
      void preencherPorCnpj(digits);
    }
  };

  const resetVeiculoDraft = () => {
    setVeiculoDraft(emptyVeiculo());
    setEditingVeiculoKey(null);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setVeiculos([]);
    resetVeiculoDraft();
    setFormError("");
    setActionError("");
    lastConsultedCnpj.current = "";
    setTab("geral");
    setModalOpen(true);
  };

  const openEdit = async (item: Cliente) => {
    setEditing(item);
    setForm(toForm(item));
    setFormError("");
    setActionError("");
    lastConsultedCnpj.current = onlyDigits(item.cpf_cnpj ?? "");
    setTab("geral");
    resetVeiculoDraft();
    setModalOpen(true);

    await pesquisar(async () => {
      const { data, error } = await supabase
        .from("veiculos")
        .select("id, placa, descricao, frota, ultima_km, obrigado_km, obrigado_autorizacao")
        .eq("cliente_id", item.id)
        .order("created_at", { ascending: true });

      if (error) {
        setFormError(error.message);
        setVeiculos([]);
        return;
      }

      setVeiculos(
        (data ?? []).map((row) => ({
          key: String(row.id),
          id: String(row.id),
          placa: String(row.placa ?? ""),
          descricao: String(row.descricao ?? ""),
          frota: String(row.frota ?? ""),
          ultima_km: row.ultima_km != null ? String(row.ultima_km) : "",
          obrigado_km: Boolean(row.obrigado_km),
          obrigado_autorizacao: Boolean(row.obrigado_autorizacao),
        })),
      );
    });
  };

  const openDelete = (item: Cliente) => {
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

  const addOrUpdateVeiculo = () => {
    const placa = veiculoDraft.placa.trim().toUpperCase();
    if (!placa) {
      setFormError("Informe a placa do veículo.");
      setTab("veiculos");
      return;
    }

    const duplicated = veiculos.some(
      (v) => v.placa.toUpperCase() === placa && v.key !== editingVeiculoKey,
    );
    if (duplicated) {
      setFormError("Já existe um veículo com essa placa neste cliente.");
      setTab("veiculos");
      return;
    }

    setFormError("");
    const next: VeiculoForm = {
      ...veiculoDraft,
      placa,
      key: editingVeiculoKey ?? veiculoDraft.key,
    };

    setVeiculos((prev) => {
      if (editingVeiculoKey) {
        return prev.map((v) => (v.key === editingVeiculoKey ? { ...next, id: v.id } : v));
      }
      return [...prev, next];
    });
    resetVeiculoDraft();
  };

  const editVeiculo = (item: VeiculoForm) => {
    setVeiculoDraft({ ...item });
    setEditingVeiculoKey(item.key);
    setFormError("");
  };

  const removeVeiculo = (key: string) => {
    setVeiculos((prev) => prev.filter((v) => v.key !== key));
    if (editingVeiculoKey === key) resetVeiculoDraft();
  };

  const syncVeiculos = async (clienteId: string) => {
    const { data: atuais, error: loadError } = await supabase
      .from("veiculos")
      .select("id")
      .eq("cliente_id", clienteId);
    if (loadError) throw new Error(loadError.message);

    const keepIds = new Set(veiculos.map((v) => v.id).filter(Boolean) as string[]);
    const toDelete = (atuais ?? [])
      .map((row) => String(row.id))
      .filter((id) => !keepIds.has(id));

    if (toDelete.length) {
      const { error } = await supabase.from("veiculos").delete().in("id", toDelete);
      if (error) throw new Error(error.message);
    }

    for (const v of veiculos) {
      const payload = toVeiculoPayload(v, clienteId);
      if (v.id) {
        const { error } = await supabase.from("veiculos").update(payload).eq("id", v.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("veiculos").insert(payload);
        if (error) throw new Error(error.message);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      setFormError("Informe o nome / razão social.");
      setTab("geral");
      return;
    }

    setFormError("");
    const payload = toClientePayload(form);

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("clientes")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
          await syncVeiculos(editing.id);
        } else {
          const codigo = await nextCodigoCliente();
          const { data, error } = await supabase
            .from("clientes")
            .insert({
              ...payload,
              codigo,
              status: "ativo",
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          if (!data?.id) throw new Error("Cliente gravado sem id.");
          await syncVeiculos(String(data.id));
        }
      });

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setVeiculos([]);
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
        const { error } = await supabase.from("clientes").delete().eq("id", deleting.id);
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
    nome: item.nome,
    cpfCnpj: item.cpf_cnpj || "—",
    cidade: item.cidade != null ? cidadeNomes[String(item.cidade)] || String(item.cidade) : "—",
    telefone: item.fone1 || "—",
    status: (
      <span className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}>
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
  }));

  return (
    <>
      {loadError ? (
        <div className="cadastro-alert">Erro ao carregar clientes: {loadError}</div>
      ) : null}

      {actionError && !deleting ? (
        <div className="cadastro-alert">{actionError}</div>
      ) : null}

      <ModulePage
        title="Clientes"
        description="Gerenciamento de clientes"
        icon={<Users size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Cliente"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Cliente" : "Novo Cliente"}
          titleId="cliente-title"
          subtitle={
            editing ? (
              <>
                Código: <strong style={{ color: "var(--text-secondary)" }}>{editing.codigo}</strong>
              </>
            ) : (
              "Código gerado automaticamente ao salvar"
            )
          }
          onClose={closeModal}
          disabled={busy}
          width={760}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions onCancel={closeModal} disabled={busy} busy={busy} />
          }
        >
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
                <CadastroField label="CPF / CNPJ" htmlFor="cpf_cnpj" span="full">
                  <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                    <input
                      id="cpf_cnpj"
                      className="input-base input-compact"
                      value={form.cpf_cnpj}
                      onChange={(e) => onCpfCnpjChange(e.target.value)}
                      onBlur={() => {
                        const digits = onlyDigits(form.cpf_cnpj);
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
                      onClick={() => void preencherPorCnpj(form.cpf_cnpj, true)}
                      disabled={busy}
                      title="Consultar CNPJ na Receita (publica.cnpj.ws)"
                    >
                      Consultar
                    </button>
                  </div>
                </CadastroField>

                <CadastroField label="Nome / Razão Social *" htmlFor="nome" span="full">
                  <input
                    id="nome"
                    className="input-base input-compact"
                    value={form.nome}
                    onChange={(e) => updateField("nome", e.target.value)}
                    required
                    disabled={busy}
                  />
                </CadastroField>
                <CadastroField label="Nome Fantasia" htmlFor="nome_fantasia" span={2}>
                  <input
                    id="nome_fantasia"
                    className="input-base input-compact"
                    value={form.nome_fantasia}
                    onChange={(e) => updateField("nome_fantasia", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="CEP" htmlFor="cep">
                  <input id="cep" className="input-base input-compact" value={form.cep} onChange={(e) => updateField("cep", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Endereço" htmlFor="endereco" span={2}>
                  <input id="endereco" className="input-base input-compact" value={form.endereco} onChange={(e) => updateField("endereco", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Número" htmlFor="numero">
                  <input id="numero" className="input-base input-compact" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Complemento" htmlFor="complemento">
                  <input id="complemento" className="input-base input-compact" value={form.complemento} onChange={(e) => updateField("complemento", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Bairro" htmlFor="bairro">
                  <input id="bairro" className="input-base input-compact" value={form.bairro} onChange={(e) => updateField("bairro", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="UF" htmlFor="uf">
                  <select
                    id="uf"
                    className="input-base input-compact"
                    value={form.uf}
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
                <CadastroField label="Cidade" htmlFor="cidade" span={2}>
                  <select
                    id="cidade"
                    className="input-base input-compact"
                    value={form.cidade}
                    onChange={(e) => updateField("cidade", e.target.value)}
                    disabled={busy || !form.uf}
                  >
                    <option value="">{form.uf ? "Selecione a cidade" : "Selecione a UF primeiro"}</option>
                    {cidadesUf.map((row) => (
                      <option key={row.codigo} value={String(row.codigo)}>
                        {row.descricao}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="Fone 1" htmlFor="fone1">
                  <input id="fone1" className="input-base input-compact" value={form.fone1} onChange={(e) => updateField("fone1", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Fone 2" htmlFor="fone2">
                  <input id="fone2" className="input-base input-compact" value={form.fone2} onChange={(e) => updateField("fone2", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Fone 3" htmlFor="fone3">
                  <input id="fone3" className="input-base input-compact" value={form.fone3} onChange={(e) => updateField("fone3", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Inscrição Estadual" htmlFor="inscricao_estadual">
                  <input id="inscricao_estadual" className="input-base input-compact" value={form.inscricao_estadual} onChange={(e) => updateField("inscricao_estadual", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Identidade" htmlFor="identidade">
                  <input id="identidade" className="input-base input-compact" value={form.identidade} onChange={(e) => updateField("identidade", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="Inscrição Municipal" htmlFor="inscricao_municipal">
                  <input id="inscricao_municipal" className="input-base input-compact" value={form.inscricao_municipal} onChange={(e) => updateField("inscricao_municipal", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="E-mail" htmlFor="email">
                  <input id="email" type="email" className="input-base input-compact" value={form.email} onChange={(e) => updateField("email", e.target.value)} disabled={busy} />
                </CadastroField>
                <CadastroField label="E-mail 2" htmlFor="email2">
                  <input id="email2" type="email" className="input-base input-compact" value={form.email2} onChange={(e) => updateField("email2", e.target.value)} disabled={busy} />
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}

          {tab === "outras" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="Contato" htmlFor="contato" span="full">
                  <input
                    id="contato"
                    className="input-base input-compact"
                    value={form.contato}
                    onChange={(e) => updateField("contato", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>
                <CadastroField label="Restrições" htmlFor="restricoes" span="full">
                  <textarea
                    id="restricoes"
                    className="input-base input-compact"
                    value={form.restricoes}
                    onChange={(e) => updateField("restricoes", e.target.value)}
                    disabled={busy}
                    rows={3}
                    style={{ resize: "vertical", minHeight: 64 }}
                  />
                </CadastroField>
                <CadastroField label="Mensagem" htmlFor="mensagem" span="full">
                  <textarea
                    id="mensagem"
                    className="input-base input-compact"
                    value={form.mensagem}
                    onChange={(e) => updateField("mensagem", e.target.value.slice(0, 200))}
                    disabled={busy}
                    rows={3}
                    maxLength={200}
                    style={{ resize: "vertical", minHeight: 64 }}
                  />
                  <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "right" }}>
                    {form.mensagem.length}/200
                  </div>
                </CadastroField>
                <CadastroField label="Observação" htmlFor="observacao" span="full">
                  <textarea
                    id="observacao"
                    className="input-base input-compact"
                    value={form.observacao}
                    onChange={(e) => updateField("observacao", e.target.value)}
                    disabled={busy}
                    rows={3}
                    style={{ resize: "vertical", minHeight: 64 }}
                  />
                </CadastroField>
              </CadastroFormGrid>

              <div className="cadastro-options-panel">
                <div className="cadastro-options-title">Opções na venda</div>
                <div className="cadastro-options-grid">
                  {(
                    [
                      ["obriga_placa_venda", "Obrigatório informar placa na venda"],
                      ["libera_veiculo_nao_cadastrado", "Libera veículo não cadastrado"],
                      ["obriga_km", "Obrigatório informar KM"],
                      ["controla_frota", "Controla frota"],
                      ["obriga_autorizacao", "Obrigatório informar autorização"],
                      ["envia_nfce_venda", "Envia NFC-e na venda"],
                      ["obriga_motorista", "Obrigatório informar motorista"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="cadastro-check">
                      <input
                        type="checkbox"
                        checked={Boolean(form[key])}
                        onChange={(e) => updateFlag(key, e.target.checked)}
                        disabled={busy}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === "veiculos" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="Placa *" htmlFor="vei-placa">
                  <input
                    id="vei-placa"
                    className="input-base input-compact"
                    value={veiculoDraft.placa}
                    onChange={(e) =>
                      setVeiculoDraft((prev) => ({ ...prev, placa: e.target.value.toUpperCase() }))
                    }
                    disabled={busy}
                    maxLength={10}
                  />
                </CadastroField>
                <CadastroField label="Descrição" htmlFor="vei-descricao" span={2}>
                  <input
                    id="vei-descricao"
                    className="input-base input-compact"
                    value={veiculoDraft.descricao}
                    onChange={(e) =>
                      setVeiculoDraft((prev) => ({ ...prev, descricao: e.target.value }))
                    }
                    disabled={busy}
                  />
                </CadastroField>
                <CadastroField label="Frota" htmlFor="vei-frota">
                  <input
                    id="vei-frota"
                    className="input-base input-compact"
                    value={veiculoDraft.frota}
                    onChange={(e) =>
                      setVeiculoDraft((prev) => ({ ...prev, frota: e.target.value }))
                    }
                    disabled={busy}
                  />
                </CadastroField>
                <CadastroField label="Última KM" htmlFor="vei-km">
                  <input
                    id="vei-km"
                    className="input-base input-compact"
                    value={veiculoDraft.ultima_km}
                    onChange={(e) =>
                      setVeiculoDraft((prev) => ({ ...prev, ultima_km: e.target.value }))
                    }
                    disabled={busy}
                    inputMode="decimal"
                  />
                </CadastroField>
                <CadastroField label="Obrigado KM" htmlFor="vei-obriga-km">
                  <select
                    id="vei-obriga-km"
                    className="input-base input-compact"
                    value={veiculoDraft.obrigado_km ? "sim" : "nao"}
                    onChange={(e) =>
                      setVeiculoDraft((prev) => ({
                        ...prev,
                        obrigado_km: e.target.value === "sim",
                      }))
                    }
                    disabled={busy}
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </CadastroField>
                <CadastroField label="Obrigado Autorização" htmlFor="vei-obriga-aut">
                  <select
                    id="vei-obriga-aut"
                    className="input-base input-compact"
                    value={veiculoDraft.obrigado_autorizacao ? "sim" : "nao"}
                    onChange={(e) =>
                      setVeiculoDraft((prev) => ({
                        ...prev,
                        obrigado_autorizacao: e.target.value === "sim",
                      }))
                    }
                    disabled={busy}
                  >
                    <option value="nao">Não</option>
                    <option value="sim">Sim</option>
                  </select>
                </CadastroField>
              </CadastroFormGrid>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                {editingVeiculoKey ? (
                  <button
                    type="button"
                    className="cadastro-btn-secondary"
                    onClick={resetVeiculoDraft}
                    disabled={busy}
                  >
                    Cancelar edição
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-primary btn-compact"
                  onClick={addOrUpdateVeiculo}
                  disabled={busy}
                >
                  {editingVeiculoKey ? "Atualizar veículo" : "Incluir veículo"}
                </button>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
                <table className="cadastro-mini-table">
                  <thead>
                    <tr>
                      <th>Placa</th>
                      <th>Descrição</th>
                      <th>Frota</th>
                      <th>Última KM</th>
                      <th>Obrig. KM</th>
                      <th>Obrig. Autorização</th>
                      <th style={{ textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {veiculos.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ color: "var(--text-muted)" }}>
                          Nenhum veículo informado.
                        </td>
                      </tr>
                    ) : (
                      veiculos.map((v) => (
                        <tr key={v.key}>
                          <td>{v.placa}</td>
                          <td>{v.descricao || "—"}</td>
                          <td>{v.frota || "—"}</td>
                          <td>{v.ultima_km || "—"}</td>
                          <td>{v.obrigado_km ? "Sim" : "Não"}</td>
                          <td>{v.obrigado_autorizacao ? "Sim" : "Não"}</td>
                          <td style={{ textAlign: "center" }}>
                            <CadastroRowActions
                              disabled={busy}
                              onEdit={() => editVeiculo(v)}
                              onDelete={() => removeVeiculo(v.key)}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <CadastroFormError message={formError} />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir cliente"
          titleId="cliente-delete-title"
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
              {deleting.codigo} — {deleting.nome}
            </strong>
            ? Os veículos vinculados também serão removidos.
          </p>
          <CadastroFormError message={actionError} />
        </CadastroModal>
      ) : null}
    </>
  );
}
