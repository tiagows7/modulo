# Transmissão NFC-e / NF-e

Rotina compartilhada para **emitir e autorizar** documentos fiscais de venda (saída) na SEFAZ:

| Destinatário | Modelo | Código | Tabelas sugeridas no host |
|--------------|--------|--------|---------------------------|
| Documento em branco ou **CPF** | **NFC-e** | 65 | `venda_nfce` + `venda_nfceprodutos` + `receitas_nfce` |
| **CNPJ** (14 dígitos) | **NF-e** | 55 | `venda_nfe` + `venda_nfeprodutos` + `receitas_nfe` |

Serve para **qualquer módulo deste projeto** e para **outros sistemas** da empresa (lib Node ou API HTTP). O pacote **não depende** de Next.js, Supabase ou UI — a persistência fica a cargo do host.

Relacionado: distribuição de DF-e de entrada → [`NFE_DISTRIBUICAO_DFE.md`](./NFE_DISTRIBUICAO_DFE.md).

---

## Onde está o código

| Caminho | Papel |
|---------|--------|
| `packages/nfe-transmissao/` | Pacote portátil (`@modulo/nfe-transmissao`) |
| `src/lib/nfe/transmissao.ts` | Reexport no app pdv-web |
| `src/lib/nfe/index.ts` | Barrel do kit NF-e |
| `POST /api/nfe/transmitir` | API genérica (sem gravar venda) — outros projetos |
| `POST /api/fiscal/transmitir` | PDV live (filial do operador + impostos do cadastro) |
| `src/components/barrapdv/services/fiscal/` | Integração PDV (emit, print, cancel, DB) |
| `scripts/57_venda_nfce.sql` / `58_venda_nfe.sql` | Cabeçalho + itens |
| `scripts/60_receitas_nfce_nfe.sql` | Receitas / TEF por pagamento |
| `scripts/59_filial_ambiente_fiscal.sql` | `filial.ambiente_nfe` / `ambiente_nfce` (1=prod, 2=hom) |

Alias TypeScript (pdv-web):

```json
"@modulo/nfe-transmissao": ["./packages/nfe-transmissao/src/index.ts"]
```

`package.json` do host:

```json
"@modulo/nfe-transmissao": "file:./packages/nfe-transmissao"
```

`next.config.ts` (se Next):

```ts
transpilePackages: ["@modulo/nfe-transmissao"]
```

Dependências do pacote: `node-forge`, `xml-crypto`, `@xmldom/xmldom` (Node ≥ 18).

---

## 1) Uso em outro projeto (TypeScript / Node)

### Instalação

Copie a pasta `packages/nfe-transmissao` **ou** referencie via `file:` / monorepo:

```json
{
  "dependencies": {
    "@modulo/nfe-transmissao": "file:../pdv-web/packages/nfe-transmissao"
  }
}
```

```bash
npm install
```

### API principal — NFC-e na SEFAZ

```ts
import { readFileSync } from "node:fs";
import { emitirNfce } from "@modulo/nfe-transmissao";
// alias: transmitirNfce

const result = await emitirNfce({
  pfx: readFileSync("./certificado.pfx"),
  passphrase: "senha-do-pfx",
  tpAmb: 2, // 1 produção | 2 homologação
  saleRef: "PDV000123",
  serie: "1",
  numero: 1, // opcional — se omitido, o pacote gera um número local
  emitente: {
    cnpj: "12345678000199",
    ie: "123456789",
    razaoSocial: "POSTO EXEMPLO LTDA",
    fantasia: "Posto Exemplo",
    uf: "SC",
    municipioIbge: "4205407", // 7 dígitos — obrigatório
    endereco: "Rua das Flores",
    numero: "100",
    bairro: "Centro",
    cep: "88010000",
    tokenId: "1",       // idCSC
    tokenNfce: "ABCDEF", // CSC
    crt: 1,             // 1 Simples · 2 excesso · 3 Regime Normal
  },
  buyer: {
    document: "12345678901", // CPF → NFC-e; vazio → NFC-e; CNPJ → use transmitirDocumentoFiscal
    name: "Cliente Final",
  },
  items: [
    {
      name: "Gasolina Comum",
      qty: 40.5,
      price: 5.89,
      unit: "L",
      kind: "combustivel",
      productCode: "1",
      ncm: "27101259",
      cfop: "5656",
      csosn: "102",
      // IBS/CBS (opcional — NT 2025.002)
      cstIbscbs: "000",
      cClassTrib: "000001",
      indGibscbs: 1,
      pIbsUf: 0.1,
      pIbsMun: 0,
      pCbs: 0.9,
    },
  ],
  payments: [
    { methodId: "dinheiro", label: "Dinheiro", amount: 238.55 },
  ],
});

// O host grava o que precisar:
console.log(result.document.chave, result.document.protocolo, result.document.xml);
console.log(result.receitas); // linhas para receitas_nfce
```

### Orquestração genérica (mock ou transmitter próprio)

```ts
import {
  transmitirDocumentoFiscal,
  createMockTransmitter,
  createSefazTransmitter,
  decidirTipoDocumento,
} from "@modulo/nfe-transmissao";

// Mock (sem SEFAZ) — útil para UI/testes
await transmitirDocumentoFiscal(input); // usa createMockTransmitter()

// SEFAZ real
await transmitirDocumentoFiscal(input, {
  transmitter: createSefazTransmitter({
    pfx: bufferDoPfx,
    passphrase: senha,
  }),
});
```

### Decisão de modelo

```ts
import { decidirTipoDocumento, modeloCodigo } from "@modulo/nfe-transmissao";

decidirTipoDocumento("");                 // "NFC-e"
decidirTipoDocumento("123.456.789-01");   // "NFC-e"
decidirTipoDocumento("12.345.678/0001-99"); // "NF-e"
decidirTipoDocumento("123", "NF-e");      // força "NF-e"

modeloCodigo("NFC-e"); // "65"
modeloCodigo("NF-e");  // "55"
```

### Helpers / API pública

| Função / tipo | Descrição |
|---------------|-----------|
| **`emitirNfce` / `transmitirNfce`** | NFC-e completa: XML + assina A1 + autoriza SEFAZ |
| `transmitirDocumentoFiscal(input, options?)` | Orquestra tipo → transmitter → receitas |
| `createSefazTransmitter({ pfx, passphrase })` | Engine SEFAZ (NFC-e) |
| `createMockTransmitter()` | Engine mock (chave/protocolo locais) |
| `decidirTipoDocumento` / `modeloCodigo` / `onlyDigitsDoc` | Decisão CPF×CNPJ |
| `montarReceitasFromPayments` | Linhas TEF/receita |
| `buildInfNFeXml` / `assinarNFeXml` / `autorizarNfce` | Passos SEFAZ isolados |
| `buildChaveAcesso` / `buildQrCodeUrl` / `ufToIbge` | Utilitários |
| `TransmitirVendaInput` / `EmitirNfceInput` | Contratos de entrada |
| `TransmitirVendaResult` / `DocumentoFiscalTransmitido` | Saída |
| `ReceitaFiscalLinha` | Payload para `receitas_*` |
| `FiscalTransmitter` | Interface para plugar ACBr / ponte própria |

### Ambiente (variáveis)

| Variável | Uso |
|----------|-----|
| `NFCE_TP_AMB` / `NFE_TP_AMB` | `2` = homologação; demais = produção (quando `tpAmb` omitido) |
| `NFCE_P_IBS_UF` / `NFCE_P_IBS_MUN` / `NFCE_P_CBS` | Alíquotas IBS/CBS padrão (%) se o item não informar |
| `NFE_TRANSMISSAO_API_KEY` | Chave para outros sistemas chamarem a API HTTP |
| `NFE_DISTRIBUICAO_API_KEY` | Aceita como fallback da chave acima |

---

## 2) Uso dentro deste projeto

```ts
import { emitirNfce, transmitirDocumentoFiscal } from "@/lib/nfe";
// equivalente:
// import { emitirNfce } from "@modulo/nfe-transmissao";
```

No PDV (`FISCAL_CONFIG.mode = 'live'`):

1. `fiscalService.emitAndFinalize` monta itens/pagamentos
2. Carrega impostos do cadastro (ICMS, PIS/COFINS, IBS/CBS)
3. Chama `POST /api/fiscal/transmitir` (certificado da filial do operador)
4. Persiste `document` + `receitas` em `venda_nfce` / `receitas_nfce`

Reimpressão / cancelamento leem `venda_nfce` ∪ `venda_nfe`.

---

## 3) API HTTP para outros projetos

**Endpoint:** `POST /api/nfe/transmitir`  
**Runtime:** Node (mTLS com o PFX).  
**Não persiste** venda nem receitas — o cliente grava o que precisar.

### Autenticação (uma das opções)

1. `Authorization: Bearer <JWT do usuário Supabase>`
2. `X-Nfe-Api-Key: <NFE_TRANSMISSAO_API_KEY>` (ou `NFE_DISTRIBUICAO_API_KEY`)

### A) Modo autônomo (recomendado para outros sistemas)

```http
POST /api/nfe/transmitir
Content-Type: application/json
X-Nfe-Api-Key: sua-chave

{
  "pfxBase64": "<base64 do .pfx>",
  "passphrase": "senha",
  "tpAmb": 2,
  "saleRef": "EXT-001",
  "emitente": {
    "cnpj": "12345678000199",
    "ie": "123456789",
    "razaoSocial": "EMPRESA LTDA",
    "uf": "SC",
    "municipioIbge": "4205407",
    "tokenId": "1",
    "tokenNfce": "CSC...",
    "crt": 1
  },
  "items": [
    { "name": "Produto", "qty": 1, "price": 10.5, "csosn": "102" }
  ],
  "payments": [
    { "methodId": "dinheiro", "amount": 10.5 }
  ]
}
```

### B) Modo filial (ERP)

```json
{
  "filialId": "<uuid da filial>",
  "saleRef": "PDV-999",
  "items": [ ... ],
  "payments": [ ... ]
}
```

O servidor baixa o A1 do Storage da filial e preenche emitente/CRT/ambiente.

### Resposta

```json
{
  "document": {
    "tipo": "NFC-e",
    "modelo": "65",
    "numero": 1,
    "serie": "1",
    "chave": "42...",
    "protocolo": "...",
    "status": "authorized",
    "xml": "<?xml ...",
    "valor": 10.5
  },
  "receitas": [ ... ],
  "message": "NFC-e 000001 autorizada..."
}
```

PDV interno continua usando `POST /api/fiscal/transmitir` (mesma stack SEFAZ + enriquecimento de impostos do cadastro).

---

## 4) Contrato de entrada (`TransmitirVendaInput` / `EmitirNfceInput`)

| Campo | Obrigatório | Descrição |
|-------|-------------|-----------|
| `saleRef` | sim | Referência da venda / cupom |
| `items` | sim | Itens (nome, qtd, preço, impostos…) |
| `payments` | sim | Formas de pagamento (pode ser `[]`) |
| `pfx` + `passphrase` | só em `emitirNfce` | Certificado A1 |
| `emitente` | sim no SEFAZ | CNPJ, IE, município IBGE, CSC, CRT… |
| `buyer` | não | Destinatário; `document` decide NFC-e vs NF-e |
| `tipo` | não | Força `"NFC-e"` ou `"NF-e"` |
| `total` | não | Se omitido, soma `qty * price` |
| `serie` / `numero` | não | Série e número fiscal |
| `ambiente` / `tpAmb` | não | `1` produção · `2` homologação |

### Item — impostos

| Campo | Uso |
|-------|-----|
| `csosn` / `cstIcms` / `pIcms` / `pRedBc` | ICMS (CRT 1–2 vs 3) |
| `cstPis` / `pPis` / `cstCofins` / `pCofins` | PIS/COFINS |
| `cstIbscbs` / `cClassTrib` | IBS/CBS (NT 2025.002) |
| `indGibscbs` / `indGibscbsMono` / `indGred` | Indicadores do CST |
| `pIbsUf` / `pIbsMun` / `pCbs` / `pRedIbs` / `pRedCbs` / `pMono` | Cálculo IBS/CBS |

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
    campo_131: "REDE X",
    campo_132: "CREDITO",
    recebimento_cartao: 100.0,
    data_prevista: "2026-09-10",
    modalidade: "credito",
    autorizacao: "789012",
    bandeira: "VISA",
    nsu: "123456",
  },
}
```

---

## 5) Contrato de saída

```ts
type TransmitirVendaResult = {
  document: DocumentoFiscalTransmitido;
  receitas: ReceitaFiscalLinha[];
  message: string;
};
```

### `document` (principais campos)

- `tipo`, `modelo` (`65`/`55`), `numero`, `serie`, `chave`, `protocolo`
- `ambiente`, `status` (`authorized` | `denied` | `contingency` | `error` | `pending`)
- `valor`, `cliente`, `buyerDocument`, `saleRef`, `issuedAt`, `emissao`, `hora`
- `items`, `payments`, `xml?`, `digVal?`, `error?`

### Persistência sugerida no host

1. `emitirNfce` / `transmitirDocumentoFiscal` → `document` + `receitas`
2. `INSERT` cabeçalho em `venda_nfce` **ou** `venda_nfe`
3. `INSERT` itens em `venda_nfceprodutos` **ou** `venda_nfeprodutos`
4. `INSERT` pagamentos/TEF em `receitas_nfce` **ou** `receitas_nfe`

| `document.status` | Coluna `situacao` |
|-------------------|-------------------|
| `pending` | `pendente` |
| `authorized` | `autorizada` |
| `denied` | `denegada` |
| `contingency` | `contingencia` |
| `cancelled` | `cancelada` |
| `error` | `erro` |

DDL: `scripts/57_venda_nfce.sql`, `58_venda_nfe.sql`, `60_receitas_nfce_nfe.sql`.

---

## 6) IBS / CBS (NT 2025.002)

Na emissão SEFAZ, o XML inclui `IBSCBS` / `IBSCBSTot` quando o produto/item tem CST e `cClassTrib`:

- CST sem tributação (`410`, `810`, `830` ou `ind_gibscbs = 0`): só `CST` + `cClassTrib`
- Monofásico (`620`… ou `ind_gibscbsmono = 1`): `gIBSCBSMono`
- Demais: `gIBSCBS` com `pIbsUf` / `pIbsMun` / `pCbs` (item ou env; default `0`)
- Redução: `pRedIbs` / `pRedCbs` → `gRed` / `pAliqEfet`

CRT da filial (`tipo_empresa` → 1/2/3) governa ICMS (CSOSN vs CST).

---

## 7) Checklist para outro projeto

1. Dependência `@modulo/nfe-transmissao` (pasta ou `file:`) + `npm install`
2. Alias TS / `transpilePackages` se Next
3. Chamar `emitirNfce({ pfx, passphrase, ... })` **ou** `POST /api/nfe/transmitir`
4. Persistir `document` + `receitas` no seu domínio
5. Configurar CSC (`tokenId`/`tokenNfce`), município IBGE e ambiente
6. (Opcional) TEF: preencher `payments[].tef`
7. (Opcional) IBS/CBS nos itens conforme reforma tributária

---

## 8) Limitações atuais

- **NFC-e (65)** e **NF-e (55)** autorizadas na SEFAZ via `createSefazTransmitter`
- CNPJ do destinatário → NF-e; CPF ou sem documento → NFC-e
- `emitirNfce` continua só NFC-e; a NF-e entra por `transmitirDocumentoFiscal` + transmitter SEFAZ
- Não envia e-mail/XML ao destinatário (fica no host)
- Não imprime DANFE/cupom (host / ponte `:39102`)
- Cancelamento SEFAZ (evento) ainda não está no pacote

---

## Referência rápida de arquivos SQL

```text
scripts/56_pdvs.sql                 # terminais / séries
scripts/57_venda_nfce.sql           # NFC-e + itens
scripts/58_venda_nfe.sql            # NF-e + itens
scripts/59_filial_ambiente_fiscal.sql
scripts/60_receitas_nfce_nfe.sql    # receitas + TEF
scripts/67_filial_tipo_empresa.sql  # CRT / tipo_empresa
scripts/backup/apply-56-58-venda-fiscal.mjs
scripts/backup/apply-59-filial-ambiente-fiscal.mjs
scripts/backup/apply-60-receitas-nfce-nfe.mjs
```
