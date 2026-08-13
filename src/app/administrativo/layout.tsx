/* eslint-disable react/no-unstable-nested-components */
"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  ArrowLeftRight,
  CreditCard,
  FileText,
  DollarSign,
  Monitor,
  ClipboardList,
  Settings,
  Download,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  Fuel,
  Menu,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard",          href: "/administrativo",   group: "geral" },
  { icon: Users,           label: "Cadastros",          href: "/cadastros",   group: "operacao" },
  { icon: Package,         label: "Estoque",            href: "/estoque",     group: "operacao" },
  { icon: ArrowLeftRight,  label: "Movimento",          href: "/movimento",   group: "operacao" },
  { icon: CreditCard,      label: "Contas a Pagar",     href: "/contas-pagar",    group: "financeiro" },
  { icon: FileText,        label: "Contas a Receber",   href: "/contas-receber",  group: "financeiro" },
  { icon: ClipboardList,   label: "Faturamento",        href: "/faturamento",     group: "financeiro" },
  { icon: DollarSign,      label: "Financeiro",         href: "/financeiro",      group: "financeiro" },
  { icon: Monitor,         label: "Movimento PDV",      href: "/pdv",             group: "pdv" },
  { icon: ClipboardList,   label: "Rotinas Sped",       href: "/sped",            group: "fiscal" },
  { icon: Settings,        label: "Usuários",           href: "/administrativo/usuarios",  group: "config" },
  { icon: Download,        label: "Importa Cadastros",  href: "/importa",         group: "config" },
];

const groupLabels: Record<string, string> = {
  geral: "Geral",
  operacao: "Operação",
  financeiro: "Financeiro",
  pdv: "PDV",
  fiscal: "Fiscal",
  config: "Configurações",
};

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-secondary)", fontSize: 13 }}>
      {time.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      &nbsp;&nbsp;
      {time.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
    </span>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [notifications] = useState(3);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarWidth = collapsed ? 68 : 248;

  const SidebarContent = () => {
    // Group nav items
    const groups = Array.from(new Set(navItems.map((i) => i.group)));

    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "0 10px",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Logo area */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 6px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            marginBottom: 12,
          }}
        >
          {/* 3 squares: dark + light at same top level, medium below-center */}
          <div style={{ position: "relative", flexShrink: 0, width: 48, height: 36 }}>
            {/* Square 1 — darkest, TOP-LEFT, z:1 (behind) */}
            <div style={{
              position: "absolute", left: 0, top: 0,
              width: 22, height: 22, borderRadius: 5,
              background: "linear-gradient(135deg, #0A1F6E, #0D3090)",
              zIndex: 1,
            }} />
            {/* Square 2 — medium, CENTER-BOTTOM, z:2 (covers bottom-right of dark) */}
            <div style={{
              position: "absolute", left: 13, top: 14,
              width: 22, height: 22, borderRadius: 5,
              background: "linear-gradient(135deg, #1255C8, #1A6FD8)",
              zIndex: 2,
            }} />
            {/* Square 3 — lightest, TOP-RIGHT (same top as dark), z:3 (front) */}
            <div style={{
              position: "absolute", left: 26, top: 0,
              width: 22, height: 22, borderRadius: 5,
              background: "linear-gradient(135deg, #4A9FE8, #7EC8F8)",
              zIndex: 3,
            }} />
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800,
                    fontSize: 16,
                    color: "var(--text-primary)",
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                  }}
                >
                  Módulo Info
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "2px",
                    textTransform: "uppercase",
                    color: "var(--blue-light)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Automação Comercial
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items grouped */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {groups.map((group, gIdx) => {
            const items = navItems.filter((i) => i.group === group);
            return (
              <div key={group}>
                {/* Group label */}
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "1.5px",
                        textTransform: "uppercase",
                        color: "var(--text-disabled)",
                        padding: "12px 12px 4px",
                      }}
                    >
                      {groupLabels[group]}
                    </motion.div>
                  )}
                </AnimatePresence>
                {!collapsed && gIdx > 0 && (
                  <div style={{ height: 1, background: "var(--border-subtle)", margin: "4px 6px 8px" }} />
                )}

                {items.map((item, idx) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: gIdx * 0.05 + idx * 0.03, duration: 0.3 }}
                    >
                      <Link href={item.href} style={{ textDecoration: "none" }}>
                        <motion.div
                          className={`sidebar-item ${isActive ? "active" : ""}`}
                          whileHover={{ x: collapsed ? 0 : 4 }}
                          whileTap={{ scale: 0.97 }}
                          title={collapsed ? item.label : undefined}
                          style={{ justifyContent: collapsed ? "center" : undefined }}
                        >
                          <Icon size={18} style={{ flexShrink: 0 }} />
                          <AnimatePresence initial={false}>
                            {!collapsed && (
                              <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: "auto" }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: "hidden", whiteSpace: "nowrap" }}
                              >
                                {item.label}
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Logout */}
        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10, paddingBottom: 16 }}>
          <motion.div
            className="sidebar-item"
            style={{
              color: "var(--danger)",
              justifyContent: collapsed ? "center" : undefined,
            }}
            whileHover={{ x: collapsed ? 0 : 4, backgroundColor: "rgba(239,68,68,0.1)" }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/")}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  style={{ overflow: "hidden", whiteSpace: "nowrap" }}
                >
                  Sair
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg-base)" }}>
      {/* =========== SIDEBAR =========== */}
      <AnimatePresence>
        {(!isMobile || mobileOpen) && (
          <>
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.6)",
                  zIndex: 40,
                  backdropFilter: "blur(2px)",
                }}
              />
            )}
            <motion.aside
              initial={isMobile ? { x: "-100%" } : false}
              animate={{ x: 0, width: isMobile ? 248 : sidebarWidth }}
              exit={isMobile ? { x: "-100%" } : undefined}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: "var(--bg-surface)",
                borderRight: "1px solid var(--border-subtle)",
                height: "100vh",
                position: isMobile ? "fixed" : "relative",
                left: 0,
                top: 0,
                flexShrink: 0,
                zIndex: 50,
              }}
            >
              <SidebarContent />

              {/* Collapse toggle */}
              {!isMobile && (
                <motion.button
                  onClick={() => setCollapsed(!collapsed)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  style={{
                    position: "absolute",
                    top: 22,
                    right: -14,
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-default)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 30,
                  }}
                >
                  {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </motion.button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* =========== MAIN AREA =========== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* ---- TOPBAR ---- */}
        <header
          style={{
            height: 60,
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            flexShrink: 0,
            zIndex: 10,
          }}
        >
          {/* Left: breadcrumb / page title */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Fuel size={18} style={{ color: "var(--gold)" }} />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {navItems.find((i) => i.href === pathname)?.label ?? "Sistema"}
            </span>
          </div>

          {/* Right: clock + notifications + avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 20 }}>
            {!isMobile && <Clock />}

            {/* Notifications */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              style={{ position: "relative", cursor: "pointer" }}
            >
              <Bell size={20} style={{ color: "var(--text-secondary)" }} />
              {notifications > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position: "absolute", top: -4, right: -4,
                    width: 16, height: 16, borderRadius: "50%",
                    background: "var(--danger)",
                    fontSize: 9, fontWeight: 700,
                    color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {notifications}
                </motion.div>
              )}
            </motion.div>

            {/* User avatar */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg, #0D3B8E, #4A9FE8)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "white",
                cursor: "pointer",
                border: "2px solid var(--border-default)",
              }}
            >
              A
            </motion.div>

            {/* Mobile Menu Toggle */}
            {isMobile && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMobileOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 4,
                  marginLeft: 4,
                }}
              >
                <Menu size={24} />
              </motion.button>
            )}
          </div>
        </header>

        {/* ---- PAGE CONTENT ---- */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            position: "relative",
          }}
        >
          {/* Subtle background grid */}
          <div
            className="bg-grid"
            style={{
              position: "fixed",
              inset: 0,
              pointerEvents: "none",
              zIndex: 0,
              opacity: 0.4,
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
