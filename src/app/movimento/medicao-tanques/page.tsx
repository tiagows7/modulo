"use client";

import { Gauge } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "data", label: "Data" },
  { key: "tanque", label: "Tanque" },
  { key: "produto", label: "Produto" },
  { key: "volumeAnterior", label: "Vol. anterior (L)", align: "right" as const },
  { key: "volumeMedido", label: "Vol. medido (L)", align: "right" as const },
  { key: "diferenca", label: "Diferença (L)", align: "right" as const },
  { key: "operador", label: "Operador" },
];

export default function MedicaoTanquesPage() {
  return (
    <ModulePage
      title="Medição de Tanques"
      description="Registro e conferência do volume dos tanques"
      icon={<Gauge size={22} />}
      columns={columns}
      rows={[]}
      addLabel="Nova medição"
      backUrl="/movimento"
    />
  );
}
