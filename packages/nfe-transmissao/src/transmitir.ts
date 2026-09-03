import { decidirTipoDocumento } from "./decidirTipo";
import { createMockTransmitter } from "./mockTransmitter";
import { montarReceitasFromPayments } from "./receitas";
import type {
  FiscalTransmitter,
  TransmitirVendaInput,
  TransmitirVendaResult,
} from "./types";

export type TransmitirOptions = {
  /**
   * Engine de transmissão.
   * Padrão: mock (sem SEFAZ). Em produção, injete ponte ACBr/HTTP.
   */
  transmitter?: FiscalTransmitter;
};

/**
 * Rotina central de transmissão NFC-e / NF-e.
 *
 * - CPF ou documento em branco → NFC-e
 * - CNPJ → NF-e
 * - Monta linhas de receita (TEF) para o host gravar em receitas_*
 *
 * Sem dependência de Next/Supabase — use em qualquer projeto Node/TS.
 */
export async function transmitirDocumentoFiscal(
  input: TransmitirVendaInput,
  options: TransmitirOptions = {},
): Promise<TransmitirVendaResult> {
  const tipo = decidirTipoDocumento(input.buyer?.document, input.tipo);
  const transmitter = options.transmitter || createMockTransmitter();

  const { document, message } = await transmitter.transmit({
    ...input,
    tipo,
  });

  const receitas = montarReceitasFromPayments(document.payments, document.saleRef);

  return {
    document,
    receitas,
    message:
      tipo === "NFC-e"
        ? `${message} Destino: venda_nfce + receitas_nfce.`
        : `${message} Destino: venda_nfe + receitas_nfe.`,
  };
}
