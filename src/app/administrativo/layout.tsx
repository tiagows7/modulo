"use client";

import { useState, useEffect } from "react";
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
  X,
} from "lucide-react";
import { DbStatusProvider } from "@/components/DbStatusProvider";
import { supabase } from "@/lib/supabase";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/administrativo", group: "geral" },
  { icon: Users, label: "Cadastros", href: "/cadastros", group: "operacao" },
  { icon: Package, label: "Estoque", href: "/estoque", group: "operacao" },
  { icon: ArrowLeftRight, label: "Movimento", href: "/movimento", group: "operacao" },
  { icon: CreditCard, label: "Contas a Pagar", href: "/contas-pagar", group: "financeiro" },
  { icon: FileText, label: "Contas a Receber", href: "/contas-receber", group: "financeiro" },
  { icon: ClipboardList, label: "Faturamento", href: "/faturamento", group: "financeiro" },
  { icon: DollarSign, label: "Financeiro", href: "/financeiro", group: "financeiro" },
  { icon: Monitor, label: "Movimento PDV", href: "/pdv", group: "pdv" },
  { icon: ClipboardList, label: "Rotinas Sped", href: "/sped", group: "fiscal" },
  { icon: Settings, label: "Usuários", href: "/usuarios", group: "config" },
  { icon: Download, label: "Importa Cadastros", href: "/importa", group: "config" },
];

const groupLabels: Record<string, string> = {
  geral: "Geral",
  operacao: "Operação",
  financeiro: "Financeiro",
  pdv: "PDV",
  fiscal: "Fiscal",
  config: "Configurações",
};

const groups = Array.from(new Set(navItems.map((i) => i.group)));

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

function BrandMark() {
  return (
    <div style={{ position: "relative", flexShrink: 0, width: 48, height: 36 }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0,
          width: 22, height: 22, borderRadius: 5,
          background: "linear-gradient(135deg, #0A1F6E, #0D3090)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute", left: 13, top: 14,
          width: 22, height: 22, borderRadius: 5,
          background: "linear-gradient(135deg, #1255C8, #1A6FD8)",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute", left: 26, top: 0,
          width: 22, height: 22, borderRadius: 5,
          background: "linear-gradient(135deg, #4A9FE8, #7EC8F8)",
          zIndex: 3,
        }}
      />
    </div>
  );
}

function SidebarContent({
  collapsed,
  pathname,
  onNavigate,
  onLogout,
}: {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "20px 6px",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: 12,
          minHeight: 76,
        }}
      >
        <BrandMark />
        {!collapsed && (
          <div style={{ overflow: "hidden", minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
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
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        {groups.map((group, gIdx) => {
          const items = navItems.filter((i) => i.group === group);
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              {!collapsed ? (
                <>
                  {gIdx > 0 && (
                    <div
                      style={{
                        height: 1,
                        background: "var(--border-subtle)",
                        margin: "8px 6px",
                      }}
                    />
                  )}
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "1.5px",
                      textTransform: "uppercase",
                      color: "var(--text-disabled)",
                      padding: "8px 12px 6px",
                    }}
                  >
                    {groupLabels[group]}
                  </div>
                </>
              ) : (
                gIdx > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: "var(--border-subtle)",
                      margin: "8px 4px",
                    }}
                  />
                )
              )}

              {items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    style={{ textDecoration: "none" }}
                  >
                    <div
                      className={`sidebar-item ${isActive ? "active" : ""}`}
                      style={{
                        justifyContent: collapsed ? "center" : "flex-start",
                        padding: collapsed ? "10px 0" : "10px 16px",
                      }}
                    >
                      <Icon size={18} style={{ flexShrink: 0 }} />
                      {!collapsed && (
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.label}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10, paddingBottom: 16 }}>
        <button
          type="button"
          className="sidebar-item"
          onClick={onLogout}
          style={{
            width: "100%",
            color: "var(--danger)",
            justifyContent: collapsed ? "center" : "flex-start",
            padding: collapsed ? "10px 0" : "10px 16px",
            background: "transparent",
            border: "none",
            font: "inherit",
          }}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [notifications] = useState(3);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
      } else {
        setLoadingSession(false);
      }
    });
  }, [router]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loadingSession) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-muted)' }}>
        Carregando...
      </div>
    );
  }

  const sidebarWidth = collapsed ? 72 : 248;

  return (
    <DbStatusProvider>
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--bg-base)",
      }}
    >
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            border: "none",
            zIndex: 40,
            cursor: "pointer",
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          width: isMobile ? 248 : sidebarWidth,
          minWidth: isMobile ? 248 : sidebarWidth,
          background: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          height: "100vh",
          position: isMobile ? "fixed" : "relative",
          left: 0,
          top: 0,
          zIndex: 50,
          flexShrink: 0,
          transition: isMobile ? "transform 0.25s ease" : "width 0.2s ease, min-width 0.2s ease",
          transform: isMobile && !mobileOpen ? "translateX(-105%)" : "translateX(0)",
          boxShadow: isMobile && mobileOpen ? "8px 0 32px rgba(0,0,0,0.35)" : undefined,
        }}
      >
        <SidebarContent
          collapsed={!isMobile && collapsed}
          pathname={pathname}
          onNavigate={() => setMobileOpen(false)}
          onLogout={async () => {
            await supabase.auth.signOut();
            router.push("/");
          }}
        />

        {!isMobile && (
          <button
            type="button"
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => setCollapsed((v) => !v)}
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
          </button>
        )}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                aria-label="Abrir menu"
                onClick={() => setMobileOpen(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
            <Fuel size={18} style={{ color: "var(--gold)", flexShrink: 0 }} />
            <span
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {navItems.find((i) => i.href === pathname)?.label ?? "Sistema"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 20, flexShrink: 0 }}>
            {!isMobile && <Clock />}

            <div style={{ position: "relative", cursor: "pointer" }}>
              <Bell size={20} style={{ color: "var(--text-secondary)" }} />
              {notifications > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--danger)",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {notifications}
                </div>
              )}
            </div>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #0D3B8E, #4A9FE8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                color: "white",
                border: "2px solid var(--border-default)",
              }}
            >
              A
            </div>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            position: "relative",
          }}
        >
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
          <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
    </DbStatusProvider>
  );
}
