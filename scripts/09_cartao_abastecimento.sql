-- cartao_abastecimento: cartão/frentista do concentrador
-- caixa_* passam a ser preenchidos só na baixa (não na chegada do CBC)

alter table public.abastecimentos
  add column if not exists cartao_abastecimento text;

comment on column public.abastecimentos.cartao_abastecimento is
  'Cartão do frentista/abastecimento (concentrador). Se informado, alimenta operador e operador_nome.';
