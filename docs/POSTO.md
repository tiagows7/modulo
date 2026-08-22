# Abertura do posto (Vercel + rede local)

O sistema web roda na nuvem (**https://modulo-e9xc.vercel.app**).
Concentrador CBC, TEF, fiscal e SmartPOS ficam na **rede local**.

**Importante:** o Vercel **não consegue** iniciar programas no PC nem
falar com `192.168.x.x`. O navegador também não pode disparar `npm`
sozinho (bloqueio de segurança). Por isso as pontes precisam estar
rodando **neste PC** — de preferência em **autostart**.

```
Navegador  →  https://modulo-e9xc.vercel.app/pdv
     │
     ├─ cadastros / login / Supabase     (nuvem)
     │
     └─ https://127.0.0.1:39110          (CBC HTTPS — obrigatório no Vercel)
        http://127.0.0.1:39100…39103     (HTTP local / fallback)
              │
              ├─ CBC      → 192.168.1.150:1771
              ├─ TEF      → CliSiTef / pinpad
              ├─ Fiscal   → motor local
              └─ SmartPOS → ponte local
```

## Instalação única (recomendado)

No PC do caixa, na pasta do projeto:

```bash
npm run posto:autostart
```

Isso registra uma tarefa do Windows que:
- sobe CBC / TEF / Fiscal / SmartPOS **ao logar**
- inicia as pontes **já na hora** da instalação

**Primeira vez (Chrome/Edge):** abra
[https://127.0.0.1:39110/health](https://127.0.0.1:39110/health),
clique em **Avançado → Continuar** (certificado local) e depois recarregue o PDV.
Sem esse passo, o navegador bloqueia a ponte mesmo com as pontes ligadas.

Depois disso, basta abrir o PDV no Vercel — sem digitar `npm run posto`.

Remover o autostart:

```bash
npm run posto:autostart:off
```

## Checklist diário

1. PC do caixa ligado e logado (autostart já sobe as pontes).
2. Aceitar o certificado HTTPS local (só na 1ª vez / se o certificado mudou).
3. Abrir https://modulo-e9xc.vercel.app/pdv **neste mesmo PC**.
4. Conferir o chip “Concentrador conectado”.
5. Se offline:
   - reiniciar o PC ou rodar `npm run posto`
   - abrir `https://127.0.0.1:39110/health` e aceitar o aviso
   - ping no IP do CBC (`192.168.1.150`)
   - firewall liberando TCP `1771`
   - IP/porta iguais ao CBCManager

Variáveis opcionais:
- `CBC_HOST=192.168.1.150`
- `CBC_PORT=1771`

## Comandos manuais

| Serviço   | Comando                     | URL local               |
|-----------|-----------------------------|-------------------------|
| Autostart | `npm run posto:autostart`   | —                       |
| Todas     | `npm run posto`             | 39100–39103 (+ CBC 39110 HTTPS) |
| CBC       | `npm run cbc-bridge`        | http://127.0.0.1:39100 / https://127.0.0.1:39110 |
| TEF       | `npm run tef-bridge`        | http://127.0.0.1:39101  |
| Fiscal    | `npm run fiscal-bridge`     | http://127.0.0.1:39102  |
| SmartPOS  | `npm run smartpos-bridge`   | http://127.0.0.1:39103  |

## Por que não é 100% “pelo Vercel”?

Sites na internet **não têm permissão** para executar Node/DLL no Windows
nem acessar o concentrador na LAN. Além disso, página **HTTPS** (Vercel)
não pode falar com **HTTP** em `127.0.0.1` (mixed content) — por isso a
ponte CBC também escuta em **HTTPS :39110**.

Fluxo automático correto:

1. Windows liga → pontes sobem sozinhas (autostart)
2. Operador aceita o certificado local 1x (`https://127.0.0.1:39110/health`)
3. Operador abre o PDV no Vercel
4. O PDV no navegador fala com `127.0.0.1:39110` (ponte CBC HTTPS)