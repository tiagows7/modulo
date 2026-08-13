"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Fuel, Lock, User, AlertCircle } from "lucide-react";

// Animated background orbs
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
    {/* Grid overlay */}
    <div className="bg-grid" style={{ position: "absolute", inset: 0, opacity: 0.5 }} />
  </div>
);

// Logo animated component
const Logo = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.8, y: -20 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
  >
    {/* Logo icon — two overlapping squares mimicking the Módulo Info logo */}
    {/* 3 squares: dark + light at same top level, medium below-center */}
    <div style={{ position: "relative", width: 96, height: 72 }}>
      {/* Square 1 — darkest navy, TOP-LEFT, z:1 (behind everything) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        style={{
          position: "absolute", left: 0, top: 0,
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, #0A1F6E, #0D3090)",
          zIndex: 1,
        }}
      />
      {/* Square 2 — medium blue, CENTER-BOTTOM, z:2 (covers bottom-right of dark) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.38, duration: 0.5 }}
        style={{
          position: "absolute", left: 24, top: 28,
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, #1255C8, #1A6FD8)",
          zIndex: 2,
        }}
      />
      {/* Square 3 — lightest blue, TOP-RIGHT (same height as dark), z:3 (front) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.51, duration: 0.5 }}
        style={{
          position: "absolute", left: 52, top: 0,
          width: 44, height: 44, borderRadius: 10,
          background: "linear-gradient(135deg, #4A9FE8, #7EC8F8)",
          zIndex: 3,
        }}
      />
    </div>

    {/* Title */}
    <div style={{ textAlign: "center" }}>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
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
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
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
      </motion.p>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        style={{
          height: 2,
          background: "linear-gradient(90deg, transparent, #F5C518, transparent)",
          marginTop: 8,
        }}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
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
      </motion.p>
    </div>
  </motion.div>
);

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    // Simulate auth — replace with Supabase later
    await new Promise((r) => setTimeout(r, 1200));

    if (username === "admin" && password === "admin") {
      router.push("/administrativo");
    } else if (username === "pdv" && password === "pdv") {
      router.push("/pdv");
    } else {
      setLoading(false);
      setError("Usuário ou senha incorretos.");
    }
  };

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

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
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
        {/* Logo */}
        <Logo />

        {/* Login card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
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

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Username */}
            <div style={{ position: "relative" }}>
              <label
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
                  type="text"
                  placeholder="Digite seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-base"
                  style={{ paddingLeft: 40 }}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
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
                  type={showPassword ? "text" : "password"}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base"
                  style={{ paddingLeft: 40, paddingRight: 44 }}
                  autoComplete="current-password"
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

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8, padding: "10px 14px",
                  color: "#EF4444", fontSize: 13,
                }}
              >
                <AlertCircle size={15} />
                {error}
              </motion.div>
            )}

            {/* Hint */}
            <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
              Acesso: <strong style={{ color: "var(--blue-light)" }}>admin</strong> ou <strong style={{ color: "var(--blue-light)" }}>pdv</strong> (senha igual ao usuário)
            </p>

            {/* Submit */}
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
              disabled={loading}
            >
              {loading ? (
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
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          style={{
            textAlign: "center", fontSize: 11,
            color: "var(--text-disabled)",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          © 2025 Módulo Info — Automação Comercial. Todos os direitos reservados.
        </motion.p>
      </motion.div>
    </div>
  );
}
