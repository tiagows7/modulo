import type { ReceitaFiscalLinha, TransmitPayment } from "./types";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function isCardLike(methodId: string, payment: TransmitPayment): boolean {
  if (payment.isTef) return true;
  if (payment.tef) return true;
  const id = methodId.toLowerCase();
  return (
    id.includes("tef") ||
    id.includes("cartao") ||
    id.includes("credito") ||
    id.includes("debito") ||
    id.includes("pix") ||
    id === "pos"
  );
}

/**
 * Monta linhas de receita a partir dos pagamentos da venda
 * (prontas para `receitas_nfce` / `receitas_nfe`).
 */
export function montarReceitasFromPayments(
  payments: TransmitPayment[],
  saleRef?: string | null,
): ReceitaFiscalLinha[] {
  return (payments || []).map((p, index) => {
    const tef = p.tef || {};
    const card = isCardLike(p.methodId, p);
    const autorizacao =
      tef.autorizacao?.trim() || p.authorizationCode?.trim() || null;
    const bandeira = tef.bandeira?.trim() || p.brand?.trim() || null;
    const nsu = tef.nsu?.trim() || p.nsu?.trim() || null;
    const recebimento = round2(
      tef.recebimento_cartao != null && Number.isFinite(Number(tef.recebimento_cartao))
        ? Number(tef.recebimento_cartao)
        : card
          ? p.amount
          : 0,
    );

    return {
      n_item: index + 1,
      forma_pagamento: p.label?.trim() || p.methodId,
      method_id: p.methodId,
      label: p.label?.trim() || null,
      valor: round2(p.amount),
      situacao: "aberta",
      campo_131: tef.campo_131?.trim() || null,
      campo_132: tef.campo_132?.trim() || null,
      recebimento_cartao: recebimento,
      data_prevista: tef.data_prevista?.trim() || null,
      modalidade: tef.modalidade?.trim() || null,
      bin_rede: tef.bin_rede?.trim() || null,
      data_cartao: tef.data_cartao?.trim() || null,
      hora_cartao: tef.hora_cartao?.trim() || null,
      autorizacao,
      taxa_cartao: round2(Number(tef.taxa_cartao) || 0),
      bandeira,
      nsu,
      sale_ref: saleRef?.trim() || null,
    };
  });
}
