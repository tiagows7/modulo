-- Código de barras nos produtos (pesquisa PDV loja / conveniência)

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_codigo_barras_unique
  ON public.produtos (codigo_barras)
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '';

CREATE INDEX IF NOT EXISTS idx_produtos_codigo_barras
  ON public.produtos (codigo_barras);

COMMENT ON COLUMN public.produtos.codigo_barras IS
  'Código de barras (EAN/GTIN). No PDV loja: qty*codigo ou qty.codigo';
