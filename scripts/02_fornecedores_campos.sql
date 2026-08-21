-- Extensão do cadastro de fornecedores (campos fiscais e endereço)
alter table public.fornecedores add column if not exists fantasia varchar(255);
alter table public.fornecedores add column if not exists cep varchar(12);
alter table public.fornecedores add column if not exists endereco varchar(255);
alter table public.fornecedores add column if not exists numero varchar(30);
alter table public.fornecedores add column if not exists complemento varchar(100);
alter table public.fornecedores add column if not exists bairro varchar(120);
alter table public.fornecedores add column if not exists uf varchar(2);
alter table public.fornecedores add column if not exists telefone1 varchar(20);
alter table public.fornecedores add column if not exists telefone2 varchar(20);
alter table public.fornecedores add column if not exists telefone3 varchar(20);
alter table public.fornecedores add column if not exists inscricao_estadual varchar(30);
alter table public.fornecedores add column if not exists inscricao_municipal varchar(30);
alter table public.fornecedores add column if not exists cpf varchar(14);
alter table public.fornecedores add column if not exists contato varchar(120);
alter table public.fornecedores add column if not exists email varchar(180);

update public.fornecedores
set telefone1 = telefone
where telefone1 is null and telefone is not null;
