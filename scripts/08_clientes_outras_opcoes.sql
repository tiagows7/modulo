-- Opções e textos extras na aba "Outras informações" do cliente
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS restricoes TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS mensagem VARCHAR(200);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS obriga_placa_venda BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS libera_veiculo_nao_cadastrado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS obriga_km BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS controla_frota BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS obriga_autorizacao BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS envia_nfce_venda BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS obriga_motorista BOOLEAN NOT NULL DEFAULT false;
