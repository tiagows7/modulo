-- Seed categorias de ICMS (cadastro fiscal comum para PDV/NF-e/NFC-e)
-- tipo: T=tributado, S=ST, I=isento, N=nao incidente, R=reducao BC, F=substituicao/FCP-ref
-- Aliquotas internas/interestaduais tipicas (RS/interno 17; fora 12/4 conforme caso) — ajuste por UF depois

INSERT INTO public.categorias_icm (
  codigo, descricao, tipo,
  aliquota_estado, aliquota_fora, percentual_reduzido,
  csosn, sinal_sped, tabela_sped,
  cfop_estado, cfop_fora, cfop_entrada, cst_icms
)
VALUES
  (1,  'Tributado integralmente',              'T', 17.00, 12.00, NULL, NULL, '+', NULL, '5102', '6102', '1102', '00'),
  (2,  'Tributado com reducao de base',        'R', 17.00, 12.00, 41.176, NULL, '+', NULL, '5102', '6102', '1102', '20'),
  (3,  'Isento',                               'I',  0.00,  0.00, NULL, NULL, '-', NULL, '5102', '6102', '1102', '40'),
  (4,  'Nao tributado / nao incidencia',       'N',  0.00,  0.00, NULL, NULL, '-', NULL, '5102', '6102', '1102', '41'),
  (5,  'Suspensao',                            'N',  0.00,  0.00, NULL, NULL, '-', NULL, '5102', '6102', '1102', '50'),
  (6,  'Diferimento',                          'N',  0.00,  0.00, NULL, NULL, '-', NULL, '5102', '6102', '1102', '51'),
  (7,  'ICMS cobrado anteriormente por ST',    'S',  0.00,  0.00, NULL, NULL, '-', NULL, '5405', '6404', '1403', '60'),
  (8,  'Com ST (destaque ICMS + ST)',           'S', 17.00, 12.00, NULL, NULL, '+', NULL, '5405', '6404', '1403', '10'),
  (9,  'Outras',                               'T', 17.00, 12.00, NULL, NULL, '+', NULL, '5102', '6102', '1102', '90'),
  (10, 'Combustivel - monofasico / ST',         'S',  0.00,  0.00, NULL, NULL, '-', NULL, '5656', '6656', '1653', '60'),
  (11, 'Simples - tributado SN',               'T', 17.00, 12.00, NULL, '102', '+', NULL, '5102', '6102', '1102', NULL),
  (12, 'Simples - isento / imune',             'I',  0.00,  0.00, NULL, '300', '-', NULL, '5102', '6102', '1102', NULL),
  (13, 'Simples - ST cobrada ant.',            'S',  0.00,  0.00, NULL, '500', '-', NULL, '5405', '6404', '1403', NULL),
  (14, 'Simples - sem credito',                'N',  0.00,  0.00, NULL, '400', '-', NULL, '5102', '6102', '1102', NULL),
  (15, 'Interestadual 4% (importados)',        'T', 17.00,  4.00, NULL, NULL, '+', NULL, '5102', '6102', '1102', '00')
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  tipo = EXCLUDED.tipo,
  aliquota_estado = EXCLUDED.aliquota_estado,
  aliquota_fora = EXCLUDED.aliquota_fora,
  percentual_reduzido = EXCLUDED.percentual_reduzido,
  csosn = EXCLUDED.csosn,
  sinal_sped = EXCLUDED.sinal_sped,
  tabela_sped = EXCLUDED.tabela_sped,
  cfop_estado = EXCLUDED.cfop_estado,
  cfop_fora = EXCLUDED.cfop_fora,
  cfop_entrada = EXCLUDED.cfop_entrada,
  cst_icms = EXCLUDED.cst_icms,
  updated_at = CURRENT_TIMESTAMP;
