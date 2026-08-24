"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Users,
  Truck,
  Package,
  Layers,
  Database,
  Fuel,
  WalletCards,
  Building2,
} from "lucide-react";
import { useAuthProfile } from "@/lib/authRole";

const submenus = [
  {
    href: "/cadastros/filiais",
    label: "Filiais",
    icon: Building2,
    description: "Dados cadastrais das filiais",
    superAdminOnly: true,
  },
  {
    href: "/cadastros/clientes",
    label: "Clientes",
    icon: Users,
    description: "Gestão de clientes e histórico",
  },
  {
    href: "/cadastros/fornecedores",
    label: "Fornecedores",
    icon: Truck,
    description: "Gestão de fornecedores",
  },
  {
    href: "/cadastros/produtos",
    label: "Produtos",
    icon: Package,
    description: "Cadastro de produtos e itens",
  },
  {
    href: "/cadastros/grupo-produtos",
    label: "Grupo de Produtos",
    icon: Layers,
    description: "Categorias e grupos",
  },
  {
    href: "/cadastros/documentos-caixa",
    label: "Documentos de Caixa",
    icon: WalletCards,
    description: "Dinheiro, cartão, PIX e outros",
  },
  {
    href: "/cadastros/tanques",
    label: "Tanques",
    icon: Database,
    description: "Gestão de tanques de combustível",
  },
  {
    href: "/cadastros/bicos",
    label: "Bicos",
    icon: Fuel,
    description: "Configuração de bicos de bombas",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

export default function CadastrosMenuPage() {
  const { ready, isSuperAdmin } = useAuthProfile();
  const visibleMenus = submenus.filter(
    (item) => !item.superAdminOnly || (ready && isSuperAdmin),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", alignItems: "center", gap: 14 }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background:
              "linear-gradient(135deg, rgba(26,111,216,0.3), rgba(13,59,142,0.2))",
            border: "1px solid rgba(74,159,232,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--blue-light)",
          }}
        >
          <Users size={22} />
        </div>
        <div>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 24,
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1.1,
            }}
          >
            Cadastros
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            Selecione uma das opções abaixo para gerenciar os cadastros do
            sistema
          </p>
        </div>
      </motion.div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          marginTop: 8,
        }}
      >
        {visibleMenus.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              <Link href={item.href} style={{ textDecoration: "none" }}>
                <motion.div
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 14,
                    padding: 20,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 16,
                    cursor: "pointer",
                    height: "100%",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-default)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-primary)",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        marginBottom: 4,
                      }}
                    >
                      {item.label}
                    </h3>
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--text-muted)",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
