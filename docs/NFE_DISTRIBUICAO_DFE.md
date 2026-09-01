# Distribuição DF-e (NFeDistribuicaoDFe)

Rotina compartilhada para importar documentos fiscais eletrônicos da SEFAZ (Ambiente Nacional) usando:

- **CNPJ** do interessado
- **Certificado A1** (`.pfx` / `.p12`) + senha
- **Última NSU** (`ultNSU`; se em branco → **`0`**)

Serve para **qualquer módulo deste projeto** e para **outros sistemas** da empresa (lib Node ou API HTTP).

---

## Onde está o código

| Caminho | Papel |
|---------|--------|
| `packages/nfe-distribuicao-dfe/` | Pacote portátil (só Node: `https` + `zlib`) |
| `src/lib/nfe/distribuicaoDfe.ts` | Reexport no app |
| `src/lib/nfe/index.ts` | Barrel do kit NF-e |
| `POST /api/nfe/distribuicao` | API genérica (sem gravar estoque) |
| `POST /api/estoque/manifesto/consultar` | Digitação de notas (grava manifesto + `ult_nsu` da filial) |

Alias TypeScript:

```json
"@modulo/nfe-distribuicao-dfe": ["./packages/nfe-distribuicao-dfe/src/index.ts"]
```

---

## 1) Uso dentro deste projeto (TypeScript)

```ts
import { readFileSync } from "node:fs";
import {
  distribuirDfePorNsu,
  // ou: consultarDistribuicaoDfe
  padNsu,
} from "@/lib/nfe";
// equivalente:
// import { distribuirDfePorNsu } from "@modulo/nfe-distribuicao-dfe";

const result = await distribuirDfePorNsu({
  cnpj: "12345678000199",
  uf: "RS",                 // sigla ou IBGE
  ultimoNsu: "0",           // null/"" → tratado como 0
  pfx: readFileSync("cert.pfx"),
  passphrase: "****",
  tpAmb: 1,                 // 1 produção | 2 homologação
  maxConsultas: 30,
});

// Persista o cursor no seu domínio:
const proximaNsu = result.ultNsu; // string 15 dígitos

for (const doc of result.docs) {
  // doc.xml === 1 && doc.xml_conteudo → procNFe completo
  // doc.xml === 0 → resumo (resNFe); XML completo pode vir em NSU posterior
}
```

### Helpers exportados

- `padNsu` / `maxNsu` / `onlyDigitsNfe`
- `ufToIbge` / `resolveTpAmb`
- `decodeDocZip` / `docFromDistXml` / `parseDistResponse`
- Alias: `consultarDistribuicaoDfe` ≡ `distribuirDfePorNsu`

### Ambiente

| Variável | Uso |
|----------|-----|
| `NFE_TP_AMB` | `2` = homologação; qualquer outro / ausente = produção |
| `NFE_DISTRIBUICAO_API_KEY` | Chave para outros sistemas chamarem a API HTTP |
| `NFE_DISTRIBUICAO_FORCE_BRIDGE` | Só no manifesto: `1` força ponte local legada |

---

## 2) Digitação de notas (fluxo já integrado)

1. Cadastre na filial (**Cadastros → Filiais → Config NF-E / NFC-E**): certificado `.pfx` + senha.
2. Campo **Última NSU** vazio = consulta a partir de `0`.
3. Em **Estoque → Digitação de Notas → Consultar SEFAZ**:
   - chama `/api/estoque/manifesto/consultar`
   - usa CNPJ + cert + `ult_nsu` da filial
   - upsert em `nota_entradamanifesto` (com `xml_conteudo` quando for procNFe)
   - atualiza `filial.ult_nsu`

---

## 3) API HTTP para outros projetos

**Endpoint:** `POST /api/nfe/distribuicao`  
**Runtime:** Node (mTLS com o PFX).  
**Não persiste** manifesto nem NSU — o cliente grava o que precisar.

### Autenticação (uma das opções)

1. `Authorization: Bearer <JWT do usuário Supabase>`
2. `X-Nfe-Api-Key: <mesmo valor de NFE_DISTRIBUICAO_API_KEY>`

### Modo A — autônomo (recomendado para outros sistemas)

```http
POST /api/nfe/distribuicao
Content-Type: application/json
X-Nfe-Api-Key: sua-chave-secreta

{
  "cnpj": "12345678000199",
  "uf": "RS",
  "ultimoNsu": "0",
  "pfxBase64": "<base64 do arquivo .pfx>",
  "passphrase": "senha-do-certificado",
  "tpAmb": 1,
  "maxConsultas": 20
}
```

`ultimoNsu` omitido ou `""` → **`0`**.

### Modo B — filial deste ERP

```http
POST /api/nfe/distribuicao
Authorization: Bearer <jwt>

{ "filialId": "<uuid da filial>" }
```

Usa CNPJ, UF, `ult_nsu` e certificado já cadastrados na filial.

### Resposta (sucesso)

```json
{
  "ok": true,
  "cnpj": "12345678000199",
  "docs": [
    {
      "chave": "44 dígitos",
      "nsu": "000000000000123",
      "protocolo": "...",
      "numero": 100,
      "emissao": "2026-08-01",
      "valor": 1500.5,
      "fornecedor_cnpj": "...",
      "fornecedor_nome": "...",
      "fornecedor_ie": "...",
      "xml": 1,
      "xml_conteudo": "<?xml ...>",
      "schema": "procNFe_v4.00.xsd"
    }
  ],
  "ultNsu": "000000000000200",
  "maxNsu": "000000000000200",
  "ult_nsu": "000000000000200",
  "max_nsu": "000000000000200",
  "cStat": "138",
  "xMotivo": "...",
  "message": "N documento(s) importado(s) da SEFAZ.",
  "consultas": 3
}
```

### Exemplo Node (outro projeto)

```js
import { readFileSync } from "node:fs";

const baseUrl = process.env.MODULO_API_URL; // ex.: https://seu-app.vercel.app
const apiKey = process.env.NFE_DISTRIBUICAO_API_KEY;

const res = await fetch(`${baseUrl}/api/nfe/distribuicao`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Nfe-Api-Key": apiKey,
  },
  body: JSON.stringify({
    cnpj: "12345678000199",
    uf: "RS",
    ultimoNsu: process.env.ULT_NSU || "0",
    pfxBase64: readFileSync("./cert.pfx").toString("base64"),
    passphrase: process.env.CERT_SENHA,
  }),
});

const data = await res.json();
if (!res.ok) throw new Error(data.error || res.statusText);

// Guarde data.ult_nsu no seu banco para a próxima rodada
```

### Descoberta

`GET /api/nfe/distribuicao` → metadados do serviço (sem autenticação).

---

## 4) Copiar o pacote para outro repositório

1. Copie a pasta `packages/nfe-distribuicao-dfe` para o outro repo.
2. Aponte o import (path alias ou `file:` dependency):

```json
{
  "dependencies": {
    "@modulo/nfe-distribuicao-dfe": "file:./packages/nfe-distribuicao-dfe"
  }
}
```

3. Não há dependências npm externas — só Node ≥ 18.

---

## 5) Comportamento SEFAZ (resumo)

| Item | Detalhe |
|------|---------|
| Web service | `NFeDistribuicaoDFe` (AN) |
| Produção | `https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx` |
| Homologação | `https://hom1.nfe.fazenda.gov.br/...` |
| Método | `distNSU` com `ultNSU` (15 dígitos) |
| cStat 137 | Nenhum documento no intervalo |
| cStat 138 | Documentos retornados (`docZip` gzip+base64) |
| Loop | Continua enquanto `ultNSU < maxNSU` (teto configurável) |
| procNFe | XML completo → `xml=1` + `xml_conteudo` |
| resNFe | Resumo → `xml=0` (XML pode chegar depois) |

**Importante:** o chamador deve **persistir** `ultNsu` / `maxNsu` após cada sucesso para não reprocessar o mesmo intervalo.

---

## 6) Segurança

- Não versionar `.pfx`, senhas nem `NFE_DISTRIBUICAO_API_KEY`.
- Em produção, defina `NFE_DISTRIBUICAO_API_KEY` forte e restrinja quem chama a API.
- Preferir service role / server-side para baixar o PFX; nunca expor a senha no client.

---

## 7) Checklist de integração rápida

- [ ] Certificado A1 válido para o CNPJ
- [ ] UF correta (`cUFAutor`)
- [ ] Cursor NSU inicial (`0` se primeira consulta)
- [ ] Escolher: lib local **ou** `POST /api/nfe/distribuicao`
- [ ] Gravar `ult_nsu` após sucesso
- [ ] Tratar `xml=0` (aguardar procNFe ou baixar por chave em rotina futura)
