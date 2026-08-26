"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
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

type AuthUserRow = {
  id: string;
  email: string;
  usuario: string;
  nome: string;
  role: string;
  filial_id: string | null;
  last_sign_in_at: string | null;
  banned: boolean;
  status: string;
};

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type UsuarioForm = {
  usuario: string;
  nome: string;
  role: string;
  filial_id: string;
  password: string;
  status: string;
};

const emptyForm: UsuarioForm = {
  usuario: "",
  nome: "",
  role: "pdv",
  filial_id: "",
  password: "",
  status: "ativo",
};

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Admin" },
  { value: "gerente", label: "Gerente" },
  { value: "pdv", label: "Operador PDV" },
];

function roleLabel(role: string) {
  const found = ROLE_OPTIONS.find((r) => r.value === role);
  if (found) return found.label;
  const r = role.trim().toLowerCase();
  if (r === "admin" || r === "superadmin") return "Super Admin";
  if (r === "operador" || r === "caixa") return "Operador PDV";
  return role || "—";
}

function formatLastAccess(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function filialLabel(filial: FilialOpt | undefined) {
  if (!filial) return "—";
  const nome = (filial.fantasia || filial.razao_social || "").trim();
  return nome ? `${filial.codigo} — ${nome}` : filial.codigo;
}

const columns = [
  { key: "usuario", label: "Usuário" },
  { key: "nome", label: "Nome Completo" },
  { key: "perfil", label: "Perfil" },
  { key: "filial", label: "Filial" },
  { key: "ultimoAcesso", label: "Último Acesso" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

export default function UsuariosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [users, setUsers] = useState<AuthUserRow[]>([]);
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUserRow | null>(null);
  const [deleting, setDeleting] = useState<AuthUserRow | null>(null);
  const [form, setForm] = useState<UsuarioForm>(emptyForm);
  const [formError, setFormError] = useState("");

  const filialById = useCallback(
    (id: string | null) =>
      id ? filiais.find((f) => f.id === id) : undefined,
    [filiais],
  );

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || "";

      const [usersRes, filiaisRes] = await Promise.all([
        fetch("/api/usuarios", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        supabase
          .from("filial")
          .select("id, codigo, fantasia, razao_social")
          .order("codigo", { ascending: true }),
      ]);

      if (filiaisRes.error) {
        setLoadError(filiaisRes.error.message);
        setUsers([]);
        return;
      }
      setFiliais((filiaisRes.data as FilialOpt[]) ?? []);

      if (!usersRes.ok) {
        const body = await usersRes.json().catch(() => ({}));
        setLoadError(
          body.error || `Erro ao listar usuários (${usersRes.status})`,
        );
        setUsers([]);
        return;
      }
      const body = await usersRes.json();
      setUsers((body.users ?? []) as AuthUserRow[]);
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const setField = <K extends keyof UsuarioForm>(key: K, value: UsuarioForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      filial_id: filiais.length === 1 ? filiais[0].id : "",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openEdit = (item: AuthUserRow) => {
    setEditing(item);
    setForm({
      usuario: item.usuario,
      nome: item.nome,
      role:
        item.role === "admin" || item.role === "superadmin"
          ? "super_admin"
          : item.role === "operador" || item.role === "caixa"
            ? "pdv"
            : item.role || "pdv",
      filial_id: item.filial_id ?? "",
      password: "",
      status: item.banned || item.status === "inativo" ? "inativo" : "ativo",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);
  };

  const openDelete = (item: AuthUserRow) => {
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
    const usuario = form.usuario.trim();
    const nome = form.nome.trim();
    if (!usuario) {
      setFormError("Informe o usuário (login).");
      return;
    }
    if (!nome) {
      setFormError("Informe o nome completo.");
      return;
    }
    if (!editing && form.password.trim().length < 6) {
      setFormError("Senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (editing && form.password.trim() && form.password.trim().length < 6) {
      setFormError("Senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setFormError("");
    try {
      await gravar(async () => {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token || "";

        if (editing) {
          const payload: Record<string, unknown> = {
            id: editing.id,
            usuario,
            nome,
            role: form.role,
            filial_id: form.filial_id || null,
            status: form.status,
          };
          if (form.password.trim()) payload.password = form.password.trim();
          const res = await fetch("/api/usuarios", {
            method: "PATCH",
            headers: { 
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(payload),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || "Falha ao salvar.");
        } else {
          const res = await fetch("/api/usuarios", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({
              usuario,
              nome,
              role: form.role,
              filial_id: form.filial_id || null,
              password: form.password.trim(),
              status: form.status,
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || "Falha ao criar.");
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
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token || "";

        const res = await fetch(
          `/api/usuarios?id=${encodeURIComponent(deleting.id)}`,
          { 
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          },
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Falha ao excluir.");
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o usuário.",
      );
    }
  };

  const rows = users.map((u) => ({
    usuario: u.usuario,
    nome: u.nome,
    perfil: roleLabel(u.role),
    filial: filialLabel(filialById(u.filial_id)),
    ultimoAcesso: formatLastAccess(u.last_sign_in_at),
    status: (
      <span
        className={`badge ${
          u.banned || u.status === "inativo" ? "badge-warning" : "badge-success"
        }`}
      >
        {u.banned || u.status === "inativo" ? "Inativo" : "Ativo"}
      </span>
    ),
    acoes: (
      <CadastroRowActions
        disabled={busy}
        onEdit={() => openEdit(u)}
        onDelete={() => openDelete(u)}
      />
    ),
  }));

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar usuários: ${loadError}`}
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
        title="Usuários"
        description="Gerenciamento de usuários, perfis e permissões"
        icon={<Settings size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Usuário"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Usuário" : "Novo Usuário"}
          titleId="usuario-title"
          subtitle={
            editing ? (
              <>
                Login:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.usuario}
                </strong>
              </>
            ) : (
              "O login no sistema usa o usuário informado (ex.: pdv)."
            )
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
          <CadastroFormError message={formError} onClose={() => setFormError("")} />
          <CadastroFormGrid>
            <CadastroField label="Usuário (login)" htmlFor="usu-login">
              <input
                id="usu-login"
                className="input-base input-compact"
                value={form.usuario}
                onChange={(e) => setField("usuario", e.target.value)}
                placeholder="Ex.: operador1"
                disabled={busy}
                required
                autoFocus={!editing}
                autoComplete="off"
              />
            </CadastroField>

            <CadastroField label="Status" htmlFor="usu-status">
              <select
                id="usu-status"
                className="input-base input-compact"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                disabled={busy}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </CadastroField>

            <CadastroField label="Nome completo" htmlFor="usu-nome" span="full">
              <input
                id="usu-nome"
                className="input-base input-compact"
                value={form.nome}
                onChange={(e) => setField("nome", e.target.value)}
                placeholder="Nome do usuário"
                disabled={busy}
                required
              />
            </CadastroField>

            <CadastroField label="Perfil" htmlFor="usu-role">
              <select
                id="usu-role"
                className="input-base input-compact"
                value={form.role}
                onChange={(e) => setField("role", e.target.value)}
                disabled={busy}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </CadastroField>

            <CadastroField label="Filial" htmlFor="usu-filial">
              <select
                id="usu-filial"
                className="input-base input-compact"
                value={form.filial_id}
                onChange={(e) => setField("filial_id", e.target.value)}
                disabled={busy}
              >
                <option value="">— Sem filial —</option>
                {filiais.map((f) => (
                  <option key={f.id} value={f.id}>
                    {filialLabel(f)}
                  </option>
                ))}
              </select>
            </CadastroField>

            <CadastroField
              label={editing ? "Nova senha (opcional)" : "Senha"}
              htmlFor="usu-senha"
              span="full"
            >
              <input
                id="usu-senha"
                type="password"
                className="input-base input-compact"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                placeholder={editing ? "Deixe em branco para manter" : "Mín. 6 caracteres"}
                disabled={busy}
                required={!editing}
                autoComplete="new-password"
              />
            </CadastroField>
          </CadastroFormGrid>
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir usuário"
          titleId="usuario-delete-title"
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
              {deleting.usuario} — {deleting.nome}
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
