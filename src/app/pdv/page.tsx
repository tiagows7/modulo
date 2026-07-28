"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Package,
  CreditCard,
  Monitor,
  BarChart2,
  Settings,
  LogOut,
  Fuel,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronRight,
  ReceiptText,
  Zap,
  Droplets,
} from "lucide-react";

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface Abastecimento {
  id: number;
  bico: string;
  produto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  hora: string;
  selecionado: boolean;
}

interface ItemCupom {
  id: number;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  tipo: "abastecimento" | "produto";
}

// ─── Dados mock ─────────────────────────────────────────────────────────────
const abastecimentosMock: Abastecimento[] = [
  { id: 1,  bico: "01", produto: "Gasolina Comum",    quantidade: 12.00, valorUnitario: 5.89, valorTotal: 70.68,  hora: "08:00", selecionado: false },
  { id: 2,  bico: "02", produto: "Gasolina Aditivada", quantidade: 19.10, valorUnitario: 6.19, valorTotal: 118.23, hora: "08:03", selecionado: false },
  { id: 3,  bico: "03", produto: "Etanol",             quantidade: 26.20, valorUnitario: 3.99, valorTotal: 104.54, hora: "08:06", selecionado: false },
  { id: 4,  bico: "04", produto: "Diesel S10",         quantidade: 33.30, valorUnitario: 5.79, valorTotal: 192.81, hora: "08:09", selecionado: false },
  { id: 5,  bico: "05", produto: "Diesel S500",        quantidade: 40.40, valorUnitario: 5.59, valorTotal: 225.84, hora: "09:12", selecionado: false },
  { id: 6,  bico: "01", produto: "Gasolina Comum",    quantidade: 47.50, valorUnitario: 5.89, valorTotal: 279.77, hora: "09:15", selecionado: false },
  { id: 7,  bico: "02", produto: "Gasolina Aditivada", quantidade: 54.60, valorUnitario: 6.19, valorTotal: 337.97, hora: "09:18", selecionado: false },
  { id: 8,  bico: "03", produto: "Etanol",             quantidade: 61.70, valorUnitario: 3.99, valorTotal: 246.18, hora: "09:21", selecionado: false },
  { id: 9,  bico: "01", produto: "Diesel S10",         quantidade: 68.80, valorUnitario: 5.79, valorTotal: 398.35, hora: "10:24", selecionado: false },
  { id: 10, bico: "02", produto: "Diesel S500",        quantidade: 75.90, valorUnitario: 5.59, valorTotal: 424.28, hora: "10:27", selecionado: false },
  { id: 11, bico: "03", produto: "Gasolina Comum",    quantidade: 82.00, valorUnitario: 5.89, valorTotal: 482.98, hora: "10:30", selecionado: false },
  { id: 12, bico: "04", produto: "Gasolina Aditivada", quantidade: 89.10, valorUnitario: 6.19, valorTotal: 551.53, hora: "10:33", selecionado: false },
  { id: 13, bico: "05", produto: "Etanol",             quantidade: 96.20, valorUnitario: 3.99, valorTotal: 383.84, hora: "11:36", selecionado: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function corProduto(produto: string): string {
  if (produto.includes("Gasolina Comum"))    return "#4A9FE8";
  if (produto.includes("Gasolina Aditivada")) return "#7EC8F8";
  if (produto.includes("Etanol"))             return "#22C55E";
  if (produto.includes("Diesel S10"))         return "#F5C518";
  if (produto.includes("Diesel S500"))        return "#D4A817";
  return "#A8B8CC";
}

function iconeNavAtivo(label: string) {
  if (label === "Venda")    return <ShoppingCart size={20} />;
  if (label === "Produtos") return <Package size={20} />;
  if (label === "Pagar")    return <CreditCard size={20} />;
  if (label === "Caixa")    return <Monitor size={20} />;
  if (label === "Relat.")   return <BarChart2 size={20} />;
  if (label === "Config")   return <Settings size={20} />;
  return null;
}

// ─── Relógio em tempo real ────────────────────────────────────────────────
function RelogioAoVivo() {
  const [agora, setAgora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13, color: "var(--text-secondary)" }}>
      {agora.toLocaleDateString("pt-BR")}
      {", "}
      {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

// ─── Logo Módulo Info (compacta) ──────────────────────────────────────────
function LogoCompacta() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* 3 quadrados */}
      <div style={{ position: "relative", width: 36, height: 28, flexShrink: 0 }}>
        <div style={{
          position: "absolute", left: 0, top: 0,
          width: 16, height: 16, borderRadius: 4,
          background: "linear-gradient(135deg, #0A1F6E, #0D3090)",
          zIndex: 1,
        }} />
        <div style={{
          position: "absolute", left: 9, top: 10,
          width: 16, height: 16, borderRadius: 4,
          background: "linear-gradient(135deg, #1255C8, #1A6FD8)",
          zIndex: 2,
        }} />
        <div style={{
          position: "absolute", left: 19, top: 0,
          width: 16, height: 16, borderRadius: 4,
          background: "linear-gradient(135deg, #4A9FE8, #7EC8F8)",
          zIndex: 3,
        }} />
      </div>
      <div>
        <div style={{
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 800,
          fontSize: 14,
          color: "#E8EDF5",
          lineHeight: 1,
          letterSpacing: "-0.3px",
        }}>
          Módulo Info
        </div>
        <div style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "2px",
          color: "#4A9FE8",
          textTransform: "uppercase",
          marginTop: 1,
        }}>
          PDV
        </div>
      </div>
    </div>
  );
}

// ─── Nav lateral ──────────────────────────────────────────────────────────
const navItens = [
  { label: "Venda",    href: "#venda" },
  { label: "Produtos", href: "#produtos" },
  { label: "Pagar",   href: "#pagar" },
  { label: "Caixa",   href: "#caixa" },
  { label: "Relat.",  href: "#relat" },
  { label: "Config",  href: "#config" },
];

// ─── Componente principal ─────────────────────────────────────────────────
export default function PDVPage() {
  const [navAtiva, setNavAtiva] = useState("Venda");
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>(abastecimentosMock);
  const [cupom, setCupom] = useState<ItemCupom[]>([]);
  const [cupomSuspenso, setCupomSuspenso] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null);
  const [flashSucesso, setFlashSucesso] = useState(false);

  const totalCupom = cupom.reduce((acc, item) => acc + item.valorTotal, 0);

  const abastecimentosDisponiveis = abastecimentos.filter(a => !a.selecionado).length;

  function adicionarAoCupom(ab: Abastecimento) {
    // Marca como selecionado
    setAbastecimentos(prev =>
      prev.map(a => a.id === ab.id ? { ...a, selecionado: true } : a)
    );
    // Adiciona ao cupom
    setCupom(prev => [
      ...prev,
      {
        id: ab.id,
        descricao: `Bico ${ab.bico} — ${ab.produto}`,
        quantidade: ab.quantidade,
        valorUnitario: ab.valorUnitario,
        valorTotal: ab.valorTotal,
        tipo: "abastecimento",
      },
    ]);
  }

  function removerDoCupom(id: number) {
    setAbastecimentos(prev =>
      prev.map(a => a.id === id ? { ...a, selecionado: false } : a)
    );
    setCupom(prev => prev.filter(i => i.id !== id));
  }

  function limparCupom() {
    setAbastecimentos(prev => prev.map(a => ({ ...a, selecionado: false })));
    setCupom([]);
    setCupomSuspenso(false);
  }

  function confirmarPagamento() {
    setFlashSucesso(true);
    setTimeout(() => {
      setFlashSucesso(false);
      setModalPagamento(false);
      setFormaPagamento(null);
      limparCupom();
    }, 2000);
  }

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-base)",
      fontFamily: "'Inter', sans-serif",
    }}>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <aside style={{
        width: 68,
        background: "var(--bg-surface)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 16,
        paddingBottom: 16,
        gap: 4,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: "linear-gradient(135deg, #0D3B8E, #1A6FD8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          boxShadow: "0 4px 16px rgba(26,111,216,0.4)",
          flexShrink: 0,
        }}>
          <Fuel size={22} color="#F5C518" />
        </div>

        {/* Nav items */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, width: "100%", alignItems: "center" }}>
          {navItens.map((item) => {
            const ativo = navAtiva === item.label;
            return (
              <motion.button
                key={item.label}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setNavAtiva(item.label)}
                title={item.label}
                style={{
                  width: 48,
                  height: 52,
                  border: "none",
                  borderRadius: 10,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  position: "relative",
                  background: ativo
                    ? "linear-gradient(135deg, rgba(26,111,216,0.3), rgba(13,59,142,0.2))"
                    : "transparent",
                  color: ativo ? "#4A9FE8" : "#6B7FA0",
                  border: ativo ? "1px solid rgba(74,159,232,0.25)" : "1px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                {ativo && (
                  <div style={{
                    position: "absolute",
                    left: 0, top: "50%",
                    transform: "translateY(-50%)",
                    width: 3, height: "60%",
                    background: "#F5C518",
                    borderRadius: "0 2px 2px 0",
                  }} />
                )}
                {iconeNavAtivo(item.label)}
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.3px" }}>
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Sair */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Sair"
          style={{
            width: 48, height: 48,
            border: "1px solid transparent",
            borderRadius: 10,
            cursor: "pointer",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 4,
            background: "transparent",
            color: "#6B7FA0",
            transition: "all 0.2s",
          }}
          onHoverStart={(e) => {
            (e.target as HTMLElement).style.color = "#EF4444";
          }}
          onHoverEnd={(e) => {
            (e.target as HTMLElement).style.color = "#6B7FA0";
          }}
        >
          <LogOut size={18} />
          <span style={{ fontSize: 9, fontWeight: 600 }}>Sair</span>
        </motion.button>
      </aside>

      {/* ── Main ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* ── Topbar ──────────────────────────────────────────── */}
        <header style={{
          height: 56,
          background: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
          gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <LogoCompacta />
            <div style={{ width: 1, height: 24, background: "var(--border-subtle)" }} />
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: 17,
              fontWeight: 700,
              color: "var(--text-primary)",
            }}>
              Ponto de Venda
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Status caixa */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(34,197,94,0.12)",
              border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#22C55E",
                boxShadow: "0 0 8px rgba(34,197,94,0.6)",
              }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#22C55E" }}>
                Caixa aberto
              </span>
            </div>

            {/* Operador */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "linear-gradient(135deg, #1A6FD8, #4A9FE8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, color: "white",
              }}>
                CS
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                Carlos Silva
              </span>
            </div>

            {/* Relógio */}
            <div style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 20, padding: "5px 12px",
            }}>
              <RelogioAoVivo />
            </div>
          </div>
        </header>

        {/* ── Conteúdo ─────────────────────────────────────────── */}
        <div style={{
          flex: 1, display: "flex", overflow: "hidden", gap: 0,
        }}>

          {/* ── Painel esquerdo: Abastecimentos ──────────────────── */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            padding: "20px 0 20px 20px",
          }}>
            {/* Header da tabela */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 14, paddingRight: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h2 style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                }}>
                  Abastecimentos
                </h2>
                <span style={{
                  background: "rgba(74,159,232,0.12)",
                  border: "1px solid rgba(74,159,232,0.25)",
                  borderRadius: 20,
                  padding: "2px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#4A9FE8",
                }}>
                  {abastecimentosDisponiveis} disponíveis
                </span>
              </div>
            </div>

            {/* Tabela scrollável */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: 20,
              paddingBottom: 4,
            }}>
              <div style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                overflow: "hidden",
              }}>
                {/* Cabeçalho */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "56px 1fr 100px 110px 100px 72px",
                  background: "var(--bg-elevated)",
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                }}>
                  {["BICO", "PRODUTO", "QUANTIDADE", "VALOR UNITÁRIO", "VALOR TOTAL", "HORA"].map((col) => (
                    <span key={col} style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      letterSpacing: "0.8px",
                      textTransform: "uppercase",
                    }}>
                      {col}
                    </span>
                  ))}
                </div>

                {/* Linhas */}
                <AnimatePresence>
                  {abastecimentos.map((ab, idx) => {
                    const cor = corProduto(ab.produto);
                    const selecionado = ab.selecionado;
                    return (
                      <motion.div
                        key={ab.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => !selecionado && adicionarAoCupom(ab)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "56px 1fr 100px 110px 100px 72px",
                          padding: "12px 16px",
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: selecionado ? "default" : "pointer",
                          opacity: selecionado ? 0.4 : 1,
                          background: selecionado ? "var(--bg-elevated)" : "transparent",
                          transition: "all 0.15s ease",
                          alignItems: "center",
                        }}
                        whileHover={!selecionado ? { backgroundColor: "#132644" } : {}}
                      >
                        {/* Bico */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: selecionado
                              ? "rgba(107,127,160,0.1)"
                              : `linear-gradient(135deg, ${cor}22, ${cor}11)`,
                            border: `1px solid ${selecionado ? "rgba(107,127,160,0.2)" : cor + "44"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 800,
                            color: selecionado ? "var(--text-muted)" : cor,
                          }}>
                            {ab.bico}
                          </div>
                        </div>

                        {/* Produto */}
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: selecionado ? "var(--text-muted)" : "var(--text-primary)",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          <Droplets size={12} color={selecionado ? "var(--text-muted)" : cor} />
                          {ab.produto}
                        </span>

                        {/* Quantidade */}
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          {ab.quantidade.toFixed(2).replace(".", ",")} L
                        </span>

                        {/* Valor unitário */}
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                          R$ {ab.valorUnitario.toFixed(2).replace(".", ",")}
                        </span>

                        {/* Valor total */}
                        <span style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: selecionado ? "var(--text-muted)" : "#F5C518",
                        }}>
                          R$ {ab.valorTotal.toFixed(2).replace(".", ",")}
                        </span>

                        {/* Hora */}
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {ab.hora}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Painel direito: Cupom ─────────────────────────────── */}
          <div style={{
            width: 340,
            background: "var(--bg-surface)",
            borderLeft: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}>
            {/* Cabeçalho do cupom */}
            <div style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ReceiptText size={16} color="#4A9FE8" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                  Cupom atual
                </span>
                {cupom.length > 0 && (
                  <span style={{
                    background: "rgba(245,197,24,0.15)",
                    border: "1px solid rgba(245,197,24,0.3)",
                    borderRadius: 12, padding: "1px 8px",
                    fontSize: 11, fontWeight: 700, color: "#F5C518",
                  }}>
                    {cupom.length}
                  </span>
                )}
              </div>
              {cupom.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={limparCupom}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: "#EF4444",
                    fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 8px",
                    borderRadius: 6,
                    transition: "background 0.2s",
                  }}
                >
                  <Trash2 size={13} />
                  Limpar
                </motion.button>
              )}
            </div>

            {/* Itens do cupom */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
              {cupom.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    height: "100%", gap: 12,
                    color: "var(--text-muted)",
                    textAlign: "center", padding: "40px 20px",
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: 14,
                    background: "var(--bg-elevated)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <ReceiptText size={24} color="var(--text-muted)" />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                    Nenhum item no cupom.{"\n"}Selecione um abastecimento disponível ou um produto.
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {cupom.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        marginBottom: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
                          {item.descricao}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removerDoCupom(item.id)}
                          style={{
                            background: "rgba(239,68,68,0.1)",
                            border: "none", cursor: "pointer",
                            borderRadius: 6, padding: 4,
                            color: "#EF4444", display: "flex",
                          }}
                        >
                          <XCircle size={14} />
                        </motion.button>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {item.quantidade.toFixed(2).replace(".", ",")} L × R$ {item.valorUnitario.toFixed(2).replace(".", ",")}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#F5C518" }}>
                          R$ {item.valorTotal.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Rodapé: Total + Botões */}
            <div style={{
              padding: "16px 20px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}>
              {/* Total */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>Total</span>
                <motion.span
                  key={totalCupom}
                  initial={{ scale: 1.15, color: "#FFE066" }}
                  animate={{ scale: 1, color: "#F5C518" }}
                  transition={{ duration: 0.3 }}
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 24,
                    fontWeight: 800,
                    color: "#F5C518",
                  }}
                >
                  R$ {totalCupom.toFixed(2).replace(".", ",")}
                </motion.span>
              </div>

              {/* Botão pagamento */}
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => cupom.length > 0 && setModalPagamento(true)}
                style={{
                  width: "100%",
                  padding: "14px",
                  border: "none",
                  borderRadius: 10,
                  cursor: cupom.length > 0 ? "pointer" : "not-allowed",
                  background: cupom.length > 0
                    ? "linear-gradient(135deg, #F5C518, #D4A817)"
                    : "rgba(107,127,160,0.2)",
                  color: cupom.length > 0 ? "#060D1A" : "var(--text-muted)",
                  fontWeight: 800,
                  fontSize: 14,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: "0.3px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                  boxShadow: cupom.length > 0 ? "0 4px 20px rgba(245,197,24,0.3)" : "none",
                }}
              >
                <Zap size={16} />
                Ir para pagamento
              </motion.button>

              {/* Botão suspender */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => cupom.length > 0 && setCupomSuspenso(true)}
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: 10,
                  cursor: cupom.length > 0 ? "pointer" : "not-allowed",
                  background: "transparent",
                  color: cupom.length > 0 ? "var(--text-secondary)" : "var(--text-disabled)",
                  fontWeight: 600,
                  fontSize: 13,
                  transition: "all 0.2s",
                }}
              >
                Suspender cupom
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal de pagamento ────────────────────────────────── */}
      <AnimatePresence>
        {modalPagamento && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(6,13,26,0.85)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
            onClick={(e) => e.target === e.currentTarget && setModalPagamento(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: 20,
                padding: 32,
                width: 420,
                maxWidth: "90vw",
                boxShadow: "0 32px 80px rgba(0,0,0,0.5)",
              }}
            >
              {flashSucesso ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", gap: 16, padding: "20px 0",
                  }}
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5 }}
                  >
                    <CheckCircle2 size={64} color="#22C55E" />
                  </motion.div>
                  <h3 style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: 22, fontWeight: 800,
                    color: "#22C55E",
                  }}>
                    Pagamento confirmado!
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Cupom finalizado com sucesso.
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Cabeçalho modal */}
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: 20, fontWeight: 800,
                      color: "var(--text-primary)", marginBottom: 4,
                    }}>
                      Forma de Pagamento
                    </h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Total:{" "}
                      <strong style={{ color: "#F5C518", fontSize: 16 }}>
                        R$ {totalCupom.toFixed(2).replace(".", ",")}
                      </strong>
                    </p>
                  </div>

                  {/* Opções de pagamento */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
                    {[
                      { id: "dinheiro", label: "Dinheiro", icon: "💵" },
                      { id: "debito",   label: "Débito",   icon: "💳" },
                      { id: "credito",  label: "Crédito",  icon: "💳" },
                      { id: "pix",      label: "PIX",      icon: "⚡" },
                    ].map((op) => (
                      <motion.button
                        key={op.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setFormaPagamento(op.id)}
                        style={{
                          padding: "16px 12px",
                          border: formaPagamento === op.id
                            ? "2px solid #F5C518"
                            : "1px solid var(--border-subtle)",
                          borderRadius: 12,
                          background: formaPagamento === op.id
                            ? "rgba(245,197,24,0.1)"
                            : "var(--bg-elevated)",
                          cursor: "pointer",
                          display: "flex", flexDirection: "column",
                          alignItems: "center", gap: 8,
                          transition: "all 0.2s",
                        }}
                      >
                        <span style={{ fontSize: 24 }}>{op.icon}</span>
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: formaPagamento === op.id ? "#F5C518" : "var(--text-secondary)",
                        }}>
                          {op.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Botões */}
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => { setModalPagamento(false); setFormaPagamento(null); }}
                      style={{
                        flex: 1, padding: "12px",
                        border: "1px solid var(--border-default)",
                        borderRadius: 10, background: "transparent",
                        color: "var(--text-secondary)",
                        fontWeight: 600, fontSize: 13, cursor: "pointer",
                      }}
                    >
                      Cancelar
                    </button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={confirmarPagamento}
                      disabled={!formaPagamento}
                      style={{
                        flex: 2, padding: "12px",
                        border: "none", borderRadius: 10,
                        background: formaPagamento
                          ? "linear-gradient(135deg, #F5C518, #D4A817)"
                          : "rgba(107,127,160,0.2)",
                        color: formaPagamento ? "#060D1A" : "var(--text-muted)",
                        fontWeight: 800, fontSize: 14,
                        fontFamily: "'Outfit', sans-serif",
                        cursor: formaPagamento ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 8,
                        boxShadow: formaPagamento ? "0 4px 20px rgba(245,197,24,0.3)" : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Confirmar Pagamento
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast cupom suspenso ───────────────────────────────── */}
      <AnimatePresence>
        {cupomSuspenso && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            style={{
              position: "fixed", bottom: 24, right: 24, zIndex: 200,
              background: "var(--bg-elevated)",
              border: "1px solid rgba(245,197,24,0.4)",
              borderRadius: 12, padding: "14px 20px",
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <Clock size={18} color="#F5C518" />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                Cupom suspenso
              </p>
              <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                R$ {totalCupom.toFixed(2).replace(".", ",")} • {cupom.length} {cupom.length === 1 ? "item" : "itens"}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => setCupomSuspenso(false)}
              style={{
                background: "rgba(245,197,24,0.15)",
                border: "1px solid rgba(245,197,24,0.3)",
                borderRadius: 8, padding: "6px 12px",
                color: "#F5C518", fontWeight: 700, fontSize: 12,
                cursor: "pointer",
              }}
            >
              Retomar
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
