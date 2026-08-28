"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import { CadastroFormError } from "@/components/CadastroUi";
import { supabase } from "@/lib/supabase";

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type CaixaItem = {
  id: number;
  codigo: number;
  data: string;
  turno: string | null;
  operador: string | null;
  pdv: string | null;
  filial: string | null;
  situacao: number;
  fechado: boolean;
  sobra_falta: number | null;
};

const columns = [
  { key: "codigo", label: "Caixa" },
  { key: "filial", label: "Filial" },
  { key: "pdv", label: "PDV", align: "center" as const },
  { key: "data", label: "Data" },
  { key: "operador", label: "Operador" },
  { key: "turno", label: "Turno", align: "center" as const },
  { key: "fechado", label: "Fechado", align: "center" as const },
  { key: "sobra_falta", label: "Sobra/Falta", align: "right" as const },
];

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function resolveFilial(
  value: string | null,
  byCodigo: Map<string, FilialOpt>,
  byId: Map<string, FilialOpt>,
): FilialOpt | null {
  if (!value) return null;
  return byCodigo.get(value) ?? byId.get(value) ?? null;
}

function formatDateBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function FechamentoCaixaPage() {
  const { busy, pesquisar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  /** Guarda o id da filial selecionada (filtro aceita id ou codigo em caixa.filial). */
  const [filialFiltro, setFilialFiltro] = useState("");
  const [items, setItems] = useState<CaixaItem[]>([]);
  const [loadError, setLoadError] = useState("");

  const filialByCodigo = useMemo(() => {
    const map = new Map<string, FilialOpt>();
    for (const f of filiais) map.set(f.codigo, f);
    return map;
  }, [filiais]);

  const filialById = useMemo(() => {
    const map = new Map<string, FilialOpt>();
    for (const f of filiais) map.set(f.id, f);
    return map;
  }, [filiais]);

  const loadLookups = useCallback(async () => {
    const { data } = await supabase
      .from("filial")
      .select("id, codigo, fantasia, razao_social")
      .eq("status", "ativo")
      .order("codigo");
    const list = (data ?? []).map((f) => ({
      id: String(f.id),
      codigo: String(f.codigo),
      fantasia: f.fantasia != null ? String(f.fantasia) : null,
      razao_social: String(f.razao_social ?? ""),
    }));
    setFiliais(list);
    if (list.length === 1) setFilialFiltro(list[0].id);
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      // caixa.filial pode ter codigo (text) ou uuid — filtra pelos dois
      let query = supabase
        .from("caixa")
        .select(
          "id, codigo, data, turno, operador, pdv, filial, situacao, fechado, sobra_falta",
        )
        .order("data", { ascending: false })
        .order("codigo", { ascending: false });

      if (filialFiltro) {
        const selected =
          filialById.get(filialFiltro) ??
          filialByCodigo.get(filialFiltro) ??
          null;
        if (selected) {
          query = query.or(
            `filial.eq.${selected.id},filial.eq.${selected.codigo}`,
          );
        } else {
          query = query.eq("filial", filialFiltro);
        }
      }

      const { data, error } = await query;
      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      setItems(
        (data ?? []).map((row) => ({
          id: Number(row.id),
          codigo: Number(row.codigo),
          data: String(row.data).slice(0, 10),
          turno: row.turno != null ? String(row.turno) : null,
          operador: row.operador != null ? String(row.operador) : null,
          pdv: row.pdv != null ? String(row.pdv) : null,
          filial: row.filial != null ? String(row.filial) : null,
          situacao: Number(row.situacao) === 1 ? 1 : 0,
          fechado: row.fechado === true,
          sobra_falta:
            row.sobra_falta != null && row.sobra_falta !== ""
              ? Number(row.sobra_falta)
              : null,
        })),
      );
    });
  }, [pesquisar, filialFiltro, filialById, filialByCodigo]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const sobra = item.sobra_falta;
        const sobraColor =
          sobra == null
            ? "var(--text-muted)"
            : sobra > 0
              ? "#16A34A"
              : sobra < 0
                ? "#DC2626"
                : "var(--text-primary)";
        const fil = resolveFilial(item.filial, filialByCodigo, filialById);
        const filLabel = fil
          ? filialLabel(fil)
          : item.filial?.trim() || "—";

        return {
          codigo: String(item.codigo).padStart(4, "0"),
          filial: filLabel,
          pdv: item.pdv?.trim() || "—",
          data: formatDateBr(item.data),
          operador: item.operador?.trim() || "—",
          turno: item.turno?.trim() || "—",
          fechado: (
            <span
              className={`badge ${item.fechado ? "badge-success" : "badge-warning"}`}
            >
              {item.fechado ? "Sim" : "Não"}
            </span>
          ),
          sobra_falta: (
            <span style={{ color: sobraColor, fontWeight: 600 }}>
              {formatMoney(sobra)}
            </span>
          ),
        };
      }),
    [items, filialByCodigo, filialById],
  );

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar caixas: ${loadError}`}
          onClose={() => setLoadError("")}
        />
      ) : null}

      <ModulePage
        title="Fechamento de Caixa"
        description="Conferência na retaguarda dos caixas do PDV"
        icon={<Landmark size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Fechar caixa"
        backUrl="/movimento"
        filters={
          <select
            className="input-base input-compact"
            value={filialFiltro}
            onChange={(e) => setFilialFiltro(e.target.value)}
            disabled={busy}
            style={{ minWidth: 220 }}
            aria-label="Filtrar por filial"
          >
            <option value="">Todas as filiais</option>
            {filiais.map((f) => (
              <option key={f.id} value={f.id}>
                {filialLabel(f)}
              </option>
            ))}
          </select>
        }
      />
    </>
  );
}
