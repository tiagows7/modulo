"use client";

import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição do Grupo" },
  { key: "status", label: "Status", align: "center" as const },
];

export default function GrupoProdutosPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from('grupo_produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setRows(data.map(item => ({
          codigo: item.codigo,
          descricao: item.descricao,
          status: <span className={`badge ${item.status === 'ativo' ? 'badge-success' : 'badge-warning'}`}>{item.status}</span>
        })));
      }
    }
    loadData();
  }, []);

  return (
    <ModulePage
      title="Grupo de Produtos"
      description="Gerenciamento de categorias e grupos"
      icon={<Layers size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Grupo"
      backUrl="/cadastros"
    />
  );
}
