"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Fuel } from "lucide-react";
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

type TanqueOpt = {
  id: string;
  numero: string;
  descricao: string;
  produto_id: string | null;
  filial: string | null;
};

type ProdutoOpt = {
  id: string;
  codigo: string;
  descricao: string;
  preco_venda: number | null;
};

type Bico = {
  id: string;
  numero: string;
  identificacao_bomba: string;
  codigo_concentrador: string | null;
  tanque_id: string | null;
  produto_id: string | null;
  preco_atual: number | null;
  status: string | null;
  filial: string | null;
  tanques?: { numero: string; descricao: string } | null;
  produtos?: { codigo: string; descricao: string } | null;
  filial_row?: { codigo: string; fantasia: string | null } | null;
};

type BicoForm = {
  filial: string;
  numero: string;
  tanque_id: string;
  produto_id: string;
  codigo_concentrador: string;
};

const emptyForm: BicoForm = {
  filial: "",
  numero: "",
  tanque_id: "",
  produto_id: "",
  codigo_concentrador: "",
};

const columns = [
  { key: "numero", label: "Nº Bico" },
  { key: "filial", label: "Filial" },
  { key: "tanque", label: "Tanque" },
  { key: "produto", label: "Produto" },
  { key: "concentrador", label: "Cód. Concentrador" },
  { key: "preco", label: "Preço (R$)", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function statusBadge(status: string | null) {
  const s = (status || "livre").toLowerCase();
  const cls =
    s === "livre"
      ? "badge-success"
      : s === "em uso" || s === "abastecendo"
        ? "badge-warning"
        : "badge-danger";
  return <span className={`badge ${cls}`}>{status || "livre"}</span>;
}

export default function BicosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Bico[]>([]);
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [tanques, setTanques] = useState<TanqueOpt[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bico | null>(null);
  const [deleting, setDeleting] = useState<Bico | null>(null);
  const [form, setForm] = useState<BicoForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const loadLookups = useCallback(async () => {
    const [filRes, tanRes, prodRes] = await Promise.all([
      supabase
        .from("filial")
        .select("id, codigo, fantasia, razao_social")
        .order("codigo", { ascending: true }),
      supabase
        .from("tanques")
        .select("id, numero, descricao, produto_id, filial")
        .order("numero", { ascending: true }),
      supabase
        .from("produtos")
        .select("id, codigo, descricao, preco_venda")
        .order("descricao", { ascending: true }),
    ]);
    if (!filRes.error) setFiliais((filRes.data as FilialOpt[]) ?? []);
    if (!tanRes.error) setTanques((tanRes.data as TanqueOpt[]) ?? []);
    if (!prodRes.error) setProdutos((prodRes.data as ProdutoOpt[]) ?? []);
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("bicos")
        .select(
          `
          id, numero, identificacao_bomba, codigo_concentrador,
          tanque_id, produto_id, preco_atual, status, filial,
          tanques ( numero, descricao ),
          produtos ( codigo, descricao )
        `,
        )
        .order("numero", { ascending: true });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      const rows = (data ?? []) as Omit<Bico, "filial_row">[];
      const filialIds = [
        ...new Set(rows.map((r) => r.filial).filter(Boolean) as string[]),
      ];
      let filialMap = new Map<string, { codigo: string; fantasia: string | null }>();
      if (filialIds.length) {
        const { data: fils } = await supabase
          .from("filial")
          .select("id, codigo, fantasia")
          .in("id", filialIds);
        filialMap = new Map(
          (fils ?? []).map((f) => [
            f.id as string,
            { codigo: f.codigo as string, fantasia: f.fantasia as string | null },
          ]),
        );
      }

      setItems(
        rows.map((r) => ({
          ...r,
          filial_row: r.filial ? filialMap.get(r.filial) ?? null : null,
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadLookups();
    void loadData();
  }, [loadLookups, loadData]);

  const tanquesFiltrados = useMemo(() => {
    if (!form.filial) return tanques;
    return tanques.filter((t) => !t.filial || t.filial === form.filial);
  }, [tanques, form.filial]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      filial: filiais.length === 1 ? filiais[0].id : "",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openEdit = (item: Bico) => {
    setEditing(item);
    setForm({
      filial: item.filial ?? "",
      numero: item.numero ?? "",
      tanque_id: item.tanque_id ?? "",
      produto_id: item.produto_id ?? "",
      codigo_concentrador:
        item.codigo_concentrador || item.identificacao_bomba || "",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: Bico) => {
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

  const setField = <K extends keyof BicoForm>(key: K, value: BicoForm[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "filial") {
        const stillOk = tanques.some(
          (t) =>
            t.id === next.tanque_id &&
            (!t.filial || t.filial === value || !value),
        );
        if (!stillOk) next.tanque_id = "";
      }
      if (key === "tanque_id" && value) {
        const tank = tanques.find((t) => t.id === value);
        if (tank?.produto_id) next.produto_id = tank.produto_id;
      }
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const numero = form.numero.trim();
    const codigoConc = form.codigo_concentrador.trim();
    if (!form.filial) {
      setFormError("Selecione a filial.");
      return;
    }
    if (!numero) {
      setFormError("Informe o número do bico.");
      return;
    }
    if (!form.tanque_id) {
      setFormError("Selecione o tanque.");
      return;
    }
    if (!form.produto_id) {
      setFormError("Selecione o produto do bico.");
      return;
    }
    if (!codigoConc) {
      setFormError("Informe o código do bico no concentrador.");
      return;
    }

    setFormError("");
    const produto = produtos.find((p) => p.id === form.produto_id);
    const preco = produto?.preco_venda != null ? Number(produto.preco_venda) : 0;

    const payload = {
      numero,
      identificacao_bomba: codigoConc,
      codigo_concentrador: codigoConc,
      tanque_id: form.tanque_id,
      produto_id: form.produto_id,
      filial: form.filial,
      preco_atual: preco,
      status: editing?.status || "livre",
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("bicos")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("bicos").insert(payload);
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
        const { error } = await supabase
          .from("bicos")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o bico.",
      );
    }
  };

  const rows = items.map((item) => {
    const fil = item.filial_row;
    const filLabel = fil
      ? `${fil.codigo}${fil.fantasia ? ` — ${fil.fantasia}` : ""}`
      : "—";
    return {
      numero: item.numero,
      filial: filLabel,
      tanque: item.tanques
        ? `${item.tanques.numero} — ${item.tanques.descricao}`
        : "—",
      produto: item.produtos
        ? `${item.produtos.codigo} — ${item.produtos.descricao}`
        : "—",
      concentrador:
        item.codigo_concentrador || item.identificacao_bomba || "—",
      preco: Number(item.preco_atual ?? 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
      status: statusBadge(item.status),
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
        <div className="cadastro-alert">Erro ao carregar bicos: {loadError}</div>
      ) : null}
      {actionError && !deleting ? (
        <div className="cadastro-alert">{actionError}</div>
      ) : null}

      <ModulePage
        title="Bicos"
        description="Configuração de bicos de bombas"
        icon={<Fuel size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Bico"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Bico" : "Novo Bico"}
          titleId="bico-title"
          subtitle={
            editing ? (
              <>
                Número:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.numero}
                </strong>
              </>
            ) : undefined
          }
          onClose={closeModal}
          disabled={busy}
          width={520}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions onCancel={closeModal} disabled={busy} busy={busy} />
          }
        >
          <CadastroFormError message={formError} />
          <CadastroFormGrid>
            <CadastroField label="Filial" htmlFor="bico-filial" span="full">
              <select
                id="bico-filial"
                className="input-base input-compact"
                value={form.filial}
                onChange={(e) => setField("filial", e.target.value)}
                disabled={busy}
                required
              >
                <option value="">Selecione…</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {filialLabel(f)}
                  </option>
                ))}
              </select>
            </CadastroField>

            <CadastroField label="Número do bico" htmlFor="bico-numero">
              <input
                id="bico-numero"
                className="input-base input-compact"
                value={form.numero}
                onChange={(e) => setField("numero", e.target.value)}
                placeholder="Ex.: 01"
                disabled={busy}
                required
                autoFocus
              />
            </CadastroField>

            <CadastroField
              label="Cód. bico concentrador"
              htmlFor="bico-concentrador"
            >
              <input
                id="bico-concentrador"
                className="input-base input-compact"
                value={form.codigo_concentrador}
                onChange={(e) => setField("codigo_concentrador", e.target.value)}
                placeholder="Ex.: 01"
                disabled={busy}
                required
              />
            </CadastroField>

            <CadastroField label="Tanque" htmlFor="bico-tanque" span="full">
              <select
                id="bico-tanque"
                className="input-base input-compact"
                value={form.tanque_id}
                onChange={(e) => setField("tanque_id", e.target.value)}
                disabled={busy}
                required
              >
                <option value="">Selecione o tanque…</option>
                {tanquesFiltrados.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.numero} — {t.descricao}
                  </option>
                ))}
              </select>
            </CadastroField>

            <CadastroField label="Produto do bico" htmlFor="bico-produto" span="full">
              <select
                id="bico-produto"
                className="input-base input-compact"
                value={form.produto_id}
                onChange={(e) => setField("produto_id", e.target.value)}
                disabled={busy}
                required
              >
                <option value="">Selecione o produto…</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} — {p.descricao}
                  </option>
                ))}
              </select>
            </CadastroField>
          </CadastroFormGrid>
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir bico"
          titleId="bico-delete-title"
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
            Confirma a exclusão do bico{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.numero}
            </strong>
            ?
          </p>
          {actionError ? (
            <CadastroFormError message={actionError} />
          ) : null}
        </CadastroModal>
      ) : null}
    </>
  );
}
