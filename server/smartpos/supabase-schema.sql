-- Schema Supabase para SmartPOS (mesma lógica do Delphi / PISABA + CUPCXA).
-- Rode no SQL Editor do projeto https://vwzpcvrrjohmudsczwhp.supabase.co

-- Caixa aberto (equiv. CUPCXA onde CXASIT = 0)
create table if not exists public.caixa (
  id bigint generated always as identity primary key,
  codigo integer not null,
  data date not null default current_date,
  turno text,
  operador text,
  parametro integer,
  filial text,
  situacao integer not null default 0, -- 0 = aberto
  created_at timestamptz not null default now()
);

create index if not exists idx_caixa_aberto
  on public.caixa (situacao, data desc, codigo desc);

-- Abastecimentos pendentes / baixados (equiv. PISABA)
create table if not exists public.abastecimentos (
  id bigint generated always as identity primary key,
  bico text not null,
  numero integer not null,
  litros numeric(18, 3) not null default 0,
  preco numeric(18, 4) not null default 0,
  valor numeric(18, 2) not null default 0,
  aba integer,
  operador text,
  operador_nome text,
  produto text,
  produto_codigo integer,
  hora timestamptz,
  situacao integer not null default 0,          -- ABASIT: 0 disponível, 1 baixado
  selecionado_app integer null,                 -- ABASELECIONADOAPP: null livre, 1 reservado
  cartao_nsu text,
  cartao_hora text,
  baixado integer null,                         -- ABABXA
  pdv text,
  data date,                                    -- data do concentrador
  medicao numeric(18, 3),                       -- encerrante final do bico
  caixa_operador text,
  caixa_data date,
  caixa_turno text,
  caixa_codigo integer,                         -- código sequencial do caixa
  documento text,                               -- documento de receita da baixa
  cupom text,                                   -- número NFC-e / NF-e
  created_at timestamptz not null default now(),
  unique (bico, numero)
);

create index if not exists idx_abastecimentos_fila
  on public.abastecimentos (situacao, selecionado_app, hora desc);

-- Expor tabelas na Data API (PostgREST)
grant select, insert, update, delete on public.caixa to anon, authenticated, service_role;
grant select, insert, update, delete on public.abastecimentos to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- RLS: ajustar conforme política do posto. Por enquanto liberado para service role / anon com key.
alter table public.caixa enable row level security;
alter table public.abastecimentos enable row level security;

-- Políticas permissivas para a ponte (troque por políticas reais em produção)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'caixa' and policyname = 'caixa_all'
  ) then
    create policy caixa_all on public.caixa for all using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'abastecimentos' and policyname = 'abastecimentos_all'
  ) then
    create policy abastecimentos_all on public.abastecimentos for all using (true) with check (true);
  end if;
end $$;
