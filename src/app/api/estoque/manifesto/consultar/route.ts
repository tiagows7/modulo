import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export type ManifestoSefazDoc = {
  chave: string;
  nsu?: string | null;
  protocolo?: string | null;
  numero?: number | null;
  emissao?: string | null;
  valor?: number | null;
  fornecedor_cnpj?: string | null;
  fornecedor_nome?: string | null;
  fornecedor_ie?: string | null;
  caminho?: string | null;
  xml?: number | null;
};

function onlyDigits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: "Não autorizado." };
  }
  const token = authHeader.substring(7);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { error: "Supabase não configurado." };

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return { error: "Token inválido ou expirado." };
  return { user };
}

function bridgeUrl() {
  return (
    process.env.NFE_DISTRIBUICAO_URL ||
    process.env.SEFAZ_DFE_URL ||
    "http://127.0.0.1:39102/nfe/distribuicao"
  );
}

async function consultarSefaz(params: {
  cnpj: string;
  uf?: string | null;
  ultimoNsu?: string | null;
}): Promise<{ docs: ManifestoSefazDoc[]; message: string }> {
  const url = bridgeUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        cnpj: params.cnpj,
        uf: params.uf || undefined,
        ultimoNsu: params.ultimoNsu || "0",
        distNSU: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        text ||
          `Ponte SEFAZ respondeu HTTP ${res.status}. Verifique o serviço de distribuição DF-e.`,
      );
    }

    const json = (await res.json()) as {
      message?: string;
      documentos?: ManifestoSefazDoc[];
      docs?: ManifestoSefazDoc[];
    };

    const docs = json.documentos ?? json.docs ?? [];
    return {
      docs: Array.isArray(docs) ? docs : [],
      message:
        json.message ||
        (docs.length
          ? `${docs.length} documento(s) retornado(s) da SEFAZ.`
          : "Consulta SEFAZ concluída sem novos documentos."),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado na consulta SEFAZ.");
    }
    if (
      err instanceof TypeError ||
      (err instanceof Error && /fetch|ECONNREFUSED|Failed/i.test(err.message))
    ) {
      throw new Error(
        "Ponte SEFAZ offline. Inicie o serviço local de distribuição DF-e (ex.: http://127.0.0.1:39102/nfe/distribuicao) para buscar notas contra o CNPJ.",
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const auth = await verifyUser(req);
  if ("error" in auth && auth.error) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const supabase = adminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase não configurado." },
      { status: 500 },
    );
  }

  let body: { filialId?: string };
  try {
    body = (await req.json()) as { filialId?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const filialId = String(body.filialId || "").trim();
  if (!filialId) {
    return NextResponse.json(
      { error: "Informe a filial para consultar a SEFAZ." },
      { status: 400 },
    );
  }

  const { data: filial, error: filErr } = await supabase
    .from("filial")
    .select("id, codigo, cnpj, razao_social, fantasia, endereco_uf")
    .eq("id", filialId)
    .maybeSingle();

  if (filErr) {
    return NextResponse.json({ error: filErr.message }, { status: 500 });
  }
  if (!filial) {
    return NextResponse.json({ error: "Filial não encontrada." }, { status: 404 });
  }

  const cnpj = onlyDigits(String(filial.cnpj || ""));
  if (cnpj.length !== 14) {
    return NextResponse.json(
      {
        error:
          "CNPJ da filial inválido ou não cadastrado. Atualize o cadastro da filial antes de consultar a SEFAZ.",
      },
      { status: 400 },
    );
  }

  const { data: lastNsuRow } = await supabase
    .from("nota_entradamanifesto")
    .select("nsu")
    .eq("filial", filialId)
    .not("nsu", "is", null)
    .order("manifesto_registro", { ascending: false })
    .limit(1)
    .maybeSingle();

  let sefaz;
  try {
    sefaz = await consultarSefaz({
      cnpj,
      uf: filial.endereco_uf != null ? String(filial.endereco_uf) : null,
      ultimoNsu: lastNsuRow?.nsu != null ? String(lastNsuRow.nsu) : "0",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Falha na consulta SEFAZ.",
        cnpj,
        upserted: 0,
      },
      { status: 502 },
    );
  }

  const { data: fornecedores } = await supabase
    .from("fornecedores")
    .select("id, cnpj")
    .eq("status", "ativo");

  const fornByCnpj = new Map<string, string>();
  for (const f of fornecedores ?? []) {
    const dig = onlyDigits(String(f.cnpj || ""));
    if (dig) fornByCnpj.set(dig, String(f.id));
  }

  let upserted = 0;
  const now = new Date().toISOString();

  for (const doc of sefaz.docs) {
    const chave = onlyDigits(String(doc.chave || ""));
    if (chave.length !== 44) continue;

    const fornCnpj = onlyDigits(String(doc.fornecedor_cnpj || ""));
    const payload = {
      filial: filialId,
      chave,
      fornecedor: fornCnpj ? fornByCnpj.get(fornCnpj) ?? null : null,
      fornecedor_nome: doc.fornecedor_nome
        ? String(doc.fornecedor_nome).slice(0, 120)
        : null,
      fornecedor_cnpj: fornCnpj || null,
      fornecedor_ie: doc.fornecedor_ie
        ? String(doc.fornecedor_ie).slice(0, 14)
        : null,
      emissao: doc.emissao ? String(doc.emissao).slice(0, 10) : null,
      numero: doc.numero != null ? Number(doc.numero) || null : null,
      valor: Number(doc.valor) || 0,
      caminho: doc.caminho ? String(doc.caminho).slice(0, 350) : null,
      manifesto_registro: now,
      manifesto_protocolo: doc.protocolo
        ? String(doc.protocolo).slice(0, 40)
        : null,
      nsu: doc.nsu != null ? String(doc.nsu).slice(0, 30) : null,
      xml: doc.xml != null ? Number(doc.xml) || 0 : 1,
    };

    const { error } = await supabase
      .from("nota_entradamanifesto")
      .upsert(payload, { onConflict: "chave" });

    if (!error) upserted += 1;
  }

  return NextResponse.json({
    ok: true,
    cnpj,
    recebidos: sefaz.docs.length,
    upserted,
    message: sefaz.message,
  });
}
