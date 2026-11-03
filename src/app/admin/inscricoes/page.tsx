import React from "react";
import { RegistrationsManager } from "@/components/admin/RegistrationsManager";
import { getCurrentIdentity } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Inscrições e autorizações — FSY Admin",
};

export default async function AdminRegistrationsPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect("/login");
  if (!hasRole(identity.role, "userManagers")) redirect("/dashboard");
  return <RegistrationsManager />;
}
