-- Criação da tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20) UNIQUE,
    cidade VARCHAR(100),
    telefone VARCHAR(20),
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    fantasia VARCHAR(255),
    cnpj VARCHAR(20) UNIQUE,
    cpf VARCHAR(14),
    cep VARCHAR(12),
    endereco VARCHAR(255),
    numero VARCHAR(30),
    complemento VARCHAR(100),
    bairro VARCHAR(120),
    cidade INTEGER,
    uf VARCHAR(2),
    telefone VARCHAR(20),
    telefone1 VARCHAR(20),
    telefone2 VARCHAR(20),
    telefone3 VARCHAR(20),
    inscricao_estadual VARCHAR(30),
    inscricao_municipal VARCHAR(30),
    contato VARCHAR(120),
    email VARCHAR(180),
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de Grupos de Produtos
CREATE TABLE IF NOT EXISTS public.grupo_produtos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de Produtos
CREATE TABLE IF NOT EXISTS public.produtos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    grupo_id UUID REFERENCES public.grupo_produtos(id) ON DELETE SET NULL,
    preco_venda DECIMAL(10, 2) DEFAULT 0.00,
    estoque_atual DECIMAL(10, 3) DEFAULT 0.000,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de Tanques
CREATE TABLE IF NOT EXISTS public.tanques (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero VARCHAR(20) UNIQUE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    capacidade DECIMAL(10, 3) DEFAULT 0.000,
    volume_atual DECIMAL(10, 3) DEFAULT 0.000,
    status VARCHAR(20) DEFAULT 'operante',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de Bicos
CREATE TABLE IF NOT EXISTS public.bicos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero VARCHAR(20) UNIQUE NOT NULL,
    identificacao_bomba VARCHAR(50) NOT NULL,
    tanque_id UUID REFERENCES public.tanques(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
    preco_atual DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'livre',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criação da tabela de UFs (estados brasileiros)
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

-- Criação da tabela de Cidades (municípios IBGE)
CREATE TABLE IF NOT EXISTS public.cidades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    descricao VARCHAR(120) NOT NULL,
    uf VARCHAR(2) NOT NULL REFERENCES public.uf(codigo),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cidades_uf ON public.cidades (uf);
CREATE INDEX IF NOT EXISTS idx_cidades_descricao ON public.cidades (descricao);

-- Criação da tabela de Documentos de Caixa
CREATE TABLE IF NOT EXISTS public.documentos_caixa (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descricao VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'ativo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documentos_caixa_descricao
  ON public.documentos_caixa (descricao);

-- Funções e Triggers para atualização do 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_clientes_modtime
    BEFORE UPDATE ON public.clientes
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_fornecedores_modtime
    BEFORE UPDATE ON public.fornecedores
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_grupo_produtos_modtime
    BEFORE UPDATE ON public.grupo_produtos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_produtos_modtime
    BEFORE UPDATE ON public.produtos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_tanques_modtime
    BEFORE UPDATE ON public.tanques
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_bicos_modtime
    BEFORE UPDATE ON public.bicos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_uf_modtime
    BEFORE UPDATE ON public.uf
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_cidades_modtime
    BEFORE UPDATE ON public.cidades
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_documentos_caixa_modtime
    BEFORE UPDATE ON public.documentos_caixa
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Políticas de Segurança (Row Level Security - Opcional, caso você queira proteger os dados)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupo_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tanques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uf ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_caixa ENABLE ROW LEVEL SECURITY;

-- Exemplo: Permitir leitura e escrita para todos os usuários logados (autenticados)
CREATE POLICY "Permitir acesso autenticado - clientes" ON public.clientes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acesso autenticado - fornecedores" ON public.fornecedores FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acesso autenticado - grupo_produtos" ON public.grupo_produtos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acesso autenticado - produtos" ON public.produtos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acesso autenticado - tanques" ON public.tanques FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acesso autenticado - bicos" ON public.bicos FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir acesso autenticado - uf" ON public.uf FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir leitura anon - uf" ON public.uf FOR SELECT USING (true);
CREATE POLICY "Permitir acesso autenticado - cidades" ON public.cidades FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir leitura anon - cidades" ON public.cidades FOR SELECT USING (true);
CREATE POLICY "Permitir acesso autenticado - documentos_caixa" ON public.documentos_caixa FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir leitura anon - documentos_caixa" ON public.documentos_caixa FOR SELECT USING (true);