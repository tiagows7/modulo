"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Database } from "lucide-react";
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

type ProdutoOpt = {
  id: string;
  codigo: string;
  descricao: string;
};

type Tanque = {
  id: string;
  numero: string;
  descricao: string;
  produto_id: string | null;
  capacidade: number | null;
  volume_atual: number | null;
  status: string | null;
  filial: string | null;
  produtos?: { codigo: string; descricao: string } | null;
  filial_row?: { codigo: string; fantasia: string | null } | null;
};

type TanqueForm = {
  filial: string;
  numero: string;
  produto_id: string;
  capacidade: string;
};

const emptyForm: TanqueForm = {
  filial: "",
  numero: "",
  produto_id: "",
  capacidade: "",
};

const columns = [
  { key: "numero", label: "Nº Tanque" },
  { key: "filial", label: "Filial" },
  { key: "produto", label: "Produto" },
  { key: "capacidade", label: "Capacidade (L)", align: "right" as const },
  { key: "volumeAtual", label: "Volume Atual (L)", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function parseCapacidade(value: string): number | null {
  const n = Number(
    String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(",", "."),
  );
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function formatLiters(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function TanquesPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Tanque[]>([]);
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tanque | null>(null);
  const [deleting, setDeleting] = useState<Tanque | null>(null);
  const [form, setForm] = useState<TanqueForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const loadLookups = useCallback(async () => {
    const [filRes, prodRes] = await Promise.all([
      supabase
        .from("filial")
        .select("id, codigo, fantasia, razao_social")
        .order("codigo", { ascending: true }),
      supabase
        .from("produtos")
        .select("id, codigo, descricao")
        .eq("status", "ativo")
        .order("codigo", { ascending: true }),
    ]);
    if (!filRes.error) setFiliais((filRes.data as FilialOpt[]) ?? []);
    if (!prodRes.error) setProdutos((prodRes.data as ProdutoOpt[]) ?? []);
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("tanques")
        .select(
          `
          id, numero, descricao, produto_id, capacidade, volume_atual, status, filial,
          produtos ( codigo, descricao )
        `,
        )
        .order("numero", { ascending: true });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      type RawTanque = {
        id: string;
        numero: string;
        descricao: string;
        produto_id: string | null;
        capacidade: number | null;
        volume_atual: number | null;
        status: string | null;
        filial: string | null;
        produtos:
          | { codigo: string; descricao: string }
          | { codigo: string; descricao: string }[]
          | null;
      };

      const raw = (data ?? []) as RawTanque[];
      const rows: Omit<Tanque, "filial_row">[] = raw.map((r) => ({
        id: r.id,
        numero: r.numero,
        descricao: r.descricao,
        produto_id: r.produto_id,
        capacidade: r.capacidade,
        volume_atual: r.volume_atual,
        status: r.status,
        filial: r.filial,
        produtos: Array.isArray(r.produtos) ? r.produtos[0] ?? null : r.produtos,
      }));

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

  const setField = <K extends keyof TanqueForm>(key: K, value: TanqueForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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

  const openEdit = (item: Tanque) => {
    setEditing(item);
    setForm({
      filial: item.filial ?? "",
      numero: item.numero ?? "",
      produto_id: item.produto_id ?? "",
      capacidade:
        item.capacidade != null
          ? String(item.capacidade).replace(".", ",")
          : "",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: Tanque) => {
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
    const numero = form.numero.trim();
    const capacidade = parseCapacidade(form.capacidade);

    if (!form.filial) {
      setFormError("Selecione a filial.");
      return;
    }
    if (!numero) {
      setFormError("Informe o número do tanque.");
      return;
    }
    if (!form.produto_id) {
      setFormError("Selecione o produto do tanque.");
      return;
    }
    if (capacidade == null) {
      setFormError("Informe a capacidade do tanque (litros).");
      return;
    }

    const produto = produtos.find((p) => p.id === form.produto_id);
    const descricao = produto
      ? `Tanque ${numero} — ${produto.descricao}`
      : `Tanque ${numero}`;

    setFormError("");
    const payload = {
      numero,
      descricao,
      produto_id: form.produto_id,
      capacidade,
      filial: form.filial,
      status: editing?.status || "operante",
      volume_atual: editing?.volume_atual ?? 0,
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("tanques")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("tanques").insert(payload);
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
          .from("tanques")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o tanque.",
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
      produto: item.produtos
        ? `${item.produtos.codigo} — ${item.produtos.descricao}`
        : "—",
      capacidade: formatLiters(item.capacidade),
      volumeAtual: formatLiters(item.volume_atual),
      status: (
        <span
          className={`badge ${
            item.status === "operante" ? "badge-success" : "badge-warning"
          }`}
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
    };
  });

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar tanques: ${loadError}`}
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
        title="Tanques"
        description="Gerenciamento de tanques de combustível"
        icon={<Database size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Tanque"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Tanque" : "Novo Tanque"}
          titleId="tanque-title"
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
          width={480}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions onCancel={closeModal} disabled={busy} busy={busy} />
          }
        >
          <CadastroFormError message={formError} onClose={() => setFormError("")} />
          <CadastroFormGrid>
            <CadastroField label="Filial" htmlFor="tanque-filial" span="full">
              <select
                id="tanque-filial"
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

            <CadastroField label="Número do tanque" htmlFor="tanque-numero">
              <input
                id="tanque-numero"
                className="input-base input-compact"
                value={form.numero}
                onChange={(e) => setField("numero", e.target.value)}
                placeholder="Ex.: 01"
                disabled={busy}
                required
                autoFocus
              />
            </CadastroField>

            <CadastroField label="Capacidade (L)" htmlFor="tanque-capacidade">
              <input
                id="tanque-capacidade"
                className="input-base input-compact"
                value={form.capacidade}
                onChange={(e) => setField("capacidade", e.target.value)}
                placeholder="Ex.: 15000"
                inputMode="decimal"
                disabled={busy}
                required
              />
            </CadastroField>

            <CadastroField label="Produto do tanque" htmlFor="tanque-produto" span="full">
              <select
                id="tanque-produto"
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
          title="Excluir tanque"
          titleId="tanque-delete-title"
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
            Confirma a exclusão do tanque{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.numero}
            </strong>
            ?
          </p>
          {actionError ? (
            <CadastroFormError message={actionError} onClose={() => setActionError("")} />
          ) : null}
        </CadastroModal>
      ) : null}
    </>
  );
}
