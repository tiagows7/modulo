"use client";

import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

const columns = [
  { key: "numero", label: "Número" },
  { key: "descricao", label: "Descrição" },
  { key: "produto", label: "Produto" },
  { key: "capacidade", label: "Capacidade (L)", align: "right" as const },
  { key: "volumeAtual", label: "Volume Atual (L)", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
];

export default function TanquesPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from('tanques')
        .select(`
          *,
          produtos ( descricao )
        `)
        .order('created_at', { ascending: false });

      if (data) {
        setRows(data.map(item => ({
          numero: item.numero,
          descricao: item.descricao,
          produto: item.produtos?.descricao || "Sem Produto",
          capacidade: Number(item.capacidade).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
          volumeAtual: Number(item.volume_atual).toLocaleString('pt-BR', { minimumFractionDigits: 3 }),
          status: <span className={`badge ${item.status === 'operante' ? 'badge-success' : 'badge-warning'}`}>{item.status}</span>
        })));
      }
    }
    loadData();
  }, []);

  return (
    <ModulePage
      title="Tanques"
      description="Gerenciamento de tanques de combustível"
      icon={<Database size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Tanque"
      backUrl="/cadastros"
    />
  );
}
