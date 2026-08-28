"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { IdCard } from "lucide-react";
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

type Funcionario = {
  id: string;
  codigo: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
};

type FuncionarioForm = {
  codigo: string;
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  email: string;
  status: string;
};

const emptyForm: FuncionarioForm = {
  codigo: "",
  nome: "",
  cpf: "",
  cargo: "",
  telefone: "",
  email: "",
  status: "ativo",
};

const columns = [
  { key: "codigo", label: "Código", align: "right" as const },
  { key: "nome", label: "Nome" },
  { key: "cpf", label: "CPF" },
  { key: "cargo", label: "Cargo" },
  { key: "telefone", label: "Telefone" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function blank(v: string) {
  const t = v.trim();
  return t ? t : null;
}

function parseCodigo(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

async function nextCodigo(): Promise<number> {
  const { data } = await supabase
    .from("funcionarios")
    .select("codigo")
    .order("codigo", { ascending: false })
    .limit(1)
    .maybeSingle();

  const max = data?.codigo != null ? Number(data.codigo) : 0;
  return (Number.isFinite(max) ? max : 0) + 1;
}

export default function FuncionariosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Funcionario[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [deleting, setDeleting] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<FuncionarioForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, codigo, nome, cpf, cargo, telefone, email, status")
        .order("codigo", { ascending: true });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }
      setItems(
        (data ?? []).map((row) => ({
          id: String(row.id),
          codigo: Number(row.codigo),
          nome: String(row.nome ?? ""),
          cpf: row.cpf != null ? String(row.cpf) : null,
          cargo: row.cargo != null ? String(row.cargo) : null,
          telefone: row.telefone != null ? String(row.telefone) : null,
          email: row.email != null ? String(row.email) : null,
          status: row.status != null ? String(row.status) : null,
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = async () => {
    setEditing(null);
    setFormError("");
    setModalOpen(true);
    const next = await nextCodigo();
    setForm({ ...emptyForm, codigo: String(next) });
  };

  const openEdit = (item: Funcionario) => {
    setEditing(item);
    setForm({
      codigo: String(item.codigo),
      nome: item.nome ?? "",
      cpf: item.cpf ?? "",
      cargo: item.cargo ?? "",
      telefone: item.telefone ?? "",
      email: item.email ?? "",
      status: item.status === "inativo" ? "inativo" : "ativo",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: Funcionario) => {
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

  const setField = (key: keyof FuncionarioForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nome = form.nome.trim();
    const codigo = parseCodigo(form.codigo);
    if (codigo == null) {
      setFormError("Informe o código numérico do funcionário (inteiro > 0).");
      return;
    }
    if (!nome) {
      setFormError("Informe o nome do funcionário.");
      return;
    }

    setFormError("");
    const payload = {
      codigo,
      nome,
      cpf: blank(form.cpf),
      cargo: blank(form.cargo),
      telefone: blank(form.telefone),
      email: blank(form.email),
      status: form.status === "inativo" ? "inativo" : "ativo",
    };

    try {
      await gravar(async () => {
        if (editing) {
          const { error } = await supabase
            .from("funcionarios")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("funcionarios").insert(payload);
          if (error) throw new Error(error.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao gravar.";
      if (/unique|duplicate|codigo/i.test(msg)) {
        setFormError("Já existe um funcionário com este código.");
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
          .from("funcionarios")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });

      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o funcionário.",
      );
    }
  };

  const rows = items.map((item) => ({
    codigo: item.codigo,
    nome: item.nome,
    cpf: item.cpf || "—",
    cargo: item.cargo || "—",
    telefone: item.telefone || "—",
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
          message={`Erro ao carregar funcionários: ${loadError}`}
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
        title="Funcionários"
        description="Código numérico usado na abertura de caixa e nas vendas do PDV"
        icon={<IdCard size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Funcionário"
        backUrl="/cadastros"
        onAdd={busy ? undefined : () => void openCreate()}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Funcionário" : "Novo Funcionário"}
          titleId="funcionario-title"
          subtitle="O código inteiro identifica o operador no caixa e nas vendas"
          onClose={closeModal}
          disabled={busy}
          width={520}
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
            <CadastroField label="Código *" htmlFor="fun-codigo">
              <input
                id="fun-codigo"
                className="input-base input-compact"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.codigo}
                onChange={(e) =>
                  setField("codigo", e.target.value.replace(/\D/g, ""))
                }
                autoFocus
                required
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Nome *" htmlFor="fun-nome" span={2}>
              <input
                id="fun-nome"
                className="input-base input-compact"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                maxLength={255}
                required
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="CPF" htmlFor="fun-cpf">
              <input
                id="fun-cpf"
                className="input-base input-compact"
                value={form.cpf}
                onChange={(e) => setField("cpf", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Cargo" htmlFor="fun-cargo">
              <input
                id="fun-cargo"
                className="input-base input-compact"
                placeholder="Ex.: Frentista, Caixa..."
                value={form.cargo}
                onChange={(e) => setField("cargo", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Telefone" htmlFor="fun-telefone">
              <input
                id="fun-telefone"
                className="input-base input-compact"
                value={form.telefone}
                onChange={(e) => setField("telefone", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="E-mail" htmlFor="fun-email">
              <input
                id="fun-email"
                type="email"
                className="input-base input-compact"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Status" htmlFor="fun-status">
              <select
                id="fun-status"
                className="input-base input-compact"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                disabled={busy}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </CadastroField>
          </CadastroFormGrid>
          <CadastroFormError
            message={formError}
            onClose={() => setFormError("")}
          />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir funcionário"
          titleId="funcionario-delete-title"
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
            Confirma a exclusão de{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.codigo} — {deleting.nome}
            </strong>
            ?
          </p>
          <CadastroFormError
            message={actionError}
            onClose={() => setActionError("")}
          />
        </CadastroModal>
      ) : null}
    </>
  );
}
