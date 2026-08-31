-- Remove dados denormalizados do emitente em nota_entrada.
-- Mantém apenas fornecedor UUID → public.fornecedores(id).

DROP INDEX IF EXISTS public.idx_nota_entrada_emit_cnpj;

ALTER TABLE public.nota_entrada
  DROP COLUMN IF EXISTS emit_cnpj,
  DROP COLUMN IF EXISTS emit_cpf,
  DROP COLUMN IF EXISTS emit_razao_social,
  DROP COLUMN IF EXISTS emit_fantasia,
  DROP COLUMN IF EXISTS emit_ie,
  DROP COLUMN IF EXISTS emit_im,
  DROP COLUMN IF EXISTS emit_uf,
  DROP COLUMN IF EXISTS emit_municipio,
  DROP COLUMN IF EXISTS emit_cmun,
  DROP COLUMN IF EXISTS emit_endereco,
  DROP COLUMN IF EXISTS emit_numero,
  DROP COLUMN IF EXISTS emit_bairro,
  DROP COLUMN IF EXISTS emit_cep,
  DROP COLUMN IF EXISTS emit_fone;

COMMENT ON COLUMN public.nota_entrada.fornecedor IS
  'Fornecedor (public.fornecedores.id) — único vínculo; dados cadastrais vêm da tabela fornecedores';
