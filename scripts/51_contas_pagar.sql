-- Contas a pagar (títulos) + movimentos/pagamentos
-- Legado → snake_case + FKs do ERP (UUID).

-- =============================================================================
-- contas_pagar
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contas_pagar (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    fornecedor UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
    titulo VARCHAR(15) NOT NULL,
    nota_entrada UUID REFERENCES public.nota_entrada(id) ON DELETE SET NULL,
    finalidade VARCHAR(50),
    filial UUID NOT NULL REFERENCES public.filial(id) ON DELETE RESTRICT,

    -- nota = proveniente de NF-e / entrada; despesa = despesa do posto
    tipo VARCHAR(20) NOT NULL DEFAULT 'nota'
      CHECK (tipo IN ('nota', 'despesa')),

    data_emissao DATE,
    data_chegada DATE,
    data_vencimento DATE,

    valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
    valor_saldo NUMERIC(15, 2) NOT NULL DEFAULT 0,
    valor_outros NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- 0 = aberto / pago parcial; 1 = quitado
    situacao INTEGER NOT NULL DEFAULT 0
      CHECK (situacao IN (0, 1)),

    -- Referência ao caixa do PDV (quando lançado/pago no caixa)
    caixa_codigo INTEGER,
    caixa_data DATE,
    caixa_pdv TEXT,
    caixa_turno TEXT,
    caixa_operador TEXT,
    caixa_operador_despesa TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT contas_pagar_filial_fornecedor_titulo_key
      UNIQUE (filial, fornecedor, titulo)
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor
  ON public.contas_pagar (fornecedor);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_filial
  ON public.contas_pagar (filial);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_nota_entrada
  ON public.contas_pagar (nota_entrada);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_vencimento
  ON public.contas_pagar (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_situacao
  ON public.contas_pagar (situacao);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_tipo
  ON public.contas_pagar (tipo);

DROP TRIGGER IF EXISTS update_contas_pagar_modtime ON public.contas_pagar;
CREATE TRIGGER update_contas_pagar_modtime
    BEFORE UPDATE ON public.contas_pagar
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagar
  TO authenticated, anon, service_role;

ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - contas_pagar"
  ON public.contas_pagar;
CREATE POLICY "Permitir acesso autenticado - contas_pagar"
  ON public.contas_pagar FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - contas_pagar"
  ON public.contas_pagar;
CREATE POLICY "Permitir leitura anon - contas_pagar"
  ON public.contas_pagar FOR SELECT
  USING (true);

COMMENT ON TABLE public.contas_pagar IS
  'Títulos a pagar (nota de entrada ou despesa do posto)';
COMMENT ON COLUMN public.contas_pagar.tipo IS
  'nota = NF-e/entrada; despesa = despesa do posto';
COMMENT ON COLUMN public.contas_pagar.situacao IS
  '0 = aberto/parcial; 1 = quitado';
COMMENT ON COLUMN public.contas_pagar.nota_entrada IS
  'Vínculo opcional com nota_entrada quando o título veio de uma NF';
COMMENT ON COLUMN public.contas_pagar.caixa_operador_despesa IS
  'Operador que lançou a despesa no caixa (legado: CAIXA_OPERADORDESPESA)';


-- =============================================================================
-- contas_pagarpagamento
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contas_pagarpagamento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    contas_pagar UUID REFERENCES public.contas_pagar(id) ON DELETE CASCADE,
    filial UUID NOT NULL REFERENCES public.filial(id) ON DELETE RESTRICT,
    fornecedor UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE RESTRICT,
    titulo VARCHAR(15) NOT NULL,

    data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_lancamento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Espelha o tipo do título
    tipo VARCHAR(20) NOT NULL DEFAULT 'nota'
      CHECK (tipo IN ('nota', 'despesa')),

    -- inclusao = abertura do título; pagamento = baixa; estorno = estorno de pagamento
    tipo_transacao VARCHAR(20) NOT NULL DEFAULT 'pagamento'
      CHECK (tipo_transacao IN ('inclusao', 'pagamento', 'estorno')),

    -- +1 crédito (reduz saldo) / -1 débito (aumenta saldo) — conforme legado
    sinal SMALLINT NOT NULL DEFAULT 1
      CHECK (sinal IN (-1, 1)),

    valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
    valor_desconto NUMERIC(15, 2) NOT NULL DEFAULT 0,
    valor_juros NUMERIC(15, 2) NOT NULL DEFAULT 0,

    banco VARCHAR(60),
    banco_numero_documento VARCHAR(40),
    banco_vencimento_documento DATE,

    observacao VARCHAR(30),

    -- Forma de pagamento (public.documentos_caixa.id)
    tipo_pagamento UUID REFERENCES public.documentos_caixa(id) ON DELETE SET NULL,

    caixa_data DATE,
    caixa_operador TEXT,
    caixa_turno TEXT,
    caixa_codigo INTEGER,
    caixa_pdv TEXT,

    -- Sequencial por ano (para referência / estorno)
    numero_pagamento_ano INTEGER NOT NULL,
    numero_pagamento INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT contas_pagarpagamento_ano_numero_key
      UNIQUE (numero_pagamento_ano, numero_pagamento)
);

CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_contas_pagar
  ON public.contas_pagarpagamento (contas_pagar);
CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_filial
  ON public.contas_pagarpagamento (filial);
CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_fornecedor
  ON public.contas_pagarpagamento (fornecedor);
CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_titulo
  ON public.contas_pagarpagamento (titulo);
CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_movimento
  ON public.contas_pagarpagamento (data_movimento);
CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_tipo_transacao
  ON public.contas_pagarpagamento (tipo_transacao);
CREATE INDEX IF NOT EXISTS idx_contas_pagarpagamento_tipo_pagamento
  ON public.contas_pagarpagamento (tipo_pagamento);

DROP TRIGGER IF EXISTS update_contas_pagarpagamento_modtime
  ON public.contas_pagarpagamento;
CREATE TRIGGER update_contas_pagarpagamento_modtime
    BEFORE UPDATE ON public.contas_pagarpagamento
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_pagarpagamento
  TO authenticated, anon, service_role;

ALTER TABLE public.contas_pagarpagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - contas_pagarpagamento"
  ON public.contas_pagarpagamento;
CREATE POLICY "Permitir acesso autenticado - contas_pagarpagamento"
  ON public.contas_pagarpagamento FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - contas_pagarpagamento"
  ON public.contas_pagarpagamento;
CREATE POLICY "Permitir leitura anon - contas_pagarpagamento"
  ON public.contas_pagarpagamento FOR SELECT
  USING (true);

COMMENT ON TABLE public.contas_pagarpagamento IS
  'Movimentos de contas a pagar (inclusão, pagamento e estorno)';
COMMENT ON COLUMN public.contas_pagarpagamento.tipo_transacao IS
  'inclusao | pagamento | estorno';
COMMENT ON COLUMN public.contas_pagarpagamento.sinal IS
  '1 = reduz saldo; -1 = aumenta saldo (ex.: estorno)';
COMMENT ON COLUMN public.contas_pagarpagamento.tipo_pagamento IS
  'Forma de pagamento (public.documentos_caixa.id)';
COMMENT ON COLUMN public.contas_pagarpagamento.numero_pagamento IS
  'Sequencial anual do movimento (estorno referencia o mesmo ano/número)';
COMMENT ON COLUMN public.contas_pagarpagamento.numero_pagamento_ano IS
  'Ano do sequencial de numero_pagamento';


-- Próximo número de pagamento no ano (uso na aplicação)
CREATE OR REPLACE FUNCTION public.next_contas_pagar_numero_pagamento(
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(numero_pagamento), 0) + 1
    INTO v_next
  FROM public.contas_pagarpagamento
  WHERE numero_pagamento_ano = p_ano;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_contas_pagar_numero_pagamento(INTEGER)
  TO authenticated, anon, service_role;
