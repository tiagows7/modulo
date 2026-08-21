-- Expande clientes e cria veiculos (N:1 com clientes)

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS cep VARCHAR(12);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS endereco VARCHAR(255);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS numero VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS complemento VARCHAR(100);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS bairro VARCHAR(120);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS uf VARCHAR(2);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fone1 VARCHAR(20);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fone2 VARCHAR(20);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fone3 VARCHAR(20);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS identidade VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS inscricao_municipal VARCHAR(30);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email VARCHAR(180);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email2 VARCHAR(180);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS contato VARCHAR(120);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS observacao TEXT;

-- Migra telefone antigo para fone1 quando vazio
UPDATE public.clientes
SET fone1 = telefone
WHERE (fone1 IS NULL OR btrim(fone1) = '')
  AND telefone IS NOT NULL
  AND btrim(telefone) <> '';

-- cidade passa a ser código IBGE (inteiro)
ALTER TABLE public.clientes
  ALTER COLUMN cidade TYPE INTEGER
  USING (
    CASE
      WHEN cidade IS NULL OR btrim(cidade::text) = '' THEN NULL
      WHEN cidade::text ~ '^[0-9]+$' THEN cidade::integer
      ELSE NULL
    END
  );

COMMENT ON COLUMN public.clientes.cidade IS 'Código IBGE do município (public.cidades.codigo)';

CREATE TABLE IF NOT EXISTS public.veiculos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    placa VARCHAR(10) NOT NULL,
    descricao VARCHAR(120),
    frota VARCHAR(60),
    ultima_km NUMERIC(12, 1),
    obrigado_km BOOLEAN NOT NULL DEFAULT false,
    obrigado_autorizacao BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cliente_id, placa)
);

CREATE INDEX IF NOT EXISTS idx_veiculos_cliente ON public.veiculos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_veiculos_placa ON public.veiculos (placa);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos
  TO authenticated, anon, service_role;

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - veiculos" ON public.veiculos;
CREATE POLICY "Permitir acesso autenticado - veiculos"
  ON public.veiculos FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - veiculos" ON public.veiculos;
CREATE POLICY "Permitir leitura anon - veiculos"
  ON public.veiculos FOR SELECT
  USING (true);
