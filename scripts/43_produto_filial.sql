-- Preço / estoque / situação do produto por filial
-- produto e filial usam UUID (padrão do cadastro atual).
-- valor_ultima_venda: 2º "Valor_venda" da especificação (valor da última venda).
-- ultimo_acerto: grafia corrigida de "ulitmo_acerto".

CREATE TABLE IF NOT EXISTS public.produto_filial (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filial UUID NOT NULL REFERENCES public.filial(id) ON DELETE CASCADE,
    produto UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    valor_venda NUMERIC(15, 3) NOT NULL DEFAULT 0,
    ultima_compra DATE,
    fornecedor_compra UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    valor_compra NUMERIC(15, 3) NOT NULL DEFAULT 0,
    ultima_venda DATE,
    cliente_venda UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    valor_ultima_venda NUMERIC(15, 3) NOT NULL DEFAULT 0,
    margem_venda NUMERIC(15, 2) NOT NULL DEFAULT 0,
    situacao VARCHAR(20) NOT NULL DEFAULT 'ativo',
    estoque NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ultimo_acerto DATE,
    margem_oferta NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT produto_filial_filial_produto_key UNIQUE (filial, produto)
);

CREATE INDEX IF NOT EXISTS idx_produto_filial_produto
  ON public.produto_filial (produto);

CREATE INDEX IF NOT EXISTS idx_produto_filial_filial
  ON public.produto_filial (filial);

CREATE INDEX IF NOT EXISTS idx_produto_filial_situacao
  ON public.produto_filial (situacao);

DROP TRIGGER IF EXISTS update_produto_filial_modtime ON public.produto_filial;
CREATE TRIGGER update_produto_filial_modtime
    BEFORE UPDATE ON public.produto_filial
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_filial
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_filial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_filial"
  ON public.produto_filial;
CREATE POLICY "Permitir acesso autenticado - produto_filial"
  ON public.produto_filial FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_filial"
  ON public.produto_filial;
CREATE POLICY "Permitir leitura anon - produto_filial"
  ON public.produto_filial FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_filial IS
  'Dados do produto por filial (preço, estoque, margens, situação)';
COMMENT ON COLUMN public.produto_filial.filial IS 'Filial (public.filial.id)';
COMMENT ON COLUMN public.produto_filial.produto IS 'Produto (public.produtos.id)';
COMMENT ON COLUMN public.produto_filial.valor_venda IS 'Preço de venda na filial';
COMMENT ON COLUMN public.produto_filial.valor_ultima_venda IS
  'Valor da última venda na filial';
COMMENT ON COLUMN public.produto_filial.situacao IS
  'ativo / inativo — produto liberado na filial';
COMMENT ON COLUMN public.produto_filial.ultimo_acerto IS
  'Data do último acerto de estoque na filial';
