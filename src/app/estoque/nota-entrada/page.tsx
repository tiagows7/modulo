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
import { parseNfeXml } from "@/lib/nfe/parseNfeXml";
import { classificarItensXml } from "@/lib/nfe/xmlProdutoVinculo";

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
  situacao: string;
  observacao: string | null;
  emit_razao_social: string | null;
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
  situacao: string;
  observacao: string;
};

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
  v_nf: "0",
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
    v_un_com: "0",
    v_prod: "0",
  };
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

function formatMoney(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseMoney(raw: string) {
  const s = String(raw).trim();
  if (!s) return 0;
  if (s.includes(",")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(s) || 0;
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

function NotaEntradaCadastroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const manifestoParam = searchParams.get("manifesto");
  const manualParam = searchParams.get("manual");
  const { busy, pesquisar, gravar } = useDbStatus();
  const [filiais, setFiliais] = useState<FilialOpt[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorOpt[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [items, setItems] = useState<NotaEntrada[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NotaEntrada | null>(null);
  const [deleting, setDeleting] = useState<NotaEntrada | null>(null);
  const [form, setForm] = useState<NotaForm>(emptyForm);
  const [formItems, setFormItems] = useState<ItemForm[]>([emptyItem()]);
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
        .select("id, codigo, descricao, codigo_barras")
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
      (prodRes.data ?? []).map((p) => ({
        id: String(p.id),
        codigo: String(p.codigo ?? ""),
        descricao: String(p.descricao ?? ""),
        codigo_barras:
          p.codigo_barras != null ? String(p.codigo_barras) : null,
      })),
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
          v_prod, v_nf, situacao, observacao, emit_razao_social
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
        (data ?? []).map((row) => ({
          id: String(row.id),
          filial: row.filial != null ? String(row.filial) : null,
          fornecedor: row.fornecedor != null ? String(row.fornecedor) : null,
          chave: row.chave != null ? String(row.chave) : null,
          numero: Number(row.numero) || 0,
          serie: String(row.serie ?? "1"),
          modelo: String(row.modelo ?? "55"),
          natureza_operacao:
            row.natureza_operacao != null
              ? String(row.natureza_operacao)
              : null,
          data_emissao:
            row.data_emissao != null ? String(row.data_emissao) : null,
          data_entrada:
            row.data_entrada != null ? String(row.data_entrada) : null,
          v_prod: Number(row.v_prod) || 0,
          v_nf: Number(row.v_nf) || 0,
          situacao: String(row.situacao || "pendente"),
          observacao: row.observacao != null ? String(row.observacao) : null,
          emit_razao_social:
            row.emit_razao_social != null
              ? String(row.emit_razao_social)
              : null,
        })),
      );
    });
  }, [pesquisar]);

  useEffect(() => {
    void loadLookups();
    void loadData();
  }, [loadLookups, loadData]);

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
            v_prod, v_nf, situacao, observacao, emit_razao_social
          `,
          )
          .eq("id", data.nota_compra)
          .maybeSingle();
        if (cancelled || !nota) return;
        await openEdit({
          id: String(nota.id),
          filial: nota.filial != null ? String(nota.filial) : null,
          fornecedor: nota.fornecedor != null ? String(nota.fornecedor) : null,
          chave: nota.chave != null ? String(nota.chave) : null,
          numero: Number(nota.numero) || 0,
          serie: String(nota.serie ?? "1"),
          modelo: String(nota.modelo ?? "55"),
          natureza_operacao:
            nota.natureza_operacao != null
              ? String(nota.natureza_operacao)
              : null,
          data_emissao:
            nota.data_emissao != null ? String(nota.data_emissao) : null,
          data_entrada:
            nota.data_entrada != null ? String(nota.data_entrada) : null,
          v_prod: Number(nota.v_prod) || 0,
          v_nf: Number(nota.v_nf) || 0,
          situacao: String(nota.situacao || "pendente"),
          observacao: nota.observacao != null ? String(nota.observacao) : null,
          emit_razao_social:
            nota.emit_razao_social != null
              ? String(nota.emit_razao_social)
              : null,
        });
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

          setManifestoId(String(data.id));
          setEditing(null);
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
            v_nf: String(Number(data.valor) || parsed.valor || 0),
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
              return {
                key: `xml-${item.n_item}-${item.c_prod}`,
                produto_id: prodId,
                c_prod: item.c_prod || "",
                c_ean: item.c_ean || "",
                x_prod: prod?.descricao || item.x_prod || "",
                ncm: item.ncm || "",
                cfop: item.cfop || "",
                u_com: item.u_com || "UN",
                q_com: String(item.q_com || 0),
                v_un_com: String(item.v_un_com || 0),
                v_prod: String(item.v_prod || 0),
              };
            }),
          );
          setFormError("");
          setModalOpen(true);
          return;
        } catch {
          // segue fluxo manual sem itens
        }
      }

      setManifestoId(String(data.id));
      setEditing(null);
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
        v_nf: String(Number(data.valor) || 0),
        situacao: "pendente",
      });
      setFormItems([emptyItem()]);
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
          next.v_prod = String(round2(q * vu));
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
    setForm({
      ...emptyForm,
      filial: filiais.length === 1 ? filiais[0].id : "",
      data_emissao: today,
      data_entrada: today,
    });
    setFormItems([emptyItem()]);
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
    setForm({
      filial: item.filial ?? "",
      fornecedor: item.fornecedor ?? "",
      numero: String(item.numero || ""),
      serie: item.serie || "1",
      modelo: item.modelo || "55",
      chave: item.chave ?? "",
      natureza_operacao: item.natureza_operacao ?? "",
      data_emissao: toDateInput(item.data_emissao),
      data_entrada: toDateInput(item.data_entrada),
      v_nf: String(item.v_nf ?? 0),
      situacao: item.situacao || "pendente",
      observacao: item.observacao ?? "",
    });
    setFormError("");
    setActionError("");
    setModalOpen(true);

    const { data, error } = await supabase
      .from("nota_entradaprodutos")
      .select(
        "id, nota_entrada, produto, n_item, c_prod, c_ean, x_prod, ncm, cfop, u_com, q_com, v_un_com, v_prod",
      )
      .eq("nota_entrada", item.id)
      .order("n_item", { ascending: true });

    if (error) {
      setFormError(error.message);
      setFormItems([emptyItem()]);
      return;
    }

    const rows = (data ?? []) as NotaItem[];
    if (!rows.length) {
      setFormItems([emptyItem()]);
      return;
    }

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
        q_com: String(r.q_com ?? 0),
        v_un_com: String(r.v_un_com ?? 0),
        v_prod: String(r.v_prod ?? 0),
      })),
    );
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
    setFormError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const numero = Number(String(form.numero).trim());
    if (!Number.isFinite(numero) || numero <= 0) {
      setFormError("Informe o número da nota.");
      return;
    }
    if (!form.filial) {
      setFormError("Selecione a filial.");
      return;
    }
    if (!form.fornecedor) {
      setFormError("Selecione o fornecedor.");
      return;
    }

    const linhas = formItems
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => row.x_prod.trim() || row.produto_id);

    for (const { row, idx } of linhas) {
      if (!row.x_prod.trim()) {
        setFormError(`Informe a descrição do item ${idx + 1}.`);
        return;
      }
      if (parseMoney(row.q_com) <= 0) {
        setFormError(`Quantidade inválida no item ${idx + 1}.`);
        return;
      }
    }

    const forn = fornecedorById.get(form.fornecedor);
    const totalItens = round2(
      linhas.reduce((acc, { row }) => acc + parseMoney(row.v_prod), 0),
    );
    const vNf = form.v_nf.trim()
      ? parseMoney(form.v_nf)
      : totalItens;

    const chave = form.chave.replace(/\D/g, "").trim() || null;
    if (chave && chave.length !== 44) {
      setFormError("A chave da NF-e deve ter 44 dígitos (ou ficar em branco).");
      return;
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
      situacao: form.situacao || "pendente",
      observacao: form.observacao.trim() || null,
      emit_cnpj: forn?.cnpj ? forn.cnpj.replace(/\D/g, "") : null,
      emit_razao_social: forn?.razao_social ?? null,
      emit_fantasia: forn?.fantasia ?? null,
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
          }));

          const { error: itErr } = await supabase
            .from("nota_entradaprodutos")
            .insert(payload);
          if (itErr) throw new Error(itErr.message);
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
      setForm(emptyForm);
      setFormItems([emptyItem()]);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao gravar.");
    }
  };

  const rows = items.map((item) => {
    const fil = item.filial ? filialById.get(item.filial) : null;
    const forn = item.fornecedor ? fornecedorById.get(item.fornecedor) : null;
    const fornLabel =
      forn != null
        ? fornecedorLabel(forn)
        : item.emit_razao_social?.trim() || "—";

    return {
      numero: String(item.numero),
      serie: item.serie,
      fornecedor: fornLabel,
      filial: fil ? filialLabel(fil) : "—",
      emissao: formatDateBr(item.data_emissao),
      entrada: formatDateBr(item.data_entrada),
      valor: formatMoney(item.v_nf),
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
          width={920}
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

            <CadastroField label="Fornecedor *" htmlFor="ne-fornecedor" span={2}>
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
                onChange={(e) => updateForm("v_nf", e.target.value)}
                disabled={busy}
                placeholder={String(totalItensPreview)}
              />
            </CadastroField>

            <CadastroField label="Natureza da operação" htmlFor="ne-nat" span={2}>
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

            <CadastroField label="Chave NF-e (44 dígitos)" htmlFor="ne-chave" span="full">
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

                  <CadastroField label="Cód. fornecedor" htmlFor={`ne-cprod-${row.key}`}>
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

                  <CadastroField label="CFOP" htmlFor={`ne-cfop-${row.key}`}>
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
                        updateItem(row.key, { q_com: e.target.value })
                      }
                      disabled={busy}
                    />
                  </CadastroField>

                  <CadastroField label="Vl. unit. *" htmlFor={`ne-vu-${row.key}`}>
                    <input
                      id={`ne-vu-${row.key}`}
                      className="input-base input-compact"
                      inputMode="decimal"
                      value={row.v_un_com}
                      onChange={(e) =>
                        updateItem(row.key, { v_un_com: e.target.value })
                      }
                      disabled={busy}
                    />
                  </CadastroField>

                  <CadastroField label="Total" htmlFor={`ne-vt-${row.key}`}>
                    <input
                      id={`ne-vt-${row.key}`}
                      className="input-base input-compact"
                      inputMode="decimal"
                      value={row.v_prod}
                      onChange={(e) =>
                        updateItem(row.key, { v_prod: e.target.value })
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
            Total dos itens: <strong>{formatMoney(totalItensPreview)}</strong>
          </div>

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
