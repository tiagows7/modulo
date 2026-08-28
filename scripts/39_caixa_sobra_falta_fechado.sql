-- Campos de fechamento em public.caixa
-- situacao: fechamento do operador no PDV (0 = aberto no PDV, 1 = operador fechou no PDV)
-- fechado: fechamento da retaguarda (true = conferido/fechado no administrativo)
-- sobra_falta: diferença (positiva = sobra, negativa = falta) no fechamento da retaguarda

ALTER TABLE public.caixa
  ADD COLUMN IF NOT EXISTS sobra_falta NUMERIC(15, 2);

ALTER TABLE public.caixa
  ADD COLUMN IF NOT EXISTS fechado BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.caixa.situacao IS
  'PDV: 0 = caixa aberto no PDV, 1 = operador fechou o caixa no PDV';

COMMENT ON COLUMN public.caixa.sobra_falta IS
  'Sobra/falta do fechamento na retaguarda (R$); positivo = sobra, negativo = falta';

COMMENT ON COLUMN public.caixa.fechado IS
  'Retaguarda: true = caixa conferido/fechado no administrativo; false = pendente';

-- Corrige backfill antigo que misturava situacao com fechado.
-- fechado só deve ser true após fechamento na retaguarda.
UPDATE public.caixa
SET fechado = false
WHERE fechado = true;

CREATE INDEX IF NOT EXISTS idx_caixa_fechado
  ON public.caixa (fechado, data DESC, codigo DESC);
