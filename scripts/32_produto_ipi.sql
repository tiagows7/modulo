-- Cadastro CST / situação do IPI
-- Origem Firebird: CODigo, DEScricao, GRuPo, COD_INVerso, TRIB

CREATE TABLE IF NOT EXISTS public.produto_ipi (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(2) NOT NULL UNIQUE,
    descricao VARCHAR(80) NOT NULL,
    grupo VARCHAR(3),
    cod_inverso VARCHAR(2),
    trib VARCHAR(1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produto_ipi_descricao
  ON public.produto_ipi (descricao);

DROP TRIGGER IF EXISTS update_produto_ipi_modtime ON public.produto_ipi;
CREATE TRIGGER update_produto_ipi_modtime
    BEFORE UPDATE ON public.produto_ipi
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_ipi
  TO authenticated, anon, service_role;

ALTER TABLE public.produto_ipi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - produto_ipi" ON public.produto_ipi;
CREATE POLICY "Permitir acesso autenticado - produto_ipi"
  ON public.produto_ipi FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - produto_ipi" ON public.produto_ipi;
CREATE POLICY "Permitir leitura anon - produto_ipi"
  ON public.produto_ipi FOR SELECT
  USING (true);

COMMENT ON TABLE public.produto_ipi IS 'CST/situação tributária do IPI';
COMMENT ON COLUMN public.produto_ipi.cod_inverso IS 'Original Firebird: COD_INVerso';
COMMENT ON COLUMN public.produto_ipi.trib IS 'Original Firebird: TRIB (indicador de tributação)';

-- Seed CST IPI (Tabela A / tipicos NF-e)
INSERT INTO public.produto_ipi (codigo, descricao, grupo, cod_inverso, trib)
VALUES
  ('00', 'Entrada com recuperacao de credito', 'ENT', '49', 'S'),
  ('01', 'Entrada tributada com aliquota zero', 'ENT', '50', 'N'),
  ('02', 'Entrada isenta', 'ENT', '51', 'N'),
  ('03', 'Entrada nao-tributada', 'ENT', '52', 'N'),
  ('04', 'Entrada imune', 'ENT', '53', 'N'),
  ('05', 'Entrada com suspensao', 'ENT', '54', 'N'),
  ('49', 'Outras entradas', 'ENT', '00', 'N'),
  ('50', 'Saida tributada', 'SAI', '01', 'S'),
  ('51', 'Saida tributada com aliquota zero', 'SAI', '02', 'N'),
  ('52', 'Saida isenta', 'SAI', '03', 'N'),
  ('53', 'Saida nao-tributada', 'SAI', '04', 'N'),
  ('54', 'Saida imune', 'SAI', '05', 'N'),
  ('55', 'Saida com suspensao', 'SAI', '00', 'N'),
  ('99', 'Outras saidas', 'SAI', '49', 'N')
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  grupo = EXCLUDED.grupo,
  cod_inverso = EXCLUDED.cod_inverso,
  trib = EXCLUDED.trib,
  updated_at = CURRENT_TIMESTAMP;
