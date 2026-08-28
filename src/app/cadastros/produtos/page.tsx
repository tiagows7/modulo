"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
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

type TabId = "geral" | "outras" | "contabil";

type Opt = { id: string; codigo: string; descricao: string };

type ComissaoOpt = {
  id: string;
  codigo: string;
  descricao: string;
  tipo: string;
  valor: number;
};

type IbscbsCstOpt = { id: string; cst: number; descricao: string };

type IbscbsClasstribOpt = {
  id: string;
  cst: number;
  codigo: string;
  nome: string;
};

type CestOpt = {
  id: string;
  codigo: string;
  descricao: string;
  ncm: string | null;
};

type NcmOpt = {
  id: string;
  ibpt_ncm: number;
  ibpt_ex: string | null;
  ibpt_des: string;
};

type GrupoOpt = Opt & { grupocomissao_id: string | null };

type SubgrupoOpt = Opt & { grupo_id: string };

type Produto = {
  id: string;
  codigo: string;
  codigo_barras: string | null;
  descricao: string;
  grupo_id: string | null;
  subgrupo_id: string | null;
  unidade_id: string | null;
  controla_estoque: boolean;
  categoria_icm_id: string | null;
  cfop_id: string | null;
  grupocomissao_id: string | null;
  preco_venda: number | null;
  estoque_atual: number | null;
  volume: number | null;
  estoque_minimo: number | null;
  peso: number | null;
  qtd_embalagem: number | null;
  status: string | null;
  observacao: string | null;
  ibscbs_cst_id: string | null;
  ibscbs_classtrib_id: string | null;
  ncm_id: string | null;
  cest_id: string | null;
  anp_id: string | null;
  natureza_receita: string | null;
  ipi_id: string | null;
  piscofins_id: string | null;
  pct_base_retida: number | null;
  pct_fundo_pobreza: number | null;
  aliquota_monofasica: number | null;
  grupo_produtos?: { codigo: string; descricao: string } | null;
  subgrupo_produtos?: { codigo: string; descricao: string } | null;
  unidade_medida?: { codigo: string; descricao: string } | null;
  categorias_icm?: { codigo: number; descricao: string } | null;
  produto_cfop?: { codigo: string; descricao: string } | null;
  produto_grupocomissao?: { codigo: string; descricao: string } | null;
  produto_ncm?: NcmOpt | null;
};

type FormState = {
  codigo_barras: string;
  descricao: string;
  unidade_id: string;
  controla_estoque: "S" | "N";
  grupo_id: string;
  subgrupo_id: string;
  categoria_icm_id: string;
  cfop_id: string;
  grupocomissao_id: string;
  volume: string;
  estoque_minimo: string;
  peso: string;
  qtd_embalagem: string;
  status: string;
  observacao: string;
  ibscbs_cst_id: string;
  ibscbs_classtrib_id: string;
  ncm_id: string;
  cest_id: string;
  anp_id: string;
  natureza_receita: string;
  ipi_id: string;
  piscofins_id: string;
  pct_base_retida: string;
  pct_fundo_pobreza: string;
  aliquota_monofasica: string;
};

const emptyForm: FormState = {
  codigo_barras: "",
  descricao: "",
  unidade_id: "",
  controla_estoque: "S",
  grupo_id: "",
  subgrupo_id: "",
  categoria_icm_id: "",
  cfop_id: "",
  grupocomissao_id: "",
  volume: "0",
  estoque_minimo: "0",
  peso: "0",
  qtd_embalagem: "1",
  status: "ativo",
  observacao: "",
  ibscbs_cst_id: "",
  ibscbs_classtrib_id: "",
  ncm_id: "",
  cest_id: "",
  anp_id: "",
  natureza_receita: "",
  ipi_id: "",
  piscofins_id: "",
  pct_base_retida: "0",
  pct_fundo_pobreza: "0",
  aliquota_monofasica: "0",
};

const tabs: { id: TabId; label: string }[] = [
  { id: "geral", label: "Geral" },
  { id: "outras", label: "Outras informações" },
  { id: "contabil", label: "Contábil" },
];

const columns = [
  { key: "codigo", label: "Código" },
  { key: "barras", label: "Cód. barras" },
  { key: "descricao", label: "Descrição" },
  { key: "unidade", label: "Unidade" },
  { key: "grupo", label: "Grupo" },
  { key: "status", label: "Status", align: "center" as const },
  { key: "acoes", label: "Ações", align: "center" as const },
];

function optLabel(o: { codigo: string | number; descricao: string }) {
  return `${o.codigo} — ${o.descricao}`;
}

function comissaoLabel(c: ComissaoOpt) {
  const sufixo =
    c.tipo === "valor"
      ? `R$ ${Number(c.valor).toFixed(2)}`
      : `${Number(c.valor).toFixed(2)}%`;
  return `${c.codigo} — ${c.descricao} (${sufixo})`;
}

function formatNcmCode(n: number | string) {
  return String(n).replace(/\D/g, "").padStart(8, "0");
}

function ncmLabel(n: NcmOpt) {
  const ex = n.ibpt_ex ? ` EX ${n.ibpt_ex}` : "";
  return `${formatNcmCode(n.ibpt_ncm)}${ex} — ${n.ibpt_des}`;
}

function cestMatchesNcm(cestNcm: string | null, ncmCode: string) {
  if (!cestNcm) return false;
  const cn = cestNcm.replace(/\D/g, "");
  const nn = ncmCode.replace(/\D/g, "");
  if (!cn || !nn) return false;
  return nn.startsWith(cn) || cn.startsWith(nn);
}

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function uid(v: unknown) {
  return v != null ? String(v) : null;
}

async function nextCodigo() {
  const { data } = await supabase
    .from("produtos")
    .select("codigo")
    .order("created_at", { ascending: false })
    .limit(80);

  let max = 0;
  for (const row of data ?? []) {
    const match = String(row.codigo ?? "").match(/(\d+)/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

function parseMoney(raw: string) {
  const n = Number(String(raw).trim().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

type FilialOpt = {
  id: string;
  codigo: string;
  fantasia: string | null;
  razao_social: string;
};

type ProdutoFilialRow = {
  filialId: string;
  filialLabel: string;
  existingId: string | null;
  valor_venda: string;
  valor_compra: string;
  valor_ultima_venda: string;
  margem_venda: string;
  margem_oferta: string;
  estoque: string;
  situacao: string;
  ultima_compra: string | null;
  ultima_venda: string | null;
  ultimo_acerto: string | null;
};

function filialOptLabel(f: FilialOpt) {
  const nome = (f.fantasia || f.razao_social || "").trim();
  return nome ? `${f.codigo} — ${nome}` : f.codigo;
}

function formatDateBr(iso: string | null | undefined) {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function emptyFilialRows(filiais: FilialOpt[]): ProdutoFilialRow[] {
  return filiais.map((f) => ({
    filialId: f.id,
    filialLabel: filialOptLabel(f),
    existingId: null,
    valor_venda: "0",
    valor_compra: "0",
    valor_ultima_venda: "0",
    margem_venda: "0",
    margem_oferta: "0",
    estoque: "0",
    situacao: "ativo",
    ultima_compra: null,
    ultima_venda: null,
    ultimo_acerto: null,
  }));
}

function mergeFilialRows(
  filiais: FilialOpt[],
  saved: Array<Record<string, unknown>>,
): ProdutoFilialRow[] {
  const byFilial = new Map(
    saved.map((r) => [String(r.filial), r] as const),
  );
  return filiais.map((f) => {
    const row = byFilial.get(f.id);
    if (!row) {
      return emptyFilialRows([f])[0];
    }
    return {
      filialId: f.id,
      filialLabel: filialOptLabel(f),
      existingId: row.id != null ? String(row.id) : null,
      valor_venda: String(Number(row.valor_venda) || 0),
      valor_compra: String(Number(row.valor_compra) || 0),
      valor_ultima_venda: String(Number(row.valor_ultima_venda) || 0),
      margem_venda: String(Number(row.margem_venda) || 0),
      margem_oferta: String(Number(row.margem_oferta) || 0),
      estoque: String(Number(row.estoque) || 0),
      situacao: String(row.situacao || "ativo") === "inativo" ? "inativo" : "ativo",
      ultima_compra: row.ultima_compra != null ? String(row.ultima_compra).slice(0, 10) : null,
      ultima_venda: row.ultima_venda != null ? String(row.ultima_venda).slice(0, 10) : null,
      ultimo_acerto: row.ultimo_acerto != null ? String(row.ultimo_acerto).slice(0, 10) : null,
    };
  });
}

export default function ProdutosPage() {
  const { busy, pesquisar, gravar } = useDbStatus();
  const [items, setItems] = useState<Produto[]>([]);
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [filialRows, setFilialRows] = useState<ProdutoFilialRow[]>([]);
  const [grupos, setGrupos] = useState<GrupoOpt[]>([]);
  const [subgrupos, setSubgrupos] = useState<SubgrupoOpt[]>([]);
  const [unidades, setUnidades] = useState<Opt[]>([]);
  const [categoriasIcm, setCategoriasIcm] = useState<
    { id: string; codigo: number; descricao: string }[]
  >([]);
  const [cfops, setCfops] = useState<Opt[]>([]);
  const [comissoes, setComissoes] = useState<ComissaoOpt[]>([]);
  const [ibscbsCsts, setIbscbsCsts] = useState<IbscbsCstOpt[]>([]);
  const [ibscbsClasstrib, setIbscbsClasstrib] = useState<IbscbsClasstribOpt[]>(
    [],
  );
  const [cests, setCests] = useState<CestOpt[]>([]);
  const [anps, setAnps] = useState<Opt[]>([]);
  const [ipis, setIpis] = useState<Opt[]>([]);
  const [piscofins, setPiscofins] = useState<Opt[]>([]);
  const [ncmQuery, setNcmQuery] = useState("");
  const [ncmResults, setNcmResults] = useState<NcmOpt[]>([]);
  const [ncmSelected, setNcmSelected] = useState<NcmOpt | null>(null);
  const [ncmOpen, setNcmOpen] = useState(false);
  const [ncmSearching, setNcmSearching] = useState(false);
  const [ncmSearchError, setNcmSearchError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [deleting, setDeleting] = useState<Produto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [tab, setTab] = useState<TabId>("geral");
  const [formError, setFormError] = useState("");

  const loadData = useCallback(async () => {
    await pesquisar(async () => {
      setLoadError("");
      const [
        prodRes,
        grupoRes,
        subRes,
        undRes,
        catRes,
        cfopRes,
        comRes,
        ibsCstRes,
        ibsClassRes,
        cestRes,
        anpRes,
        ipiRes,
        pisRes,
        filialRes,
      ] = await Promise.all([
        supabase
          .from("produtos")
          .select(
            `
            id, codigo, codigo_barras, descricao, grupo_id, subgrupo_id,
            unidade_id, controla_estoque, categoria_icm_id, cfop_id, grupocomissao_id,
            preco_venda, estoque_atual, volume, estoque_minimo, peso, qtd_embalagem,
            status, observacao,
            ibscbs_cst_id, ibscbs_classtrib_id, ncm_id, cest_id, anp_id,
            natureza_receita, ipi_id, piscofins_id,
            pct_base_retida, pct_fundo_pobreza, aliquota_monofasica,
            grupo_produtos ( codigo, descricao ),
            subgrupo_produtos ( codigo, descricao ),
            unidade_medida ( codigo, descricao ),
            categorias_icm ( codigo, descricao ),
            produto_cfop ( codigo, descricao ),
            produto_grupocomissao ( codigo, descricao ),
            produto_ncm ( id, ibpt_ncm, ibpt_ex, ibpt_des )
          `,
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("grupo_produtos")
          .select("id, codigo, descricao, grupocomissao_id")
          .eq("status", "ativo")
          .order("descricao"),
        supabase
          .from("subgrupo_produtos")
          .select("id, codigo, descricao, grupo_id")
          .eq("status", "ativo")
          .order("descricao"),
        supabase
          .from("unidade_medida")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("categorias_icm")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("produto_cfop")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("produto_grupocomissao")
          .select("id, codigo, descricao, tipo, valor")
          .order("codigo"),
        supabase
          .from("produto_ibscbs_cst")
          .select("id, cst, descricao")
          .order("cst"),
        supabase
          .from("produto_ibscbs_classtrib")
          .select("id, cst, codigo, nome")
          .order("codigo"),
        supabase
          .from("produto_cest")
          .select("id, codigo, descricao, ncm")
          .order("codigo"),
        supabase
          .from("produto_anp")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("produto_ipi")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("produto_piscofins")
          .select("id, codigo, descricao")
          .order("codigo"),
        supabase
          .from("filial")
          .select("id, codigo, fantasia, razao_social")
          .eq("status", "ativo")
          .order("codigo"),
      ]);

      if (prodRes.error) {
        setLoadError(prodRes.error.message);
        setItems([]);
        return;
      }

      const rows = (prodRes.data ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          id: String(r.id),
          codigo: String(r.codigo ?? ""),
          codigo_barras: r.codigo_barras != null ? String(r.codigo_barras) : null,
          descricao: String(r.descricao ?? ""),
          grupo_id: r.grupo_id != null ? String(r.grupo_id) : null,
          subgrupo_id: r.subgrupo_id != null ? String(r.subgrupo_id) : null,
          unidade_id: r.unidade_id != null ? String(r.unidade_id) : null,
          controla_estoque: Boolean(r.controla_estoque ?? true),
          categoria_icm_id:
            r.categoria_icm_id != null ? String(r.categoria_icm_id) : null,
          cfop_id: r.cfop_id != null ? String(r.cfop_id) : null,
          grupocomissao_id:
            r.grupocomissao_id != null ? String(r.grupocomissao_id) : null,
          preco_venda: r.preco_venda != null ? Number(r.preco_venda) : 0,
          estoque_atual: r.estoque_atual != null ? Number(r.estoque_atual) : 0,
          volume: r.volume != null ? Number(r.volume) : 0,
          estoque_minimo: r.estoque_minimo != null ? Number(r.estoque_minimo) : 0,
          peso: r.peso != null ? Number(r.peso) : 0,
          qtd_embalagem: r.qtd_embalagem != null ? Number(r.qtd_embalagem) : 1,
          status: r.status != null ? String(r.status) : "ativo",
          observacao: r.observacao != null ? String(r.observacao) : null,
          ibscbs_cst_id: uid(r.ibscbs_cst_id),
          ibscbs_classtrib_id: uid(r.ibscbs_classtrib_id),
          ncm_id: uid(r.ncm_id),
          cest_id: uid(r.cest_id),
          anp_id: uid(r.anp_id),
          natureza_receita:
            r.natureza_receita != null ? String(r.natureza_receita) : null,
          ipi_id: uid(r.ipi_id),
          piscofins_id: uid(r.piscofins_id),
          pct_base_retida:
            r.pct_base_retida != null ? Number(r.pct_base_retida) : 0,
          pct_fundo_pobreza:
            r.pct_fundo_pobreza != null ? Number(r.pct_fundo_pobreza) : 0,
          aliquota_monofasica:
            r.aliquota_monofasica != null ? Number(r.aliquota_monofasica) : 0,
          grupo_produtos: asOne(
            r.grupo_produtos as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          subgrupo_produtos: asOne(
            r.subgrupo_produtos as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          unidade_medida: asOne(
            r.unidade_medida as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          categorias_icm: asOne(
            r.categorias_icm as
              | { codigo: number; descricao: string }
              | { codigo: number; descricao: string }[]
              | null,
          ),
          produto_cfop: asOne(
            r.produto_cfop as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          produto_grupocomissao: asOne(
            r.produto_grupocomissao as
              | { codigo: string; descricao: string }
              | { codigo: string; descricao: string }[]
              | null,
          ),
          produto_ncm: asOne(
            r.produto_ncm as NcmOpt | NcmOpt[] | null,
          ),
        } satisfies Produto;
      });

      setItems(rows);
      setGrupos(
        (grupoRes.data ?? []).map((g) => ({
          id: String(g.id),
          codigo: String(g.codigo),
          descricao: String(g.descricao),
          grupocomissao_id:
            g.grupocomissao_id != null ? String(g.grupocomissao_id) : null,
        })),
      );
      setSubgrupos((subRes.data ?? []) as SubgrupoOpt[]);
      setUnidades((undRes.data ?? []) as Opt[]);
      setCategoriasIcm(
        (catRes.data ?? []).map((c) => ({
          id: String(c.id),
          codigo: Number(c.codigo),
          descricao: String(c.descricao),
        })),
      );
      setCfops((cfopRes.data ?? []) as Opt[]);
      setComissoes(
        (comRes.data ?? []).map((c) => ({
          id: String(c.id),
          codigo: String(c.codigo),
          descricao: String(c.descricao),
          tipo: String(c.tipo),
          valor: Number(c.valor) || 0,
        })),
      );
      setIbscbsCsts(
        (ibsCstRes.data ?? []).map((c) => ({
          id: String(c.id),
          cst: Number(c.cst),
          descricao: String(c.descricao),
        })),
      );
      setIbscbsClasstrib(
        (ibsClassRes.data ?? []).map((c) => ({
          id: String(c.id),
          cst: Number(c.cst),
          codigo: String(c.codigo),
          nome: String(c.nome),
        })),
      );
      setCests(
        (cestRes.data ?? []).map((c) => ({
          id: String(c.id),
          codigo: String(c.codigo),
          descricao: String(c.descricao ?? ""),
          ncm: c.ncm != null ? String(c.ncm) : null,
        })),
      );
      setAnps((anpRes.data ?? []) as Opt[]);
      setIpis((ipiRes.data ?? []) as Opt[]);
      setPiscofins((pisRes.data ?? []) as Opt[]);
      setFiliais(
        (filialRes.data ?? []).map((f) => ({
          id: String(f.id),
          codigo: String(f.codigo),
          fantasia: f.fantasia != null ? String(f.fantasia) : null,
          razao_social: String(f.razao_social ?? ""),
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const subgruposFiltrados = useMemo(() => {
    if (!form.grupo_id) return [];
    return subgrupos.filter((s) => s.grupo_id === form.grupo_id);
  }, [form.grupo_id, subgrupos]);

  const classtribFiltrados = useMemo(() => {
    if (!form.ibscbs_cst_id) return [];
    const cst = ibscbsCsts.find((c) => c.id === form.ibscbs_cst_id)?.cst;
    if (cst == null) return [];
    return ibscbsClasstrib.filter((c) => c.cst === cst);
  }, [form.ibscbs_cst_id, ibscbsCsts, ibscbsClasstrib]);

  const cestsFiltrados = useMemo(() => {
    if (!ncmSelected) return [];
    const code = formatNcmCode(ncmSelected.ibpt_ncm);
    return cests.filter((c) => cestMatchesNcm(c.ncm, code));
  }, [ncmSelected, cests]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "grupo_id") {
        const stillValid = subgrupos.some(
          (s) => s.grupo_id === value && s.id === prev.subgrupo_id,
        );
        if (!stillValid) next.subgrupo_id = "";
        const grupo = grupos.find((g) => g.id === value);
        if (grupo?.grupocomissao_id) {
          next.grupocomissao_id = grupo.grupocomissao_id;
        }
      }
      if (key === "ibscbs_cst_id") {
        const cst = ibscbsCsts.find((c) => c.id === value)?.cst;
        const stillOk = ibscbsClasstrib.some(
          (c) => c.id === prev.ibscbs_classtrib_id && c.cst === cst,
        );
        if (!stillOk) next.ibscbs_classtrib_id = "";
      }
      return next;
    });
  };

  const selectNcm = (n: NcmOpt | null) => {
    setNcmSelected(n);
    setNcmQuery(n ? ncmLabel(n) : "");
    setNcmResults([]);
    setNcmOpen(false);
    setForm((prev) => {
      const next = { ...prev, ncm_id: n?.id ?? "" };
      if (!n) {
        next.cest_id = "";
        return next;
      }
      const code = formatNcmCode(n.ibpt_ncm);
      const stillOk = cests.some(
        (c) => c.id === prev.cest_id && cestMatchesNcm(c.ncm, code),
      );
      if (!stillOk) next.cest_id = "";
      return next;
    });
  };

  useEffect(() => {
    const q = ncmQuery.trim();
    if (!ncmOpen || ncmSelected) {
      setNcmSearching(false);
      return;
    }
    if (q.length < 2) {
      setNcmResults([]);
      setNcmSearchError("");
      setNcmSearching(false);
      return;
    }

    let cancelled = false;
    setNcmSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const digits = q.replace(/\D/g, "");
        let query = supabase
          .from("produto_ncm")
          .select("id, ibpt_ncm, ibpt_ex, ibpt_des")
          .limit(50);

        if (digits.length >= 8) {
          query = query.eq("ibpt_ncm", Number(digits.slice(0, 8))).order("ibpt_ex");
        } else if (digits.length >= 4 && /^\d+$/.test(digits)) {
          const n = Number(digits);
          const factor = 10 ** (8 - digits.length);
          query = query
            .gte("ibpt_ncm", n * factor)
            .lt("ibpt_ncm", (n + 1) * factor)
            .order("ibpt_ncm");
        } else {
          query = query.ilike("ibpt_des", `%${q}%`).order("ibpt_ncm");
        }

        const { data, error } = await query;
        if (cancelled) return;
        setNcmSearching(false);
        if (error) {
          setNcmResults([]);
          setNcmSearchError(error.message);
          return;
        }
        setNcmSearchError("");
        setNcmResults(
          (data ?? []).map((row) => ({
            id: String(row.id),
            ibpt_ncm: Number(row.ibpt_ncm),
            ibpt_ex: row.ibpt_ex != null ? String(row.ibpt_ex) : null,
            ibpt_des: String(row.ibpt_des),
          })),
        );
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ncmQuery, ncmOpen, ncmSelected]);

  const openCreate = () => {
    setEditing(null);
    const undPadrao =
      unidades.find((u) => u.codigo.toUpperCase() === "UN")?.id ??
      (unidades.length === 1 ? unidades[0].id : "");
    setForm({
      ...emptyForm,
      unidade_id: undPadrao,
      grupo_id: grupos.length === 1 ? grupos[0].id : "",
    });
    setFilialRows(emptyFilialRows(filiais));
    setNcmSelected(null);
    setNcmQuery("");
    setNcmResults([]);
    setNcmOpen(false);
    setTab("geral");
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = async (item: Produto) => {
    setEditing(item);
    setForm({
      codigo_barras: item.codigo_barras ?? "",
      descricao: item.descricao,
      unidade_id: item.unidade_id ?? "",
      controla_estoque: item.controla_estoque ? "S" : "N",
      grupo_id: item.grupo_id ?? "",
      subgrupo_id: item.subgrupo_id ?? "",
      categoria_icm_id: item.categoria_icm_id ?? "",
      cfop_id: item.cfop_id ?? "",
      grupocomissao_id: item.grupocomissao_id ?? "",
      volume: String(item.volume ?? 0),
      estoque_minimo: String(item.estoque_minimo ?? 0),
      peso: String(item.peso ?? 0),
      qtd_embalagem: String(item.qtd_embalagem ?? 1),
      status: item.status === "inativo" ? "inativo" : "ativo",
      observacao: item.observacao ?? "",
      ibscbs_cst_id: item.ibscbs_cst_id ?? "",
      ibscbs_classtrib_id: item.ibscbs_classtrib_id ?? "",
      ncm_id: item.ncm_id ?? "",
      cest_id: item.cest_id ?? "",
      anp_id: item.anp_id ?? "",
      natureza_receita: item.natureza_receita ?? "",
      ipi_id: item.ipi_id ?? "",
      piscofins_id: item.piscofins_id ?? "",
      pct_base_retida: String(item.pct_base_retida ?? 0),
      pct_fundo_pobreza: String(item.pct_fundo_pobreza ?? 0),
      aliquota_monofasica: String(item.aliquota_monofasica ?? 0),
    });
    if (item.produto_ncm) {
      setNcmSelected(item.produto_ncm);
      setNcmQuery(ncmLabel(item.produto_ncm));
    } else {
      setNcmSelected(null);
      setNcmQuery("");
    }
    setNcmResults([]);
    setNcmOpen(false);
    setTab("geral");
    setFormError("");
    setActionError("");
    setFilialRows(emptyFilialRows(filiais));
    setModalOpen(true);

    const { data } = await supabase
      .from("produto_filial")
      .select(
        `
        id, filial, valor_venda, ultima_compra, fornecedor_compra, valor_compra,
        ultima_venda, cliente_venda, valor_ultima_venda, margem_venda, situacao,
        estoque, ultimo_acerto, margem_oferta
      `,
      )
      .eq("produto", item.id);
    setFilialRows(mergeFilialRows(filiais, (data ?? []) as Record<string, unknown>[]));
  };

  const openDelete = (item: Produto) => {
    setDeleting(item);
    setActionError("");
  };

  const closeDelete = () => {
    if (busy) return;
    setDeleting(null);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditing(null);
    setFilialRows([]);
    setFormError("");
  };

  const updateFilialRow = (
    filialId: string,
    key: keyof ProdutoFilialRow,
    value: string,
  ) => {
    setFilialRows((prev) =>
      prev.map((row) =>
        row.filialId === filialId ? { ...row, [key]: value } : row,
      ),
    );
  };

  const syncProdutoFilial = async (produtoId: string) => {
    for (const row of filialRows) {
      const payload = {
        filial: row.filialId,
        produto: produtoId,
        valor_venda: parseMoney(row.valor_venda),
        margem_venda: parseMoney(row.margem_venda),
        margem_oferta: parseMoney(row.margem_oferta),
        estoque: parseMoney(row.estoque),
        situacao: row.situacao === "inativo" ? "inativo" : "ativo",
      };
      if (row.existingId) {
        const { error } = await supabase
          .from("produto_filial")
          .update(payload)
          .eq("id", row.existingId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("produto_filial").insert(payload);
        if (error) throw new Error(error.message);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const desc = form.descricao.trim();
    if (!desc) {
      setFormError("Informe a descrição do produto.");
      setTab("geral");
      return;
    }
    if (!form.unidade_id) {
      setFormError("Selecione a unidade de medida.");
      setTab("geral");
      return;
    }

    setFormError("");
    const payload = {
      codigo_barras: form.codigo_barras.trim() || null,
      descricao: desc,
      unidade_id: form.unidade_id || null,
      controla_estoque: form.controla_estoque === "S",
      grupo_id: form.grupo_id || null,
      subgrupo_id: form.subgrupo_id || null,
      categoria_icm_id: form.categoria_icm_id || null,
      cfop_id: form.cfop_id || null,
      grupocomissao_id: form.grupocomissao_id || null,
      volume: parseMoney(form.volume),
      estoque_minimo: parseMoney(form.estoque_minimo),
      peso: parseMoney(form.peso),
      qtd_embalagem: parseMoney(form.qtd_embalagem),
      status: form.status === "inativo" ? "inativo" : "ativo",
      observacao: form.observacao.trim() || null,
      ibscbs_cst_id: form.ibscbs_cst_id || null,
      ibscbs_classtrib_id: form.ibscbs_classtrib_id || null,
      ncm_id: form.ncm_id || null,
      cest_id: form.cest_id || null,
      anp_id: form.anp_id || null,
      natureza_receita: form.natureza_receita.trim() || null,
      ipi_id: form.ipi_id || null,
      piscofins_id: form.piscofins_id || null,
      pct_base_retida: parseMoney(form.pct_base_retida),
      pct_fundo_pobreza: parseMoney(form.pct_fundo_pobreza),
      aliquota_monofasica: parseMoney(form.aliquota_monofasica),
    };

    try {
      await gravar(async () => {
        let produtoId = editing?.id ?? null;
        if (editing) {
          const { error } = await supabase
            .from("produtos")
            .update(payload)
            .eq("id", editing.id);
          if (error) throw new Error(error.message);
        } else {
          const codigo = await nextCodigo();
          const { data, error } = await supabase
            .from("produtos")
            .insert({
              ...payload,
              codigo,
              preco_venda: 0,
              estoque_atual: 0,
            })
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          produtoId = String(data.id);
        }
        if (produtoId) await syncProdutoFilial(produtoId);
      });

      setModalOpen(false);
      setEditing(null);
      setFilialRows([]);
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
        const checks = await Promise.all([
          supabase
            .from("tanques")
            .select("id", { count: "exact", head: true })
            .eq("produto_id", deleting.id),
          supabase
            .from("bicos")
            .select("id", { count: "exact", head: true })
            .eq("produto_id", deleting.id),
          supabase
            .from("grupo_precos_itens")
            .select("id", { count: "exact", head: true })
            .eq("produto_id", deleting.id),
        ]);

        for (const res of checks) {
          if (res.error) throw new Error(res.error.message);
        }
        const [tanques, bicos, precos] = checks;
        const total =
          (tanques.count ?? 0) + (bicos.count ?? 0) + (precos.count ?? 0);
        if (total > 0) {
          throw new Error(
            `Não é possível excluir: produto vinculado a tanques/bicos/grupo de preços (${total} vínculo(s)).`,
          );
        }

        const { error } = await supabase
          .from("produtos")
          .delete()
          .eq("id", deleting.id);
        if (error) throw new Error(error.message);
      });

      setDeleting(null);
      await loadData();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Falha ao excluir o produto.",
      );
    }
  };

  const rows = items.map((item) => ({
    codigo: item.codigo,
    barras: item.codigo_barras || "—",
    descricao: item.descricao,
    unidade: item.unidade_medida?.codigo ?? "—",
    grupo: item.grupo_produtos
      ? `${item.grupo_produtos.codigo} — ${item.grupo_produtos.descricao}`
      : "—",
    status: (
      <span
        className={`badge ${item.status === "ativo" ? "badge-success" : "badge-warning"}`}
      >
        {item.status || "—"}
      </span>
    ),
    acoes: (
      <CadastroRowActions
        disabled={busy}
        onEdit={() => void openEdit(item)}
        onDelete={() => openDelete(item)}
      />
    ),
  }));

  return (
    <>
      {loadError ? (
        <CadastroFormError
          title="Erro ao carregar"
          message={`Erro ao carregar produtos: ${loadError}`}
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
        title="Produtos"
        description="Cadastro de produtos e itens"
        icon={<Package size={22} />}
        columns={columns}
        rows={rows}
        addLabel="Novo Produto"
        backUrl="/cadastros"
        onAdd={busy ? undefined : openCreate}
      />

      {modalOpen ? (
        <CadastroModal
          title={editing ? "Editar Produto" : "Novo Produto"}
          titleId="produto-title"
          subtitle={
            editing ? (
              <>
                Código:{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  {editing.codigo}
                </strong>
              </>
            ) : (
              "Código gerado automaticamente ao salvar"
            )
          }
          onClose={closeModal}
          disabled={busy}
          width={960}
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
          {formError ? (
            <CadastroFormError
              message={formError}
              onClose={() => setFormError("")}
            />
          ) : null}

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
                <div className="cadastro-form-row cadastro-form-row-3">
                  <CadastroField label="Código de barras" htmlFor="prod-barras">
                    <input
                      id="prod-barras"
                      className="input-base input-compact"
                      value={form.codigo_barras}
                      onChange={(e) =>
                        updateForm("codigo_barras", e.target.value)
                      }
                      disabled={busy}
                      autoFocus
                      maxLength={50}
                      placeholder="EAN / GTIN"
                    />
                  </CadastroField>

                  <CadastroField label="Unidade *" htmlFor="prod-unidade">
                    <select
                      id="prod-unidade"
                      className="input-base input-compact"
                      value={form.unidade_id}
                      onChange={(e) => updateForm("unidade_id", e.target.value)}
                      disabled={busy}
                      required
                    >
                      <option value="">— Selecione —</option>
                      {unidades.map((u) => (
                        <option key={u.id} value={u.id}>
                          {optLabel(u)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>

                  <CadastroField label="Controla estoque" htmlFor="prod-estoque">
                    <select
                      id="prod-estoque"
                      className="input-base input-compact"
                      value={form.controla_estoque}
                      onChange={(e) =>
                        updateForm(
                          "controla_estoque",
                          e.target.value === "N" ? "N" : "S",
                        )
                      }
                      disabled={busy}
                    >
                      <option value="S">Sim</option>
                      <option value="N">Não</option>
                    </select>
                  </CadastroField>
                </div>

                <CadastroField
                  label="Descrição *"
                  htmlFor="prod-descricao"
                  span="full"
                >
                  <input
                    id="prod-descricao"
                    className="input-base input-compact"
                    value={form.descricao}
                    onChange={(e) => updateForm("descricao", e.target.value)}
                    disabled={busy}
                    required
                    maxLength={200}
                  />
                </CadastroField>

                <div className="cadastro-form-row cadastro-form-row-2">
                  <CadastroField label="Grupo" htmlFor="prod-grupo">
                    <select
                      id="prod-grupo"
                      className="input-base input-compact"
                      value={form.grupo_id}
                      onChange={(e) => updateForm("grupo_id", e.target.value)}
                      disabled={busy}
                    >
                      <option value="">— Sem grupo —</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {optLabel(g)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>

                  <CadastroField label="Sub-grupo" htmlFor="prod-subgrupo">
                    <select
                      id="prod-subgrupo"
                      className="input-base input-compact"
                      value={form.subgrupo_id}
                      onChange={(e) => updateForm("subgrupo_id", e.target.value)}
                      disabled={busy || !form.grupo_id}
                    >
                      <option value="">
                        {form.grupo_id
                          ? "— Sem sub-grupo —"
                          : "— Selecione o grupo —"}
                      </option>
                      {subgruposFiltrados.map((s) => (
                        <option key={s.id} value={s.id}>
                          {optLabel(s)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>
                </div>

                <CadastroField
                  label="Grupo de comissão"
                  htmlFor="prod-comissao"
                  span="full"
                >
                  <select
                    id="prod-comissao"
                    className="input-base input-compact"
                    value={form.grupocomissao_id}
                    onChange={(e) =>
                      updateForm("grupocomissao_id", e.target.value)
                    }
                    disabled={busy}
                  >
                    <option value="">— Sem comissão —</option>
                    {comissoes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {comissaoLabel(c)}
                      </option>
                    ))}
                  </select>
                </CadastroField>

                <div className="cadastro-form-row cadastro-form-row-2">
                  <CadastroField label="Categoria ICMS" htmlFor="prod-cat-icm">
                    <select
                      id="prod-cat-icm"
                      className="input-base input-compact"
                      value={form.categoria_icm_id}
                      onChange={(e) =>
                        updateForm("categoria_icm_id", e.target.value)
                      }
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {categoriasIcm.map((c) => (
                        <option key={c.id} value={c.id}>
                          {optLabel(c)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>

                  <CadastroField label="CFOP" htmlFor="prod-cfop">
                    <select
                      id="prod-cfop"
                      className="input-base input-compact"
                      value={form.cfop_id}
                      onChange={(e) => updateForm("cfop_id", e.target.value)}
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {cfops.map((c) => (
                        <option key={c.id} value={c.id}>
                          {optLabel(c)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>
                </div>
              </CadastroFormGrid>
            </div>
          ) : null}

          {tab === "outras" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <CadastroField label="Estoque mínimo" htmlFor="prod-estoque-min">
                  <input
                    id="prod-estoque-min"
                    className="input-base input-compact"
                    value={form.estoque_minimo}
                    onChange={(e) =>
                      updateForm("estoque_minimo", e.target.value)
                    }
                    disabled={busy || form.controla_estoque === "N"}
                    inputMode="decimal"
                  />
                </CadastroField>

                <CadastroField label="Volume" htmlFor="prod-volume">
                  <input
                    id="prod-volume"
                    className="input-base input-compact"
                    value={form.volume}
                    onChange={(e) => updateForm("volume", e.target.value)}
                    disabled={busy}
                    inputMode="decimal"
                  />
                </CadastroField>

                <CadastroField label="Peso" htmlFor="prod-peso">
                  <input
                    id="prod-peso"
                    className="input-base input-compact"
                    value={form.peso}
                    onChange={(e) => updateForm("peso", e.target.value)}
                    disabled={busy}
                    inputMode="decimal"
                  />
                </CadastroField>

                <CadastroField
                  label="Quantidade na embalagem"
                  htmlFor="prod-qtd-emb"
                >
                  <input
                    id="prod-qtd-emb"
                    className="input-base input-compact"
                    value={form.qtd_embalagem}
                    onChange={(e) =>
                      updateForm("qtd_embalagem", e.target.value)
                    }
                    disabled={busy}
                    inputMode="decimal"
                  />
                </CadastroField>

                <CadastroField label="Status" htmlFor="prod-status">
                  <select
                    id="prod-status"
                    className="input-base input-compact"
                    value={form.status}
                    onChange={(e) => updateForm("status", e.target.value)}
                    disabled={busy}
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </CadastroField>

                <CadastroField
                  label="Observação"
                  htmlFor="prod-obs"
                  span="full"
                >
                  <textarea
                    id="prod-obs"
                    className="input-base input-compact"
                    value={form.observacao}
                    onChange={(e) => updateForm("observacao", e.target.value)}
                    disabled={busy}
                    rows={3}
                    style={{ resize: "vertical", minHeight: 64 }}
                  />
                </CadastroField>
              </CadastroFormGrid>
            </div>
          ) : null}

          {tab === "contabil" ? (
            <div className="cadastro-tab-panel" role="tabpanel">
              <CadastroFormGrid>
                <div className="cadastro-form-row cadastro-form-row-2">
                  <CadastroField label="IBS-CBS CST" htmlFor="prod-ibs-cst">
                    <select
                      id="prod-ibs-cst"
                      className="input-base input-compact"
                      value={form.ibscbs_cst_id}
                      onChange={(e) =>
                        updateForm("ibscbs_cst_id", e.target.value)
                      }
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {ibscbsCsts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {String(c.cst).padStart(3, "0")} — {c.descricao}
                        </option>
                      ))}
                    </select>
                  </CadastroField>

                  <CadastroField
                    label="IBS-CBS Class. Trib."
                    htmlFor="prod-ibs-class"
                  >
                    <select
                      id="prod-ibs-class"
                      className="input-base input-compact"
                      value={form.ibscbs_classtrib_id}
                      onChange={(e) =>
                        updateForm("ibscbs_classtrib_id", e.target.value)
                      }
                      disabled={busy || !form.ibscbs_cst_id}
                    >
                      <option value="">
                        {form.ibscbs_cst_id
                          ? "— Selecione —"
                          : "— Selecione o CST —"}
                      </option>
                      {classtribFiltrados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} — {c.nome}
                        </option>
                      ))}
                    </select>
                  </CadastroField>
                </div>

                <CadastroField label="Código NCM" htmlFor="prod-ncm" span="full">
                  <div className="cadastro-ncm-search">
                    {ncmSelected && form.ncm_id ? (
                      <div className="cadastro-ncm-selected">
                        <input
                          id="prod-ncm"
                          className="input-base input-compact"
                          value={ncmLabel(ncmSelected)}
                          readOnly
                          disabled={busy}
                        />
                        <button
                          type="button"
                          className="cadastro-ncm-clear"
                          onClick={() => selectNcm(null)}
                          disabled={busy}
                        >
                          Alterar / limpar
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          id="prod-ncm"
                          className="input-base input-compact"
                          value={ncmQuery}
                          placeholder="Buscar em produto_ncm (código ou descrição)…"
                          disabled={busy}
                          autoComplete="off"
                          onFocus={() => setNcmOpen(true)}
                          onChange={(e) => {
                            setNcmQuery(e.target.value);
                            setNcmOpen(true);
                          }}
                          onBlur={() => {
                            window.setTimeout(() => setNcmOpen(false), 180);
                          }}
                        />
                        {ncmSearching ? (
                          <div className="cadastro-ncm-hint">Buscando…</div>
                        ) : null}
                        {ncmSearchError ? (
                          <div className="cadastro-ncm-hint cadastro-ncm-error">
                            {ncmSearchError}
                          </div>
                        ) : null}
                        {!ncmSearching &&
                        ncmOpen &&
                        ncmQuery.trim().length >= 2 &&
                        ncmResults.length === 0 &&
                        !ncmSearchError ? (
                          <div className="cadastro-ncm-hint">
                            Nenhum NCM encontrado em produto_ncm
                          </div>
                        ) : null}
                        {ncmOpen && ncmResults.length > 0 ? (
                          <ul className="cadastro-ncm-results" role="listbox">
                            {ncmResults.map((n) => (
                              <li key={n.id}>
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selectNcm(n)}
                                >
                                  {ncmLabel(n)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    )}
                  </div>
                </CadastroField>

                <div className="cadastro-form-row cadastro-form-row-2">
                  <CadastroField label="Código CEST" htmlFor="prod-cest">
                    <select
                      id="prod-cest"
                      className="input-base input-compact"
                      value={form.cest_id}
                      onChange={(e) => updateForm("cest_id", e.target.value)}
                      disabled={busy || !form.ncm_id}
                    >
                      <option value="">
                        {form.ncm_id
                          ? cestsFiltrados.length
                            ? "— Selecione —"
                            : "— Nenhum CEST para este NCM —"
                          : "— Informe o NCM —"}
                      </option>
                      {cestsFiltrados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.codigo} — {c.descricao.slice(0, 60)}
                          {c.descricao.length > 60 ? "…" : ""}
                        </option>
                      ))}
                    </select>
                  </CadastroField>

                  <CadastroField label="Código ANP" htmlFor="prod-anp">
                    <select
                      id="prod-anp"
                      className="input-base input-compact"
                      value={form.anp_id}
                      onChange={(e) => updateForm("anp_id", e.target.value)}
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {anps.map((a) => (
                        <option key={a.id} value={a.id}>
                          {optLabel(a)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>
                </div>

                <div className="cadastro-form-row cadastro-form-row-3">
                  <CadastroField
                    label="Natureza da receita"
                    htmlFor="prod-nat-rec"
                  >
                    <input
                      id="prod-nat-rec"
                      className="input-base input-compact"
                      value={form.natureza_receita}
                      onChange={(e) =>
                        updateForm("natureza_receita", e.target.value)
                      }
                      disabled={busy}
                      maxLength={10}
                      placeholder="Ex.: 101"
                    />
                  </CadastroField>

                  <CadastroField label="CST IPI" htmlFor="prod-ipi">
                    <select
                      id="prod-ipi"
                      className="input-base input-compact"
                      value={form.ipi_id}
                      onChange={(e) => updateForm("ipi_id", e.target.value)}
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {ipis.map((i) => (
                        <option key={i.id} value={i.id}>
                          {optLabel(i)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>

                  <CadastroField label="CST PIS-COFINS" htmlFor="prod-pis">
                    <select
                      id="prod-pis"
                      className="input-base input-compact"
                      value={form.piscofins_id}
                      onChange={(e) =>
                        updateForm("piscofins_id", e.target.value)
                      }
                      disabled={busy}
                    >
                      <option value="">— Selecione —</option>
                      {piscofins.map((p) => (
                        <option key={p.id} value={p.id}>
                          {optLabel(p)}
                        </option>
                      ))}
                    </select>
                  </CadastroField>
                </div>

                <div className="cadastro-form-row cadastro-form-row-3">
                  <CadastroField
                    label="% base retida"
                    htmlFor="prod-base-ret"
                  >
                    <input
                      id="prod-base-ret"
                      className="input-base input-compact"
                      value={form.pct_base_retida}
                      onChange={(e) =>
                        updateForm("pct_base_retida", e.target.value)
                      }
                      disabled={busy}
                      inputMode="decimal"
                    />
                  </CadastroField>

                  <CadastroField
                    label="% fundo pobreza"
                    htmlFor="prod-fcp"
                  >
                    <input
                      id="prod-fcp"
                      className="input-base input-compact"
                      value={form.pct_fundo_pobreza}
                      onChange={(e) =>
                        updateForm("pct_fundo_pobreza", e.target.value)
                      }
                      disabled={busy}
                      inputMode="decimal"
                    />
                  </CadastroField>

                  <CadastroField
                    label="Alíquota monofásica"
                    htmlFor="prod-aliq-mono"
                  >
                    <input
                      id="prod-aliq-mono"
                      className="input-base input-compact"
                      value={form.aliquota_monofasica}
                      onChange={(e) =>
                        updateForm("aliquota_monofasica", e.target.value)
                      }
                      disabled={busy}
                      inputMode="decimal"
                    />
                  </CadastroField>
                </div>
              </CadastroFormGrid>
            </div>
          ) : null}

          <div className="cadastro-options-panel" style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <strong style={{ fontSize: 12, color: "var(--text-primary)" }}>
                Filiais
              </strong>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Preço, estoque e situação por filial
              </span>
            </div>
            {filialRows.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  padding: "10px 0",
                }}
              >
                Nenhuma filial ativa cadastrada.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="cadastro-mini-table">
                  <thead>
                    <tr>
                      <th>Filial</th>
                      <th>Situação</th>
                      <th style={{ textAlign: "right" }}>Vlr venda</th>
                      <th style={{ textAlign: "right" }}>Estoque</th>
                      <th style={{ textAlign: "right" }}>Margem</th>
                      <th style={{ textAlign: "right" }}>Marg. oferta</th>
                      <th style={{ textAlign: "right" }}>Vlr compra</th>
                      <th>Últ. compra</th>
                      <th>Últ. venda</th>
                      <th>Últ. acerto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filialRows.map((row) => (
                      <tr key={row.filialId}>
                        <td style={{ whiteSpace: "nowrap", minWidth: 140 }}>
                          {row.filialLabel}
                        </td>
                        <td>
                          <select
                            className="input-base input-compact"
                            value={row.situacao}
                            onChange={(e) =>
                              updateFilialRow(
                                row.filialId,
                                "situacao",
                                e.target.value,
                              )
                            }
                            disabled={busy}
                            style={{ minWidth: 100 }}
                          >
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="input-base input-compact"
                            value={row.valor_venda}
                            onChange={(e) =>
                              updateFilialRow(
                                row.filialId,
                                "valor_venda",
                                e.target.value,
                              )
                            }
                            disabled={busy}
                            inputMode="decimal"
                            style={{ width: 90, textAlign: "right" }}
                          />
                        </td>
                        <td>
                          <input
                            className="input-base input-compact"
                            value={row.estoque}
                            onChange={(e) =>
                              updateFilialRow(
                                row.filialId,
                                "estoque",
                                e.target.value,
                              )
                            }
                            disabled={busy}
                            inputMode="decimal"
                            style={{ width: 80, textAlign: "right" }}
                          />
                        </td>
                        <td>
                          <input
                            className="input-base input-compact"
                            value={row.margem_venda}
                            onChange={(e) =>
                              updateFilialRow(
                                row.filialId,
                                "margem_venda",
                                e.target.value,
                              )
                            }
                            disabled={busy}
                            inputMode="decimal"
                            style={{ width: 70, textAlign: "right" }}
                          />
                        </td>
                        <td>
                          <input
                            className="input-base input-compact"
                            value={row.margem_oferta}
                            onChange={(e) =>
                              updateFilialRow(
                                row.filialId,
                                "margem_oferta",
                                e.target.value,
                              )
                            }
                            disabled={busy}
                            inputMode="decimal"
                            style={{ width: 70, textAlign: "right" }}
                          />
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {Number(row.valor_compra || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 3,
                            maximumFractionDigits: 3,
                          })}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatDateBr(row.ultima_compra)}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatDateBr(row.ultima_venda)}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {formatDateBr(row.ultimo_acerto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CadastroModal>
      ) : null}

      {deleting ? (
        <CadastroModal
          title="Excluir produto"
          titleId="produto-delete-title"
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
            Confirma a exclusão do produto{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {deleting.codigo} — {deleting.descricao}
            </strong>
            ?
          </p>
        </CadastroModal>
      ) : null}
    </>
  );
}
