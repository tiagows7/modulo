-- CSC / Token NFC-e por filial (idCSC + CSC da SEFAZ)
-- Usados na geração do QR Code e validação da NFC-e

ALTER TABLE public.filial
  ADD COLUMN IF NOT EXISTS token_id VARCHAR(6),
  ADD COLUMN IF NOT EXISTS token_nfce VARCHAR(60);

COMMENT ON COLUMN public.filial.token_id IS
  'Identificador do CSC (idCSC) cadastrado na SEFAZ para NFC-e';
COMMENT ON COLUMN public.filial.token_nfce IS
  'Código CSC (token) da NFC-e fornecido pela SEFAZ';
