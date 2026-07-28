"use client";
import { FileText } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "numero", label: "Nº" },
  { key: "cliente", label: "Cliente" },
  { key: "descricao", label: "Descrição" },
  { key: "vencimento", label: "Vencimento" },
  { key: "valor", label: "Valor", align: "right" as const },
  { key: "situacao", label: "Situação", align: "center" as const },
];

const rows = [
  { numero: "CR-001", cliente: "Transportes Rio Ltda", descricao: "Faturamento semanal — abastecimento frota", vencimento: "26/07/2025", valor: "R$ 8.450,00", situacao: <span className="badge badge-warning">A Receber</span> },
  { numero: "CR-002", cliente: "Auto Escola Rápida", descricao: "Contrato mensal — combustível", vencimento: "20/07/2025", valor: "R$ 3.200,00", situacao: <span className="badge badge-danger">Vencido</span> },
  { numero: "CR-003", cliente: "Prefeitura Municipal", descricao: "Abastecimento frota municipal", vencimento: "31/07/2025", valor: "R$ 22.000,00", situacao: <span className="badge badge-warning">A Receber</span> },
  { numero: "CR-004", cliente: "João da Silva", descricao: "Crédito avulso", vencimento: "18/07/2025", valor: "R$ 450,00", situacao: <span className="badge badge-success">Recebido</span> },
];

export default function ContasReceberPage() {
  return (
    <ModulePage
      title="Contas a Receber"
      description="Controle de créditos e recebimentos de clientes"
      icon={<FileText size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Crédito"
    />
  );
}
