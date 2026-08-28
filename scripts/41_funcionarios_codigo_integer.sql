-- funcionarios.codigo: inteiro (operador no PDV / abertura de caixa / vendas)

-- Extrai dígitos de códigos legados (ex.: FUN-001 → 1) antes de tipar
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS codigo_int INTEGER;

UPDATE public.funcionarios
SET codigo_int = NULLIF(
  regexp_replace(COALESCE(codigo::text, ''), '\D', '', 'g'),
  ''
)::INTEGER
WHERE codigo_int IS NULL;

-- Códigos sem dígitos: gera sequência a partir do maior existente
DO $$
DECLARE
  max_cod INTEGER;
  r RECORD;
BEGIN
  SELECT COALESCE(MAX(codigo_int), 0) INTO max_cod FROM public.funcionarios;
  FOR r IN
    SELECT id
    FROM public.funcionarios
    WHERE codigo_int IS NULL
    ORDER BY created_at NULLS LAST, id
  LOOP
    max_cod := max_cod + 1;
    UPDATE public.funcionarios SET codigo_int = max_cod WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.funcionarios DROP CONSTRAINT IF EXISTS funcionarios_codigo_key;

ALTER TABLE public.funcionarios DROP COLUMN IF EXISTS codigo;

ALTER TABLE public.funcionarios RENAME COLUMN codigo_int TO codigo;

ALTER TABLE public.funcionarios
  ALTER COLUMN codigo SET NOT NULL;

ALTER TABLE public.funcionarios
  ADD CONSTRAINT funcionarios_codigo_key UNIQUE (codigo);

CREATE INDEX IF NOT EXISTS idx_funcionarios_codigo
  ON public.funcionarios (codigo);

COMMENT ON COLUMN public.funcionarios.codigo IS
  'Código numérico do funcionário (abertura de caixa e vendas no PDV)';
