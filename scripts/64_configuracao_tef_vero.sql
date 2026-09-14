-- Configuração Vero no cadastro de PDV (aba TEF)

ALTER TABLE public.configuracao_tef
  ADD COLUMN IF NOT EXISTS vero_idloja VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vero_idterminal VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vero_token VARCHAR(80),
  ADD COLUMN IF NOT EXISTS vero_cnpj VARCHAR(14);

COMMENT ON COLUMN public.configuracao_tef.vero_idloja IS
  'Identificador da loja na Vero';
COMMENT ON COLUMN public.configuracao_tef.vero_idterminal IS
  'Identificador do terminal na Vero';
COMMENT ON COLUMN public.configuracao_tef.vero_token IS
  'Token de autenticação da Vero';
COMMENT ON COLUMN public.configuracao_tef.vero_cnpj IS
  'CNPJ do estabelecimento na Vero';
