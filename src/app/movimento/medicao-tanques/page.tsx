"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Gauge } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import {
  CadastroField,
  CadastroFormActions,
  CadastroFormError,
  CadastroFormGrid,
  CadastroModal,
  CadastroRowActions,
} from "@/components/CadastroUi";
import { supabase } from "@/lib/supabase";

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type TanqueAtivo = {
  id: string;
  numero: string;
  descricao: string;
  produto_id: string | null;
  volume_atual: number | null;
  produto?: { codigo: string; descricao: string } | null;
};

type MarcacaoItem = {
  id: string;
  filial: string | null;
  data: string;
  tanque: string;
  produto: string | null;
  marcacao_inicial: number;
  entradas: number;
  saidas_ai: number;
  marcacao_final: number;
  variacao: number;
  tanque_row?: { numero: string; descricao: string } | null;
  produto_row?: { codigo: string; descricao: string } | null;
  filial_row?: { codigo: string; fantasia: string | null } | null;
};

type LineForm = {
  tanqueId: string;
  numero: string;
  descricao: string;
  produtoId: string | null;
  produtoLabel: string;
  existingId: string | null;
  marcacao_inicial: number;
  entradas: number;
  saidas_ai: number;
  marcacao_final: string;
};

const columns = [
  { key: "data", label: "Data" },
  { key: "filial", label: "Filial" },
  { key: "tanque", label: "Tanque" },
  { key: "produto", label: "Produto" },
  { key: "inicial", label: "Marcac. inicial", align: "right" as const },
  { key: "entradas", label: "Entradas", align: "right" as const },
  { key: "saidas", label: "Saídas AI", align: "right" as const },
  { key: "final", label: "Marcac. final", align: "right" as const },
  { key: "variacao", label: "Variação", align: "right" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function isoToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatLiters(n: number | null | undefined) {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function parseLiters(raw: string) {
  const n = Number(String(raw).trim().replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function calcVariacao(
  inicial: number,
  entradas: number,
  saidas: number,
  final: number,
) {
  const esperado = inicial + entradas - saidas;
  return Number((final - esperado).toFixed(3));
}

async function lastMarcacaoFinal(tanqueId: string, beforeDate: string) {
  const { data } = await supabase
    .from("marcacao_tanques")
    .select("marcacao_final")
    .eq("tanque", tanqueId)
    .lt("data", beforeDate)
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.marcacao_final != null) return Number(data.marcacao_final) || 0;
  return null;
}

export default function MedicaoTanquesPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [filialFiltro, setFilialFiltro] = useState("");
  const [items, setItems] = useState<MarcacaoItem[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [formFilial, setFormFilial] = useState("");
  const [formData, setFormData] = useState(isoToday());
  const [lines, setLines] = useState<LineForm[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<MarcacaoItem | null>(null);

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
      let query = supabase
        .from("marcacao_tanques")
        .select(
          `
          id, filial, data, tanque, produto,
          marcacao_inicial, entradas, saidas_ai, marcacao_final, variacao,
          tanques ( numero, descricao ),
          produtos ( codigo, descricao )
        `,
        )
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });

      if (filialFiltro) query = query.eq("filial", filialFiltro);

      const { data, error } = await query;
      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      const raw = (data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          filial: r.filial != null ? String(r.filial) : null,
          data: String(r.data ?? "").slice(0, 10),
          tanque: String(r.tanque),
          produto: r.produto != null ? String(r.produto) : null,
          marcacao_inicial: Number(r.marcacao_inicial) || 0,
          entradas: Number(r.entradas) || 0,
          saidas_ai: Number(r.saidas_ai) || 0,
          marcacao_final: Number(r.marcacao_final) || 0,
          variacao: Number(r.variacao) || 0,
          tanque_row: asOne(
            r.tanques as
              | { numero: string; descricao: string }
              | { numero: string; descricao: string }[]
              | null,
          ),
          produto_row: asOne(
            r.produtos as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
        } satisfies Omit<MarcacaoItem, "filial_row">;
      });

      const filialIds = [
        ...new Set(raw.map((r) => r.filial).filter(Boolean) as string[]),
      ];
      let filialMap = new Map<string, { codigo: string; fantasia: string | null }>();
      if (filialIds.length) {
        const { data: fils } = await supabase
          .from("filial")
          .select("id, codigo, fantasia")
          .in("id", filialIds);
        filialMap = new Map(
          (fils ?? []).map((f) => [
            String(f.id),
            {
              codigo: String(f.codigo),
              fantasia: f.fantasia != null ? String(f.fantasia) : null,
            },
          ]),
        );
      }

      setItems(
        raw.map((r) => ({
          ...r,
          filial_row: r.filial ? filialMap.get(r.filial) ?? null : null,
        })),
      );
    });
  }, [pesquisar, filialFiltro]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const buildLines = useCallback(
    async (filialId: string, dataIso: string) => {
      setLinesLoading(true);
      setFormError("");
      try {
        const [tanquesRes, existingRes] = await Promise.all([
          supabase
            .from("tanques")
            .select(
              `
              id, numero, descricao, produto_id, volume_atual,
              produtos ( codigo, descricao )
            `,
            )
            .eq("status", "operante")
            .eq("filial", filialId)
            .order("numero"),
          supabase
            .from("marcacao_tanques")
            .select(
              "id, tanque, produto, marcacao_inicial, entradas, saidas_ai, marcacao_final",
            )
            .eq("filial", filialId)
            .eq("data", dataIso),
        ]);

        if (tanquesRes.error) throw new Error(tanquesRes.error.message);
        if (existingRes.error) throw new Error(existingRes.error.message);

        const existingByTanque = new Map(
          (existingRes.data ?? []).map((e) => [String(e.tanque), e]),
        );

        const tanques = (tanquesRes.data ?? []).map((t) => {
          const prod = asOne(
            t.produtos as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          );
          return {
            id: String(t.id),
            numero: String(t.numero),
            descricao: String(t.descricao),
            produto_id: t.produto_id != null ? String(t.produto_id) : null,
            volume_atual: t.volume_atual != null ? Number(t.volume_atual) : 0,
            produto: prod,
          } satisfies TanqueAtivo;
        });

        if (!tanques.length) {
          setLines([]);
          setFormError("Nenhum tanque ativo (operante) nesta filial.");
          return;
        }

        const nextLines: LineForm[] = [];
        for (const t of tanques) {
          const existing = existingByTanque.get(t.id);
          let inicial = 0;
          if (existing) {
            inicial = Number(existing.marcacao_inicial) || 0;
          } else {
            const prev = await lastMarcacaoFinal(t.id, dataIso);
            inicial =
              prev != null
                ? prev
                : Number(t.volume_atual) || 0;
          }

          const entradas = existing ? Number(existing.entradas) || 0 : 0;
          const saidas = existing ? Number(existing.saidas_ai) || 0 : 0;
          const finalVal = existing
            ? Number(existing.marcacao_final) || 0
            : inicial;

          const prodLabel = t.produto
            ? `${t.produto.codigo} — ${t.produto.descricao}`
            : "—";

          nextLines.push({
            tanqueId: t.id,
            numero: t.numero,
            descricao: t.descricao,
            produtoId: t.produto_id,
            produtoLabel: prodLabel,
            existingId: existing ? String(existing.id) : null,
            marcacao_inicial: inicial,
            entradas,
            saidas_ai: saidas,
            marcacao_final: String(finalVal),
          });
        }

        setLines(nextLines);
      } catch (err) {
        setLines([]);
        setFormError(
          err instanceof Error ? err.message : "Falha ao carregar tanques.",
        );
      } finally {
        setLinesLoading(false);
      }
    },
    [],
  );

  const openCreate = () => {
    const filial =
      filialFiltro || (filiais.length === 1 ? filiais[0].id : "");
    setFormFilial(filial);
    setFormData(isoToday());
    setLines([]);
    setFormError("");
    setModalOpen(true);
  };

  const openEditDay = (item: MarcacaoItem) => {
    if (!item.filial) {
      setActionError("Registro sem filial.");
      return;
    }
    setFormFilial(item.filial);
    setFormData(item.data);
    setLines([]);
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setFormError("");
  };

  useEffect(() => {
    if (!modalOpen || !formFilial || !formData) return;
    void buildLines(formFilial, formData);
  }, [modalOpen, formFilial, formData, buildLines]);

  const updateFinal = (tanqueId: string, value: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.tanqueId === tanqueId ? { ...l, marcacao_final: value } : l,
      ),
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formFilial) {
      setFormError("Selecione a filial.");
      return;
    }
    if (!formData) {
      setFormError("Informe a data da medição.");
      return;
    }
    if (!lines.length) {
      setFormError("Não há tanques para gravar.");
      return;
    }

    setFormError("");
    try {
      await gravar(async () => {
        for (const line of lines) {
          const final = parseLiters(line.marcacao_final);
          const payload = {
            filial: formFilial,
            data: formData,
            tanque: line.tanqueId,
            produto: line.produtoId,
            marcacao_inicial: line.marcacao_inicial,
            entradas: line.entradas,
            saidas_ai: line.saidas_ai,
            marcacao_final: final,
            variacao: calcVariacao(
              line.marcacao_inicial,
              line.entradas,
              line.saidas_ai,
              final,
            ),
          };

          if (line.existingId) {
            const { error } = await supabase
              .from("marcacao_tanques")
              .update(payload)
              .eq("id", line.existingId);
            if (error) throw new Error(error.message);
          } else {
            const { error } = await supabase
              .from("marcacao_tanques")
              .insert(payload);
            if (error) throw new Error(error.message);
          }
        }
      });

      setModalOpen(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await gravar(async () => {
        const { error } = await supabase
          .from("marcacao_tanques")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  };

  const rows = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      const na = a.tanque_row?.numero ?? "";
      const nb = b.tanque_row?.numero ?? "";
      return na.localeCompare(nb, "pt-BR", { numeric: true });
    });

    let lastData = "";
    return sorted.map((item) => {
      const showDate = item.data !== lastData;
      lastData = item.data;
      const fil = item.filial_row;
      const filLabel = fil
        ? fil.fantasia
          ? `${fil.codigo} — ${fil.fantasia}`
          : fil.codigo
        : "—";
      const tanqueLabel = item.tanque_row
        ? `${item.tanque_row.numero} — ${item.tanque_row.descricao}`
        : item.tanque.slice(0, 8);
      const prodLabel = item.produto_row
        ? `${item.produto_row.codigo} — ${item.produto_row.descricao}`
        : "—";

      return {
        data: showDate ? (
          <strong style={{ color: "var(--text-primary)" }}>
            {formatDateBr(item.data)}
          </strong>
        ) : (
          <span style={{ color: "var(--text-muted)" }}>↳</span>
        ),
        filial: filLabel,
        tanque: tanqueLabel,
        produto: prodLabel,
        inicial: formatLiters(item.marcacao_inicial),
        entradas: formatLiters(item.entradas),
        saidas: formatLiters(item.saidas_ai),
        final: formatLiters(item.marcacao_final),
        variacao: (
          <span
            style={{
              color:
                item.variacao < -0.001
                  ? "#f87171"
                  : item.variacao > 0.001
                    ? "#4ade80"
                    : "var(--text-secondary)",
              fontWeight: 600,
            }}
          >
            {formatLiters(item.variacao)}
          </span>
        ),
        acoes: (
          <CadastroRowActions
            disabled={busy}
            onEdit={() => openEditDay(item)}
            onDelete={() => {
              setDeleting(item);
              setActionError("");
            }}
          />
        ),
      };
    });
  }, [items, busy]);

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar marcações: ${loadError}`}
          onClose={() => setLoadError("")}
        />
      ) : null}

      {actionError && !deleting ? (
        <CadastroFormError
          message={actionError}
          onClose={() => setActionError("")}
        />
      ) : null}

      <ModulePage
        title="Medição de Tanques"
        description="Registro e conferência do volume dos tanques"
        icon={<Gauge size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Nova medição"
        backUrl="/movimento"
        onAdd={busy ? undefined : openCreate}
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

      {modalOpen ? (
        <CadastroModal
          title="Nova medição de tanques"
          titleId="medicao-tanques-title"
          subtitle="Informe a filial e a data. A marcação inicial vem da final do dia anterior."
          onClose={closeModal}
          disabled={busy}
          width={920}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions
              onCancel={closeModal}
              disabled={busy || linesLoading}
              busy={busy}
            />
          }
        >
          <CadastroFormGrid>
            <div className="cadastro-form-row cadastro-form-row-2">
              <CadastroField label="Filial *" htmlFor="med-filial">
                <select
                  id="med-filial"
                  className="input-base input-compact"
                  value={formFilial}
                  onChange={(e) => setFormFilial(e.target.value)}
                  disabled={busy || linesLoading}
                  required
                >
                  <option value="">— Selecione —</option>
                  {filiais.map((f) => (
                    <option key={f.id} value={f.id}>
                      {filialLabel(f)}
                    </option>
                  ))}
                </select>
              </CadastroField>

              <CadastroField label="Data da medição *" htmlFor="med-data">
                <input
                  id="med-data"
                  type="date"
                  className="input-base input-compact"
                  value={formData}
                  onChange={(e) => setFormData(e.target.value)}
                  disabled={busy || linesLoading}
                  required
                />
              </CadastroField>
            </div>
          </CadastroFormGrid>

          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Tanque</th>
                    <th>Produto</th>
                    <th style={{ textAlign: "right" }}>Marcac. inicial</th>
                    <th style={{ textAlign: "right" }}>Entradas</th>
                    <th style={{ textAlign: "right" }}>Saídas AI</th>
                    <th style={{ textAlign: "right" }}>Marcac. final</th>
                    <th style={{ textAlign: "right" }}>Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {linesLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{ textAlign: "center", padding: 24 }}
                      >
                        Carregando tanques…
                      </td>
                    </tr>
                  ) : lines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          padding: 24,
                          color: "var(--text-muted)",
                        }}
                      >
                        {formFilial
                          ? "Nenhum tanque ativo nesta filial."
                          : "Selecione a filial para listar os tanques."}
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => {
                      const final = parseLiters(line.marcacao_final);
                      const variacao = calcVariacao(
                        line.marcacao_inicial,
                        line.entradas,
                        line.saidas_ai,
                        final,
                      );
                      return (
                        <tr key={line.tanqueId}>
                          <td>
                            <strong>{line.numero}</strong>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text-muted)",
                              }}
                            >
                              {line.descricao}
                            </div>
                          </td>
                          <td style={{ fontSize: 12 }}>{line.produtoLabel}</td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              className="input-base input-compact"
                              value={formatLiters(line.marcacao_inicial)}
                              readOnly
                              disabled
                              style={{
                                textAlign: "right",
                                maxWidth: 110,
                                marginLeft: "auto",
                              }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              className="input-base input-compact"
                              value={formatLiters(line.entradas)}
                              readOnly
                              disabled
                              style={{
                                textAlign: "right",
                                maxWidth: 100,
                                marginLeft: "auto",
                              }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              className="input-base input-compact"
                              value={formatLiters(line.saidas_ai)}
                              readOnly
                              disabled
                              style={{
                                textAlign: "right",
                                maxWidth: 100,
                                marginLeft: "auto",
                              }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              className="input-base input-compact"
                              value={line.marcacao_final}
                              onChange={(e) =>
                                updateFinal(line.tanqueId, e.target.value)
                              }
                              disabled={busy}
                              inputMode="decimal"
                              style={{
                                textAlign: "right",
                                maxWidth: 120,
                                marginLeft: "auto",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontWeight: 600,
                              color:
                                variacao < -0.001
                                  ? "#f87171"
                                  : variacao > 0.001
                                    ? "#4ade80"
                                    : "var(--text-secondary)",
                            }}
                          >
                            {formatLiters(variacao)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <CadastroFormError
            message={formError}
            onClose={() => setFormError("")}
          />
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir medição"
          titleId="medicao-delete-title"
          onClose={() => {
            if (!busy) setDeleting(null);
          }}
          disabled={busy}
          width={420}
          footer={
            <CadastroFormActions
              onCancel={() => setDeleting(null)}
              disabled={busy}
              busy={busy}
              danger
              submitLabel="Excluir"
              busyLabel="Excluindo..."
              onConfirm={() => void handleDelete()}
            />
          }
        >
          {actionError ? (
            <CadastroFormError
              message={actionError}
              onClose={() => setActionError("")}
            />
          ) : null}
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
            Confirma a exclusão da medição do tanque{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.tanque_row?.numero ?? "—"} em{" "}
              {formatDateBr(deleting.data)}
            </strong>
            ?
          </p>
        </CadastroModal>
      ) : null}
    </>
  );
}
