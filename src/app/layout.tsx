import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Módulo Info — Automação Comercial",
  description: "Sistema de administração de posto de combustível — Módulo Info Automação Comercial",
  keywords: ["posto de combustível", "automação comercial", "módulo info", "gestão"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
