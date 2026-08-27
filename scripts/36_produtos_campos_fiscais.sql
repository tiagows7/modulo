-- Campos fiscais / contábeis no cadastro de produtos (aba Contábil)

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ibscbs_cst_id UUID
    REFERENCES public.produto_ibscbs_cst(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ibscbs_classtrib_id UUID
    REFERENCES public.produto_ibscbs_classtrib(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ncm_id UUID
    REFERENCES public.produto_ncm(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS cest_id UUID
    REFERENCES public.produto_cest(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS anp_id UUID
    REFERENCES public.produto_anp(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS natureza_receita VARCHAR(10);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS ipi_id UUID
    REFERENCES public.produto_ipi(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS piscofins_id UUID
    REFERENCES public.produto_piscofins(id) ON DELETE SET NULL;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS pct_base_retida NUMERIC(15, 4) DEFAULT 0;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS pct_fundo_pobreza NUMERIC(15, 4) DEFAULT 0;

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS aliquota_monofasica NUMERIC(15, 4) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_produtos_ibscbs_cst ON public.produtos (ibscbs_cst_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ibscbs_classtrib ON public.produtos (ibscbs_classtrib_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ncm ON public.produtos (ncm_id);
CREATE INDEX IF NOT EXISTS idx_produtos_cest ON public.produtos (cest_id);
CREATE INDEX IF NOT EXISTS idx_produtos_anp ON public.produtos (anp_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ipi ON public.produtos (ipi_id);
CREATE INDEX IF NOT EXISTS idx_produtos_piscofins ON public.produtos (piscofins_id);

COMMENT ON COLUMN public.produtos.ibscbs_cst_id IS 'CST IBS/CBS (produto_ibscbs_cst)';
COMMENT ON COLUMN public.produtos.ibscbs_classtrib_id IS 'Classificação tributária IBS/CBS (produto_ibscbs_classtrib)';
COMMENT ON COLUMN public.produtos.ncm_id IS 'Código NCM (produto_ncm)';
COMMENT ON COLUMN public.produtos.cest_id IS 'Código CEST (produto_cest), filtrado pelo NCM';
COMMENT ON COLUMN public.produtos.anp_id IS 'Código ANP (produto_anp)';
COMMENT ON COLUMN public.produtos.natureza_receita IS 'Natureza da receita (PIS/COFINS)';
COMMENT ON COLUMN public.produtos.ipi_id IS 'CST IPI (produto_ipi)';
COMMENT ON COLUMN public.produtos.piscofins_id IS 'CST PIS/COFINS (produto_piscofins)';
COMMENT ON COLUMN public.produtos.pct_base_retida IS '% base retida';
COMMENT ON COLUMN public.produtos.pct_fundo_pobreza IS '% fundo de pobreza (FCP)';
COMMENT ON COLUMN public.produtos.aliquota_monofasica IS 'Alíquota monofásica';
