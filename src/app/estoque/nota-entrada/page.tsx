"use client";

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileInput, Plus, Trash2 } from "lucide-react";
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
import {
  formatMoney2,
  formatQty,
  maskMoneyInput,
  maskQtyInput,
  parseMoney,
} from "@/lib/moneyMask";
import { parseNfeXml } from "@/lib/nfe/parseNfeXml";
import { classificarItensXml, fatorVolumeVinculo } from "@/lib/nfe/xmlProdutoVinculo";
import {
  aplicarEntradasMarcacaoTanque,
} from "@/lib/estoque/aplicarEntradaMarcacaoTanque";
import { nextContasPagarTitulo } from "@/lib/financeiro/contasPagarTitulo";

type TabId = "geral" | "titulos" | "tanque";

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type FornecedorOpt = {
  id: string;
  codigo: string;
  razao_social: string;
  fantasia: string | null;
  cnpj: string | null;
};

type ProdutoOpt = {
  id: string;
  codigo: string;
  descricao: string;
  codigo_barras: string | null;
  combustivel: boolean;
};

type TanqueOpt = {
  id: string;
  numero: string;
  descricao: string;
  produto_id: string;
  filial: string | null;
};

type NotaItem = {
  id: string;
  nota_entrada: string;
  produto: string | null;
  n_item: number;
  c_prod: string | null;
  c_ean: string | null;
  x_prod: string;
  ncm: string | null;
  cfop: string | null;
  u_com: string | null;
  q_com: number;
  v_un_com: number;
  v_prod: number;
  c_prod_anp: string | null;
  cst_icms: string | null;
  v_bc_icms: number;
  p_icms: number;
  v_icms: number;
  cst_pis: string | null;
  v_pis: number;
  cst_cofins: string | null;
  v_cofins: number;
  v_ipi: number;
};

type NotaEntrada = {
  id: string;
  filial: string | null;
  fornecedor: string | null;
  chave: string | null;
  numero: number;
  serie: string;
  modelo: string;
  natureza_operacao: string | null;
  data_emissao: string | null;
  data_entrada: string | null;
  v_prod: number;
  v_nf: number;
  v_bc: number;
  v_icms: number;
  v_st: number;
  v_ipi: number;
  v_pis: number;
  v_cofins: number;
  v_frete: number;
  v_desc: number;
  situacao: string;
  observacao: string | null;
};

type ItemForm = {
  key: string;
  produto_id: string;
  c_prod: string;
  c_ean: string;
  x_prod: string;
  ncm: string;
  cfop: string;
  u_com: string;
  q_com: string;
  v_un_com: string;
  v_prod: string;
  c_prod_anp: string;
  cst_icms: string;
  v_bc_icms: string;
  p_icms: string;
  v_icms: string;
  cst_pis: string;
  v_pis: string;
  cst_cofins: string;
  v_cofins: string;
  v_ipi: string;
};

type TituloForm = {
  key: string;
  titulo: string;
  data_vencimento: string;
  valor: string;
};

type FormTanque = {
  itemKey: string;
  produtoId: string;
  label: string;
  qtd: string;
  tanqueId: string;
};

type NotaForm = {
  filial: string;
  fornecedor: string;
  numero: string;
  serie: string;
  modelo: string;
  chave: string;
  natureza_operacao: string;
  data_emissao: string;
  data_entrada: string;
  v_nf: string;
  v_bc: string;
  v_icms: string;
  v_st: string;
  v_ipi: string;
  v_pis: string;
  v_cofins: string;
  v_frete: string;
  v_desc: string;
  situacao: string;
  observacao: string;
};

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "titulos", label: "Títulos" },
  { id: "tanque", label: "Tanque" },
];

const emptyForm: NotaForm = {
  filial: "",
  fornecedor: "",
  numero: "",
  serie: "1",
  modelo: "55",
  chave: "",
  natureza_operacao: "",
  data_emissao: "",
  data_entrada: "",
  v_nf: "0,00",
  v_bc: "0,00",
  v_icms: "0,00",
  v_st: "0,00",
  v_ipi: "0,00",
  v_pis: "0,00",
  v_cofins: "0,00",
  v_frete: "0,00",
  v_desc: "0,00",
  situacao: "pendente",
  observacao: "",
};

function emptyItem(): ItemForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    produto_id: "",
    c_prod: "",
    c_ean: "",
    x_prod: "",
    ncm: "",
    cfop: "",
    u_com: "UN",
    q_com: "1",
    v_un_com: "0,00",
    v_prod: "0,00",
    c_prod_anp: "",
    cst_icms: "",
    v_bc_icms: "0,00",
    p_icms: "0",
    v_icms: "0,00",
    cst_pis: "",
    v_pis: "0,00",
    cst_cofins: "",
    v_cofins: "0,00",
    v_ipi: "0,00",
  };
}

function emptyTitulo(): TituloForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    titulo: "",
    data_vencimento: "",
    valor: "0,00",
  };
}

function formatPct(n: number) {
  return formatQty(n, 4);
}

const columns = [
  { key: "numero", label: "Número" },
  { key: "serie", label: "Série", align: "center" as const },
  { key: "fornecedor", label: "Fornecedor" },
  { key: "filial", label: "Filial" },
  { key: "emissao", label: "Emissão" },
  { key: "entrada", label: "Entrada" },
  { key: "valor", label: "Valor", align: "right" as const },
  { key: "status", label: "Situação", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function filialLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function fornecedorLabel(f: FornecedorOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function formatDateBr(iso: string | null) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function toDateInput(iso: string | null) {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function situacaoBadge(situacao: string) {
  const s = situacao || "pendente";
  const cls =
    s === "lancada"
      ? "badge-success"
      : s === "cancelada"
        ? "badge-danger"
        : "badge-warning";
  const label =
    s === "lancada" ? "Lançada" : s === "cancelada" ? "Cancelada" : "Pendente";
  return <span className={`badge ${cls}`}>{label}</span>;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function mapNotaRow(row: Record<string, unknown>): NotaEntrada {
  return {
    id: String(row.id),
    filial: row.filial != null ? String(row.filial) : null,
    fornecedor: row.fornecedor != null ? String(row.fornecedor) : null,
    chave: row.chave != null ? String(row.chave) : null,
    numero: Number(row.numero) || 0,
    serie: String(row.serie ?? "1"),
    modelo: String(row.modelo ?? "55"),
    natureza_operacao:
      row.natureza_operacao != null ? String(row.natureza_operacao) : null,
    data_emissao: row.data_emissao != null ? String(row.data_emissao) : null,
    data_entrada: row.data_entrada != null ? String(row.data_entrada) : null,
    v_prod: Number(row.v_prod) || 0,
    v_nf: Number(row.v_nf) || 0,
    v_bc: Number(row.v_bc) || 0,
    v_icms: Number(row.v_icms) || 0,
    v_st: Number(row.v_st) || 0,
    v_ipi: Number(row.v_ipi) || 0,
    v_pis: Number(row.v_pis) || 0,
    v_cofins: Number(row.v_cofins) || 0,
    v_frete: Number(row.v_frete) || 0,
    v_desc: Number(row.v_desc) || 0,
    situacao: String(row.situacao || "pendente"),
    observacao: row.observacao != null ? String(row.observacao) : null,
  };
}

function itemIsCombustivel(row: ItemForm, produtos: ProdutoOpt[]): boolean {
  if (row.c_prod_anp.trim()) return true;
  const p = produtos.find((x) => x.id === row.produto_id);
  return Boolean(p?.combustivel);
}

function NotaEntradaCadastroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manifestoParam = searchParams.get("manifesto");
  const manualParam = searchParams.get("manual");
  const fornecedorNovo = searchParams.get("fornecedorNovo") === "1";
  const fornecedorNomeParam = searchParams.get("fornecedorNome") || "";
  const fornecedorCodigoParam = searchParams.get("fornecedorCodigo") || "";
  const { busy, pesquisar, gravar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOpt[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [items, setItems] = useState<NotaEntrada[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotaEntrada | null>(null);
  const [deleting, setDeleting] = useState<NotaEntrada | null>(null);
  const [form, setForm] = useState<NotaForm>(emptyForm);
  const [formItems, setFormItems] = useState<ItemForm[]>([emptyItem()]);
  const [formTitulos, setFormTitulos] = useState<TituloForm[]>([emptyTitulo()]);
  const [formTanques, setFormTanques] = useState<FormTanque[]>([]);
  const [tanquesByProduto, setTanquesByProduto] = useState<
    Record<string, TanqueOpt[]>
  >({});
  const [tab, setTab] = useState<TabId>("geral");
  const [formError, setFormError] = useState("");
  const [manifestoId, setManifestoId] = useState<string | null>(null);

  const filialById = useMemo(() => {
    const map = new Map<string, FilialOpt>();
    for (const f of filiais) map.set(f.id, f);
    return map;
  }, [filiais]);

  const fornecedorById = useMemo(() => {
    const map = new Map<string, FornecedorOpt>();
    for (const f of fornecedores) map.set(f.id, f);
    return map;
  }, [fornecedores]);

  const loadLookups = useCallback(async () => {
    const [filRes, fornRes, prodRes] = await Promise.all([
      supabase
        .from("filial")
        .select("id, codigo, fantasia, razao_social")
        .eq("status", "ativo")
        .order("codigo"),
      supabase
        .from("fornecedores")
        .select("id, codigo, razao_social, fantasia, cnpj")
        .eq("status", "ativo")
        .order("razao_social"),
      supabase
        .from("produtos")
        .select(
          "id, codigo, descricao, codigo_barras, anp_id, produto_anp ( combustivel )",
        )
        .eq("status", "ativo")
        .order("descricao")
        .limit(500),
    ]);

    setFiliais(
      (filRes.data ?? []).map((f) => ({
        id: String(f.id),
        codigo: String(f.codigo),
        fantasia: f.fantasia != null ? String(f.fantasia) : null,
        razao_social: String(f.razao_social ?? ""),
      })),
    );
    setFornecedores(
      (fornRes.data ?? []).map((f) => ({
        id: String(f.id),
        codigo: String(f.codigo),
        razao_social: String(f.razao_social ?? ""),
        fantasia: f.fantasia != null ? String(f.fantasia) : null,
        cnpj: f.cnpj != null ? String(f.cnpj) : null,
      })),
    );
    setProdutos(
      (prodRes.data ?? []).map((p) => {
        const rawAnp = (p as { produto_anp?: unknown }).produto_anp;
        const anp = Array.isArray(rawAnp) ? rawAnp[0] : rawAnp;
        const combustivel =
          String(
            (anp as { combustivel?: string } | null | undefined)?.combustivel ||
              "",
          ).toUpperCase() === "S";
        return {
          id: String(p.id),
          codigo: String(p.codigo ?? ""),
          descricao: String(p.descricao ?? ""),
          codigo_barras:
            p.codigo_barras != null ? String(p.codigo_barras) : null,
          combustivel,
        };
      }),
    );
  }, []);

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const { data, error } = await supabase
        .from("nota_entrada")
        .select(
          `
          id, filial, fornecedor, chave, numero, serie, modelo,
          natureza_operacao, data_emissao, data_entrada,
          v_prod, v_nf, situacao, observacao
        `,
        )
        .order("data_emissao", { ascending: false })
        .order("numero", { ascending: false });

      if (error) {
        setLoadError(error.message);
        setItems([]);
        return;
      }

      setItems(
        (data ?? []).map((row) =>
          mapNotaRow({
            ...row,
            v_bc: 0,
            v_icms: 0,
            v_st: 0,
            v_ipi: 0,
            v_pis: 0,
            v_cofins: 0,
            v_frete: 0,
            v_desc: 0,
          }),
        ),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadLookups();
    void loadData();
  }, [loadLookups, loadData]);

  useEffect(() => {
    if (!fornecedorNovo || !fornecedorNomeParam) return;
    const label = fornecedorCodigoParam
      ? `${fornecedorCodigoParam} — ${fornecedorNomeParam}`
      : fornecedorNomeParam;
    setInfoMsg(`Fornecedor cadastrado automaticamente: ${label}`);
    const qs = new URLSearchParams();
    if (manifestoParam) qs.set("manifesto", manifestoParam);
    const suffix = qs.toString();
    router.replace(
      suffix ? `/estoque/nota-entrada?${suffix}` : "/estoque/nota-entrada",
    );
  }, [
    fornecedorNovo,
    fornecedorNomeParam,
    fornecedorCodigoParam,
    manifestoParam,
    router,
  ]);

  useEffect(() => {
    if (!modalOpen) return;

    let cancelled = false;

    void (async () => {
      // Itens com produto vinculado — tanque filtrado por produto + filial
      const candidatos = formItems.filter(
        (row) => row.produto_id && (row.x_prod.trim() || row.produto_id),
      );

      const produtoIds = [...new Set(candidatos.map((r) => r.produto_id))];
      const optionsMap: Record<string, TanqueOpt[]> = {};

      if (produtoIds.length && form.filial) {
        const { data, error } = await supabase
          .from("tanques")
          .select("id, numero, descricao, produto_id, filial, status")
          .in("produto_id", produtoIds)
          .eq("filial", form.filial)
          .eq("status", "operante")
          .order("numero");

        if (cancelled) return;

        if (!error && data) {
          for (const t of data) {
            const pid = String(t.produto_id);
            if (!optionsMap[pid]) optionsMap[pid] = [];
            optionsMap[pid].push({
              id: String(t.id),
              numero: String(t.numero ?? ""),
              descricao: String(t.descricao ?? ""),
              produto_id: pid,
              filial: t.filial != null ? String(t.filial) : null,
            });
          }
        }
      } else if (produtoIds.length && !form.filial) {
        // Sem filial: lista tanques do produto (operante) para não ficar vazio
        const { data, error } = await supabase
          .from("tanques")
          .select("id, numero, descricao, produto_id, filial, status")
          .in("produto_id", produtoIds)
          .eq("status", "operante")
          .order("numero");

        if (cancelled) return;

        if (!error && data) {
          for (const t of data) {
            const pid = String(t.produto_id);
            if (!optionsMap[pid]) optionsMap[pid] = [];
            optionsMap[pid].push({
              id: String(t.id),
              numero: String(t.numero ?? ""),
              descricao: String(t.descricao ?? ""),
              produto_id: pid,
              filial: t.filial != null ? String(t.filial) : null,
            });
          }
        }
      }

      if (cancelled) return;
      setTanquesByProduto(optionsMap);

      // Mostra itens que têm tanque cadastrado OU são combustível (para o usuário escolher)
      const rowsVisiveis = candidatos.filter((row) => {
        const opts = optionsMap[row.produto_id] ?? [];
        return opts.length > 0 || itemIsCombustivel(row, produtos);
      });

      setFormTanques((prev) => {
        const prevByKey = new Map(prev.map((t) => [t.itemKey, t]));
        return rowsVisiveis.map((row) => {
          const prod = produtos.find((p) => p.id === row.produto_id);
          const label = prod
            ? `${prod.codigo} — ${prod.descricao}`
            : row.x_prod || "Produto";
          const opts = optionsMap[row.produto_id] ?? [];
          const prevRow = prevByKey.get(row.key);
          let tanqueId = prevRow?.tanqueId || "";
          if (tanqueId && !opts.some((o) => o.id === tanqueId)) tanqueId = "";
          if (!tanqueId && opts.length === 1) tanqueId = opts[0].id;
          return {
            itemKey: row.key,
            produtoId: row.produto_id,
            label,
            qtd: row.q_com,
            tanqueId,
          };
        });
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [modalOpen, formItems, form.filial, produtos]);

  useEffect(() => {
    if (!manifestoParam || !fornecedores.length) return;
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("nota_entradamanifesto")
        .select(
          "id, filial, fornecedor, fornecedor_cnpj, chave, numero, valor, emissao, nota_compra, xml_conteudo",
        )
        .eq("id", manifestoParam)
        .maybeSingle();

      if (cancelled || error || !data) return;

      if (data.nota_compra) {
        const { data: nota } = await supabase
          .from("nota_entrada")
          .select(
            `
            id, filial, fornecedor, chave, numero, serie, modelo,
            natureza_operacao, data_emissao, data_entrada,
            v_prod, v_nf, v_bc, v_icms, v_st, v_ipi, v_pis, v_cofins,
            v_frete, v_desc, situacao, observacao
          `,
          )
          .eq("id", data.nota_compra)
          .maybeSingle();
        if (cancelled || !nota) return;
        await openEdit(mapNotaRow(nota as Record<string, unknown>));
        setManifestoId(String(data.id));
        return;
      }

      const cnpj = String(data.fornecedor_cnpj || "").replace(/\D/g, "");
      const fornId =
        (data.fornecedor != null ? String(data.fornecedor) : "") ||
        fornecedores.find(
          (f) => (f.cnpj || "").replace(/\D/g, "") === cnpj,
        )?.id ||
        "";

      // XML importado: exige vínculo de produtos pendentes antes de digitar
      if (data.xml_conteudo) {
        try {
          const parsed = parseNfeXml(String(data.xml_conteudo));
          const { mapeados, pendentes } = await classificarItensXml(
            parsed,
            fornId || null,
          );
          if (cancelled) return;

          if (pendentes.length > 0) {
            router.replace(
              `/estoque/nota-entrada/vincular-produtos?manifesto=${data.id}`,
            );
            return;
          }

          const totais = parsed.totais;
          setManifestoId(String(data.id));
          setEditing(null);
          setTab("geral");
          setForm({
            ...emptyForm,
            filial: data.filial != null ? String(data.filial) : "",
            fornecedor: fornId,
            numero: data.numero != null ? String(data.numero) : "",
            serie: parsed.serie || "1",
            modelo: parsed.modelo || "55",
            chave: data.chave != null ? String(data.chave) : "",
            natureza_operacao: parsed.natureza || "",
            data_emissao: toDateInput(
              data.emissao != null ? String(data.emissao) : null,
            ),
            data_entrada: toDateInput(
              data.emissao != null ? String(data.emissao) : null,
            ),
            v_nf: formatMoney2(
              Number(data.valor) || totais?.v_nf || parsed.valor || 0,
            ),
            v_bc: formatMoney2(totais?.v_bc || 0),
            v_icms: formatMoney2(totais?.v_icms || 0),
            v_st: formatMoney2(totais?.v_st || 0),
            v_ipi: formatMoney2(totais?.v_ipi || 0),
            v_pis: formatMoney2(totais?.v_pis || 0),
            v_cofins: formatMoney2(totais?.v_cofins || 0),
            v_frete: formatMoney2(totais?.v_frete || 0),
            v_desc: formatMoney2(totais?.v_desc || 0),
            situacao: "pendente",
          });

          const prodById = new Map(produtos.map((p) => [p.id, p]));
          setFormItems(
            (mapeados.length ? mapeados : parsed.itens).map((item) => {
              const prodId =
                "produto_sistema" in item && item.produto_sistema
                  ? String(item.produto_sistema)
                  : "";
              const prod = prodId ? prodById.get(prodId) : null;
              const vol =
                "volume" in item ? Number((item as { volume?: number }).volume) || 0 : 0;
              const vol2 =
                "volume2" in item
                  ? Number((item as { volume2?: number }).volume2) || 0
                  : 0;
              const fator = fatorVolumeVinculo(vol, vol2);
              const qXml = Number(item.q_com) || 0;
              const qConv = Number((qXml * fator).toFixed(4));
              const vProd = Number(item.v_prod) || 0;
              const vUn =
                qConv > 0
                  ? Number((vProd / qConv).toFixed(6))
                  : Number(item.v_un_com) || 0;
              return {
                key: `xml-${item.n_item}-${item.c_prod}`,
                produto_id: prodId,
                c_prod: item.c_prod || "",
                c_ean: item.c_ean || "",
                x_prod: prod?.descricao || item.x_prod || "",
                ncm: item.ncm || "",
                cfop: item.cfop || "",
                u_com: item.u_com || "UN",
                q_com: formatQty(qConv),
                v_un_com: formatMoney2(vUn),
                v_prod: formatMoney2(vProd),
                c_prod_anp: item.c_prod_anp || "",
                cst_icms: item.cst_icms || "",
                v_bc_icms: formatMoney2(item.v_bc_icms || 0),
                p_icms: formatPct(item.p_icms || 0),
                v_icms: formatMoney2(item.v_icms || 0),
                cst_pis: item.cst_pis || "",
                v_pis: formatMoney2(item.v_pis || 0),
                cst_cofins: item.cst_cofins || "",
                v_cofins: formatMoney2(item.v_cofins || 0),
                v_ipi: formatMoney2(item.v_ipi || 0),
              };
            }),
          );
          setFormTitulos([
            {
              ...emptyTitulo(),
              titulo: data.numero != null ? String(data.numero) : "1",
              data_vencimento: toDateInput(
                data.emissao != null ? String(data.emissao) : null,
              ),
              valor: formatMoney2(
                Number(data.valor) || totais?.v_nf || parsed.valor || 0,
              ),
            },
          ]);
          setFormTanques([]);
          setFormError("");
          setModalOpen(true);
          return;
        } catch {
          // segue fluxo manual sem itens
        }
      }

      setManifestoId(String(data.id));
      setEditing(null);
      setTab("geral");
      setForm({
        ...emptyForm,
        filial: data.filial != null ? String(data.filial) : "",
        fornecedor: fornId,
        numero: data.numero != null ? String(data.numero) : "",
        chave: data.chave != null ? String(data.chave) : "",
        data_emissao: toDateInput(
          data.emissao != null ? String(data.emissao) : null,
        ),
        data_entrada: toDateInput(
          data.emissao != null ? String(data.emissao) : null,
        ),
        v_nf: formatMoney2(Number(data.valor) || 0),
        situacao: "pendente",
      });
      setFormItems([emptyItem()]);
      setFormTitulos([emptyTitulo()]);
      setFormTanques([]);
      setFormError("");
      setModalOpen(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestoParam, fornecedores, produtos]);

  const updateForm = <K extends keyof NotaForm>(key: K, value: NotaForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateItem = (key: string, patch: Partial<ItemForm>) => {
    setFormItems((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.q_com != null || patch.v_un_com != null) {
          const q = parseMoney(patch.q_com ?? next.q_com);
          const vu = parseMoney(patch.v_un_com ?? next.v_un_com);
          next.v_prod = formatMoney2(round2(q * vu));
        }
        return next;
      }),
    );
  };

  const onSelectProduto = (key: string, produtoId: string) => {
    const p = produtos.find((x) => x.id === produtoId);
    updateItem(key, {
      produto_id: produtoId,
      x_prod: p?.descricao || "",
      c_prod: p?.codigo || "",
      c_ean: p?.codigo_barras || "",
    });
  };

  const openCreate = () => {
    router.push("/estoque/nota-entrada/nova");
  };

  const openCreateManual = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEditing(null);
    setManifestoId(null);
    setTab("geral");
    setForm({
      ...emptyForm,
      filial: filiais.length === 1 ? filiais[0].id : "",
      data_emissao: today,
      data_entrada: today,
    });
    setFormItems([emptyItem()]);
    setFormTitulos([emptyTitulo()]);
    setFormTanques([]);
    setTanquesByProduto({});
    setFormError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (manualParam !== "1") return;
    openCreateManual();
    router.replace("/estoque/nota-entrada");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualParam]);

  const openEdit = async (item: NotaEntrada) => {
    setEditing(item);
    setTab("geral");
    setFormError("");
    setActionError("");
    setModalOpen(true);

    const { data: full, error: fullErr } = await supabase
      .from("nota_entrada")
      .select(
        `
        id, filial, fornecedor, chave, numero, serie, modelo,
        natureza_operacao, data_emissao, data_entrada,
        v_prod, v_nf, v_bc, v_icms, v_st, v_ipi, v_pis, v_cofins,
        v_frete, v_desc, situacao, observacao
      `,
      )
      .eq("id", item.id)
      .maybeSingle();

    if (fullErr) {
      setFormError(fullErr.message);
      return;
    }

    const nota = full ? mapNotaRow(full as Record<string, unknown>) : item;
    setEditing(nota);
    setForm({
      filial: nota.filial ?? "",
      fornecedor: nota.fornecedor ?? "",
      numero: String(nota.numero || ""),
      serie: nota.serie || "1",
      modelo: nota.modelo || "55",
      chave: nota.chave ?? "",
      natureza_operacao: nota.natureza_operacao ?? "",
      data_emissao: toDateInput(nota.data_emissao),
      data_entrada: toDateInput(nota.data_entrada),
      v_nf: formatMoney2(nota.v_nf ?? 0),
      v_bc: formatMoney2(nota.v_bc ?? 0),
      v_icms: formatMoney2(nota.v_icms ?? 0),
      v_st: formatMoney2(nota.v_st ?? 0),
      v_ipi: formatMoney2(nota.v_ipi ?? 0),
      v_pis: formatMoney2(nota.v_pis ?? 0),
      v_cofins: formatMoney2(nota.v_cofins ?? 0),
      v_frete: formatMoney2(nota.v_frete ?? 0),
      v_desc: formatMoney2(nota.v_desc ?? 0),
      situacao: nota.situacao || "pendente",
      observacao: nota.observacao ?? "",
    });

    const [{ data, error }, { data: titulosData }] = await Promise.all([
      supabase
        .from("nota_entradaprodutos")
        .select(
          `
          id, nota_entrada, produto, n_item, c_prod, c_ean, x_prod, ncm, cfop,
          u_com, q_com, v_un_com, v_prod, c_prod_anp,
          cst_icms, v_bc_icms, p_icms, v_icms,
          cst_pis, v_pis, cst_cofins, v_cofins, v_ipi
        `,
        )
        .eq("nota_entrada", item.id)
        .order("n_item", { ascending: true }),
      supabase
        .from("contas_pagar")
        .select("id, titulo, data_vencimento, valor")
        .eq("nota_entrada", item.id)
        .order("data_vencimento", { ascending: true }),
    ]);

    if (error) {
      setFormError(error.message);
      setFormItems([emptyItem()]);
      return;
    }

    const rows = (data ?? []) as NotaItem[];
    if (!rows.length) {
      setFormItems([emptyItem()]);
    } else {
      setFormItems(
        rows.map((r) => ({
          key: String(r.id),
          produto_id: r.produto ? String(r.produto) : "",
          c_prod: r.c_prod ?? "",
          c_ean: r.c_ean ?? "",
          x_prod: r.x_prod ?? "",
          ncm: r.ncm ?? "",
          cfop: r.cfop ?? "",
          u_com: r.u_com ?? "UN",
          q_com: formatQty(r.q_com ?? 0),
          v_un_com: formatMoney2(r.v_un_com ?? 0),
          v_prod: formatMoney2(r.v_prod ?? 0),
          c_prod_anp: r.c_prod_anp ?? "",
          cst_icms: r.cst_icms ?? "",
          v_bc_icms: formatMoney2(r.v_bc_icms ?? 0),
          p_icms: formatPct(r.p_icms ?? 0),
          v_icms: formatMoney2(r.v_icms ?? 0),
          cst_pis: r.cst_pis ?? "",
          v_pis: formatMoney2(r.v_pis ?? 0),
          cst_cofins: r.cst_cofins ?? "",
          v_cofins: formatMoney2(r.v_cofins ?? 0),
          v_ipi: formatMoney2(r.v_ipi ?? 0),
        })),
      );
    }

    const titulos = titulosData ?? [];
    if (!titulos.length) {
      setFormTitulos([emptyTitulo()]);
    } else {
      setFormTitulos(
        titulos.map((t) => ({
          key: String(t.id),
          titulo: String(t.titulo ?? ""),
          data_vencimento: toDateInput(
            t.data_vencimento != null ? String(t.data_vencimento) : null,
          ),
          valor: formatMoney2(Number(t.valor) || 0),
        })),
      );
    }
  };

  const openDelete = (item: NotaEntrada) => {
    setDeleting(item);
    setActionError("");
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleting(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionError("");
    try {
      await gravar(async () => {
        const { error } = await supabase
          .from("nota_entrada")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });
      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir a nota.",
      );
    }
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditing(null);
    setTab("geral");
    setFormError("");
    setFormTitulos([emptyTitulo()]);
    setFormTanques([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const numero = Number(String(form.numero).trim());
    if (!Number.isFinite(numero) || numero <= 0) {
      setFormError("Informe o número da nota.");
      setTab("geral");
      return;
    }
    if (!form.filial) {
      setFormError("Selecione a filial.");
      setTab("geral");
      return;
    }
    if (!form.fornecedor) {
      setFormError("Selecione o fornecedor.");
      setTab("geral");
      return;
    }

    const linhas = formItems
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => row.x_prod.trim() || row.produto_id);

    for (const { row, idx } of linhas) {
      if (!row.x_prod.trim()) {
        setFormError(`Informe a descrição do item ${idx + 1}.`);
        setTab("geral");
        return;
      }
      if (parseMoney(row.q_com) <= 0) {
        setFormError(`Quantidade inválida no item ${idx + 1}.`);
        setTab("geral");
        return;
      }
    }

    const totalItens = round2(
      linhas.reduce((acc, { row }) => acc + parseMoney(row.v_prod), 0),
    );
    const vNf = form.v_nf.trim() ? parseMoney(form.v_nf) : totalItens;

    const chave = form.chave.replace(/\D/g, "").trim() || null;
    if (chave && chave.length !== 44) {
      setFormError("A chave da NF-e deve ter 44 dígitos (ou ficar em branco).");
      setTab("geral");
      return;
    }

    const situacaoNova = form.situacao || "pendente";
    const situacaoAnterior = editing?.situacao || "";
    const virandoLancada =
      situacaoNova === "lancada" && situacaoAnterior !== "lancada";

    // Sincroniza qtd dos tanques com os itens no momento do save
    const tankLinesSync = formTanques
      .map((t) => {
        const item = formItems.find((i) => i.key === t.itemKey);
        const qtd = item ? item.q_com : t.qtd;
        return {
          tanqueId: t.tanqueId,
          produtoId: t.produtoId || null,
          litros: parseMoney(qtd),
          label: t.label,
        };
      })
      .filter((t) => t.tanqueId && t.litros > 0);

    if (situacaoNova === "lancada") {
      const pendentesTanque = formTanques.filter(
        (t) => !t.tanqueId && parseMoney(t.qtd) > 0,
      );
      if (pendentesTanque.length) {
        setFormError(
          "Na aba Tanque, selecione o tanque de cada produto antes de lançar a nota.",
        );
        setTab("tanque");
        return;
      }
      if (!form.data_entrada) {
        setFormError("Informe a data de entrada para gerar a medição de tanques.");
        setTab("geral");
        return;
      }
      if (!form.filial) {
        setFormError("Selecione a filial para gerar a medição de tanques.");
        setTab("geral");
        return;
      }
    }

    setFormError("");

    const header = {
      filial: form.filial || null,
      fornecedor: form.fornecedor || null,
      chave,
      numero,
      serie: form.serie.trim() || "1",
      modelo: form.modelo.trim() || "55",
      natureza_operacao: form.natureza_operacao.trim() || null,
      data_emissao: form.data_emissao
        ? `${form.data_emissao}T12:00:00`
        : null,
      data_entrada: form.data_entrada || null,
      data_saida_entrada: form.data_entrada
        ? `${form.data_entrada}T12:00:00`
        : null,
      v_prod: totalItens,
      v_nf: vNf,
      v_bc: parseMoney(form.v_bc),
      v_icms: parseMoney(form.v_icms),
      v_st: parseMoney(form.v_st),
      v_ipi: parseMoney(form.v_ipi),
      v_pis: parseMoney(form.v_pis),
      v_cofins: parseMoney(form.v_cofins),
      v_frete: parseMoney(form.v_frete),
      v_desc: parseMoney(form.v_desc),
      situacao: situacaoNova,
      observacao: form.observacao.trim() || null,
    };

    try {
      await gravar(async () => {
        let notaId = editing?.id ?? "";

        if (editing) {
          const { error } = await supabase
            .from("nota_entrada")
            .update(header)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);

          const { error: delErr } = await supabase
            .from("nota_entradaprodutos")
            .delete()
            .eq("nota_entrada", editing.id);
          if (delErr) throw new Error(delErr.message);
        } else {
          const { data, error } = await supabase
            .from("nota_entrada")
            .insert(header)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          notaId = String(data.id);
        }

        if (linhas.length) {
          const payload = linhas.map(({ row }, i) => ({
            nota_entrada: notaId,
            n_item: i + 1,
            produto: row.produto_id || null,
            c_prod: row.c_prod.trim() || null,
            c_ean: row.c_ean.replace(/\D/g, "").trim() || null,
            x_prod: row.x_prod.trim(),
            ncm: row.ncm.replace(/\D/g, "").trim() || null,
            cfop: row.cfop.replace(/\D/g, "").trim() || null,
            u_com: row.u_com.trim() || "UN",
            q_com: parseMoney(row.q_com),
            v_un_com: parseMoney(row.v_un_com),
            v_prod: parseMoney(row.v_prod),
            u_trib: row.u_com.trim() || "UN",
            q_trib: parseMoney(row.q_com),
            v_un_trib: parseMoney(row.v_un_com),
            c_prod_anp: row.c_prod_anp.trim() || null,
            cst_icms: row.cst_icms.trim() || null,
            v_bc_icms: parseMoney(row.v_bc_icms),
            p_icms: parseMoney(row.p_icms),
            v_icms: parseMoney(row.v_icms),
            cst_pis: row.cst_pis.trim() || null,
            v_pis: parseMoney(row.v_pis),
            cst_cofins: row.cst_cofins.trim() || null,
            v_cofins: parseMoney(row.v_cofins),
            v_ipi: parseMoney(row.v_ipi),
          }));

          const { error: itErr } = await supabase
            .from("nota_entradaprodutos")
            .insert(payload);
          if (itErr) throw new Error(itErr.message);
        }

        if (situacaoNova === "lancada" && form.filial && form.data_entrada) {
          await aplicarEntradasMarcacaoTanque({
            filialId: form.filial,
            data: form.data_entrada,
            lines: tankLinesSync.map((t) => ({
              tanqueId: t.tanqueId,
              produtoId: t.produtoId,
              litros: t.litros,
            })),
            modo: virandoLancada ? "somar" : "reparar",
          });
        }

        // Títulos em contas_pagar só ao lançar a nota (evita lixo em rascunho)
        if (situacaoNova === "lancada") {
          const { error: delTitErr } = await supabase
            .from("contas_pagar")
            .delete()
            .eq("nota_entrada", notaId);
          if (delTitErr) throw new Error(delTitErr.message);

          let titulosToSave = formTitulos.filter(
            (t) =>
              t.titulo.trim() ||
              parseMoney(t.valor) > 0 ||
              t.data_vencimento,
          );

          if (
            !titulosToSave.some((t) => parseMoney(t.valor) > 0) &&
            vNf > 0
          ) {
            titulosToSave = [
              {
                key: "default",
                titulo: String(numero),
                data_vencimento: form.data_entrada || form.data_emissao || "",
                valor: formatMoney2(vNf),
              },
            ];
          }

          const reservados = new Set<string>();
          const titulosPayload = [];
          for (const t of titulosToSave) {
            const valor = parseMoney(t.valor);
            if (!(valor > 0)) continue;

            const prefer =
              t.titulo.trim() ||
              (form.serie && form.serie !== "1"
                ? `${numero}/${form.serie}`
                : String(numero));

            const titulo = await nextContasPagarTitulo(
              form.filial,
              form.fornecedor,
              prefer.slice(0, 15),
              reservados,
            );

            titulosPayload.push({
              fornecedor: form.fornecedor,
              titulo,
              nota_entrada: notaId,
              filial: form.filial,
              tipo: "nota" as const,
              data_emissao: form.data_emissao || null,
              data_chegada: form.data_entrada || null,
              data_vencimento: t.data_vencimento || form.data_entrada || null,
              valor,
              valor_saldo: valor,
              valor_outros: 0,
              situacao: 0,
              finalidade: `NF ${numero}/${form.serie || "1"}`.slice(0, 50),
            });
          }

          if (titulosPayload.length) {
            const { error: titErr } = await supabase
              .from("contas_pagar")
              .insert(titulosPayload);
            if (titErr) throw new Error(titErr.message);
          }
        }

        if (manifestoId) {
          const { error: manErr } = await supabase
            .from("nota_entradamanifesto")
            .update({
              digitada: 1,
              nota_compra: notaId,
              fornecedor: form.fornecedor || null,
            })
            .eq("id", manifestoId);
          if (manErr) throw new Error(manErr.message);
        }
      });

      setModalOpen(false);
      setEditing(null);
      setManifestoId(null);
      setTab("geral");
      setForm(emptyForm);
      setFormItems([emptyItem()]);
      setFormTitulos([emptyTitulo()]);
      setFormTanques([]);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    }
  };

  const rows = items.map((item) => {
    const fil = item.filial ? filialById.get(item.filial) : null;
    const forn = item.fornecedor ? fornecedorById.get(item.fornecedor) : null;
    const fornLabel = forn != null ? fornecedorLabel(forn) : "—";

    return {
      numero: String(item.numero),
      serie: item.serie,
      fornecedor: fornLabel,
      filial: fil ? filialLabel(fil) : "—",
      emissao: formatDateBr(item.data_emissao),
      entrada: formatDateBr(item.data_entrada),
      valor: formatMoney2(item.v_nf),
      status: situacaoBadge(item.situacao),
      acoes: (
        <CadastroRowActions
          disabled={busy}
          onEdit={() => void openEdit(item)}
          onDelete={() => openDelete(item)}
        />
      ),
    };
  });

  const totalItensPreview = round2(
    formItems.reduce((acc, row) => acc + parseMoney(row.v_prod), 0),
  );

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar notas de entrada: ${loadError}`}
          onClose={() => setLoadError("")}
        />
      ) : null}

      {infoMsg ? (
        <CadastroFormError
          type="warning"
          title="Fornecedor cadastrado"
          message={infoMsg}
          onClose={() => setInfoMsg("")}
        />
      ) : null}

      {actionError && !deleting ? (
        <CadastroFormError
          message={actionError}
          onClose={() => setActionError("")}
        />
      ) : null}

      <ModulePage
        title="Nota de Entrada"
        description="Notas de entrada digitadas / lançadas"
        icon={<FileInput size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Nova Nota"
        backUrl="/estoque"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Nota de Entrada" : "Nova Nota de Entrada"}
          titleId="nota-entrada-title"
          subtitle={
            editing ? (
              <>
                NF {editing.numero}/{editing.serie}
              </>
            ) : (
              "Preencha os dados da nota e dos itens"
            )
          }
          onClose={closeModal}
          disabled={busy}
          width={1000}
          asForm
          onSubmit={handleSubmit}
          footer={
            <CadastroFormActions
              onCancel={closeModal}
              disabled={busy}
              busy={busy}
            />
          }
        >
          <div className="cadastro-tabs" role="tablist">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`cadastro-tab${tab === item.id ? " active" : ""}`}
                onClick={() => setTab(item.id)}
                disabled={busy}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "geral" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="Filial *" htmlFor="ne-filial">
                  <select
                    id="ne-filial"
                    className="input-base input-compact"
                    value={form.filial}
                    onChange={(e) => updateForm("filial", e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Selecione…</option>
                    {filiais.map((f) => (
                      <option key={f.id} value={f.id}>
                        {filialLabel(f)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField
                  label="Fornecedor *"
                  htmlFor="ne-fornecedor"
                  span={2}
                >
                  <select
                    id="ne-fornecedor"
                    className="input-base input-compact"
                    value={form.fornecedor}
                    onChange={(e) => updateForm("fornecedor", e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Selecione…</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {fornecedorLabel(f)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <CadastroField label="Número *" htmlFor="ne-numero">
                  <input
                    id="ne-numero"
                    className="input-base input-compact"
                    inputMode="numeric"
                    value={form.numero}
                    onChange={(e) => updateForm("numero", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Série" htmlFor="ne-serie">
                  <input
                    id="ne-serie"
                    className="input-base input-compact"
                    value={form.serie}
                    onChange={(e) => updateForm("serie", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Modelo" htmlFor="ne-modelo">
                  <input
                    id="ne-modelo"
                    className="input-base input-compact"
                    value={form.modelo}
                    onChange={(e) => updateForm("modelo", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Situação" htmlFor="ne-situacao">
                  <select
                    id="ne-situacao"
                    className="input-base input-compact"
                    value={form.situacao}
                    onChange={(e) => updateForm("situacao", e.target.value)}
                    disabled={busy}
                  >
                    <option value="pendente">Pendente</option>
                    <option value="lancada">Lançada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </CadastroField>

                <CadastroField label="Emissão" htmlFor="ne-emissao">
                  <input
                    id="ne-emissao"
                    type="date"
                    className="input-base input-compact"
                    value={form.data_emissao}
                    onChange={(e) => updateForm("data_emissao", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Entrada" htmlFor="ne-entrada">
                  <input
                    id="ne-entrada"
                    type="date"
                    className="input-base input-compact"
                    value={form.data_entrada}
                    onChange={(e) => updateForm("data_entrada", e.target.value)}
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Valor NF" htmlFor="ne-vnf">
                  <input
                    id="ne-vnf"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_nf}
                    onChange={(e) =>
                      updateForm("v_nf", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                    placeholder={formatMoney2(totalItensPreview)}
                  />
                </CadastroField>

                <CadastroField label="BC ICMS" htmlFor="ne-vbc">
                  <input
                    id="ne-vbc"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_bc}
                    onChange={(e) =>
                      updateForm("v_bc", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="ICMS" htmlFor="ne-vicms">
                  <input
                    id="ne-vicms"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_icms}
                    onChange={(e) =>
                      updateForm("v_icms", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="ST" htmlFor="ne-vst">
                  <input
                    id="ne-vst"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_st}
                    onChange={(e) =>
                      updateForm("v_st", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="IPI" htmlFor="ne-vipi">
                  <input
                    id="ne-vipi"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_ipi}
                    onChange={(e) =>
                      updateForm("v_ipi", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="PIS" htmlFor="ne-vpis">
                  <input
                    id="ne-vpis"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_pis}
                    onChange={(e) =>
                      updateForm("v_pis", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="COFINS" htmlFor="ne-vcofins">
                  <input
                    id="ne-vcofins"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_cofins}
                    onChange={(e) =>
                      updateForm("v_cofins", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Frete" htmlFor="ne-vfrete">
                  <input
                    id="ne-vfrete"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_frete}
                    onChange={(e) =>
                      updateForm("v_frete", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField label="Desconto" htmlFor="ne-vdesc">
                  <input
                    id="ne-vdesc"
                    className="input-base input-compact"
                    inputMode="decimal"
                    value={form.v_desc}
                    onChange={(e) =>
                      updateForm("v_desc", maskMoneyInput(e.target.value))
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField
                  label="Natureza da operação"
                  htmlFor="ne-nat"
                  span={2}
                >
                  <input
                    id="ne-nat"
                    className="input-base input-compact"
                    value={form.natureza_operacao}
                    onChange={(e) =>
                      updateForm("natureza_operacao", e.target.value)
                    }
                    disabled={busy}
                  />
                </CadastroField>

                <CadastroField
                  label="Chave NF-e (44 dígitos)"
                  htmlFor="ne-chave"
                  span="full"
                >
                  <input
                    id="ne-chave"
                    className="input-base input-compact"
                    inputMode="numeric"
                    maxLength={44}
                    value={form.chave}
                    onChange={(e) =>
                      updateForm("chave", e.target.value.replace(/\D/g, ""))
                    }
                    disabled={busy}
                    placeholder="Opcional no cadastro manual"
                  />
                </CadastroField>

                <CadastroField label="Observação" htmlFor="ne-obs" span="full">
                  <textarea
                    id="ne-obs"
                    className="input-base input-compact"
                    rows={2}
                    value={form.observacao}
                    onChange={(e) => updateForm("observacao", e.target.value)}
                    disabled={busy}
                    style={{ resize: "vertical" }}
                  />
                </CadastroField>
              </CadastroFormGrid>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginTop: 4,
                }}
              >
                <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  Itens da nota
                </strong>
                <button
                  type="button"
                  className="cadastro-btn-edit"
                  disabled={busy}
                  onClick={() => setFormItems((prev) => [...prev, emptyItem()])}
                >
                  <Plus size={12} />
                  Item
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {formItems.map((row, idx) => (
                  <div
                    key={row.key}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: 10,
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>Item {idx + 1}</span>
                      <button
                        type="button"
                        className="cadastro-btn-delete"
                        disabled={busy || formItems.length <= 1}
                        onClick={() =>
                          setFormItems((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((x) => x.key !== row.key),
                          )
                        }
                        title="Remover item"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <CadastroFormGrid>
                      <CadastroField
                        label="Produto (cadastro)"
                        htmlFor={`ne-prod-${row.key}`}
                        span={2}
                      >
                        <select
                          id={`ne-prod-${row.key}`}
                          className="input-base input-compact"
                          value={row.produto_id}
                          onChange={(e) =>
                            onSelectProduto(row.key, e.target.value)
                          }
                          disabled={busy}
                        >
                          <option value="">Sem vínculo…</option>
                          {produtos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.codigo} — {p.descricao}
                            </option>
                          ))}
                        </select>
                      </CadastroField>

                      <CadastroField
                        label="Descrição *"
                        htmlFor={`ne-xprod-${row.key}`}
                        span={2}
                      >
                        <input
                          id={`ne-xprod-${row.key}`}
                          className="input-base input-compact"
                          value={row.x_prod}
                          onChange={(e) =>
                            updateItem(row.key, { x_prod: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="Cód. fornecedor"
                        htmlFor={`ne-cprod-${row.key}`}
                      >
                        <input
                          id={`ne-cprod-${row.key}`}
                          className="input-base input-compact"
                          value={row.c_prod}
                          onChange={(e) =>
                            updateItem(row.key, { c_prod: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField label="EAN" htmlFor={`ne-cean-${row.key}`}>
                        <input
                          id={`ne-cean-${row.key}`}
                          className="input-base input-compact"
                          value={row.c_ean}
                          onChange={(e) =>
                            updateItem(row.key, { c_ean: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField label="NCM" htmlFor={`ne-ncm-${row.key}`}>
                        <input
                          id={`ne-ncm-${row.key}`}
                          className="input-base input-compact"
                          value={row.ncm}
                          onChange={(e) =>
                            updateItem(row.key, { ncm: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="CFOP"
                        htmlFor={`ne-cfop-${row.key}`}
                      >
                        <input
                          id={`ne-cfop-${row.key}`}
                          className="input-base input-compact"
                          value={row.cfop}
                          onChange={(e) =>
                            updateItem(row.key, { cfop: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField label="Un." htmlFor={`ne-un-${row.key}`}>
                        <input
                          id={`ne-un-${row.key}`}
                          className="input-base input-compact"
                          value={row.u_com}
                          onChange={(e) =>
                            updateItem(row.key, { u_com: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField label="Qtd *" htmlFor={`ne-q-${row.key}`}>
                        <input
                          id={`ne-q-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.q_com}
                          onChange={(e) =>
                            updateItem(row.key, {
                              q_com: maskQtyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="Vl. unit. *"
                        htmlFor={`ne-vu-${row.key}`}
                      >
                        <input
                          id={`ne-vu-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_un_com}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_un_com: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="Total"
                        htmlFor={`ne-vt-${row.key}`}
                      >
                        <input
                          id={`ne-vt-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_prod}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_prod: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="CST ICMS"
                        htmlFor={`ne-csticms-${row.key}`}
                      >
                        <input
                          id={`ne-csticms-${row.key}`}
                          className="input-base input-compact"
                          value={row.cst_icms}
                          onChange={(e) =>
                            updateItem(row.key, { cst_icms: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="BC ICMS"
                        htmlFor={`ne-vbcicms-${row.key}`}
                      >
                        <input
                          id={`ne-vbcicms-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_bc_icms}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_bc_icms: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="% ICMS"
                        htmlFor={`ne-picms-${row.key}`}
                      >
                        <input
                          id={`ne-picms-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.p_icms}
                          onChange={(e) =>
                            updateItem(row.key, {
                              p_icms: maskMoneyInput(e.target.value, 4),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="ICMS"
                        htmlFor={`ne-vicmsitem-${row.key}`}
                      >
                        <input
                          id={`ne-vicmsitem-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_icms}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_icms: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="CST PIS"
                        htmlFor={`ne-cstpis-${row.key}`}
                      >
                        <input
                          id={`ne-cstpis-${row.key}`}
                          className="input-base input-compact"
                          value={row.cst_pis}
                          onChange={(e) =>
                            updateItem(row.key, { cst_pis: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="PIS"
                        htmlFor={`ne-vpisitem-${row.key}`}
                      >
                        <input
                          id={`ne-vpisitem-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_pis}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_pis: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="CST COFINS"
                        htmlFor={`ne-cstcofins-${row.key}`}
                      >
                        <input
                          id={`ne-cstcofins-${row.key}`}
                          className="input-base input-compact"
                          value={row.cst_cofins}
                          onChange={(e) =>
                            updateItem(row.key, { cst_cofins: e.target.value })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="COFINS"
                        htmlFor={`ne-vcofinsitem-${row.key}`}
                      >
                        <input
                          id={`ne-vcofinsitem-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_cofins}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_cofins: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>

                      <CadastroField
                        label="IPI"
                        htmlFor={`ne-vipiitem-${row.key}`}
                      >
                        <input
                          id={`ne-vipiitem-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.v_ipi}
                          onChange={(e) =>
                            updateItem(row.key, {
                              v_ipi: maskMoneyInput(e.target.value),
                            })
                          }
                          disabled={busy}
                        />
                      </CadastroField>
                    </CadastroFormGrid>
                  </div>
                ))}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "right",
                }}
              >
                Total dos itens:{" "}
                <strong>{formatMoney2(totalItensPreview)}</strong>
              </div>
            </div>
          ) : null}

          {tab === "titulos" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <strong style={{ fontSize: 13, color: "var(--text-primary)" }}>
                  Títulos a pagar
                </strong>
                <button
                  type="button"
                  className="cadastro-btn-edit"
                  disabled={busy}
                  onClick={() =>
                    setFormTitulos((prev) => [...prev, emptyTitulo()])
                  }
                >
                  <Plus size={12} />
                  Título
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {formTitulos.map((row, idx) => (
                  <div
                    key={row.key}
                    style={{
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: 10,
                      background: "var(--bg-elevated)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        fontSize: 12,
                        color: "var(--text-muted)",
                      }}
                    >
                      <span>Título {idx + 1}</span>
                      <button
                        type="button"
                        className="cadastro-btn-delete"
                        disabled={busy || formTitulos.length <= 1}
                        onClick={() =>
                          setFormTitulos((prev) =>
                            prev.length <= 1
                              ? prev
                              : prev.filter((x) => x.key !== row.key),
                          )
                        }
                        title="Remover título"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <CadastroFormGrid>
                      <CadastroField
                        label="Título"
                        htmlFor={`ne-tit-${row.key}`}
                      >
                        <input
                          id={`ne-tit-${row.key}`}
                          className="input-base input-compact"
                          maxLength={15}
                          value={row.titulo}
                          onChange={(e) =>
                            setFormTitulos((prev) =>
                              prev.map((t) =>
                                t.key === row.key
                                  ? { ...t, titulo: e.target.value }
                                  : t,
                              ),
                            )
                          }
                          disabled={busy}
                        />
                      </CadastroField>
                      <CadastroField
                        label="Vencimento"
                        htmlFor={`ne-venc-${row.key}`}
                      >
                        <input
                          id={`ne-venc-${row.key}`}
                          type="date"
                          className="input-base input-compact"
                          value={row.data_vencimento}
                          onChange={(e) =>
                            setFormTitulos((prev) =>
                              prev.map((t) =>
                                t.key === row.key
                                  ? { ...t, data_vencimento: e.target.value }
                                  : t,
                              ),
                            )
                          }
                          disabled={busy}
                        />
                      </CadastroField>
                      <CadastroField
                        label="Valor"
                        htmlFor={`ne-titvalor-${row.key}`}
                      >
                        <input
                          id={`ne-titvalor-${row.key}`}
                          className="input-base input-compact"
                          inputMode="decimal"
                          value={row.valor}
                          onChange={(e) =>
                            setFormTitulos((prev) =>
                              prev.map((t) =>
                                t.key === row.key
                                  ? {
                                      ...t,
                                      valor: maskMoneyInput(e.target.value),
                                    }
                                  : t,
                              ),
                            )
                          }
                          disabled={busy}
                        />
                      </CadastroField>
                    </CadastroFormGrid>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === "tanque" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                Informe em qual tanque caiu cada produto. Lista os tanques
                operantes do mesmo produto e filial da nota. Ao lançar: final =
                inicial − saídas + entradas.
              </p>

              {!form.filial ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--warning, #F59E0B)",
                  }}
                >
                  Selecione a filial na aba Geral para carregar os tanques.
                </p>
              ) : !formTanques.length ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                >
                  Nenhum item com produto vinculado, ou não há tanque operante
                  cadastrado para o produto nesta filial.
                </p>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {formTanques.map((row) => {
                    const opts = tanquesByProduto[row.produtoId] ?? [];
                    return (
                      <div
                        key={row.itemKey}
                        style={{
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 10,
                          padding: 10,
                          background: "var(--bg-elevated)",
                        }}
                      >
                        <CadastroFormGrid>
                          <CadastroField
                            label="Produto"
                            htmlFor={`ne-tq-prod-${row.itemKey}`}
                            span={2}
                          >
                            <input
                              id={`ne-tq-prod-${row.itemKey}`}
                              className="input-base input-compact"
                              value={row.label}
                              disabled
                            />
                          </CadastroField>
                          <CadastroField
                            label="Qtd (L)"
                            htmlFor={`ne-tq-qtd-${row.itemKey}`}
                          >
                            <input
                              id={`ne-tq-qtd-${row.itemKey}`}
                              className="input-base input-compact"
                              value={row.qtd}
                              disabled
                            />
                          </CadastroField>
                          <CadastroField
                            label="Tanque *"
                            htmlFor={`ne-tq-sel-${row.itemKey}`}
                            span={2}
                          >
                            <select
                              id={`ne-tq-sel-${row.itemKey}`}
                              className="input-base input-compact"
                              value={row.tanqueId}
                              onChange={(e) =>
                                setFormTanques((prev) =>
                                  prev.map((t) =>
                                    t.itemKey === row.itemKey
                                      ? { ...t, tanqueId: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                              disabled={busy}
                            >
                              <option value="">
                                {opts.length
                                  ? "Selecione o tanque…"
                                  : "Nenhum tanque para produto/filial"}
                              </option>
                              {opts.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.numero}
                                  {t.descricao ? ` — ${t.descricao}` : ""}
                                </option>
                              ))}
                            </select>
                          </CadastroField>
                        </CadastroFormGrid>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {formError ? (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--danger, #e35d6a)",
              }}
            >
              {formError}
            </p>
          ) : null}
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir Nota de Entrada"
          titleId="nota-entrada-delete-title"
          onClose={closeDelete}
          disabled={busy}
          width={420}
          footer={
            <CadastroFormActions
              onCancel={closeDelete}
              disabled={busy}
              busy={busy}
              danger
              submitLabel="Excluir"
              onConfirm={() => void handleDelete()}
            />
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            Excluir a nota <strong>{deleting.numero}/{deleting.serie}</strong> e
            todos os itens?
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

export default function NotaEntradaCadastroRoute() {
  return (
    <Suspense fallback={null}>
      <NotaEntradaCadastroPage />
    </Suspense>
  );
}
