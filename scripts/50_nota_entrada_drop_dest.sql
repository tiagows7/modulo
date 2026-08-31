-- Remove dados denormalizados do destinatário em nota_entrada.
-- Destinatário é a própria filial do sistema (campo filial).

ALTER TABLE public.nota_entrada
  DROP COLUMN IF EXISTS dest_cnpj,
  DROP COLUMN IF EXISTS dest_cpf,
  DROP COLUMN IF EXISTS dest_razao_social,
  DROP COLUMN IF EXISTS dest_ie,
  DROP COLUMN IF EXISTS dest_uf,
  DROP COLUMN IF EXISTS dest_municipio,
  DROP COLUMN IF EXISTS dest_cmun;

COMMENT ON COLUMN public.nota_entrada.filial IS
  'Filial destinatária (public.filial.id) — dados cadastrais vêm da tabela filial';
