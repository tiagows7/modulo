# Abertura do posto (Vercel + rede local)

O sistema web roda na nuvem (**https://modulo-e9xc.vercel.app**).
Concentrador CBC, TEF, fiscal e SmartPOS ficam na **rede local** e só
são alcançados pelas pontes neste PC.

```
Navegador  →  https://modulo-e9xc.vercel.app
     │
     ├─ cadastros / login / Supabase     (nuvem)
     │
     └─ http://127.0.0.1:39100…39103     (pontes neste PC)
              │
              ├─ CBC      → 192.168.1.150:1771
              ├─ TEF      → CliSiTef / pinpad
              ├─ Fiscal   → motor local
              └─ SmartPOS → ponte local
```

## Checklist de abertura

1. PC do caixa na **mesma rede** do concentrador Companytec CBC.
2. Conferir IP do CBC (padrão `192.168.1.150`, porta `1771`).
   - Alterar com variáveis se necessário:
     - `CBC_HOST=192.168.1.150`
     - `CBC_PORT=1771`
3. Na pasta do projeto, subir as pontes:
   ```bash
   npm run posto
   ```
4. Abrir o PDV no navegador **deste mesmo PC**:
   - Produção: https://modulo-e9xc.vercel.app/pdv
   - (ou admin: https://modulo-e9xc.vercel.app )
5. No PDV, conferir o chip do concentrador (online/offline).
6. Se CBC offline:
   - ponte `cbc-bridge` está rodando?
   - ping no IP do concentrador?
   - firewall liberando TCP `1771`?
   - IP/porta iguais ao CBCManager?

## Comandos individuais

| Serviço   | Comando                 | URL local                 |
|-----------|-------------------------|---------------------------|
| Todas     | `npm run posto`         | 39100–39103               |
| CBC       | `npm run cbc-bridge`    | http://127.0.0.1:39100    |
| TEF       | `npm run tef-bridge`    | http://127.0.0.1:39101    |
| Fiscal    | `npm run fiscal-bridge` | http://127.0.0.1:39102    |
| SmartPOS  | `npm run smartpos-bridge` | http://127.0.0.1:39103  |

## Importante

- O **Vercel não acessa** `192.168.x.x`. Sem `npm run posto` no PC do posto, abastecimentos/TEF locais não funcionam.
- As pontes escutam em `127.0.0.1`: use o navegador na **mesma máquina** onde as pontes estão rodando.
- Para desenvolvimento do front local: `npm run dev` (além das pontes, se for testar CBC/TEF).
