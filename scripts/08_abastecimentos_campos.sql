-- Campos extras em abastecimentos (grid PDV ← concentrador CBC)
-- Rode no SQL Editor do Supabase ou via scripts/applyAbastecimentosCampos.mjs

alter table public.abastecimentos
  add column if not exists data date;

alter table public.abastecimentos
  add column if not exists medicao numeric(18, 3);

alter table public.abastecimentos
  add column if not exists caixa_operador text;

alter table public.abastecimentos
  add column if not exists caixa_data date;

alter table public.abastecimentos
  add column if not exists caixa_turno text;

alter table public.abastecimentos
  add column if not exists caixa_codigo integer;

alter table public.abastecimentos
  add column if not exists documento text;

alter table public.abastecimentos
  add column if not exists cupom text;

comment on column public.abastecimentos.data is 'Data do abastecimento (concentrador CBC)';
comment on column public.abastecimentos.hora is 'Data/hora do abastecimento (concentrador CBC)';
comment on column public.abastecimentos.medicao is 'Medição/encerrante final do bico (concentrador)';
comment on column public.abastecimentos.caixa_operador is 'Código/nome do operador do caixa aberto';
comment on column public.abastecimentos.caixa_data is 'Data do caixa aberto';
comment on column public.abastecimentos.caixa_turno is 'Turno do caixa aberto';
comment on column public.abastecimentos.caixa_codigo is 'Código sequencial do caixa aberto';
comment on column public.abastecimentos.documento is 'Documento de receita em que foi baixado';
comment on column public.abastecimentos.cupom is 'Número da NFC-e / NF-e';

create index if not exists idx_abastecimentos_abertos
  on public.abastecimentos (situacao, data desc, hora desc);
