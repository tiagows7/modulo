"use client";
import { ClipboardList } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "tipo", label: "Tipo SPED" },
  { key: "competencia", label: "Competência" },
  { key: "gerado", label: "Gerado Em" },
  { key: "registros", label: "Registros", align: "right" as const },
  { key: "arquivo", label: "Arquivo" },
  { key: "status", label: "Status", align: "center" as const },
];

const rows = [
  { tipo: "EFD-ICMS/IPI", competencia: "Junho/2025", gerado: "05/07/2025", registros: "12.440", arquivo: "SPED_062025.txt", status: <span className="badge badge-success">Transmitido</span> },
  { tipo: "EFD-Contribuições", competencia: "Junho/2025", gerado: "05/07/2025", registros: "8.230", arquivo: "SPEDC_062025.txt", status: <span className="badge badge-success">Transmitido</span> },
  { tipo: "EFD-ICMS/IPI", competencia: "Julho/2025", gerado: "—", registros: "—", arquivo: "—", status: <span className="badge badge-warning">Pendente</span> },
  { tipo: "EFD-Contribuições", competencia: "Julho/2025", gerado: "—", registros: "—", arquivo: "—", status: <span className="badge badge-warning">Pendente</span> },
];

export default function SpedPage() {
  return (
    <ModulePage
      title="Rotinas Sped"
      description="Geração e transmissão de arquivos fiscais SPED"
      icon={<ClipboardList size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Gerar SPED"
    />
  );
}
