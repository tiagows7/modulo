-- Grupo de preços: preços diferenciados por cliente
CREATE TABLE IF NOT EXISTS public.grupo_precos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    tipo VARCHAR(20) NOT NULL DEFAULT 'unitario'
      CHECK (tipo IN ('percentual', 'unitario', 'centavos')),
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.grupo_precos_itens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grupo_id UUID NOT NULL REFERENCES public.grupo_precos(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    preco DECIMAL(10, 4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (grupo_id, produto_id)
);

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS grupo_preco_id UUID
  REFERENCES public.grupo_precos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grupo_precos_descricao
  ON public.grupo_precos (descricao);

CREATE INDEX IF NOT EXISTS idx_grupo_precos_itens_grupo
  ON public.grupo_precos_itens (grupo_id);

CREATE INDEX IF NOT EXISTS idx_clientes_grupo_preco
  ON public.clientes (grupo_preco_id);

DROP TRIGGER IF EXISTS update_grupo_precos_modtime ON public.grupo_precos;
CREATE TRIGGER update_grupo_precos_modtime
    BEFORE UPDATE ON public.grupo_precos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_grupo_precos_itens_modtime ON public.grupo_precos_itens;
CREATE TRIGGER update_grupo_precos_itens_modtime
    BEFORE UPDATE ON public.grupo_precos_itens
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupo_precos
  TO authenticated, anon, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupo_precos_itens
  TO authenticated, anon, service_role;

ALTER TABLE public.grupo_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_precos_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - grupo_precos" ON public.grupo_precos;
CREATE POLICY "Permitir acesso autenticado - grupo_precos"
  ON public.grupo_precos FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - grupo_precos" ON public.grupo_precos;
CREATE POLICY "Permitir leitura anon - grupo_precos"
  ON public.grupo_precos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir acesso autenticado - grupo_precos_itens" ON public.grupo_precos_itens;
CREATE POLICY "Permitir acesso autenticado - grupo_precos_itens"
  ON public.grupo_precos_itens FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - grupo_precos_itens" ON public.grupo_precos_itens;
CREATE POLICY "Permitir leitura anon - grupo_precos_itens"
  ON public.grupo_precos_itens FOR SELECT
  USING (true);

COMMENT ON TABLE public.grupo_precos IS 'Grupos de preços diferenciados para clientes';
COMMENT ON COLUMN public.clientes.grupo_preco_id IS 'Grupo de preços do cliente (opcional)';
