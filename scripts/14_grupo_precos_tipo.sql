-- Tipos de preço no grupo: percentual | unitario | centavos
ALTER TABLE public.grupo_precos
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'unitario';

UPDATE public.grupo_precos
SET tipo = 'unitario'
WHERE tipo IS NULL
   OR btrim(tipo) = ''
   OR tipo NOT IN ('percentual', 'unitario', 'centavos');

ALTER TABLE public.grupo_precos
  DROP CONSTRAINT IF EXISTS grupo_precos_tipo_check;

ALTER TABLE public.grupo_precos
  ADD CONSTRAINT grupo_precos_tipo_check
  CHECK (tipo IN ('percentual', 'unitario', 'centavos'));

COMMENT ON COLUMN public.grupo_precos.tipo IS
  'Forma do preço: percentual (% sobre tabela), unitario (R$ fixo), centavos (+/- centavos na tabela)';

COMMENT ON COLUMN public.grupo_precos_itens.preco IS
  'Valor conforme tipo do grupo: % , R$ unitário ou centavos';
