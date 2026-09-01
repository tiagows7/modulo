-- fornecedores.cidade passa a guardar o código IBGE (inteiro)
-- Idempotente: no schema atual já nasce INTEGER; só converte se ainda for texto.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fornecedores'
      AND column_name = 'cidade'
      AND data_type IN ('character varying', 'text', 'character')
  ) THEN
    ALTER TABLE public.fornecedores
      ALTER COLUMN cidade TYPE INTEGER
      USING (
        CASE
          WHEN cidade IS NULL OR btrim(cidade::text) = '' THEN NULL
          WHEN cidade::text ~ '^[0-9]+$' THEN cidade::integer
          ELSE NULL
        END
      );
  END IF;
END $$;

COMMENT ON COLUMN public.fornecedores.cidade IS 'Código IBGE do município (public.cidades.codigo)';
