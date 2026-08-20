"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Eye, EyeOff, Fuel, Lock, User } from "lucide-react";

const BackgroundOrbs = () => (
  <div style={{ position: "fixed", inset: 0, overflow: "hidden", zIndex: 0, pointerEvents: "none" }}>
    <motion.div
      animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.1, 1] }}
      transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute", top: "-10%", left: "-5%",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(13,59,142,0.35) 0%, transparent 70%)",
      }}
    />
    <motion.div
      animate={{ x: [0, -50, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
      transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      style={{
        position: "absolute", bottom: "-15%", right: "-10%",
        width: 700, height: 700, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(26,111,216,0.25) 0%, transparent 70%)",
      }}
    />
    <motion.div
      animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      style={{
        position: "absolute", top: "40%", left: "60%",
        width: 300, height: 300, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(245,197,24,0.08) 0%, transparent 70%)",
      }}
    />
    <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.5 }} />
  </div>
);

const Logo = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
    <div style={{ position: "relative", width: 96, height: 72 }}>
      <div
        style={{
          position: "absolute", left: 0, top: 0,
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, #0A1F6E, #0D3090)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute", left: 24, top: 28,
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, #1255C8, #1A6FD8)",
          zIndex: 2,
        }}
      />
      <div
        style={{
          position: "absolute", left: 52, top: 0,
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, #4A9FE8, #7EC8F8)",
          zIndex: 3,
        }}
      />
    </div>

    <div style={{ textAlign: "center" }}>
      <h1
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 32,
          fontWeight: 800,
          color: "#E8EDF5",
          letterSpacing: "-0.5px",
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        Módulo Info
      </h1>
      <p
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "#4A9FE8",
        }}
      >
        Automação Comercial
      </p>
      <div
        style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, #F5C518, transparent)",
          marginTop: 8,
        }}
      />
      <p
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: 18,
          fontWeight: 700,
          color: "#F5C518",
          marginTop: 6,
          letterSpacing: "1px",
        }}
      >
        soluções{" "}
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "2px", color: "#D4A817" }}>
          FLEXIBILIZADAS
        </span>
      </p>
    </div>
  </div>
);

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        padding: 20,
        position: "relative",
      }}
    >
      <BackgroundOrbs />

      <div
        style={{
          width: "100%",
          maxWidth: 440,
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <Logo />

        <div
          className="glass"
          style={{
            borderRadius: 20,
            padding: "36px 32px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(74,159,232,0.15)",
          }}
        >
          <h2
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 18,
              fontWeight: 600,
              color: "var(--text-primary)",
              marginBottom: 4,
            }}
          >
            Bem-vindo de volta
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>
            Acesse o sistema com suas credenciais
          </p>

          {/* POST nativo: funciona mesmo se o React não hidratar (evita /?#). */}
          <form
            method="post"
            action="/api/auth/login-form"
            onSubmit={() => setSubmitting(true)}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={{ position: "relative" }}>
              <label
                htmlFor="username"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Usuário
              </label>
              <div style={{ position: "relative" }}>
                <User
                  size={16}
                  style={{
                    position: "absolute", left: 12, top: "50%",
                    transform: "translateY(-50%)", color: "var(--text-muted)",
                  }}
                />
                <input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Digite seu usuário"
                  className="input-base"
                  style={{ paddingLeft: 40 }}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  marginBottom: 6,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Senha
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute", left: 12, top: "50%",
                    transform: "translateY(-50%)", color: "var(--text-muted)",
                  }}
                />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  className="input-base"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: 12, top: "50%",
                    transform: "translateY(-50%)", background: "none",
                    border: "none", cursor: "pointer", color: "var(--text-muted)",
                    display: "flex", alignItems: "center",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--blue-light)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              Acesso: <strong style={{ color: "var(--blue-light)" }}>admin</strong> ou{" "}
              <strong style={{ color: "var(--blue-light)" }}>pdv</strong> (senha igual ao usuário)
            </p>

            <motion.button
              type="submit"
              id="btn-login"
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "14px",
                fontSize: 15,
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "white",
                    }}
                  />
                  Entrando...
                </>
              ) : (
                <>
                  <Fuel size={16} />
                  Entrar no Sistema
                </>
              )}
            </motion.button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center", fontSize: 11,
            color: "var(--text-disabled)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          © 2025 Módulo Info — Automação Comercial. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
