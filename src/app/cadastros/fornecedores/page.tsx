"use client";

import { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Razão Social" },
  { key: "cpfCnpj", label: "CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "telefone", label: "Telefone" },
  { key: "status", label: "Status", align: "center" as const },
];

export default function FornecedoresPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setRows(data.map(item => ({
          codigo: item.codigo,
          nome: item.razao_social,
          cpfCnpj: item.cnpj || "-",
          cidade: item.cidade || "-",
          telefone: item.telefone || "-",
          status: <span className={`badge ${item.status === 'ativo' ? 'badge-success' : 'badge-danger'}`}>{item.status}</span>
        })));
      }
    }
    loadData();
  }, []);

  return (
    <ModulePage
      title="Fornecedores"
      description="Gerenciamento de fornecedores"
      icon={<Truck size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Fornecedor"
      backUrl="/cadastros"
    />
  );
}
