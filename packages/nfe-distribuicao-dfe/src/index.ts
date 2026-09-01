/**
 * @modulo/nfe-distribuicao-dfe
 *
 * Cliente Node puro para NFeDistribuicaoDFe (Ambiente Nacional) via certificado A1 (PFX).
 * Sem dependência de Next.js, Supabase ou UI — reutilizável em qualquer projeto Node 18+.
 */
import https from "node:https";
import zlib from "node:zlib";

export type DistDfeDoc = {
  chave: string;
  nsu: string | null;
  protocolo: string | null;
  numero: number | null;
  emissao: string | null;
  valor: number | null;
  fornecedor_cnpj: string | null;
  fornecedor_nome: string | null;
  fornecedor_ie: string | null;
  /** 1 = XML completo (procNFe); 0 = resumo (resNFe) */
  xml: number;
  xml_conteudo: string | null;
  schema: string | null;
};

export type DistDfeResult = {
  docs: DistDfeDoc[];
  maxNsu: string;
  ultNsu: string;
  cStat: string;
  xMotivo: string;
  message: string;
  consultas: number;
};

export type DistribuirDfePorNsuInput = {
  /** CNPJ do interessado (14 dígitos; pontuação é removida) */
  cnpj: string;
  /** UF (sigla RS/SP… ou código IBGE 43/35…) — vira cUFAutor */
  uf?: string | null;
  /** Última NSU consultada; vazio/null → "0" */
  ultimoNsu?: string | null;
  /** Conteúdo do certificado A1 (.pfx / .p12) */
  pfx: Buffer;
  /** Senha do PFX */
  passphrase: string;
  /** 1 = produção (padrão), 2 = homologação */
  tpAmb?: 1 | 2;
  /** Limite de rodadas distNSU (padrão 30, máx 50) */
  maxConsultas?: number;
  /** Timeout por request HTTP (ms). Padrão 60000 */
  timeoutMs?: number;
};

const UF_IBGE: Record<string, string> = {
  AC: "12",
  AL: "27",
  AP: "16",
  AM: "13",
  BA: "29",
  CE: "23",
  DF: "53",
  ES: "32",
  GO: "52",
  MA: "21",
  MT: "51",
  MS: "50",
  MG: "31",
  PA: "15",
  PB: "25",
  PR: "41",
  PE: "26",
  PI: "22",
  RJ: "33",
  RN: "24",
  RS: "43",
  RO: "11",
  RR: "14",
  SC: "42",
  SP: "35",
  SE: "28",
  TO: "17",
};

export function onlyDigitsNfe(v: string) {
  return String(v || "").replace(/\D/g, "");
}

export function padNsu(v: string | number | null | undefined) {
  const d = onlyDigitsNfe(String(v ?? "0")) || "0";
  return d.padStart(15, "0").slice(-15);
}

export function maxNsu(...values: Array<string | number | null | undefined>) {
  let best: string | null = null;
  for (const v of values) {
    const s = onlyDigitsNfe(String(v ?? ""));
    if (!s) continue;
    if (!best || BigInt(s) > BigInt(best)) best = s;
  }
  return best ? padNsu(best) : padNsu("0");
}

export function ufToIbge(uf: string | null | undefined) {
  const code = String(uf || "").trim().toUpperCase();
  if (/^\d{2}$/.test(code)) return code;
  return UF_IBGE[code] || "";
}

export function resolveTpAmb(explicit?: 1 | 2): 1 | 2 {
  if (explicit === 1 || explicit === 2) return explicit;
  return Number(process.env.NFE_TP_AMB) === 2 ? 2 : 1;
}

function tag(xml: string, name: string) {
  const re = new RegExp(
    `<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
    "i",
  );
  const m = re.exec(xml);
  return m ? m[1].trim() : "";
}

function attr(tagXml: string, name: string) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i");
  const m = re.exec(tagXml);
  return m ? m[1] : "";
}

function wsUrl(tpAmb: 1 | 2) {
  return tpAmb === 2
    ? "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
    : "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
}

function buildSoap(params: {
  cnpj: string;
  cUFAutor: string;
  ultNSU: string;
  tpAmb: 1 | 2;
}) {
  const dados = [
    `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">`,
    `<tpAmb>${params.tpAmb}</tpAmb>`,
    params.cUFAutor ? `<cUFAutor>${params.cUFAutor}</cUFAutor>` : "",
    `<CNPJ>${params.cnpj}</CNPJ>`,
    `<distNSU><ultNSU>${params.ultNSU}</ultNSU></distNSU>`,
    `</distDFeInt>`,
  ].join("");

  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema">` +
    `<soap:Body>` +
    `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
    `<nfeDadosMsg>${dados}</nfeDadosMsg>` +
    `</nfeDistDFeInteresse>` +
    `</soap:Body>` +
    `</soap:Envelope>`
  );
}

function httpsPostPfx(args: {
  url: string;
  body: string;
  pfx: Buffer;
  passphrase: string;
  timeoutMs?: number;
}) {
  return new Promise<string>((resolve, reject) => {
    const u = new URL(args.url);
    const agent = new https.Agent({
      pfx: args.pfx,
      passphrase: args.passphrase,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    });

    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: "POST",
        agent,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction:
            "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse",
          "Content-Length": Buffer.byteLength(args.body, "utf8"),
        },
        timeout: args.timeoutMs ?? 60_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) =>
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
        );
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 400) {
            reject(
              new Error(
                `SEFAZ HTTP ${res.statusCode}: ${text.slice(0, 400) || "sem corpo"}`,
              ),
            );
            return;
          }
          resolve(text);
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("Tempo esgotado na comunicação com a SEFAZ."));
    });
    req.on("error", (err) => reject(err));
    req.write(args.body, "utf8");
    req.end();
  });
}

/** Descompacta conteúdo base64 de docZip (gzip / inflate / texto). */
export function decodeDocZip(base64: string) {
  const raw = Buffer.from(base64.replace(/\s+/g, ""), "base64");
  try {
    return zlib.gunzipSync(raw).toString("utf8");
  } catch {
    try {
      return zlib.inflateRawSync(raw).toString("utf8");
    } catch {
      return raw.toString("utf8");
    }
  }
}

function block(xml: string, name: string) {
  const re = new RegExp(
    `<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
    "i",
  );
  const m = re.exec(xml);
  return m ? m[0] : "";
}

function chaveFromProc(xml: string) {
  const idMatch = /\bId\s*=\s*["']NFe(\d{44})["']/i.exec(xml);
  if (idMatch) return idMatch[1];
  const ch = onlyDigitsNfe(tag(xml, "chNFe"));
  return ch.length === 44 ? ch : "";
}

/** Interpreta XML interno de um docZip (procNFe / resNFe). */
export function docFromDistXml(
  xml: string,
  nsu: string,
  schema: string,
): DistDfeDoc | null {
  const schemaLower = schema.toLowerCase();
  const isProcNfe =
    schemaLower.includes("procnfe") ||
    /<(?:\w+:)?nfeProc[\s>]|<(?:\w+:)?NFe[\s>]/.test(xml);
  const isResNfe =
    schemaLower.includes("resnfe") || /<(?:\w+:)?resNFe[\s>]/.test(xml);

  if (isProcNfe) {
    const chave = chaveFromProc(xml);
    if (chave.length !== 44) return null;
    const emit = block(xml, "emit");
    const ide = block(xml, "ide");
    const prot = block(xml, "protNFe") || block(xml, "infProt");
    return {
      chave,
      nsu: nsu || null,
      protocolo: tag(prot, "nProt") || tag(xml, "nProt") || null,
      numero: Number(tag(ide, "nNF") || tag(xml, "nNF")) || null,
      emissao:
        (tag(ide, "dhEmi") || tag(ide, "dEmi") || tag(xml, "dhEmi") || "").slice(
          0,
          10,
        ) || null,
      valor: Number(String(tag(xml, "vNF") || "0").replace(",", ".")) || 0,
      fornecedor_cnpj: onlyDigitsNfe(tag(emit, "CNPJ")) || null,
      fornecedor_nome: tag(emit, "xNome") || null,
      fornecedor_ie: tag(emit, "IE") || null,
      xml: 1,
      xml_conteudo: xml,
      schema,
    };
  }

  if (isResNfe) {
    const chave = onlyDigitsNfe(tag(xml, "chNFe"));
    if (chave.length !== 44) return null;
    return {
      chave,
      nsu: nsu || null,
      protocolo: tag(xml, "nProt") || null,
      numero: null,
      emissao: (tag(xml, "dhEmi") || "").slice(0, 10) || null,
      valor: Number(String(tag(xml, "vNF") || "0").replace(",", ".")) || 0,
      fornecedor_cnpj: onlyDigitsNfe(tag(xml, "CNPJ")) || null,
      fornecedor_nome: tag(xml, "xNome") || null,
      fornecedor_ie: null,
      xml: 0,
      xml_conteudo: null,
      schema,
    };
  }

  return null;
}

export function parseDistResponse(soapXml: string) {
  const fault = tag(soapXml, "faultstring") || tag(soapXml, "Fault");
  if (fault && !tag(soapXml, "retDistDFeInt")) {
    throw new Error(`SOAP Fault da SEFAZ: ${fault.slice(0, 300)}`);
  }

  const ret = tag(soapXml, "retDistDFeInt") || soapXml;
  const cStat = tag(ret, "cStat");
  const xMotivo = tag(ret, "xMotivo");
  const ultNSU = padNsu(tag(ret, "ultNSU") || "0");
  const maxNSU = padNsu(tag(ret, "maxNSU") || ultNSU);

  const docs: DistDfeDoc[] = [];
  const zipRe =
    /<(?:\w+:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?docZip>/gi;
  let m: RegExpExecArray | null;
  while ((m = zipRe.exec(ret))) {
    const attrs = m[1] || "";
    const b64 = (m[2] || "").trim();
    if (!b64) continue;
    const nsu = padNsu(attr(attrs, "NSU") || attr(attrs, "nsu"));
    const schema = attr(attrs, "schema") || "";
    try {
      const inner = decodeDocZip(b64);
      const doc = docFromDistXml(inner, nsu, schema);
      if (doc) docs.push(doc);
    } catch {
      // zip inválido — ignora
    }
  }

  return { cStat, xMotivo, ultNSU, maxNSU, docs };
}

/**
 * Consulta distribuição DF-e por ultNSU (loop até maxNSU ou cStat 137).
 * Persistência de NSU/XML fica a cargo do chamador.
 */
export async function distribuirDfePorNsu(
  args: DistribuirDfePorNsuInput,
): Promise<DistDfeResult> {
  const cnpj = onlyDigitsNfe(args.cnpj);
  if (cnpj.length !== 14) {
    throw new Error("CNPJ inválido para distribuição DF-e (informe 14 dígitos).");
  }
  if (!args.pfx?.length) {
    throw new Error("Certificado A1 (PFX) não informado.");
  }
  if (!args.passphrase) {
    throw new Error("Senha do certificado não informada.");
  }

  const tpAmb = resolveTpAmb(args.tpAmb);
  const cUFAutor = ufToIbge(args.uf);
  const url = wsUrl(tpAmb);
  const maxConsultas = Math.max(1, Math.min(args.maxConsultas ?? 30, 50));
  const timeoutMs = args.timeoutMs ?? 60_000;

  let cursor = padNsu(args.ultimoNsu || "0");
  let maxNsuResp = cursor;
  let lastStat = "";
  let lastMotivo = "";
  const byChave = new Map<string, DistDfeDoc>();
  let consultas = 0;

  while (consultas < maxConsultas) {
    consultas += 1;
    const soap = buildSoap({
      cnpj,
      cUFAutor,
      ultNSU: cursor,
      tpAmb,
    });

    let responseXml: string;
    try {
      responseXml = await httpsPostPfx({
        url,
        body: soap,
        pfx: args.pfx,
        passphrase: args.passphrase,
        timeoutMs,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/pfx|mac verify|password|passphrase|PKCS/i.test(msg)) {
        throw new Error(
          "Falha ao usar o certificado A1. Verifique o arquivo .pfx/.p12 e a senha.",
        );
      }
      if (/ECONNREFUSED|ENOTFOUND|certificate|SSL|TLS/i.test(msg)) {
        throw new Error(`Falha de conexão com a SEFAZ (DF-e): ${msg}`);
      }
      throw err instanceof Error ? err : new Error(msg);
    }

    const parsed = parseDistResponse(responseXml);
    lastStat = parsed.cStat;
    lastMotivo = parsed.xMotivo;
    maxNsuResp = maxNsu(maxNsuResp, parsed.maxNSU, parsed.ultNSU);

    for (const doc of parsed.docs) {
      const prev = byChave.get(doc.chave);
      if (!prev || (doc.xml_conteudo && !prev.xml_conteudo)) {
        byChave.set(doc.chave, doc);
      }
    }

    const nextCursor = padNsu(parsed.ultNSU);
    if (BigInt(nextCursor) <= BigInt(cursor) && parsed.docs.length === 0) {
      break;
    }
    cursor = nextCursor;

    if (parsed.cStat === "137") break;
    if (BigInt(cursor) >= BigInt(parsed.maxNSU)) break;
    if (parsed.docs.length === 0 && BigInt(cursor) >= BigInt(maxNsuResp)) break;
  }

  const docs = [...byChave.values()];
  const message =
    lastStat === "137"
      ? "Nenhum documento localizado na SEFAZ para o período/NSU informado."
      : lastStat === "138"
        ? `${docs.length} documento(s) importado(s) da SEFAZ.`
        : lastMotivo
          ? `SEFAZ cStat ${lastStat}: ${lastMotivo}`
          : `${docs.length} documento(s) processado(s).`;

  if (lastStat && !["137", "138"].includes(lastStat) && docs.length === 0) {
    throw new Error(
      `SEFAZ rejeitou a consulta (cStat ${lastStat}): ${lastMotivo || "sem detalhe"}`,
    );
  }

  return {
    docs,
    maxNsu: maxNsu(maxNsuResp, cursor),
    ultNsu: cursor,
    cStat: lastStat,
    xMotivo: lastMotivo,
    message,
    consultas,
  };
}

/** Alias estável da API pública. */
export const consultarDistribuicaoDfe = distribuirDfePorNsu;
