-- Tipo da filial: posto de combustível vs outras empresas

ALTER TABLE public.filial
  ADD COLUMN IF NOT EXISTS tipo_filial VARCHAR(20) NOT NULL DEFAULT 'posto';

ALTER TABLE public.filial
  DROP CONSTRAINT IF EXISTS filial_tipo_filial_check;

ALTER TABLE public.filial
  ADD CONSTRAINT filial_tipo_filial_check
  CHECK (tipo_filial IN ('posto', 'empresa'));

COMMENT ON COLUMN public.filial.tipo_filial IS
  'posto = posto de combustível (bicos/tanques); empresa = outras empresas (sem UI de combustível)';

UPDATE public.filial
SET tipo_filial = 'posto'
WHERE tipo_filial IS NULL OR btrim(tipo_filial) = '';
