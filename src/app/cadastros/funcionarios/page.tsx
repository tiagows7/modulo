"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type Funcionario = {
  id: string;
  codigo: number;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
  filial: string | null;
};

type FuncionarioForm = {
  nome: string;
  cpf: string;
  cargo: string;
  telefone: string;
  email: string;
  status: string;
  filial: string;
};

const emptyForm: FuncionarioForm = {
  nome: "",
  cpf: "",
  cargo: "",
  telefone: "",
  email: "",
  status: "ativo",
  filial: "",
};

const columns = [
  { key: "codigo", label: "Código", align: "right" as const },
  { key: "nome", label: "Nome" },
  { key: "filial", label: "Filial" },
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

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
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
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [items, setItems] = useState<Funcionario[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Funcionario | null>(null);
  const [deleting, setDeleting] = useState<Funcionario | null>(null);
  const [form, setForm] = useState<FuncionarioForm>(emptyForm);
  const [formError, setFormError] = useState("");

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
    setFiliais(
      (data ?? []).map((f) => ({
        id: String(f.id),
        codigo: String(f.codigo),
        fantasia: f.fantasia != null ? String(f.fantasia) : null,
        razao_social: String(f.razao_social ?? ""),
      })),
    );
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("funcionarios")
        .select("id, codigo, nome, cpf, cargo, telefone, email, status, filial")
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
          filial: row.filial != null ? String(row.filial) : null,
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: Funcionario) => {
    setEditing(item);
    setForm({
      nome: item.nome ?? "",
      cpf: item.cpf ?? "",
      cargo: item.cargo ?? "",
      telefone: item.telefone ?? "",
      email: item.email ?? "",
      status: item.status === "inativo" ? "inativo" : "ativo",
      filial: item.filial ?? "",
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
    if (!nome) {
      setFormError("Informe o nome do funcionário.");
      return;
    }

    setFormError("");
    const payload = {
      nome,
      cpf: blank(form.cpf),
      cargo: blank(form.cargo),
      telefone: blank(form.telefone),
      email: blank(form.email),
      status: form.status === "inativo" ? "inativo" : "ativo",
      // NULL = todas as filiais
      filial: blank(form.filial),
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
          const codigo = await nextCodigo();
          const { error } = await supabase.from("funcionarios").insert({
            ...payload,
            codigo,
          });
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
        setFormError("Código já utilizado. Tente salvar novamente.");
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

  const rows = items.map((item) => {
    const fil = item.filial ? filialById.get(item.filial) : null;
    return {
      codigo: item.codigo,
      nome: item.nome,
      filial: fil ? filialLabel(fil) : "Todas",
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
    };
  });

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
        description="Sem filial = disponível em todas as filiais"
        icon={<IdCard size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Funcionário"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Funcionário" : "Novo Funcionário"}
          titleId="funcionario-title"
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
            <CadastroField label="Nome *" htmlFor="fun-nome" span="full">
              <input
                id="fun-nome"
                className="input-base input-compact"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                autoFocus
                maxLength={255}
                required
                disabled={busy}
              />
            </CadastroField>
            <CadastroField label="Filial" htmlFor="fun-filial" span="full">
              <select
                id="fun-filial"
                className="input-base input-compact"
                value={form.filial}
                onChange={(e) => setField("filial", e.target.value)}
                disabled={busy}
              >
                <option value="">Todas as filiais</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {filialLabel(f)}
                  </option>
                ))}
              </select>
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
