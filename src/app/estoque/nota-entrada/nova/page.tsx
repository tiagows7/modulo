"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileInput, FileUp, RefreshCw } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import {
  CadastroFormActions,
  CadastroFormError,
  CadastroModal,
} from "@/components/CadastroUi";
import { parseNfeXml } from "@/lib/nfe/parseNfeXml";
import { ensureFornecedorFromNfe } from "@/lib/nfe/ensureFornecedorFromNfe";
import { classificarItensXml } from "@/lib/nfe/xmlProdutoVinculo";
import { lancarDespesaFromManifesto } from "@/lib/financeiro/lancarDespesaFromManifesto";
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
  despesa: number;
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
  { key: "despesa", label: "Despesa", align: "center" as const },
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

export default function NotaEntradaNovaPage() {
  const router = useRouter();
  const { busy, pesquisar, gravar } = useDbStatus();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [filialId, setFilialId] = useState("");
  const [items, setItems] = useState<ManifestoRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [consultando, setConsultando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [deleting, setDeleting] = useState<ManifestoRow | null>(null);
  const [despesaItem, setDespesaItem] = useState<ManifestoRow | null>(null);

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
          manifesto_protocolo, nsu, xml, digitada, despesa, nota_compra
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
          despesa: Number(row.despesa) || 0,
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

  const abrirDigitar = async (id: string) => {
    try {
      const { data: man, error } = await supabase
        .from("nota_entradamanifesto")
        .select("id, fornecedor, xml_conteudo")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (man?.xml_conteudo) {
        const parsed = parseNfeXml(String(man.xml_conteudo));
        const fornId = man.fornecedor != null ? String(man.fornecedor) : null;
        const { pendentes } = await classificarItensXml(parsed, fornId);
        if (pendentes.length > 0) {
          router.push(
            `/estoque/nota-entrada/vincular-produtos?manifesto=${id}`,
          );
          return;
        }
      }
    } catch {
      // segue para digitação
    }
    router.push(`/estoque/nota-entrada?manifesto=${id}`);
  };

  const consultarSefaz = async () => {
    if (!filialId) {
      setActionError(
        "Selecione a filial (CNPJ destinatário) antes de consultar.",
      );
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

  const importarXml = async (file: File) => {
    if (!filialId) {
      setActionError("Selecione a filial antes de importar o XML.");
      return;
    }

    setImportando(true);
    setActionError("");
    setInfoMsg("");
    try {
      const raw = await file.text();
      const parsed = parseNfeXml(raw);

      if (!parsed.emit_cnpj || parsed.emit_cnpj.length !== 14) {
        throw new Error(
          "XML sem CNPJ do emitente. Não é possível importar/cadastrar o fornecedor.",
        );
      }

      const forn = await ensureFornecedorFromNfe(parsed);
      if (!forn) {
        throw new Error("Não foi possível identificar o fornecedor do XML.");
      }

      const fornecedorId = forn.id;
      const avisoFornecedor = forn.criado
        ? `Fornecedor cadastrado: ${forn.codigo ? `${forn.codigo} — ` : ""}${forn.nome}`
        : "";

      const payload = {
        filial: filialId,
        chave: parsed.chave,
        fornecedor: fornecedorId,
        fornecedor_nome: parsed.emit_nome
          ? parsed.emit_nome.slice(0, 120)
          : forn.nome.slice(0, 120),
        fornecedor_cnpj: parsed.emit_cnpj,
        fornecedor_ie: parsed.emit_ie
          ? parsed.emit_ie.slice(0, 14)
          : null,
        emissao: parsed.emissao,
        numero: parsed.numero,
        valor: parsed.valor,
        caminho: file.name.slice(0, 350),
        manifesto_registro: new Date().toISOString(),
        manifesto_protocolo: parsed.protocolo
          ? parsed.protocolo.slice(0, 40)
          : null,
        xml: 1,
        digitada: 0,
        xml_conteudo: parsed.xml,
      };

      const { data, error } = await supabase
        .from("nota_entradamanifesto")
        .upsert(payload, { onConflict: "chave" })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      const manifestoPk = data?.id ? String(data.id) : "";
      const { pendentes } = await classificarItensXml(parsed, fornecedorId);

      const baseMsg = `XML importado: NF ${parsed.numero ?? "—"} — ${parsed.emit_nome || forn.nome} (${parsed.itens.length} item(ns)).`;
      setInfoMsg(avisoFornecedor ? `${avisoFornecedor}\n\n${baseMsg}` : baseMsg);
      await loadData();

      if (!manifestoPk) return;

      const qs = new URLSearchParams({ manifesto: manifestoPk });
      if (avisoFornecedor) {
        qs.set("fornecedorNovo", "1");
        qs.set("fornecedorNome", forn.nome);
        if (forn.codigo) qs.set("fornecedorCodigo", forn.codigo);
      }

      if (pendentes.length > 0) {
        router.push(
          `/estoque/nota-entrada/vincular-produtos?${qs.toString()}`,
        );
      } else {
        router.push(`/estoque/nota-entrada?${qs.toString()}`);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao importar o XML.",
      );
    } finally {
      setImportando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const marcarDespesa = async () => {
    if (!despesaItem) return;
    setActionError("");
    try {
      await gravar(async () => {
        await lancarDespesaFromManifesto({
          id: despesaItem.id,
          filial: despesaItem.filial,
          fornecedor: despesaItem.fornecedor,
          fornecedor_cnpj: despesaItem.fornecedor_cnpj,
          fornecedor_nome: despesaItem.fornecedor_nome,
          numero: despesaItem.numero,
          emissao: despesaItem.emissao,
          valor: despesaItem.valor,
          chave: despesaItem.chave,
        });
      });
      setDespesaItem(null);
      setInfoMsg(
        `Despesa lançada em Contas a Pagar (título ${despesaItem.numero ?? "—"}). Nota de entrada não foi gerada.`,
      );
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao marcar como despesa.",
      );
    }
  };

  const excluirManifesto = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await gravar(async () => {
        const { error } = await supabase
          .from("nota_entradamanifesto")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o manifesto.",
      );
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
    despesa: (
      <span
        className={`badge ${item.despesa ? "badge-success" : "badge-warning"}`}
      >
        {item.despesa ? "Sim" : "Não"}
      </span>
    ),
    chave: (
      <span title={item.chave || undefined} style={{ fontFamily: "monospace" }}>
        {shortChave(item.chave)}
      </span>
    ),
    acoes: (
      <div className="cadastro-row-actions">
        {!item.despesa ? (
          <button
            type="button"
            className="cadastro-btn-edit"
            disabled={busy || consultando || importando}
            onClick={() => void abrirDigitar(item.id)}
          >
            {item.digitada ? "Abrir" : "Digitar"}
          </button>
        ) : null}
        {!item.despesa && !item.digitada ? (
          <button
            type="button"
            className="cadastro-btn-edit"
            disabled={busy || consultando || importando}
            onClick={() => {
              setActionError("");
              setDespesaItem(item);
            }}
            title="Marcar como despesa do posto (sem estoque)"
          >
            Despesa
          </button>
        ) : null}
        <button
          type="button"
          className="cadastro-btn-delete"
          disabled={busy || consultando || importando}
          onClick={() => {
            setActionError("");
            setDeleting(item);
          }}
        >
          Excluir
        </button>
      </div>
    ),
  }));

  const bloqueado = busy || consultando || importando;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importarXml(file);
        }}
      />

      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar manifesto: ${loadError}`}
          onClose={() => setLoadError("")}
        />
      ) : null}

      {actionError && !deleting && !despesaItem ? (
        <CadastroFormError
          message={actionError}
          onClose={() => setActionError("")}
        />
      ) : null}

      {infoMsg ? (
        <CadastroFormError
          type="warning"
          title="Manifesto"
          message={infoMsg}
          onClose={() => setInfoMsg("")}
        />
      ) : null}

      <ModulePage
        title="Nova Nota de Entrada"
        description="Consulte a SEFAZ ou importe o XML da NF-e emitida contra o CNPJ da filial"
        icon={<FileInput size={22} />}
        columns={columns}
        rows={rows}
        addLabel={consultando ? "Consultando…" : "Consultar SEFAZ"}
        backUrl="/estoque/nota-entrada"
        onAdd={bloqueado ? undefined : () => void consultarSefaz()}
        filters={
          <>
            <select
              className="input-base input-compact"
              style={{ minWidth: 240, width: "auto", flex: "0 1 280px" }}
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              disabled={bloqueado}
              aria-label="Filial destinatária"
            >
              <option value="">Selecione a filial…</option>
              {filiais.map((f) => (
                <option key={f.id} value={f.id}>
                  {filialLabel(f)}
                </option>
              ))}
            </select>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              CNPJ:{" "}
              <strong style={{ color: "var(--text-secondary)" }}>
                {filialSel ? formatCnpj(filialSel.cnpj) : "—"}
              </strong>
            </span>
            <button
              type="button"
              className="cadastro-btn-edit"
              disabled={bloqueado}
              onClick={() => void loadData()}
              title="Atualizar grid"
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
            <button
              type="button"
              className="cadastro-btn-edit"
              disabled={bloqueado}
              onClick={() => {
                if (!filialId) {
                  setActionError(
                    "Selecione a filial antes de importar o XML.",
                  );
                  return;
                }
                fileRef.current?.click();
              }}
            >
              <FileUp size={12} />
              {importando ? "Importando…" : "Importar XML"}
            </button>
            <button
              type="button"
              className="cadastro-btn-edit"
              disabled={bloqueado}
              onClick={() =>
                router.push("/estoque/nota-entrada?manual=1")
              }
            >
              Nota manual
            </button>
          </>
        }
      />

      {despesaItem ? (
        <CadastroModal
          title="Marcar como despesa"
          titleId="manifesto-despesa-title"
          onClose={() => {
            if (busy) return;
            setDespesaItem(null);
          }}
          disabled={busy}
          width={440}
          footer={
            <CadastroFormActions
              onCancel={() => setDespesaItem(null)}
              disabled={busy}
              busy={busy}
              submitLabel="Confirmar despesa"
              onConfirm={() => void marcarDespesa()}
              danger
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Confirma que a nota{" "}
            <strong>{despesaItem.numero ?? "—"}</strong>
            {despesaItem.fornecedor_nome
              ? ` — ${despesaItem.fornecedor_nome}`
              : ""}{" "}
            é apenas <strong>despesa do posto</strong>? Será lançada em Contas a
            Pagar, sem gerar nota de entrada/estoque.
          </p>
          {actionError ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "var(--danger, #e35d6a)",
              }}
            >
              {actionError}
            </p>
          ) : null}
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir do manifesto"
          titleId="manifesto-delete-title"
          onClose={() => {
            if (busy) return;
            setDeleting(null);
          }}
          disabled={busy}
          width={420}
          footer={
            <CadastroFormActions
              onCancel={() => setDeleting(null)}
              disabled={busy}
              busy={busy}
              submitLabel="Excluir"
              onConfirm={() => void excluirManifesto()}
              danger
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Excluir a nota <strong>{deleting.numero ?? "—"}</strong> do manifesto
            SEFAZ?
            {deleting.chave ? (
              <>
                <br />
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                  {deleting.chave}
                </span>
              </>
            ) : null}
          </p>
          {actionError ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "var(--danger, #e35d6a)",
              }}
            >
              {actionError}
            </p>
          ) : null}
        </CadastroModal>
      ) : null}
    </>
  );
}
