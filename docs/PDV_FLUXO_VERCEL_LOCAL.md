# Fluxo PDV: Vercel → PC local

Fluxo oficial do caixa:

1. Operador acessa o **site na Vercel** e faz login com usuário PDV  
2. A nuvem abre `/pdv-launch` → chama o agente local **`:39200/wake`**  
3. O watchdog sobe as pontes (`npm run posto`: CBC/TEF/Fiscal/SmartPOS + proxy **`:39199`**)  
4. A sessão é transferida para `http://127.0.0.1:39199` e o PDV abre

```text
Vercel (login)
    → /pdv-launch          (nuvem)
    → POST :39200/wake     (watchdog no PC)
    → espera :39199/health
    → /pdv-auth-handoff    (grava sessão no origin local)
    → /pdv#/venda
```

## Instalação no PC do caixa (uma vez)

```bash
npm run posto:autostart
```

Isso registra o **watchdog** no login do Windows:

- Mantém proxy `http://127.0.0.1:39199/pdv`
- Expõe agente `http://127.0.0.1:39200/wake` e `/health`

Manual (sem autostart):

```bash
npm run posto
# ou só o watchdog:
node scripts/posto-watchdog.mjs
```

## Portas

| Porta | Serviço |
|------:|---------|
| 39199 | Proxy web do PDV (Vercel + CBC local) |
| 39200 | Agente wake do watchdog |
| 39100 | CBC |
| 39101 | TEF |
| 39102 | Fiscal |
| 39103 | SmartPOS |

## Observação

O navegador **não consegue** iniciar o Node sozinho. O watchdog precisa já estar instalado/rodando no Windows para o `/wake` da Vercel funcionar. Sem isso, `/pdv-launch` mostra instruções para `posto:autostart`.
