"use client";
import { CreditCard } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "numero", label: "Nº" },
  { key: "fornecedor", label: "Fornecedor" },
  { key: "descricao", label: "Descrição" },
  { key: "vencimento", label: "Vencimento" },
  { key: "valor", label: "Valor", align: "right" as const },
  { key: "situacao", label: "Situação", align: "center" as const },
];

const rows = [
  { numero: "CP-001", fornecedor: "Petrobras Distribuidora", descricao: "NF 45230 — Combustível", vencimento: "25/07/2025", valor: "R$ 51.200,00", situacao: <span className="badge badge-warning">A Vencer</span> },
  { numero: "CP-002", fornecedor: "Auto Peças Veloz", descricao: "NF 1102 — Peças lubrificantes", vencimento: "22/07/2025", valor: "R$ 1.340,00", situacao: <span className="badge badge-danger">Vencido</span> },
  { numero: "CP-003", fornecedor: "Copagaz", descricao: "NF 8854 — GLP", vencimento: "30/07/2025", valor: "R$ 4.500,00", situacao: <span className="badge badge-warning">A Vencer</span> },
  { numero: "CP-004", fornecedor: "Energia Elétrica CPFL", descricao: "Fatura Julho/2025", vencimento: "15/07/2025", valor: "R$ 3.200,00", situacao: <span className="badge badge-success">Pago</span> },
  { numero: "CP-005", fornecedor: "Limpeza Total", descricao: "Serviço limpeza mensal", vencimento: "28/07/2025", valor: "R$ 850,00", situacao: <span className="badge badge-warning">A Vencer</span> },
];

export default function ContasPagarPage() {
  return (
    <ModulePage
      title="Contas a Pagar"
      description="Controle de obrigações e pagamentos a fornecedores"
      icon={<CreditCard size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Nova Conta"
    />
  );
}
