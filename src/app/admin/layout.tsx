import React from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayout activeRole="medico">{children}</AdminLayout>;
}
