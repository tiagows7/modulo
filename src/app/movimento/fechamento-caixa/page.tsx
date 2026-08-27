"use client";

import { Landmark } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "codigo", label: "Caixa" },
  { key: "data", label: "Data" },
  { key: "turno", label: "Turno" },
  { key: "operador", label: "Operador" },
  { key: "situacao", label: "Situação", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

export default function FechamentoCaixaPage() {
  return (
    <ModulePage
      title="Fechamento de Caixa"
      description="Fechamento e conferência do caixa do turno"
      icon={<Landmark size={22} />}
      columns={columns}
      rows={[]}
      addLabel="Fechar caixa"
      backUrl="/movimento"
    />
  );
}
