-- Grupo de comissão em grupo_produtos e produtos

ALTER TABLE public.grupo_produtos
  ADD COLUMN IF NOT EXISTS grupocomissao_id UUID
    REFERENCES public.produto_grupocomissao(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS grupocomissao_id UUID
    REFERENCES public.produto_grupocomissao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grupo_produtos_grupocomissao
  ON public.grupo_produtos (grupocomissao_id);

CREATE INDEX IF NOT EXISTS idx_produtos_grupocomissao
  ON public.produtos (grupocomissao_id);

COMMENT ON COLUMN public.grupo_produtos.grupocomissao_id IS
  'Grupo de comissão padrão (produto_grupocomissao)';
COMMENT ON COLUMN public.produtos.grupocomissao_id IS
  'Grupo de comissão do produto (produto_grupocomissao)';
