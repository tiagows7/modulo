"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Link2 } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";
import { useDbStatus } from "@/components/DbStatusProvider";
import {
  CadastroFormActions,
  CadastroFormError,
  CadastroModal,
} from "@/components/CadastroUi";
import { parseNfeXml, type NfeXmlItem } from "@/lib/nfe/parseNfeXml";
import {
  classificarItensXml,
  itemToVinculoPayload,
} from "@/lib/nfe/xmlProdutoVinculo";
import { supabase } from "@/lib/supabase";

type ProdutoOpt = {
  id: string;
  codigo: string;
  descricao: string;
};

type PendenteRow = NfeXmlItem & {
  produto_sistema: string;
};

function uniqueByCProd(items: NfeXmlItem[]): NfeXmlItem[] {
  const map = new Map<string, NfeXmlItem>();
  for (const item of items) {
    const key = item.c_prod.trim();
    if (!key || map.has(key)) continue;
    map.set(key, item);
  }
  return [...map.values()];
}

function VincularProdutosPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manifestoId = searchParams.get("manifesto") || "";
  const { busy, pesquisar, gravar } = useDbStatus();

  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [pendentes, setPendentes] = useState<PendenteRow[]>([]);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [fornecedorNome, setFornecedorNome] = useState("");
  const [notaLabel, setNotaLabel] = useState("");
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!manifestoId) {
      setLoadError("Manifesto não informado.");
      return;
    }

    await pesquisar(async () => {
      setLoadError("");
      const [{ data: man, error: manErr }, prodRes] = await Promise.all([
        supabase
          .from("nota_entradamanifesto")
          .select(
            "id, numero, fornecedor, fornecedor_nome, fornecedor_cnpj, xml_conteudo",
          )
          .eq("id", manifestoId)
          .maybeSingle(),
        supabase
          .from("produtos")
          .select("id, codigo, descricao")
          .eq("status", "ativo")
          .order("descricao")
          .limit(800),
      ]);

      if (manErr) {
        setLoadError(manErr.message);
        return;
      }
      if (!man) {
        setLoadError("Manifesto não encontrado.");
        return;
      }
      if (!man.xml_conteudo) {
        setLoadError(
          "Este manifesto não possui XML armazenado. Importe o XML novamente.",
        );
        return;
      }

      setFornecedorId(man.fornecedor != null ? String(man.fornecedor) : null);
      setFornecedorNome(
        String(man.fornecedor_nome || man.fornecedor_cnpj || "Fornecedor"),
      );
      setNotaLabel(
        man.numero != null ? `NF ${man.numero}` : "Nota importada",
      );

      setProdutos(
        (prodRes.data ?? []).map((p) => ({
          id: String(p.id),
          codigo: String(p.codigo ?? ""),
          descricao: String(p.descricao ?? ""),
        })),
      );

      let parsed;
      try {
        parsed = parseNfeXml(String(man.xml_conteudo));
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Falha ao ler o XML.",
        );
        return;
      }

      const fornId = man.fornecedor != null ? String(man.fornecedor) : null;
      const { pendentes: pend } = await classificarItensXml(parsed, fornId);
      const uniq = uniqueByCProd(pend);
      setPendentes(
        uniq.map((item) => ({
          ...item,
          produto_sistema: "",
        })),
      );
    });
  }, [manifestoId, pesquisar]);

  useEffect(() => {
    void load();
  }, [load]);

  const setProduto = (cProd: string, produtoId: string) => {
    setPendentes((prev) =>
      prev.map((row) =>
        row.c_prod === cProd ? { ...row, produto_sistema: produtoId } : row,
      ),
    );
  };

  const todosVinculados = useMemo(
    () => pendentes.length > 0 && pendentes.every((p) => p.produto_sistema),
    [pendentes],
  );

  const salvarEContinuar = async () => {
    if (!pendentes.length) {
      router.push(`/estoque/nota-entrada?manifesto=${manifestoId}`);
      return;
    }
    const faltando = pendentes.filter((p) => !p.produto_sistema);
    if (faltando.length) {
      setFormError(
        `Vincule todos os produtos (${faltando.length} pendente(s)).`,
      );
      return;
    }

    setFormError("");
    try {
      if (!fornecedorId) {
        throw new Error(
          "Fornecedor não identificado no manifesto. Cadastre o fornecedor pelo CNPJ do XML antes de vincular.",
        );
      }
      await gravar(async () => {
        const payload = pendentes.map((item) =>
          itemToVinculoPayload(item, item.produto_sistema, fornecedorId),
        );
        const { error } = await supabase
          .from("nota_xmlproduto")
          .upsert(payload, { onConflict: "fornecedor,produto_xml" });
        if (error) throw new Error(error.message);
      });
      router.push(`/estoque/nota-entrada?manifesto=${manifestoId}`);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Falha ao gravar vínculos.",
      );
    }
  };

  const rows = pendentes.map((item) => ({
    c_prod: item.c_prod || "—",
    descricao: item.x_prod || "—",
    ean: item.c_ean || "—",
    ncm: item.ncm || "—",
    cfop: item.cfop || "—",
    un: item.u_com || "—",
    qtd: String(item.q_com || 0),
    produto: (
      <select
        className="input-base input-compact"
        style={{ minWidth: 220 }}
        value={item.produto_sistema}
        disabled={busy}
        onChange={(e) => setProduto(item.c_prod, e.target.value)}
      >
        <option value="">Selecione o produto…</option>
        {produtos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.codigo} — {p.descricao}
          </option>
        ))}
      </select>
    ),
  }));

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro"
          message={loadError}
          onClose={() => {
            setLoadError("");
            router.push("/estoque/nota-entrada/nova");
          }}
        />
      ) : null}

      {formError ? (
        <CadastroFormError
          message={formError}
          onClose={() => setFormError("")}
        />
      ) : null}

      <ModulePage
        title="Vincular produtos do XML"
        description={`${notaLabel} — ${fornecedorNome}. Associe cada código do XML a um produto do sistema.`}
        icon={<Link2 size={22} />}
        columns={[
          { key: "c_prod", label: "Cód. XML" },
          { key: "descricao", label: "Descrição XML" },
          { key: "ean", label: "EAN" },
          { key: "ncm", label: "NCM" },
          { key: "cfop", label: "CFOP" },
          { key: "un", label: "Un." },
          { key: "qtd", label: "Qtd", align: "right" as const },
          { key: "produto", label: "Produto sistema" },
        ]}
        rows={
          pendentes.length
            ? rows
            : [
                {
                  c_prod: "—",
                  descricao: "Nenhum produto pendente de vínculo.",
                  ean: "",
                  ncm: "",
                  cfop: "",
                  un: "",
                  qtd: "",
                  produto: "",
                },
              ]
        }
        addLabel={busy ? "Salvando…" : "Salvar vínculos"}
        backUrl="/estoque/nota-entrada/nova"
        onAdd={
          busy
            ? undefined
            : () => {
                if (!pendentes.length) {
                  router.push(
                    `/estoque/nota-entrada?manifesto=${manifestoId}`,
                  );
                  return;
                }
                if (!todosVinculados) {
                  setFormError("Vincule todos os produtos antes de continuar.");
                  return;
                }
                setConfirmOpen(true);
              }
        }
        filters={
          <button
            type="button"
            className="cadastro-btn-edit"
            disabled={busy}
            onClick={() =>
              router.push(`/estoque/nota-entrada?manifesto=${manifestoId}`)
            }
          >
            Pular e digitar
          </button>
        }
      />

      {confirmOpen ? (
        <CadastroModal
          title="Confirmar vínculos"
          titleId="vincular-xml-confirm"
          onClose={() => setConfirmOpen(false)}
          disabled={busy}
          width={420}
          asForm
          onSubmit={(e) => {
            e.preventDefault();
            void salvarEContinuar();
          }}
          footer={
            <CadastroFormActions
              onCancel={() => setConfirmOpen(false)}
              disabled={busy}
              busy={busy}
              submitLabel="Salvar e continuar"
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Serão gravados <strong>{pendentes.length}</strong> vínculo(s) em{" "}
            <code>nota_xmlproduto</code>. Nas próximas notas desse fornecedor, os
            itens serão preenchidos automaticamente.
          </p>
        </CadastroModal>
      ) : null}
    </>
  );
}

export default function VincularProdutosPage() {
  return (
    <Suspense fallback={null}>
      <VincularProdutosPageInner />
    </Suspense>
  );
}
