-- fornecedores.cidade passa a guardar o código IBGE (inteiro)
ALTER TABLE public.fornecedores
  ALTER COLUMN cidade TYPE INTEGER
  USING (
    CASE
      WHEN cidade IS NULL OR btrim(cidade::text) = '' THEN NULL
      WHEN cidade ~ '^[0-9]+$' THEN cidade::integer
      ELSE NULL
    END
  );

COMMENT ON COLUMN public.fornecedores.cidade IS 'Código IBGE do município (public.cidades.codigo)';
