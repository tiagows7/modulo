import DashboardLayout from "@/app/administrativo/layout";
import { ReactNode } from "react";

export default function UsuariosLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
