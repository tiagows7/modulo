import DashboardLayout from "@/app/administrativo/layout";
import { ReactNode } from "react";

export default function ConfiguracaoPdvLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
