import React from "react";
import { UserManager } from "@/components/admin/UserManager";

export const metadata = {
  title: "Gestão de Usuários — FSY Admin",
};

export default function AdminUsersPage() {
  return <UserManager />;
}
