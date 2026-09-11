"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MonitorSmartphone } from "lucide-react";
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

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type ConfigPdv = {
  id: string;
  filial: string;
  pdv: number;
  tipo: number | null;
  ip_tef: string | null;
  idterminal: string | null;
  idloja: string | null;
  cnpj: string | null;
  mensagempinpad: string | null;
  comexterna: number | null;
  otp: string | null;
  transacaohabilitadas: string | null;
  obrigadooperador: string | null;
  postipo: number | null;
  imprimevialoja: number | null;
  nfceserie: number | null;
  nfcenumero: number | null;
  modelo: number | null;
  otpnome: string | null;
  imprimebanri: number | null;
  aceitavalorparcial: string | null;
  vendaproduto: string | null;
  tipodocumento: string | null;
  nfeserie: number | null;
  nfenumero: number | null;
  obrigadobico: string | null;
  tlsexterna: string | null;
  tlstoken: string | null;
  tlstipoproxy: string | null;
  tlsenderecoproxy: string | null;
};

type ConfigPdvForm = {
  filial: string;
  pdv: string;
  tipo: string;
  ip_tef: string;
  idterminal: string;
  idloja: string;
  cnpj: string;
  mensagempinpad: string;
  comexterna: string;
  otp: string;
  transacaohabilitadas: string;
  obrigadooperador: string;
  postipo: string;
  imprimevialoja: string;
  nfceserie: string;
  nfcenumero: string;
  modelo: string;
  otpnome: string;
  imprimebanri: string;
  aceitavalorparcial: string;
  vendaproduto: string;
  tipodocumento: string;
  nfeserie: string;
  nfenumero: string;
  obrigadobico: string;
  tlsexterna: string;
  tlstoken: string;
  tlstipoproxy: string;
  tlsenderecoproxy: string;
};

type TabId = "geral" | "tef";

const emptyForm: ConfigPdvForm = {
  filial: "",
  pdv: "",
  tipo: "",
  ip_tef: "",
  idterminal: "",
  idloja: "",
  cnpj: "",
  mensagempinpad: "",
  comexterna: "",
  otp: "",
  transacaohabilitadas: "",
  obrigadooperador: "",
  postipo: "",
  imprimevialoja: "1",
  nfceserie: "1",
  nfcenumero: "1",
  modelo: "",
  otpnome: "",
  imprimebanri: "",
  aceitavalorparcial: "S",
  vendaproduto: "",
  tipodocumento: "",
  nfeserie: "1",
  nfenumero: "1",
  obrigadobico: "",
  tlsexterna: "",
  tlstoken: "",
  tlstipoproxy: "",
  tlsenderecoproxy: "",
};

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "tef", label: "TEF" },
];

const columns = [
  { key: "pdv", label: "PDV", align: "right" as const },
  { key: "filial", label: "Filial" },
  { key: "ip_tef", label: "IP TEF" },
  { key: "idterminal", label: "Terminal" },
  { key: "idloja", label: "Loja" },
  { key: "nfce", label: "NFC-e" },
  { key: "nfe", label: "NF-e" },
  { key: "acoes", label: "Ações", align: "center" as const },
];

const SELECT_COLS =
  "id, filial, pdv, tipo, ip_tef, idterminal, idloja, cnpj, mensagempinpad, comexterna, otp, transacaohabilitadas, obrigadooperador, postipo, imprimevialoja, nfceserie, nfcenumero, modelo, otpnome, imprimebanri, aceitavalorparcial, vendaproduto, tipodocumento, nfeserie, nfenumero, obrigadobico, tlsexterna, tlstoken, tlstipoproxy, tlsenderecoproxy";

function blank(v: string) {
  const t = v.trim();
  return t ? t : null;
}

function intOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number.parseInt(t, 10);
  return Number.isInteger(n) ? n : Number.NaN;
}

function intRequired(v: string): number | null {
  const n = intOrNull(v);
  if (n == null || Number.isNaN(n) || n <= 0) return null;
  return n;
}

function strOrEmpty(v: unknown) {
  return v != null ? String(v) : "";
}

function numOrEmpty(v: unknown) {
  return v != null && v !== "" ? String(v) : "";
}

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function mapRow(row: Record<string, unknown>): ConfigPdv {
  return {
    id: String(row.id),
    filial: String(row.filial),
    pdv: Number(row.pdv),
    tipo: row.tipo != null ? Number(row.tipo) : null,
    ip_tef: row.ip_tef != null ? String(row.ip_tef) : null,
    idterminal: row.idterminal != null ? String(row.idterminal) : null,
    idloja: row.idloja != null ? String(row.idloja) : null,
    cnpj: row.cnpj != null ? String(row.cnpj) : null,
    mensagempinpad:
      row.mensagempinpad != null ? String(row.mensagempinpad) : null,
    comexterna: row.comexterna != null ? Number(row.comexterna) : null,
    otp: row.otp != null ? String(row.otp) : null,
    transacaohabilitadas:
      row.transacaohabilitadas != null
        ? String(row.transacaohabilitadas)
        : null,
    obrigadooperador:
      row.obrigadooperador != null ? String(row.obrigadooperador) : null,
    postipo: row.postipo != null ? Number(row.postipo) : null,
    imprimevialoja:
      row.imprimevialoja != null ? Number(row.imprimevialoja) : null,
    nfceserie: row.nfceserie != null ? Number(row.nfceserie) : null,
    nfcenumero: row.nfcenumero != null ? Number(row.nfcenumero) : null,
    modelo: row.modelo != null ? Number(row.modelo) : null,
    otpnome: row.otpnome != null ? String(row.otpnome) : null,
    imprimebanri: row.imprimebanri != null ? Number(row.imprimebanri) : null,
    aceitavalorparcial:
      row.aceitavalorparcial != null ? String(row.aceitavalorparcial) : null,
    vendaproduto: row.vendaproduto != null ? String(row.vendaproduto) : null,
    tipodocumento:
      row.tipodocumento != null ? String(row.tipodocumento) : null,
    nfeserie: row.nfeserie != null ? Number(row.nfeserie) : null,
    nfenumero: row.nfenumero != null ? Number(row.nfenumero) : null,
    obrigadobico: row.obrigadobico != null ? String(row.obrigadobico) : null,
    tlsexterna: row.tlsexterna != null ? String(row.tlsexterna) : null,
    tlstoken: row.tlstoken != null ? String(row.tlstoken) : null,
    tlstipoproxy: row.tlstipoproxy != null ? String(row.tlstipoproxy) : null,
    tlsenderecoproxy:
      row.tlsenderecoproxy != null ? String(row.tlsenderecoproxy) : null,
  };
}

function toForm(item: ConfigPdv): ConfigPdvForm {
  return {
    filial: item.filial,
    pdv: String(item.pdv),
    tipo: numOrEmpty(item.tipo),
    ip_tef: strOrEmpty(item.ip_tef),
    idterminal: strOrEmpty(item.idterminal),
    idloja: strOrEmpty(item.idloja),
    cnpj: strOrEmpty(item.cnpj),
    mensagempinpad: strOrEmpty(item.mensagempinpad),
    comexterna: numOrEmpty(item.comexterna),
    otp: strOrEmpty(item.otp),
    transacaohabilitadas: strOrEmpty(item.transacaohabilitadas),
    obrigadooperador: strOrEmpty(item.obrigadooperador),
    postipo: numOrEmpty(item.postipo),
    imprimevialoja: numOrEmpty(item.imprimevialoja) || "1",
    nfceserie: numOrEmpty(item.nfceserie),
    nfcenumero: numOrEmpty(item.nfcenumero),
    modelo: numOrEmpty(item.modelo),
    otpnome: strOrEmpty(item.otpnome),
    imprimebanri: numOrEmpty(item.imprimebanri),
    aceitavalorparcial: strOrEmpty(item.aceitavalorparcial) || "S",
    vendaproduto: strOrEmpty(item.vendaproduto),
    tipodocumento: strOrEmpty(item.tipodocumento),
    nfeserie: numOrEmpty(item.nfeserie),
    nfenumero: numOrEmpty(item.nfenumero),
    obrigadobico: strOrEmpty(item.obrigadobico),
    tlsexterna: strOrEmpty(item.tlsexterna),
    tlstoken: strOrEmpty(item.tlstoken),
    tlstipoproxy: strOrEmpty(item.tlstipoproxy),
    tlsenderecoproxy: strOrEmpty(item.tlsenderecoproxy),
  };
}

export default function ConfiguracaoPdvPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [filialFiltro, setFilialFiltro] = useState("");
  const [items, setItems] = useState<ConfigPdv[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigPdv | null>(null);
  const [deleting, setDeleting] = useState<ConfigPdv | null>(null);
  const [form, setForm] = useState<ConfigPdvForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [tab, setTab] = useState<TabId>("geral");

  const filialById = useMemo(() => {
    const map = new Map<string, FilialOpt>();
    for (const f of filiais) map.set(f.id, f);
    return map;
  }, [filiais]);

  const loadLookups = useCallback(async () => {
    const { data } = await supabase
      .from("filial")
      .select("id, codigo, fantasia, razao_social")
      .eq("status", "ativo")
      .order("codigo");
    const list = (data ?? []).map((f) => ({
      id: String(f.id),
      codigo: String(f.codigo),
      fantasia: f.fantasia != null ? String(f.fantasia) : null,
      razao_social: String(f.razao_social ?? ""),
    }));
    setFiliais(list);
    if (list.length === 1) {
      setFilialFiltro((prev) => prev || list[0].id);
    }
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      let query = supabase
        .from("configuracao_tef")
        .select(SELECT_COLS)
        .order("pdv", { ascending: true });
      if (filialFiltro) query = query.eq("filial", filialFiltro);

      const { data, error } = await query;
      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }
      setItems((data ?? []).map((row) => mapRow(row as Record<string, unknown>)));
    });
  }, [pesquisar, filialFiltro]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setField = (key: keyof ConfigPdvForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      filial: filialFiltro || (filiais.length === 1 ? filiais[0].id : ""),
    });
    setFormError("");
    setTab("geral");
    setModalOpen(true);
  };

  const openEdit = (item: ConfigPdv) => {
    setEditing(item);
    setForm(toForm(item));
    setFormError("");
    setActionError("");
    setTab("geral");
    setModalOpen(true);
  };

  const openDelete = (item: ConfigPdv) => {
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

    if (!form.filial.trim()) {
      setFormError("Selecione a filial.");
      setTab("geral");
      return;
    }
    const pdv = intRequired(form.pdv);
    if (!pdv) {
      setFormError("Informe o número do PDV (inteiro maior que zero).");
      setTab("geral");
      return;
    }

    const parseOptInt = (label: string, value: string) => {
      const n = intOrNull(value);
      if (Number.isNaN(n)) {
        throw new Error(`${label} inválido.`);
      }
      return n;
    };

    try {
      const nfceserie = parseOptInt("Série NFC-e", form.nfceserie);
      const nfcenumero = parseOptInt("Número NFC-e", form.nfcenumero);
      const nfeserie = parseOptInt("Série NF-e", form.nfeserie);
      const nfenumero = parseOptInt("Número NF-e", form.nfenumero);

      if (nfceserie != null && nfceserie <= 0) {
        throw new Error("Série NFC-e deve ser maior que zero.");
      }
      if (nfcenumero != null && nfcenumero <= 0) {
        throw new Error("Número NFC-e deve ser maior que zero.");
      }
      if (nfeserie != null && nfeserie <= 0) {
        throw new Error("Série NF-e deve ser maior que zero.");
      }
      if (nfenumero != null && nfenumero <= 0) {
        throw new Error("Número NF-e deve ser maior que zero.");
      }

      const payload = {
        filial: form.filial.trim(),
        pdv,
        tipo: parseOptInt("Tipo", form.tipo),
        ip_tef: blank(form.ip_tef)?.slice(0, 30) ?? null,
        idterminal: blank(form.idterminal)?.slice(0, 50) ?? null,
        idloja: blank(form.idloja)?.slice(0, 50) ?? null,
        cnpj: blank(form.cnpj)?.replace(/\D/g, "").slice(0, 14) ?? null,
        mensagempinpad: blank(form.mensagempinpad)?.slice(0, 20) ?? null,
        comexterna: parseOptInt("Com. externa", form.comexterna),
        otp: blank(form.otp)?.slice(0, 50) ?? null,
        transacaohabilitadas:
          blank(form.transacaohabilitadas)?.slice(0, 90) ?? null,
        obrigadooperador: blank(form.obrigadooperador)?.slice(0, 1) ?? null,
        postipo: parseOptInt("POS tipo", form.postipo),
        imprimevialoja: parseOptInt("Imprime via loja", form.imprimevialoja) ?? 1,
        nfceserie,
        nfcenumero,
        modelo: parseOptInt("Modelo", form.modelo),
        otpnome: blank(form.otpnome)?.slice(0, 30) ?? null,
        imprimebanri: parseOptInt("Imprime Banri", form.imprimebanri),
        aceitavalorparcial:
          blank(form.aceitavalorparcial)?.slice(0, 1).toUpperCase() ?? "S",
        vendaproduto: blank(form.vendaproduto)?.slice(0, 1).toUpperCase() ?? null,
        tipodocumento:
          blank(form.tipodocumento)?.slice(0, 1).toUpperCase() ?? null,
        nfeserie,
        nfenumero,
        obrigadobico: blank(form.obrigadobico)?.slice(0, 1).toUpperCase() ?? null,
        tlsexterna: blank(form.tlsexterna)?.slice(0, 20) ?? null,
        tlstoken: blank(form.tlstoken)?.slice(0, 50) ?? null,
        tlstipoproxy: blank(form.tlstipoproxy)?.slice(0, 50) ?? null,
        tlsenderecoproxy: blank(form.tlsenderecoproxy)?.slice(0, 50) ?? null,
      };

      setFormError("");
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("configuracao_tef")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase
            .from("configuracao_tef")
            .insert(payload);
          if (error) throw new Error(error.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gravar.";
      if (/unique|duplicate|filial_pdv/i.test(msg)) {
        setFormError("Já existe configuração para esta filial e PDV.");
        setTab("geral");
      } else {
        setFormError(msg);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await gravar(async () => {
        const { error } = await supabase
          .from("configuracao_tef")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir a configuração.",
      );
    }
  };

  const rows = items.map((item) => {
    const fil = filialById.get(item.filial);
    return {
      pdv: item.pdv,
      filial: fil ? filialLabel(fil) : item.filial.slice(0, 8),
      ip_tef: item.ip_tef || "—",
      idterminal: item.idterminal || "—",
      idloja: item.idloja || "—",
      nfce:
        item.nfceserie != null || item.nfcenumero != null
          ? `S${item.nfceserie ?? "—"} / Nº ${item.nfcenumero ?? "—"}`
          : "—",
      nfe:
        item.nfeserie != null || item.nfenumero != null
          ? `S${item.nfeserie ?? "—"} / Nº ${item.nfenumero ?? "—"}`
          : "—",
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
          message={`Erro ao carregar configurações de PDV: ${loadError}`}
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
        title="Configuração PDV"
        description="Configuração TEF e numeração fiscal por filial e terminal"
        icon={<MonitorSmartphone size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo PDV"
        onAdd={busy ? undefined : openCreate}
        filters={
          <select
            className="input-base input-compact"
            value={filialFiltro}
            onChange={(e) => setFilialFiltro(e.target.value)}
            disabled={busy}
            style={{ minWidth: 240 }}
            aria-label="Filtrar por filial"
          >
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {filialLabel(f)}
              </option>
            ))}
          </select>
        }
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar PDV" : "Novo PDV"}
          titleId="config-pdv-title"
          subtitle={
            editing ? (
              <>
                PDV{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.pdv}
                </strong>
              </>
            ) : (
              "Dados gerais e configuração TEF"
            )
          }
          onClose={closeModal}
          disabled={busy}
          width={780}
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
                <CadastroField label="Filial *" htmlFor="cfg-filial">
                  <select
                    id="cfg-filial"
                    className="input-base input-compact"
                    value={form.filial}
                    onChange={(e) => setField("filial", e.target.value)}
                    disabled={busy || !!editing}
                    required
                  >
                    <option value="">— Selecione —</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {filialLabel(f)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="PDV *" htmlFor="cfg-pdv">
                  <input
                    id="cfg-pdv"
                    className="input-base input-compact"
                    value={form.pdv}
                    onChange={(e) =>
                      setField("pdv", e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    disabled={busy || !!editing}
                    required
                    placeholder="Ex.: 1"
                  />
                </CadastroField>

                <CadastroField label="Tipo" htmlFor="cfg-tipo">
                  <input
                    id="cfg-tipo"
                    className="input-base input-compact"
                    value={form.tipo}
                    onChange={(e) =>
                      setField(
                        "tipo",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Modelo" htmlFor="cfg-modelo">
                  <input
                    id="cfg-modelo"
                    className="input-base input-compact"
                    value={form.modelo}
                    onChange={(e) =>
                      setField(
                        "modelo",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="CNPJ" htmlFor="cfg-cnpj">
                  <input
                    id="cfg-cnpj"
                    className="input-base input-compact"
                    value={form.cnpj}
                    onChange={(e) =>
                      setField(
                        "cnpj",
                        e.target.value.replace(/\D/g, "").slice(0, 14),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                    maxLength={14}
                  />
                </CadastroField>

                <CadastroField label="POS tipo" htmlFor="cfg-postipo">
                  <input
                    id="cfg-postipo"
                    className="input-base input-compact"
                    value={form.postipo}
                    onChange={(e) =>
                      setField(
                        "postipo",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Tipo documento" htmlFor="cfg-tipodoc">
                  <input
                    id="cfg-tipodoc"
                    className="input-base input-compact"
                    value={form.tipodocumento}
                    onChange={(e) =>
                      setField(
                        "tipodocumento",
                        e.target.value.slice(0, 1).toUpperCase(),
                      )
                    }
                    disabled={busy}
                    maxLength={1}
                  />
                </CadastroField>

                <CadastroField label="Venda produto" htmlFor="cfg-vendaprod">
                  <input
                    id="cfg-vendaprod"
                    className="input-base input-compact"
                    value={form.vendaproduto}
                    onChange={(e) =>
                      setField(
                        "vendaproduto",
                        e.target.value.slice(0, 1).toUpperCase(),
                      )
                    }
                    disabled={busy}
                    maxLength={1}
                  />
                </CadastroField>

                <CadastroField label="Obrigado bico" htmlFor="cfg-obgbico">
                  <input
                    id="cfg-obgbico"
                    className="input-base input-compact"
                    value={form.obrigadobico}
                    onChange={(e) =>
                      setField(
                        "obrigadobico",
                        e.target.value.slice(0, 1).toUpperCase(),
                      )
                    }
                    disabled={busy}
                    maxLength={1}
                  />
                </CadastroField>

                <CadastroField label="NFC-e série" htmlFor="cfg-nfceserie">
                  <input
                    id="cfg-nfceserie"
                    className="input-base input-compact"
                    value={form.nfceserie}
                    onChange={(e) =>
                      setField(
                        "nfceserie",
                        e.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                    placeholder="1"
                  />
                </CadastroField>

                <CadastroField label="NFC-e próximo nº" htmlFor="cfg-nfcenumero">
                  <input
                    id="cfg-nfcenumero"
                    className="input-base input-compact"
                    value={form.nfcenumero}
                    onChange={(e) =>
                      setField(
                        "nfcenumero",
                        e.target.value.replace(/\D/g, "").slice(0, 9),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                    placeholder="1"
                  />
                </CadastroField>

                <CadastroField label="NF-e série" htmlFor="cfg-nfeserie">
                  <input
                    id="cfg-nfeserie"
                    className="input-base input-compact"
                    value={form.nfeserie}
                    onChange={(e) =>
                      setField(
                        "nfeserie",
                        e.target.value.replace(/\D/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                    placeholder="1"
                  />
                </CadastroField>

                <CadastroField label="NF-e próximo nº" htmlFor="cfg-nfenumero">
                  <input
                    id="cfg-nfenumero"
                    className="input-base input-compact"
                    value={form.nfenumero}
                    onChange={(e) =>
                      setField(
                        "nfenumero",
                        e.target.value.replace(/\D/g, "").slice(0, 9),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                    placeholder="1"
                  />
                </CadastroField>

                <p
                  style={{
                    gridColumn: "1 / -1",
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: "var(--text-muted)",
                    lineHeight: 1.45,
                  }}
                >
                  O próximo número é reservado e incrementado automaticamente ao
                  fechar a venda no PDV.
                </p>
              </CadastroFormGrid>
            </div>
          ) : null}

          {tab === "tef" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="IP TEF" htmlFor="cfg-ip">
                  <input
                    id="cfg-ip"
                    className="input-base input-compact"
                    value={form.ip_tef}
                    onChange={(e) =>
                      setField("ip_tef", e.target.value.slice(0, 30))
                    }
                    disabled={busy}
                    placeholder="192.168.x.x"
                    maxLength={30}
                  />
                </CadastroField>

                <CadastroField label="ID Terminal" htmlFor="cfg-terminal">
                  <input
                    id="cfg-terminal"
                    className="input-base input-compact"
                    value={form.idterminal}
                    onChange={(e) =>
                      setField("idterminal", e.target.value.slice(0, 50))
                    }
                    disabled={busy}
                    maxLength={50}
                  />
                </CadastroField>

                <CadastroField label="ID Loja" htmlFor="cfg-loja">
                  <input
                    id="cfg-loja"
                    className="input-base input-compact"
                    value={form.idloja}
                    onChange={(e) =>
                      setField("idloja", e.target.value.slice(0, 50))
                    }
                    disabled={busy}
                    maxLength={50}
                  />
                </CadastroField>

                <CadastroField label="Mensagem pinpad" htmlFor="cfg-msgpin">
                  <input
                    id="cfg-msgpin"
                    className="input-base input-compact"
                    value={form.mensagempinpad}
                    onChange={(e) =>
                      setField("mensagempinpad", e.target.value.slice(0, 20))
                    }
                    disabled={busy}
                    maxLength={20}
                  />
                </CadastroField>

                <CadastroField label="Transações habilitadas" htmlFor="cfg-tranh">
                  <input
                    id="cfg-tranh"
                    className="input-base input-compact"
                    value={form.transacaohabilitadas}
                    onChange={(e) =>
                      setField(
                        "transacaohabilitadas",
                        e.target.value.slice(0, 90),
                      )
                    }
                    disabled={busy}
                    maxLength={90}
                  />
                </CadastroField>

                <CadastroField label="Com. externa" htmlFor="cfg-comext">
                  <input
                    id="cfg-comext"
                    className="input-base input-compact"
                    value={form.comexterna}
                    onChange={(e) =>
                      setField(
                        "comexterna",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Obrigado operador" htmlFor="cfg-obgop">
                  <input
                    id="cfg-obgop"
                    className="input-base input-compact"
                    value={form.obrigadooperador}
                    onChange={(e) =>
                      setField("obrigadooperador", e.target.value.slice(0, 1))
                    }
                    disabled={busy}
                    maxLength={1}
                  />
                </CadastroField>

                <CadastroField label="Imprime via loja" htmlFor="cfg-imprloja">
                  <input
                    id="cfg-imprloja"
                    className="input-base input-compact"
                    value={form.imprimevialoja}
                    onChange={(e) =>
                      setField(
                        "imprimevialoja",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Aceita valor parcial" htmlFor="cfg-parcial">
                  <select
                    id="cfg-parcial"
                    className="input-base input-compact"
                    value={form.aceitavalorparcial}
                    onChange={(e) =>
                      setField("aceitavalorparcial", e.target.value)
                    }
                    disabled={busy}
                  >
                    <option value="S">Sim</option>
                    <option value="N">Não</option>
                  </select>
                </CadastroField>

                <CadastroField label="Imprime Banri" htmlFor="cfg-banri">
                  <input
                    id="cfg-banri"
                    className="input-base input-compact"
                    value={form.imprimebanri}
                    onChange={(e) =>
                      setField(
                        "imprimebanri",
                        e.target.value.replace(/[^\d-]/g, "").slice(0, 6),
                      )
                    }
                    inputMode="numeric"
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="OTP" htmlFor="cfg-otp">
                  <input
                    id="cfg-otp"
                    className="input-base input-compact"
                    value={form.otp}
                    onChange={(e) => setField("otp", e.target.value.slice(0, 50))}
                    disabled={busy}
                    maxLength={50}
                  />
                </CadastroField>

                <CadastroField label="OTP nome" htmlFor="cfg-otpnome">
                  <input
                    id="cfg-otpnome"
                    className="input-base input-compact"
                    value={form.otpnome}
                    onChange={(e) =>
                      setField("otpnome", e.target.value.slice(0, 30))
                    }
                    disabled={busy}
                    maxLength={30}
                  />
                </CadastroField>

                <CadastroField label="TLS externa" htmlFor="cfg-tlsext">
                  <input
                    id="cfg-tlsext"
                    className="input-base input-compact"
                    value={form.tlsexterna}
                    onChange={(e) =>
                      setField("tlsexterna", e.target.value.slice(0, 20))
                    }
                    disabled={busy}
                    maxLength={20}
                  />
                </CadastroField>

                <CadastroField label="TLS token" htmlFor="cfg-tlstoken">
                  <input
                    id="cfg-tlstoken"
                    className="input-base input-compact"
                    value={form.tlstoken}
                    onChange={(e) =>
                      setField("tlstoken", e.target.value.slice(0, 50))
                    }
                    disabled={busy}
                    maxLength={50}
                  />
                </CadastroField>

                <CadastroField label="TLS tipo proxy" htmlFor="cfg-tlsproxy">
                  <input
                    id="cfg-tlsproxy"
                    className="input-base input-compact"
                    value={form.tlstipoproxy}
                    onChange={(e) =>
                      setField("tlstipoproxy", e.target.value.slice(0, 50))
                    }
                    disabled={busy}
                    maxLength={50}
                  />
                </CadastroField>

                <CadastroField label="TLS endereço proxy" htmlFor="cfg-tlsend">
                  <input
                    id="cfg-tlsend"
                    className="input-base input-compact"
                    value={form.tlsenderecoproxy}
                    onChange={(e) =>
                      setField("tlsenderecoproxy", e.target.value.slice(0, 50))
                    }
                    disabled={busy}
                    maxLength={50}
                  />
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}

          <CadastroFormError message={formError} onClose={() => setFormError("")} />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir configuração de PDV"
          titleId="config-pdv-delete-title"
          onClose={closeDelete}
          disabled={busy}
          width={420}
          footer={
            <CadastroFormActions
              onCancel={closeDelete}
              onConfirm={handleDelete}
              submitLabel="Excluir"
              disabled={busy}
              busy={busy}
              danger
            />
          }
        >
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
            Excluir a configuração do PDV <strong>{deleting.pdv}</strong>
            {filialById.get(deleting.filial)
              ? ` da filial ${filialLabel(filialById.get(deleting.filial)!)}`
              : ""}
            ?
          </p>
          {actionError ? (
            <CadastroFormError
              message={actionError}
              onClose={() => setActionError("")}
            />
          ) : null}
        </CadastroModal>
      ) : null}
    </>
  );
}
