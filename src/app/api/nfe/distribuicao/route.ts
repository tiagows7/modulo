import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  distribuirDfePorNsu,
  onlyDigitsNfe,
  padNsu,
  resolveTpAmb,
  type DistDfeResult,
} from "@modulo/nfe-distribuicao-dfe";

/**
 * API genérica de distribuição DF-e — reutilizável por este app e por outros sistemas.
 *
 * Auth (uma das opções):
 * - Authorization: Bearer <jwt Supabase>
 * - X-Nfe-Api-Key: <NFE_DISTRIBUICAO_API_KEY>
 *
 * Body JSON:
 * A) Autônomo (ideal para outros projetos):
 *    { cnpj, uf?, ultimoNsu?, pfxBase64, passphrase, tpAmb?, maxConsultas? }
 * B) Filial deste ERP:
 *    { filialId, tpAmb?, maxConsultas? }
 *
 * Não grava manifesto/estoque — só consulta SEFAZ e devolve docs + ultNsu.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const FISCAL_BUCKET = "filial-fiscal";

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

async function authorize(req: Request): Promise<{ ok: true } | { error: string }> {
  const apiKey = process.env.NFE_DISTRIBUICAO_API_KEY?.trim();
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

type Body = {
  filialId?: string;
  cnpj?: string;
  uf?: string | null;
  ultimoNsu?: string | null;
  pfxBase64?: string;
  passphrase?: string;
  tpAmb?: 1 | 2;
  maxConsultas?: number;
};

async function loadFromFilial(
  filialId: string,
): Promise<{
  cnpj: string;
  uf: string | null;
  ultimoNsu: string;
  pfx: Buffer;
  passphrase: string;
}> {
  const supabase = adminClient();
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data: filial, error } = await supabase
    .from("filial")
    .select(
      "cnpj, endereco_uf, ult_nsu, certificado_storage_path, certificado_senha",
    )
    .eq("id", filialId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!filial) throw new Error("Filial não encontrada.");

  const cnpj = onlyDigitsNfe(String(filial.cnpj || ""));
  if (cnpj.length !== 14) {
    throw new Error("CNPJ da filial inválido ou não cadastrado.");
  }

  const certPath = String(filial.certificado_storage_path || "").trim();
  const passphrase = String(filial.certificado_senha || "");
  if (!certPath) {
    throw new Error(
      "Certificado A1 não cadastrado na filial (Config NF-E / NFC-E).",
    );
  }
  if (!passphrase) {
    throw new Error("Senha do certificado não cadastrada na filial.");
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from(FISCAL_BUCKET)
    .download(certPath);
  if (dlErr || !blob) {
    throw new Error(
      dlErr?.message || "Falha ao baixar o certificado A1 do Storage.",
    );
  }

  const pfx = Buffer.from(await blob.arrayBuffer());
  if (!pfx.length) throw new Error("Certificado A1 vazio no Storage.");

  const ultimoNsu =
    filial.ult_nsu != null && String(filial.ult_nsu).trim()
      ? onlyDigitsNfe(String(filial.ult_nsu)) || "0"
      : "0";

  return {
    cnpj,
    uf: filial.endereco_uf != null ? String(filial.endereco_uf) : null,
    ultimoNsu,
    pfx,
    passphrase,
  };
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  try {
    let cnpj: string;
    let uf: string | null;
    let ultimoNsu: string;
    let pfx: Buffer;
    let passphrase: string;

    const filialId = String(body.filialId || "").trim();
    if (filialId) {
      const loaded = await loadFromFilial(filialId);
      cnpj = loaded.cnpj;
      uf = loaded.uf;
      ultimoNsu = loaded.ultimoNsu;
      pfx = loaded.pfx;
      passphrase = loaded.passphrase;
    } else {
      cnpj = onlyDigitsNfe(String(body.cnpj || ""));
      uf = body.uf != null ? String(body.uf) : null;
      ultimoNsu =
        body.ultimoNsu != null && String(body.ultimoNsu).trim()
          ? onlyDigitsNfe(String(body.ultimoNsu)) || "0"
          : "0";
      passphrase = String(body.passphrase || "");
      const b64 = String(body.pfxBase64 || "").replace(/\s+/g, "");
      if (!b64) {
        return NextResponse.json(
          {
            error:
              "Informe filialId OU (cnpj + pfxBase64 + passphrase). ultimoNsu em branco usa 0.",
          },
          { status: 400 },
        );
      }
      pfx = Buffer.from(b64, "base64");
      if (!pfx.length || !passphrase || cnpj.length !== 14) {
        return NextResponse.json(
          {
            error:
              "Para modo autônomo envie cnpj (14 dígitos), pfxBase64 e passphrase.",
          },
          { status: 400 },
        );
      }
    }

    const result: DistDfeResult = await distribuirDfePorNsu({
      cnpj,
      uf,
      ultimoNsu,
      pfx,
      passphrase,
      tpAmb: resolveTpAmb(body.tpAmb),
      maxConsultas: body.maxConsultas,
    });

    return NextResponse.json({
      ok: true,
      cnpj,
      ...result,
      ult_nsu: padNsu(result.ultNsu),
      max_nsu: padNsu(result.maxNsu),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Falha na distribuição DF-e.",
      },
      { status: 502 },
    );
  }
}

/** Health / descoberta leve (sem segredo). */
export async function GET() {
  return NextResponse.json({
    service: "nfe-distribuicao-dfe",
    version: "1.0.0",
    methods: ["POST"],
    auth: ["Bearer JWT", "X-Nfe-Api-Key"],
    modes: ["filialId", "cnpj+pfxBase64+passphrase"],
    docs: "/docs/NFE_DISTRIBUICAO_DFE.md",
  });
}
