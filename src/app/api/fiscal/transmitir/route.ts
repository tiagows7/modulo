import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  createSefazTransmitter,
  montarReceitasFromPayments,
  type TransmitirVendaInput,
} from "@modulo/nfe-transmissao";
import { assertValidPfx } from "@/lib/nfe/assertValidPfx";
import { tipoEmpresaToCrt } from "@/lib/filialTipoEmpresa";
import {
  aplicarImpostoNoItem,
  type ImpostoProduto,
} from "@/components/barrapdv/services/fiscal/impostosProduto";

export const runtime = "nodejs";
export const maxDuration = 60;

const FISCAL_BUCKET = "filial-fiscal";

function jsonError(error: string, status: number, extra?: Record<string, unknown>) {
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

/**
 * POST /api/fiscal/transmitir
 * Emite NFC-e na SEFAZ com o certificado A1 da filial do operador.
 */
export async function POST(req: Request) {
  const auth = await verifyUser(req);
  if ("error" in auth && auth.error) {
    return jsonError(auth.error, 401);
  }

  const admin = adminClient();
  if (!admin) {
    return jsonError(
      "SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.",
      500,
    );
  }

  let body: TransmitirVendaInput & {
    filialId?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("JSON inválido.", 400);
  }

  const user = auth.user!;
  const filialId =
    String(body.filialId || user.user_metadata?.filial || "").trim() || null;
  if (!filialId) {
    return jsonError(
      "Operador sem filial. Cadastre a filial no usuário.",
      400,
    );
  }

  const { data: filial, error: filialError } = await admin
    .from("filial")
    .select(
      "id, cnpj, razao_social, fantasia, inscricao_estadual, endereco, endereco_numero, endereco_bairro, endereco_uf, endereco_cidade, cep, telefone, certificado_storage_path, certificado_senha, token_id, token_nfce, ambiente_nfce, ambiente_nfe, tipo_empresa",
    )
    .eq("id", filialId)
    .maybeSingle();

  if (filialError || !filial) {
    return jsonError(
      filialError?.message || "Filial não encontrada.",
      404,
    );
  }

  if (!filial.certificado_storage_path || !filial.certificado_senha) {
    return jsonError(
      "Filial sem certificado A1. Envie o .pfx e a senha no cadastro da filial.",
      400,
    );
  }

  try {
    const pfx = await downloadCertificado(
      admin,
      String(filial.certificado_storage_path),
    );
    assertValidPfx(pfx, String(filial.certificado_senha));

    const municipioDigits = String(filial.endereco_cidade ?? "").replace(
      /\D/g,
      "",
    );
    if (municipioDigits.length !== 7) {
      return jsonError(
        "Cidade da filial sem código IBGE válido (7 dígitos). Abra Cadastros → Filiais e selecione a cidade novamente.",
        400,
      );
    }

    const ufFilial = String(filial.endereco_uf || "")
      .trim()
      .toUpperCase();
    const { data: cidadeRow } = await admin
      .from("cidades")
      .select("codigo, descricao, uf")
      .eq("codigo", municipioDigits)
      .maybeSingle();
    if (!cidadeRow) {
      return jsonError(
        `Código IBGE ${municipioDigits} não encontrado na tabela de cidades. Selecione novamente a cidade da filial.`,
        400,
      );
    }
    if (
      ufFilial &&
      cidadeRow.uf &&
      String(cidadeRow.uf).toUpperCase() !== ufFilial
    ) {
      return jsonError(
        `Cidade IBGE ${municipioDigits} (${cidadeRow.descricao}) é de ${cidadeRow.uf}, mas a UF da filial é ${ufFilial}.`,
        400,
      );
    }
    const municipioIbge = String(cidadeRow.codigo).replace(/\D/g, "");
    const cidadeNome =
      (body.emitente?.cidade != null
        ? String(body.emitente.cidade).trim()
        : "") ||
      (cidadeRow.descricao != null ? String(cidadeRow.descricao).trim() : "");

    const crt = tipoEmpresaToCrt(
      filial.tipo_empresa != null ? String(filial.tipo_empresa) : null,
    );

    // Enriquece itens com impostos do cadastro (se ainda não vieram do PDV)
    let items = Array.isArray(body.items) ? [...body.items] : [];
    try {
      const ids = items
        .map((i) => String(i.id || "").trim())
        .filter(Boolean);
      if (ids.length) {
        const { data: prods } = await admin
          .from("produtos")
          .select(
            `
            id,
            codigo_barras,
            aliquota_monofasica,
            produto_ncm ( ibpt_ncm, ibpt_aliq_nac, ibpt_aliq_est ),
            produto_cfop ( codigo ),
            produto_cest ( codigo ),
            produto_anp ( codigo, descricao ),
            categorias_icm (
              csosn, cst_icms, aliquota_estado, percentual_reduzido, cfop_estado
            ),
            produto_piscofins ( codigo, percentual_pis, percentual_cofins ),
            produto_ibscbs_cst (
              cst, ind_gibscbs, ind_gibscbsmono, ind_gred
            ),
            produto_ibscbs_classtrib (
              codigo, red_ibs, red_cbs
            )
          `,
          )
          .in("id", ids);

        const map = new Map<string, ImpostoProduto>();
        for (const row of prods ?? []) {
          const r = row as Record<string, unknown>;
          const one = <T,>(v: T | T[] | null | undefined): T | null =>
            v == null ? null : Array.isArray(v) ? v[0] ?? null : v;
          const ncmRel = one(r.produto_ncm as never) as {
            ibpt_ncm?: string | number;
            ibpt_aliq_nac?: number;
            ibpt_aliq_est?: number;
          } | null;
          const cfopRel = one(r.produto_cfop as never) as {
            codigo?: string;
          } | null;
          const cestRel = one(r.produto_cest as never) as {
            codigo?: string;
          } | null;
          const anpRel = one(r.produto_anp as never) as {
            codigo?: string;
            descricao?: string;
          } | null;
          const icm = one(r.categorias_icm as never) as {
            csosn?: string;
            cst_icms?: string;
            aliquota_estado?: number;
            percentual_reduzido?: number;
            cfop_estado?: string;
          } | null;
          const pis = one(r.produto_piscofins as never) as {
            codigo?: string;
            percentual_pis?: number;
            percentual_cofins?: number;
          } | null;
          const ibsCst = one(r.produto_ibscbs_cst as never) as {
            cst?: string | number;
            ind_gibscbs?: number;
            ind_gibscbsmono?: number;
            ind_gred?: number;
          } | null;
          const ibsClass = one(r.produto_ibscbs_classtrib as never) as {
            codigo?: string;
            red_ibs?: number;
            red_cbs?: number;
          } | null;
          const ncm =
            ncmRel?.ibpt_ncm != null
              ? String(ncmRel.ibpt_ncm).replace(/\D/g, "")
              : null;
          const cest =
            cestRel?.codigo != null
              ? String(cestRel.codigo).replace(/\D/g, "").slice(0, 7)
              : null;
          const cProdANP =
            anpRel?.codigo != null
              ? String(anpRel.codigo).replace(/\D/g, "").slice(0, 9)
              : null;
          const gtin =
            r.codigo_barras != null
              ? String(r.codigo_barras).replace(/\D/g, "")
              : null;
          map.set(String(r.id), {
            ncm: ncm || null,
            cfop:
              (cfopRel?.codigo
                ? String(cfopRel.codigo).replace(/\D/g, "")
                : null) ||
              (icm?.cfop_estado
                ? String(icm.cfop_estado).replace(/\D/g, "")
                : null),
            csosn: icm?.csosn
              ? String(icm.csosn).replace(/\D/g, "") || null
              : null,
            cstIcms: icm?.cst_icms
              ? String(icm.cst_icms).replace(/\D/g, "") || null
              : null,
            pIcms: icm?.aliquota_estado != null ? Number(icm.aliquota_estado) : null,
            pRedBc:
              icm?.percentual_reduzido != null
                ? Number(icm.percentual_reduzido)
                : null,
            cstPis: pis?.codigo
              ? String(pis.codigo).replace(/\D/g, "") || null
              : null,
            pPis: pis?.percentual_pis != null ? Number(pis.percentual_pis) : null,
            cstCofins: pis?.codigo
              ? String(pis.codigo).replace(/\D/g, "") || null
              : null,
            pCofins:
              pis?.percentual_cofins != null
                ? Number(pis.percentual_cofins)
                : null,
            cstIbscbs: ibsCst?.cst != null
              ? String(ibsCst.cst).replace(/\D/g, "").padStart(3, "0").slice(0, 3) ||
                null
              : null,
            cClassTrib: ibsClass?.codigo
              ? String(ibsClass.codigo)
                  .replace(/\D/g, "")
                  .padStart(6, "0")
                  .slice(0, 6) || null
              : null,
            indGibscbs:
              ibsCst?.ind_gibscbs != null ? Number(ibsCst.ind_gibscbs) : null,
            indGibscbsMono:
              ibsCst?.ind_gibscbsmono != null
                ? Number(ibsCst.ind_gibscbsmono)
                : null,
            indGred: ibsCst?.ind_gred != null ? Number(ibsCst.ind_gred) : null,
            pRedIbs: ibsClass?.red_ibs != null ? Number(ibsClass.red_ibs) : null,
            pRedCbs: ibsClass?.red_cbs != null ? Number(ibsClass.red_cbs) : null,
            pMono:
              r.aliquota_monofasica != null
                ? Number(r.aliquota_monofasica)
                : null,
            gtin: gtin && gtin.length >= 8 ? gtin : null,
            cest: cest && cest.length >= 7 ? cest.padStart(7, "0").slice(0, 7) : null,
            cProdANP: cProdANP || null,
            descANP: anpRel?.descricao
              ? String(anpRel.descricao).slice(0, 95)
              : null,
            pIbptNac:
              ncmRel?.ibpt_aliq_nac != null ? Number(ncmRel.ibpt_aliq_nac) : null,
            pIbptEst:
              ncmRel?.ibpt_aliq_est != null ? Number(ncmRel.ibpt_aliq_est) : null,
          });
        }
        items = items.map((item) =>
          aplicarImpostoNoItem(item, map.get(String(item.id || ""))),
        );
      }
    } catch {
      /* mantém itens do body */
    }

    const input: TransmitirVendaInput = {
      ...body,
      items,
      filialId,
      emitente: {
        cnpj: String(filial.cnpj || body.emitente?.cnpj || ""),
        ie: filial.inscricao_estadual,
        razaoSocial: filial.razao_social,
        fantasia: filial.fantasia,
        uf: filial.endereco_uf,
        municipioIbge,
        cidade: cidadeNome || undefined,
        endereco: filial.endereco,
        numero: filial.endereco_numero,
        bairro: filial.endereco_bairro,
        cep: filial.cep,
        telefone: filial.telefone,
        tokenId:
          body.emitente?.tokenId ||
          (filial.token_id != null ? String(filial.token_id) : null),
        tokenNfce:
          body.emitente?.tokenNfce ||
          (filial.token_nfce != null ? String(filial.token_nfce) : null),
        crt: body.emitente?.crt || crt,
      },
      ambiente:
        body.ambiente ??
        (Number(
          (body.tipo === "NF-e" ? filial.ambiente_nfe : filial.ambiente_nfce),
        ) === 1
          ? 1
          : 2),
    };

    const transmitter = createSefazTransmitter({
      pfx,
      passphrase: String(filial.certificado_senha),
    });

    const { document, message } = await transmitter.transmit({
      ...input,
      tipo: input.tipo || "NFC-e",
    });

    const receitas = montarReceitasFromPayments(
      document.payments,
      document.saleRef,
    );

    return NextResponse.json({
      document: {
        id: document.id,
        tipo: document.tipo,
        numero: String(document.numero).padStart(6, "0"),
        serie: document.serie,
        chave: document.chave,
        emissao: document.emissao,
        hora: document.hora,
        valor: document.valor,
        cliente: document.cliente,
        status: document.status,
        saleRef: document.saleRef,
        issuedAt: document.issuedAt,
        protocol: document.protocolo,
        buyerDocument: document.buyerDocument,
        buyerEmail: document.buyerEmail,
        items: document.items,
        payments: document.payments,
        xml: document.xml,
        digVal: document.digVal,
        tokenId: input.emitente?.tokenId || null,
        tokenNfce: input.emitente?.tokenNfce || null,
      },
      message,
      receitas,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Falha na transmissão SEFAZ.";
    const doc =
      err && typeof err === "object" && "document" in err
        ? (err as { document?: unknown }).document
        : undefined;
    return jsonError(message, 502, doc ? { document: doc } : undefined);
  }
}
