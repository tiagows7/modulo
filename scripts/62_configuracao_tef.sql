-- Configuração TEF e numeração fiscal por filial/PDV.
-- nfcenumero / nfenumero representam o próximo número a reservar.

CREATE TABLE IF NOT EXISTS public.configuracao_tef (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filial UUID NOT NULL REFERENCES public.filial(id) ON DELETE CASCADE,
  pdv INTEGER NOT NULL,
  tipo INTEGER,
  ip_tef VARCHAR(30),
  idterminal VARCHAR(50),
  idloja VARCHAR(50),
  codempresa VARCHAR(50),
  operador VARCHAR(50),
  portapinpad VARCHAR(20),
  cnpj VARCHAR(14),
  mensagempinpad VARCHAR(20),
  comexterna INTEGER,
  isdoublevalidation INTEGER,
  otp VARCHAR(50),
  cnpjautomacao VARCHAR(20),
  transacaohabilitadas VARCHAR(90),
  obrigadooperador VARCHAR(1),
  postipo INTEGER,
  imprimevialoja INTEGER DEFAULT 1,
  nfceserie INTEGER,
  nfcenumero INTEGER,
  modelo INTEGER,
  otpnome VARCHAR(30),
  idcielo VARCHAR(80),
  secretcielo VARCHAR(80),
  imprimebanri INTEGER,
  aceitavalorparcial CHAR(1) DEFAULT 'S',
  vendaproduto CHAR(1),
  tipodocumento CHAR(1),
  nfeserie INTEGER,
  nfenumero INTEGER,
  obrigadobico CHAR(1),
  tlsexterna VARCHAR(20),
  tlstoken VARCHAR(50),
  tlstipoproxy VARCHAR(50),
  tlsenderecoproxy VARCHAR(50),
  tef_gsurfuid VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT configuracao_tef_filial_pdv_key UNIQUE (filial, pdv),
  CONSTRAINT configuracao_tef_pdv_check CHECK (pdv > 0),
  CONSTRAINT configuracao_tef_nfceserie_check
    CHECK (nfceserie IS NULL OR nfceserie > 0),
  CONSTRAINT configuracao_tef_nfcenumero_check
    CHECK (nfcenumero IS NULL OR nfcenumero > 0),
  CONSTRAINT configuracao_tef_nfeserie_check
    CHECK (nfeserie IS NULL OR nfeserie > 0),
  CONSTRAINT configuracao_tef_nfenumero_check
    CHECK (nfenumero IS NULL OR nfenumero > 0)
);

CREATE INDEX IF NOT EXISTS idx_configuracao_tef_filial
  ON public.configuracao_tef (filial);
CREATE INDEX IF NOT EXISTS idx_configuracao_tef_pdv
  ON public.configuracao_tef (pdv);

DROP TRIGGER IF EXISTS update_configuracao_tef_modtime
  ON public.configuracao_tef;
CREATE TRIGGER update_configuracao_tef_modtime
  BEFORE UPDATE ON public.configuracao_tef
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.configuracao_tef ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso autenticado - configuracao_tef"
  ON public.configuracao_tef;
CREATE POLICY "Permitir acesso autenticado - configuracao_tef"
  ON public.configuracao_tef FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracao_tef
  TO authenticated, service_role;

COMMENT ON TABLE public.configuracao_tef IS
  'Configuração TEF e sequência fiscal por filial e terminal PDV';
COMMENT ON COLUMN public.configuracao_tef.nfceserie IS
  'Série da próxima NFC-e emitida neste PDV';
COMMENT ON COLUMN public.configuracao_tef.nfcenumero IS
  'Próximo número de NFC-e; incrementado atomicamente ao reservar';
COMMENT ON COLUMN public.configuracao_tef.nfeserie IS
  'Série da próxima NF-e emitida neste PDV';
COMMENT ON COLUMN public.configuracao_tef.nfenumero IS
  'Próximo número de NF-e; incrementado atomicamente ao reservar';

-- Aproveita séries e próximos números já cadastrados em public.pdvs.
INSERT INTO public.configuracao_tef (
  filial,
  pdv,
  nfceserie,
  nfcenumero,
  nfeserie,
  nfenumero
)
SELECT
  p.filial,
  p.codigo::INTEGER,
  NULLIF(p.serie_nfce, '')::INTEGER,
  p.prox_numero_nfce,
  NULLIF(p.serie_nfe, '')::INTEGER,
  p.prox_numero_nfe
FROM public.pdvs p
WHERE p.filial IS NOT NULL
  AND p.codigo ~ '^[0-9]+$'
ON CONFLICT (filial, pdv) DO NOTHING;

-- Instalações antigas podem ter caixa por PDV, mas ainda não possuir
-- cadastro em public.pdvs. Nesse caso, inicia após o maior número já gravado.
INSERT INTO public.configuracao_tef (
  filial,
  pdv,
  nfceserie,
  nfcenumero,
  nfeserie,
  nfenumero
)
SELECT DISTINCT ON (c.filial, c.pdv::INTEGER)
  c.filial,
  c.pdv::INTEGER,
  1,
  COALESCE((
    SELECT MAX(v.numero) + 1
    FROM public.venda_nfce v
    WHERE v.filial = c.filial
  ), 1),
  1,
  COALESCE((
    SELECT MAX(v.numero) + 1
    FROM public.venda_nfe v
    WHERE v.filial = c.filial
  ), 1)
FROM public.caixa c
WHERE c.filial IS NOT NULL
  AND c.pdv ~ '^[0-9]+$'
ORDER BY c.filial, c.pdv::INTEGER, c.id DESC
ON CONFLICT (filial, pdv) DO NOTHING;

-- Reserva e incrementa a numeração sob bloqueio de linha, evitando
-- que dois fechamentos simultâneos usem o mesmo número.
CREATE OR REPLACE FUNCTION public.reservar_numero_fiscal_tef(
  p_filial UUID,
  p_pdv INTEGER,
  p_modelo INTEGER
)
RETURNS TABLE (numero INTEGER, serie INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_config public.configuracao_tef%ROWTYPE;
BEGIN
  IF p_modelo NOT IN (55, 65) THEN
    RAISE EXCEPTION 'Modelo fiscal inválido: %. Use 55 ou 65.', p_modelo;
  END IF;

  SELECT c.*
    INTO v_config
    FROM public.configuracao_tef c
   WHERE c.filial = p_filial
     AND c.pdv = p_pdv
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Configuração TEF não encontrada para filial % / PDV %',
      p_filial,
      p_pdv;
  END IF;

  IF p_modelo = 65 THEN
    IF v_config.nfceserie IS NULL OR v_config.nfcenumero IS NULL THEN
      RAISE EXCEPTION
        'Série/número NFC-e não configurados para filial % / PDV %',
        p_filial,
        p_pdv;
    END IF;
    numero := v_config.nfcenumero;
    serie := v_config.nfceserie;
    UPDATE public.configuracao_tef
       SET nfcenumero = nfcenumero + 1
     WHERE id = v_config.id;
  ELSE
    IF v_config.nfeserie IS NULL OR v_config.nfenumero IS NULL THEN
      RAISE EXCEPTION
        'Série/número NF-e não configurados para filial % / PDV %',
        p_filial,
        p_pdv;
    END IF;
    numero := v_config.nfenumero;
    serie := v_config.nfeserie;
    UPDATE public.configuracao_tef
       SET nfenumero = nfenumero + 1
     WHERE id = v_config.id;
  END IF;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_numero_fiscal_tef(UUID, INTEGER, INTEGER)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_numero_fiscal_tef(UUID, INTEGER, INTEGER)
  TO authenticated, service_role;
