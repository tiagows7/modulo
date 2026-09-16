import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  emitirNfce,
  montarReceitasFromPayments,
  onlyDigits,
  type EmitirNfceInput,
  type TransmitEmitente,
  type TransmitItem,
  type TransmitirVendaInput,
} from "@modulo/nfe-transmissao";
import { assertValidPfx } from "@/lib/nfe/assertValidPfx";
import { tipoEmpresaToCrt } from "@/lib/filialTipoEmpresa";

/**
 * API genérica de transmissão NFC-e — reutilizável por este app e por outros sistemas.
 *
 * Auth (uma das opções):
 * - Authorization: Bearer <jwt Supabase>
 * - X-Nfe-Api-Key: <NFE_TRANSMISSAO_API_KEY ou NFE_DISTRIBUICAO_API_KEY>
 *
 * Body JSON:
 * A) Autônomo (ideal para outros projetos):
 *    { pfxBase64, passphrase, saleRef, items, payments, emitente, buyer?, ambiente?, ... }
 * B) Filial deste ERP:
 *    { filialId, saleRef, items, payments, buyer?, ambiente?, ... }
 *
 * Não grava venda/receitas — só autoriza na SEFAZ e devolve document + receitas.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const FISCAL_BUCKET = "filial-fiscal";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
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

async function authorize(
  req: Request,
): Promise<{ ok: true } | { error: string }> {
  const apiKey = (
    process.env.NFE_TRANSMISSAO_API_KEY ||
    process.env.NFE_DISTRIBUICAO_API_KEY ||
    ""
  ).trim();
  const headerKey = req.headers.get("X-Nfe-Api-Key")?.trim();
  if (apiKey && headerKey && headerKey === apiKey) {
    return { ok: true };
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      error:
        "Não autorizado. Envie Bearer (usuário) ou X-Nfe-Api-Key (integração).",
    };
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
  return { ok: true };
}

type Body = TransmitirVendaInput & {
  filialId?: string | null;
  pfxBase64?: string;
  passphrase?: string;
  tpAmb?: 1 | 2;
};

async function loadEmitenteFromFilial(filialId: string): Promise<{
  emitente: TransmitEmitente;
  pfx: Buffer;
  passphrase: string;
  ambiente: 1 | 2;
}> {
  const supabase = adminClient();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data: filial, error } = await supabase
    .from("filial")
    .select(
      "id, cnpj, razao_social, fantasia, inscricao_estadual, endereco, endereco_numero, endereco_bairro, endereco_uf, endereco_cidade, cep, telefone, certificado_storage_path, certificado_senha, token_id, token_nfce, ambiente_nfce, tipo_empresa",
    )
    .eq("id", filialId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!filial) throw new Error("Filial não encontrada.");

  const certPath = String(filial.certificado_storage_path || "").trim();
  const passphrase = String(filial.certificado_senha || "");
  if (!certPath) {
    throw new Error("Certificado A1 não cadastrado na filial.");
  }
  if (!passphrase) {
    throw new Error("Senha do certificado não cadastrada na filial.");
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(FISCAL_BUCKET)
    .download(certPath);
  if (dlErr || !blob) {
    throw new Error(
      dlErr?.message || "Não foi possível baixar o certificado A1.",
    );
  }
  const pfx = Buffer.from(await blob.arrayBuffer());
  assertValidPfx(pfx, passphrase);

  const municipioIbge =
    filial.endereco_cidade != null
      ? onlyDigits(String(filial.endereco_cidade)).padStart(7, "0")
      : "";

  return {
    pfx,
    passphrase,
    ambiente: Number(filial.ambiente_nfce) === 1 ? 1 : 2,
    emitente: {
      cnpj: String(filial.cnpj || ""),
      ie: filial.inscricao_estadual,
      razaoSocial: filial.razao_social,
      fantasia: filial.fantasia,
      uf: filial.endereco_uf,
      municipioIbge,
      endereco: filial.endereco,
      numero: filial.endereco_numero,
      bairro: filial.endereco_bairro,
      cep: filial.cep,
      telefone: filial.telefone,
      tokenId: filial.token_id != null ? String(filial.token_id) : null,
      tokenNfce: filial.token_nfce != null ? String(filial.token_nfce) : null,
      crt: tipoEmpresaToCrt(
        filial.tipo_empresa != null ? String(filial.tipo_empresa) : null,
      ),
    },
  };
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if ("error" in auth) return jsonError(auth.error, 401);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("JSON inválido.", 400);
  }

  if (!Array.isArray(body.items) || !body.items.length) {
    return jsonError("Informe ao menos um item em items[].", 400);
  }
  if (!body.saleRef) {
    return jsonError("Informe saleRef.", 400);
  }

  try {
    let pfx: Buffer;
    let passphrase: string;
    let emitente: TransmitEmitente;
    let ambiente: 1 | 2 = body.tpAmb ?? body.ambiente ?? 2;

    if (body.pfxBase64 && body.passphrase) {
      pfx = Buffer.from(body.pfxBase64.replace(/\s+/g, ""), "base64");
      passphrase = body.passphrase;
      assertValidPfx(pfx, passphrase);
      if (!body.emitente?.cnpj) {
        return jsonError(
          "No modo autônomo, informe emitente (cnpj, ie, municipioIbge, uf, tokenId, tokenNfce).",
          400,
        );
      }
      emitente = body.emitente;
    } else if (body.filialId) {
      const loaded = await loadEmitenteFromFilial(String(body.filialId));
      pfx = loaded.pfx;
      passphrase = loaded.passphrase;
      emitente = { ...loaded.emitente, ...body.emitente };
      if (body.tpAmb == null && body.ambiente == null) {
        ambiente = loaded.ambiente;
      }
    } else {
      return jsonError(
        "Informe pfxBase64+passphrase+emitente (modo autônomo) ou filialId (ERP).",
        400,
      );
    }

    const input: EmitirNfceInput = {
      pfx,
      passphrase,
      tpAmb: ambiente,
      saleRef: body.saleRef,
      items: body.items as TransmitItem[],
      payments: Array.isArray(body.payments) ? body.payments : [],
      buyer: body.buyer,
      total: body.total,
      numero: body.numero,
      serie: body.serie,
      operator: body.operator,
      pdvCodigo: body.pdvCodigo,
      filialId: body.filialId,
      emitente,
      ambiente,
    };

    const result = await emitirNfce(input);
    const receitas =
      result.receitas?.length > 0
        ? result.receitas
        : montarReceitasFromPayments(
            result.document.payments,
            result.document.saleRef,
          );

    return NextResponse.json({
      document: result.document,
      receitas,
      message: result.message,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha na transmissão NFC-e.";
    const doc =
      err && typeof err === "object" && "document" in err
        ? (err as { document?: unknown }).document
        : undefined;
    return jsonError(message, 502, doc ? { document: doc } : undefined);
  }
}
