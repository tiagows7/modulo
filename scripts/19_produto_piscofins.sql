-- Tabela PIS/COFINS (cadastro fiscal)
-- Origem Firebird: desricao → descricao; 011102..011105 → ind_011102.. (Postgres não aceita nome iniciando com número)

CREATE TABLE IF NOT EXISTS public.produto_piscofins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL UNIQUE,
    descricao VARCHAR(80) NOT NULL,
    percentual_pis NUMERIC(15, 2),
    grupo_pis VARCHAR(3),
    percentual_cofins NUMERIC(15, 2),
    grupo_cofins VARCHAR(3),
    ind_011102 VARCHAR(1),
    ind_011103 VARCHAR(1),
    ind_011104 VARCHAR(1),
    ind_011105 VARCHAR(1),
    perres NUMERIC(15, 2),
    natrec VARCHAR(3),
    codinv VARCHAR(2),
    codin2 VARCHAR(2),
    basezero CHAR(1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_piscofins_descricao
  ON public.produto_piscofins (descricao);

DROP TRIGGER IF EXISTS update_produto_piscofins_modtime ON public.produto_piscofins;
CREATE TRIGGER update_produto_piscofins_modtime
    BEFORE UPDATE ON public.produto_piscofins
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_piscofins
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_piscofins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_piscofins" ON public.produto_piscofins;
CREATE POLICY "Permitir acesso autenticado - produto_piscofins"
  ON public.produto_piscofins FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_piscofins" ON public.produto_piscofins;
CREATE POLICY "Permitir leitura anon - produto_piscofins"
  ON public.produto_piscofins FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_piscofins IS 'Cadastro de códigos/situações PIS e COFINS';
COMMENT ON COLUMN public.produto_piscofins.ind_011102 IS 'Original Firebird: 011102';
COMMENT ON COLUMN public.produto_piscofins.ind_011103 IS 'Original Firebird: 011103';
COMMENT ON COLUMN public.produto_piscofins.ind_011104 IS 'Original Firebird: 011104';
COMMENT ON COLUMN public.produto_piscofins.ind_011105 IS 'Original Firebird: 011105';
