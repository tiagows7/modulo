-- Venda NFC-e (modelo 65) — cabeçalho + itens
-- Requer public.pdvs (56_pdvs.sql)

CREATE TABLE IF NOT EXISTS public.venda_nfce (
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
  modelo VARCHAR(2) NOT NULL DEFAULT '65',
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

  -- Pagamentos (array JSON: methodId, label, amount, nsu, authorizationCode, brand)
  pagamentos JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Protocolo / cancelamento / XML
  protocolo VARCHAR(40),
  data_autorizacao TIMESTAMPTZ,
  dig_val VARCHAR(64),
  protocolo_cancelamento VARCHAR(40),
  data_cancelamento TIMESTAMPTZ,
  motivo_cancelamento TEXT,
  -- Pendente: opção de gravar XML só na máquina local (ver .cursor/rules/xml-fiscal-local-pendente.mdc)
  xml_nfce TEXT,
  qr_code TEXT,
  url_consulta TEXT,

  situacao VARCHAR(20) NOT NULL DEFAULT 'pendente',
  -- pendente | autorizada | denegada | contingencia | cancelada | erro
  erro TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT venda_nfce_chave_key UNIQUE (chave),
  CONSTRAINT venda_nfce_filial_numero_serie_key UNIQUE (filial, numero, serie, modelo)
);

CREATE INDEX IF NOT EXISTS idx_venda_nfce_filial ON public.venda_nfce (filial);
CREATE INDEX IF NOT EXISTS idx_venda_nfce_pdv ON public.venda_nfce (pdv);
CREATE INDEX IF NOT EXISTS idx_venda_nfce_cliente ON public.venda_nfce (cliente);
CREATE INDEX IF NOT EXISTS idx_venda_nfce_emissao ON public.venda_nfce (data_emissao);
CREATE INDEX IF NOT EXISTS idx_venda_nfce_situacao ON public.venda_nfce (situacao);
CREATE INDEX IF NOT EXISTS idx_venda_nfce_sale_ref ON public.venda_nfce (sale_ref);
CREATE INDEX IF NOT EXISTS idx_venda_nfce_cupom ON public.venda_nfce (cupom_codigo);

DROP TRIGGER IF EXISTS update_venda_nfce_modtime ON public.venda_nfce;
CREATE TRIGGER update_venda_nfce_modtime
  BEFORE UPDATE ON public.venda_nfce
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_nfce
  TO authenticated, anon, service_role;

ALTER TABLE public.venda_nfce ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - venda_nfce" ON public.venda_nfce;
CREATE POLICY "Permitir acesso autenticado - venda_nfce"
  ON public.venda_nfce FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - venda_nfce" ON public.venda_nfce;
CREATE POLICY "Permitir leitura anon - venda_nfce"
  ON public.venda_nfce FOR SELECT
  USING (true);

COMMENT ON TABLE public.venda_nfce IS
  'Cabeçalho da venda NFC-e (modelo 65): totais, cliente, cupom, chave/protocolo e PDV';
COMMENT ON COLUMN public.venda_nfce.pdv IS
  'Terminal PDV (public.pdvs.id); série normalmente vem de pdvs.serie_nfce';
COMMENT ON COLUMN public.venda_nfce.protocolo_cancelamento IS
  'Protocolo do evento de cancelamento quando situacao = cancelada';
COMMENT ON COLUMN public.venda_nfce.pagamentos IS
  'JSON com formas de pagamento da venda (TEF/dinheiro/PIX etc.)';


CREATE TABLE IF NOT EXISTS public.venda_nfceprodutos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_nfce UUID NOT NULL REFERENCES public.venda_nfce(id) ON DELETE CASCADE,
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

  CONSTRAINT venda_nfceprodutos_venda_item_key UNIQUE (venda_nfce, n_item)
);

CREATE INDEX IF NOT EXISTS idx_venda_nfceprodutos_venda
  ON public.venda_nfceprodutos (venda_nfce);
CREATE INDEX IF NOT EXISTS idx_venda_nfceprodutos_produto
  ON public.venda_nfceprodutos (produto);
CREATE INDEX IF NOT EXISTS idx_venda_nfceprodutos_cprod
  ON public.venda_nfceprodutos (c_prod);

DROP TRIGGER IF EXISTS update_venda_nfceprodutos_modtime ON public.venda_nfceprodutos;
CREATE TRIGGER update_venda_nfceprodutos_modtime
  BEFORE UPDATE ON public.venda_nfceprodutos
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_nfceprodutos
  TO authenticated, anon, service_role;

ALTER TABLE public.venda_nfceprodutos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - venda_nfceprodutos"
  ON public.venda_nfceprodutos;
CREATE POLICY "Permitir acesso autenticado - venda_nfceprodutos"
  ON public.venda_nfceprodutos FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir leitura anon - venda_nfceprodutos"
  ON public.venda_nfceprodutos;
CREATE POLICY "Permitir leitura anon - venda_nfceprodutos"
  ON public.venda_nfceprodutos FOR SELECT
  USING (true);

COMMENT ON TABLE public.venda_nfceprodutos IS
  'Itens da venda NFC-e (produtos/combustíveis, impostos e cupom por item)';
