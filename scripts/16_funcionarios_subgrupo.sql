-- Funcionários + Sub-grupo de produtos (ligado a grupo_produtos e produtos)

CREATE TABLE IF NOT EXISTS public.funcionarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14),
    cargo VARCHAR(100),
    telefone VARCHAR(20),
    email VARCHAR(180),
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.subgrupo_produtos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    grupo_id UUID NOT NULL REFERENCES public.grupo_produtos(id) ON DELETE RESTRICT,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS subgrupo_id UUID
  REFERENCES public.subgrupo_produtos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_nome ON public.funcionarios (nome);
CREATE INDEX IF NOT EXISTS idx_subgrupo_produtos_grupo ON public.subgrupo_produtos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_produtos_subgrupo ON public.produtos (subgrupo_id);

DROP TRIGGER IF EXISTS update_funcionarios_modtime ON public.funcionarios;
CREATE TRIGGER update_funcionarios_modtime
    BEFORE UPDATE ON public.funcionarios
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_subgrupo_produtos_modtime ON public.subgrupo_produtos;
CREATE TRIGGER update_subgrupo_produtos_modtime
    BEFORE UPDATE ON public.subgrupo_produtos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios
  TO authenticated, anon, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subgrupo_produtos
  TO authenticated, anon, service_role;

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subgrupo_produtos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - funcionarios" ON public.funcionarios;
CREATE POLICY "Permitir acesso autenticado - funcionarios"
  ON public.funcionarios FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - funcionarios" ON public.funcionarios;
CREATE POLICY "Permitir leitura anon - funcionarios"
  ON public.funcionarios FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir acesso autenticado - subgrupo_produtos" ON public.subgrupo_produtos;
CREATE POLICY "Permitir acesso autenticado - subgrupo_produtos"
  ON public.subgrupo_produtos FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - subgrupo_produtos" ON public.subgrupo_produtos;
CREATE POLICY "Permitir leitura anon - subgrupo_produtos"
  ON public.subgrupo_produtos FOR SELECT
  USING (true);

COMMENT ON TABLE public.funcionarios IS 'Cadastro de funcionários';
COMMENT ON TABLE public.subgrupo_produtos IS 'Sub-grupos de produtos vinculados a grupo_produtos';
COMMENT ON COLUMN public.produtos.subgrupo_id IS 'Sub-grupo do produto (opcional)';
