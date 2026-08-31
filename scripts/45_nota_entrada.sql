-- Nota de entrada (NF-e XML) — cabeçalho + itens
-- Campos alinhados ao XML da NF-e (modelo 55): ide, emit, dest, total, protNFe, det/prod.

CREATE TABLE IF NOT EXISTS public.nota_entrada (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

    -- Contexto interno
    filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
    fornecedor UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,

    -- Identificação da NF-e (ide + Id)
    chave VARCHAR(44), -- preenchida na importação do XML; opcional no cadastro manual
    numero INTEGER NOT NULL,
    serie VARCHAR(3) NOT NULL DEFAULT '1',
    modelo VARCHAR(2) NOT NULL DEFAULT '55',
    natureza_operacao VARCHAR(60),
    tipo_nf SMALLINT NOT NULL DEFAULT 0, -- tpNF: 0=entrada, 1=saída (do emitente)
    finalidade SMALLINT,                -- finNFe
    ind_final SMALLINT,                 -- indFinal
    ind_presenca SMALLINT,              -- indPres
    cuf VARCHAR(2),                     -- cUF
    cnf VARCHAR(8),                     -- cNF
    cdv SMALLINT,                       -- cDV

    data_emissao TIMESTAMPTZ,
    data_saida_entrada TIMESTAMPTZ,     -- dhSaiEnt
    data_entrada DATE,                  -- data efetiva da entrada no estoque

    -- Emitente: apenas FK fornecedor (dados em public.fornecedores)
    -- Destinatário: apenas FK filial (dados em public.filial)

    -- Totais (ICMSTot / total)
    v_bc NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_icms NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_icms_deson NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_bc_st NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_st NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_prod NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_frete NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_seg NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_desc NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_ii NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_ipi NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_pis NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_cofins NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_outro NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_nf NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_tot_trib NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Transporte / protocolo
    mod_frete SMALLINT,                 -- modFrete
    protocolo VARCHAR(20),              -- nProt
    data_autorizacao TIMESTAMPTZ,       -- dhRecbto
    dig_val VARCHAR(32),                -- digVal

    -- XML original e controle
    xml_nfe TEXT,
    situacao VARCHAR(20) NOT NULL DEFAULT 'pendente',
    -- pendente | lancada | cancelada
    observacao TEXT,
    info_complementar TEXT,             -- infCpl / infAdFisco

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT nota_entrada_chave_key UNIQUE (chave),
    CONSTRAINT nota_entrada_filial_numero_serie_key UNIQUE (filial, numero, serie, modelo)
);

CREATE INDEX IF NOT EXISTS idx_nota_entrada_filial
  ON public.nota_entrada (filial);
CREATE INDEX IF NOT EXISTS idx_nota_entrada_fornecedor
  ON public.nota_entrada (fornecedor);
CREATE INDEX IF NOT EXISTS idx_nota_entrada_emissao
  ON public.nota_entrada (data_emissao);
CREATE INDEX IF NOT EXISTS idx_nota_entrada_situacao
  ON public.nota_entrada (situacao);

DROP TRIGGER IF EXISTS update_nota_entrada_modtime ON public.nota_entrada;
CREATE TRIGGER update_nota_entrada_modtime
    BEFORE UPDATE ON public.nota_entrada
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_entrada
  TO authenticated, anon, service_role;

ALTER TABLE public.nota_entrada ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - nota_entrada"
  ON public.nota_entrada;
CREATE POLICY "Permitir acesso autenticado - nota_entrada"
  ON public.nota_entrada FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - nota_entrada"
  ON public.nota_entrada;
CREATE POLICY "Permitir leitura anon - nota_entrada"
  ON public.nota_entrada FOR SELECT
  USING (true);

COMMENT ON TABLE public.nota_entrada IS
  'Cabeçalho da nota fiscal de entrada (dados do XML NF-e)';
COMMENT ON COLUMN public.nota_entrada.chave IS
  'Chave de acesso 44 dígitos (Id infNFe sem prefixo NFe)';
COMMENT ON COLUMN public.nota_entrada.xml_nfe IS
  'XML completo da NF-e importada';
COMMENT ON COLUMN public.nota_entrada.situacao IS
  'pendente = importada; lancada = estoque atualizado; cancelada';


CREATE TABLE IF NOT EXISTS public.nota_entradaprodutos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nota_entrada UUID NOT NULL REFERENCES public.nota_entrada(id) ON DELETE CASCADE,

    -- Vínculo interno (após casamento com cadastro)
    produto UUID REFERENCES public.produtos(id) ON DELETE SET NULL,

    -- Identificação do item no XML (det @nItem + prod)
    n_item INTEGER NOT NULL,
    c_prod VARCHAR(60),                 -- cProd (código do emitente)
    c_ean VARCHAR(14),                  -- cEAN
    c_ean_trib VARCHAR(14),             -- cEANTrib
    x_prod VARCHAR(255) NOT NULL,       -- xProd
    ncm VARCHAR(8),
    cest VARCHAR(7),
    cfop VARCHAR(4),
    u_com VARCHAR(6),                   -- uCom
    q_com NUMERIC(15, 4) NOT NULL DEFAULT 0,
    v_un_com NUMERIC(15, 6) NOT NULL DEFAULT 0,
    v_prod NUMERIC(15, 2) NOT NULL DEFAULT 0,
    u_trib VARCHAR(6),
    q_trib NUMERIC(15, 4) NOT NULL DEFAULT 0,
    v_un_trib NUMERIC(15, 6) NOT NULL DEFAULT 0,
    v_frete NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_seg NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_desc NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_outro NUMERIC(15, 2) NOT NULL DEFAULT 0,
    ind_tot SMALLINT DEFAULT 1,         -- indTot

    -- Combustível (comb) quando houver
    c_prod_anp VARCHAR(9),
    desc_anp VARCHAR(120),
    uf_cons VARCHAR(2),

    -- Impostos principais do item
    orig SMALLINT,
    cst_icms VARCHAR(3),                -- CST ou CSOSN
    v_bc_icms NUMERIC(15, 2) NOT NULL DEFAULT 0,
    p_icms NUMERIC(7, 4) NOT NULL DEFAULT 0,
    v_icms NUMERIC(15, 2) NOT NULL DEFAULT 0,
    v_bc_st NUMERIC(15, 2) NOT NULL DEFAULT 0,
    p_icms_st NUMERIC(7, 4) NOT NULL DEFAULT 0,
    v_icms_st NUMERIC(15, 2) NOT NULL DEFAULT 0,

    cst_ipi VARCHAR(2),
    v_bc_ipi NUMERIC(15, 2) NOT NULL DEFAULT 0,
    p_ipi NUMERIC(7, 4) NOT NULL DEFAULT 0,
    v_ipi NUMERIC(15, 2) NOT NULL DEFAULT 0,

    cst_pis VARCHAR(2),
    v_bc_pis NUMERIC(15, 2) NOT NULL DEFAULT 0,
    p_pis NUMERIC(7, 4) NOT NULL DEFAULT 0,
    v_pis NUMERIC(15, 2) NOT NULL DEFAULT 0,

    cst_cofins VARCHAR(2),
    v_bc_cofins NUMERIC(15, 2) NOT NULL DEFAULT 0,
    p_cofins NUMERIC(7, 4) NOT NULL DEFAULT 0,
    v_cofins NUMERIC(15, 2) NOT NULL DEFAULT 0,

    v_tot_trib NUMERIC(15, 2) NOT NULL DEFAULT 0,
    info_ad_prod TEXT,                  -- infAdProd

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT nota_entradaprodutos_nota_item_key UNIQUE (nota_entrada, n_item)
);

CREATE INDEX IF NOT EXISTS idx_nota_entradaprodutos_nota
  ON public.nota_entradaprodutos (nota_entrada);
CREATE INDEX IF NOT EXISTS idx_nota_entradaprodutos_produto
  ON public.nota_entradaprodutos (produto);
CREATE INDEX IF NOT EXISTS idx_nota_entradaprodutos_cean
  ON public.nota_entradaprodutos (c_ean);
CREATE INDEX IF NOT EXISTS idx_nota_entradaprodutos_cprod
  ON public.nota_entradaprodutos (c_prod);

DROP TRIGGER IF EXISTS update_nota_entradaprodutos_modtime
  ON public.nota_entradaprodutos;
CREATE TRIGGER update_nota_entradaprodutos_modtime
    BEFORE UPDATE ON public.nota_entradaprodutos
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_entradaprodutos
  TO authenticated, anon, service_role;

ALTER TABLE public.nota_entradaprodutos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - nota_entradaprodutos"
  ON public.nota_entradaprodutos;
CREATE POLICY "Permitir acesso autenticado - nota_entradaprodutos"
  ON public.nota_entradaprodutos FOR ALL
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Permitir leitura anon - nota_entradaprodutos"
  ON public.nota_entradaprodutos;
CREATE POLICY "Permitir leitura anon - nota_entradaprodutos"
  ON public.nota_entradaprodutos FOR SELECT
  USING (true);

COMMENT ON TABLE public.nota_entradaprodutos IS
  'Itens da nota de entrada (det/prod + impostos do XML NF-e)';
COMMENT ON COLUMN public.nota_entradaprodutos.produto IS
  'Produto interno casado após importação do XML (opcional)';
COMMENT ON COLUMN public.nota_entradaprodutos.c_prod IS
  'Código do produto no XML do emitente (cProd)';
COMMENT ON COLUMN public.nota_entradaprodutos.c_ean IS
  'GTIN / código de barras do XML (cEAN)';
