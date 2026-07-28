"use client";
import { ArrowLeftRight } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "numero", label: "Nº" },
  { key: "data", label: "Data/Hora" },
  { key: "tipo", label: "Tipo" },
  { key: "produto", label: "Produto" },
  { key: "quantidade", label: "Quantidade", align: "right" as const },
  { key: "valor", label: "Valor Total", align: "right" as const },
  { key: "operador", label: "Operador" },
  { key: "status", label: "Status", align: "center" as const },
];

const rows = [
  { numero: "3401", data: "21/07/2025 21:14", tipo: "Venda", produto: "Gasolina Comum", quantidade: "45,00 L", valor: "R$ 324,00", operador: "Carlos", status: <span className="badge badge-success">Concluído</span> },
  { numero: "3400", data: "21/07/2025 21:08", tipo: "Venda", produto: "Diesel S10", quantidade: "120,00 L", valor: "R$ 756,00", operador: "Carlos", status: <span className="badge badge-success">Concluído</span> },
  { numero: "3399", data: "21/07/2025 20:55", tipo: "Sangria", produto: "Caixa PDV 01", quantidade: "—", valor: "R$ 500,00", operador: "Ana", status: <span className="badge badge-warning">Pendente</span> },
  { numero: "3398", data: "21/07/2025 20:41", tipo: "Venda", produto: "Etanol", quantidade: "35,00 L", valor: "R$ 157,50", operador: "Ana", status: <span className="badge badge-success">Concluído</span> },
  { numero: "3397", data: "21/07/2025 20:30", tipo: "Venda", produto: "Gasolina Aditivada", quantidade: "52,00 L", valor: "R$ 406,60", operador: "Roberto", status: <span className="badge badge-success">Concluído</span> },
  { numero: "3396", data: "21/07/2025 20:12", tipo: "Compra", produto: "Gasolina Comum", quantidade: "8.000 L", valor: "R$ 51.200,00", operador: "Admin", status: <span className="badge badge-info">Lançado</span> },
];

export default function MovimentoPage() {
  return (
    <ModulePage
      title="Movimento"
      description="Histórico de movimentações, vendas e compras"
      icon={<ArrowLeftRight size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Movimento"
    />
  );
}
