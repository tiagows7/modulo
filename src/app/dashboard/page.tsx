"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Fuel,
  DollarSign,
  ShoppingCart,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Droplets,
} from "lucide-react";

// =====================
// MOCK DATA
// =====================
const kpiCards = [
  {
    id: "vendas",
    title: "Vendas do Dia",
    value: "R$ 48.720",
    sub: "R$ 52.300 ontem",
    trend: -6.9,
    icon: DollarSign,
    color: "#1A6FD8",
    glow: "rgba(26,111,216,0.25)",
  },
  {
    id: "abastecimentos",
    title: "Abastecimentos",
    value: "314",
    sub: "289 ontem",
    trend: 8.7,
    icon: Fuel,
    color: "#4A9FE8",
    glow: "rgba(74,159,232,0.25)",
  },
  {
    id: "litros",
    title: "Litros Vendidos",
    value: "18.450 L",
    sub: "17.820 L ontem",
    trend: 3.5,
    icon: Droplets,
    color: "#22C55E",
    glow: "rgba(34,197,94,0.25)",
  },
  {
    id: "caixa",
    title: "Caixa Atual",
    value: "R$ 12.340",
    sub: "Atualizado agora",
    trend: null,
    icon: ShoppingCart,
    color: "#F5C518",
    glow: "rgba(245,197,24,0.25)",
  },
];

const fuelStock = [
  { name: "Gasolina Comum", level: 72, capacity: 30000, current: 21600, color: "#1A6FD8", alert: false },
  { name: "Gasolina Aditivada", level: 45, capacity: 20000, current: 9000, color: "#4A9FE8", alert: false },
  { name: "Etanol", level: 28, capacity: 25000, current: 7000, color: "#22C55E", alert: true },
  { name: "Diesel S10", level: 18, capacity: 40000, current: 7200, color: "#F5C518", alert: true },
];

const recentMovements = [
  { id: "MOV-001", hora: "21:14", tipo: "Venda", produto: "Gasolina Comum", qtd: "45,00 L", valor: "R$ 324,00", status: "ok" },
  { id: "MOV-002", hora: "21:08", tipo: "Venda", produto: "Diesel S10",     qtd: "120,00 L", valor: "R$ 756,00", status: "ok" },
  { id: "MOV-003", hora: "20:55", tipo: "Sangria", produto: "Caixa PDV 01", qtd: "—",       valor: "R$ 500,00", status: "warning" },
  { id: "MOV-004", hora: "20:41", tipo: "Venda", produto: "Etanol",         qtd: "35,00 L", valor: "R$ 157,50", status: "ok" },
  { id: "MOV-005", hora: "20:30", tipo: "Venda", produto: "Gasolina Aditivada", qtd: "52,00 L", valor: "R$ 406,60", status: "ok" },
  { id: "MOV-006", hora: "20:12", tipo: "Compra", produto: "Gasolina Comum", qtd: "8.000 L", valor: "R$ 51.200,00", status: "info" },
];

const alerts = [
  { id: 1, type: "danger", msg: "Diesel S10 com estoque crítico — 18% da capacidade" },
  { id: 2, type: "warning", msg: "Etanol abaixo de 30% — solicitar reabastecimento" },
  { id: 3, type: "info", msg: "3 notas fiscais pendentes de emissão" },
];

// =====================
// COMPONENTS
// =====================

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

function KpiCard({ card, index }: { card: typeof kpiCards[0]; index: number }) {
  const Icon = card.icon;
  const isPositive = card.trend !== null && card.trend > 0;
  const isNegative = card.trend !== null && card.trend < 0;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, boxShadow: `0 12px 40px ${card.glow}` }}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 14,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        cursor: "default",
        transition: "border-color 0.2s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow blob */}
      <div
        style={{
          position: "absolute", top: -20, right: -20,
          width: 100, height: 100, borderRadius: "50%",
          background: `radial-gradient(circle, ${card.glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
          {card.title}
        </span>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${card.glow}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon size={18} style={{ color: card.color }} />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
          {card.value}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
          {card.trend !== null && (
            <span
              style={{
                display: "flex", alignItems: "center", gap: 2,
                fontSize: 11, fontWeight: 700,
                color: isPositive ? "#22C55E" : isNegative ? "#EF4444" : "var(--text-muted)",
              }}
            >
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(card.trend)}%
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{card.sub}</span>
        </div>
      </div>
    </motion.div>
  );
}

function FuelGauge({ fuel, index }: { fuel: typeof fuelStock[0]; index: number }) {
  return (
    <motion.div
      custom={index + 4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {fuel.alert && <AlertTriangle size={12} style={{ color: "#F59E0B" }} />}
          <span style={{ fontSize: 13, fontWeight: 500, color: fuel.alert ? "var(--text-primary)" : "var(--text-secondary)" }}>
            {fuel.name}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
          {fuel.current.toLocaleString("pt-BR")} / {fuel.capacity.toLocaleString("pt-BR")} L
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: 8, borderRadius: 100,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fuel.level}%` }}
          transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: "easeOut" }}
          style={{
            height: "100%",
            borderRadius: 100,
            background: fuel.level < 25
              ? "linear-gradient(90deg, #EF4444, #F59E0B)"
              : fuel.level < 40
              ? "linear-gradient(90deg, #F59E0B, #F5C518)"
              : `linear-gradient(90deg, ${fuel.color}, ${fuel.color}cc)`,
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11, fontWeight: 700,
            color: fuel.level < 25 ? "#EF4444" : fuel.level < 40 ? "#F59E0B" : "#22C55E",
          }}
        >
          {fuel.level}% cheio
        </span>
        {fuel.alert && (
          <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>⚠ Solicitar reabastecimento</span>
        )}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1400 }}>

      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 26,
              fontWeight: 800,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
            Visão geral das operações do dia
          </p>
        </div>

        <motion.div
          whileHover={{ scale: 1.03 }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 8, padding: "6px 14px",
            color: "#22C55E", fontSize: 12, fontWeight: 600,
            cursor: "default",
          }}
        >
          <CheckCircle size={13} />
          Sistema Operacional
        </motion.div>
      </motion.div>

      {/* Alerts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {alerts.map((alert, i) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 16px",
              borderRadius: 8,
              background:
                alert.type === "danger"  ? "rgba(239,68,68,0.08)"  :
                alert.type === "warning" ? "rgba(245,158,11,0.08)" :
                "rgba(59,130,246,0.08)",
              border: `1px solid ${
                alert.type === "danger"  ? "rgba(239,68,68,0.2)"  :
                alert.type === "warning" ? "rgba(245,158,11,0.2)" :
                "rgba(59,130,246,0.2)"
              }`,
              fontSize: 13,
              color:
                alert.type === "danger"  ? "#EF4444"  :
                alert.type === "warning" ? "#F59E0B" :
                "#3B82F6",
            }}
          >
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            {alert.msg}
          </motion.div>
        ))}
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {kpiCards.map((card, i) => (
          <KpiCard key={card.id} card={card} index={i} />
        ))}
      </div>

      {/* Bottom section: Fuel stock + Recent movements */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 20,
        }}
      >
        {/* Fuel Stock Card */}
        <motion.div
          custom={8}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: "20px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Estoque de Combustíveis</h3>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Nível atual dos tanques</p>
            </div>
            <BarChart3 size={18} style={{ color: "var(--blue-light)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {fuelStock.map((f, i) => (
              <FuelGauge key={f.name} fuel={f} index={i} />
            ))}
          </div>
        </motion.div>

        {/* Recent Movements */}
        <motion.div
          custom={9}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 14,
            padding: "20px 22px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Movimentos Recentes</h3>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>Últimas operações do dia</p>
            </div>
            <motion.div
              whileHover={{ x: 3 }}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "var(--blue-light)", cursor: "pointer", fontWeight: 600,
              }}
            >
              Ver tudo <ArrowRight size={13} />
            </motion.div>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Tipo</th>
                <th>Produto</th>
                <th>Qtd</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentMovements.map((m, i) => (
                <motion.tr
                  key={m.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
                >
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)" }}>
                      <Clock size={12} /> {m.hora}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{m.tipo}</td>
                  <td>{m.produto}</td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{m.qtd}</td>
                  <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>
                    {m.valor}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${m.status === "ok" ? "success" : m.status === "warning" ? "warning" : "info"}`}
                    >
                      {m.status === "ok" ? "OK" : m.status === "warning" ? "Atenção" : "Info"}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </div>
  );
}
