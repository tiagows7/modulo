# Transmissão NFC-e / NF-e

Rotina compartilhada para emitir vendas fiscais:

| Documento do cliente | Modelo | Tabelas |
|----------------------|--------|---------|
| Em branco ou **CPF** | NFC-e (65) | `venda_nfce` + `venda_nfceprodutos` + `receitas_nfce` |
| **CNPJ** | NF-e (55) | `venda_nfe` + `venda_nfeprodutos` + `receitas_nfe` |

## Pacote portátil

`packages/nfe-transmissao` → `@modulo/nfe-transmissao`

- Sem Next/Supabase
- `transmitirDocumentoFiscal(input)`
- `decidirTipoDocumento(cpfCnpj)`
- `montarReceitasFromPayments(payments)` — campos TEF 131/132, bandeira, autorização, etc.
- Transmissor **mock** padrão; plugar SEFAZ via `FiscalTransmitter`

No app:

```ts
import { transmitirDocumentoFiscal } from "@/lib/nfe";
// ou: from "@modulo/nfe-transmissao"
```

## Receitas (TEF)

`receitas_nfce` / `receitas_nfe` guardam cada pagamento da venda:

- venda, filial, pdv, sale_ref, caixa_*
- `campo_131` (rede destino), `campo_132` (tipo cartão)
- `recebimento_cartao`, `data_prevista`, `modalidade`, `bin_rede`
- `data_cartao`, `hora_cartao`, `autorizacao`, `taxa_cartao`, `bandeira`, `nsu`

Ambiente (produção/homologação) vem de `filial.ambiente_nfe` / `filial.ambiente_nfce`.
