-- Tipo de documento do cliente (forma de recebimento / documentos_caixa)
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS documento_caixa_id UUID
  REFERENCES public.documentos_caixa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_documento_caixa
  ON public.clientes (documento_caixa_id);

COMMENT ON COLUMN public.clientes.documento_caixa_id IS
  'Tipo de documento / forma de recebimento (public.documentos_caixa.id)';
