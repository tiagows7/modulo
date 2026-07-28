import DashboardLayout from "@/app/dashboard/layout";
import { ReactNode } from "react";
export default function L({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
