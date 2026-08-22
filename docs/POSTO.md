# Abertura do posto (Vercel + rede local)

O site fica na nuvem; no **PC do caixa** um watchdog sobe pontes + proxy local.
O operador **não roda npm** e **não aceita certificado**.

## URL do caixa (obrigatória)

**http://127.0.0.1:39199/pdv**

No login do Windows o watchdog abre essa URL sozinho. Há atalho **PDV Posto** na área de trabalho.

Não use `https://modulo-e9xc.vercel.app/pdv` no caixa: o navegador bloqueia a ponte local a partir do HTTPS da nuvem.

```
Login Windows
   → watchdog (oculto)
       → CBC :39100 (+ HTTPS :39110 fallback)
       → TEF / Fiscal / SmartPOS
       → proxy web :39199  →  Vercel + /__local/cbc
   → abre http://127.0.0.1:39199/pdv
```

## Instalação única (TI)

```bash
npm run posto:autostart
```

Remover: `npm run posto:autostart:off`

## Operador (dia a dia)

1. Ligar o PC e logar.
2. O PDV abre sozinho (ou use o atalho **PDV Posto**).
3. Conferir “Concentrador conectado”.
