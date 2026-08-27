-- Tabela PIS/COFINS (cadastro fiscal)
-- Origem Firebird: desricao → descricao; 011102..011105 → ind_011102.. (Postgres não aceita nome iniciando com número)

CREATE TABLE IF NOT EXISTS public.pis_cofins (
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

CREATE INDEX IF NOT EXISTS idx_pis_cofins_descricao
  ON public.pis_cofins (descricao);

DROP TRIGGER IF EXISTS update_pis_cofins_modtime ON public.pis_cofins;
CREATE TRIGGER update_pis_cofins_modtime
    BEFORE UPDATE ON public.pis_cofins
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pis_cofins
  TO authenticated, anon, service_role;

ALTER TABLE public.pis_cofins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - pis_cofins" ON public.pis_cofins;
CREATE POLICY "Permitir acesso autenticado - pis_cofins"
  ON public.pis_cofins FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - pis_cofins" ON public.pis_cofins;
CREATE POLICY "Permitir leitura anon - pis_cofins"
  ON public.pis_cofins FOR SELECT
  USING (true);

COMMENT ON TABLE public.pis_cofins IS 'Cadastro de códigos/situações PIS e COFINS';
COMMENT ON COLUMN public.pis_cofins.ind_011102 IS 'Original Firebird: 011102';
COMMENT ON COLUMN public.pis_cofins.ind_011103 IS 'Original Firebird: 011103';
COMMENT ON COLUMN public.pis_cofins.ind_011104 IS 'Original Firebird: 011104';
COMMENT ON COLUMN public.pis_cofins.ind_011105 IS 'Original Firebird: 011105';
