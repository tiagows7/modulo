-- Venda NF-e (modelo 55) — cabeçalho + itens
-- Requer public.pdvs (56_pdvs.sql)

CREATE TABLE IF NOT EXISTS public.venda_nfe (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Contexto interno
  filial UUID REFERENCES public.filial(id) ON DELETE SET NULL,
  pdv UUID REFERENCES public.pdvs(id) ON DELETE SET NULL,
  cliente UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  operador VARCHAR(120),
  sale_ref VARCHAR(60),
  caixa UUID,
  caixa_codigo VARCHAR(30),
  caixa_data DATE,
  caixa_pdv VARCHAR(20),
  caixa_turno SMALLINT,
  caixa_operador VARCHAR(120),

  -- Identificação fiscal
  chave VARCHAR(44),
  numero INTEGER NOT NULL,
  serie VARCHAR(3) NOT NULL DEFAULT '1',
  modelo VARCHAR(2) NOT NULL DEFAULT '55',
  natureza_operacao VARCHAR(60),
  tipo_nf SMALLINT NOT NULL DEFAULT 1,
  finalidade SMALLINT DEFAULT 1,
  ind_final SMALLINT DEFAULT 1,
  ind_presenca SMALLINT DEFAULT 1,
  cuf VARCHAR(2),
  cnf VARCHAR(8),
  cdv SMALLINT,
  tp_emis SMALLINT DEFAULT 1,
  ambiente SMALLINT DEFAULT 1,

  data_emissao TIMESTAMPTZ,
  hora_emissao VARCHAR(8),
  data_saida TIMESTAMPTZ,

  -- Destinatário / cliente (snapshot na venda)
  dest_documento VARCHAR(20),
  dest_nome VARCHAR(255),
  dest_codigo VARCHAR(40),
  dest_email VARCHAR(120),
  dest_ie VARCHAR(30),
  dest_cep VARCHAR(12),
  dest_endereco VARCHAR(255),
  dest_numero VARCHAR(30),
  dest_bairro VARCHAR(120),
  dest_cidade VARCHAR(120),
  dest_cidade_ibge VARCHAR(7),
  dest_uf VARCHAR(2),
  dest_telefone VARCHAR(20),
  placa VARCHAR(10),
  km VARCHAR(20),
  frota VARCHAR(40),
  motorista VARCHAR(120),
  autorizacao VARCHAR(60),
  orgao VARCHAR(120),
  matricula VARCHAR(40),
  observacao TEXT,

  -- Transporte / volumes (NF-e)
  mod_frete SMALLINT DEFAULT 9,
  transportadora_documento VARCHAR(20),
  transportadora_nome VARCHAR(255),
  transportadora_ie VARCHAR(30),
  volume_qtd INTEGER,
  volume_especie VARCHAR(60),
  volume_marca VARCHAR(60),
  volume_numeracao VARCHAR(60),
  volume_peso_liq NUMERIC(15, 3),
  volume_peso_bruto NUMERIC(15, 3),

  -- Cupom de desconto
  cupom_codigo VARCHAR(60),
  cupom_tipo VARCHAR(30),
  cupom_valor NUMERIC(15, 4) NOT NULL DEFAULT 0,
  cupom_tipo_produto VARCHAR(40),
  cupom_cnpj_posto VARCHAR(20),

  -- Totais
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

  -- Pagamentos
  pagamentos JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Protocolo / cancelamento / XML
  protocolo VARCHAR(40),
  data_autorizacao TIMESTAMPTZ,
  dig_val VARCHAR(64),
  protocolo_cancelamento VARCHAR(40),
  data_cancelamento TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  -- Pendente: opção de gravar XML só na máquina local (ver .cursor/rules/xml-fiscal-local-pendente.mdc)
  xml_nfe TEXT,
  qr_code TEXT,
  url_consulta TEXT,

  situacao VARCHAR(20) NOT NULL DEFAULT 'pendente',
  -- pendente | autorizada | denegada | contingencia | cancelada | erro
  erro TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT venda_nfe_chave_key UNIQUE (chave),
  CONSTRAINT venda_nfe_filial_numero_serie_key UNIQUE (filial, numero, serie, modelo)
);

CREATE INDEX IF NOT EXISTS idx_venda_nfe_filial ON public.venda_nfe (filial);
CREATE INDEX IF NOT EXISTS idx_venda_nfe_pdv ON public.venda_nfe (pdv);
CREATE INDEX IF NOT EXISTS idx_venda_nfe_cliente ON public.venda_nfe (cliente);
CREATE INDEX IF NOT EXISTS idx_venda_nfe_emissao ON public.venda_nfe (data_emissao);
CREATE INDEX IF NOT EXISTS idx_venda_nfe_situacao ON public.venda_nfe (situacao);
CREATE INDEX IF NOT EXISTS idx_venda_nfe_sale_ref ON public.venda_nfe (sale_ref);
CREATE INDEX IF NOT EXISTS idx_venda_nfe_cupom ON public.venda_nfe (cupom_codigo);

DROP TRIGGER IF EXISTS update_venda_nfe_modtime ON public.venda_nfe;
CREATE TRIGGER update_venda_nfe_modtime
  BEFORE UPDATE ON public.venda_nfe
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_nfe
  TO authenticated, anon, service_role;

ALTER TABLE public.venda_nfe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - venda_nfe" ON public.venda_nfe;
CREATE POLICY "Permitir acesso autenticado - venda_nfe"
  ON public.venda_nfe FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - venda_nfe" ON public.venda_nfe;
CREATE POLICY "Permitir leitura anon - venda_nfe"
  ON public.venda_nfe FOR SELECT
  USING (true);

COMMENT ON TABLE public.venda_nfe IS
  'Cabeçalho da venda NF-e (modelo 55): totais, cliente, cupom, chave/protocolo e PDV';
COMMENT ON COLUMN public.venda_nfe.pdv IS
  'Terminal PDV (public.pdvs.id); série normalmente vem de pdvs.serie_nfe';
COMMENT ON COLUMN public.venda_nfe.protocolo_cancelamento IS
  'Protocolo do evento de cancelamento quando situacao = cancelada';


CREATE TABLE IF NOT EXISTS public.venda_nfeprodutos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_nfe UUID NOT NULL REFERENCES public.venda_nfe(id) ON DELETE CASCADE,
  produto UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  abastecimento UUID,

  n_item INTEGER NOT NULL,
  kind VARCHAR(20),
  pump_id VARCHAR(20),
  bico UUID REFERENCES public.bicos(id) ON DELETE SET NULL,

  c_prod VARCHAR(60),
  c_ean VARCHAR(14),
  c_ean_trib VARCHAR(14),
  x_prod VARCHAR(255) NOT NULL,
  ncm VARCHAR(8),
  cest VARCHAR(7),
  cfop VARCHAR(4),
  u_com VARCHAR(6),
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
  v_liquido NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ind_tot SMALLINT DEFAULT 1,

  -- Cupom no item
  cupom_codigo VARCHAR(60),
  cupom_tipo VARCHAR(30),
  cupom_valor NUMERIC(15, 4) NOT NULL DEFAULT 0,

  -- Combustível
  c_prod_anp VARCHAR(9),
  desc_anp VARCHAR(120),
  uf_cons VARCHAR(2),

  -- Impostos
  orig SMALLINT,
  cst_icms VARCHAR(3),
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
  info_ad_prod TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT venda_nfeprodutos_venda_item_key UNIQUE (venda_nfe, n_item)
);

CREATE INDEX IF NOT EXISTS idx_venda_nfeprodutos_venda
  ON public.venda_nfeprodutos (venda_nfe);
CREATE INDEX IF NOT EXISTS idx_venda_nfeprodutos_produto
  ON public.venda_nfeprodutos (produto);
CREATE INDEX IF NOT EXISTS idx_venda_nfeprodutos_cprod
  ON public.venda_nfeprodutos (c_prod);

DROP TRIGGER IF EXISTS update_venda_nfeprodutos_modtime ON public.venda_nfeprodutos;
CREATE TRIGGER update_venda_nfeprodutos_modtime
  BEFORE UPDATE ON public.venda_nfeprodutos
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_nfeprodutos
  TO authenticated, anon, service_role;

ALTER TABLE public.venda_nfeprodutos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - venda_nfeprodutos"
  ON public.venda_nfeprodutos;
CREATE POLICY "Permitir acesso autenticado - venda_nfeprodutos"
  ON public.venda_nfeprodutos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - venda_nfeprodutos"
  ON public.venda_nfeprodutos;
CREATE POLICY "Permitir leitura anon - venda_nfeprodutos"
  ON public.venda_nfeprodutos FOR SELECT
  USING (true);

COMMENT ON TABLE public.venda_nfeprodutos IS
  'Itens da venda NF-e (produtos/combustíveis, impostos e cupom por item)';
