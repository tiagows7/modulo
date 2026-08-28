"use client";

import { useEffect, useMemo, useState } from "react";
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
  ArrowRight,
  Droplets,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type KpiCardData = {
  id: string;
  title: string;
  value: string;
  sub: string;
  trend: number | null;
  icon: LucideIcon;
  color: string;
  glow: string;
};

type DayAgg = { qtd: number; litros: number; valor: number };

type MonthPoint = {
  key: string;
  label: string;
  valor: number;
  projected: boolean;
};

const emptyAgg: DayAgg = { qtd: 0, litros: 0, valor: 0 };
const HIST_MONTHS = 6;
const PROJ_MONTHS = 3;

function isoDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMoney(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatMoneyShort(n: number) {
  if (n >= 1_000_000) {
    return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (n >= 1_000) {
    return `R$ ${(n / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return formatMoney(n);
}

function formatLitros(n: number) {
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} L`;
}

function pctTrend(today: number, yesterday: number): number | null {
  if (yesterday <= 0) return today > 0 ? 100 : null;
  return Number((((today - yesterday) / yesterday) * 100).toFixed(1));
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  const name = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", {
    month: "short",
  });
  return `${name.replace(".", "")}/${String(y).slice(2)}`;
}

function startOfMonthMonthsAgo(n: number) {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  return d;
}

function addMonths(key: string, n: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
}

/** Projeção linear + média móvel dos últimos meses. */
function projectSales(history: number[], count: number): number[] {
  const positive = history.filter((v) => v > 0);
  if (positive.length === 0) return Array.from({ length: count }, () => 0);
  if (positive.length === 1) {
    return Array.from({ length: count }, () => positive[0]);
  }

  const n = history.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += history[i];
    sumXY += i * history[i];
    sumXX += i * i;
  }
  const den = n * sumXX - sumX * sumX;
  const slope = den === 0 ? 0 : (n * sumXY - sumX * sumY) / den;
  const intercept = (sumY - slope * sumX) / n;

  const last3 = history.slice(-3);
  const ma = last3.reduce((a, b) => a + b, 0) / last3.length;

  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const trend = intercept + slope * (n + i);
    out.push(Math.max(0, Number((trend * 0.7 + ma * 0.3).toFixed(2))));
  }
  return out;
}

async function loadDayAgg(dateIso: string): Promise<DayAgg> {
  const { data, error } = await supabase
    .from("abastecimentos")
    .select("litros, valor")
    .eq("data", dateIso);

  if (error) {
    console.warn("[dashboard] abastecimentos:", error.message);
    return emptyAgg;
  }

  let qtd = 0;
  let litros = 0;
  let valor = 0;
  for (const row of data ?? []) {
    qtd += 1;
    litros += Number(row.litros) || 0;
    valor += Number(row.valor) || 0;
  }
  return { qtd, litros, valor };
}

async function loadMonthlySales(): Promise<MonthPoint[]> {
  const start = startOfMonthMonthsAgo(HIST_MONTHS - 1);
  const { data, error } = await supabase
    .from("abastecimentos")
    .select("data, valor")
    .gte("data", isoDateLocal(start));

  if (error) {
    console.warn("[dashboard] vendas mensais:", error.message);
  }

  const byMonth = new Map<string, number>();
  for (let i = 0; i < HIST_MONTHS; i++) {
    const key = monthKey(startOfMonthMonthsAgo(HIST_MONTHS - 1 - i));
    byMonth.set(key, 0);
  }

  for (const row of data ?? []) {
    if (!row.data) continue;
    const key = String(row.data).slice(0, 7);
    if (!byMonth.has(key)) continue;
    byMonth.set(key, (byMonth.get(key) ?? 0) + (Number(row.valor) || 0));
  }

  const historyKeys = [...byMonth.keys()].sort();
  const historyVals = historyKeys.map((k) => byMonth.get(k) ?? 0);
  const projectedVals = projectSales(historyVals, PROJ_MONTHS);

  const points: MonthPoint[] = historyKeys.map((key) => ({
    key,
    label: monthLabel(key),
    valor: byMonth.get(key) ?? 0,
    projected: false,
  }));

  let last = historyKeys[historyKeys.length - 1];
  for (let i = 0; i < PROJ_MONTHS; i++) {
    last = addMonths(last, 1);
    points.push({
      key: last,
      label: monthLabel(last),
      valor: projectedVals[i] ?? 0,
      projected: true,
    });
  }

  return points;
}

function buildKpiCards(today: DayAgg, yesterday: DayAgg): KpiCardData[] {
  return [
    {
      id: "vendas",
      title: "Vendas do Dia",
      value: formatMoney(today.valor),
      sub: `${formatMoney(yesterday.valor)} ontem`,
      trend: pctTrend(today.valor, yesterday.valor),
      icon: DollarSign,
      color: "#1A6FD8",
      glow: "rgba(26,111,216,0.25)",
    },
    {
      id: "abastecimentos",
      title: "Abastecimentos",
      value: String(today.qtd),
      sub: `${yesterday.qtd} ontem`,
      trend: pctTrend(today.qtd, yesterday.qtd),
      icon: Fuel,
      color: "#4A9FE8",
      glow: "rgba(74,159,232,0.25)",
    },
    {
      id: "litros",
      title: "Litros Vendidos",
      value: formatLitros(today.litros),
      sub: `${formatLitros(yesterday.litros)} ontem`,
      trend: pctTrend(today.litros, yesterday.litros),
      icon: Droplets,
      color: "#22C55E",
      glow: "rgba(34,197,94,0.25)",
    },
    {
      id: "caixa",
      title: "Caixa Atual",
      value: "—",
      sub: "Em breve",
      trend: null,
      icon: ShoppingCart,
      color: "#F5C518",
      glow: "rgba(245,197,24,0.25)",
    },
  ];
}

const FUEL_COLORS = ["#1A6FD8", "#4A9FE8", "#22C55E", "#F5C518", "#A78BFA", "#F97316"];

type FuelStockItem = {
  id: string;
  name: string;
  level: number;
  capacity: number;
  current: number;
  color: string;
  alert: boolean;
};

type FuelStockResult = {
  items: FuelStockItem[];
  refDate: string | null;
  fromToday: boolean;
};

async function loadFuelStockFromMarcacao(): Promise<FuelStockResult> {
  const today = isoDateLocal(new Date());
  const selectCols = `
    produto, marcacao_final, tanque, data,
    produtos ( codigo, descricao ),
    tanques ( capacidade, numero )
  `;

  const todayRes = await supabase
    .from("marcacao_tanques")
    .select(selectCols)
    .eq("data", today);

  if (todayRes.error) {
    console.warn("[dashboard] marcacao_tanques:", todayRes.error.message);
  }

  let rows = todayRes.data ?? [];
  let refDate: string | null = today;
  let fromToday = true;

  if (!rows.length) {
    fromToday = false;
    const lastRes = await supabase
      .from("marcacao_tanques")
      .select("data")
      .lt("data", today)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastRes.error) {
      console.warn("[dashboard] marcacao_tanques last:", lastRes.error.message);
    }

    const lastDate =
      lastRes.data?.data != null
        ? String(lastRes.data.data).slice(0, 10)
        : null;

    if (!lastDate) {
      return { items: [], refDate: null, fromToday: false };
    }

    refDate = lastDate;
    const prevRes = await supabase
      .from("marcacao_tanques")
      .select(selectCols)
      .eq("data", lastDate);

    if (prevRes.error) {
      console.warn("[dashboard] marcacao_tanques prev:", prevRes.error.message);
      return { items: [], refDate: lastDate, fromToday: false };
    }
    rows = prevRes.data ?? [];
  }

  type Acc = {
    id: string;
    name: string;
    current: number;
    capacity: number;
  };

  const byProduto = new Map<string, Acc>();

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const produtoId = r.produto != null ? String(r.produto) : "sem-produto";
    const prod = asOne(
      r.produtos as
        | { codigo: string; descricao: string }
        | { codigo: string; descricao: string }[]
        | null,
    );
    const tanque = asOne(
      r.tanques as
        | { capacidade: number | null; numero: string }
        | { capacidade: number | null; numero: string }[]
        | null,
    );

    const name = prod
      ? String(prod.descricao || prod.codigo)
      : "Sem produto";
    const current = Number(r.marcacao_final) || 0;
    const capacity = Number(tanque?.capacidade) || 0;

    const prev = byProduto.get(produtoId);
    if (prev) {
      prev.current += current;
      prev.capacity += capacity;
    } else {
      byProduto.set(produtoId, {
        id: produtoId,
        name,
        current,
        capacity,
      });
    }
  }

  const items: FuelStockItem[] = [...byProduto.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((p, i) => {
      const capacity = p.capacity > 0 ? p.capacity : Math.max(p.current, 1);
      const level = Math.min(
        100,
        Math.max(0, Math.round((p.current / capacity) * 100)),
      );
      return {
        id: p.id,
        name: p.name,
        current: p.current,
        capacity: p.capacity > 0 ? p.capacity : p.current,
        level,
        color: FUEL_COLORS[i % FUEL_COLORS.length],
        alert: level < 40,
      };
    });

  return { items, refDate, fromToday };
}

function asOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function formatDateBr(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

type DespesaDia = {
  id: string;
  fornecedor: string;
  descricao: string;
  valor: number;
  situacao: "aberto" | "vencido" | "pago";
};

/** Despesas com vencimento no dia (mock até existir tabela contas_pagar). */
function despesasAPagarHoje(): DespesaDia[] {
  return [
    {
      id: "CP-101",
      fornecedor: "Petrobras Distribuidora",
      descricao: "NF combustível — parcela do dia",
      valor: 12800,
      situacao: "aberto",
    },
    {
      id: "CP-102",
      fornecedor: "Energia Elétrica CPFL",
      descricao: "Fatura vencendo hoje",
      valor: 3200,
      situacao: "aberto",
    },
    {
      id: "CP-103",
      fornecedor: "Limpeza Total",
      descricao: "Serviço mensal",
      valor: 850,
      situacao: "aberto",
    },
    {
      id: "CP-104",
      fornecedor: "Auto Peças Veloz",
      descricao: "NF 1102 — lubrificantes",
      valor: 1340,
      situacao: "vencido",
    },
  ];
}

const fadeUp = {
  hidden: { opacity: 1, y: 0 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};

function SalesMonthlyChart({ points }: { points: MonthPoint[] }) {
  const maxValor = useMemo(() => {
    const m = Math.max(...points.map((p) => p.valor), 0);
    return m > 0 ? m * 1.15 : 1;
  }, [points]);

  const realTotal = points
    .filter((p) => !p.projected)
    .reduce((s, p) => s + p.valor, 0);
  const projTotal = points
    .filter((p) => p.projected)
    .reduce((s, p) => s + p.valor, 0);

  return (
    <motion.div
      custom={7}
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
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 18,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}
          >
            Vendas mês a mês
          </h3>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            Histórico dos últimos {HIST_MONTHS} meses e projeção dos próximos{" "}
            {PROJ_MONTHS}
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "#1A6FD8",
                display: "inline-block",
              }}
            />
            Realizado ({formatMoneyShort(realTotal)})
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: "rgba(245,197,24,0.85)",
                border: "1px dashed rgba(245,197,24,0.9)",
                display: "inline-block",
              }}
            />
            Projetado ({formatMoneyShort(projTotal)})
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))`,
          alignItems: "end",
          gap: 10,
          height: 220,
          padding: "8px 4px 0",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {points.map((p, i) => {
          const h = Math.max(4, (p.valor / maxValor) * 100);
          return (
            <div
              key={p.key}
              title={`${p.label}: ${formatMoney(p.valor)}${p.projected ? " (projeção)" : ""}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                gap: 6,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: p.projected ? "#F5C518" : "var(--text-secondary)",
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {p.valor > 0 ? formatMoneyShort(p.valor) : "—"}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ delay: 0.15 + i * 0.04, duration: 0.45 }}
                style={{
                  width: "70%",
                  maxWidth: 42,
                  borderRadius: "8px 8px 4px 4px",
                  background: p.projected
                    ? "repeating-linear-gradient(135deg, rgba(245,197,24,0.85), rgba(245,197,24,0.85) 6px, rgba(245,197,24,0.35) 6px, rgba(245,197,24,0.35) 12px)"
                    : "linear-gradient(180deg, #4A9FE8 0%, #1A6FD8 100%)",
                  boxShadow: p.projected
                    ? "none"
                    : "0 6px 16px rgba(26,111,216,0.25)",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(0, 1fr))`,
          gap: 10,
          marginTop: 8,
        }}
      >
        {points.map((p) => (
          <div
            key={`${p.key}-lbl`}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: p.projected ? 600 : 500,
              color: p.projected ? "#F5C518" : "var(--text-muted)",
              textTransform: "capitalize",
            }}
          >
            {p.label}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function KpiCard({ card, index }: { card: KpiCardData; index: number }) {
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
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -20,
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${card.glow} 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
          }}
        >
          {card.title}
        </span>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${card.glow}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} style={{ color: card.color }} />
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "var(--text-primary)",
            fontFamily: "var(--font-display)",
            lineHeight: 1,
          }}
        >
          {card.value}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
          }}
        >
          {card.trend !== null && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                fontSize: 11,
                fontWeight: 700,
                color: isPositive
                  ? "#22C55E"
                  : isNegative
                    ? "#EF4444"
                    : "var(--text-muted)",
              }}
            >
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(card.trend)}%
            </span>
          )}
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {card.sub}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function FuelGauge({
  fuel,
  index,
}: {
  fuel: FuelStockItem;
  index: number;
}) {
  return (
    <motion.div
      custom={index + 4}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      style={{ display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {fuel.alert && (
            <AlertTriangle size={12} style={{ color: "#F59E0B" }} />
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: fuel.alert
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            }}
          >
            {fuel.name}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fuel.current.toLocaleString("pt-BR")} /{" "}
          {fuel.capacity.toLocaleString("pt-BR")} L
        </span>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 100,
          background: "var(--bg-elevated)",
          overflow: "hidden",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fuel.level}%` }}
          transition={{
            delay: 0.3 + index * 0.08,
            duration: 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{
            height: "100%",
            borderRadius: 100,
            background: fuel.alert
              ? "linear-gradient(90deg, #F59E0B, #EF4444)"
              : `linear-gradient(90deg, ${fuel.color}, ${fuel.color}cc)`,
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color:
              fuel.level < 25
                ? "#EF4444"
                : fuel.level < 40
                  ? "#F59E0B"
                  : "#22C55E",
          }}
        >
          {fuel.level}% cheio
        </span>
        {fuel.alert && (
          <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600 }}>
            ⚠ Solicitar reabastecimento
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [kpiCards, setKpiCards] = useState<KpiCardData[]>(() =>
    buildKpiCards(emptyAgg, emptyAgg),
  );
  const [monthPoints, setMonthPoints] = useState<MonthPoint[]>([]);
  const [fuelStock, setFuelStock] = useState<FuelStockItem[]>([]);
  const [fuelRefDate, setFuelRefDate] = useState<string | null>(null);
  const [fuelFromToday, setFuelFromToday] = useState(true);
  const despesasDia = despesasAPagarHoje();
  const totalDespesasDia = despesasDia.reduce((sum, d) => sum + d.valor, 0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const now = new Date();
      const todayIso = isoDateLocal(now);
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterdayIso = isoDateLocal(y);

      const [today, yesterday, months, fuel] = await Promise.all([
        loadDayAgg(todayIso),
        loadDayAgg(yesterdayIso),
        loadMonthlySales(),
        loadFuelStockFromMarcacao(),
      ]);
      if (cancelled) return;
      setKpiCards(buildKpiCards(today, yesterday));
      setMonthPoints(months);
      setFuelStock(fuel.items);
      setFuelRefDate(fuel.refDate);
      setFuelFromToday(fuel.fromToday);
    }

    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1400,
      }}
    >
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
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
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.25)",
            borderRadius: 8,
            padding: "6px 14px",
            color: "#22C55E",
            fontSize: 12,
            fontWeight: 600,
            cursor: "default",
          }}
        >
          <CheckCircle size={13} />
          Sistema Operacional
        </motion.div>
      </motion.div>

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

      <SalesMonthlyChart points={monthPoints} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 20,
        }}
      >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Estoque de Combustíveis
              </h3>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                {fuelRefDate
                  ? fuelFromToday
                    ? `Marcação de hoje (${formatDateBr(fuelRefDate)}) · por produto`
                    : `Sem medição hoje · último dia ${formatDateBr(fuelRefDate)}`
                  : "Sem medições em marcacao_tanques"}
              </p>
            </div>
            <BarChart3 size={18} style={{ color: "var(--blue-light)" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {fuelStock.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  padding: "20px 8px",
                }}
              >
                Nenhuma marcação de tanque encontrada.
              </p>
            ) : (
              fuelStock.map((f, i) => (
                <FuelGauge key={f.id} fuel={f} index={i} />
              ))
            )}
          </div>
        </motion.div>

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}
              >
                Despesas a pagar no dia
              </h3>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                Contas com vencimento hoje · {formatMoney(totalDespesasDia)}
              </p>
            </div>
            <Link href="/contas-pagar" style={{ textDecoration: "none" }}>
              <motion.div
                whileHover={{ x: 3 }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  color: "var(--blue-light)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Ver tudo <ArrowRight size={13} />
              </motion.div>
            </Link>
          </div>

          {despesasDia.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "36px 12px",
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              <CreditCard size={28} style={{ opacity: 0.5 }} />
              Nenhuma despesa com vencimento hoje
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>Descrição</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {despesasDia.map((d, i) => (
                  <motion.tr
                    key={d.id}
                    initial={false}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.06, duration: 0.3 }}
                  >
                    <td style={{ fontWeight: 500 }}>{d.fornecedor}</td>
                    <td>{d.descricao}</td>
                    <td
                      style={{
                        textAlign: "right",
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text-primary)",
                      }}
                    >
                      {formatMoney(d.valor)}
                    </td>
                    <td>
                      <span
                        className={`badge badge-${
                          d.situacao === "pago"
                            ? "success"
                            : d.situacao === "vencido"
                              ? "danger"
                              : "warning"
                        }`}
                      >
                        {d.situacao === "pago"
                          ? "Pago"
                          : d.situacao === "vencido"
                            ? "Vencido"
                            : "A pagar"}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>
    </div>
  );
}
