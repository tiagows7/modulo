"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Nome / Razão Social" },
  { key: "cpfCnpj", label: "CPF / CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "telefone", label: "Telefone" },
  { key: "status", label: "Status", align: "center" as const },
];

export default function ClientesPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setRows(data.map(item => ({
          codigo: item.codigo,
          nome: item.nome,
          cpfCnpj: item.cpf_cnpj || "-",
          cidade: item.cidade || "-",
          telefone: item.telefone || "-",
          status: <span className={`badge ${item.status === 'ativo' ? 'badge-success' : 'badge-warning'}`}>{item.status}</span>
        })));
      }
    }
    loadData();
  }, []);

  return (
    <ModulePage
      title="Clientes"
      description="Gerenciamento de clientes"
      icon={<Users size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Cliente"
      backUrl="/cadastros"
    />
  );
}
