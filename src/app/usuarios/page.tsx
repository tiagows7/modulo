"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Pencil, Settings } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import {
  CadastroField,
  CadastroFormActions,
  CadastroFormError,
  CadastroFormGrid,
  CadastroModal,
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
};

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

function roleLabel(role: string) {
  const r = role.trim().toLowerCase();
  if (r === "super_admin" || r === "superadmin" || r === "admin") {
    return "Super Admin";
  }
  if (r === "pdv" || r === "operador" || r === "caixa") return "Operador PDV";
  if (r === "gerente") return "Gerente";
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
  const [users, setUsers] = useState<AuthUserRow[]>([]);
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AuthUserRow | null>(null);
  const [filialId, setFilialId] = useState("");

  const filialById = useCallback(
    (id: string | null) =>
      id ? filiais.find((f) => f.id === id) : undefined,
    [filiais],
  );

  const load = useCallback(async () => {
    setLoadError(null);
    const [usersRes, filiaisRes] = await Promise.all([
      fetch("/api/usuarios"),
      supabase
        .from("filial")
        .select("id, codigo, fantasia, razao_social")
        .order("codigo", { ascending: true }),
    ]);

    if (filiaisRes.error) {
      setLoadError(filiaisRes.error.message);
      return;
    }
    setFiliais((filiaisRes.data as FilialOpt[]) ?? []);

    if (!usersRes.ok) {
      const body = await usersRes.json().catch(() => ({}));
      setLoadError(body.error || `Erro ao listar usuários (${usersRes.status})`);
      return;
    }
    const body = await usersRes.json();
    setUsers(body.users ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(user: AuthUserRow) {
    setActionError(null);
    setEditing(user);
    setFilialId(user.filial_id ?? "");
  }

  async function saveFilial(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch("/api/usuarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing.id,
          filial_id: filialId || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Falha ao salvar.");
      setEditing(null);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const rows = users.map((u) => ({
    usuario: u.usuario,
    nome: u.nome,
    perfil: roleLabel(u.role),
    filial: filialLabel(filialById(u.filial_id)),
    ultimoAcesso: formatLastAccess(u.last_sign_in_at),
    status: u.banned ? (
      <span className="badge badge-warning">Inativo</span>
    ) : (
      <span className="badge badge-success">Ativo</span>
    ),
    acoes: (
      <div className="cadastro-row-actions">
        <button
          type="button"
          className="cadastro-btn-edit"
          onClick={() => openEdit(u)}
          disabled={busy}
          title="Editar filial"
        >
          <Pencil size={12} />
          Filial
        </button>
      </div>
    ),
  }));

  return (
    <>
      {loadError ? (
        <div className="cadastro-alert">
          Erro ao carregar usuários: {loadError}
        </div>
      ) : null}
      {actionError && !editing ? (
        <div className="cadastro-alert">{actionError}</div>
      ) : null}

      <ModulePage
        title="Usuários"
        description="Gerenciamento de usuários, perfis e permissões"
        icon={<Settings size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Usuário"
      />

      {editing ? (
        <CadastroModal
          title="Vincular filial"
          titleId="usuario-filial-title"
          subtitle={
            <>
              {editing.nome} <span style={{ opacity: 0.7 }}>({editing.usuario})</span>
            </>
          }
          onClose={() => !busy && setEditing(null)}
          disabled={busy}
          asForm
          onSubmit={saveFilial}
          footer={
            <CadastroFormActions
              busy={busy}
              onCancel={() => setEditing(null)}
              submitLabel="Salvar"
            />
          }
        >
          <CadastroFormError message={actionError} />
          <CadastroFormGrid>
            <CadastroField label="Filial" htmlFor="usuario-filial">
              <select
                id="usuario-filial"
                className="input-base"
                value={filialId}
                onChange={(e) => setFilialId(e.target.value)}
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
          </CadastroFormGrid>
        </CadastroModal>
      ) : null}
    </>
  );
}
