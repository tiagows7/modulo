# @modulo/nfe-transmissao

Rotina **Node 18+** (sem Next/Supabase) para emitir **NFC-e** / orquestrar **NF-e**:

- Monta XML 4.00 (ICMS, PIS/COFINS, IBS/CBS)
- Assina com certificado **A1** (PFX)
- Autoriza na **SEFAZ** (NFC-e)
- Monta linhas de **receita/TEF** para o host gravar

Documentação completa no monorepo: [`docs/NFE_TRANSMISSAO.md`](../../docs/NFE_TRANSMISSAO.md).

## Uso rápido (NFC-e SEFAZ)

```ts
import { readFileSync } from "node:fs";
import { emitirNfce } from "@modulo/nfe-transmissao";

const result = await emitirNfce({
  pfx: readFileSync("./certificado.pfx"),
  passphrase: "senha-do-pfx",
  tpAmb: 2, // 1 produção | 2 homologação
  saleRef: "PDV0001",
  emitente: {
    cnpj: "12345678000199",
    ie: "123456789",
    razaoSocial: "EMPRESA LTDA",
    uf: "SC",
    municipioIbge: "4205407",
    tokenId: "1",
    tokenNfce: "SEU_CSC",
    crt: 1,
  },
  items: [{ name: "Produto", qty: 1, price: 10, csosn: "102" }],
  payments: [{ methodId: "dinheiro", amount: 10 }],
});

// result.document → chave, protocolo, xml, status
// result.receitas → gravar em receitas_nfce
```

## Mock / transmitter próprio

```ts
import {
  transmitirDocumentoFiscal,
  createSefazTransmitter,
} from "@modulo/nfe-transmissao";

// mock (padrão)
await transmitirDocumentoFiscal(input);

// SEFAZ
await transmitirDocumentoFiscal(input, {
  transmitter: createSefazTransmitter({ pfx, passphrase }),
});
```

## Reuso em outro repositório

1. Copie `packages/nfe-transmissao` **ou** use `file:../pdv-web/packages/nfe-transmissao`
2. `npm install` (puxa `node-forge`, `xml-crypto`, `@xmldom/xmldom`)
3. Chame `emitirNfce` **ou** a API HTTP deste sistema: `POST /api/nfe/transmitir`

## Dentro do pdv-web

```ts
import { emitirNfce } from "@/lib/nfe";
// ou: import { emitirNfce } from "@modulo/nfe-transmissao";
```
