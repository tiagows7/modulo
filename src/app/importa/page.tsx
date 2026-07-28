"use client";
import { Download } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "data", label: "Data" },
  { key: "tipo", label: "Tipo Importação" },
  { key: "arquivo", label: "Arquivo" },
  { key: "registros", label: "Registros", align: "right" as const },
  { key: "erros", label: "Erros", align: "right" as const },
  { key: "status", label: "Status", align: "center" as const },
];

const rows = [
  { data: "21/07/2025 08:00", tipo: "Produtos", arquivo: "produtos_julho.xlsx", registros: "342", erros: "0", status: <span className="badge badge-success">Concluído</span> },
  { data: "20/07/2025 07:30", tipo: "Clientes", arquivo: "clientes_base.csv", registros: "128", erros: "3", status: <span className="badge badge-warning">Com erros</span> },
  { data: "15/07/2025 09:00", tipo: "Preços", arquivo: "tabela_preco_jul.xlsx", registros: "58", erros: "0", status: <span className="badge badge-success">Concluído</span> },
  { data: "01/07/2025 08:00", tipo: "Fornecedores", arquivo: "fornecedores.csv", registros: "22", erros: "0", status: <span className="badge badge-success">Concluído</span> },
];

export default function ImportaPage() {
  return (
    <ModulePage
      title="Importa Cadastros"
      description="Importação em lote de clientes, produtos e fornecedores"
      icon={<Download size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Nova Importação"
    />
  );
}
