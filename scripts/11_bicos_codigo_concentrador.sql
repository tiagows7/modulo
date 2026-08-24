-- Código do bico no concentrador (CBC). Mantém identificacao_bomba preenchida
-- para compatibilidade com NOT NULL legado.

ALTER TABLE public.bicos
  ADD COLUMN IF NOT EXISTS codigo_concentrador VARCHAR(20);

COMMENT ON COLUMN public.bicos.codigo_concentrador IS 'Código do bico no concentrador CBC';
COMMENT ON COLUMN public.bicos.identificacao_bomba IS 'Identificação / código concentrador (legado)';
COMMENT ON COLUMN public.bicos.numero IS 'Número do bico no posto';
COMMENT ON COLUMN public.bicos.filial IS 'Filial (public.filial.id)';

CREATE INDEX IF NOT EXISTS idx_bicos_codigo_concentrador ON public.bicos (codigo_concentrador);
