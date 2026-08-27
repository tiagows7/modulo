-- Outras informações do produto: volume, estoque mínimo, peso, qtd embalagem

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS volume NUMERIC(15, 4);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS estoque_minimo NUMERIC(15, 3) DEFAULT 0;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS peso NUMERIC(15, 4);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS qtd_embalagem NUMERIC(15, 3) DEFAULT 1;

COMMENT ON COLUMN public.produtos.volume IS 'Volume do produto';
COMMENT ON COLUMN public.produtos.estoque_minimo IS 'Estoque mínimo para alerta';
COMMENT ON COLUMN public.produtos.peso IS 'Peso do produto';
COMMENT ON COLUMN public.produtos.qtd_embalagem IS 'Quantidade na embalagem';
