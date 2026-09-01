-- Config fiscal NF-e / NFC-e por filial (certificado A1 + schemas XSD)

ALTER TABLE public.filial
  ADD COLUMN IF NOT EXISTS certificado_nome VARCHAR(255),
  ADD COLUMN IF NOT EXISTS certificado_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS certificado_senha VARCHAR(255),
  ADD COLUMN IF NOT EXISTS schemas_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS schemas_atualizado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.filial.certificado_nome IS
  'Nome do arquivo do certificado A1 (.pfx/.p12) enviado';
COMMENT ON COLUMN public.filial.certificado_storage_path IS
  'Caminho no Storage (bucket filial-fiscal) do certificado';
COMMENT ON COLUMN public.filial.certificado_senha IS
  'Senha do certificado A1';
COMMENT ON COLUMN public.filial.schemas_storage_path IS
  'Caminho no Storage dos schemas XSD usados na emissão NF-e/NFC-e';
COMMENT ON COLUMN public.filial.schemas_atualizado_em IS
  'Data/hora do último upload dos schemas';

-- Bucket privado para certificado e schemas
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('filial-fiscal', 'filial-fiscal', false, 20971520)
ON CONFLICT (id) DO UPDATE
SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "filial_fiscal_select_auth" ON storage.objects;
CREATE POLICY "filial_fiscal_select_auth"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'filial-fiscal');

DROP POLICY IF EXISTS "filial_fiscal_insert_auth" ON storage.objects;
CREATE POLICY "filial_fiscal_insert_auth"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'filial-fiscal');

DROP POLICY IF EXISTS "filial_fiscal_update_auth" ON storage.objects;
CREATE POLICY "filial_fiscal_update_auth"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'filial-fiscal')
  WITH CHECK (bucket_id = 'filial-fiscal');

DROP POLICY IF EXISTS "filial_fiscal_delete_auth" ON storage.objects;
CREATE POLICY "filial_fiscal_delete_auth"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'filial-fiscal');
