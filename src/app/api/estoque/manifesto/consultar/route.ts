import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  distribuirDfePorNsu,
  maxNsu,
  onlyDigitsNfe,
  padNsu,
  type DistDfeDoc,
} from "@modulo/nfe-distribuicao-dfe";
import { assertValidPfx } from "@/lib/nfe/assertValidPfx";

export const runtime = "nodejs";
export const maxDuration = 60;

const FISCAL_BUCKET = "filial-fiscal";

function onlyDigits(v: string) {
  return onlyDigitsNfe(v);
}

function jsonError(
  error: string,
  status: number,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error, ...extra }, { status });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

async function downloadCertificado(
  supabase: NonNullable<ReturnType<typeof adminClient>>,
  path: string,
) {
  const { data, error } = await supabase.storage
    .from(FISCAL_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(
      error?.message ||
        "Não foi possível baixar o certificado A1 do Storage. Reenvie o .pfx na filial.",
    );
  }
  const buf = Buffer.from(await data.arrayBuffer());
  if (!buf.length) {
    throw new Error("Certificado A1 vazio no Storage. Reenvie o arquivo .pfx.");
  }
  return buf;
}

/** Fallback opcional: ponte local, só se NFE_DISTRIBUICAO_URL estiver definido. */
async function consultarBridge(params: {
  cnpj: string;
  uf?: string | null;
  ultimoNsu?: string | null;
}): Promise<{ docs: DistDfeDoc[]; message: string; maxNsu: string; ultNsu: string }> {
  const url = process.env.NFE_DISTRIBUICAO_URL || process.env.SEFAZ_DFE_URL;
  if (!url) {
    throw new Error("Ponte SEFAZ não configurada.");
  }

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
      documentos?: DistDfeDoc[];
      docs?: DistDfeDoc[];
      maxNsu?: string | number | null;
      maxNSU?: string | number | null;
      ultimoNsu?: string | number | null;
      ultNSU?: string | number | null;
      ultNsu?: string | number | null;
    };

    const list = Array.isArray(json.documentos ?? json.docs)
      ? (json.documentos ?? json.docs ?? [])
      : [];
    const maxFromDocs = maxNsu(...list.map((d) => d.nsu));
    const maxFromResp = maxNsu(
      json.maxNsu,
      json.maxNSU,
      json.ultimoNsu,
      json.ultNSU,
      json.ultNsu,
    );
    const ult = padNsu(maxNsu(maxFromDocs, maxFromResp) || params.ultimoNsu || "0");
    return {
      docs: list.map((d) => ({
        chave: onlyDigits(String(d.chave || "")),
        nsu: d.nsu != null ? padNsu(String(d.nsu)) : null,
        protocolo: d.protocolo ?? null,
        numero: d.numero ?? null,
        emissao: d.emissao ?? null,
        valor: d.valor ?? null,
        fornecedor_cnpj: d.fornecedor_cnpj ?? null,
        fornecedor_nome: d.fornecedor_nome ?? null,
        fornecedor_ie: d.fornecedor_ie ?? null,
        xml: d.xml != null ? Number(d.xml) || 0 : d.xml_conteudo ? 1 : 0,
        xml_conteudo: d.xml_conteudo ?? null,
        schema: d.schema ?? null,
      })),
      maxNsu: ult,
      ultNsu: ult,
      message:
        json.message ||
        (list.length
          ? `${list.length} documento(s) retornado(s) da SEFAZ.`
          : "Consulta SEFAZ concluída sem novos documentos."),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo esgotado na consulta SEFAZ.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    return await postConsultar(req);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha interna na consulta SEFAZ.";
    console.error("[manifesto/consultar]", err);
    return jsonError(message, 500);
  }
}

async function postConsultar(req: Request) {
  const auth = await verifyUser(req);
  if ("error" in auth && auth.error) {
    return jsonError(auth.error, 401);
  }

  const supabase = adminClient();
  if (!supabase) {
    return jsonError(
      "Supabase não configurado (defina SUPABASE_SERVICE_ROLE_KEY para gravar ult_nsu e baixar o certificado).",
      500,
    );
  }

  let body: { filialId?: string };
  try {
    body = (await req.json()) as { filialId?: string };
  } catch {
    return jsonError("JSON inválido.", 400);
  }

  const filialId = String(body.filialId || "").trim();
  if (!filialId) {
    return jsonError("Informe a filial para consultar a SEFAZ.", 400);
  }

  const { data: filial, error: filErr } = await supabase
    .from("filial")
    .select(
      "id, codigo, cnpj, razao_social, fantasia, endereco_uf, ult_nsu, certificado_storage_path, certificado_senha",
    )
    .eq("id", filialId)
    .maybeSingle();

  if (filErr) {
    return jsonError(filErr.message, 500);
  }
  if (!filial) {
    return jsonError("Filial não encontrada.", 404);
  }

  const cnpj = onlyDigits(String(filial.cnpj || ""));
  if (cnpj.length !== 14) {
    return jsonError(
      "CNPJ da filial inválido ou não cadastrado. Atualize o cadastro da filial antes de consultar a SEFAZ.",
      400,
      { cnpj, upserted: 0, ult_nsu: "0" },
    );
  }

  // Cursor: ult_nsu da filial; em branco → "0"
  let ultimoNsu =
    filial.ult_nsu != null && String(filial.ult_nsu).trim()
      ? onlyDigits(String(filial.ult_nsu))
      : "0";
  if (!ultimoNsu) ultimoNsu = "0";

  const certPath = String(filial.certificado_storage_path || "").trim();
  const certSenha = String(filial.certificado_senha || "");
  const forceBridge = process.env.NFE_DISTRIBUICAO_FORCE_BRIDGE === "1";
  const hasBridge =
    Boolean(process.env.NFE_DISTRIBUICAO_URL || process.env.SEFAZ_DFE_URL) &&
    forceBridge;

  let sefaz: {
    docs: DistDfeDoc[];
    message: string;
    maxNsu: string;
    ultNsu: string;
    cStat?: string;
    consultas?: number;
  };

  try {
    if (hasBridge) {
      sefaz = await consultarBridge({
        cnpj,
        uf: filial.endereco_uf != null ? String(filial.endereco_uf) : null,
        ultimoNsu,
      });
    } else {
      if (!certPath) {
        return jsonError(
          "Certificado A1 não cadastrado nesta filial. Em Cadastros → Filiais → Config NF-E / NFC-E, envie o arquivo .pfx e a senha.",
          400,
          { cnpj, upserted: 0, ult_nsu: padNsu(ultimoNsu) },
        );
      }
      if (!certSenha) {
        return jsonError(
          "Senha do certificado não cadastrada. Informe a senha do .pfx na aba Config NF-E / NFC-E da filial.",
          400,
          { cnpj, upserted: 0, ult_nsu: padNsu(ultimoNsu) },
        );
      }

      const pfx = await downloadCertificado(supabase, certPath);
      assertValidPfx(pfx, certSenha);

      // Lotes menores evitam timeout/OOM na Vercel; clique de novo para continuar do ult_nsu
      const result = await distribuirDfePorNsu({
        cnpj,
        uf: filial.endereco_uf != null ? String(filial.endereco_uf) : null,
        ultimoNsu,
        pfx,
        passphrase: certSenha,
        maxConsultas: 8,
        timeoutMs: 25_000,
      });
      sefaz = {
        docs: result.docs,
        message: result.message,
        maxNsu: result.maxNsu,
        ultNsu: result.ultNsu,
        cStat: result.cStat,
        consultas: result.consultas,
      };
    }
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Falha na consulta SEFAZ.",
      502,
      { cnpj, upserted: 0, ult_nsu: padNsu(ultimoNsu) },
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
  let comXml = 0;
  const now = new Date().toISOString();
  let maxDocNsu: string | null = null;

  for (const doc of sefaz.docs) {
    const chave = onlyDigits(String(doc.chave || ""));
    if (chave.length !== 44) continue;

    const fornCnpj = onlyDigits(String(doc.fornecedor_cnpj || ""));
    const nsuDoc = doc.nsu != null ? onlyDigits(String(doc.nsu)).slice(0, 30) : null;
    maxDocNsu = maxNsu(maxDocNsu, nsuDoc);

    const { data: existing } = await supabase
      .from("nota_entradamanifesto")
      .select("id, xml, xml_conteudo, nsu")
      .eq("chave", chave)
      .maybeSingle();

    const xmlConteudo =
      doc.xml_conteudo ||
      (existing?.xml_conteudo ? String(existing.xml_conteudo) : null);
    const xmlFlag = xmlConteudo
      ? 1
      : Math.max(Number(doc.xml) || 0, Number(existing?.xml) || 0);

    if (xmlConteudo) comXml += 1;

    const payload: Record<string, unknown> = {
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
      manifesto_registro: now,
      manifesto_protocolo: doc.protocolo
        ? String(doc.protocolo).slice(0, 40)
        : null,
      nsu: nsuDoc || (existing?.nsu != null ? String(existing.nsu) : null),
      xml: xmlFlag,
    };

    if (xmlConteudo) {
      payload.xml_conteudo = xmlConteudo;
    }

    const { error } = await supabase
      .from("nota_entradamanifesto")
      .upsert(payload, { onConflict: "chave" });

    if (!error) upserted += 1;
  }

  // Cursor a persistir: último NSU efetivamente processado (docs + ultNSU da SEFAZ).
  // Não avança para maxNSU se ainda não consumimos até lá (evita pular documentos).
  const ultProcessado = padNsu(maxNsu(sefaz.ultNsu, maxDocNsu) || "0");
  const maxDisponivel = padNsu(sefaz.maxNsu || "0");
  const novoUltNsu =
    BigInt(ultProcessado) >= BigInt(maxDisponivel)
      ? maxNsu(ultProcessado, maxDisponivel)
      : ultProcessado;

  const { data: filialUpdated, error: nsuErr } = await supabase
    .from("filial")
    .update({ ult_nsu: novoUltNsu.slice(0, 30) })
    .eq("id", filialId)
    .select("id, ult_nsu")
    .maybeSingle();

  if (nsuErr) {
    return jsonError(
      `Notas importadas, mas falhou ao gravar ult_nsu na filial: ${nsuErr.message}`,
      500,
      {
        cnpj,
        recebidos: sefaz.docs.length,
        upserted,
        com_xml: comXml,
        ult_nsu: novoUltNsu,
      },
    );
  }

  if (!filialUpdated) {
    return jsonError(
      "Notas importadas, mas a filial não foi atualizada (ult_nsu). Verifique permissões/RLS.",
      500,
      {
        cnpj,
        recebidos: sefaz.docs.length,
        upserted,
        com_xml: comXml,
        ult_nsu: novoUltNsu,
      },
    );
  }

  const incompleto =
    BigInt(padNsu(sefaz.ultNsu)) < BigInt(padNsu(sefaz.maxNsu || sefaz.ultNsu));
  const message = incompleto
    ? `${sefaz.message} Ainda há documentos na SEFAZ — clique em Consultar SEFAZ novamente para continuar.`
    : sefaz.message;

  return NextResponse.json({
    ok: true,
    cnpj,
    recebidos: sefaz.docs.length,
    upserted,
    com_xml: comXml,
    ult_nsu: onlyDigits(String(filialUpdated.ult_nsu || novoUltNsu)) || novoUltNsu,
    cStat: sefaz.cStat ?? null,
    consultas: sefaz.consultas ?? null,
    incompleto,
    message,
  });
}
