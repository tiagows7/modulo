# @modulo/nfe-distribuicao-dfe

Cliente **Node 18+** (sem Next/Supabase) para consultar a **NFeDistribuicaoDFe** do Ambiente Nacional com certificado A1 (PFX).

Documentação completa no monorepo: [`docs/NFE_DISTRIBUICAO_DFE.md`](../../docs/NFE_DISTRIBUICAO_DFE.md).

## Uso rápido

```ts
import { readFileSync } from "node:fs";
import { distribuirDfePorNsu } from "@modulo/nfe-distribuicao-dfe";

const result = await distribuirDfePorNsu({
  cnpj: "00000000000000",
  uf: "RS",
  ultimoNsu: "0", // em branco → use "0"
  pfx: readFileSync("./certificado.pfx"),
  passphrase: "senha-do-pfx",
  tpAmb: 1, // 1 produção | 2 homologação
});

console.log(result.ultNsu, result.docs.length);
for (const doc of result.docs) {
  if (doc.xml_conteudo) {
    // procNFe completo — gravar onde o seu sistema precisar
  }
}
```

## Reuso em outro repositório

1. Copie a pasta `packages/nfe-distribuicao-dfe` para o outro projeto, **ou**
2. Chame a API HTTP deste sistema: `POST /api/nfe/distribuicao` (ver doc).

Dependências: apenas módulos nativos do Node (`https`, `zlib`).
