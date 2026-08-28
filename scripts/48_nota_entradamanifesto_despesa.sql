-- Flag: nota do manifesto tratada só como despesa do posto (sem entrada de estoque)

ALTER TABLE public.nota_entradamanifesto
  ADD COLUMN IF NOT EXISTS despesa INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_nota_entradamanifesto_despesa
  ON public.nota_entradamanifesto (despesa);

COMMENT ON COLUMN public.nota_entradamanifesto.despesa IS
  '1 = nota marcada apenas como despesa do posto (sem digitar entrada de estoque)';
