"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { CreditCard, FilePlus2 } from "lucide-react";

const submenus = [
  {
    href: "/contas-pagar/inclusao",
    label: "Inclusão de Contas a Pagar",
    icon: FilePlus2,
    description: "Cadastro e consulta de títulos a pagar (notas e despesas)",
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

export default function ContasPagarMenuPage() {
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
          <CreditCard size={22} />
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
            Contas a Pagar
          </h1>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            Selecione uma das opções abaixo para gerenciar as obrigações
          </p>
        </div>
      </motion.div>

      <div className="module-hub-grid">
        {submenus.map((item, i) => {
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
