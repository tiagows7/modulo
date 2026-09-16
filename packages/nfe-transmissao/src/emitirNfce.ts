import { createSefazTransmitter } from "./sefaz/transmitter.mjs";
import { transmitirDocumentoFiscal } from "./transmitir";
import type {
  AmbienteSefaz,
  TransmitirVendaInput,
  TransmitirVendaResult,
} from "./types";

/**
 * Entrada de alto nível para emitir NFC-e na SEFAZ com certificado A1.
 * Sem Next/Supabase — use em qualquer projeto Node 18+.
 *
 * Persistência (venda/receitas/XML) fica a cargo do chamador.
 */
export type EmitirNfceInput = Omit<TransmitirVendaInput, "tipo"> & {
  /** Conteúdo do certificado A1 (.pfx / .p12) */
  pfx: Buffer;
  /** Senha do PFX */
  passphrase: string;
  /**
   * Ambiente SEFAZ.
   * Se omitido, usa `input.ambiente` ou `NFCE_TP_AMB` / `NFE_TP_AMB`
   * (`2` = homologação; demais = produção).
   */
  tpAmb?: AmbienteSefaz;
};

function resolveTpAmb(
  explicit?: AmbienteSefaz,
  fromInput?: AmbienteSefaz,
): AmbienteSefaz {
  if (explicit === 1 || explicit === 2) return explicit;
  if (fromInput === 1 || fromInput === 2) return fromInput;
  const env = Number(process.env.NFCE_TP_AMB ?? process.env.NFE_TP_AMB);
  return env === 2 ? 2 : 1;
}

/**
 * Emite e autoriza **NFC-e** (modelo 65) na SEFAZ.
 *
 * - Monta XML 4.00 (ICMS/PIS/COFINS/IBS-CBS)
 * - Assina com o A1
 * - Autoriza no webservice da UF
 * - Devolve `document` + `receitas` para o host gravar
 *
 * @example
 * ```ts
 * import { readFileSync } from "node:fs";
 * import { emitirNfce } from "@modulo/nfe-transmissao";
 *
 * const result = await emitirNfce({
 *   pfx: readFileSync("./cert.pfx"),
 *   passphrase: "senha",
 *   tpAmb: 2,
 *   saleRef: "PDV0001",
 *   emitente: { cnpj: "...", ie: "...", municipioIbge: "4205407", uf: "SC", tokenId: "1", tokenNfce: "CSC" },
 *   items: [{ name: "Produto", qty: 1, price: 10, csosn: "102" }],
 *   payments: [{ methodId: "dinheiro", amount: 10 }],
 * });
 * ```
 */
export async function emitirNfce(
  input: EmitirNfceInput,
): Promise<TransmitirVendaResult> {
  const { pfx, passphrase, tpAmb, ...venda } = input;
  const ambiente = resolveTpAmb(tpAmb, venda.ambiente);

  return transmitirDocumentoFiscal(
    {
      ...venda,
      tipo: "NFC-e",
      ambiente,
    },
    {
      transmitter: createSefazTransmitter({ pfx, passphrase }),
    },
  );
}

/** Alias estável da API pública. */
export const transmitirNfce = emitirNfce;
