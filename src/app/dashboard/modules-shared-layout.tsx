"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

// Shared layout for all module pages (reuses dashboard layout)
// The actual layout wrapper is the dashboard/layout.tsx
// This file applies to all sub-route groups that share the sidebar
export default function ModulesSharedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
