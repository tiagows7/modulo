# Backup e recriação do banco Supabase

## 1) Backup de DADOS (JSON) — já no projeto

```bash
node scripts/backup/export-backup.mjs
```

Gera `backups/<data-hora>/` com JSON por tabela + `manifest.json`.

Requer no `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (recomendado; com anon a RLS pode cortar dados)

**Não inclui** usuários de Auth (`auth.users`). Exporte pelo Dashboard se precisar.

## 2) Backup SQL completo (schema + dados) — pg_dump

No Dashboard Supabase → **Project Settings → Database → Connection string (URI)**:

```bash
# Exemplo (troque a senha e o host)
pg_dump "postgresql://postgres.[REF]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" ^
  --format=custom --file=backups/full.dump

# Ou SQL texto:
pg_dump "postgresql://..." --no-owner --no-acl -f backups/full.sql
```

Sem `pg_dump` local: use [Supabase CLI](https://supabase.com/docs/guides/cli) ou um cliente Postgres.

## 3) Recriar schema do zero

```bash
node scripts/rebuild/concat-schema.mjs
```

Abre o SQL Editor do novo projeto e executa o arquivo gerado:

`scripts/rebuild/ALL_SCHEMA.sql`

(Ordem também em `scripts/rebuild/ORDER.txt`.)

## 4) Fluxo sugerido para “apagar e gerar de novo”

1. Rodar `node scripts/backup/export-backup.mjs` (e idealmente `pg_dump`)
2. Anotar URL/keys do projeto atual
3. Criar projeto novo no Supabase **ou** resetar o atual
4. Aplicar `ALL_SCHEMA.sql`
5. Recriar usuários Auth / service role key
6. Atualizar `.env.local` com a nova URL/keys
7. Reimportar dados do JSON (ou restaurar o dump) — se precisar de script de import, peça

## Pasta `backups/`

Está no `.gitignore` (não sobe dados para o Git).
