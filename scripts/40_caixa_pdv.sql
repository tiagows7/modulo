-- Identificação do PDV em public.caixa
-- Necessário quando a filial possui mais de um PDV/terminal

ALTER TABLE public.caixa
  ADD COLUMN IF NOT EXISTS pdv TEXT;

COMMENT ON COLUMN public.caixa.pdv IS
  'Código/identificação do PDV (terminal) que abriu o caixa; permite múltiplos PDVs por filial';

CREATE INDEX IF NOT EXISTS idx_caixa_pdv
  ON public.caixa (pdv, data DESC, codigo DESC);

CREATE INDEX IF NOT EXISTS idx_caixa_filial_pdv
  ON public.caixa (filial, pdv, data DESC, codigo DESC);

-- Caixas antigos sem PDV ficam no terminal 1
UPDATE public.caixa
SET pdv = '1'
WHERE pdv IS NULL OR btrim(pdv) = '';
