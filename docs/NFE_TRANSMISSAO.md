# Transmissão NFC-e / NF-e

Rotina compartilhada para **emitir e autorizar** documentos fiscais de venda (saída):

| Destinatário | Modelo | Código | Tabelas sugeridas no host |
|--------------|--------|--------|---------------------------|
| Documento em branco ou **CPF** | **NFC-e** | 65 | `venda_nfce` + `venda_nfceprodutos` + `receitas_nfce` |
| **CNPJ** (14 dígitos) | **NF-e** | 55 | `venda_nfe` + `venda_nfeprodutos` + `receitas_nfe` |

Serve para **qualquer módulo deste projeto** e para **outros sistemas** da empresa. O pacote **não depende** de Next.js, Supabase ou UI — a persistência fica a cargo do host.

> **Estado atual do transmissor:** por padrão usa **mock** (chave/protocolo locais, sem SEFAZ). Para produção, injete um `FiscalTransmitter` (ponte ACBr / HTTP / outro motor).

Relacionado: distribuição de DF-e de entrada → [`NFE_DISTRIBUICAO_DFE.md`](./NFE_DISTRIBUICAO_DFE.md).

---

## Onde está o código

| Caminho | Papel |
|---------|--------|
| `packages/nfe-transmissao/` | Pacote portátil (`@modulo/nfe-transmissao`) |
| `src/lib/nfe/transmissao.ts` | Reexport no app pdv-web |
| `src/lib/nfe/index.ts` | Barrel do kit NF-e |
| `src/components/barrapdv/services/fiscal/` | Integração PDV (emit, print, cancel, DB) |
| `scripts/57_venda_nfce.sql` / `58_venda_nfe.sql` | Cabeçalho + itens |
| `scripts/60_receitas_nfce_nfe.sql` | Receitas / TEF por pagamento |
| `scripts/59_filial_ambiente_fiscal.sql` | `filial.ambiente_nfe` / `ambiente_nfce` (1=prod, 2=hom) |

Alias TypeScript (pdv-web):

```json
"@modulo/nfe-transmissao": ["./packages/nfe-transmissao/src/index.ts"]
```

`package.json`:

```json
"@modulo/nfe-transmissao": "file:./packages/nfe-transmissao"
```

`next.config.ts` (se Next):

```ts
transpilePackages: ["@modulo/nfe-transmissao"]
```

---

## 1) Uso em outro projeto (TypeScript / Node)

### Instalação

Copie a pasta `packages/nfe-transmissao` para o outro repositório **ou** referencie via `file:` / monorepo:

```json
{
  "dependencies": {
    "@modulo/nfe-transmissao": "file:../pdv-web/packages/nfe-transmissao"
  }
}
```

Node **≥ 18**. Sem dependências npm externas.

### Exemplo mínimo

```ts
import {
  transmitirDocumentoFiscal,
  decidirTipoDocumento,
  montarReceitasFromPayments,
} from "@modulo/nfe-transmissao";

const result = await transmitirDocumentoFiscal({
  saleRef: "PDV000123",
  ambiente: 2, // 1 = produção · 2 = homologação
  serie: "1",
  emitente: {
    cnpj: "12345678000199",
    ie: "123456789",
    razaoSocial: "POSTO EXEMPLO LTDA",
    fantasia: "Posto Exemplo",
    uf: "SP",
  },
  buyer: {
    document: "12345678901", // CPF → NFC-e; 14 dígitos → NF-e; vazio → NFC-e
    name: "Cliente Final",
    email: "cliente@email.com",
  },
  items: [
    {
      name: "Gasolina Comum",
      qty: 40.5,
      price: 5.89,
      unit: "L",
      kind: "combustivel",
      productCode: "1",
    },
  ],
  payments: [
    {
      methodId: "dinheiro",
      label: "Dinheiro",
      amount: 238.55,
    },
  ],
  total: 238.55,
});

console.log(result.document.tipo);   // "NFC-e"
console.log(result.document.chave);
console.log(result.document.protocolo);
console.log(result.receitas);        // linhas para gravar em receitas_*
```

### Decisão de modelo

```ts
import { decidirTipoDocumento, modeloCodigo } from "@modulo/nfe-transmissao";

decidirTipoDocumento("");              // "NFC-e"
decidirTipoDocumento("123.456.789-01"); // "NFC-e" (CPF)
decidirTipoDocumento("12.345.678/0001-99"); // "NF-e" (CNPJ)
decidirTipoDocumento("123", "NF-e");   // força "NF-e"

modeloCodigo("NFC-e"); // "65"
modeloCodigo("NF-e");  // "55"
```

### API pública exportada

| Função / tipo | Descrição |
|---------------|-----------|
| `transmitirDocumentoFiscal(input, options?)` | Orquestra tipo → transmissão → receitas |
| `decidirTipoDocumento(doc, forced?)` | CPF/vazio → NFC-e; CNPJ → NF-e |
| `modeloCodigo(tipo)` | `"65"` \| `"55"` |
| `onlyDigitsDoc(value)` | Só dígitos do documento |
| `montarReceitasFromPayments(payments, saleRef?)` | Linhas de receita (TEF) |
| `createMockTransmitter()` | Engine mock (padrão) |
| `FiscalTransmitter` | Interface para plugar SEFAZ/ACBr |
| `TransmitirVendaInput` / `TransmitirVendaResult` | Contratos de entrada/saída |
| `DocumentoFiscalTransmitido` | Nota autorizada (ou erro) |
| `ReceitaFiscalLinha` | Payload pronto para `receitas_*` |
| `TransmitTefReceita` / `TransmitPayment` | Pagamentos + TEF |

---

## 2) Contrato de entrada (`TransmitirVendaInput`)

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `saleRef` | sim | Referência da venda / cupom PDV |
| `items` | sim | Itens (nome, qtd, preço, …) |
| `payments` | sim | Formas de pagamento (pode ser `[]`) |
| `buyer` | não | Destinatário; `document` decide NFC-e vs NF-e |
| `tipo` | não | Força `"NFC-e"` ou `"NF-e"` |
| `total` | não | Se omitido, soma `qty * price` dos itens |
| `serie` | não | Padrão `"1"` |
| `ambiente` | não | `1` produção · `2` homologação (mock usa o valor) |
| `emitente` | não | CNPJ/IE/razão (necessário no SEFAZ real) |
| `operator` | não | Operador |
| `pdvCodigo` / `filialId` | não | Contexto para o host persistir |

### Pagamento com TEF

```ts
{
  methodId: "tef",
  label: "Cartão TEF",
  amount: 100.0,
  isTef: true,
  nsu: "123456",
  authorizationCode: "789012",
  brand: "VISA",
  tef: {
    campo_131: "REDE X",       // CliSiTef 131 — rede destino
    campo_132: "CREDITO",      // CliSiTef 132 — tipo cartão
    recebimento_cartao: 100.0,
    data_prevista: "2026-09-10", // YYYY-MM-DD
    modalidade: "credito",
    bin_rede: "412345",
    data_cartao: "20260903",     // AAAAMMDD
    hora_cartao: "181530",       // HHMMSS
    autorizacao: "789012",
    taxa_cartao: 1.5,
    bandeira: "VISA",
    nsu: "123456",
  },
}
```

---

## 3) Contrato de saída

```ts
type TransmitirVendaResult = {
  document: DocumentoFiscalTransmitido; // nota
  receitas: ReceitaFiscalLinha[];       // 1 linha por pagamento
  message: string;
};
```

### `document` (principais campos)

- `tipo`, `modelo` (`65`/`55`), `numero`, `serie`, `chave`, `protocolo`
- `ambiente`, `status` (`authorized` | `denied` | `contingency` | `error` | `pending`)
- `valor`, `cliente`, `buyerDocument`, `saleRef`, `issuedAt`, `emissao`, `hora`
- `items`, `payments`, `xml?`, `digVal?`, `error?`

### `receitas` → gravação sugerida

Para cada pagamento, grave em `receitas_nfce` ou `receitas_nfe` (conforme `document.tipo`), vinculando ao `id` da venda:

| Campo receita | Origem |
|---------------|--------|
| `campo_131` | CliSiTef 131 REDE_DESTINO |
| `campo_132` | CliSiTef 132 TIPO_CARTAO |
| `autorizacao` | TEF / campo 134 |
| `bandeira` | TEF / campo 156 |
| `nsu` | TEF / campo 133 |
| `recebimento_cartao` | valor cartão / TEF |
| `data_prevista` | previsão de recebimento |
| `modalidade` | crédito / débito / pix / … |
| `bin_rede` | BIN / rede |
| `data_cartao` / `hora_cartao` | data/hora da transação |
| `taxa_cartao` | taxa |
| `valor`, `method_id`, `forma_pagamento`, `sale_ref` | pagamento |

DDL de referência: `scripts/60_receitas_nfce_nfe.sql`.

---

## 4) Persistência no host (padrão Modulo)

O pacote **não grava banco**. No pdv-web a sequência é:

1. `transmitirDocumentoFiscal(...)` → `document` + `receitas`
2. `INSERT` cabeçalho em `venda_nfce` **ou** `venda_nfe`
3. `INSERT` itens em `venda_nfceprodutos` **ou** `venda_nfeprodutos`
4. `INSERT` pagamentos/TEF em `receitas_nfce` **ou** `receitas_nfe`

Ambiente SEFAZ da filial: `filial.ambiente_nfce` / `filial.ambiente_nfe` (`1` ou `2`).

Mapeamento de situação:

| `document.status` | Coluna `situacao` |
|-------------------|-------------------|
| `pending` | `pendente` |
| `authorized` | `autorizada` |
| `denied` | `denegada` |
| `contingency` | `contingencia` |
| `cancelled` | `cancelada` |
| `error` | `erro` |

### XML

Colunas `xml_nfce` / `xml_nfe` existem, mas há opção futura de gravar XML só na máquina local (ver regra do projeto). Outros sistemas podem:

- guardar o XML no próprio storage; ou
- manter só chave/protocolo no banco.

---

## 5) Plugar transmissão real (SEFAZ / ACBr)

Implemente a interface e passe em `options.transmitter`:

```ts
import type {
  FiscalTransmitter,
  TransmitirVendaInput,
  ModeloFiscal,
} from "@modulo/nfe-transmissao";
import { transmitirDocumentoFiscal } from "@modulo/nfe-transmissao";

const acbrTransmitter: FiscalTransmitter = {
  async transmit(input: TransmitirVendaInput & { tipo: ModeloFiscal }) {
    // 1) Montar XML / chamar ponte local / ACBr / API própria
    // 2) Retornar DocumentoFiscalTransmitido com chave, protocolo, xml, status
    const document = await minhaPonte.emitir(input);
    return {
      document,
      message: `${document.tipo} ${document.numero} autorizada.`,
    };
  },
};

const result = await transmitirDocumentoFiscal(input, {
  transmitter: acbrTransmitter,
});
```

Enquanto não houver transmitter, `createMockTransmitter()` gera chave/protocolo locais — útil para PDV, testes e integração de UI/DB.

---

## 6) Uso dentro do pdv-web

```ts
import { transmitirDocumentoFiscal } from "@/lib/nfe";
// equivalente:
// import { transmitirDocumentoFiscal } from "@modulo/nfe-transmissao";
```

No PDV, o fluxo de pagamento chama `fiscalService.emitAndFinalize`, que:

1. Decide NFC-e/NF-e pelo CPF/CNPJ
2. Lê ambiente da filial
3. Chama `transmitirDocumentoFiscal`
4. Persiste venda + itens + receitas (`vendaFiscalDb`)

Reimpressão / cancelamento leem `venda_nfce` ∪ `venda_nfe`.

---

## 7) Checklist para outro projeto

1. Dependência `@modulo/nfe-transmissao` (pasta ou `file:`)
2. Alias TS / transpile se Next
3. Chamar `transmitirDocumentoFiscal` após fechar a venda
4. Persistir `document` + `receitas` nas tabelas do seu domínio (ou reutilizar os scripts `57`/`58`/`60`)
5. Configurar `ambiente` (1/2) por empresa/filial
6. Quando for ao ar: implementar `FiscalTransmitter` com certificado A1 + schemas
7. (Opcional) TEF: preencher `payments[].tef` com campos 131/132/autorização/bandeira/nsu

---

## 8) Limitações atuais

- Transmissor padrão = **mock** (sem autorização SEFAZ real)
- Não envia e-mail/XML ao destinatário (isso fica no host / `fiscalService.sendNfe`)
- Não imprime cupom/DANFE (host: `fiscalService.print` / ponte `:39102`)
- Cancelamento SEFAZ (evento) ainda não está no pacote — no PDV o cancel atualiza só o banco (`situacao=cancelada`)

---

## Referência rápida de arquivos SQL

```text
scripts/56_pdvs.sql                 # terminais / séries
scripts/57_venda_nfce.sql           # NFC-e + itens
scripts/58_venda_nfe.sql            # NF-e + itens
scripts/59_filial_ambiente_fiscal.sql
scripts/60_receitas_nfce_nfe.sql    # receitas + TEF
scripts/backup/apply-56-58-venda-fiscal.mjs
scripts/backup/apply-59-filial-ambiente-fiscal.mjs
scripts/backup/apply-60-receitas-nfce-nfe.mjs
```
