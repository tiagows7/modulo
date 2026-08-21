-- Tabela de UFs (estados brasileiros)
CREATE TABLE IF NOT EXISTS public.uf (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(2) UNIQUE NOT NULL,
    descricao VARCHAR(60) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO public.uf (codigo, descricao) VALUES
    ('AC', 'Acre'),
    ('AL', 'Alagoas'),
    ('AP', 'Amapá'),
    ('AM', 'Amazonas'),
    ('BA', 'Bahia'),
    ('CE', 'Ceará'),
    ('DF', 'Distrito Federal'),
    ('ES', 'Espírito Santo'),
    ('GO', 'Goiás'),
    ('MA', 'Maranhão'),
    ('MT', 'Mato Grosso'),
    ('MS', 'Mato Grosso do Sul'),
    ('MG', 'Minas Gerais'),
    ('PA', 'Pará'),
    ('PB', 'Paraíba'),
    ('PR', 'Paraná'),
    ('PE', 'Pernambuco'),
    ('PI', 'Piauí'),
    ('RJ', 'Rio de Janeiro'),
    ('RN', 'Rio Grande do Norte'),
    ('RS', 'Rio Grande do Sul'),
    ('RO', 'Rondônia'),
    ('RR', 'Roraima'),
    ('SC', 'Santa Catarina'),
    ('SP', 'São Paulo'),
    ('SE', 'Sergipe'),
    ('TO', 'Tocantins')
ON CONFLICT (codigo) DO UPDATE
SET descricao = EXCLUDED.descricao,
    updated_at = CURRENT_TIMESTAMP;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.uf TO authenticated, anon, service_role;

ALTER TABLE public.uf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - uf" ON public.uf;
CREATE POLICY "Permitir acesso autenticado - uf"
  ON public.uf FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - uf" ON public.uf;
CREATE POLICY "Permitir leitura anon - uf"
  ON public.uf FOR SELECT
  USING (true);
