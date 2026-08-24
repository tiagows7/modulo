INSERT INTO public.produtos (codigo, descricao, grupo_id, preco_venda, estoque_atual, status)
VALUES
  ('1', 'Gasolina Comum', '8471bb2c-2146-4a04-bd95-2c6835cf4400', 5.890, 0, 'ativo'),
  ('2', 'Gasolina Aditivada', '8471bb2c-2146-4a04-bd95-2c6835cf4400', 6.190, 0, 'ativo'),
  ('3', 'Etanol', '8471bb2c-2146-4a04-bd95-2c6835cf4400', 3.990, 0, 'ativo')
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  grupo_id = EXCLUDED.grupo_id,
  preco_venda = EXCLUDED.preco_venda,
  status = EXCLUDED.status,
  updated_at = CURRENT_TIMESTAMP;
