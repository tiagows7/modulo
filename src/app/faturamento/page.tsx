"use client";
import { ClipboardList } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "nf", label: "NF-e" },
  { key: "data", label: "Emissão" },
  { key: "cliente", label: "Cliente" },
  { key: "itens", label: "Itens", align: "center" as const },
  { key: "valor", label: "Valor Total", align: "right" as const },
  { key: "situacao", label: "Situação", align: "center" as const },
];

const rows = [
  { nf: "000.045.230", data: "21/07/2025", cliente: "Transportes Rio Ltda", itens: "3", valor: "R$ 8.450,00", situacao: <span className="badge badge-success">Autorizada</span> },
  { nf: "000.045.229", data: "21/07/2025", cliente: "Prefeitura Municipal", itens: "1", valor: "R$ 22.000,00", situacao: <span className="badge badge-warning">Pendente</span> },
  { nf: "000.045.228", data: "20/07/2025", cliente: "Auto Escola Rápida", itens: "2", valor: "R$ 3.200,00", situacao: <span className="badge badge-success">Autorizada</span> },
  { nf: "000.045.227", data: "20/07/2025", cliente: "João da Silva", itens: "1", valor: "R$ 450,00", situacao: <span className="badge badge-success">Autorizada</span> },
  { nf: "000.045.226", data: "19/07/2025", cliente: "Frota Express", itens: "5", valor: "R$ 11.230,00", situacao: <span className="badge badge-danger">Cancelada</span> },
];

export default function FaturamentoPage() {
  return (
    <ModulePage
      title="Faturamento"
      description="Emissão e controle de notas fiscais eletrônicas"
      icon={<ClipboardList size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Emitir NF-e"
    />
  );
}
