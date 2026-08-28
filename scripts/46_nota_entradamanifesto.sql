-- Manifesto / consulta DF-e de notas de entrada (legado → snake_case + FKs do ERP)
-- Campos originais: FILIAL, CHAVE, FORNECEDOR, FORNECEDOR_NOME, FORNECEDOR_CNPJ,
-- FORNECEDOR_IE, EMISSAO, NUMERO, VALOR, CAMINHO, MANIFESTO_REGISTRO,
-- MANIFESTO_PROTOCOLO, NSU, XML, DIGITADA, NOTA_COMPRA.

CREATE TABLE IF NOT EXISTS public.nota_entradamanifesto (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
    chave VARCHAR(44),
    fornecedor UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    fornecedor_nome VARCHAR(120),
    fornecedor_cnpj VARCHAR(14),
    fornecedor_ie VARCHAR(14),
    emissao DATE,
    numero INTEGER,
    valor NUMERIC(15, 2) NOT NULL DEFAULT 0,
    caminho VARCHAR(350),
    manifesto_registro TIMESTAMPTZ,
    manifesto_protocolo VARCHAR(40),
    nsu VARCHAR(30),
    -- Flags legado (0/1): XML baixado / nota digitada
    xml INTEGER NOT NULL DEFAULT 0,
    digitada INTEGER NOT NULL DEFAULT 0,
    -- Nota de entrada já lançada no sistema (quando houver vínculo)
    nota_compra UUID REFERENCES public.nota_entrada(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT nota_entradamanifesto_chave_key UNIQUE (chave)
);

CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_filial
  ON public.nota_entradamanifesto (filial);
CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_fornecedor
  ON public.nota_entradamanifesto (fornecedor);
CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_emissao
  ON public.nota_entradamanifesto (emissao);
CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_nsu
  ON public.nota_entradamanifesto (nsu);
CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_nota_compra
  ON public.nota_entradamanifesto (nota_compra);
CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_digitada
  ON public.nota_entradamanifesto (digitada);

DROP TRIGGER IF EXISTS update_nota_entradamanifesto_modtime
  ON public.nota_entradamanifesto;
CREATE TRIGGER update_nota_entradamanifesto_modtime
    BEFORE UPDATE ON public.nota_entradamanifesto
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_entradamanifesto
  TO authenticated, anon, service_role;

ALTER TABLE public.nota_entradamanifesto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - nota_entradamanifesto"
  ON public.nota_entradamanifesto;
CREATE POLICY "Permitir acesso autenticado - nota_entradamanifesto"
  ON public.nota_entradamanifesto FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - nota_entradamanifesto"
  ON public.nota_entradamanifesto;
CREATE POLICY "Permitir leitura anon - nota_entradamanifesto"
  ON public.nota_entradamanifesto FOR SELECT
  USING (true);

COMMENT ON TABLE public.nota_entradamanifesto IS
  'Manifesto / DF-e de notas a entrar (chave, NSU, protocolo, vínculo com nota_entrada)';
COMMENT ON COLUMN public.nota_entradamanifesto.filial IS
  'Filial (public.filial.id) — no legado era VARCHAR(3) código';
COMMENT ON COLUMN public.nota_entradamanifesto.fornecedor IS
  'Fornecedor (public.fornecedores.id) — no legado era INTEGER código';
COMMENT ON COLUMN public.nota_entradamanifesto.xml IS
  'Flag legado: 1 = XML disponível/baixado';
COMMENT ON COLUMN public.nota_entradamanifesto.digitada IS
  'Flag legado: 1 = nota já digitada/lançada';
COMMENT ON COLUMN public.nota_entradamanifesto.nota_compra IS
  'Vínculo com nota_entrada.id (legado: INTEGER NOTA_COMPRA)';
COMMENT ON COLUMN public.nota_entradamanifesto.caminho IS
  'Caminho do arquivo XML no disco/storage';
