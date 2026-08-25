"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { supabase } from "@/lib/supabase";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "descricao", label: "Descrição" },
  { key: "grupo", label: "Grupo" },
  { key: "subgrupo", label: "Sub-grupo" },
  { key: "preco", label: "Preço (R$)", align: "right" as const },
  { key: "estoque", label: "Estoque", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
];

export default function ProdutosPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      const { data } = await supabase
        .from("produtos")
        .select(`
          *,
          grupo_produtos ( descricao ),
          subgrupo_produtos ( descricao )
        `)
        .order("created_at", { ascending: false });

      if (data) {
        setRows(
          data.map((item) => ({
            codigo: item.codigo,
            descricao: item.descricao,
            grupo: item.grupo_produtos?.descricao || "Sem Grupo",
            subgrupo: item.subgrupo_produtos?.descricao || "—",
            preco: Number(item.preco_venda).toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            }),
            estoque: Number(item.estoque_atual).toLocaleString("pt-BR", {
              minimumFractionDigits: 3,
            }),
            status: (
              <span
                className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}
              >
                {item.status}
              </span>
            ),
          })),
        );
      }
    }
    void loadData();
  }, []);

  return (
    <ModulePage
      title="Produtos"
      description="Gerenciamento de produtos e itens"
      icon={<Package size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Produto"
      backUrl="/cadastros"
    />
  );
}
