-- Grupos de comissão de produto
-- tipo: percentual | valor

CREATE TABLE IF NOT EXISTS public.produto_grupocomissao (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL UNIQUE,
    descricao VARCHAR(30) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'percentual'
      CHECK (tipo IN ('percentual', 'valor')),
    valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_grupocomissao_descricao
  ON public.produto_grupocomissao (descricao);

DROP TRIGGER IF EXISTS update_produto_grupocomissao_modtime
  ON public.produto_grupocomissao;
CREATE TRIGGER update_produto_grupocomissao_modtime
    BEFORE UPDATE ON public.produto_grupocomissao
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_grupocomissao
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_grupocomissao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_grupocomissao"
  ON public.produto_grupocomissao;
CREATE POLICY "Permitir acesso autenticado - produto_grupocomissao"
  ON public.produto_grupocomissao FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_grupocomissao"
  ON public.produto_grupocomissao;
CREATE POLICY "Permitir leitura anon - produto_grupocomissao"
  ON public.produto_grupocomissao FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_grupocomissao IS 'Grupos de comissão por produto (percentual ou valor)';
COMMENT ON COLUMN public.produto_grupocomissao.tipo IS 'percentual = % sobre venda · valor = valor fixo';

INSERT INTO public.produto_grupocomissao (codigo, descricao, tipo, valor)
VALUES
  ('01', 'Comissao padrao', 'percentual', 1.00),
  ('02', 'Comissao combustivel', 'percentual', 0.50),
  ('03', 'Comissao conveniencia', 'percentual', 2.00),
  ('04', 'Comissao fixa', 'valor', 5.00)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo,
  valor = EXCLUDED.valor,
  updated_at = CURRENT_TIMESTAMP;
