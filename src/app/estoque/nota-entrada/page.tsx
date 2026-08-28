"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileInput, RefreshCw } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import { CadastroFormError } from "@/components/CadastroUi";
import { supabase } from "@/lib/supabase";

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
  cnpj: string | null;
};

type ManifestoRow = {
  id: string;
  filial: string | null;
  chave: string | null;
  fornecedor: string | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  fornecedor_ie: string | null;
  emissao: string | null;
  numero: number | null;
  valor: number;
  caminho: string | null;
  manifesto_registro: string | null;
  manifesto_protocolo: string | null;
  nsu: string | null;
  xml: number;
  digitada: number;
  nota_compra: string | null;
};

const columns = [
  { key: "numero", label: "Número" },
  { key: "emissao", label: "Emissão" },
  { key: "fornecedor", label: "Fornecedor" },
  { key: "cnpj", label: "CNPJ" },
  { key: "valor", label: "Valor", align: "right" as const },
  { key: "nsu", label: "NSU" },
  { key: "xml", label: "XML", align: "center" as const },
  { key: "digitada", label: "Digitada", align: "center" as const },
  { key: "chave", label: "Chave" },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function formatCnpj(raw: string | null) {
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length !== 14) return raw || "—";
  return d.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

function formatDateBr(iso: string | null) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

function formatMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function shortChave(chave: string | null) {
  const c = String(chave || "");
  if (c.length < 12) return c || "—";
  return `${c.slice(0, 6)}…${c.slice(-6)}`;
}

export default function NotaEntradaManifestoPage() {
  const router = useRouter();
  const { busy, pesquisar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [filialId, setFilialId] = useState("");
  const [items, setItems] = useState<ManifestoRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [consultando, setConsultando] = useState(false);

  const filialSel = useMemo(
    () => filiais.find((f) => f.id === filialId) ?? null,
    [filiais, filialId],
  );

  const loadFiliais = useCallback(async () => {
    const { data } = await supabase
      .from("filial")
      .select("id, codigo, fantasia, razao_social, cnpj")
      .eq("status", "ativo")
      .order("codigo");

    const rows = (data ?? []).map((f) => ({
      id: String(f.id),
      codigo: String(f.codigo),
      fantasia: f.fantasia != null ? String(f.fantasia) : null,
      razao_social: String(f.razao_social ?? ""),
      cnpj: f.cnpj != null ? String(f.cnpj) : null,
    }));
    setFiliais(rows);
    setFilialId((prev) => prev || (rows.length === 1 ? rows[0].id : ""));
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      let q = supabase
        .from("nota_entradamanifesto")
        .select(
          `
          id, filial, chave, fornecedor, fornecedor_nome, fornecedor_cnpj,
          fornecedor_ie, emissao, numero, valor, caminho, manifesto_registro,
          manifesto_protocolo, nsu, xml, digitada, nota_compra
        `,
        )
        .order("emissao", { ascending: false })
        .order("numero", { ascending: false });

      if (filialId) q = q.eq("filial", filialId);

      const { data, error } = await q;
      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      setItems(
        (data ?? []).map((row) => ({
          id: String(row.id),
          filial: row.filial != null ? String(row.filial) : null,
          chave: row.chave != null ? String(row.chave) : null,
          fornecedor: row.fornecedor != null ? String(row.fornecedor) : null,
          fornecedor_nome:
            row.fornecedor_nome != null ? String(row.fornecedor_nome) : null,
          fornecedor_cnpj:
            row.fornecedor_cnpj != null ? String(row.fornecedor_cnpj) : null,
          fornecedor_ie:
            row.fornecedor_ie != null ? String(row.fornecedor_ie) : null,
          emissao: row.emissao != null ? String(row.emissao) : null,
          numero: row.numero != null ? Number(row.numero) : null,
          valor: Number(row.valor) || 0,
          caminho: row.caminho != null ? String(row.caminho) : null,
          manifesto_registro:
            row.manifesto_registro != null
              ? String(row.manifesto_registro)
              : null,
          manifesto_protocolo:
            row.manifesto_protocolo != null
              ? String(row.manifesto_protocolo)
              : null,
          nsu: row.nsu != null ? String(row.nsu) : null,
          xml: Number(row.xml) || 0,
          digitada: Number(row.digitada) || 0,
          nota_compra:
            row.nota_compra != null ? String(row.nota_compra) : null,
        })),
      );
    });
  }, [pesquisar, filialId]);

  useEffect(() => {
    void loadFiliais();
  }, [loadFiliais]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const consultarSefaz = async () => {
    if (!filialId) {
      setActionError("Selecione a filial (CNPJ destinatário) antes de consultar.");
      return;
    }
    setConsultando(true);
    setActionError("");
    setInfoMsg("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await fetch("/api/estoque/manifesto/consultar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filialId }),
      });

      const json = (await res.json()) as {
        error?: string;
        message?: string;
        upserted?: number;
        recebidos?: number;
        cnpj?: string;
      };

      if (!res.ok) {
        throw new Error(json.error || "Falha ao consultar a SEFAZ.");
      }

      setInfoMsg(
        json.message ||
          `${json.upserted ?? 0} nota(s) sincronizada(s) para o CNPJ ${formatCnpj(json.cnpj ?? null)}.`,
      );
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao consultar a SEFAZ.",
      );
    } finally {
      setConsultando(false);
    }
  };

  const rows = items.map((item) => ({
    numero: item.numero != null ? String(item.numero) : "—",
    emissao: formatDateBr(item.emissao),
    fornecedor: item.fornecedor_nome?.trim() || "—",
    cnpj: formatCnpj(item.fornecedor_cnpj),
    valor: formatMoney(item.valor),
    nsu: item.nsu || "—",
    xml: (
      <span className={`badge ${item.xml ? "badge-success" : "badge-warning"}`}>
        {item.xml ? "Sim" : "Não"}
      </span>
    ),
    digitada: (
      <span
        className={`badge ${item.digitada ? "badge-success" : "badge-warning"}`}
      >
        {item.digitada ? "Sim" : "Não"}
      </span>
    ),
    chave: (
      <span title={item.chave || undefined} style={{ fontFamily: "monospace" }}>
        {shortChave(item.chave)}
      </span>
    ),
    acoes: (
      <button
        type="button"
        className="cadastro-btn-edit"
        disabled={busy || consultando}
        onClick={() =>
          router.push(`/estoque/nota-entrada/cadastro?manifesto=${item.id}`)
        }
      >
        {item.digitada ? "Abrir" : "Digitar"}
      </button>
    ),
  }));

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar manifesto: ${loadError}`}
          onClose={() => setLoadError("")}
        />
      ) : null}

      {actionError ? (
        <CadastroFormError
          message={actionError}
          onClose={() => setActionError("")}
        />
      ) : null}

      {infoMsg ? (
        <CadastroFormError
          type="warning"
          title="Consulta SEFAZ"
          message={infoMsg}
          onClose={() => setInfoMsg("")}
        />
      ) : null}

      <ModulePage
        title="Nota de Entrada"
        description="Notas emitidas contra o CNPJ da filial (manifesto / DF-e SEFAZ)"
        icon={<FileInput size={22} />}
        columns={columns}
        rows={rows}
        addLabel={consultando ? "Consultando…" : "Consultar SEFAZ"}
        backUrl="/estoque"
        onAdd={busy || consultando ? undefined : () => void consultarSefaz()}
        filters={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <select
              className="input-base"
              style={{ minWidth: 260 }}
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              disabled={busy || consultando}
            >
              <option value="">Todas as filiais</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {filialLabel(f)}
                </option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              CNPJ destinatário:{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                {filialSel ? formatCnpj(filialSel.cnpj) : "—"}
              </strong>
            </span>
            <button
              type="button"
              className="cadastro-btn-edit"
              disabled={busy || consultando}
              onClick={() => void loadData()}
              title="Atualizar grid"
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
            <Link
              href="/estoque/nota-entrada/cadastro"
              className="cadastro-btn-edit"
              style={{ textDecoration: "none" }}
            >
              Cadastro manual
            </Link>
          </div>
        }
      />
    </>
  );
}
