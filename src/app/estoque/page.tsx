"use client";
import { Package } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "produto", label: "Produto" },
  { key: "unidade", label: "Un." },
  { key: "estoqueAtual", label: "Estoque Atual", align: "right" as const },
  { key: "estoqueMin", label: "Mín.", align: "right" as const },
  { key: "estoqueMax", label: "Máx.", align: "right" as const },
  { key: "ultimaMovimento", label: "Última Movimentação" },
  { key: "status", label: "Situação", align: "center" as const },
];

const rows = [
  { codigo: "GC001", produto: "Gasolina Comum", unidade: "L", estoqueAtual: "21.600", estoqueMin: "5.000", estoqueMax: "30.000", ultimaMovimento: "21/07/2025 20:30", status: <span className="badge badge-success">Normal</span> },
  { codigo: "GA002", produto: "Gasolina Aditivada", unidade: "L", estoqueAtual: "9.000", estoqueMin: "4.000", estoqueMax: "20.000", ultimaMovimento: "21/07/2025 19:15", status: <span className="badge badge-warning">Atenção</span> },
  { codigo: "ET003", produto: "Etanol Hidratado", unidade: "L", estoqueAtual: "7.000", estoqueMin: "5.000", estoqueMax: "25.000", ultimaMovimento: "21/07/2025 18:40", status: <span className="badge badge-danger">Crítico</span> },
  { codigo: "DS004", produto: "Diesel S10", unidade: "L", estoqueAtual: "7.200", estoqueMin: "8.000", estoqueMax: "40.000", ultimaMovimento: "21/07/2025 17:00", status: <span className="badge badge-danger">Crítico</span> },
  { codigo: "OL005", produto: "Óleo Lubrificante 5W30", unidade: "Qtd", estoqueAtual: "48", estoqueMin: "10", estoqueMax: "200", ultimaMovimento: "20/07/2025 14:20", status: <span className="badge badge-success">Normal</span> },
  { codigo: "OL006", produto: "Óleo Lubrificante 10W40", unidade: "Qtd", estoqueAtual: "22", estoqueMin: "10", estoqueMax: "150", ultimaMovimento: "19/07/2025 11:00", status: <span className="badge badge-success">Normal</span> },
];

export default function EstoquePage() {
  return (
    <ModulePage
      title="Estoque"
      description="Controle de produtos e combustíveis em estoque"
      icon={<Package size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Nova Entrada"
    />
  );
}
