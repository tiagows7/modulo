-- Regime tributário / tipo de empresa da filial (CRT da NF-e)

ALTER TABLE public.filial
  ADD COLUMN IF NOT EXISTS tipo_empresa VARCHAR(20) NOT NULL DEFAULT 'simples';

ALTER TABLE public.filial
  DROP CONSTRAINT IF EXISTS filial_tipo_empresa_check;

ALTER TABLE public.filial
  ADD CONSTRAINT filial_tipo_empresa_check
  CHECK (tipo_empresa IN ('simples', 'simples_excesso', 'regime_normal'));

COMMENT ON COLUMN public.filial.tipo_empresa IS
  'Regime tributário (CRT): simples=1, simples_excesso=2, regime_normal=3';

UPDATE public.filial
SET tipo_empresa = 'simples'
WHERE tipo_empresa IS NULL OR btrim(tipo_empresa) = '';
