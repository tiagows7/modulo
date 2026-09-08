# Transmissão NFC-e / NF-e (`@modulo/nfe-transmissao`)

Pacote portátil para emitir/autorizar **NFC-e** e **NF-e** em qualquer projeto da empresa (Node/TS ≥ 18).

- **CPF** ou documento em branco → **NFC-e** (modelo 65)
- **CNPJ** → **NF-e** (modelo 55)
- Monta linhas de **receita** (pagamentos + TEF 131/132, bandeira, autorização, …)
- Sem Next.js / Supabase — o **host** persiste no banco

## Documentação completa

Guia para outros sistemas (instalação, contratos, TEF, SEFAZ, SQL):

**[`docs/NFE_TRANSMISSAO.md`](../../docs/NFE_TRANSMISSAO.md)**

## Uso rápido

```ts
import { transmitirDocumentoFiscal } from "@modulo/nfe-transmissao";

const result = await transmitirDocumentoFiscal({
  saleRef: "PDV123456",
  buyer: { document: "12345678901", name: "Cliente" }, // CPF → NFC-e
  items: [{ name: "Gasolina", qty: 10, price: 5.89, unit: "L", kind: "combustivel" }],
  payments: [{ methodId: "dinheiro", label: "Dinheiro", amount: 58.9 }],
  ambiente: 2, // homologação
});

// result.document  → gravar venda_nfce ou venda_nfe
// result.receitas  → gravar receitas_nfce ou receitas_nfe
```

## Plugar SEFAZ real

```ts
await transmitirDocumentoFiscal(input, {
  transmitter: meuTransmitterAcbr, // implementa FiscalTransmitter
});
```

Sem `transmitter`, usa mock (chave/protocolo locais).
