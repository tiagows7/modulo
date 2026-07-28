"use client";

import { Users } from "lucide-react";
import { ModulePage } from "@/components/ModulePage";

const columns = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Nome / Razão Social" },
  { key: "tipo", label: "Tipo" },
  { key: "cpfCnpj", label: "CPF / CNPJ" },
  { key: "cidade", label: "Cidade" },
  { key: "telefone", label: "Telefone" },
  { key: "status", label: "Status", align: "center" as const },
];

const rows = [
  { codigo: "001", nome: "Posto Central Ltda", tipo: "Fornecedor", cpfCnpj: "12.345.678/0001-90", cidade: "São Paulo", telefone: "(11) 98765-4321", status: <span className="badge badge-success">Ativo</span> },
  { codigo: "002", nome: "Distribuidora Norte S.A.", tipo: "Fornecedor", cpfCnpj: "98.765.432/0001-10", cidade: "Campinas", telefone: "(19) 3344-5566", status: <span className="badge badge-success">Ativo</span> },
  { codigo: "003", nome: "João da Silva", tipo: "Cliente", cpfCnpj: "123.456.789-00", cidade: "São Paulo", telefone: "(11) 91234-5678", status: <span className="badge badge-success">Ativo</span> },
  { codigo: "004", nome: "Maria Oliveira", tipo: "Cliente", cpfCnpj: "987.654.321-00", cidade: "Guarulhos", telefone: "(11) 99876-5432", status: <span className="badge badge-warning">Inativo</span> },
  { codigo: "005", nome: "Transportes Rio Ltda", tipo: "Cliente", cpfCnpj: "11.222.333/0001-44", cidade: "Osasco", telefone: "(11) 3456-7890", status: <span className="badge badge-success">Ativo</span> },
  { codigo: "006", nome: "Petrobras Distribuidora", tipo: "Fornecedor", cpfCnpj: "33.000.167/0001-01", cidade: "Rio de Janeiro", telefone: "(21) 3030-1010", status: <span className="badge badge-success">Ativo</span> },
  { codigo: "007", nome: "Auto Peças Veloz", tipo: "Fornecedor", cpfCnpj: "55.444.333/0001-22", cidade: "São Paulo", telefone: "(11) 2233-4455", status: <span className="badge badge-danger">Bloqueado</span> },
];

export default function CadastrosPage() {
  return (
    <ModulePage
      title="Cadastros"
      description="Gerenciamento de clientes, fornecedores e parceiros"
      icon={<Users size={22} />}
      columns={columns}
      rows={rows}
      addLabel="Novo Cadastro"
    />
  );
}
