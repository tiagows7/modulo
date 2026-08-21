import { NextResponse } from "next/server";

export const runtime = "nodejs";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ cnpj: string }> },
) {
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
