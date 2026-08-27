-- Campos fiscais / unidade / estoque no cadastro de produtos

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS unidade_id UUID
    REFERENCES public.unidade_medida(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS controla_estoque BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS categoria_icm_id UUID
    REFERENCES public.categorias_icm(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS cfop_id UUID
    REFERENCES public.produto_cfop(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS conta_contabil VARCHAR(30);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(30);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS observacao TEXT;

CREATE INDEX IF NOT EXISTS idx_produtos_unidade ON public.produtos (unidade_id);
CREATE INDEX IF NOT EXISTS idx_produtos_categoria_icm ON public.produtos (categoria_icm_id);
CREATE INDEX IF NOT EXISTS idx_produtos_cfop ON public.produtos (cfop_id);

COMMENT ON COLUMN public.produtos.unidade_id IS 'Unidade de medida (unidade_medida)';
COMMENT ON COLUMN public.produtos.controla_estoque IS 'Se true, produto controla estoque';
COMMENT ON COLUMN public.produtos.categoria_icm_id IS 'Categoria ICMS (categorias_icm)';
COMMENT ON COLUMN public.produtos.cfop_id IS 'CFOP padrão (produto_cfop)';
COMMENT ON COLUMN public.produtos.conta_contabil IS 'Conta contábil (aba Contábil)';
COMMENT ON COLUMN public.produtos.centro_custo IS 'Centro de custo (aba Contábil)';
