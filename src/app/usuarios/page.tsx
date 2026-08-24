"use client";

import { Settings } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "usuario", label: "Usuário" },
  { key: "nome", label: "Nome Completo" },
  { key: "perfil", label: "Perfil" },
  { key: "ultimoAcesso", label: "Último Acesso" },
  { key: "status", label: "Status", align: "center" as const },
];

const rows = [
  {
    usuario: "admin",
    nome: "Administrador",
    perfil: "Super Admin",
    ultimoAcesso: "21/07/2025 21:22",
    status: <span className="badge badge-success">Ativo</span>,
  },
  {
    usuario: "carlos.caixa",
    nome: "Carlos Souza",
    perfil: "Operador PDV",
    ultimoAcesso: "21/07/2025 06:00",
    status: <span className="badge badge-success">Ativo</span>,
  },
  {
    usuario: "ana.gerente",
    nome: "Ana Lima",
    perfil: "Gerente",
    ultimoAcesso: "21/07/2025 14:00",
    status: <span className="badge badge-success">Ativo</span>,
  },
  {
    usuario: "roberto.pdv",
    nome: "Roberto Faria",
    perfil: "Operador PDV",
    ultimoAcesso: "21/07/2025 14:01",
    status: <span className="badge badge-success">Ativo</span>,
  },
  {
    usuario: "jose.inativo",
    nome: "José Pereira",
    perfil: "Operador PDV",
    ultimoAcesso: "10/06/2025 08:30",
    status: <span className="badge badge-warning">Inativo</span>,
  },
];

export default function UsuariosPage() {
  return (
    <ModulePage
      title="Usuários"
      description="Gerenciamento de usuários, perfis e permissões"
      icon={<Settings size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Usuário"
    />
  );
}
