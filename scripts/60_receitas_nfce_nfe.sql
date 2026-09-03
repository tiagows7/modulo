-- Receitas vinculadas às vendas NFC-e / NF-e (inclui dados TEF / cartão)
-- Requer: venda_nfce, venda_nfe, pdvs, filial

-- =============================================================================
-- receitas_nfce
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.receitas_nfce (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  venda_nfce UUID NOT NULL REFERENCES public.venda_nfce(id) ON DELETE CASCADE,
  filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
  pdv UUID REFERENCES public.pdvs(id) ON DELETE SET NULL,

  -- Contexto da venda / caixa
  sale_ref VARCHAR(60),
  caixa_codigo VARCHAR(30),
  caixa_data DATE,
  caixa_pdv VARCHAR(20),
  caixa_turno SMALLINT,
  caixa_operador VARCHAR(120),
  n_item INTEGER NOT NULL DEFAULT 1,

  -- Documento / pagamento
  forma_pagamento VARCHAR(40),
  method_id VARCHAR(40),
  label VARCHAR(120),
  valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
  situacao VARCHAR(20) NOT NULL DEFAULT 'aberta',
  -- aberta | recebida | cancelada | estornada

  -- Dados TEF / cartão (CliSiTef)
  campo_131 VARCHAR(60),              -- REDE_DESTINO (campo 131)
  campo_132 VARCHAR(60),              -- TIPO_CARTAO (campo 132)
  recebimento_cartao NUMERIC(15, 2) NOT NULL DEFAULT 0,
  data_prevista DATE,
  modalidade VARCHAR(40),
  bin_rede VARCHAR(20),
  data_cartao VARCHAR(8),             -- AAAAMMDD
  hora_cartao VARCHAR(6),             -- HHMMSS
  autorizacao VARCHAR(40),
  taxa_cartao NUMERIC(15, 4) NOT NULL DEFAULT 0,
  bandeira VARCHAR(60),
  nsu VARCHAR(40),

  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT receitas_nfce_venda_item_key UNIQUE (venda_nfce, n_item)
);

CREATE INDEX IF NOT EXISTS idx_receitas_nfce_venda ON public.receitas_nfce (venda_nfce);
CREATE INDEX IF NOT EXISTS idx_receitas_nfce_filial ON public.receitas_nfce (filial);
CREATE INDEX IF NOT EXISTS idx_receitas_nfce_pdv ON public.receitas_nfce (pdv);
CREATE INDEX IF NOT EXISTS idx_receitas_nfce_sale_ref ON public.receitas_nfce (sale_ref);
CREATE INDEX IF NOT EXISTS idx_receitas_nfce_data_prevista ON public.receitas_nfce (data_prevista);
CREATE INDEX IF NOT EXISTS idx_receitas_nfce_nsu ON public.receitas_nfce (nsu);

DROP TRIGGER IF EXISTS update_receitas_nfce_modtime ON public.receitas_nfce;
CREATE TRIGGER update_receitas_nfce_modtime
  BEFORE UPDATE ON public.receitas_nfce
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receitas_nfce
  TO authenticated, anon, service_role;

ALTER TABLE public.receitas_nfce ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - receitas_nfce" ON public.receitas_nfce;
CREATE POLICY "Permitir acesso autenticado - receitas_nfce"
  ON public.receitas_nfce FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - receitas_nfce" ON public.receitas_nfce;
CREATE POLICY "Permitir leitura anon - receitas_nfce"
  ON public.receitas_nfce FOR SELECT
  USING (true);

COMMENT ON TABLE public.receitas_nfce IS
  'Documentos de receita / recebimentos da venda NFC-e (inclui TEF campos 131/132)';
COMMENT ON COLUMN public.receitas_nfce.campo_131 IS 'CliSiTef campo 131 — rede destino';
COMMENT ON COLUMN public.receitas_nfce.campo_132 IS 'CliSiTef campo 132 — tipo cartão';


-- =============================================================================
-- receitas_nfe
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.receitas_nfe (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  venda_nfe UUID NOT NULL REFERENCES public.venda_nfe(id) ON DELETE CASCADE,
  filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
  pdv UUID REFERENCES public.pdvs(id) ON DELETE SET NULL,

  sale_ref VARCHAR(60),
  caixa_codigo VARCHAR(30),
  caixa_data DATE,
  caixa_pdv VARCHAR(20),
  caixa_turno SMALLINT,
  caixa_operador VARCHAR(120),
  n_item INTEGER NOT NULL DEFAULT 1,

  forma_pagamento VARCHAR(40),
  method_id VARCHAR(40),
  label VARCHAR(120),
  valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
  situacao VARCHAR(20) NOT NULL DEFAULT 'aberta',

  campo_131 VARCHAR(60),
  campo_132 VARCHAR(60),
  recebimento_cartao NUMERIC(15, 2) NOT NULL DEFAULT 0,
  data_prevista DATE,
  modalidade VARCHAR(40),
  bin_rede VARCHAR(20),
  data_cartao VARCHAR(8),
  hora_cartao VARCHAR(6),
  autorizacao VARCHAR(40),
  taxa_cartao NUMERIC(15, 4) NOT NULL DEFAULT 0,
  bandeira VARCHAR(60),
  nsu VARCHAR(40),

  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT receitas_nfe_venda_item_key UNIQUE (venda_nfe, n_item)
);

CREATE INDEX IF NOT EXISTS idx_receitas_nfe_venda ON public.receitas_nfe (venda_nfe);
CREATE INDEX IF NOT EXISTS idx_receitas_nfe_filial ON public.receitas_nfe (filial);
CREATE INDEX IF NOT EXISTS idx_receitas_nfe_pdv ON public.receitas_nfe (pdv);
CREATE INDEX IF NOT EXISTS idx_receitas_nfe_sale_ref ON public.receitas_nfe (sale_ref);
CREATE INDEX IF NOT EXISTS idx_receitas_nfe_data_prevista ON public.receitas_nfe (data_prevista);
CREATE INDEX IF NOT EXISTS idx_receitas_nfe_nsu ON public.receitas_nfe (nsu);

DROP TRIGGER IF EXISTS update_receitas_nfe_modtime ON public.receitas_nfe;
CREATE TRIGGER update_receitas_nfe_modtime
  BEFORE UPDATE ON public.receitas_nfe
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receitas_nfe
  TO authenticated, anon, service_role;

ALTER TABLE public.receitas_nfe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - receitas_nfe" ON public.receitas_nfe;
CREATE POLICY "Permitir acesso autenticado - receitas_nfe"
  ON public.receitas_nfe FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - receitas_nfe" ON public.receitas_nfe;
CREATE POLICY "Permitir leitura anon - receitas_nfe"
  ON public.receitas_nfe FOR SELECT
  USING (true);

COMMENT ON TABLE public.receitas_nfe IS
  'Documentos de receita / recebimentos da venda NF-e (inclui TEF campos 131/132)';
COMMENT ON COLUMN public.receitas_nfe.campo_131 IS 'CliSiTef campo 131 — rede destino';
COMMENT ON COLUMN public.receitas_nfe.campo_132 IS 'CliSiTef campo 132 — tipo cartão';
