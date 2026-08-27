-- CFOP por produto / operação fiscal
-- Origem Firebird: produto_cfop (campos em maiúsculas misturados)

CREATE TABLE IF NOT EXISTS public.produto_cfop (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(4) NOT NULL UNIQUE,
    descricao VARCHAR(300) NOT NULL,
    flag VARCHAR(1),
    ctrpar VARCHAR(4),
    fls VARCHAR(1),
    atr VARCHAR(30),
    pisc100 CHAR(1),
    pis VARCHAR(2),
    crepiscof CHAR(1),
    forauf VARCHAR(4),
    cst VARCHAR(2),
    anp CHAR(1),
    e115 VARCHAR(10),
    controlacus CHAR(1),
    assumenota CHAR(1),
    obrigadocest CHAR(1),
    informabase CHAR(1),
    geracreditost CHAR(1),
    categoriaicm VARCHAR(2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_cfop_descricao
  ON public.produto_cfop (descricao);

CREATE INDEX IF NOT EXISTS idx_produto_cfop_categoriaicm
  ON public.produto_cfop (categoriaicm);

DROP TRIGGER IF EXISTS update_produto_cfop_modtime ON public.produto_cfop;
CREATE TRIGGER update_produto_cfop_modtime
    BEFORE UPDATE ON public.produto_cfop
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_cfop
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_cfop ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_cfop" ON public.produto_cfop;
CREATE POLICY "Permitir acesso autenticado - produto_cfop"
  ON public.produto_cfop FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_cfop" ON public.produto_cfop;
CREATE POLICY "Permitir leitura anon - produto_cfop"
  ON public.produto_cfop FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_cfop IS 'Cadastro de CFOP com flags fiscais (PIS, CEST, ST, categoria ICMS)';

-- Seed CFOPs comuns (venda / combustível / ST)
INSERT INTO public.produto_cfop (codigo, descricao, flag, categoriaicm, obrigadocest, anp)
VALUES
  ('5101', 'Venda de producao do estabelecimento', 'S', '1', 'N', 'N'),
  ('5102', 'Venda de mercadoria adquirida ou recebida de terceiros', 'S', '1', 'N', 'N'),
  ('5405', 'Venda de mercadoria sujeita a ST, adquirida de terceiros', 'S', '7', 'S', 'N'),
  ('5656', 'Venda de combustivel ou lubrificante - consumidor final', 'S', '10', 'N', 'S'),
  ('5933', 'Prestacao de servico tributado pelo ISSQN', 'S', NULL, 'N', 'N'),
  ('6101', 'Venda de producao do estabelecimento - fora do estado', 'S', '1', 'N', 'N'),
  ('6102', 'Venda de mercadoria adquirida de terceiros - fora do estado', 'S', '1', 'N', 'N'),
  ('6404', 'Venda de mercadoria sujeita a ST - fora do estado', 'S', '7', 'S', 'N'),
  ('6656', 'Venda de combustivel ou lubrificante - fora do estado', 'S', '10', 'N', 'S'),
  ('1102', 'Compra para comercializacao', 'E', '1', 'N', 'N'),
  ('1403', 'Compra para comercializacao em operacao com ST', 'E', '7', 'S', 'N'),
  ('1653', 'Compra de combustivel ou lubrificante para comercializacao', 'E', '10', 'N', 'S')
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  flag = EXCLUDED.flag,
  categoriaicm = EXCLUDED.categoriaicm,
  obrigadocest = EXCLUDED.obrigadocest,
  anp = EXCLUDED.anp,
  updated_at = CURRENT_TIMESTAMP;
