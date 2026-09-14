-- Remove campo otp não utilizado de configuracao_tef

ALTER TABLE public.configuracao_tef
  DROP COLUMN IF EXISTS otp;
