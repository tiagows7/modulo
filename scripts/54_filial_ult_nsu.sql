-- Cursor NSU da distribuição DF-e (últimas notas importadas da SEFAZ) por filial

ALTER TABLE public.filial
  ADD COLUMN IF NOT EXISTS ult_nsu VARCHAR(30);

COMMENT ON COLUMN public.filial.ult_nsu IS
  'Última NSU consultada/importada na distribuição DF-e (SEFAZ) para esta filial';

-- Inicializa com o maior NSU numérico já presente no manifesto (quando houver)
UPDATE public.filial f
SET ult_nsu = sub.max_nsu
FROM (
  SELECT
    m.filial,
    (
      SELECT m2.nsu
      FROM public.nota_entradamanifesto m2
      WHERE m2.filial = m.filial
        AND m2.nsu IS NOT NULL
        AND btrim(m2.nsu) <> ''
        AND m2.nsu ~ '^[0-9]+$'
      ORDER BY m2.nsu::numeric DESC
      LIMIT 1
    ) AS max_nsu
  FROM public.nota_entradamanifesto m
  WHERE m.filial IS NOT NULL
  GROUP BY m.filial
) sub
WHERE f.id = sub.filial
  AND sub.max_nsu IS NOT NULL
  AND (f.ult_nsu IS NULL OR btrim(f.ult_nsu) = '');
