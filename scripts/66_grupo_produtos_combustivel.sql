-- Grupo de produtos: marca se o grupo é de combustível

ALTER TABLE public.grupo_produtos
  ADD COLUMN IF NOT EXISTS combustivel BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.grupo_produtos.combustivel IS
  'true = grupo de combustível; no PDV loja os produtos deste grupo não aparecem';
