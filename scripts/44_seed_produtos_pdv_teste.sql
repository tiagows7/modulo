-- Seed de produtos + produto_filial para testes no PDV
-- Idempotente: só insere se o código ainda não existir
-- Aplicar com: npx supabase db query --linked -f scripts/44_seed_produtos_pdv_teste.sql
-- (não use pipe no PowerShell — corrompe acentos)

DO $$
DECLARE
  v_filial UUID;
  v_un UUID;
  v_litro UUID;
  v_grp_comb UUID;
  v_grp_lub UUID;
  v_grp_far UUID;
  v_grp_fol UUID;
  r RECORD;
BEGIN
  SELECT id INTO v_filial FROM public.filial WHERE status = 'ativo' ORDER BY codigo LIMIT 1;
  IF v_filial IS NULL THEN
    RAISE EXCEPTION 'Nenhuma filial ativa encontrada';
  END IF;

  SELECT id INTO v_un FROM public.unidade_medida WHERE upper(codigo) = 'UN' LIMIT 1;
  SELECT id INTO v_litro FROM public.unidade_medida WHERE upper(codigo) = 'L' LIMIT 1;
  SELECT id INTO v_grp_comb FROM public.grupo_produtos WHERE codigo = 'GRP-001' LIMIT 1;
  SELECT id INTO v_grp_lub FROM public.grupo_produtos WHERE codigo = 'GRP-002' LIMIT 1;
  SELECT id INTO v_grp_far FROM public.grupo_produtos WHERE codigo = 'GRP-003' LIMIT 1;
  SELECT id INTO v_grp_fol FROM public.grupo_produtos WHERE codigo = 'GRP-004' LIMIT 1;

  -- Atualiza preços realistas dos combustíveis já existentes
  UPDATE public.produto_filial pf
  SET valor_venda = x.preco,
      estoque = x.estoque,
      situacao = 'ativo'
  FROM public.produtos p
  JOIN (VALUES
    ('1', 5.899::numeric, 12000::numeric),
    ('2', 6.199::numeric, 8000::numeric),
    ('3', 4.299::numeric, 9000::numeric)
  ) AS x(codigo, preco, estoque) ON p.codigo = x.codigo
  WHERE pf.produto = p.id AND pf.filial = v_filial;

  -- Novos produtos de loja / lubrificantes / filtros
  INSERT INTO public.produtos (
    codigo, codigo_barras, descricao, unidade_id, grupo_id,
    controla_estoque, preco_venda, estoque_atual, status
  )
  SELECT v.codigo, v.barras, v.descricao, v.unidade_id, v.grupo_id,
         true, 0, 0, 'ativo'
  FROM (VALUES
    ('10', '7891000100101', 'Água Mineral 500ml',          v_un,    v_grp_lub),
    ('11', '7891000100118', 'Água Mineral 1,5L',           v_un,    v_grp_lub),
    ('12', '7891000100125', 'Refrigerante Cola 350ml',     v_un,    v_grp_lub),
    ('13', '7891000100132', 'Refrigerante Guaraná 2L',     v_un,    v_grp_lub),
    ('14', '7891000100149', 'Energético 250ml',            v_un,    v_grp_lub),
    ('15', '7891000100156', 'Café Expresso 50ml',          v_un,    v_grp_lub),
    ('16', '7891000100163', 'Chocolate Barra 90g',         v_un,    v_grp_lub),
    ('17', '7891000100170', 'Salgadinho 70g',              v_un,    v_grp_lub),
    ('20', '7891000100200', 'Óleo Motor 1L SAE 5W30',      v_litro, v_grp_lub),
    ('21', '7891000100217', 'Óleo Motor 1L SAE 15W40',     v_litro, v_grp_lub),
    ('22', '7891000100224', 'Aditivo Radiador 1L',         v_litro, v_grp_lub),
    ('30', '7891000100309', 'Filtro de Ar Universal',      v_un,    v_grp_far),
    ('31', '7891000100316', 'Filtro de Óleo Universal',    v_un,    v_grp_fol),
    ('40', '7891000100408', 'Pano Microfibra',             v_un,    v_grp_lub),
    ('41', '7891000100415', 'Lubrificante Corrente 300ml', v_un,    v_grp_lub)
  ) AS v(codigo, barras, descricao, unidade_id, grupo_id)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.produtos p WHERE p.codigo = v.codigo
  );

  -- produto_filial para todos os produtos sem vínculo nesta filial
  INSERT INTO public.produto_filial (
    filial, produto, valor_venda, valor_compra, estoque, situacao, margem_venda
  )
  SELECT
    v_filial,
    p.id,
    COALESCE(x.preco, 9.90),
    COALESCE(x.custo, 5.00),
    COALESCE(x.estoque, 50),
    'ativo',
    COALESCE(x.margem, 30)
  FROM public.produtos p
  LEFT JOIN (VALUES
    ('1',  5.899::numeric, 4.800::numeric, 12000::numeric, 18::numeric),
    ('2',  6.199::numeric, 5.100::numeric,  8000::numeric, 18::numeric),
    ('3',  4.299::numeric, 3.500::numeric,  9000::numeric, 18::numeric),
    ('10', 3.50::numeric,  1.80::numeric,   120::numeric, 48::numeric),
    ('11', 5.90::numeric,  3.20::numeric,    80::numeric, 45::numeric),
    ('12', 4.50::numeric,  2.40::numeric,   100::numeric, 46::numeric),
    ('13', 9.90::numeric,  5.50::numeric,    40::numeric, 44::numeric),
    ('14', 8.90::numeric,  4.80::numeric,    60::numeric, 46::numeric),
    ('15', 6.50::numeric,  2.50::numeric,   150::numeric, 60::numeric),
    ('16', 7.90::numeric,  4.00::numeric,    70::numeric, 49::numeric),
    ('17', 6.90::numeric,  3.50::numeric,    90::numeric, 49::numeric),
    ('20', 42.90::numeric, 28.00::numeric,   35::numeric, 35::numeric),
    ('21', 38.90::numeric, 25.00::numeric,   30::numeric, 35::numeric),
    ('22', 24.90::numeric, 14.00::numeric,   25::numeric, 40::numeric),
    ('30', 49.90::numeric, 28.00::numeric,   20::numeric, 40::numeric),
    ('31', 29.90::numeric, 16.00::numeric,   25::numeric, 40::numeric),
    ('40', 12.90::numeric,  6.50::numeric,   45::numeric, 50::numeric),
    ('41', 22.90::numeric, 12.00::numeric,   30::numeric, 45::numeric)
  ) AS x(codigo, preco, custo, estoque, margem) ON x.codigo = p.codigo
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.produto_filial pf
    WHERE pf.produto = p.id AND pf.filial = v_filial
  );

  -- Garante preços atualizados também para os novos (caso já existisse o vínculo)
  UPDATE public.produto_filial pf
  SET valor_venda = x.preco,
      valor_compra = x.custo,
      estoque = x.estoque,
      margem_venda = x.margem,
      situacao = 'ativo'
  FROM public.produtos p
  JOIN (VALUES
    ('10', 3.50::numeric,  1.80::numeric, 120::numeric, 48::numeric),
    ('11', 5.90::numeric,  3.20::numeric,  80::numeric, 45::numeric),
    ('12', 4.50::numeric,  2.40::numeric, 100::numeric, 46::numeric),
    ('13', 9.90::numeric,  5.50::numeric,  40::numeric, 44::numeric),
    ('14', 8.90::numeric,  4.80::numeric,  60::numeric, 46::numeric),
    ('15', 6.50::numeric,  2.50::numeric, 150::numeric, 60::numeric),
    ('16', 7.90::numeric,  4.00::numeric,  70::numeric, 49::numeric),
    ('17', 6.90::numeric,  3.50::numeric,  90::numeric, 49::numeric),
    ('20', 42.90::numeric, 28.00::numeric, 35::numeric, 35::numeric),
    ('21', 38.90::numeric, 25.00::numeric, 30::numeric, 35::numeric),
    ('22', 24.90::numeric, 14.00::numeric, 25::numeric, 40::numeric),
    ('30', 49.90::numeric, 28.00::numeric, 20::numeric, 40::numeric),
    ('31', 29.90::numeric, 16.00::numeric, 25::numeric, 40::numeric),
    ('40', 12.90::numeric,  6.50::numeric, 45::numeric, 50::numeric),
    ('41', 22.90::numeric, 12.00::numeric, 30::numeric, 45::numeric)
  ) AS x(codigo, preco, custo, estoque, margem) ON p.codigo = x.codigo
  WHERE pf.produto = p.id AND pf.filial = v_filial;
END $$;

-- Conferência
SELECT p.codigo, p.descricao, pf.valor_venda, pf.estoque, pf.situacao
FROM public.produtos p
LEFT JOIN public.produto_filial pf ON pf.produto = p.id
ORDER BY p.codigo::int NULLS LAST, p.codigo;
