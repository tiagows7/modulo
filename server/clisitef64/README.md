# CliSiTef64 (Win64)

Copie aqui os arquivos do pacote **CliSiTef Win64 / Simulado**:

- `CliSiTef64I.dll`
- `libcurl64.dll`
- `libemv64.dll`
- `QREncode64.dll`
- `CliSiTef.ini`

Origem típica:

`C:\Users\tiago\Downloads\Exemplo_CliSiTef-v1\`

## Teste live

```bat
set TEF_MODE=live
set SITEF_IP=192.168.1.7
set SITEF_LOJA=00000000
set SITEF_TERMINAL=PDV0002
npm run tef-bridge
```

No PDV, em `src/services/tef/config.ts`, use `mode: 'live'`.

Node precisa ser **x64** (já compatível com `CliSiTef64I.dll`).
