import { modeloCodigo } from "./decidirTipo";
import { buildChaveAcesso, ufToIbge } from "./sefaz/utils.mjs";
import type {
  AmbienteSefaz,
  DocumentoFiscalTransmitido,
  FiscalTransmitter,
  TransmitirVendaInput,
} from "./types";

function pad(n: number, size: number) {
  return String(n).padStart(size, "0");
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function nowParts(d = new Date()) {
  const emissao = d.toLocaleDateString("pt-BR");
  const hora = d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { emissao, hora, issuedAt: d.toISOString() };
}

let seqNfce = 1000;
let seqNfe = 100;

/**
 * Transmissor mock (sem SEFAZ) — útil em PDV, testes e outros projetos
 * até plugar ACBr / ponte live.
 *
 * A chave usa CNPJ/UF da filial (emitente) e DV mod-11, igual à SEFAZ.
 */
export function createMockTransmitter(): FiscalTransmitter {
  return {
    async transmit(input: TransmitirVendaInput) {
      if (!input.items?.length) {
        throw new Error("Informe ao menos um item para transmitir a nota.");
      }

      const tipo = input.tipo === "NF-e" ? "NF-e" : "NFC-e";
      const total =
        input.total != null
          ? roundMoney(input.total)
          : roundMoney(input.items.reduce((s, i) => s + i.qty * i.price, 0));

      const numeroReservado = Number(input.numero);
      const numero =
        Number.isInteger(numeroReservado) && numeroReservado > 0
          ? numeroReservado
          : tipo === "NFC-e"
            ? ++seqNfce
            : ++seqNfe;
      if (tipo === "NFC-e") seqNfce = Math.max(seqNfce, numero);
      else seqNfe = Math.max(seqNfe, numero);
      const serie = String(input.serie || "1");
      const ambiente: AmbienteSefaz = input.ambiente === 1 ? 1 : 2;
      const { emissao, hora, issuedAt } = nowParts();
      const dhEmi = new Date();
      const cnpjEmit = input.emitente?.cnpj || "00000000000000";
      const cUF =
        ufToIbge(input.emitente?.uf) ||
        ufToIbge("SP") ||
        "35";
      const modelo = modeloCodigo(tipo);
      const chave = buildChaveAcesso({
        cUF,
        dhEmi,
        cnpj: cnpjEmit,
        modelo,
        serie,
        numero,
        tpEmis: "1",
        cNF: Math.floor(Math.random() * 1e8),
      });
      const cliente =
        input.buyer?.name?.trim() ||
        input.buyer?.customerCode?.trim() ||
        (tipo === "NFC-e" ? "Consumidor final" : "Destinatário não informado");

      const document: DocumentoFiscalTransmitido = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        modelo,
        numero,
        serie,
        chave,
        protocolo: `135${pad(numero, 12)}`,
        ambiente,
        status: "authorized",
        valor: total,
        cliente,
        buyerDocument: input.buyer?.document || undefined,
        buyerEmail: input.buyer?.email || undefined,
        saleRef: input.saleRef,
        issuedAt,
        emissao,
        hora,
        items: input.items.map((i) => ({ ...i })),
        payments: input.payments.map((p) => ({ ...p })),
        xml: `<!-- XML mock ${tipo} ${pad(numero, 6)} amb=${ambiente} -->`,
        error: null,
      };

      return {
        document,
        message: `${tipo} ${pad(numero, 6)} autorizada (mock, ambiente ${ambiente === 1 ? "produção" : "homologação"}).`,
      };
    },
  };
}
