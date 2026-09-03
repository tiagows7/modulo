import { modeloCodigo } from "./decidirTipo";
import type {
  AmbienteSefaz,
  DocumentoFiscalTransmitido,
  FiscalTransmitter,
  ModeloFiscal,
  TransmitirVendaInput,
} from "./types";

function pad(n: number, size: number) {
  return String(n).padStart(size, "0");
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
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

function buildChaveMock(
  tipo: ModeloFiscal,
  numero: number,
  serie: string,
  cnpjEmit: string,
  ufIbge = "35",
) {
  const d = new Date();
  const aamm = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1, 2)}`;
  const cnpj = onlyDigits(cnpjEmit).padStart(14, "0").slice(0, 14);
  const mod = modeloCodigo(tipo);
  const seriePad = pad(Number(serie) || 1, 3);
  const nNF = pad(numero, 9);
  const tpEmis = "1";
  const cNF = pad(Math.floor(Math.random() * 1e8), 8);
  const base = `${ufIbge}${aamm}${cnpj}${mod}${seriePad}${nNF}${tpEmis}${cNF}`;
  const dv = String(base.split("").reduce((s, c) => s + Number(c), 0) % 10);
  return `${base}${dv}`;
}

let seqNfce = 1000;
let seqNfe = 100;

/**
 * Transmissor mock (sem SEFAZ) — útil em PDV, testes e outros projetos
 * até plugar ACBr / ponte live.
 */
export function createMockTransmitter(): FiscalTransmitter {
  return {
    async transmit(input) {
      if (!input.items?.length) {
        throw new Error("Informe ao menos um item para transmitir a nota.");
      }

      const tipo = input.tipo;
      const total =
        input.total != null
          ? roundMoney(input.total)
          : roundMoney(input.items.reduce((s, i) => s + i.qty * i.price, 0));

      const numero = tipo === "NFC-e" ? ++seqNfce : ++seqNfe;
      const serie = String(input.serie || "1");
      const ambiente: AmbienteSefaz = input.ambiente === 1 ? 1 : 2;
      const { emissao, hora, issuedAt } = nowParts();
      const cnpjEmit = input.emitente?.cnpj || "00000000000000";
      const chave = buildChaveMock(tipo, numero, serie, cnpjEmit);
      const cliente =
        input.buyer?.name?.trim() ||
        input.buyer?.customerCode?.trim() ||
        (tipo === "NFC-e" ? "Consumidor final" : "Destinatário não informado");

      const document: DocumentoFiscalTransmitido = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        tipo,
        modelo: modeloCodigo(tipo),
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
