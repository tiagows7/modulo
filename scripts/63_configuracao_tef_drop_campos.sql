-- Remove campos não utilizados de configuracao_tef

ALTER TABLE public.configuracao_tef
  DROP COLUMN IF EXISTS cnpjautomacao,
  DROP COLUMN IF EXISTS codempresa,
  DROP COLUMN IF EXISTS operador,
  DROP COLUMN IF EXISTS portapinpad,
  DROP COLUMN IF EXISTS isdoublevalidation,
  DROP COLUMN IF EXISTS idcielo,
  DROP COLUMN IF EXISTS secretcielo,
  DROP COLUMN IF EXISTS tef_gsurfuid;
