-- Filial opcional em funcionários
-- NULL = disponível em todas as filiais

ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS filial UUID
  REFERENCES public.filial(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_filial
  ON public.funcionarios (filial);

COMMENT ON COLUMN public.funcionarios.filial IS
  'Filial do funcionário (public.filial.id). NULL = todas as filiais';
