-- Ambiente SEFAZ (tpAmb) por filial: NF-e e NFC-e
-- 1 = Produção · 2 = Homologação

ALTER TABLE public.filial
  ADD COLUMN IF NOT EXISTS ambiente_nfe SMALLINT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS ambiente_nfce SMALLINT NOT NULL DEFAULT 2;

ALTER TABLE public.filial
  DROP CONSTRAINT IF EXISTS filial_ambiente_nfe_check;
ALTER TABLE public.filial
  ADD CONSTRAINT filial_ambiente_nfe_check
  CHECK (ambiente_nfe IN (1, 2));

ALTER TABLE public.filial
  DROP CONSTRAINT IF EXISTS filial_ambiente_nfce_check;
ALTER TABLE public.filial
  ADD CONSTRAINT filial_ambiente_nfce_check
  CHECK (ambiente_nfce IN (1, 2));

COMMENT ON COLUMN public.filial.ambiente_nfe IS
  'Ambiente de emissão NF-e (tpAmb): 1=Produção, 2=Homologação';
COMMENT ON COLUMN public.filial.ambiente_nfce IS
  'Ambiente de emissão NFC-e (tpAmb): 1=Produção, 2=Homologação';

UPDATE public.filial
SET ambiente_nfe = 2
WHERE ambiente_nfe IS NULL;

UPDATE public.filial
SET ambiente_nfce = 2
WHERE ambiente_nfce IS NULL;
