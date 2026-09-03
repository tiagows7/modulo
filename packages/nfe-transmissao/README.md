# Transmissão NFC-e / NF-e (`@modulo/nfe-transmissao`)

Rotina compartilhada para emitir/autorizar documentos fiscais de venda:

- **CPF** ou documento em branco → **NFC-e** (modelo 65)
- **CNPJ** → **NF-e** (modelo 55)
- Monta linhas de **receita** (pagamentos + TEF campos 131/132, bandeira, autorização, etc.)

Sem dependência de Next.js ou Supabase — o **host** grava em `venda_nfce` / `venda_nfe` e `receitas_nfce` / `receitas_nfe`.

## Uso

```ts
import {
  transmitirDocumentoFiscal,
  decidirTipoDocumento,
  createMockTransmitter,
} from "@modulo/nfe-transmissao";

const result = await transmitirDocumentoFiscal({
  saleRef: "PDV123456",
  buyer: { document: "12345678901", name: "Cliente" }, // CPF → NFC-e
  items: [{ name: "Gasolina", qty: 10, price: 5.89, unit: "L", kind: "combustivel" }],
  payments: [
    {
      methodId: "tef",
      label: "Cartão TEF",
      amount: 58.9,
      isTef: true,
      tef: {
        campo_131: "REDE X",
        campo_132: "CREDITO",
        autorizacao: "123456",
        bandeira: "VISA",
        nsu: "999888",
        data_cartao: "20260903",
        hora_cartao: "171500",
        recebimento_cartao: 58.9,
        taxa_cartao: 0,
        modalidade: "credito",
      },
    },
  ],
  ambiente: 2, // homologação
});

// result.document → gravar venda_nfce ou venda_nfe
// result.receitas → gravar receitas_nfce ou receitas_nfe
```

## Plugar SEFAZ real

Implemente `FiscalTransmitter` (ponte ACBr / HTTP) e passe em `options.transmitter`.

## Campos TEF (receita)

| Campo | Origem CliSiTef |
|-------|-----------------|
| `campo_131` | 131 REDE_DESTINO |
| `campo_132` | 132 TIPO_CARTAO |
| `autorizacao` | 134 COD_AUTORIZACAO |
| `bandeira` | 156 BANDEIRA |
| `nsu` | 133 NSU_SITEF |
| `recebimento_cartao`, `data_prevista`, `modalidade`, `bin_rede`, `data_cartao`, `hora_cartao`, `taxa_cartao` | complemento da automação |
