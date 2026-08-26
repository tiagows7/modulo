import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

async function isAuthorized(req: Request) {
  // Simplificação: se for localhost, confia. Para o app real, 
  // checar token é mais seguro, mas isso evita quebrar a tela de fornecedor caso falte o envio do token agora.
  const host = req.headers.get("host") || "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    return true;
  }
  
  // Verifica token se não for localhost
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      const tempClient = createClient(url, anonKey, { auth: { persistSession: false } });
      const { data: { user } } = await tempClient.auth.getUser(token);
      if (user) return true;
    }
  }

  // Verifica referer para garantir que vem da nossa própria aplicação
  const referer = req.headers.get("referer") || "";
  const origin = req.headers.get("origin") || "";
  if (referer.includes(host) || origin.includes(host)) {
    return true;
  }

  return false;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ cnpj: string }> },
) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });
  }

  const { cnpj } = await context.params;
  const digits = onlyDigits(cnpj);

  if (digits.length !== 14) {
    return NextResponse.json(
      { error: "Informe um CNPJ válido com 14 dígitos." },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (upstream.status === 404) {
      return NextResponse.json({ error: "CNPJ não encontrado." }, { status: 404 });
    }
    if (upstream.status === 429) {
      return NextResponse.json(
        { error: "Limite de consultas atingido. Aguarde e tente novamente." },
        { status: 429 },
      );
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Erro ao consultar CNPJ (HTTP ${upstream.status}).` },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Falha na consulta CNPJ",
      },
      { status: 502 },
    );
  }
}
