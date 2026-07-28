"use client";
import { DollarSign } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "data", label: "Data" },
  { key: "descricao", label: "Descrição" },
  { key: "categoria", label: "Categoria" },
  { key: "entrada", label: "Entrada", align: "right" as const },
  { key: "saida", label: "Saída", align: "right" as const },
  { key: "saldo", label: "Saldo", align: "right" as const },
];

const rows = [
  { data: "21/07/2025", descricao: "Vendas PDV 01 — Turno Tarde", categoria: "Receita", entrada: "R$ 18.340,00", saida: "—", saldo: "R$ 12.340,00" },
  { data: "21/07/2025", descricao: "Sangria caixa PDV 01", categoria: "Transferência", entrada: "—", saida: "R$ 500,00", saldo: "R$ 11.840,00" },
  { data: "21/07/2025", descricao: "Pagamento Petrobras NF45229", categoria: "Fornecedor", entrada: "—", saida: "R$ 51.200,00", saldo: "-R$ 39.360,00" },
  { data: "20/07/2025", descricao: "Recebimento Transportes Rio", categoria: "Receita", entrada: "R$ 8.450,00", saida: "—", saldo: "R$ 8.450,00" },
  { data: "20/07/2025", descricao: "Vendas PDV 01 — Turno Manhã", categoria: "Receita", entrada: "R$ 14.220,00", saida: "—", saldo: "R$ 22.670,00" },
];

export default function FinanceiroPage() {
  return (
    <ModulePage
      title="Financeiro"
      description="Fluxo de caixa, entradas e saídas financeiras"
      icon={<DollarSign size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Lançamento"
    />
  );
}
