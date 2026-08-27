-- Seed CST PIS/COFINS (Tabela 4.3.3 EFD-Contribuições)
-- percentual_pis/cofins: alíquota básica não-cumulativa no CST 01; 0 nos CSTs de alíquota zero/isenção/etc.
-- basezero: S quando a operação tipicamente não gera débito/alíquota

INSERT INTO public.pis_cofins (
  codigo, descricao,
  percentual_pis, grupo_pis, percentual_cofins, grupo_cofins,
  basezero
)
VALUES
  ('01', 'Operacao tributavel com aliquota basica', 1.65, 'NC', 7.60, 'NC', 'N'),
  ('02', 'Operacao tributavel com aliquota diferenciada', NULL, NULL, NULL, NULL, 'N'),
  ('03', 'Operacao tributavel com aliquota por unidade de medida', NULL, NULL, NULL, NULL, 'N'),
  ('04', 'Operacao tributavel monofasica - revenda a aliquota zero', 0, NULL, 0, NULL, 'S'),
  ('05', 'Operacao tributavel por substituicao tributaria', NULL, NULL, NULL, NULL, 'N'),
  ('06', 'Operacao tributavel a aliquota zero', 0, NULL, 0, NULL, 'S'),
  ('07', 'Operacao isenta da contribuicao', 0, NULL, 0, NULL, 'S'),
  ('08', 'Operacao sem incidencia da contribuicao', 0, NULL, 0, NULL, 'S'),
  ('09', 'Operacao com suspensao da contribuicao', 0, NULL, 0, NULL, 'S'),
  ('49', 'Outras operacoes de saida', NULL, NULL, NULL, NULL, 'N'),
  ('50', 'Credito - vinculada exclus. a receita tributada MI', 1.65, 'NC', 7.60, 'NC', 'N'),
  ('51', 'Credito - vinculada exclus. a receita nao tributada MI', NULL, NULL, NULL, NULL, 'N'),
  ('52', 'Credito - vinculada exclus. a receita de exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('53', 'Credito - receitas tributadas e nao tributadas MI', NULL, NULL, NULL, NULL, 'N'),
  ('54', 'Credito - receitas tributadas MI e exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('55', 'Credito - receitas nao tributadas MI e exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('56', 'Credito - trib./nao trib. MI e exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('60', 'Credito presumido - exclus. receita tributada MI', NULL, NULL, NULL, NULL, 'N'),
  ('61', 'Credito presumido - exclus. receita nao tributada MI', NULL, NULL, NULL, NULL, 'N'),
  ('62', 'Credito presumido - exclus. receita de exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('63', 'Credito presumido - trib. e nao trib. MI', NULL, NULL, NULL, NULL, 'N'),
  ('64', 'Credito presumido - trib. MI e exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('65', 'Credito presumido - nao trib. MI e exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('66', 'Credito presumido - trib./nao trib. MI e exportacao', NULL, NULL, NULL, NULL, 'N'),
  ('67', 'Credito presumido - outras operacoes', NULL, NULL, NULL, NULL, 'N'),
  ('70', 'Aquisicao sem direito a credito', NULL, NULL, NULL, NULL, 'N'),
  ('71', 'Aquisicao com isencao', 0, NULL, 0, NULL, 'S'),
  ('72', 'Aquisicao com suspensao', 0, NULL, 0, NULL, 'S'),
  ('73', 'Aquisicao a aliquota zero', 0, NULL, 0, NULL, 'S'),
  ('74', 'Aquisicao sem incidencia da contribuicao', 0, NULL, 0, NULL, 'S'),
  ('75', 'Aquisicao por substituicao tributaria', NULL, NULL, NULL, NULL, 'N'),
  ('98', 'Outras operacoes de entrada', NULL, NULL, NULL, NULL, 'N'),
  ('99', 'Outras operacoes', NULL, NULL, NULL, NULL, 'N')
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  percentual_pis = EXCLUDED.percentual_pis,
  grupo_pis = EXCLUDED.grupo_pis,
  percentual_cofins = EXCLUDED.percentual_cofins,
  grupo_cofins = EXCLUDED.grupo_cofins,
  basezero = EXCLUDED.basezero,
  updated_at = CURRENT_TIMESTAMP;
