-- De-para: código do produto no XML do fornecedor → produto do sistema
-- Usado na importação de NF-e de entrada para preencher itens automaticamente.

CREATE TABLE IF NOT EXISTS public.nota_xmlproduto (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    fornecedor UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    fornecedor_xml VARCHAR(30),
    produto_xml VARCHAR(100) NOT NULL,
    produto_sistema UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,

    volume NUMERIC(15, 3) NOT NULL DEFAULT 0,
    volume2 NUMERIC(15, 3) NOT NULL DEFAULT 0,

    codigobarras_xml VARCHAR(20),
    ncm_xml VARCHAR(20),
    cest_xml VARCHAR(20),
    anp_xml VARCHAR(20),
    cst_xml VARCHAR(20),
    piscofins_xml VARCHAR(20),
    cfop_xml VARCHAR(20),
    codigobeneficio_xml VARCHAR(20),
    unidade_xml VARCHAR(20),
    percentualicm_xml NUMERIC(15, 2) NOT NULL DEFAULT 0,
    cstibscbs_xml INTEGER,
    classtrib_xml VARCHAR(6),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT nota_xmlproduto_fornecedor_produto_xml_key
      UNIQUE (fornecedor, produto_xml)
);

CREATE INDEX IF NOT EXISTS idx_nota_xmlproduto_produto_xml
  ON public.nota_xmlproduto (produto_xml);
CREATE INDEX IF NOT EXISTS idx_nota_xmlproduto_fornecedor_xml
  ON public.nota_xmlproduto (fornecedor_xml);
CREATE INDEX IF NOT EXISTS idx_nota_xmlproduto_produto_sistema
  ON public.nota_xmlproduto (produto_sistema);

DROP TRIGGER IF EXISTS update_nota_xmlproduto_modtime ON public.nota_xmlproduto;
CREATE TRIGGER update_nota_xmlproduto_modtime
    BEFORE UPDATE ON public.nota_xmlproduto
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_xmlproduto
  TO authenticated, anon, service_role;

ALTER TABLE public.nota_xmlproduto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - nota_xmlproduto"
  ON public.nota_xmlproduto;
CREATE POLICY "Permitir acesso autenticado - nota_xmlproduto"
  ON public.nota_xmlproduto FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - nota_xmlproduto"
  ON public.nota_xmlproduto;
CREATE POLICY "Permitir leitura anon - nota_xmlproduto"
  ON public.nota_xmlproduto FOR SELECT
  USING (true);

COMMENT ON TABLE public.nota_xmlproduto IS
  'Vínculo código produto XML (fornecedor) → produto do sistema';
COMMENT ON COLUMN public.nota_xmlproduto.fornecedor IS
  'Fornecedor (public.fornecedores.id) — no legado era INTEGER';
COMMENT ON COLUMN public.nota_xmlproduto.produto_xml IS
  'Código do produto no XML (cProd)';
COMMENT ON COLUMN public.nota_xmlproduto.produto_sistema IS
  'Produto interno (public.produtos.id) — no legado era INTEGER';
COMMENT ON COLUMN public.nota_xmlproduto.fornecedor_xml IS
  'Código auxiliar do fornecedor no XML (opcional)';

-- Guarda o XML completo no manifesto para reprocessar itens / vínculos
ALTER TABLE public.nota_entradamanifesto
  ADD COLUMN IF NOT EXISTS xml_conteudo TEXT;

COMMENT ON COLUMN public.nota_entradamanifesto.xml_conteudo IS
  'XML completo da NF-e importada (para itens e vínculo de produtos)';
