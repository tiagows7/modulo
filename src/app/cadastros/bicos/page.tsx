"use client";

import { useEffect, useState } from "react";
import { Fuel } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

const columns = [
  { key: "numero", label: "Número" },
  { key: "bomba", label: "Bomba" },
  { key: "tanque", label: "Tanque Vinculado" },
  { key: "produto", label: "Produto" },
  { key: "preco", label: "Preço Atual (R$)", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
];

export default function BicosPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase
        .from('bicos')
        .select(`
          *,
          tanques ( numero, descricao ),
          produtos ( descricao )
        `)
        .order('created_at', { ascending: false });

      if (data) {
        setRows(data.map(item => ({
          numero: item.numero,
          bomba: item.identificacao_bomba,
          tanque: item.tanques ? `${item.tanques.numero} - ${item.tanques.descricao}` : "Sem Tanque",
          produto: item.produtos?.descricao || "Sem Produto",
          preco: Number(item.preco_atual).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          status: <span className={`badge ${item.status === 'livre' ? 'badge-success' : (item.status === 'em uso' ? 'badge-warning' : 'badge-danger')}`}>{item.status}</span>
        })));
      }
    }
    loadData();
  }, []);

  return (
    <ModulePage
      title="Bicos"
      description="Configuração de bicos de bombas"
      icon={<Fuel size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Bico"
      backUrl="/cadastros"
    />
  );
}
